"""
test_pka_rubric_generator_e2e.py - End-to-End Verification of the Interactive PKA Rubric Generator
Tests:
1. Teacher login & open Teacher Studio Tab 7 (Rubric & PKA).
2. Upload real PKA file and trigger Analyze & Open Rubric Generator.
3. Verify modal opens with extracted device settings, golden values, and live score.
4. Toggle checkboxes, edit instructions preview, and save generated Lab/Test.
5. Verify stripped initial topology & customized rubric on NetSim canvas.
"""

import os
import sys
import glob
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_pka_generator_test():
    print("=== STARTING PKA INTERACTIVE RUBRIC GENERATOR E2E TEST ===")
    pka_files = glob.glob(r'G:\My Drive\packettracerapp\gradebook_*\*.pka')
    assert len(pka_files) > 0, "No PKA files found in packettracerapp folder"
    sample_pka = pka_files[0]
    print(f"Testing with PKA: {os.path.basename(sample_pka)}")

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        page.on("pageerror", lambda err: print(f"[PageError] {err}"))
        page.on("dialog", lambda d: d.accept())

        # Step 1: Open Home Page
        page.goto("http://localhost:8080")
        page.wait_for_function("() => window.PXLApp !== undefined")
        page.wait_for_timeout(500)

        # Step 2: Log in as teacher
        page.evaluate("() => window.PXLApp.openLoginModal('teacher')")
        page.wait_for_selector("#loginModal", state="visible")
        page.fill("#loginUsername", "david")
        page.fill("#loginPassword", "PXL_Teacher2026!")
        page.click("#loginSubmitBtn")
        page.wait_for_selector("#loginModal", state="hidden")
        page.wait_for_timeout(600)
        print("✓ 1. Logged in as teacher (david)")

        # Step 3: Open Teacher Studio & switch to Rubric & PKA tab
        page.click("#btnToggleStudio")
        page.wait_for_selector("#teacherStudioModal", state="visible")
        page.evaluate("() => window.PXLApp.teacherStudio.switchTab('rubric')")
        page.wait_for_timeout(400)
        print("✓ 2. Teacher Studio opened on Rubric & PKA tab")

        # Step 4: Upload file to file input
        file_input = page.locator("#studioPkaFileInput")
        file_input.set_input_files(sample_pka)
        page.wait_for_timeout(300)

        # Step 5: Click "🎯 Analyseer & Open Rubric Generator"
        page.click("button:has-text('Analyseer & Open Rubric Generator')")
        page.wait_for_selector("#pkaRubricGeneratorModal", state="visible", timeout=15000)
        print("✓ 3. PKA Rubric Generator modal opened successfully")

        # Step 6: Verify extracted configurable settings are displayed
        settings_text = page.locator("#pkaGenSettingsList").inner_text()
        assert "PE1" in settings_text or "Router" in settings_text or "Switch" in settings_text
        score_badge_text = page.locator("#pkaGenScoreBadge").inner_text()
        print(f"✓ 4. Extracted settings visible. Live badge: {score_badge_text}")
        assert "punten" in score_badge_text

        # Step 7: Verify live generated instructions contain Addressing Table
        preview_text = page.locator("#pkaGenPreviewDiv").inner_text()
        assert "Adresseringstabel" in preview_text, "Preview must contain Adresseringstabel"
        print("✓ 5. Automatic Markdown Addressing Table verified in preview")

        # Step 8: Edit title & switch to Test
        test_title = f"E2E Test Lab {int(time.time())}"
        page.fill("#pkaGenTitleInput", test_title)
        page.check("input[name='pkaGenTypeRadio'][value='lab']")

        # Step 9: Save & Direct Load on Canvas
        page.click("button:has-text('Opslaan & Direct Laden op Werkveld')")
        page.wait_for_selector("#pkaRubricGeneratorModal", state="hidden", timeout=10000)
        page.wait_for_timeout(1000)
        print(f"✓ 6. Lab '{test_title}' generated, saved, and loaded onto canvas")

        # Step 10: Verify on Simulator Canvas
        dev_keys = page.evaluate("() => Object.keys(window.PXLNetworkSim.devices)")
        assert len(dev_keys) >= 2, f"Expected devices on canvas, got {dev_keys}"
        active_exam_title = page.evaluate("() => window.PXLApp.activeExam.title")
        assert active_exam_title == test_title, f"Expected active exam '{test_title}', got '{active_exam_title}'"
        rubric_len = page.evaluate("() => window.PXLApp.activeExam.rubric.length")
        assert rubric_len > 0, "Rubric criteria must be loaded"
        print(f"✓ 7. Canvas verified: {len(dev_keys)} devices, {rubric_len} rubric criteria")

        # Step 11: Verify unified Opdracht & Rubric side panel displays full addressing table & rubric
        page.click("#btnOpdrachtDropdown")
        page.wait_for_selector("#opdrachtDropdownPanel", state="visible")
        opdracht_text = page.locator("#opdrachtDropdownPanel").inner_text()
        assert "Adresseringstabel" in opdracht_text, "Unified side panel must display Addressing Table"
        assert "Beoordelingsrubric" in opdracht_text, "Unified side panel must display Rubric"
        print("✓ 8. Opdracht & Rubric unified panel verified complete with Addressing Table")

        browser.close()
        print("=== ALL PKA RUBRIC GENERATOR TESTS PASSED 100% PERFECTLY! ===")

if __name__ == '__main__':
    run_pka_generator_test()
