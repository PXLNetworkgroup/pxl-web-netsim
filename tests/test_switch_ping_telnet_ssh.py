import sys
import time
from playwright.sync_api import sync_playwright

def test_switch_networking():
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

        print("1. Loading http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle")
        page.wait_for_timeout(1000)

        if errors:
            print(f"Page errors during load: {errors}")
        assert len(errors) == 0, f"Page had Javascript errors on load: {errors}"

        print("2. Setting up topology (PC1, Switch0, PC2)...")
        setup_result = page.evaluate("""() => {
            const app = window.PXLApp;
            if (!app || !app.sim) return { error: 'PXLApp or sim not found' };

            // Clear existing
            app.sim.clear();

            // Add PC1
            const pc1 = new CiscoDevice('pc1', 'pc', 'PC1');
            pc1.ip = '192.168.1.10';
            pc1.mask = '255.255.255.0';
            pc1.interfaces['FastEthernet0'].ip = '192.168.1.10';
            pc1.interfaces['FastEthernet0'].mask = '255.255.255.0';
            pc1.interfaces['FastEthernet0'].shutdown = false;
            app.sim.registerDevice(pc1);

            // Add Switch0
            const sw0 = new CiscoDevice('sw0', 'switch', 'Switch0');
            sw0.interfaces['Vlan1'].ip = '192.168.1.2';
            sw0.interfaces['Vlan1'].mask = '255.255.255.0';
            sw0.interfaces['Vlan1'].shutdown = false;
            sw0.ip = '192.168.1.2';
            sw0.mask = '255.255.255.0';
            app.sim.registerDevice(sw0);

            // Add PC2
            const pc2 = new CiscoDevice('pc2', 'pc', 'PC2');
            pc2.ip = '192.168.1.20';
            pc2.mask = '255.255.255.0';
            pc2.interfaces['FastEthernet0'].ip = '192.168.1.20';
            pc2.interfaces['FastEthernet0'].mask = '255.255.255.0';
            pc2.interfaces['FastEthernet0'].shutdown = false;
            app.sim.registerDevice(pc2);

            // Add cables
            app.sim.addCable({
                id: 'conn1',
                fromDevice: 'pc1',
                fromPort: 'FastEthernet0',
                toDevice: 'sw0',
                toPort: 'FastEthernet0/1',
                type: 'straight'
            });

            app.sim.addCable({
                id: 'conn2',
                fromDevice: 'pc2',
                fromPort: 'FastEthernet0',
                toDevice: 'sw0',
                toPort: 'FastEthernet0/2',
                type: 'straight'
            });

            if (app.canvasWorkspace) {
                app.canvasWorkspace.render();
            }

            return {
                devices: Object.keys(app.sim.devices),
                cables: app.sim.cables.length
            };
        }""")
        print(f"Topology created: {setup_result}")

        print("3. Testing Ping PC1 -> Switch0 (192.168.1.2)...")
        ping_pc1_sw0 = page.evaluate("""() => {
            const app = window.PXLApp;
            return app.sim.executePing('pc1', '192.168.1.2');
        }""")
        print(f"Ping PC1 -> Switch0: success={ping_pc1_sw0.get('success')}, hops={ping_pc1_sw0.get('hops')}, reason={ping_pc1_sw0.get('reason')}")
        assert ping_pc1_sw0.get('success') is True, f"Ping PC1 -> Switch0 should succeed! Got {ping_pc1_sw0}"

        print("4. Testing Ping Switch0 -> PC1 (192.168.1.10)...")
        ping_sw0_pc1 = page.evaluate("""() => {
            const app = window.PXLApp;
            return app.sim.executePing('sw0', '192.168.1.10');
        }""")
        print(f"Ping Switch0 -> PC1: success={ping_sw0_pc1.get('success')}, hops={ping_sw0_pc1.get('hops')}, reason={ping_sw0_pc1.get('reason')}")
        assert ping_sw0_pc1.get('success') is True, f"Ping Switch0 -> PC1 should succeed! Got {ping_sw0_pc1}"

        print("5. Testing Ping PC1 -> PC2 (192.168.1.20) through Switch0...")
        ping_pc1_pc2 = page.evaluate("""() => {
            const app = window.PXLApp;
            return app.sim.executePing('pc1', '192.168.1.20');
        }""")
        print(f"Ping PC1 -> PC2: success={ping_pc1_pc2.get('success')}, hops={ping_pc1_pc2.get('hops')}, reason={ping_pc1_pc2.get('reason')}")
        assert ping_pc1_pc2.get('success') is True, f"Ping PC1 -> PC2 should succeed! Got {ping_pc1_pc2}"

        print("6. Testing Telnet from PC1 to Switch0 in PC Desktop Terminal...")
        telnet_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const pc1 = app.sim.devices['pc1'];
            const sw0 = app.sim.devices['sw0'];

            // Configure VTY on switch
            sw0.vtyPassword = 'cisco';

            // Create desktop parser for PC1
            let outputLines = [];
            const term = new PCDesktopHandler(
                pc1,
                (t) => outputLines.push(t),
                () => {},
                () => {}
            );

            // Execute telnet
            term.handleCommand('telnet 192.168.1.2');

            return {
                output: outputLines,
                hasActiveSession: !!term.activeRemoteSession,
                target: term.activeRemoteSession ? term.activeRemoteSession.targetDev.hostname : null
            };
        }""")
        print(f"Telnet test result: {telnet_result}")
        assert telnet_result.get('hasActiveSession') is True, "Telnet should establish active session"
        assert telnet_result.get('target') == 'Switch0', "Target should be Switch0"

        print("7. Testing SSH from PC1 to Switch0 in PC Desktop Terminal...")
        ssh_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const pc1 = app.sim.devices['pc1'];
            const sw0 = app.sim.devices['sw0'];

            // Configure credentials on switch
            sw0.users = { 'admin': { secret: 'cisco123', password: 'cisco', priv: 15 } };
            sw0.domainName = 'pxl.be';
            sw0.rsaKeyBits = 1024;
            sw0.sshVersion = 2;

            let outputLines = [];
            const term = new PCDesktopHandler(
                pc1,
                (t) => outputLines.push(t),
                () => {},
                () => {}
            );

            // Execute ssh
            term.handleCommand('ssh -l admin 192.168.1.2');

            return {
                output: outputLines,
                hasActiveSession: !!term.activeRemoteSession,
                target: term.activeRemoteSession ? term.activeRemoteSession.targetDev.hostname : null
            };
        }""")
        print(f"SSH test result: {ssh_result}")
        assert ssh_result.get('hasActiveSession') is True, "SSH should establish active session"
        assert ssh_result.get('target') == 'Switch0', "Target should be Switch0"

        print("8. Testing Cisco CLI Telnet from Switch0 to PC1...")
        cisco_telnet_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const sw0 = app.sim.devices['sw0'];

            let cliOutput = [];
            const ciscoCli = new CiscoCLIParser(
                sw0,
                (t) => cliOutput.push(t),
                () => {},
                () => {}
            );

            ciscoCli.handleCommand('telnet 192.168.1.10');

            return {
                output: cliOutput,
                hasActiveSession: !!ciscoCli.activeRemoteSession,
                target: ciscoCli.activeRemoteSession ? ciscoCli.activeRemoteSession.targetDev.hostname : null
            };
        }""")
        print(f"Cisco CLI Telnet result: {cisco_telnet_result}")
        assert cisco_telnet_result.get('hasActiveSession') is True, "Cisco CLI telnet should establish active session"
        assert cisco_telnet_result.get('target') == 'PC1', "Target should be PC1"

        print("\\nSUCCESS: All network tests (Switch Ping, PC Ping, Telnet, SSH) PASSED 100%!")
        browser.close()

if __name__ == '__main__':
    test_switch_networking()
