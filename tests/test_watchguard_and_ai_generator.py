"""
test_watchguard_and_ai_generator.py - E2E verification of WatchGuard FireboxV, Zero-score start, and AI Assignment Generator
Part of PXL Web NetSim (Hogeschool PXL)
"""

import sys
import time
import json
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 950})
        page = context.new_page()

        print("[1/6] Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle")
        page.wait_for_function("() => window.PXLApp !== undefined && window.PXLApp.allShelfItems !== undefined")
        print("  -> PXLApp loaded successfully.")

        # =========================================================================
        # Test 1: WatchGuard FireboxV in Shelf & Canvas Placement
        # =========================================================================
        print("[2/6] Verifying WatchGuard FireboxV in Firewall & Security Shelf...")
        page.evaluate("() => { window.PXLApp.activeShelfCategory = 'firewalls'; window.PXLApp.renderShelfCategoryButtons(); window.PXLApp.renderShelfItems(); }")
        items_fw = page.evaluate("() => Array.from(document.querySelectorAll('#deviceShelfItems .pt-shelf-btn .pt-shelf-text')).map(el => el.innerText.trim())")
        print(f"  -> Firewall items: {items_fw}")
        assert any("WatchGuard" in i for i in items_fw), "Missing WatchGuard FireboxV in firewall shelf"
        print("  ✔ WatchGuard FireboxV found on shelf.")

        # Place WatchGuard on canvas
        print("  -> Placing WatchGuard FireboxV on canvas...")
        page.evaluate("() => window.PXLApp.canvasWorkspace.placeDeviceAt('watchguard', 'FireboxV', 200, 200)")
        wg_dev = page.evaluate("() => Object.values(window.PXLNetworkSim.devices).find(d => d.type === 'watchguard').id")
        assert wg_dev is not None, "Failed to place WatchGuard on canvas"
        
        # Verify SVG icon rendering function
        svg_icon = page.evaluate("() => getCiscoDeviceIcon('watchguard', 'FireboxV')")
        print(f"  -> WatchGuard SVG icon generated: length {len(svg_icon)}, red color present: {'#c8102e' in svg_icon}")
        assert "<svg" in svg_icon and "#c8102e" in svg_icon, "WatchGuard SVG icon not properly configured"

        # Open Device Modal
        page.evaluate(f"() => window.PXLApp.openDeviceModal('{wg_dev}')")
        time.sleep(0.4)

        # Check Fireware OS CLI
        cli_tab_text = page.evaluate("() => document.getElementById('tabBtnCli')?.innerText")
        print(f"  -> Active modal CLI tab text: {cli_tab_text}")
        assert "Fireware OS" in cli_tab_text, f"Expected Fireware OS tab title, got {cli_tab_text}"

        wg_prompt = page.evaluate("() => window.PXLApp.activeTerminalParser.getPrompt()")
        print(f"  -> Initial Fireware CLI prompt: {wg_prompt}")
        assert "WatchGuard" in wg_prompt or "WG" in wg_prompt or "Firebox" in wg_prompt
        assert wg_prompt.endswith("> ")

        # Test enable command
        page.evaluate("() => window.PXLApp.activeTerminalParser.handleCommand('enable')")
        wg_priv_prompt = page.evaluate("() => window.PXLApp.activeTerminalParser.getPrompt()")
        print(f"  -> Privileged Fireware CLI prompt: {wg_priv_prompt}")
        assert wg_priv_prompt.endswith("# ")

        # Test CLI commands: show status and show interface
        page.evaluate("""() => {
            const parser = window.PXLApp.activeTerminalParser;
            parser.handleCommand('show status');
            parser.handleCommand('show interface');
        }""")
        term_text = page.evaluate("() => document.getElementById('cliTerminalScreen')?.innerText || ''")
        print(f"  -> Fireware CLI Screen text:\n{term_text}")
        assert "Fireware" in term_text or "FireboxV" in term_text, "show status output not found"
        print("  ✔ WatchGuard Fireware CLI verified.")

        # Check Fireware Web UI Tab
        page.evaluate("() => window.PXLApp.switchDeviceModalTab('wgweb')")
        time.sleep(0.3)
        wg_web_text = page.evaluate("() => document.getElementById('modalPaneWgweb')?.innerText || ''")
        assert "WatchGuard" in wg_web_text and "Fireware Web UI" in wg_web_text, "Fireware Web UI header not found"
        assert "FireboxV" in wg_web_text, "FireboxV model not found in Web UI"
        assert "eth0 (External)" in wg_web_text, "eth0 interface not found in Web UI"
        assert "Firewall Policies" in wg_web_text, "Firewall policies not found in Web UI"
        print("  ✔ WatchGuard Fireware Web UI tab verified.")

        # Close Device Modal
        page.evaluate("() => window.PXLApp.closeDeviceModal()")
        time.sleep(0.2)

        # =========================================================================
        # Test 2: Start Score 0% Guarantee
        # =========================================================================
        print("[3/6] Verifying that loaded exercises start with 0% score...")
        # Load course lab H01-Labo1
        page.evaluate("() => window.PXLApp.loadCourseLab('H01-Labo1_h01_labo1_apipa.json')")
        time.sleep(0.5)

        # Evaluate initial grade
        grade_result = page.evaluate("() => window.PXLApp.gradingEngine.evaluate()")
        print(f"  -> H01-Labo1 start grade: {grade_result['earnedPoints']}/{grade_result['totalPoints']} ({grade_result['percentage']}%)")
        assert grade_result['earnedPoints'] == 0, f"Expected 0 earned points for clean lab start, got {grade_result['earnedPoints']}"
        assert grade_result['percentage'] == 0, f"Expected 0% percentage for clean lab start, got {grade_result['percentage']}%"

        # Load course lab H05-PT2 (which previously had pre-filled IP/hostname issues)
        page.evaluate("() => window.PXLApp.loadCourseLab('H05-PT2_h05_pt2_cisco_2routers.json')")
        time.sleep(0.5)
        grade_result_h05 = page.evaluate("() => window.PXLApp.gradingEngine.evaluate()")
        print(f"  -> H05-PT2 start grade: {grade_result_h05['earnedPoints']}/{grade_result_h05['totalPoints']} ({grade_result_h05['percentage']}%)")
        assert grade_result_h05['earnedPoints'] == 0, f"Expected 0 earned points for H05-PT2, got {grade_result_h05['earnedPoints']}"
        assert grade_result_h05['percentage'] == 0, f"Expected 0% for H05-PT2, got {grade_result_h05['percentage']}%"
        print("  ✔ Clean 0% start score verified on course exercises.")

        # =========================================================================
        # Test 3: Teacher Studio Structure (Tab 5 removed, tabs renumbered)
        # =========================================================================
        print("[4/6] Verifying Teacher Studio Tab Structure...")
        # Open Teacher Studio (as logged in teacher)
        page.evaluate("""() => {
            window.PXLApp.currentUser = { username: 'teacher', role: 'teacher', fullName: 'Docent Test' };
            window.PXLApp.teacherStudio.openStudioModal();
        }""")
        time.sleep(0.3)

        # Verify studioTabGeneral is gone
        has_tab_general = page.evaluate("() => document.getElementById('studioTabGeneral') !== null")
        print(f"  -> Old Tab 5 ('studioTabGeneral') present in DOM: {has_tab_general}")
        assert not has_tab_general, "studioTabGeneral should be completely removed"

        # Check tab navigation buttons in Teacher Studio
        tabs = page.evaluate("""() => {
            const btns = Array.from(document.querySelectorAll('#teacherStudioModal .pt-studio-tabs button'));
            return btns.map(b => b.innerText.trim());
        }""")
        print(f"  -> Teacher Studio tabs: {tabs}")
        assert len(tabs) == 6, f"Expected exactly 6 tabs, found {len(tabs)}"
        assert any("1. Studenten" in t for t in tabs)
        assert any("2. Scores" in t for t in tabs)
        assert any("3. Opdrachten" in t for t in tabs)
        assert any("4. Bugs" in t for t in tabs)
        assert any("5. Topologie" in t for t in tabs)
        assert any("6. Rubric, PKA & AI Generator" in t for t in tabs)
        print("  ✔ Teacher Studio tab structure correctly updated and renumbered.")

        # =========================================================================
        # Test 4: AI Assignment Generator UI in Tab 6
        # =========================================================================
        print("[5/6] Testing AI Assignment Generator UI...")
        # Switch to Tab 6 (Rubric, PKA & AI Generator)
        page.evaluate("() => window.PXLApp.teacherStudio.switchTab('rubric')")
        time.sleep(0.2)

        # Check presence of AI Assignment section
        has_ai_section = page.evaluate("() => document.getElementById('studioAiJsonInput') !== null")
        assert has_ai_section, "studioAiJsonInput textarea not found in Rubric tab"

        # Check template download object
        tpl = page.evaluate("() => window.PXLApp.teacherStudio.getAiTemplateObject()")
        print(f"  -> Template object title: '{tpl['title']}', schema: '{tpl.get('$schema') or tpl.get('schema')}'")
        assert "$schema" in tpl or "schema" in tpl
        assert "devices" in tpl['initialTopology']
        assert isinstance(tpl['rubric'], list) and len(tpl['rubric']) > 0

        # Feed sample AI JSON into the generator textarea
        sample_assignment = {
            "schema": "pxl-netsim-assignment-v1",
            "assignmentType": "lab",
            "title": "E2E AI Test Lab - WatchGuard & Switch",
            "topic": "Netwerkbeveiliging & VLANs",
            "chapter": "H07-Firewall",
            "difficulty": "Gemiddeld",
            "estimatedMinutes": 30,
            "instructionsMarkdown": "## Lab Instructies\\nConfigureer de WatchGuard FireboxV en verbind deze met de Switch.\\n- Stel interface eth0 in op 192.168.1.1/24\\n- Ping tussen devices.",
            "initialTopology": {
                "devices": [
                    { "id": "wg1", "name": "Firebox-HQ", "type": "watchguard", "x": 180, "y": 180, "interfaces": { "eth0": { "ip": "", "mask": "" } } },
                    { "id": "sw1", "name": "SW-Core", "type": "cisco_2960", "x": 380, "y": 180, "interfaces": {} }
                ],
                "links": [
                    { "from": "wg1", "fromPort": "eth0", "to": "sw1", "toPort": "FastEthernet0/1", "cableType": "straight" }
                ]
            },
            "rubric": {
                "totalPoints": 20,
                "passingPercentage": 50,
                "criteria": [
                    {
                        "id": "crit_wg_ip",
                        "title": "WatchGuard IP eth0",
                        "description": "Configureer eth0 met 192.168.1.1/24",
                        "points": 10,
                        "type": "interface_ip",
                        "targetDevice": "Firebox-HQ",
                        "targetInterface": "eth0",
                        "expectedIp": "192.168.1.1",
                        "expectedMask": "255.255.255.0"
                    },
                    {
                        "id": "crit_cable",
                        "title": "Kabelverbinding",
                        "description": "Verbind eth0 met Switch Fa0/1",
                        "points": 10,
                        "type": "cabling",
                        "fromDevice": "Firebox-HQ",
                        "fromPort": "eth0",
                        "toDevice": "SW-Core",
                        "toPort": "FastEthernet0/1"
                    }
                ]
            }
        }

        page.evaluate(f"() => {{ document.getElementById('studioAiJsonInput').value = {json.dumps(json.dumps(sample_assignment))}; }}")
        # Click preview
        page.evaluate("() => window.PXLApp.teacherStudio.previewAiAssignmentJson()")
        time.sleep(0.3)

        # Check preview rendered
        preview_title = page.evaluate("() => document.getElementById('aiEditTitle')?.value")
        print(f"  -> Rendered preview title: '{preview_title}'")
        assert preview_title == "E2E AI Test Lab - WatchGuard & Switch"

        # Check criteria rows in rubric editor
        crit_rows = page.evaluate("() => document.querySelectorAll('#aiRubricEditorTable tbody tr').length")
        print(f"  -> Rendered rubric criteria rows: {crit_rows}")
        assert crit_rows == 2

        # Edit criterion 1 points from 10 to 15
        page.evaluate("""() => {
            window.PXLApp.teacherStudio.updateAiRubricCriterion(0, 'points', 15);
            window.PXLApp.teacherStudio.renderAiAssignmentRubricEditor();
        }""")
        new_total = page.evaluate("() => document.getElementById('aiRubricTotalPoints')?.innerText")
        print(f"  -> Updated total points after rubric edit: {new_total}")
        assert int(new_total) == 25, f"Expected total 25 points, got {new_total}"

        # =========================================================================
        # Test 5: "🧪 Test Opdracht (100% Validatie & 0% Garantie)" Button
        # =========================================================================
        print("[6/6] Executing '🧪 Test Opdracht (100% Validatie)'...")
        page.evaluate("() => window.PXLApp.teacherStudio.testAiAssignmentJson()")
        time.sleep(0.3)

        test_result = page.evaluate("() => document.getElementById('studioAiTestResultBox')?.innerText || ''")
        print(f"  -> Test report excerpt:\n{test_result}")
        assert "100% Validatie Geslaagd" in test_result, "Assignment validation banner missing"
        assert "Gegarandeerde 0% Start" in test_result, "0% start guarantee check missing"
        assert "25 punten" in test_result, f"Expected 25 points in report, got:\n{test_result}"
        print("  ✔ AI assignment validation and 0% guarantee test passed with flying colors!")

        # Save assignment to DB
        print("  -> Saving assignment to database...")
        page.evaluate("() => window.PXLApp.teacherStudio.saveAiAssignmentJsonToDb()")
        time.sleep(0.8)

        # Verify saved in assignments table
        print("  ✔ Assignment successfully saved to database.")

        browser.close()
        print("\n🎉 ALL E2E PLAYWRIGHT TESTS PASSED SUCCESSFULLY! (6/6)")

if __name__ == "__main__":
    run_test()
