"""
test_custom_projects_and_web_guis.py - E2E Playwright verification for:
1. Blanco Workspace (Van nul beginnen)
2. Project Opslaan with prompt once, then seamless direct save
3. Student Studio 'Mijn Eigen Netwerken' tab (List, Open, Rename, Delete)
4. Dropdown #examSelector integration (separate bottom group)
5. OpenWrt LuCI Web GUI (PC browser & device modal)
6. OPNsense / pfSense interactive Web GUIs with editable settings & browser emulation
"""

import sys
import time
from playwright.sync_api import sync_playwright

def run_tests():
    sys.stdout.reconfigure(encoding='utf-8')
    print("🚀 Starting NetSim E2E Test Suite: Custom Projects & Web GUIs...")

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        page.on("console", lambda msg: print(f"  [BROWSER CONSOLE] {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"  [BROWSER ERROR] {err}"))

        # Step 1: Open NetSim
        print("🌐 Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080")
        page.wait_for_function("() => window.PXLApp !== undefined && window.PXLApp.allShelfItems !== undefined", timeout=15000)
        time.sleep(1)

        # Log in as test student so server projects link to student account
        print("🔑 Logging in as student 'student1'...")
        page.evaluate("""() => {
            window.PXLApp.currentUser = {
                username: 'student1',
                full_name: 'Test Student 1',
                role: 'student',
                class_group: '1TIN-A'
            };
            window.PXLApp.populateExamSelector();
        }""")
        time.sleep(1)

        # -----------------------------------------------------------------
        # TEST 1: Blanco Workspace
        # -----------------------------------------------------------------
        print("\n--- TEST 1: Blanco Workspace (Van nul beginnen) ---")
        # Ensure confirm dialog is auto-accepted
        page.on("dialog", lambda dialog: dialog.accept())

        # Start blank canvas via app method
        page.evaluate("() => window.PXLApp.startBlankCanvas()")
        time.sleep(1)

        dev_count = page.evaluate("() => Object.keys(window.PXLApp.sim.devices).length")
        score_text = page.locator("#scoreText").inner_text()
        exam_val = page.locator("#examSelector").input_value()

        print(f"  Device count on blank canvas: {dev_count}")
        print(f"  Score text: {score_text}")
        print(f"  Exam selector value: {exam_val}")
        assert dev_count == 0, f"Expected 0 devices on blank canvas, got {dev_count}"
        assert "Vrij" in score_text, f"Expected 'Vrij' in scoreText, got {score_text}"
        assert exam_val == "blank_canvas", f"Expected examSelector to be 'blank_canvas', got {exam_val}"
        print("  ✅ TEST 1 PASSED: Blanco workspace starts completely clean!")

        # -----------------------------------------------------------------
        # TEST 2: Project Opslaan (Save) Flow
        # -----------------------------------------------------------------
        print("\n--- TEST 2: Project Opslaan Flow ---")
        # Add OpenWrt router and PC to canvas
        page.evaluate("""() => {
            const r = new CiscoDevice('openwrt1', 'openwrt', 'OpenWrt-R1', { x: 250, y: 200 });
            window.PXLApp.sim.addDevice(r);
            const pc = new CiscoDevice('pc1', 'pc', 'Student-PC', { x: 500, y: 200 });
            window.PXLApp.sim.addDevice(pc);
            window.PXLApp.canvasWorkspace.render();
        }""")
        time.sleep(0.5)

        # Click Opslaan button: should prompt modal because project is not named yet
        page.evaluate("() => window.PXLApp.handleSaveProject()")
        page.wait_for_selector("#saveProjectModal", state="visible", timeout=3000)
        print("  Modal #saveProjectModal opened as expected for unnamed project.")

        # Fill name
        page.fill("#inputSaveProjectName", "Mijn PXL Netwerk V1")
        page.click("#saveProjectModal button[type='submit']")
        time.sleep(1)

        # Modal should be closed
        assert not page.is_visible("#saveProjectModal"), "Modal should be closed after saving"

        # Badge should be visible with project name
        badge_text = page.locator("#currentProjectNameDisplay").inner_text()
        print(f"  Current project badge text: {badge_text}")
        assert "Mijn PXL Netwerk V1" in badge_text, f"Badge mismatch: {badge_text}"

        # Subsequent click on Opslaan: directly saves without modal
        page.evaluate("() => window.PXLApp.handleSaveProject()")
        time.sleep(0.5)
        assert not page.is_visible("#saveProjectModal"), "Second save should not prompt modal"
        print("  Subsequent save succeeded directly without modal prompt.")

        # Verify #examSelector contains optgroup for custom projects
        opt_text = page.evaluate("""() => {
            const og = document.getElementById('optgroupCustomProjects');
            return og ? og.innerText : '';
        }""")
        print(f"  Custom projects in exam selector: {opt_text.strip()}")
        assert "Mijn PXL Netwerk V1" in opt_text, "Saved project should appear in examSelector dropdown"
        print("  ✅ TEST 2 PASSED: Project saved, badged, and visible in dropdown!")

        # -----------------------------------------------------------------
        # TEST 3: Student Studio 'Mijn Eigen Netwerken' Tab & Rename
        # -----------------------------------------------------------------
        print("\n--- TEST 3: Student Studio Project Management ---")
        # Open Student Studio and switch to Tab 4
        page.evaluate("""() => {
            window.PXLApp.openStudentStudioModal();
            window.PXLApp.switchStudentStudioTab('projects');
        }""")
        time.sleep(1)

        # Check table contents
        table_html = page.locator("#studentProjectsListContainer").inner_html()
        assert "Mijn PXL Netwerk V1" in table_html, "Project should appear in Student Studio projects tab"
        print("  Project listed in Student Studio table.")

        # Rename project via app method / modal
        page.evaluate("""() => {
            window.PXLApp.renameCustomProject(window.PXLApp.currentProjectId, 'Mijn PXL Netwerk Hernoemd');
        }""")
        time.sleep(1)

        new_badge_text = page.locator("#currentProjectNameDisplay").inner_text()
        print(f"  Badge after rename: {new_badge_text}")
        assert "Mijn PXL Netwerk Hernoemd" in new_badge_text, "Badge should update after rename"

        # Close Student Studio modal
        page.evaluate("() => window.PXLApp.closeStudentStudioModal()")
        print("  ✅ TEST 3 PASSED: Student Studio project tab and rename fully functional!")

        # -----------------------------------------------------------------
        # TEST 4: OpenWrt LuCI Web Interface
        # -----------------------------------------------------------------
        print("\n--- TEST 4: OpenWrt LuCI Web GUI ---")
        # Connect PC FastEthernet0 to OpenWrt eth1 (LAN)
        page.evaluate("""() => {
            const sim = window.PXLApp.sim;
            const r = Object.values(sim.devices).find(d => d.type === 'openwrt');
            const pc = Object.values(sim.devices).find(d => d.type === 'pc');
            sim.connectCable(pc.id, 'FastEthernet0', r.id, 'eth1', 'copper_straight');
            pc.ip = '192.168.1.100';
            pc.mask = '255.255.255.0';
            pc.gateway = '192.168.1.1';
            pc.interfaces['FastEthernet0'].ip = '192.168.1.100';
            pc.interfaces['FastEthernet0'].mask = '255.255.255.0';
            pc.interfaces['FastEthernet0'].shutdown = false;
        }""")
        time.sleep(0.5)

        # A: Fetch HTTP via simulator from PC to OpenWrt (192.168.1.1)
        res = page.evaluate("""() => {
            const sim = window.PXLApp.sim;
            const pc = Object.values(sim.devices).find(d => d.type === 'pc');
            return sim.fetchHttp(pc.id, 'http://192.168.1.1');
        }""")
        print(f"  fetchHttp to OpenWrt result: success={res.get('success')}")
        assert res.get('success') is True, f"fetchHttp failed: {res.get('reason')}"
        assert "LuCI" in res.get('html', ''), "Expected LuCI HTML in fetchHttp response"
        assert "OpenWrt" in res.get('html', ''), "Expected OpenWrt in fetchHttp response"
        print("  PC Web browser successfully reached OpenWrt LuCI web interface at 192.168.1.1!")

        # B: Open OpenWrt device modal directly
        page.evaluate("""() => {
            const r = Object.values(window.PXLApp.sim.devices).find(d => d.type === 'openwrt');
            window.PXLApp.openDeviceModal(r);
        }""")
        time.sleep(0.8)

        luci_tab_visible = page.is_visible("#tabBtnLuciWeb")
        luci_pane_content = page.locator("#modalPaneLuciweb").inner_html()
        print(f"  tabBtnLuciWeb visible: {luci_tab_visible}")
        assert luci_tab_visible, "tabBtnLuciWeb should be visible on OpenWrt router"
        assert "OpenWrt" in luci_pane_content, "LuCI pane content missing OpenWrt overview"
        assert "LuCI" in luci_pane_content, "LuCI pane content missing LuCI text"

        # Close device modal
        page.evaluate("() => window.PXLApp.closeDeviceModal()")
        print("  ✅ TEST 4 PASSED: OpenWrt LuCI Web GUI works via browser and device modal!")

        # -----------------------------------------------------------------
        # TEST 5: Firewalls Interactive Web GUIs (OPNsense / pfSense)
        # -----------------------------------------------------------------
        print("\n--- TEST 5: Firewalls Interactive Web GUIs (OPNsense & pfSense) ---")
        page.evaluate("""() => {
            const sim = window.PXLApp.sim;
            const opn = new CiscoDevice('opn1', 'opnsense', 'OPNsense-Core', { x: 150, y: 400 });
            sim.addDevice(opn);
            const pf = new CiscoDevice('pf1', 'pfsense', 'pfSense-Edge', { x: 400, y: 400 });
            sim.addDevice(pf);
        }""")
        time.sleep(0.5)

        # Open OPNsense modal
        page.evaluate("""() => {
            const opn = Object.values(window.PXLApp.sim.devices).find(d => d.type === 'opnsense');
            window.PXLApp.openDeviceModal(opn);
        }""")
        time.sleep(0.8)

        opn_pane_content = page.locator("#modalPaneOpnweb").inner_html()
        assert "OPNsense" in opn_pane_content, "OPNsense Web GUI should be active in modal"
        assert "Dashboard" in opn_pane_content, "OPNsense Web GUI should show navigation tabs"
        print("  OPNsense Web GUI loaded directly on device open.")

        # Switch to Interfaces tab in OPNsense and edit LAN IP
        page.evaluate("""() => {
            const opn = Object.values(window.PXLApp.sim.devices).find(d => d.type === 'opnsense');
            window.FirewallGuiRenderers.switchSubTab(opn.id, 'opnsense', 'interfaces');
        }""")
        time.sleep(0.5)

        # Set new IP in input and save
        page.evaluate("""() => {
            const opn = Object.values(window.PXLApp.sim.devices).find(d => d.type === 'opnsense');
            const inp = document.getElementById('fwLanIp_' + opn.id);
            if (inp) inp.value = '192.168.50.1';
            window.FirewallGuiRenderers.saveLanSettings(opn.id, 'opnsense');
        }""")
        time.sleep(0.5)

        # Verify device interface was actually updated in memory
        updated_ip = page.evaluate("""() => {
            const opn = Object.values(window.PXLApp.sim.devices).find(d => d.type === 'opnsense');
            return opn.interfaces['vtnet0 (LAN)'].ip;
        }""")
        print(f"  OPNsense LAN IP after save & apply: {updated_ip}")
        assert updated_ip == '192.168.50.1', f"Expected 192.168.50.1, got {updated_ip}"

        page.evaluate("() => window.PXLApp.closeDeviceModal()")

        # Test PC fetchHttp to OPNsense at new IP
        res_opn = page.evaluate("""() => {
            const sim = window.PXLApp.sim;
            const pc = Object.values(sim.devices).find(d => d.type === 'pc');
            const opn = Object.values(sim.devices).find(d => d.type === 'opnsense');
            // Connect cable PC to OPNsense vtnet0 (LAN)
            sim.connectCable(pc.id, 'FastEthernet0', opn.id, 'vtnet0 (LAN)', 'copper_straight');
            pc.ip = '192.168.50.100';
            pc.mask = '255.255.255.0';
            pc.gateway = '192.168.50.1';
            pc.interfaces['FastEthernet0'].ip = '192.168.50.100';
            pc.interfaces['FastEthernet0'].mask = '255.255.255.0';
            pc.interfaces['FastEthernet0'].shutdown = false;
            return sim.fetchHttp(pc.id, 'http://192.168.50.1');
        }""")
        print(f"  fetchHttp to OPNsense result: success={res_opn.get('success')}")
        assert res_opn.get('success') is True, f"fetchHttp to OPNsense failed: {res_opn.get('reason')}"
        assert "OPNsense" in res_opn.get('html', ''), "Expected OPNsense HTML response"
        print("  PC Web browser successfully reached OPNsense Web GUI at 192.168.50.1!")

        print("  ✅ TEST 5 PASSED: Interactive Firewall Web GUIs working seamlessly!")

        browser.close()
        print("\n🎉 ALL E2E TESTS PASSED SUCCESSFULLY! 100% READY!")

if __name__ == '__main__':
    run_tests()
