import sys
import os
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots')
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def run_e2e_test():
    print("=== STARTING PLAYWRIGHT E2E UI TEST FOR STUDENT STUDIO & TEST/LAB ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # Step 1: Open Home Page logged out
        page.goto("http://localhost:8080")
        page.wait_for_selector("#toolSelect")
        time.sleep(1)

        # Check Studios hidden when logged out
        teacher_btn = page.locator("#btnToggleStudio")
        student_btn = page.locator("#btnToggleStudentStudio")
        login_btn = page.locator("#btnLoginModal")

        assert not teacher_btn.is_visible(), "Teacher studio button should be hidden when logged out"
        assert not student_btn.is_visible(), "Student studio button should be hidden when logged out"
        assert login_btn.is_visible(), "Login button should be visible when logged out"
        print("✓ 1. Logged out state verified: Both studios hidden, login button visible")

        # Step 2: Log in as student1
        login_btn.click()
        page.wait_for_selector("#loginModal", state="visible")
        page.fill("#loginUsername", "student1")
        page.fill("#loginPassword", "PXL2026!")
        page.click("#loginSubmitBtn")
        page.wait_for_selector("#loginModal", state="hidden")
        time.sleep(1)

        # Check studio buttons for student
        assert not teacher_btn.is_visible(), "Teacher studio must remain hidden for student"
        assert student_btn.is_visible(), "Student studio button must be visible for student"
        print("✓ 2. Student logged in: Student Studio visible, Teacher Studio hidden")

        # Step 3: Open Student Studio
        student_btn.click()
        page.wait_for_selector("#studentStudioModal", state="visible")
        page.wait_for_selector("#studentAssignedListContainer table")
        time.sleep(1)

        # Check Account Info Tab
        page.click("#tabBtnStudentAccount")
        time.sleep(0.5)
        username_el = page.locator("#studentInfoUsername")
        assert username_el.inner_text() == "student1", f"Expected student1 username, got {username_el.inner_text()}"
        assert page.locator("#studentOldPw").is_visible(), "Password change form visible in Student Studio"
        print("✓ 3. Student Studio Tab 2: Account information & password change form verified")

        # Switch back to Labs & Testen Tab
        page.click("#tabBtnStudentLabs")
        time.sleep(0.5)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "student_studio_overview.png"))
        print("✓ 4. Student Studio Tab 1: Assigned Labs & Tests table verified, screenshot captured")

        # Close Student Studio
        page.click("#studentStudioModal .pt-btn-close")
        page.wait_for_selector("#studentStudioModal", state="hidden")
        time.sleep(0.5)

        # Step 4: Check Top Nav #examSelector
        exam_selector = page.locator("#examSelector")
        assert exam_selector.is_visible()
        select_html = exam_selector.inner_html()
        assert "Toegewezen" in select_html, "Exam selector contains assigned labs/tests optgroup"
        print("✓ 5. Top Navigation exam selector populated with assigned labs/tests")

        # Step 5: Logout student
        page.click("#btnLogoutBtn")
        time.sleep(1)
        assert not teacher_btn.is_visible()
        assert not student_btn.is_visible()
        print("✓ 6. Student logged out: Both studios hidden again")

        # Step 6: Log in as teacher
        page.click("#btnLoginModal")
        page.wait_for_selector("#loginModal", state="visible")
        page.click("#tabBtnLoginTeacher")
        page.fill("#loginUsername", "teacher")
        page.fill("#loginPassword", "SinterklaasOp6December")
        page.click("#loginSubmitBtn")
        page.wait_for_selector("#loginModal", state="hidden")
        time.sleep(1)

        assert teacher_btn.is_visible(), "Teacher studio button must be visible for teacher"
        assert not student_btn.is_visible(), "Student studio button must be hidden for teacher"
        print("✓ 7. Teacher logged in: Teacher Studio visible, Student Studio hidden")

        # Step 7: Open Teacher Studio & verify Tab 3 Lab vs Test controls
        teacher_btn.click()
        page.wait_for_selector("#teacherStudioModal", state="visible")
        time.sleep(1)

        # Click Tab 3 Opdrachten
        page.click("#tabBtnExamMgmt")
        page.wait_for_selector("#mgmtAssignTypeLab", state="visible")
        time.sleep(1)

        # Verify radio buttons and test config row toggle
        lab_radio = page.locator("#mgmtAssignTypeLab")
        test_radio = page.locator("#mgmtAssignTypeTest")
        test_config_row = page.locator("#mgmtAssignTestConfigRow")

        assert lab_radio.is_checked(), "Default assignment type should be Lab"
        assert not test_config_row.is_visible(), "Test config row hidden when Lab is selected"

        test_radio.click()
        time.sleep(0.5)
        assert test_config_row.is_visible(), "Test config row visible when Test is selected"
        assert page.locator("#mgmtAssignPassword").is_visible(), "Test password input visible"
        assert page.locator("#mgmtAssignStartTestToggle").is_visible(), "Start test live toggle checkbox visible"

        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "teacher_studio_test_lab_subdivision.png"))
        print("✓ 8. Teacher Studio Tab 3: Lab vs Test subdivision & password controls verified")

        browser.close()
        print("\n🎉 ALL PLAYWRIGHT E2E BROWSER UI TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_e2e_test()
