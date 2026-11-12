import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

def test_dhcp_dns_ldap_and_clouds():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            headless=True
        )
        context = browser.new_context(viewport={'width': 1400, 'height': 900})
        page = context.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("console", lambda msg: print(f"[Console {msg.type}] {msg.text}"))

        print("1. Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle")
        page.wait_for_timeout(1200)

        assert len(errors) == 0, f"Page had Javascript errors: {errors}"
        print("   ✅ Application loaded cleanly without JS errors.")

        print("\n2. Testing Single-Port Internet Clouds (RFC 3849 & Anycast Loopbacks)...")
        cloud_eval = page.evaluate("""() => {
            const app = window.PXLApp;
            const sim = app.sim;
            
            // Create simulated and public clouds
            const simCloud = new CiscoDevice('cloud_sim_test', 'internet_simulated', 'Het Internet (Simulatie)', 100, 100);
            const pubCloud = new CiscoDevice('cloud_pub_test', 'internet_public', 'Het Internet (Publiek)', 200, 100);
            
            const simPorts = Object.keys(simCloud.interfaces);
            const pubPorts = Object.keys(pubCloud.interfaces);
            
            const simGi0 = simCloud.interfaces['GigabitEthernet0'];
            const pubGi0 = pubCloud.interfaces['GigabitEthernet0'];
            
            // Check SVG icons
            const simSvg = window.CiscoIcons ? window.CiscoIcons.internet_simulated : null;
            const pubSvg = window.CiscoIcons ? window.CiscoIcons.internet_public : null;
            const simMapped = window.getCiscoDeviceIcon ? window.getCiscoDeviceIcon('internet_simulated') : null;
            
            return {
                simPortCount: simPorts.length,
                simPortName: simPorts[0],
                simIp: simGi0?.ip,
                simMask: simGi0?.mask,
                simLoopbacks: simCloud.loopbacks,
                pubPortCount: pubPorts.length,
                pubPortName: pubPorts[0],
                pubIp: pubGi0?.ip,
                hasSimSvg: !!simSvg && simSvg.includes('<svg') && simSvg.includes('SIM INTERNET'),
                hasPubSvg: !!pubSvg && pubSvg.includes('<svg') && pubSvg.includes('LIVE INTERNET'),
                simIconIsCloud: !!simMapped && simMapped.includes('SIM INTERNET')
            };
        }""")
        print(f"   Cloud evaluation result: {cloud_eval}")
        assert cloud_eval["simPortCount"] == 1, f"Expected 1 physical port on sim cloud, got {cloud_eval['simPortCount']}"
        assert cloud_eval["simPortName"] == "GigabitEthernet0", "Expected GigabitEthernet0"
        assert cloud_eval["simIp"] == "209.165.200.225", f"Expected 209.165.200.225, got {cloud_eval['simIp']}"
        assert cloud_eval["simMask"] == "255.255.255.252", "Expected 255.255.255.252 (/30)"
        assert "8.8.8.8" in cloud_eval["simLoopbacks"], "Expected 8.8.8.8 in loopbacks"
        assert cloud_eval["hasSimSvg"], "Sim cloud icon must be SVG cloud with SIM INTERNET badge"
        assert cloud_eval["hasPubSvg"], "Public cloud icon must be SVG cloud with LIVE INTERNET badge"
        assert cloud_eval["simIconIsCloud"], "getCiscoDeviceIcon must return cloud SVG"
        print("   ✅ Single-port Internet Clouds & RFC 3849 addressing verified.")

        print("\n3. Testing Server-PT DHCP Service & Client Lease Allocation...")
        dhcp_eval = page.evaluate("""() => {
            const app = window.PXLApp;
            const sim = app.sim;
            sim.reset();

            // Set up Server-PT and PC connected directly
            const server = new CiscoDevice('Server0', 'server', 'Server-PT', 200, 200);
            server.ip = '172.16.1.10';
            server.mask = '255.255.255.0';
            server.gateway = '172.16.1.1';
            server.dns = '172.16.1.10';
            server.interfaces['FastEthernet0'].ip = '172.16.1.10';
            server.interfaces['FastEthernet0'].mask = '255.255.255.0';
            server.services.dhcp.enabled = true;
            server.services.dhcp.gateway = '172.16.1.1';
            server.services.dhcp.dns = '172.16.1.10';
            server.services.dhcp.startIp = '172.16.1.100';
            server.services.dhcp.mask = '255.255.255.0';
            server.services.dhcp.pools = [{
                name: 'serverPool',
                gateway: '172.16.1.1',
                dns: '172.16.1.10',
                startIp: '172.16.1.100',
                mask: '255.255.255.0',
                maxUsers: 50
            }];

            const pc = new CiscoDevice('PC0', 'pc', 'PC0', 400, 200);
            pc.ip = '';
            pc.mask = '';
            pc.gateway = '';
            pc.dns = '';
            pc.interfaces['FastEthernet0'].ip = '';

            sim.addDevice(server);
            sim.addDevice(pc);
            sim.connectCable('Server0', 'FastEthernet0', 'PC0', 'FastEthernet0', 'straight');

            // Trigger DHCP request from PC
            const leaseRes = sim.requestDhcp('PC0', 'FastEthernet0');

            return {
                leaseSuccess: leaseRes.success,
                leasedIp: leaseRes.ip,
                leasedMask: leaseRes.mask,
                leasedGateway: leaseRes.gateway,
                leasedDns: leaseRes.dns,
                serverName: leaseRes.serverName,
                serverLeasesCount: server.services.dhcp.leases.length,
                serverLeaseIp: server.services.dhcp.leases[0]?.ip,
                serverLeaseHostname: server.services.dhcp.leases[0]?.hostname,
                pcIp: pc.ip,
                pcDhcpEnabled: pc.dhcpEnabled
            };
        }""")
        print(f"   Server DHCP result: {dhcp_eval}")
        assert dhcp_eval["leaseSuccess"], "DHCP lease request should succeed"
        assert dhcp_eval["leasedIp"] == "172.16.1.100", f"Expected leased IP 172.16.1.100, got {dhcp_eval['leasedIp']}"
        assert dhcp_eval["leasedGateway"] == "172.16.1.1", "Expected gateway 172.16.1.1"
        assert dhcp_eval["leasedDns"] == "172.16.1.10", "Expected DNS 172.16.1.10"
        assert dhcp_eval["serverLeasesCount"] == 1, "Server should have recorded 1 active lease"
        assert dhcp_eval["serverLeaseIp"] == "172.16.1.100", "Lease table entry IP mismatch"
        assert dhcp_eval["pcIp"] == "172.16.1.100", "PC IP not set by DHCP"
        print("   ✅ Server-PT DHCP service allocates IP and maintains lease table.")

        print("\n4. Testing PC Command Prompt 'ipconfig /renew' & 'ipconfig /release'...")
        cmd_eval = page.evaluate("""() => {
            const app = window.PXLApp;
            const sim = app.sim;
            const pc = sim.devices['PC0'];

            const outputLines = [];
            const pcHandler = new PCDesktopHandler(
                pc,
                (t) => outputLines.push(t),
                () => {},
                () => {}
            );

            // Test ipconfig /release
            pcHandler.handleCommand('ipconfig /release');
            const ipAfterRelease = pc.ip;

            // Test ipconfig /renew
            pcHandler.handleCommand('ipconfig /renew');
            const ipAfterRenew = pc.ip;

            return {
                ipAfterRelease,
                ipAfterRenew,
                output: outputLines.join('\\n')
            };
        }""")
        print(f"   ipconfig output preview:\n{cmd_eval['output']}")
        assert cmd_eval["ipAfterRelease"] == "0.0.0.0", f"IP after release should be 0.0.0.0, got {cmd_eval['ipAfterRelease']}"
        assert cmd_eval["ipAfterRenew"] == "172.16.1.100", f"IP after renew should be 172.16.1.100, got {cmd_eval['ipAfterRenew']}"
        assert "DHCP ACK received" in cmd_eval["output"], "Expected DHCP ACK message in output"
        print("   ✅ 'ipconfig /release' and 'ipconfig /renew' command line operations verified.")

        print("\n5. Testing Standalone AP Internal DHCP & Web Management Interface...")
        ap_eval = page.evaluate("""() => {
            const app = window.PXLApp;
            const sim = app.sim;
            sim.reset();

            const ap = new CiscoDevice('AP0', 'wireless_ap', 'Cisco-Aironet-3702', 300, 300);
            ap.apConfig.mode = 'standalone';
            ap.apConfig.ip = '10.10.0.100';
            ap.apConfig.mask = '255.255.255.0';
            ap.apConfig.dhcpEnabled = true;
            ap.apConfig.dhcpPool = {
                startIp: '10.10.0.101',
                mask: '255.255.255.0',
                gateway: '10.10.0.100',
                dns: '8.8.8.8',
                maxUsers: 30
            };

            const laptop = new CiscoDevice('Laptop0', 'laptop', 'Laptop-WiFi', 320, 300);
            laptop.ip = '';
            laptop.wireless.ssid = ap.wireless.ssid;
            laptop.wireless.passphrase = ap.wireless.passphrase;

            sim.addDevice(ap);
            sim.addDevice(laptop);
            sim.updateWirelessAssociations();

            // Check association
            const assocApId = sim.wirelessAssociations['Laptop0'];

            // Laptop requests DHCP from Standalone AP
            const dhcpRes = sim.requestDhcp('Laptop0', 'Wireless0');

            // Render AP Web GUI HTML
            const webHtml = window.renderApWebInterfaceHtml ? window.renderApWebInterfaceHtml(ap, sim) : '';

            // HTTP fetch to AP
            const httpRes = sim.fetchHttp('Laptop0', 'http://10.10.0.100');

            return {
                associatedWith: assocApId,
                dhcpSuccess: dhcpRes.success,
                laptopIp: dhcpRes.ip,
                laptopGw: dhcpRes.gateway,
                apLeaseCount: ap.apConfig.dhcpLeases.length,
                apLeaseIp: ap.apConfig.dhcpLeases[0]?.ip,
                hasWebHtml: !!webHtml && webHtml.includes('CISCO AIRONET WEB MANAGEMENT') && webHtml.includes('Activatie Handleiding'),
                httpSuccess: httpRes.success,
                httpHasTitle: httpRes.html?.includes('CISCO AIRONET WEB MANAGEMENT')
            };
        }""")
        print(f"   Standalone AP result: {ap_eval}")
        assert ap_eval["associatedWith"] == "AP0", "Laptop should be associated with AP0"
        assert ap_eval["dhcpSuccess"], "AP internal DHCP should grant lease"
        assert ap_eval["laptopIp"] == "10.10.0.101", f"Expected laptop IP 10.10.0.101, got {ap_eval['laptopIp']}"
        assert ap_eval["laptopGw"] == "10.10.0.100", "Expected gateway 10.10.0.100"
        assert ap_eval["apLeaseCount"] == 1, "AP should track 1 lease"
        assert ap_eval["hasWebHtml"], "AP Web GUI HTML should render with title and Activatie Handleiding"
        assert ap_eval["httpSuccess"], "HTTP fetch to AP IP should succeed"
        print("   ✅ Standalone AP internal DHCP and Web Management interface verified.")

        print("\n6. Testing Server-PT DNS Service (A, CNAME) & DNS Forwarders...")
        dns_eval = page.evaluate("""() => {
            const app = window.PXLApp;
            const sim = app.sim;
            sim.reset();

            const server = new CiscoDevice('Server0', 'server', 'Server-PT', 200, 200);
            server.ip = '172.16.1.10';
            server.mask = '255.255.255.0';
            server.interfaces['FastEthernet0'].ip = '172.16.1.10';
            server.interfaces['FastEthernet0'].mask = '255.255.255.0';
            server.services.dns.enabled = true;
            server.services.dns.records = [
                { name: 'www.pxl.be', type: 'A', ip: '172.16.1.10' },
                { name: 'cisco.pxl', type: 'A', ip: '172.16.1.10' },
                { name: 'portal.pxl.local', type: 'CNAME', target: 'www.pxl.be' }
            ];
            server.services.dns.forwarders = {
                enabled: true,
                primary: '8.8.8.8',
                secondary: '1.1.1.1'
            };

            const pc = new CiscoDevice('PC0', 'pc', 'PC0', 400, 200);
            pc.ip = '172.16.1.50';
            pc.mask = '255.255.255.0';
            pc.dns = '172.16.1.10';
            pc.interfaces['FastEthernet0'].ip = '172.16.1.50';
            pc.interfaces['FastEthernet0'].mask = '255.255.255.0';

            sim.addDevice(server);
            sim.addDevice(pc);
            sim.connectCable('Server0', 'FastEthernet0', 'PC0', 'FastEthernet0', 'straight');

            // 1. Resolve local A record
            const resA = sim.resolveDns('PC0', 'cisco.pxl');
            // 2. Resolve local CNAME alias
            const resCname = sim.resolveDns('PC0', 'portal.pxl.local');
            // 3. Resolve forwarded domain (google.com)
            const resFwd = sim.resolveDns('PC0', 'www.google.com');

            return {
                resA_success: resA.success,
                resA_ip: resA.ip,
                resCname_success: resCname.success,
                resCname_ip: resCname.ip,
                resFwd_success: resFwd.success,
                resFwd_ip: resFwd.ip,
                resFwd_forwarded: resFwd.forwarded
            };
        }""")
        print(f"   DNS resolution results: {dns_eval}")
        assert dns_eval["resA_success"] and dns_eval["resA_ip"] == "172.16.1.10", "A record resolution failed"
        assert dns_eval["resCname_success"] and dns_eval["resCname_ip"] == "172.16.1.10", "CNAME alias resolution failed"
        assert dns_eval["resFwd_success"] and dns_eval["resFwd_ip"] == "8.8.8.8", "DNS Forwarder resolution failed"
        assert dns_eval["resFwd_forwarded"], "Query should be marked as forwarded"
        print("   ✅ Server-PT DNS Service (A, CNAME) and DNS Forwarders verified.")

        print("\n7. Testing Active Directory / LDAP Service & Student 802.1X Wi-Fi Link...")
        ldap_eval = page.evaluate("""() => {
            const app = window.PXLApp;
            const sim = app.sim;
            sim.reset();

            // Set simulated active student in PXLApp
            app.currentUser = {
                username: 's1234567',
                full_name: 'David Parren (PXL Test Student)',
                role: 'student'
            };

            const server = new CiscoDevice('DC01', 'server', 'DC01-PXL', 200, 200);
            server.ip = '172.16.1.10';
            server.interfaces['FastEthernet0'].ip = '172.16.1.10';
            server.services.ldap.enabled = true;
            server.services.ldap.domain = 'pxl.local';
            server.services.ldap.radiusSecret = 'PXL_Secret2026!';
            sim.addDevice(server);

            // 1. Authenticate with current student account
            const authStudent = sim.authenticateRadiusLdap('172.16.1.10', 'PXL_Secret2026!', 's1234567', 'any_pw');
            
            // 2. Authenticate with seeded domain user 'student1'
            const authSeeded = sim.authenticateRadiusLdap('172.16.1.10', 'PXL_Secret2026!', 'student1', 'PXL2026!');
            
            // 3. Authenticate with invalid username
            const authInvalid = sim.authenticateRadiusLdap('172.16.1.10', 'PXL_Secret2026!', 'nonexistent_user', 'pass');

            return {
                studentSuccess: authStudent.success,
                studentUser: authStudent.user?.username,
                studentDomain: authStudent.domain,
                seededSuccess: authSeeded.success,
                seededUser: authSeeded.user?.username,
                invalidSuccess: authInvalid.success,
                invalidReason: authInvalid.reason
            };
        }""")
        print(f"   LDAP / RADIUS results: {ldap_eval}")
        assert ldap_eval["studentSuccess"], "Active student login should authenticate successfully"
        assert ldap_eval["studentUser"] == "s1234567", "Student username mismatch"
        assert ldap_eval["studentDomain"] == "pxl.local", "Domain mismatch"
        assert ldap_eval["seededSuccess"], "Seeded student1 user should authenticate"
        assert not ldap_eval["invalidSuccess"], "Invalid user should fail authentication"
        print("   ✅ LDAP / Active Directory service & Student 802.1X authentication verified.")

        print("\n8. Testing Cisco 3504 WLC AireOS CLI Parser...")
        wlc_eval = page.evaluate("""() => {
            const wlc = new CiscoDevice('WLC0', 'wlc', 'Cisco-3504-WLC', 300, 300);
            const lines = [];
            let currentPrompt = '';

            const parser = new AireOSCLIParser(
                wlc,
                (t) => lines.push(t),
                () => { currentPrompt = parser.getPrompt(); },
                () => {}
            );

            // Run AireOS commands
            parser.handleCommand('show sysinfo');
            parser.handleCommand('show wlan summary');
            parser.handleCommand('show ap summary');

            return {
                prompt: currentPrompt,
                output: lines.join('\\n')
            };
        }""")
        print(f"   AireOS CLI output preview:\n{wlc_eval['output'][:500]}...")
        assert "(" in wlc_eval["prompt"] and ">" in wlc_eval["prompt"], f"Expected AireOS prompt, got {wlc_eval['prompt']}"
        assert "Manufacturer's Name.............................. Cisco Systems Inc." in wlc_eval["output"], "show sysinfo missing"
        assert "Number of WLANs.................................. 2" in wlc_eval["output"], "show wlan summary missing"
        assert "Number of APs...................................." in wlc_eval["output"], "show ap summary missing"
        print("   ✅ Cisco 3504 WLC AireOS CLI parser verified.")

        print("\n9. Testing Modal UI Tabs for Services, AP Web GUI, and Cloud RFC 3849...")
        ui_eval = page.evaluate("""() => {
            const app = window.PXLApp;
            const sim = app.sim;
            sim.reset();

            // Test Server Services modal rendering
            const server = new CiscoDevice('Server-PT', 'server', 'Server-PT', 200, 200);
            sim.addDevice(server);
            app.activeDevice = server;
            app.renderServicesTab();
            const srvPaneHtml = document.getElementById('modalPaneServices')?.innerHTML || '';

            // Switch to DHCP subtab
            app.switchServiceSubtab('dhcp');
            const dhcpSubHtml = document.getElementById('modalPaneServices')?.innerHTML || '';

            // Switch to DNS subtab
            app.switchServiceSubtab('dns');
            const dnsSubHtml = document.getElementById('modalPaneServices')?.innerHTML || '';

            // Switch to LDAP subtab
            app.switchServiceSubtab('ldap');
            const ldapSubHtml = document.getElementById('modalPaneServices')?.innerHTML || '';

            // Test Standalone AP Web modal rendering
            const ap = new CiscoDevice('AP0', 'wireless_ap', 'Cisco-Aironet-3702', 300, 300);
            sim.addDevice(ap);
            app.activeDevice = ap;
            app.renderApWebTab();
            const apWebPaneHtml = document.getElementById('modalPaneApweb')?.innerHTML || '';

            // Test Cloud explanation modal rendering
            const cloud = new CiscoDevice('Internet0', 'internet_simulated', 'Het Internet (Simulatie)', 100, 100);
            sim.addDevice(cloud);
            app.activeDevice = cloud;
            app.renderCliTab();
            const cloudCliPaneHtml = document.getElementById('modalPaneCli')?.innerHTML || '';

            return {
                hasDhcpSubtab: dhcpSubHtml.includes('DHCP Pool Eigenschappen') && dhcpSubHtml.includes('Actieve DHCP Leases'),
                hasDnsSubtab: dnsSubHtml.includes('DNS Forwarders') && dnsSubHtml.includes('Actieve DNS Records'),
                hasLdapSubtab: ldapSubHtml.includes('Actieve Student Inlogaccount') && ldapSubHtml.includes('WI-FI 802.1X GEKOPPELD'),
                hasApWebPane: apWebPaneHtml.includes('Cisco Aironet') && apWebPaneHtml.includes('Activatie Handleiding'),
                hasCloudExplanation: cloudCliPaneHtml.includes('RFC 3849') && cloudCliPaneHtml.includes('209.165.200.225/30') && cloudCliPaneHtml.includes('ip route 0.0.0.0 0.0.0.0')
            };
        }""")
        print(f"   UI modal rendering evaluation: {ui_eval}")
        assert ui_eval["hasDhcpSubtab"], "Server DHCP subtab failed to render properly"
        assert ui_eval["hasDnsSubtab"], "Server DNS subtab with forwarders failed to render properly"
        assert ui_eval["hasLdapSubtab"], "Server LDAP subtab with student badge failed to render properly"
        assert ui_eval["hasApWebPane"], "Standalone AP Web GUI modal pane failed to render properly"
        assert ui_eval["hasCloudExplanation"], "Cloud RFC 3849 explanation pane failed to render properly"
        print("   ✅ All modal UI panes and subtabs render and function perfectly.")

        browser.close()
        print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED!")

if __name__ == '__main__':
    test_dhcp_dns_ldap_and_clouds()
