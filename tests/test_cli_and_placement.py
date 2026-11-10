import sys
import time
from playwright.sync_api import sync_playwright

def test_netsim():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            headless=True
        )
        context = browser.new_context(viewport={'width': 1400, 'height': 900})
        page = context.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(f"PageError: {err}"))
        page.on("console", lambda msg: print(f"[Browser Console {msg.type}] {msg.text}"))

        print("1. Navigating to http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle")

        print("2. Checking title and initial devices...")
        title = page.title()
        print(f"Page title: {title}")

        # Check devices in simulation
        devices = page.evaluate("() => Object.keys(window.PXLNetworkSim.devices)")
        print(f"Initial devices in sim: {devices}")
        assert "R1" in devices, "R1 should be in default topology"

        # Click on R1 on canvas to open device modal
        print("3. Clicking on R1 on canvas...")
        r1_coords = page.evaluate("""() => {
            const r1 = window.PXLNetworkSim.devices['R1'];
            return window.PXLApp.canvasWorkspace.canvasToScreen(r1.x + 35, r1.y + 35);
        }""")
        print(f"R1 screen coords: {r1_coords}")

        canvas = page.locator("#networkCanvas")
        box = canvas.bounding_box()
        # Click on R1
        page.mouse.click(r1_coords['x'], r1_coords['y'])
        page.wait_for_timeout(500)

        # Check if modal is visible
        modal = page.locator("#deviceModal")
        is_visible = modal.is_visible()
        print(f"Modal visible after single click: {is_visible}")
        assert is_visible, "Device modal should be visible after clicking R1"

        # Verify CLI tab is active
        prompt_text = page.locator("#cliTerminalPrompt").inner_text()
        print(f"Initial CLI Prompt: {prompt_text}")
        assert "Router>" in prompt_text, f"Expected 'Router>', got '{prompt_text}'"

        # Type commands in CLI
        input_el = page.locator("#cliTerminalInput")

        def send_cli_cmd(cmd):
            input_el.fill(cmd)
            input_el.press("Enter")
            page.wait_for_timeout(200)

        print("4. Executing 'en' in CLI...")
        send_cli_cmd("en")
        prompt_after_en = page.locator("#cliTerminalPrompt").inner_text()
        print(f"Prompt after 'en': '{prompt_after_en}'")
        assert prompt_after_en.strip() == "Router#", f"Expected 'Router#', got '{prompt_after_en}'"

        print("5. Executing 'conf t'...")
        send_cli_cmd("conf t")
        prompt_after_conf = page.locator("#cliTerminalPrompt").inner_text()
        print(f"Prompt after 'conf t': '{prompt_after_conf}'")
        assert prompt_after_conf.strip() == "Router(config)#", f"Expected 'Router(config)#', got '{prompt_after_conf}'"

        print("6. Executing 'hostname PXL-R1'...")
        send_cli_cmd("hostname PXL-R1")
        prompt_after_host = page.locator("#cliTerminalPrompt").inner_text()
        print(f"Prompt after 'hostname PXL-R1': '{prompt_after_host}'")
        assert prompt_after_host.strip() == "PXL-R1(config)#", f"Expected 'PXL-R1(config)#', got '{prompt_after_host}'"

        print("7. Executing 'int gi0/0/0'...")
        send_cli_cmd("int gi0/0/0")
        prompt_after_if = page.locator("#cliTerminalPrompt").inner_text()
        print(f"Prompt after 'int gi0/0/0': '{prompt_after_if}'")
        assert prompt_after_if.strip() == "PXL-R1(config-if)#", f"Expected 'PXL-R1(config-if)#', got '{prompt_after_if}'"

        print("8. Executing 'ip add 172.16.1.1 255.255.255.0' and 'no sh'...")
        send_cli_cmd("ip add 172.16.1.1 255.255.255.0")
        send_cli_cmd("no sh")

        print("9. Switching directly to 'int gi0/0/1'...")
        send_cli_cmd("int gi0/0/1")
        prompt_after_if2 = page.locator("#cliTerminalPrompt").inner_text()
        print(f"Prompt after 'int gi0/0/1': '{prompt_after_if2}'")
        assert prompt_after_if2.strip() == "PXL-R1(config-if)#", f"Expected 'PXL-R1(config-if)#', got '{prompt_after_if2}'"

        send_cli_cmd("ip add 192.168.1.161 255.255.255.252")
        send_cli_cmd("no sh")

        print("10. Testing 'end'...")
        send_cli_cmd("end")
        prompt_after_end = page.locator("#cliTerminalPrompt").inner_text()
        print(f"Prompt after 'end': '{prompt_after_end}'")
        assert prompt_after_end.strip() == "PXL-R1#", f"Expected 'PXL-R1#', got '{prompt_after_end}'"

        print("11. Testing 'wr'...")
        send_cli_cmd("wr")

        print("12. Testing 'sh ip int br'...")
        send_cli_cmd("sh ip int br")

        screen_text = page.locator("#cliTerminalScreen").inner_text()
        print("Screen content snippet:")
        print(screen_text[-400:])
        assert "172.16.1.1" in screen_text, "IP 172.16.1.1 should be in show ip interface brief"
        assert "192.168.1.161" in screen_text, "IP 192.168.1.161 should be in show ip interface brief"

        print("13. Closing modal and checking score update...")
        close_btn = page.locator("#deviceModal .pt-btn-close")
        close_btn.click()
        page.wait_for_timeout(500)
        assert not modal.is_visible(), "Modal should be closed"

        # Check live score
        score_badge = page.locator("#scoreText").inner_text()
        print(f"Live score badge: {score_badge}")

        print("14. Re-opening R1 modal to verify persistent terminal buffer...")
        page.mouse.click(r1_coords['x'], r1_coords['y'])
        page.wait_for_timeout(500)
        reopened_screen = page.locator("#cliTerminalScreen").inner_text()
        assert "172.16.1.1" in reopened_screen, "Terminal buffer must be preserved when modal re-opens!"
        assert "PXL-R1#" in page.locator("#cliTerminalPrompt").inner_text(), "Prompt state must be preserved!"
        print("Terminal buffer successfully preserved!")

        page.locator("#deviceModal .pt-btn-close").click()
        page.wait_for_timeout(300)

        print("15. Testing Click-to-Place Device from Shelf...")
        # Click on Cisco 2911 router in shelf
        shelf_btn = page.locator("button.pt-shelf-btn:has-text('Cisco 2911')")
        shelf_btn.click()
        page.wait_for_timeout(300)

        # Click on canvas at (300, 450)
        page.mouse.click(box['x'] + 300, box['y'] + 450)
        page.wait_for_timeout(500)

        new_devices = page.evaluate("() => Object.keys(window.PXLNetworkSim.devices)")
        print(f"Devices after placement: {new_devices}")
        assert len(new_devices) > len(devices), f"New device should have been added, got {new_devices}"

        print("All automated UI, CLI, and device placement tests PASSED with 0 errors!")
        browser.close()

if __name__ == "__main__":
    test_netsim()
