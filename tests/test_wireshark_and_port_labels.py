import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

def test_wireshark_and_port_labels():
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

        assert len(errors) == 0, f"Page load JS errors: {errors}"
        print("   Page loaded successfully without JS errors.")

        print("2. Setting up topology (PC1 connected to Switch0 and Server0)...")
        setup_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const sim = app.sim;
            sim.clear();

            // PC1
            const pc1 = new CiscoDevice('pc1', 'pc', 'PC1', { x: 250, y: 300 });
            pc1.ip = '192.168.1.10';
            pc1.mask = '255.255.255.0';
            pc1.interfaces['FastEthernet0'].ip = '192.168.1.10';
            pc1.interfaces['FastEthernet0'].mask = '255.255.255.0';
            pc1.interfaces['FastEthernet0'].shutdown = false;
            sim.registerDevice(pc1);

            // Switch0
            const sw0 = new CiscoDevice('sw0', 'switch', 'Switch0', { x: 550, y: 300 });
            sw0.interfaces['Vlan1'].ip = '192.168.1.2';
            sw0.interfaces['Vlan1'].mask = '255.255.255.0';
            sw0.interfaces['Vlan1'].shutdown = false;
            sim.registerDevice(sw0);

            // Server0
            const srv0 = new CiscoDevice('srv0', 'server', 'Server0', { x: 850, y: 300 });
            srv0.ip = '192.168.1.50';
            srv0.mask = '255.255.255.0';
            srv0.interfaces['FastEthernet0'].ip = '192.168.1.50';
            srv0.interfaces['FastEthernet0'].mask = '255.255.255.0';
            srv0.interfaces['FastEthernet0'].shutdown = false;
            sim.registerDevice(srv0);

            // Cables
            sim.addCable({ fromDevice: 'pc1', fromPort: 'FastEthernet0', toDevice: 'sw0', toPort: 'FastEthernet0/1', type: 'straight' });
            sim.addCable({ fromDevice: 'sw0', fromPort: 'FastEthernet0/2', toDevice: 'srv0', toPort: 'FastEthernet0', type: 'straight' });

            app.canvasWorkspace.render();
            return {
                devices: Object.keys(sim.devices).length,
                cables: sim.cables.length,
                showPortLabels: app.canvasWorkspace.showPortLabels
            };
        }""")
        print(f"   Setup result: {setup_result}")
        assert setup_result['devices'] == 3
        assert setup_result['cables'] == 2
        assert setup_result['showPortLabels'] is True

        print("3. Testing Port Labels Toggle Button in toolbar...")
        port_btn = page.locator("#toolTogglePortLabels")
        assert port_btn.is_visible()
        btn_text_initial = page.locator("#portLabelsToggleText").inner_text()
        print(f"   Initial Port Toggle Text: '{btn_text_initial}'")
        assert "Aan" in btn_text_initial

        # Click toggle button
        port_btn.click()
        page.wait_for_timeout(300)
        btn_text_after = page.locator("#portLabelsToggleText").inner_text()
        print(f"   After Toggle Click: '{btn_text_after}'")
        assert "Uit" in btn_text_after

        # Click again to turn back Aan
        port_btn.click()
        page.wait_for_timeout(300)
        assert "Aan" in page.locator("#portLabelsToggleText").inner_text()
        print("   Port labels toggle verified successfully.")

        print("4. Executing ping from PC1 to Switch0 and Server0 to generate packets...")
        ping_res = page.evaluate("""() => {
            const sim = window.PXLNetworkSim;
            const res1 = sim.executePing('pc1', '192.168.1.2');
            const res2 = sim.executePing('pc1', '192.168.1.50');
            return {
                ping1: res1,
                ping2: res2,
                capturedPacketsCount: sim.packetCaptureLog.length
            };
        }""")
        print(f"   Ping 1 (PC1 -> Switch0): {ping_res['ping1']['success']}")
        print(f"   Ping 2 (PC1 -> Server0): {ping_res['ping2']['success']}")
        print(f"   Captured packets count: {ping_res['capturedPacketsCount']}")
        assert ping_res['ping1']['success'] is True
        assert ping_res['ping2']['success'] is True
        assert ping_res['capturedPacketsCount'] > 0

        print("5. Opening PC1 Desktop and testing Wireshark App...")
        # Open PC1 device modal
        page.evaluate("() => window.PXLApp.openDeviceModal('pc1')")
        page.wait_for_timeout(500)

        # Switch to Desktop tab
        page.click("#tabBtnDesktop")
        page.wait_for_timeout(500)

        # Verify Wireshark icon exists in desktop grid
        ws_icon = page.locator(".pt-desktop-grid .pt-desktop-icon:has-text('Wireshark')")
        assert ws_icon.is_visible(), "Wireshark icon not found in Desktop Grid"
        print("   Found Wireshark icon in Desktop Grid.")

        # Click Wireshark icon to open app
        ws_icon.click()
        page.wait_for_timeout(600)

        # Verify Wireshark UI loaded inside #pcAppContainer
        ws_wrapper = page.locator("#pcAppContainer .ws-wrapper")
        assert ws_wrapper.is_visible(), "Wireshark app wrapper not visible inside pcAppContainer"

        # Check packet rows in packet list table
        pkt_rows = page.locator(".ws-pkt-row")
        pkt_count = pkt_rows.count()
        print(f"   Wireshark display table has {pkt_count} packet rows.")
        assert pkt_count >= 8, f"Expected at least 8 packets (ARP + ICMP), got {pkt_count}"

        # Inspect first packet row
        first_row_text = pkt_rows.first.inner_text()
        print(f"   Row 1 text: {first_row_text}")

        # Click on an ICMP row
        icmp_row = page.locator(".ws-pkt-row:has-text('ICMP')").first
        assert icmp_row.is_visible()
        icmp_row.click()
        page.wait_for_timeout(300)

        # Verify Protocol Tree (Middle pane tab 1)
        tree_text = page.locator("#wsDetailsContent").inner_text()
        print(f"   Protocol Tree snippet: {tree_text[:200]}...")
        assert "Ethernet II" in tree_text
        assert "Frame Check Sequence" in tree_text or "FCS" in tree_text
        assert "Internet Protocol Version 4" in tree_text
        assert "Internet Control Message Protocol" in tree_text

        # Verify Hex Dump (Bottom pane)
        hex_text = page.locator("#wsHexContent").inner_text()
        print(f"   Hex Dump lines: {hex_text.splitlines()[:2]}")
        assert "0000" in hex_text
        assert "abcdefg" in hex_text or "45 00" in hex_text

        # 6. Switch to Packet Tracer OSI Model & PDU Details Tab
        print("6. Testing Packet Tracer OSI Model & PDU Details Tab...")
        osi_tab_btn = page.locator("button:has-text('Packet Tracer OSI Model')")
        assert osi_tab_btn.is_visible()
        osi_tab_btn.click()
        page.wait_for_timeout(400)

        osi_content = page.locator("#wsDetailsContent").inner_text()
        print(f"   OSI Content snippet: {osi_content[:250]}...")
        assert "PDU Header & Trailer Structuur" in osi_content
        assert "In Layers" in osi_content
        assert "Out Layers" in osi_content
        assert "Layer 1 (Physical)" in osi_content
        assert "Layer 2 (Data Link)" in osi_content
        assert "Layer 3 (Network)" in osi_content
        assert "Layer 4 (Transport)" in osi_content
        assert "FCS (CRC-32)" in osi_content

        # Take screenshot of Wireshark with OSI details
        page.screenshot(path="screenshot_wireshark_verified.png")
        print("   Saved screenshot: screenshot_wireshark_verified.png")

        # Close device modal
        page.click("#deviceModal .pt-btn-close")
        page.wait_for_timeout(400)

        # 7. Test Global Wireshark Toolbar Button
        print("7. Testing Global Wireshark Toolbar Button...")
        global_btn = page.locator("#btnOpenGlobalWireshark")
        assert global_btn.is_visible(), "Global Wireshark button not found in top header"
        global_btn.click()
        page.wait_for_timeout(600)

        global_modal = page.locator("#globalWiresharkModal")
        assert global_modal.is_visible(), "Global Wireshark modal did not open"
        global_pkts = page.locator("#globalWiresharkViewport .ws-pkt-row")
        assert global_pkts.count() >= 8, f"Global Wireshark has {global_pkts.count()} packets"
        print(f"   Global Wireshark active with {global_pkts.count()} captured packets.")

        # Test traffic generator in global Wireshark
        print("8. Testing traffic generator (HTTP GET)...")
        page.locator("#globalWiresharkViewport #wsTrafficGenSelect").select_option("http")
        page.wait_for_timeout(400)
        http_rows = page.locator("#globalWiresharkViewport .ws-pkt-row:has-text('HTTP')")
        assert http_rows.count() >= 2, f"Expected HTTP packets generated, found {http_rows.count()}"
        print(f"   Generated and captured {http_rows.count()} HTTP packets.")

        page.screenshot(path="screenshot_global_wireshark_verified.png")
        print("   Saved screenshot: screenshot_global_wireshark_verified.png")

        browser.close()
        print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Wireshark and Port Labels are 100% verified.")

if __name__ == '__main__':
    test_wireshark_and_port_labels()
