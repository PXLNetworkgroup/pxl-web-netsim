"""
test_firewall_and_shelf_categories.py - E2E verification of 6 shelf categories & 5 firewall platforms
Part of PXL Web NetSim (Hogeschool PXL)
"""

import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        print("[1/6] Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle")
        page.wait_for_function("() => window.PXLApp !== undefined && window.PXLApp.allShelfItems !== undefined")
        print("  -> PXLApp loaded successfully.")

        # Test 1: Category shelf buttons
        print("[2/6] Verifying all 6 Shelf Category buttons...")
        categories = page.evaluate("""() => {
            const btns = Array.from(document.querySelectorAll('#shelfCategories .pt-category-btn'));
            return btns.map(b => b.innerText.trim());
        }""")
        print(f"  -> Found categories: {categories}")
        assert len(categories) == 6, f"Expected 6 categories, got {len(categories)}"
        assert any("Switch & Router" in c for c in categories), "Missing Switch & Router category"
        assert any("Computer systems" in c for c in categories), "Missing Computer systems category"
        assert any("Cloud" in c for c in categories), "Missing Cloud category"
        assert any("Wifi" in c for c in categories), "Missing Wifi category"
        assert any("Cables" in c for c in categories), "Missing Cables category"
        assert any("Firewall & Security" in c for c in categories), "Missing Firewall & Security category"
        print("  ✔ All 6 categories verified in DOM.")

        # Test 2: Category filtering
        print("[3/6] Testing category switching and shelf item filtering...")
        # Switch to Computers
        page.evaluate("() => { window.PXLApp.activeShelfCategory = 'computers'; window.PXLApp.renderShelfCategoryButtons(); window.PXLApp.renderShelfItems(); }")
        items_comp = page.evaluate("() => Array.from(document.querySelectorAll('#deviceShelfItems .pt-shelf-btn .pt-shelf-text')).map(el => el.innerText.trim())")
        print(f"  -> Computer items: {items_comp}")
        assert "PC-PT" in items_comp and "Server-PT" in items_comp

        # Switch to Firewalls
        page.evaluate("() => { window.PXLApp.activeShelfCategory = 'firewalls'; window.PXLApp.renderShelfCategoryButtons(); window.PXLApp.renderShelfItems(); }")
        items_fw = page.evaluate("() => Array.from(document.querySelectorAll('#deviceShelfItems .pt-shelf-btn .pt-shelf-text')).map(el => el.innerText.trim())")
        print(f"  -> Firewall items: {items_fw}")
        assert any("ASA" in i for i in items_fw), "Missing ASA in firewall shelf"
        assert any("FortiGate" in i for i in items_fw), "Missing FortiGate in firewall shelf"
        assert any("Palo Alto" in i for i in items_fw), "Missing Palo Alto in firewall shelf"
        assert any("OPNsense" in i for i in items_fw), "Missing OPNsense in firewall shelf"
        assert any("pfSense" in i for i in items_fw), "Missing pfSense in firewall shelf"
        print("  ✔ Category item filtering working perfectly.")

        # Test 3: Place Cisco ASA & test CLI (nameif, security-level)
        print("[4/6] Placing Cisco ASA and testing ASA-OS CLI...")
        page.evaluate("() => window.PXLApp.canvasWorkspace.placeDeviceAt('cisco_asa', 'ASA 5506-X', 150, 150)")
        asa_dev = page.evaluate("() => Object.values(window.PXLNetworkSim.devices).find(d => d.type === 'cisco_asa').id")
        page.evaluate(f"() => window.PXLApp.openDeviceModal('{asa_dev}')")
        time.sleep(0.3)

        # Send enable and nameif commands
        page.evaluate("""() => {
            const parser = window.PXLApp.activeTerminalParser;
            parser.handleCommand('enable');
            parser.handleCommand('conf t');
            parser.handleCommand('int Gi1/1');
            parser.handleCommand('nameif outside');
        }""")
        asa_prompt = page.evaluate("() => window.PXLApp.activeTerminalParser.getPrompt()")
        asa_nif = page.evaluate(f"() => window.PXLNetworkSim.devices['{asa_dev}'].interfaces['GigabitEthernet1/1'].nameif")
        asa_sec = page.evaluate(f"() => window.PXLNetworkSim.devices['{asa_dev}'].interfaces['GigabitEthernet1/1'].securityLevel")
        print(f"  -> ASA Prompt: {asa_prompt}, Nameif: {asa_nif}, Security-Level: {asa_sec}")
        assert asa_prompt.endswith("(config-if)#")
        assert asa_nif == "outside"
        assert asa_sec == 0
        print("  ✔ Cisco ASA CLI commands verified.")

        # Test 4: Place FortiGate & test FortiOS CLI + WebUI tab
        print("[5/6] Placing Fortinet FortiGate and testing FortiOS CLI & Web UI...")
        page.evaluate("() => window.PXLApp.canvasWorkspace.placeDeviceAt('fortigate', 'FortiGate-60F', 300, 150)")
        forti_dev = page.evaluate("() => Object.values(window.PXLNetworkSim.devices).find(d => d.type === 'fortigate').id")
        page.evaluate(f"() => window.PXLApp.openDeviceModal('{forti_dev}')")
        time.sleep(0.3)
        forti_prompt = page.evaluate("() => window.PXLApp.activeTerminalParser.getPrompt()")
        print(f"  -> FortiGate Prompt: {forti_prompt}")
        assert "FortiGate" in forti_prompt

        # Test WebUI
        page.evaluate("() => window.PXLApp.switchDeviceModalTab('fortiweb')")
        time.sleep(0.2)
        has_forti_html = page.evaluate("() => document.getElementById('modalPaneFortiweb').innerText.includes('FortiOS v7.4.2')")
        assert has_forti_html, "FortiOS Web UI did not render"
        print("  ✔ FortiGate CLI and Web UI verified.")

        # Test 5: Place Palo Alto, OPNsense, pfSense and verify Web UIs & Menus
        print("[6/6] Verifying Palo Alto, OPNsense, and pfSense platforms...")
        page.evaluate("() => window.PXLApp.canvasWorkspace.placeDeviceAt('paloalto', 'PA-440', 450, 150)")
        pa_dev = page.evaluate("() => Object.values(window.PXLNetworkSim.devices).find(d => d.type === 'paloalto').id")
        page.evaluate(f"() => window.PXLApp.openDeviceModal('{pa_dev}')")
        page.evaluate("() => window.PXLApp.switchDeviceModalTab('panweb')")
        time.sleep(0.2)
        has_pan_html = page.evaluate("() => document.getElementById('modalPanePanweb').innerText.includes('PAN-OS 11.0.2')")
        assert has_pan_html, "PAN-OS Web UI did not render"

        page.evaluate("() => window.PXLApp.canvasWorkspace.placeDeviceAt('opnsense', 'OPNsense 24.1', 600, 150)")
        opn_dev = page.evaluate("() => Object.values(window.PXLNetworkSim.devices).find(d => d.type === 'opnsense').id")
        page.evaluate(f"() => window.PXLApp.openDeviceModal('{opn_dev}')")
        page.evaluate("() => window.PXLApp.switchDeviceModalTab('opnweb')")
        time.sleep(0.2)
        has_opn_html = page.evaluate("() => document.getElementById('modalPaneOpnweb').innerText.includes('OPNsense 24.1')")
        assert has_opn_html, "OPNsense Web UI did not render"

        page.evaluate("() => window.PXLApp.canvasWorkspace.placeDeviceAt('pfsense', 'pfSense Plus 23.09', 750, 150)")
        pf_dev = page.evaluate("() => Object.values(window.PXLNetworkSim.devices).find(d => d.type === 'pfsense').id")
        page.evaluate(f"() => window.PXLApp.openDeviceModal('{pf_dev}')")
        page.evaluate("() => window.PXLApp.switchDeviceModalTab('pfweb')")
        time.sleep(0.2)
        has_pf_html = page.evaluate("() => document.getElementById('modalPanePfweb').innerText.includes('pfSense Plus 23.09')")
        assert has_pf_html, "pfSense Web UI did not render"

        print("  ✔ Palo Alto, OPNsense, and pfSense all verified!")
        print("\n🎉 ALL TESTS PASSED SUCCESSFULLY (6/6 stappen)! 🎉")
        browser.close()

if __name__ == "__main__":
    run_test()
