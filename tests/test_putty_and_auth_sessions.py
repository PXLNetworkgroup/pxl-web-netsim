import sys
import time
from playwright.sync_api import sync_playwright

def test_putty_and_auth_sessions():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            headless=True
        )
        context = browser.new_context(viewport={'width': 1400, 'height': 900})
        page = context.new_page()

        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("console", lambda msg: print(f"[Console {msg.type}] {msg.text}"))

        print("1. Loading http://localhost:8080...")
        page.goto("http://localhost:8080", wait_until="networkidle")
        page.wait_for_timeout(1000)

        assert len(errors) == 0, f"Page had Javascript errors: {errors}"

        print("2. Setting up test network with PC1 and Switch0...")
        page.evaluate("""() => {
            const app = window.PXLApp;
            app.sim.clear();

            // PC1
            const pc1 = new CiscoDevice('pc1', 'pc', 'PC1');
            pc1.ip = '192.168.1.10';
            pc1.mask = '255.255.255.0';
            pc1.interfaces['FastEthernet0'].ip = '192.168.1.10';
            pc1.interfaces['FastEthernet0'].mask = '255.255.255.0';
            pc1.interfaces['FastEthernet0'].shutdown = false;
            app.sim.registerDevice(pc1);

            // Switch0
            const sw0 = new CiscoDevice('sw0', 'switch', 'Switch0');
            sw0.interfaces['Vlan1'].ip = '192.168.1.2';
            sw0.interfaces['Vlan1'].mask = '255.255.255.0';
            sw0.interfaces['Vlan1'].shutdown = false;
            sw0.ip = '192.168.1.2';
            sw0.mask = '255.255.255.0';
            app.sim.registerDevice(sw0);

            // Straight cable PC1 -> Switch0
            app.sim.addCable({
                id: 'conn1',
                fromDevice: 'pc1',
                fromPort: 'FastEthernet0',
                toDevice: 'sw0',
                toPort: 'FastEthernet0/1',
                type: 'straight'
            });

            // Console cable PC1 RS-232 -> Switch0 Console
            app.sim.addCable({
                id: 'con1',
                fromDevice: 'pc1',
                fromPort: 'RS-232',
                toDevice: 'sw0',
                toPort: 'Console',
                type: 'console'
            });
        }""")

        # TEST 1: Telnet with NO password set (Default Cisco IOS behavior)
        # Should refuse connection with "% Password required, but none set."
        print("3. Testing Telnet without password (must fail with '% Password required, but none set.')...")
        no_pw_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const pc1 = app.sim.devices['pc1'];
            const sw0 = app.sim.devices['sw0'];

            sw0.vtyPassword = '';
            sw0.vtyLoginMode = 'login';

            let output = [];
            let currentPrompt = 'C:\\\\Users\\\\Student> ';
            const term = new PCDesktopHandler(
                pc1,
                (t) => output.push(t),
                () => {},
                (p) => { currentPrompt = p; }
            );

            term.handleCommand('telnet 192.168.1.2');

            return {
                output: output.join('\\n'),
                activeSession: !!term.activeRemoteSession,
                prompt: currentPrompt
            };
        }""")
        print(f"No-password Telnet output:\n{no_pw_result['output']}")
        assert "Password required, but none set" in no_pw_result['output'], "Expected '% Password required, but none set.' message"
        assert no_pw_result['activeSession'] is False, "Active session should not be open without password"

        # TEST 2: Telnet with password 'cisco' configured
        # Should prompt 'Password: ', reject wrong password, accept 'cisco'
        print("4. Testing Telnet with VTY password configured (prompt, reject wrong, accept correct)...")
        pw_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const pc1 = app.sim.devices['pc1'];
            const sw0 = app.sim.devices['sw0'];

            sw0.vtyPassword = 'cisco';
            sw0.vtyLoginMode = 'login';

            let output = [];
            let prompts = [];
            const term = new PCDesktopHandler(
                pc1,
                (t) => output.push(t),
                () => {},
                (p) => { prompts.push(p); }
            );

            // Connect
            term.handleCommand('telnet 192.168.1.2');
            const prompt1 = prompts[prompts.length - 1];

            // Wrong password
            term.handleCommand('wrongpassword');
            const prompt2 = prompts[prompts.length - 1];

            // Correct password
            term.handleCommand('cisco');
            const prompt3 = prompts[prompts.length - 1];

            // Send command inside session
            term.handleCommand('show ip interface brief');

            return {
                output: output.join('\\n'),
                prompt1: prompt1,
                prompt2: prompt2,
                prompt3: prompt3,
                isAuthenticated: term.activeRemoteSession && term.activeRemoteSession.parser.state !== 'VTY_PASSWORD'
            };
        }""")
        print(f"Telnet password flow: prompt1='{pw_result['prompt1']}', prompt2='{pw_result['prompt2']}', prompt3='{pw_result['prompt3']}'")
        assert "User Access Verification" in pw_result['output'], "Should print User Access Verification"
        assert pw_result['prompt1'] == "Password: ", f"First prompt should be 'Password: ', got '{pw_result['prompt1']}'"
        assert "Login invalid" in pw_result['output'], "Should print Login invalid on wrong password"
        assert "Switch0>" in pw_result['prompt3'], f"Final prompt after 'cisco' should be 'Switch0>', got '{pw_result['prompt3']}'"
        assert "Vlan1" in pw_result['output'], "Should execute show ip interface brief on switch"

        # TEST 3: Telnet with 'login local'
        print("5. Testing Telnet with 'login local' (Username and Password)...")
        local_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const pc1 = app.sim.devices['pc1'];
            const sw0 = app.sim.devices['sw0'];

            sw0.vtyLoginMode = 'local';
            sw0.users = { 'david': { secret: 'pxlsecret', password: null, priv: 1 } };

            let output = [];
            let prompts = [];
            const term = new PCDesktopHandler(
                pc1,
                (t) => output.push(t),
                () => {},
                (p) => { prompts.push(p); }
            );

            term.handleCommand('telnet 192.168.1.2');
            const pUser = prompts[prompts.length - 1];

            term.handleCommand('david');
            const pPass = prompts[prompts.length - 1];

            term.handleCommand('pxlsecret');
            const pLogged = prompts[prompts.length - 1];

            return {
                output: output.join('\\n'),
                pUser,
                pPass,
                pLogged
            };
        }""")
        print(f"Login local flow: pUser='{local_result['pUser']}', pPass='{local_result['pPass']}', pLogged='{local_result['pLogged']}'")
        assert local_result['pUser'] == "Username: ", f"Expected Username: prompt, got {local_result['pUser']}"
        assert local_result['pPass'] == "Password: ", f"Expected Password: prompt, got {local_result['pPass']}"
        assert "Switch0>" in local_result['pLogged'], f"Expected Switch0> prompt, got {local_result['pLogged']}"

        # TEST 4: SSH Authentication with username & secret
        print("6. Testing SSH Authentication from Command Prompt...")
        ssh_auth_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const pc1 = app.sim.devices['pc1'];
            const sw0 = app.sim.devices['sw0'];

            sw0.domainName = 'pxl.be';
            sw0.rsaKeyBits = 1024;
            sw0.sshVersion = 2;
            sw0.users = { 'admin': { secret: 'ciscosecret', password: null, priv: 15 } };

            let output = [];
            let prompts = [];
            const term = new PCDesktopHandler(
                pc1,
                (t) => output.push(t),
                () => {},
                (p) => { prompts.push(p); }
            );

            term.handleCommand('ssh -l admin 192.168.1.2');
            const pPass = prompts[prompts.length - 1];

            // Incorrect password
            term.handleCommand('badpw');
            const pRetry = prompts[prompts.length - 1];

            // Correct password
            term.handleCommand('ciscosecret');
            const pAuth = prompts[prompts.length - 1];

            return {
                output: output.join('\\n'),
                pPass,
                pRetry,
                pAuth
            };
        }""")
        print(f"SSH flow: pPass='{ssh_auth_result['pPass']}', pRetry='{ssh_auth_result['pRetry']}', pAuth='{ssh_auth_result['pAuth']}'")
        assert ssh_auth_result['pPass'] == "Password: ", f"Expected Password: prompt, got {ssh_auth_result['pPass']}"
        assert "Access denied" in ssh_auth_result['output'], "Should print Access denied on wrong password"
        assert "Switch0#" in ssh_auth_result['pAuth'], f"User had priv 15, expected Switch0#, got {ssh_auth_result['pAuth']}"

        # TEST 5: PuTTY Serial (COM1) with Console Password
        print("7. Testing PuTTY Console with line con 0 password...")
        putty_result = page.evaluate("""() => {
            const app = window.PXLApp;
            const sw0 = app.sim.devices['sw0'];

            sw0.consolePassword = 'consolepass';
            sw0.consoleLoginRequired = true;

            // Render PuTTY config into DOM
            const container = document.createElement('div');
            container.id = 'puttyTestContainer';
            container.innerHTML = renderPuttyConfigHtml(app.sim.devices['pc1']);
            document.body.appendChild(container);

            // Open serial terminal
            openActivePuttyTerminal('pc1');

            const termView = document.getElementById('puttyTerminalView');
            const promptEl = document.getElementById('puttyPromptSpan');
            const screen = document.getElementById('puttyScreenArea');
            const input = document.getElementById('puttyTerminalInput');

            const initialPrompt = promptEl.innerText;
            const isPasswordInput = input.type === 'password';

            // Type correct password
            input.value = 'consolepass';
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

            const promptAfterAuth = promptEl.innerText;
            const isTextInput = input.type === 'text';

            return {
                termVisible: termView.style.display !== 'none',
                initialPrompt,
                isPasswordInput,
                promptAfterAuth,
                isTextInput,
                screenText: screen.innerText
            };
        }""")
        print(f"PuTTY Console result: initialPrompt='{putty_result['initialPrompt']}', promptAfterAuth='{putty_result['promptAfterAuth']}', isPasswordInput={putty_result['isPasswordInput']}")
        assert putty_result['termVisible'] is True, "PuTTY terminal view should be visible"
        assert putty_result['initialPrompt'].strip() == "Password:", f"PuTTY should prompt 'Password:', got '{putty_result['initialPrompt']}'"
        assert putty_result['isPasswordInput'] is True, "Input field should be masked (type='password')"
        assert "Switch0" in putty_result['promptAfterAuth'], f"After password, prompt should contain 'Switch0', got '{putty_result['promptAfterAuth']}'"
        assert putty_result['isTextInput'] is True, "After login, input field should become type='text'"

        print("\nALL 5 AUTHENTICATION TESTS PASSED SUCCESSFULLY!")
        browser.close()

if __name__ == '__main__':
    test_putty_and_auth_sessions()
