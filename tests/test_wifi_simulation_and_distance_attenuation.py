import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

def test_wifi_simulation_and_distance_attenuation():
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

        print("2. Verifying Wi-Fi Signal Waves Toolbar Button...")
        toggle_btn = page.locator("#toolToggleWifiSignals")
        assert toggle_btn.is_visible(), "Wi-Fi Waves toggle button should be visible in toolbar"
        initial_text = toggle_btn.inner_text()
        print(f"   Initial state: {initial_text}")
        toggle_btn.click()
        page.wait_for_timeout(300)
        toggled_text = toggle_btn.inner_text()
        print(f"   Toggled state: {toggled_text}")
        assert "Uit" in toggled_text or "Aan" in toggled_text
        # Toggle back on
        toggle_btn.click()
        page.wait_for_timeout(300)
        print("   ✅ Toolbar Wi-Fi waves button toggle functional.")

        print("3. Testing Chapter 8 Lab 1: Standalone AP & PC Wireless (h08_wifi_standalone_ap)...")
        exam_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const lab = app.presetExams['h08_wifi_standalone_ap'];
            if (!lab) return { found: false };
            app.loadExam(lab);
            return {
                found: true,
                devices: Object.keys(app.sim.devices),
                hasPcWirelessInstalled: app.sim.devices['PC0']?.hasWirelessCard(),
                laptopWirelessInstalled: app.sim.devices['Laptop0']?.hasWirelessCard()
            };
        }""")
        assert exam_result["found"], "Lab h08_wifi_standalone_ap must exist in presetExams"
        print(f"   Lab devices: {exam_result['devices']}")
        assert not exam_result["hasPcWirelessInstalled"], "PC0 should initially NOT have Wi-Fi card installed"
        assert exam_result["laptopWirelessInstalled"], "Laptop0 should have WPC300N installed by default"
        print("   ✅ Lab loaded with correct initial hardware states.")

        print("4. Installing WMP300N Wi-Fi card on PC0...")
        install_res = page.evaluate("""() => {
            const app = window.PXLApp;
            const pc0 = app.sim.devices['PC0'];
            pc0.installWirelessCard('WMP300N');
            return {
                installed: pc0.hasWirelessCard(),
                interfaces: Object.keys(pc0.interfaces)
            };
        }""")
        assert install_res["installed"], "PC0 must now have wireless card installed"
        assert "Wireless0" in install_res["interfaces"], "Wireless0 interface must be present on PC0"
        print(f"   PC0 interfaces: {install_res['interfaces']}")
        print("   ✅ WMP300N PCI card installed and Wireless0 created.")

        print("5. Connecting Laptop0 and PC0 to AP1 (PXL-Klas-AP)...")
        assoc_res = page.evaluate("""() => {
            const app = window.PXLApp;
            const pc0 = app.sim.devices['PC0'];
            const lap0 = app.sim.devices['Laptop0'];

            // Configure credentials
            pc0.wireless.ssid = 'PXL-Klas-AP';
            pc0.wireless.authMode = 'WPA2-PSK';
            pc0.wireless.passphrase = 'PXL_Geheim2026!';

            lap0.wireless.ssid = 'PXL-Klas-AP';
            lap0.wireless.authMode = 'WPA2-PSK';
            lap0.wireless.passphrase = 'PXL_Geheim2026!';

            app.sim.updateWirelessAssociations();

            // Run grading rubric
            const evalResult = app.gradingEngine.evaluate(app.sim);

            return {
                pc0Assoc: pc0.wireless.associatedAp,
                pc0Rssi: pc0.wireless.rssi,
                pc0Bars: pc0.wireless.bars,
                lap0Assoc: lap0.wireless.associatedAp,
                score: evalResult.percentage,
                passedCount: evalResult.passedCount,
                totalCount: evalResult.totalCount,
                details: evalResult.objectives.map(o => `${o.title}: ${o.passed ? 'PASS' : 'FAIL'} (${o.detail})`)
            };
        }""")
        print(f"   PC0 Associated AP: {assoc_res['pc0Assoc']} (RSSI: {assoc_res['pc0Rssi']} dBm, Bars: {assoc_res['pc0Bars']})")
        print(f"   Laptop0 Associated AP: {assoc_res['lap0Assoc']}")
        print(f"   Lab 1 Score: {assoc_res['score']}% ({assoc_res['passedCount']}/{assoc_res['totalCount']})")
        for d in assoc_res["details"]:
            print(f"     - {d}")
        assert assoc_res["score"] == 100, f"Lab 1 should score 100%, got {assoc_res['score']}%"
        print("   ✅ Wi-Fi association and end-to-end ping over Wi-Fi verified at 100%.")

        print("6. Verifying Distance Attenuation & Real-Time Signal Degradation...")
        atten_res = page.evaluate("""() => {
            const app = window.PXLApp;
            const ap = app.sim.devices['AP1'];
            const pc = app.sim.devices['PC0'];

            const testDistances = [
                { name: "Zone 1 (Core <100px)", x: ap.x + 50, y: ap.y },
                { name: "Zone 2 (PXL VoIP Norm ~150px)", x: ap.x + 150, y: ap.y },
                { name: "Zone 3 (Roaming Alert ~250px)", x: ap.x + 250, y: ap.y },
                { name: "Zone 4 (Outer Boundary ~350px)", x: ap.x + 350, y: ap.y },
                { name: "Out of Range (>380px)", x: ap.x + 450, y: ap.y }
            ];

            const results = [];
            for (const td of testDistances) {
                pc.x = td.x;
                pc.y = td.y;
                app.sim.updateWirelessAssociations();
                results.push({
                    zone: td.name,
                    distancePx: Math.round(Math.hypot(pc.x - ap.x, pc.y - ap.y)),
                    rssi: pc.wireless.rssi,
                    bars: pc.wireless.bars,
                    txRate: pc.wireless.txRate,
                    associated: !!pc.wireless.associatedAp
                });
            }
            return results;
        }""")
        for r in atten_res:
            print(f"   {r['zone']}: Dist={r['distancePx']}px, RSSI={r['rssi']} dBm, Bars={r['bars']}, Rate={r['txRate']} Mbps, Connected={r['associated']}")

        # Verifications
        z1 = atten_res[0]
        z2 = atten_res[1]
        z3 = atten_res[2]
        z4 = atten_res[3]
        out_range = atten_res[4]

        assert z1["rssi"] > -55, f"Zone 1 should have strong signal > -55 dBm, got {z1['rssi']}"
        assert z1["bars"] == 4, "Zone 1 should show 4 bars"
        assert z2["rssi"] >= -70, f"Zone 2 should satisfy PXL VoIP norm, got {z2['rssi']}"
        assert z3["rssi"] < z2["rssi"], "Signal should degrade with distance"
        assert z4["rssi"] < z3["rssi"], "Signal should degrade further"
        assert not out_range["associated"], "Device beyond 380px drop threshold must disconnect"
        print("   ✅ Real-time distance attenuation and drop threshold confirmed!")

        print("7. Testing Cisco Linksys WRT300N Wireless Router & Web GUI...")
        wrt_res = page.evaluate("""() => {
            const app = window.PXLApp;
            app.sim.clear();

            const wrt = new CiscoDevice('wrt1', 'wireless_router', 'WRT300N-Router');
            app.sim.registerDevice(wrt);

            const laptop = new CiscoDevice('lap1', 'laptop', 'Laptop-Client');
            app.sim.registerDevice(laptop);

            laptop.x = wrt.x + 80;
            laptop.y = wrt.y;
            laptop.wireless.ssid = 'PXL-Wireless-Router';
            laptop.wireless.authMode = 'WPA2-PSK';
            laptop.wireless.passphrase = 'PXL2026Net!';

            app.sim.updateWirelessAssociations();

            // HTTP fetch to WRT300N Web GUI
            const webRes = app.sim.fetchHttp('lap1', 'http://192.168.0.1');

            return {
                wrtLanIp: wrt.wrtConfig.lanIp,
                laptopIp: laptop.ip,
                laptopAssoc: laptop.wireless.associatedAp,
                httpSuccess: webRes.success,
                containsWRT: (webRes.html || '').includes('WRT300N') || (webRes.html || '').includes('Linksys'),
                containsSSID: (webRes.html || '').includes('PXL-Wireless-Router')
            };
        }""")
        print(f"   WRT300N LAN IP: {wrt_res['wrtLanIp']}")
        print(f"   Laptop leased IP: {wrt_res['laptopIp']} (Associated: {wrt_res['laptopAssoc']})")
        print(f"   Web GUI response: Success={wrt_res['httpSuccess']}, Has WRT/Linksys={wrt_res['containsWRT']}")
        assert wrt_res["laptopIp"].startswith("192.168.0."), "Laptop should have received DHCP lease from WRT300N"
        assert wrt_res["httpSuccess"], "HTTP request to 192.168.0.1 must succeed"
        assert wrt_res["containsWRT"], "Web response must contain WRT300N header"
        print("   ✅ Cisco Linksys WRT300N Web GUI verified.")

        print("8. Testing Chapter 8 Lab 2: Cisco 3504 WLC Multi-SSID & VLANs (h08_wifi_enterprise_wlc)...")
        wlc_lab_res = page.evaluate("""() => {
            const app = window.PXLApp;
            const lab = app.presetExams['h08_wifi_enterprise_wlc'];
            if (!lab) return { found: false };
            app.loadExam(lab);

            const lapStaff = app.sim.devices['Laptop-Staff'];
            const lapGuest = app.sim.devices['Laptop-Guest'];

            // Connect Staff laptop to PXL-Staff
            lapStaff.wireless.ssid = 'PXL-Staff';
            lapStaff.wireless.authMode = 'WPA2-PSK';
            lapStaff.wireless.passphrase = 'CiscoStaff123!';

            // Connect Guest laptop to PXL-Guest
            lapGuest.wireless.ssid = 'PXL-Guest';
            lapGuest.wireless.authMode = 'Open';
            lapGuest.wireless.passphrase = '';

            app.sim.updateWirelessAssociations();

            const evalResult = app.gradingEngine.evaluate(app.sim);

            return {
                found: true,
                staffIp: lapStaff.ip,
                guestIp: lapGuest.ip,
                score: evalResult.percentage,
                passedCount: evalResult.passedCount,
                totalCount: evalResult.totalCount,
                details: evalResult.objectives.map(o => `${o.title}: ${o.passed ? 'PASS' : 'FAIL'} (${o.detail})`)
            };
        }""")
        assert wlc_lab_res["found"], "h08_wifi_enterprise_wlc lab must be found"
        print(f"   Laptop-Staff IP: {wlc_lab_res['staffIp']}")
        print(f"   Laptop-Guest IP: {wlc_lab_res['guestIp']}")
        print(f"   Lab 2 Score: {wlc_lab_res['score']}% ({wlc_lab_res['passedCount']}/{wlc_lab_res['totalCount']})")
        for d in wlc_lab_res["details"]:
            print(f"     - {d}")
        assert wlc_lab_res["staffIp"].startswith("10.20.0."), f"Staff laptop should be in VLAN 20, got {wlc_lab_res['staffIp']}"
        assert wlc_lab_res["guestIp"].startswith("10.30.0."), f"Guest laptop should be in VLAN 30, got {wlc_lab_res['guestIp']}"
        assert wlc_lab_res["score"] == 100, f"Lab 2 should score 100%, got {wlc_lab_res['score']}%"
        print("   ✅ Cisco 3504 WLC Multi-SSID, VLAN segmentatie en scoring 100% geverifieerd.")

        print("\n🎉 ALL WI-FI SIMULATION & DISTANCE ATTENUATION TESTS PASSED SUCCESSFULLY! 🎉\n")
        browser.close()

if __name__ == "__main__":
    test_wifi_simulation_and_distance_attenuation()
