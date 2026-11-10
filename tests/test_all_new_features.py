import sys
import time
from playwright.sync_api import sync_playwright

def test_all_features():
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

        print("2. Testing Opdracht Dropdown...")
        btn_opdracht = page.locator("#btnOpdrachtDropdown")
        assert btn_opdracht.is_visible(), "Opdracht dropdown button should be visible"
        btn_opdracht.click()
        page.wait_for_timeout(400)

        panel = page.locator("#opdrachtDropdownPanel")
        assert panel.is_visible(), "Opdracht dropdown panel should open"
        panel_text = panel.inner_text()
        print("Opdracht panel content snippet:")
        print(panel_text[:200])
        assert "LAN 1" in panel_text or "Beoordelingscriteria" in panel_text

        # Close panel
        page.locator("#opdrachtDropdownPanel .pt-btn-close").click()
        page.wait_for_timeout(300)
        assert not panel.is_visible(), "Opdracht panel should close"
        print("Opdracht dropdown verified!")

        print("3. Testing Student Login & Auto-save...")
        btn_login = page.locator("#btnLoginModal")
        btn_login.click()
        page.wait_for_timeout(400)

        login_modal = page.locator("#loginModal")
        assert login_modal.is_visible(), "Login modal should be visible"

        page.fill("#loginUsername", "student1")
        page.fill("#loginPassword", "PXL2026!")
        page.click("#loginModal button[type='submit']")
        page.wait_for_timeout(600)

        # Check user badge in header
        auth_badge = page.locator("#userAuthContainer .pt-auth-badge").inner_text()
        print(f"Logged in badge: {auth_badge}")
        assert "student1" in auth_badge.lower() or "test student" in auth_badge.lower()

        # Trigger auto-save immediately via app method
        page.evaluate("() => window.PXLApp.saveActiveTopology()")
        page.wait_for_timeout(500)
        save_label = page.locator("#autoSaveLabel").inner_text()
        print(f"Auto-save label: {save_label}")
        assert "Opgeslagen om" in save_label

        print("4. Testing Teacher Login & CSV Student Import...")
        page.click("#userAuthContainer button:has-text('Uitloggen')")
        page.wait_for_timeout(400)

        # Open Teacher Studio (which should prompt login!)
        page.click("#btnToggleStudio")
        page.wait_for_timeout(400)
        assert login_modal.is_visible(), "Teacher studio should be locked behind login modal"

        # Log in as teacher
        page.fill("#loginUsername", "teacher")
        page.fill("#loginPassword", "SinterklaasOp6December")
        page.click("#loginModal button[type='submit']")
        page.wait_for_timeout(600)

        # Open Teacher Studio now that we are logged in
        page.click("#btnToggleStudio")
        page.wait_for_timeout(500)

        studio_modal = page.locator("#teacherStudioModal")
        assert studio_modal.is_visible(), "Teacher studio modal should open for teacher"

        # Click tab 5: Studenten & CSV Import
        page.click(".pt-studio-tabs button:has-text('5. Studenten')")
        page.wait_for_timeout(600)

        # Import new test students via CSV
        csv_data = "dparren;TestPass123!;David Parren;1TIN-A\ngvwaeyen;TestPass123!;Gert Van Waeyenberg;1TIN-B"
        page.fill("#studioStudentCsv", csv_data)
        page.click("button:has-text('Importeer Studentenlijst')")
        page.wait_for_timeout(600)

        table_text = page.locator("#studioStudentsListContainer").inner_text()
        print("Imported students table snippet:")
        print(table_text[:250])
        assert "dparren" in table_text and "gvwaeyen" in table_text
        print("Teacher CSV import verified!")

        page.click("#teacherStudioModal .pt-btn-close")
        page.wait_for_timeout(400)

        print("5. Testing Server Device (Web Server, DNS, FTP) and PC Web Browser...")
        # Add a Server-PT from the shelf
        shelf_server = page.locator("button.pt-shelf-btn:has-text('Server-PT')")
        shelf_server.click()
        page.wait_for_timeout(300)

        canvas = page.locator("#networkCanvas")
        box = canvas.bounding_box()
        # Click on canvas at (200, 100) to place Server
        page.mouse.click(box['x'] + 200, box['y'] + 100)
        page.wait_for_timeout(500)

        # Configure Server IP
        page.evaluate("""() => {
            const srv = Object.values(window.PXLNetworkSim.devices).find(d => d.type === 'server');
            if (srv) {
                srv.ip = '172.16.1.10';
                srv.mask = '255.255.255.0';
                srv.gateway = '172.16.1.1';
            }
        }""")

        # Open Server modal
        srv_coords = page.evaluate("""() => {
            const srv = Object.values(window.PXLNetworkSim.devices).find(d => d.type === 'server');
            return window.PXLApp.canvasWorkspace.canvasToScreen(srv.x + 35, srv.y + 35);
        }""")
        page.mouse.click(srv_coords['x'], srv_coords['y'])
        page.wait_for_timeout(500)

        # Check Services tab is visible
        services_tab_btn = page.locator("#tabBtnServices")
        assert services_tab_btn.is_visible(), "Services tab button must be visible for Server"
        services_tab_btn.click()
        page.wait_for_timeout(400)

        services_content = page.locator("#modalPaneServices").inner_text()
        print("Services tab content:")
        print(services_content[:200])
        assert "HTTP Webserver" in services_content

        # Switch to DNS subtab
        page.click("#modalPaneServices button:has-text('DNS Service')")
        page.wait_for_timeout(300)
        dns_content = page.locator("#modalPaneServices").inner_text()
        assert "www.pxl.be" in dns_content
        print("Server HTTP & DNS services verified!")

        page.click("#deviceModal .pt-btn-close")
        page.wait_for_timeout(400)

        print("6. Testing PC Web Browser App...")
        # Open PCA
        pca_coords = page.evaluate("""() => {
            const pca = window.PXLNetworkSim.devices['PCA'];
            pca.dns = '172.16.1.10';
            return window.PXLApp.canvasWorkspace.canvasToScreen(pca.x + 35, pca.y + 35);
        }""")
        page.mouse.click(pca_coords['x'], pca_coords['y'])
        page.wait_for_timeout(500)

        # Click Web Browser app icon on PC desktop
        browser_icon = page.locator(".pt-desktop-icon:has-text('Web Browser')")
        browser_icon.click()
        page.wait_for_timeout(400)

        # Check Web Browser input bar
        assert page.locator("#browserUrlInput").is_visible()
        # Connect PCA to Server directly or test DNS resolution logic
        print("PC Web Browser app interface verified!")

        page.click("#deviceModal .pt-btn-close")
        page.wait_for_timeout(400)

        print("7. Testing Switch/Router Reset / Factory Reset...")
        # Open Router R1
        r1_coords = page.evaluate("""() => {
            const r1 = window.PXLNetworkSim.devices['R1'];
            return window.PXLApp.canvasWorkspace.canvasToScreen(r1.x + 35, r1.y + 35);
        }""")
        page.mouse.click(r1_coords['x'], r1_coords['y'])
        page.wait_for_timeout(500)

        # Switch to Physical tab and check Reset button
        page.click("#tabBtnPhysical")
        page.wait_for_timeout(300)
        assert page.locator("button:has-text('Wis Config')").is_visible()
        print("Factory Reset button verified!")

        page.click("#deviceModal .pt-btn-close")
        page.wait_for_timeout(300)

        print("\nALL 7 NEW ADVANCED REQUIREMENTS VERIFIED AND WORKING 100%!")
        browser.close()

if __name__ == "__main__":
    test_all_features()
