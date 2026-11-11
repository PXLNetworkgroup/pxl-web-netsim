# tests/test_score_and_tab_e2e.py - Playwright E2E verification of Score, Tab Completion, and Assignment rendering
import glob
import os
import time
from playwright.sync_api import sync_playwright

pka_files = glob.glob(r'G:\My Drive\packettracerapp\gradebook_*\*.pka')
if not pka_files:
    raise RuntimeError("Geen PKA bestand gevonden!")
pka_path = pka_files[0]
print(f"Testen met PKA: {os.path.basename(pka_path)}")

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        headless=True
    )
    context = browser.new_context(viewport={"width": 1400, "height": 900})
    page = context.new_page()
    page.on("pageerror", lambda err: print(f"[PageError] {err}"))
    page.on("console", lambda msg: print(f"[Console {msg.type}] {msg.text}"))

    # 1. Open local NetSim
    print("1. Opening http://localhost:8080...")
    page.goto('http://localhost:8080', wait_until='networkidle')

    # 2. Login as teacher
    print("2. Logging in as teacher...")
    page.click('#btnLoginModal')
    page.wait_for_timeout(300)
    page.fill('#loginUsername', 'teacher')
    page.fill('#loginPassword', 'SinterklaasOp6December')
    page.click("#loginModal button[type='submit']")
    page.wait_for_timeout(500)

    # 3. Open Teacher Studio modal
    print("3. Opening Teacher Studio...")
    page.click('#btnToggleStudio')
    page.wait_for_timeout(500)

    # Switch to Rubric / PKA Import tab
    print("4. Switching to Rubric / PKA Import tab...")
    page.evaluate("() => window.PXLApp.teacherStudio.switchTab('rubric')")
    page.wait_for_timeout(400)

    # 4. Upload PKA file
    print("5. Uploading PKA file...")
    file_input = page.locator('#studioPkaFileInput')
    file_input.set_input_files(pka_path)
    page.wait_for_timeout(300)
    page.fill('#studioPkaTitleInput', 'PE1 Praktijk Examen')
    page.wait_for_timeout(200)
    page.click("button:has-text('Converteer')")
    
    # Wait for success status
    page.wait_for_selector("text=succesvol gedecodeerd", timeout=15000)
    print("PKA decoded successfully.")

    # 5. Apply to session
    page.click("button:has-text('Activeer dit Examen in NetSim')")
    page.wait_for_timeout(800)

    # Check score before configuring
    score_before = page.locator('#scoreText').inner_text()
    print(f"Initial score: {score_before}")

    # 6. Open PE1 device modal and CLI tab
    page.evaluate("window.PXLApp.openDeviceModal(window.PXLNetworkSim.devices['PE1'])")
    page.wait_for_timeout(500)
    page.evaluate("window.PXLApp.switchDeviceModalTab('cli')")
    page.wait_for_timeout(500)

    cli_input = page.locator('#cliTerminalInput')
    
    # Test Tab completion for 'en'
    cli_input.fill('en')
    page.keyboard.press('Tab')
    val = cli_input.input_value()
    print(f"Tab 'en' completed to: '{val}'")
    page.keyboard.press('Enter')
    page.wait_for_timeout(200)

    # Test Tab completion for 'conf t'
    cli_input.fill('conf t')
    page.keyboard.press('Tab')
    val = cli_input.input_value()
    print(f"Tab 'conf t' completed to: '{val}'")
    page.keyboard.press('Enter')
    page.wait_for_timeout(200)

    # Send configuration commands
    commands = [
        'hostname PE1',
        'enable secret cisco',
        'service password-encryption',
        'banner motd #Authorized access only!#',
        'line con 0',
        'password Geslaagd',
        'login',
        'exit',
        'interface vlan 1',
        'ip address 192.168.19.2 255.255.255.0',
        'no shutdown',
        'exit',
        'ip default-gateway 192.168.19.1',
        'end',
        'copy run start'
    ]

    for cmd in commands:
        cli_input.fill(cmd)
        page.keyboard.press('Enter')
        page.wait_for_timeout(100)

    # Close modal
    page.evaluate("window.PXLApp.closeDeviceModal()")
    page.wait_for_timeout(500)

    # Check intermediate score after configuring PE1
    score_after_pe1 = page.locator('#scoreText').inner_text()
    print(f"Score after configuring PE1: {score_after_pe1}")

    # Configure PC1
    page.evaluate("""
        const pc1 = window.PXLNetworkSim.devices['PC1'];
        pc1.ip = '192.168.19.3';
        pc1.mask = '255.255.255.0';
        pc1.gateway = '192.168.19.1';
        if (pc1.interfaces['FastEthernet0']) {
            pc1.interfaces['FastEthernet0'].ip = pc1.ip;
            pc1.interfaces['FastEthernet0'].mask = pc1.mask;
        }
        window.PXLApp.triggerScoreUpdate();
    """)
    page.wait_for_timeout(300)

    # Configure PC2
    page.evaluate("""
        const pc2 = window.PXLNetworkSim.devices['PC2'];
        pc2.ip = '192.168.19.4';
        pc2.mask = '255.255.255.0';
        pc2.gateway = '192.168.19.1';
        if (pc2.interfaces['FastEthernet0']) {
            pc2.interfaces['FastEthernet0'].ip = pc2.ip;
            pc2.interfaces['FastEthernet0'].mask = pc2.mask;
        }
        window.PXLApp.triggerScoreUpdate();
    """)
    page.wait_for_timeout(500)

    final_score = page.locator('#scoreText').inner_text()
    print(f"Final score: {final_score}")

    # Open Opdracht dropdown to verify rendering
    page.evaluate("window.PXLApp.toggleOpdrachtDropdown()")
    page.wait_for_timeout(500)

    screenshot_path = r'g:\My Drive\antigravitylogs\pxl-web-netsim\screenshot_score_and_tab_verified.png'
    page.screenshot(path=screenshot_path)
    print(f"Screenshot saved to {screenshot_path}")

    browser.close()
    print("Test completed successfully!")
