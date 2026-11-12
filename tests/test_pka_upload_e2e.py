import os
import glob
import time
from playwright.sync_api import sync_playwright

def test_pka_upload_e2e():
    pka_files = glob.glob(r'G:\My Drive\packettracerapp\gradebook_*\*.pka')
    assert len(pka_files) > 0, "No PKA files found to test"
    sample_pka = pka_files[0]
    print(f"Testing with real PKA file: {os.path.basename(sample_pka)}")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            headless=True
        )
        context = browser.new_context(viewport={'width': 1400, 'height': 900})
        page = context.new_page()

        page.on("pageerror", lambda err: print(f"[PageError] {err}"))
        page.on("console", lambda msg: print(f"[Console {msg.type}] {msg.text}"))

        print("1. Loading http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle")

        print("2. Logging in as teacher...")
        page.click("#btnLoginModal")
        page.wait_for_timeout(300)
        page.fill("#loginUsername", "teacher")
        page.fill("#loginPassword", "SinterklaasOp6December")
        page.click("#loginModal button[type='submit']")
        page.wait_for_timeout(500)

        print("3. Opening Teacher Studio...")
        page.click("#btnToggleStudio")
        page.wait_for_timeout(500)

        # Switch to tab 4: PKA Import
        print("4. Switching to PKA Import tab...")
        page.evaluate("() => window.PXLApp.teacherStudio.switchTab('pka')")
        page.wait_for_timeout(400)

        # Set input file
        print("5. Uploading PKA file...")
        file_input = page.locator("#studioPkaFileInput")
        file_input.set_input_files(sample_pka)
        page.wait_for_timeout(300)

        # Click convert
        page.click("button:has-text('Converteer & Laad in NetSim')")
        page.wait_for_timeout(2500)

        # Check status box
        status_text = page.locator("#studioPkaStatus").inner_text()
        print(f"Status Output:\n{status_text}")
        assert "Succesvol Geconverteerd" in status_text or "Succesvol gedecodeerd" in status_text

        # Click "Nu Toepassen & Direct Laden op Werkveld"
        print("6. Applying imported exam to session...")
        page.click("button:has-text('Nu Toepassen & Direct Laden op Werkveld')")
        page.wait_for_timeout(800)

        # Verify on Canvas: Check devices in window.PXLNetworkSim
        dev_names = page.evaluate("() => Object.keys(window.PXLNetworkSim.devices)")
        cables_count = page.evaluate("() => window.PXLNetworkSim.cables.length")
        rubric_count = page.evaluate("() => window.PXLApp.activeExam.rubric.length")
        exam_title = page.evaluate("() => window.PXLApp.activeExam.title")

        print("\n--- RESULTS ON SIMULATOR CANVAS ---")
        print(f"Exam Title: {exam_title}")
        print(f"Devices on Canvas ({len(dev_names)}): {dev_names}")
        print(f"Cables on Canvas: {cables_count}")
        print(f"Rubric criteria count: {rubric_count}")

        assert "PE1" in dev_names, "PE1 switch must be present on canvas"
        assert "PC1" in dev_names, "PC1 must be present on canvas"
        assert "PC2" in dev_names, "PC2 must be present on canvas"
        assert cables_count == 2, "Exactly 2 cables must be connected between PC1/PC2 and PE1"
        assert rubric_count >= 15, f"Expected at least 15 rubric criteria, got {rubric_count}"

        # Open Opdracht Dropdown to inspect rubric items live
        page.click("#btnOpdrachtDropdown")
        page.wait_for_timeout(400)
        panel_text = page.locator("#opdrachtDropdownPanel").inner_text()
        print(f"Opdracht Dropdown snippet:\n{panel_text[:300]}")

        # Take screenshot of the loaded exercise
        screenshot_path = r"g:\My Drive\antigravitylogs\pxl-web-netsim\screenshot_pka_loaded.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        print("\n✅ PKA IMPORT VERIFIED 100% WORKING END-TO-END!")
        browser.close()

if __name__ == "__main__":
    test_pka_upload_e2e()
