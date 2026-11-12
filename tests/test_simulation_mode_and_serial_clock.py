"""
test_simulation_mode_and_serial_clock.py
Automated E2E Playwright test for:
1. Realtime vs Simulation Mode switcher and Simulation Event List panel
2. Step Forward (Capture / Forward) PDU flow and Event List table updates
3. PDU Inspector modal opening from Event List and from canvas envelope
4. Serial DCE/DTE Clock Rate CLI commands (`clock rate`, `no clock rate`, `show controllers serial X/X/X`)
5. Visual Clock Icon 🕒 on canvas serial cables
6. Clickable score badge and canvas floating completion badge
"""

import sys
import time
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

def test_simulation_mode_and_serial_clock():
    print("=== STARTING SIMULATION MODE & SERIAL CLOCK RATE TESTS ===")

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 1. Load Local Simulator
        print("\n1. Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle")
        time.sleep(2)

        # 2. Test Realtime vs Simulation Mode Switcher
        print("\n2. Testing Realtime vs Simulation Mode Switcher...")
        btn_realtime = page.locator("#btnModeRealtime")
        btn_simulation = page.locator("#btnModeSimulation")
        sim_dock = page.locator("#ptSimulationPanel")

        assert btn_realtime.is_visible(), "Realtime button should be visible"
        assert btn_simulation.is_visible(), "Simulation button should be visible"
        assert "active" in (btn_realtime.get_attribute("class") or ""), "Realtime should be active by default"
        assert not sim_dock.is_visible(), "Simulation dock should be hidden initially in realtime mode"

        # Switch to Simulation mode
        print("  Switching to Simulation mode...")
        btn_simulation.click()
        time.sleep(0.5)

        assert "active" in (btn_simulation.get_attribute("class") or ""), "Simulation button should be active"
        assert sim_dock.is_visible(), "Simulation Event List dock should be visible in simulation mode"
        print("  [OK] Simulation mode dock successfully activated and visible!")

        # 3. Test Generating Traffic & Simulation Event List Queue
        print("\n3. Testing Traffic Generation into Simulation Event List...")
        # Use window.PXLWireshark traffic generator to produce ICMP ping
        page.evaluate("""
            () => {
                const ws = new window.WiresharkApp(null, 'globalWiresharkViewport');
                ws.handleGenerateTraffic('icmp');
            }
        """)
        time.sleep(0.5)

        event_rows = page.locator("#simEventListTbody tr.pt-sim-row")
        row_count = event_rows.count()
        print(f"  Event rows in Event List: {row_count}")
        assert row_count >= 1, "At least 1 simulation event row should be generated"

        # Check content of first event row
        first_row_text = event_rows.first.inner_text()
        print(f"  First event row text: {first_row_text}")
        assert "ICMP" in first_row_text, "Event should be of type ICMP"

        # Take screenshot of Simulation Mode with Event List
        page.screenshot(path="screenshot_simulation_event_list.png")
        print("  [OK] Captured screenshot_simulation_event_list.png")

        # 4. Test Step Forward (Capture / Forward)
        print("\n4. Testing Step Forward (Capture / Forward)...")
        btn_step = page.locator("#simBtnStep")
        assert btn_step.is_visible(), "Step forward button should be visible"

        # Check time badge before step
        time_badge_before = page.locator("#simTimeBadge").inner_text()
        print(f"  Time badge before step: {time_badge_before}")

        btn_step.click()
        time.sleep(0.6)

        time_badge_after = page.locator("#simTimeBadge").inner_text()
        print(f"  Time badge after step: {time_badge_after}")
        assert time_badge_after != time_badge_before or "0.005" in time_badge_after, "Simulation time should advance on step forward"

        # Check that active row has 'current' or 'completed' class
        first_row_class = event_rows.first.get_attribute("class") or ""
        assert "completed" in first_row_class or "current" in first_row_class, "Stepped event should be completed or current"
        print("  [OK] Step Forward advanced event state and time smoothly!")

        # 5. Test Inspecting PDU Information (✉️ button)
        print("\n5. Testing PDU Information Modal from Event List...")
        pdu_btn = event_rows.first.locator(".pt-sim-pdu-btn")
        assert pdu_btn.is_visible(), "PDU envelope button should be visible on event row"
        pdu_btn.click()
        time.sleep(0.5)

        pdu_modal = page.locator("#pduInspectorModal")
        assert pdu_modal.is_visible(), "PDU Inspector modal should be open"
        modal_text = pdu_modal.inner_text()
        assert "Packet Tracer PDU Informatie" in modal_text, "Modal title should match"
        assert "OSI Model" in modal_text, "OSI Model tab should be present"
        assert "L2 ETHERNET" in modal_text or "L3 IPv4" in modal_text, "PDU diagram blocks should be rendered"

        # Switch to Hex Dump tab in PDU modal
        print("  Testing tab switching to Hex Dump inside PDU Inspector...")
        page.locator("#pduTabHexBtn").click()
        time.sleep(0.3)
        hex_content = page.locator("#pduInspectorContent").inner_text()
        assert "0000" in hex_content, "Hex dump offsets should be visible in PDU inspector"

        # Screenshot of PDU Inspector
        page.screenshot(path="screenshot_pdu_inspector_modal.png")
        print("  [OK] Captured screenshot_pdu_inspector_modal.png")

        # Close PDU modal
        pdu_modal.locator(".pt-btn-close").click()
        time.sleep(0.3)
        assert not pdu_modal.is_visible(), "PDU modal should be closed"

        # 6. Test Serial DCE/DTE Cable & Clock Rate CLI Commands
        print("\n6. Testing Serial DCE/DTE Cable & Clock Rate...")
        # Add a second router and connect them via a Serial cable
        page.evaluate("""
            () => {
                const sim = window.PXLNetworkSim;
                const r0 = sim.devices['Router0'] || Object.values(sim.devices).find(d => d.type === 'router');
                if (r0) {
                    // Create Router1 if not present
                    if (!sim.devices['Router1']) {
                        const r1 = new window.CiscoDevice('Router1', 'router', 'Router1', { model: '4331', x: r0.x + 220, y: r0.y });
                        sim.addDevice(r1);
                    }
                    // Add serial cable between Router0:Serial0/1/0 and Router1:Serial0/1/0
                    const existingCable = sim.cables.find(c => c.type === 'serial');
                    if (!existingCable) {
                        sim.addCable({
                            id: 'cable_serial_test',
                            fromDevice: r0.id,
                            fromPort: 'Serial0/1/0',
                            toDevice: 'Router1',
                            toPort: 'Serial0/1/0',
                            type: 'serial',
                            dceDevice: r0.id
                        });
                    }
                    window.PXLApp.canvasWorkspace.render();
                }
            }
        """)
        time.sleep(1)

        # Check that canvas workspace has serial cable
        cables_info = page.evaluate("() => window.PXLNetworkSim.cables.map(c => ({ id: c.id, type: c.type, fromPort: c.fromPort, toPort: c.toPort }))")
        print(f"  Configured cables: {cables_info}")
        has_serial = any(c['type'] == 'serial' for c in cables_info)
        assert has_serial, "Serial cable should be present in topology"

        # Test CLI: clock rate on Router (R1)
        print("  Testing CLI: configure clock rate 64000 on R1 Serial0/1/0...")
        cli_res1 = page.evaluate("""
            () => {
                const sim = window.PXLNetworkSim;
                const r0 = sim.devices['R1'] || Object.values(sim.devices).find(d => d.type === 'router');
                const output = [];
                const parser = new window.CiscoCLIParser(r0, (line) => output.push(line));
                parser.handleCommand('enable');
                parser.handleCommand('configure terminal');
                parser.handleCommand('interface Serial0/1/0');
                parser.handleCommand('clock rate 64000');
                parser.handleCommand('no shutdown');
                parser.handleCommand('exit');
                parser.handleCommand('exit');
                parser.handleCommand('show controllers serial 0/1/0');
                return output.join('\\n');
            }
        """)
        print(f"  CLI Output from 'show controllers serial 0/1/0':\n{cli_res1}")
        assert "DCE V.35, clock rate 64000" in cli_res1, "Should show DCE with clock rate 64000"

        # Check running config
        run_cfg = page.evaluate("() => (window.PXLNetworkSim.devices['R1'] || Object.values(window.PXLNetworkSim.devices).find(d => d.type === 'router')).generateRunningConfig()")
        assert "clock rate 64000" in run_cfg, "clock rate 64000 should appear in running-config"
        print("  [OK] clock rate 64000 verified in both 'show controllers' and 'show running-config'!")

        # Test CLI: no clock rate (negation)
        print("  Testing CLI: 'no clock rate' negates clock rate to DTE...")
        cli_res2 = page.evaluate("""
            () => {
                const sim = window.PXLNetworkSim;
                const r0 = sim.devices['R1'] || Object.values(sim.devices).find(d => d.type === 'router');
                const output = [];
                const parser = new window.CiscoCLIParser(r0, (line) => output.push(line));
                parser.handleCommand('enable');
                parser.handleCommand('conf t');
                parser.handleCommand('int s0/1/0');
                parser.handleCommand('no clock rate');
                parser.handleCommand('exit');
                parser.handleCommand('exit');
                parser.handleCommand('show controllers serial 0/1/0');
                return output.join('\\n');
            }
        """)
        print(f"  CLI Output after 'no clock rate':\n{cli_res2}")
        assert "DTE V.35, no clock" in cli_res2, "Should show DTE V.35, no clock after no clock rate"
        print("  [OK] 'no clock rate' successfully negated clock rate!")

        # Restore clock rate 64000 for visual snapshot
        page.evaluate("""
            () => {
                const r0 = window.PXLNetworkSim.devices['R1'] || Object.values(window.PXLNetworkSim.devices).find(d => d.type === 'router');
                const parser = new window.CiscoCLIParser(r0);
                parser.handleCommand('enable');
                parser.handleCommand('conf t');
                parser.handleCommand('int s0/1/0');
                parser.handleCommand('clock rate 64000');
                parser.handleCommand('end');
                window.PXLApp.canvasWorkspace.render();
            }
        """)
        time.sleep(0.5)

        # Screenshot of canvas showing Serial cable with DCE clock icon
        page.screenshot(path="screenshot_canvas_serial_clock_icon.png")
        print("  [OK] Captured screenshot_canvas_serial_clock_icon.png")

        # 7. Test Clickable Score Badge & Canvas Floating Completion Badge
        print("\n7. Testing Clickable Score Badge & Rubric Side Panel...")
        rubric_panel = page.locator("#rubricSidePanel")
        assert not rubric_panel.is_visible() or not ("open" in (rubric_panel.get_attribute("class") or "")), "Rubric panel should be closed initially"

        # Click the canvas score badge
        print("  Clicking floating canvas score badge...")
        canvas_score_badge = page.locator("#canvasScoreBadge")
        assert canvas_score_badge.is_visible(), "Canvas floating score badge should be visible"
        canvas_score_badge.click()
        time.sleep(0.5)

        assert "open" in (rubric_panel.get_attribute("class") or ""), "Rubric panel should open upon clicking canvas score badge"
        rubric_content = page.locator("#rubricSidePanelContent").inner_text()
        assert "Beoordelingsrubric" in rubric_content, "Rubric criteria should be listed in panel"
        print("  [OK] Rubric side panel opened and displayed criteria!")

        # Screenshot of opened Rubric Panel
        page.screenshot(path="screenshot_rubric_panel_from_badge.png")
        print("  [OK] Captured screenshot_rubric_panel_from_badge.png")

        browser.close()

    print("\n=== ALL SIMULATION MODE & SERIAL CLOCK RATE TESTS PASSED (100%) ===")

if __name__ == "__main__":
    test_simulation_mode_and_serial_clock()
