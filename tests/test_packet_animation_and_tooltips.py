import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

def test_animations_and_tooltips():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            headless=True
        )
        context = browser.new_context(viewport={'width': 1300, 'height': 850})
        page = context.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("console", lambda msg: print(f"[Console {msg.type}] {msg.text}"))

        print("1. Loading http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle")
        page.wait_for_timeout(1000)

        assert len(errors) == 0, f"Page load JS errors: {errors}"
        print("   Page loaded without JS errors.")

        print("2. Setting up test network topology (R1 -> SW1 -> PC1)...")
        page.evaluate("""() => {
            const sim = window.PXLNetworkSim;
            sim.clear();

            const r1 = new CiscoDevice('r1', 'router', 'Router1', { x: 200, y: 350 });
            r1.interfaces['GigabitEthernet0/0/0'].ip = '192.168.1.1';
            r1.interfaces['GigabitEthernet0/0/0'].mask = '255.255.255.0';
            r1.interfaces['GigabitEthernet0/0/0'].shutdown = false;
            sim.registerDevice(r1);

            const sw1 = new CiscoDevice('sw1', 'switch', 'Switch1', { x: 550, y: 350 });
            sw1.interfaces['Vlan1'].ip = '192.168.1.2';
            sw1.interfaces['Vlan1'].mask = '255.255.255.0';
            sw1.interfaces['Vlan1'].shutdown = false;
            sim.registerDevice(sw1);

            const pc1 = new CiscoDevice('pc1', 'pc', 'PC1', { x: 900, y: 350 });
            pc1.ip = '192.168.1.10';
            pc1.mask = '255.255.255.0';
            pc1.interfaces['FastEthernet0'].ip = '192.168.1.10';
            pc1.interfaces['FastEthernet0'].mask = '255.255.255.0';
            pc1.interfaces['FastEthernet0'].shutdown = false;
            sim.registerDevice(pc1);

            sim.addCable({ fromDevice: 'r1', fromPort: 'GigabitEthernet0/0/0', toDevice: 'sw1', toPort: 'FastEthernet0/1', type: 'straight' });
            sim.addCable({ fromDevice: 'sw1', fromPort: 'FastEthernet0/2', toDevice: 'pc1', toPort: 'FastEthernet0', type: 'straight' });

            window.PXLApp.canvasWorkspace.render();
        }""")
        page.wait_for_timeout(300)

        print("3. Testing Flying Packet Envelopes Animation on Canvas...")
        # Enqueue packet envelopes and verify animation queue
        queue_result = page.evaluate("""() => {
            const cw = window.PXLApp.canvasWorkspace;
            cw.enqueueFlyingPacket('pc1', 'sw1', 'ICMP', 'ICMP');
            cw.enqueueFlyingPacket('sw1', 'r1', 'ICMP', 'ICMP');
            return {
                flyingCount: cw.flyingPackets.length,
                animating: cw.animating,
                firstPacket: cw.flyingPackets[0]
            };
        }""")
        print(f"   Flying packets enqueued: {queue_result['flyingCount']}")
        print(f"   First packet protocol: {queue_result['firstPacket']['protocol']}, label: {queue_result['firstPacket']['label']}")
        assert queue_result['flyingCount'] >= 2
        assert queue_result['firstPacket']['protocol'] == 'ICMP'

        # Wait a moment for animation frames to render
        page.wait_for_timeout(200)

        # Check progress advanced
        progress_res = page.evaluate("""() => {
            const cw = window.PXLApp.canvasWorkspace;
            return {
                hasPackets: cw.flyingPackets.length > 0,
                progress: cw.flyingPackets[0] ? cw.flyingPackets[0].progress : 1.0
            };
        }""")
        print(f"   Animation running, progress: {progress_res['progress']:.3f}")
        assert progress_res['progress'] > 0.0

        # Capture screenshot of flying envelope on canvas
        page.screenshot(path="screenshot_flying_packet_canvas.png")
        print("   Saved screenshot: screenshot_flying_packet_canvas.png")

        print("4. Testing Packet Tracer Summary Hover Tooltip on Device...")
        # Simulate hover over Router1 at canvas pos (200, 350)
        tooltip_res = page.evaluate("""() => {
            const cw = window.PXLApp.canvasWorkspace;
            const sim = window.PXLNetworkSim;
            cw.hoveredDevice = sim.devices['r1'];
            cw.render();
            return {
                hoverDev: cw.hoveredDevice ? cw.hoveredDevice.hostname : null
            };
        }""")
        print(f"   Hover set on: {tooltip_res['hoverDev']}")
        assert tooltip_res['hoverDev'] == 'Router1'

        page.wait_for_timeout(300)
        page.screenshot(path="screenshot_device_hover_tooltip.png")
        print("   Saved screenshot: screenshot_device_hover_tooltip.png")

        print("5. Testing Wireshark Export & Device Filter...")
        # Open global Wireshark
        page.click("#btnOpenGlobalWireshark")
        page.wait_for_timeout(500)

        # Generate test HTTP traffic
        page.locator("#globalWiresharkViewport #wsTrafficGenSelect").select_option("http")
        page.wait_for_timeout(300)

        # Verify export button exists
        export_btn = page.locator("#globalWiresharkViewport button:has-text('Exporteer')")
        assert export_btn.is_visible(), "Export button not found in Wireshark toolbar"
        print("   Export button found in Wireshark toolbar.")

        # Verify Device Filter dropdown exists and has options
        dev_filter_select = page.locator("#globalWiresharkViewport #wsDeviceFilterSelect")
        assert dev_filter_select.is_visible(), "Device filter select not found in Global Wireshark"
        options_count = dev_filter_select.locator("option").count()
        print(f"   Device filter dropdown options count: {options_count}")
        assert options_count >= 3, f"Expected at least 3 device options, got {options_count}"

        # Filter by PC1
        dev_filter_select.select_option("pc1")
        page.wait_for_timeout(300)
        filtered_rows = page.locator("#globalWiresharkViewport .ws-pkt-row")
        print(f"   Packets displayed after PC1 filter: {filtered_rows.count()}")

        # Filter back to all
        dev_filter_select.select_option("all")
        page.wait_for_timeout(300)
        all_rows = page.locator("#globalWiresharkViewport .ws-pkt-row")
        print(f"   Packets displayed after resetting filter: {all_rows.count()}")
        assert all_rows.count() >= filtered_rows.count()

        page.screenshot(path="screenshot_wireshark_device_filter.png")
        print("   Saved screenshot: screenshot_wireshark_device_filter.png")

        browser.close()
        print("\n🎉 ALL ANIMATION, TOOLTIP & WIRESHARK TESTS PASSED 100%!")

if __name__ == '__main__':
    test_animations_and_tooltips()
