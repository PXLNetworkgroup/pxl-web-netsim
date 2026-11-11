import sys
import time
from playwright.sync_api import sync_playwright

def test_opdrachten_tab():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            headless=True
        )
        context = browser.new_context(viewport={'width': 1400, 'height': 900})
        page = context.new_page()

        page.on("pageerror", lambda err: print(f"[PageError] {err}"))
        page.on("console", lambda msg: print(f"[Console {msg.type}] {msg.text}"))

        print("1. Opening http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle")
        page.wait_for_timeout(600)

        print("2. Logging in as Teacher...")
        page.click("#btnLoginModal")
        page.wait_for_timeout(300)
        page.click("#tabBtnLoginTeacher")
        page.fill("#loginUsername", "teacher")
        page.fill("#loginPassword", "SinterklaasOp6December")
        page.click("#loginModal button[type='submit']")
        page.wait_for_timeout(600)

        print("3. Opening Teacher Studio...")
        page.click("#btnToggleStudio")
        page.wait_for_timeout(600)

        studio_modal = page.locator("#teacherStudioModal")
        assert studio_modal.is_visible(), "Teacher Studio modal must be visible"

        print("4. Switching to Tab 3: Opdrachten...")
        page.click("#tabBtnExamMgmt")
        page.wait_for_timeout(800)

        # Verify studioTabExamMgmt is visible
        exam_mgmt_pane = page.locator("#studioTabExamMgmt")
        assert exam_mgmt_pane.is_visible(), "studioTabExamMgmt pane must be visible!"

        # Verify exam select dropdown
        exam_select = page.locator("#mgmtAssignExamSelect")
        assert exam_select.is_visible(), "Exam selector must be visible"
        opt_count = exam_select.locator("option").count()
        print(f"Exams found in dropdown: {opt_count}")
        assert opt_count >= 10, f"Expected at least 10 exams in dropdown, got {opt_count}"

        # Verify target class tree container
        tree_container = page.locator("#mgmtClassTreeContainer")
        assert tree_container.is_visible(), "Target class tree must be visible"
        tree_text = tree_container.inner_text()
        print(f"Target tree preview:\n{tree_text[:200]}")
        assert "1SNE" in tree_text or "1TIN" in tree_text or "GRSNE" in tree_text or "PBTIN" in tree_text or "1AADe" in tree_text, "Classes must be present in tree"

        # Verify assignments table
        asg_table = page.locator("#studioAssignmentsTableContainer")
        assert asg_table.is_visible(), "Assignments table container must be visible"

        # Screenshot the full modal
        screenshot_path = r"g:\My Drive\antigravitylogs\pxl-web-netsim\screenshot_opdrachten_tab_verified.png"
        studio_modal.screenshot(path=screenshot_path)
        print(f"Screenshot successfully saved to {screenshot_path}")

        print("\nSUCCESS: Tab 3 (Opdrachten & Examenbeheer) is fully functional, visible, and populated!")
        browser.close()

if __name__ == '__main__':
    test_opdrachten_tab()
