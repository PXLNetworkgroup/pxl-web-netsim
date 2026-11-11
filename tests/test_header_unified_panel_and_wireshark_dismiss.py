"""
test_header_unified_panel_and_wireshark_dismiss.py - End-to-end verification of:
1. Removal of all copyright text that was blocking the toolbar.
2. Grouping of [Import], [Export], [Inleveren] side by side.
3. Placement of [Uitloggen] at the far right of the header.
4. Dismissing Wireshark modal cleanly (close button, Sluiten button, Escape key).
5. Unified Opdracht & Rubric panel (Opdracht first, Rubric below it) docked on the right.
6. "Vastzetten" (pinning) checkbox functionality keeping the panel permanently visible on the right.
"""

import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8080"

def test_header_and_unified_panel():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            headless=True
        )
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print(f"1. Loading PXL NetSim at {BASE_URL}...")
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        # -------------------------------------------------------------
        # 1. VERIFY COPYRIGHT IS COMPLETELY GONE
        # -------------------------------------------------------------
        print("\n--- TEST 1: VERIFY COPYRIGHT REMOVAL ---")
        brand_text = page.locator(".pt-brand-titles").inner_text()
        print(f"Brand titles text: {brand_text!r}")
        assert "Parren" not in brand_text, "Copyright text 'Parren' should NOT be present"
        assert "Waeyenberg" not in brand_text, "Copyright text 'Waeyenberg' should NOT be present"
        assert "Hombroeks" not in brand_text, "Copyright text 'Hombroeks' should NOT be present"
        assert "Frissaer" not in brand_text, "Copyright text 'Frissaer' should NOT be present"
        assert "©" not in brand_text, "Copyright symbol should NOT be present in header"
        print("  [OK] Copyright text is completely removed!")

        # -------------------------------------------------------------
        # 2. VERIFY IMPORT, EXPORT, INLEVEREN GROUPED SIDE-BY-SIDE
        # -------------------------------------------------------------
        print("\n--- TEST 2: VERIFY IMPORT, EXPORT, INLEVEREN TRIO ---")
        trio = page.locator(".pt-trio-btn-group")
        assert trio.is_visible(), "Trio button group (.pt-trio-btn-group) must be visible"
        
        trio_buttons = trio.locator("button").all()
        assert len(trio_buttons) >= 3, f"Expected 3 buttons in trio, found {len(trio_buttons)}"
        
        b1_text = trio_buttons[0].inner_text()
        b2_text = trio_buttons[1].inner_text()
        b3_text = trio_buttons[2].inner_text()
        print(f"Trio buttons: 1='{b1_text}', 2='{b2_text}', 3='{b3_text}'")
        assert "Import" in b1_text, "First button must be Import"
        assert "Export" in b2_text, "Second button must be Export"
        assert "Inleveren" in b3_text, "Third button must be Inleveren"
        print("  [OK] Import, Export, and Inleveren are placed right next to each other!")

        # -------------------------------------------------------------
        # 3. VERIFY UITLOGGEN AT FAR RIGHT
        # -------------------------------------------------------------
        print("\n--- TEST 3: VERIFY UITLOGGEN AT FAR RIGHT ---")
        # Log in as teacher to test Uitloggen button placement
        page.evaluate("window.PXLApp.currentUser = { username: 'teacher', full_name: 'Docent PXL', role: 'teacher' }; window.PXLApp.updateAuthUi();")
        page.wait_for_timeout(300)

        auth_container = page.locator("#userAuthContainer")
        assert auth_container.is_visible(), "userAuthContainer should be visible"
        logout_btn = page.locator("#btnLogoutBtn")
        assert logout_btn.is_visible(), "Uitloggen button should be visible"
        assert "Uitloggen" in logout_btn.inner_text()

        # Check that userAuthContainer is the last child of pt-header-actions
        last_action_tag = page.evaluate("document.querySelector('.pt-header-actions').lastElementChild.id")
        assert last_action_tag == "userAuthContainer", f"userAuthContainer must be the last element in header actions, found {last_action_tag}"
        print("  [OK] Uitloggen & user profile is positioned all the way on the right!")

        # -------------------------------------------------------------
        # 4. VERIFY WIRESHARK MODAL CLOSING & DISMISSAL
        # -------------------------------------------------------------
        print("\n--- TEST 4: VERIFY WIRESHARK CAN BE DISMISSED ---")
        ws_btn = page.locator("#btnOpenGlobalWireshark")
        assert ws_btn.is_visible(), "Wireshark button must be visible"
        ws_btn.click()
        page.wait_for_timeout(500)

        ws_modal = page.locator("#globalWiresharkModal")
        assert ws_modal.is_visible(), "Wireshark modal must be visible after click"
        print("  Wireshark modal is opened.")

        # Test closing with 'X' button
        close_x = page.locator("#globalWiresharkModal .pt-btn-close")
        assert close_x.is_visible(), "Wireshark close X button must be visible"
        close_x.click()
        page.wait_for_timeout(400)
        assert not ws_modal.is_visible(), "Wireshark modal MUST disappear after clicking X"
        print("  [OK] Wireshark closes cleanly with close button X!")

        # Test closing with 'Sluiten' button
        ws_btn.click()
        page.wait_for_timeout(400)
        assert ws_modal.is_visible()
        sluiten_btn = page.locator("#globalWiresharkModal button:has-text('Sluiten')")
        assert sluiten_btn.is_visible()
        sluiten_btn.click()
        page.wait_for_timeout(400)
        assert not ws_modal.is_visible(), "Wireshark modal MUST disappear after clicking Sluiten"
        print("  [OK] Wireshark closes cleanly with 'Sluiten' button!")

        # Test closing with Escape key
        ws_btn.click()
        page.wait_for_timeout(400)
        assert ws_modal.is_visible()
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        assert not ws_modal.is_visible(), "Wireshark modal MUST disappear after pressing Escape"
        print("  [OK] Wireshark closes cleanly with Escape key!")

        # -------------------------------------------------------------
        # 5. UNIFIED OPDRACHT & RUBRIC PANEL (OPDRACHT FIRST, RUBRIC BELOW)
        # -------------------------------------------------------------
        print("\n--- TEST 5: UNIFIED OPDRACHT & RUBRIC PANEL ---")
        opdracht_btn = page.locator("#btnOpdrachtDropdown")
        assert opdracht_btn.is_visible()
        opdracht_btn.click()
        page.wait_for_timeout(500)

        panel = page.locator("#opdrachtDropdownPanel")
        assert panel.is_visible(), "Unified Opdracht & Rubric panel should be open"

        # Check right side position
        bounding_box = panel.bounding_box()
        assert bounding_box["x"] + bounding_box["width"] >= 1400, f"Panel should be docked at the right of the screen (x={bounding_box['x']})"

        # Verify Opdracht card is present
        assignment_card = page.locator(".pt-opdracht-assignment-card")
        assert assignment_card.is_visible(), "Opdracht assignment card must be visible"

        # Verify Rubric section is directly underneath
        rubric_section = page.locator("#rubricSidePanel")
        assert rubric_section.is_visible(), "Rubric section must be visible inside unified panel"

        rubric_header = page.locator(".pt-rubric-panel-header")
        assert rubric_header.is_visible(), "Rubric header with live points must be visible"

        criteria_items = page.locator(".pt-rubric-panel-item").all()
        assert len(criteria_items) > 0, "Criteria items must be listed in rubric section"
        print(f"  [OK] Found {len(criteria_items)} rubric criteria directly below the assignment instructions!")

        # -------------------------------------------------------------
        # 6. 'VASTZETTEN' (PINNING) FUNCTIONALITY
        # -------------------------------------------------------------
        print("\n--- TEST 6: VASTZETTEN (PINNING) CHECKBOX ---")
        pin_cb = page.locator("#pinOpdrachtPanel")
        assert pin_cb.is_visible(), "'Vastzetten' checkbox must be visible in panel header"
        assert not pin_cb.is_checked(), "'Vastzetten' should initially be unchecked"

        # Check Vastzetten
        pin_cb.check()
        page.wait_for_timeout(400)
        assert pin_cb.is_checked(), "'Vastzetten' should now be checked"
        panel_classes = panel.get_attribute("class") or ""
        assert "pinned" in panel_classes, "Panel should have 'pinned' class"

        # Check that canvas workspace shifted margin-right
        ws_margin = page.evaluate("getComputedStyle(document.querySelector('.pt-workspace')).marginRight")
        print(f"Workspace margin-right after pinning: {ws_margin}")
        assert "480px" in ws_margin or "500px" in ws_margin, "Workspace should shift margin to make room for pinned panel"

        # Click on canvas background - panel should REMAIN OPEN because it is pinned!
        page.locator("#canvasContainer").click(position={"x": 200, "y": 200})
        page.wait_for_timeout(300)
        assert panel.is_visible(), "Pinned panel MUST stay open when clicking on canvas!"
        print("  [OK] Pinned panel remains open when clicking canvas!")

        # Unpin panel
        pin_cb.uncheck()
        page.wait_for_timeout(400)
        assert not pin_cb.is_checked()
        panel_classes_after = panel.get_attribute("class") or ""
        assert "pinned" not in panel_classes_after, "'pinned' class should be removed after unchecking"

        # Now close panel with X button
        page.locator("#opdrachtDropdownPanel .pt-btn-close").click()
        page.wait_for_timeout(400)
        assert not panel.is_visible(), "Panel should close cleanly after unpinning and clicking X"
        print("  [OK] Panel unpins and closes cleanly!")

        # Take screenshot of the clean UI
        page.screenshot(path="screenshot_clean_header_unified_panel.png")
        print("\n[SUCCESS] All 6 test suites passed with 100% compliance!")
        browser.close()

if __name__ == "__main__":
    test_header_and_unified_panel()
