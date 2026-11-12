"""
Playwright E2E UI verification for Exam Deletion, Bulk Delete, Student Score View, and All Scores Export
"""
import sys
import os
import time

sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        print("1. Opening WebNetSim at http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle")

        # --- TEST 1: STUDENT LOGIN & SCORES MODAL ---
        print("2. Testing Student login...")
        page.click("#btnLoginModal")
        page.wait_for_selector("#loginModal", state="visible")

        # Select student tab
        page.click("#tabBtnLoginStudent")
        page.fill("#loginUsername", "student1")
        page.fill("#loginPassword", "PXL2026!")
        page.click("button[type='submit']")
        page.wait_for_selector("#loginModal", state="hidden")

        # Verify [Mijn Scores] button is visible
        print("3. Checking for [📊 Mijn Scores] button in auth container...")
        page.wait_for_selector("#btnStudentScores", state="visible", timeout=5000)
        btn_text = page.inner_text("#btnStudentScores")
        print(f"Found student button: {btn_text}")

        # Click [Mijn Scores]
        page.click("#btnStudentScores")
        page.wait_for_selector("#studentScoresModal", state="visible")
        time.sleep(1) # wait for fetch
        modal_html = page.inner_html("#studentScoresModalBody")
        print("Student scores modal opened successfully. Contains scores table or empty state.")
        page.screenshot(path="tests/screenshots/student_scores_modal.png")

        # Close student scores modal
        page.click("#studentScoresModal .pt-btn-close")
        page.wait_for_selector("#studentScoresModal", state="hidden")

        # Student logout
        print("4. Logging out student...")
        page.click("#btnLogoutBtn")
        page.wait_for_selector("#btnLoginModal", state="visible")

        # --- TEST 2: TEACHER LOGIN & TAB 3 EXAMS DELETION TABLE ---
        print("5. Logging in as Teacher...")
        page.click("#btnLoginModal")
        page.wait_for_selector("#loginModal", state="visible")
        page.click("#tabBtnLoginTeacher")
        page.fill("#loginUsername", "teacher")
        page.fill("#loginPassword", "SinterklaasOp6December")
        page.click("button[type='submit']")
        page.wait_for_selector("#loginModal", state="hidden")

        # Open Teacher Studio
        print("6. Opening Teacher Studio...")
        page.click("#btnToggleStudio")
        page.wait_for_selector("#teacherStudioModal", state="visible")

        # Navigate to Tab 3: Opdrachten & Examen Management
        print("7. Navigating to Tab 3 (Opdrachten & Examen Management)...")
        page.click("#tabBtnExamMgmt")
        page.wait_for_selector("#studioTabExamMgmt", state="visible")
        time.sleep(1)

        # Verify Database Exams Table
        page.wait_for_selector("#studioExamsListContainer table", state="visible")
        exams_table_text = page.inner_text("#studioExamsListContainer")
        print("Exam management table loaded! Sample text:", exams_table_text[:200])

        # Verify bulk delete button and select-all checkbox
        page.wait_for_selector("#btnBulkDeleteExams", state="visible")
        page.wait_for_selector("#mgmtSelectAllExamsCb", state="visible")
        print("Bulk delete button and select-all checkbox verified.")

        # Test selecting all exams
        page.click("#mgmtSelectAllExamsCb")
        badge_text = page.inner_text("#mgmtExamSelectionBadge")
        print(f"Exam selection badge updated: {badge_text}")

        # Uncheck select all
        page.click("#mgmtSelectAllExamsCb")

        # Screenshot Tab 3
        page.screenshot(path="tests/screenshots/teacher_tab3_exams_table.png")

        # --- TEST 3: TAB 2 ALL SCORES VIEW & CSV EXPORT BUTTON ---
        print("8. Navigating to Tab 2 (Scores & Voortgang)...")
        page.click("#tabBtnScores")
        page.wait_for_selector("#studioTabScores", state="visible")
        time.sleep(1)

        # Check options in scoresExamSelect
        options = page.eval_on_selector_all("#scoresExamSelect option", "opts => opts.map(o => ({ value: o.value, text: o.text }))")
        has_all_opt = any(o["value"] == "all" for o in options)
        print("Has 'all' option in dropdown:", has_all_opt)
        assert has_all_opt, "Option 'all' must be present in scoresExamSelect"

        # Select 'all' option
        page.select_option("#scoresExamSelect", "all")
        time.sleep(1)

        # Verify table container renders
        page.wait_for_selector("#studioScoresTableContainer table", state="visible")
        scores_table_text = page.inner_text("#studioScoresTableContainer")
        print("Scores table rendered with all exams:", scores_table_text[:150])

        # Screenshot Tab 2
        page.screenshot(path="tests/screenshots/teacher_tab2_all_scores.png")

        print("9. All E2E browser tests passed successfully!")
        browser.close()

if __name__ == "__main__":
    os.makedirs("tests/screenshots", exist_ok=True)
    run()
