import sys
import json
import urllib.request
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

def test_bug_report_flow():
    print("=== STARTING BUG REPORT SYSTEM INTEGRATION TEST ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # Step 1: Open Home Page
        page.goto("http://localhost:8080")
        page.wait_for_selector("#toolSelect")

        # Step 2: Log in as student1
        page.wait_for_function("() => window.PXLApp !== undefined")
        page.wait_for_timeout(500)
        page.evaluate("() => window.PXLApp.openLoginModal('student')")
        page.wait_for_selector("#loginModal", state="visible")
        page.fill("#loginUsername", "student1")
        page.fill("#loginPassword", "PXL2026!")
        page.click("#loginSubmitBtn")
        page.wait_for_selector("#loginModal", state="hidden")
        page.wait_for_timeout(1000)
        print("✓ 1. Student1 logged in successfully")

        # Step 3: Click Bug Melden button
        bug_btn = page.locator("#btnReportBug")
        assert bug_btn.is_visible(), "Bug Melden button must be visible in top bar"
        bug_btn.click()
        page.wait_for_selector("#bugReportModal", state="visible")
        print("✓ 2. Bug report modal opened")

        # Check generated bug code pill
        code_el = page.locator("#bugReportCodePill")
        bug_code = code_el.inner_text().strip()
        assert bug_code.startswith("BUG-"), f"Expected BUG- prefix, got {bug_code}"
        print(f"✓ 3. Unique bug code generated: {bug_code}")

        # Fill in description
        test_desc = "Testmelding: Router interfaces vallen uit na herstart in lab 1."
        page.fill("#bugReportDescription", test_desc)

        # Handle alert dialog on submit
        page.on("dialog", lambda dialog: dialog.accept())

        # Submit bug report
        page.click("#bugReportForm button[type='submit']")
        page.wait_for_selector("#bugReportModal", state="hidden")
        print("✓ 4. Bug report submitted and modal closed")

        # Step 4: Verify bug is visible in Student Studio under 'Mijn Gemelde Bugs'
        student_btn = page.locator("#btnToggleStudentStudio")
        student_btn.click()
        page.wait_for_selector("#studentStudioModal", state="visible")
        page.click("#tabBtnStudentBugs")
        page.wait_for_selector("#studentBugsContainer table")
        assert bug_code in page.locator("#studentBugsContainer").inner_text()
        print("✓ 5. Bug report confirmed visible in Student Studio Tab 3")
        page.click("#studentStudioModal .pt-btn-secondary:has-text('Sluiten')")
        page.wait_for_selector("#studentStudioModal", state="hidden")

        # Step 5: Log out and log in as teacher
        page.click("#userAuthContainer button:has-text('Uitloggen')")
        page.wait_for_timeout(1000)
        page.evaluate("() => window.PXLApp.openLoginModal('teacher')")
        page.wait_for_selector("#loginModal", state="visible")
        page.fill("#loginUsername", "david")
        page.fill("#loginPassword", "PXL_Teacher2026!")
        page.click("#loginSubmitBtn")
        page.wait_for_selector("#loginModal", state="hidden")
        page.wait_for_timeout(1000)
        print("✓ 6. Teacher logged in successfully")

        # Step 6: Open Teacher Studio and switch to Tab 4 Bugs
        teacher_btn = page.locator("#btnToggleStudio")
        assert teacher_btn.is_visible()
        teacher_btn.click()
        page.wait_for_selector("#teacherStudioModal", state="visible")

        page.click("#tabBtnTeacherBugs")
        page.wait_for_selector("#teacherBugsContainer table")
        assert bug_code in page.locator("#teacherBugsContainer").inner_text()
        print(f"✓ 7. Bug {bug_code} successfully listed in Teacher Studio Tab 4")

        # Step 7: Test JSON export API
        export_url = f"http://localhost:8080/api/bug-report/{bug_code}/export"
        req = urllib.request.urlopen(export_url)
        export_data = json.loads(req.read().decode('utf-8'))
        assert export_data["bug_code"] == bug_code
        assert export_data["user_description"] == test_desc
        assert "topology" in export_data
        assert "device_configs" in export_data
        print(f"✓ 8. Export JSON endpoint verified for {bug_code}")

        # Step 8: Apply solution JSON
        solution_payload = {
            "bug_code": bug_code,
            "status": "resolved",
            "resolution_notes": "Interface persistence bug opgelost en geverifieerd.",
            "test_instructions": "Voer reload uit op router en test interfaces opnieuw."
        }
        page.click("button:has-text('Importeer Oplossing JSON')")
        page.wait_for_selector("#teacherImportSolutionModal", state="visible")
        page.fill("#importSolutionJsonInput", json.dumps(solution_payload))
        page.click("#teacherImportSolutionModal button:has-text('Oplossing Toepassen')")
        page.wait_for_selector("#teacherImportSolutionModal", state="hidden")
        print(f"✓ 9. Solution JSON applied for {bug_code}")

        # Step 9: Verify status updated to 'Opgelost' in Teacher Studio
        page.select_option("#teacherBugsStatusFilter", "all")
        page.wait_for_selector("#teacherBugsContainer table")
        status_text = page.locator("#teacherBugsContainer").inner_text()
        assert "🟢 Opgelost" in status_text, "Expected '🟢 Opgelost' badge"
        print("✓ 10. Status verified updated to 🟢 Opgelost in Bug Center")

        # Clean up test bug
        page.click(f"button[onclick*=\"deleteBug('{bug_code}')\"]")
        # Accept confirm dialog handled by dialog listener
        browser.close()
        print("=== ALL BUG REPORT TESTS PASSED PERFECTLY ===")

if __name__ == '__main__':
    test_bug_report_flow()
