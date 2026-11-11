/**
 * putty_app.js - Authentic PuTTY SSH / Telnet / Serial Console Application
 * Emulates the iconic PuTTY configuration window and terminal session
 * Connects over Serial (Console Cable COM1) or Network (SSH/Telnet port 22/23)
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

function renderPuttyConfigHtml(device) {
  const devId = device.id;
  const sim = window.PXLNetworkSim;
  const consoleConn = sim ? sim.getConsoleConnection(devId) : null;
  const defaultHost = consoleConn ? '' : '192.168.1.1';
  const defaultConn = consoleConn ? 'serial' : 'ssh';

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #ece9d8; color: #000; border: 2px solid #0055ea; border-radius: 6px; overflow: hidden; width: 100%; max-width: 640px; margin: 0 auto; box-shadow: 0 8px 25px rgba(0,0,0,0.4);" id="puttyMainWindow">
      <!-- Classic Windows/PuTTY Title Bar -->
      <div style="background: linear-gradient(90deg, #0a246a 0%, #a6caf0 100%); color: #fff; padding: 4px 8px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: bold;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 14px; height: 14px; background: #fff; border: 1px solid #000; border-radius: 2px; text-align: center; line-height: 12px; font-size: 10px; color: #0a246a;">🖲️</span>
          <span>PuTTY Configuration</span>
        </div>
        <div style="display: flex; gap: 2px;">
          <button style="width: 16px; height: 14px; font-size: 9px; line-height: 10px; background: #ece9d8; border: 1px solid #7f9db9; cursor: pointer;">_</button>
          <button style="width: 16px; height: 14px; font-size: 9px; line-height: 10px; background: #ece9d8; border: 1px solid #7f9db9; cursor: pointer;">×</button>
        </div>
      </div>

      <!-- PuTTY Interior -->
      <div style="padding: 12px; display: flex; gap: 12px; background: #f0f0f0; font-size: 11px;">
        <!-- Left Tree Category View -->
        <div style="width: 160px; background: #fff; border: 2px inset #fff; padding: 6px; height: 320px; overflow-y: auto;">
          <div style="font-weight: bold; margin-bottom: 4px;">Category:</div>
          <div style="padding-left: 4px;">
            <div style="background: #0a246a; color: #fff; padding: 2px 4px; font-weight: bold; margin-bottom: 2px;">Session</div>
            <div style="padding: 2px 8px; color: #444;">Logging</div>
            <div style="font-weight: bold; margin-top: 4px; color: #222;">Terminal</div>
            <div style="padding: 2px 8px; color: #444;">Keyboard</div>
            <div style="padding: 2px 8px; color: #444;">Bell</div>
            <div style="font-weight: bold; margin-top: 4px; color: #222;">Window</div>
            <div style="padding: 2px 8px; color: #444;">Appearance</div>
            <div style="padding: 2px 8px; color: #444;">Colours</div>
            <div style="font-weight: bold; margin-top: 4px; color: #222;">Connection</div>
            <div style="padding: 2px 8px; color: #444;">Data</div>
            <div style="padding: 2px 8px; color: #444;">Proxy</div>
            <div style="padding: 2px 8px; color: #444;">Telnet</div>
            <div style="padding: 2px 8px; color: #444;">SSH</div>
            <div style="padding: 2px 8px; color: #0a246a; font-weight: bold;">Serial (Console)</div>
          </div>
        </div>

        <!-- Right Configuration Panel -->
        <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
          <!-- Destination Box -->
          <fieldset style="border: 1px solid #7f9db9; padding: 8px 12px; border-radius: 4px; background: #fff;">
            <legend style="padding: 0 4px; font-weight: bold; color: #0a246a;">Specify the destination you want to connect to</legend>

            <!-- Network Destination Fields -->
            <div id="puttyNetFields" style="${defaultConn === 'serial' ? 'display:none;' : ''}">
              <div style="display: flex; gap: 10px; margin-bottom: 8px;">
                <div style="flex: 1;">
                  <label style="display: block; margin-bottom: 2px;">Host Name (or IP address):</label>
                  <input type="text" id="puttyHostInput" value="${defaultHost}" placeholder="192.168.1.1" style="width: 100%; padding: 3px 5px; border: 1px solid #7f9db9; box-sizing: border-box; font-size: 11px;">
                </div>
                <div style="width: 70px;">
                  <label style="display: block; margin-bottom: 2px;">Port:</label>
                  <input type="text" id="puttyPortInput" value="22" style="width: 100%; padding: 3px 5px; border: 1px solid #7f9db9; box-sizing: border-box; font-size: 11px;">
                </div>
              </div>
            </div>

            <!-- Serial Line Fields -->
            <div id="puttySerialFields" style="${defaultConn === 'serial' ? '' : 'display:none;'}">
              <div style="display: flex; gap: 10px; margin-bottom: 8px;">
                <div style="flex: 1;">
                  <label style="display: block; margin-bottom: 2px;">Serial line (Console Port):</label>
                  <input type="text" id="puttySerialLineInput" value="COM1" style="width: 100%; padding: 3px 5px; border: 1px solid #7f9db9; box-sizing: border-box; font-size: 11px;">
                </div>
                <div style="width: 80px;">
                  <label style="display: block; margin-bottom: 2px;">Speed (baud):</label>
                  <input type="text" id="puttySpeedInput" value="9600" style="width: 100%; padding: 3px 5px; border: 1px solid #7f9db9; box-sizing: border-box; font-size: 11px;">
                </div>
              </div>
              <div style="font-size: 10px; color: ${consoleConn ? '#166534' : '#b91c1c'}; background: ${consoleConn ? '#dcfce7' : '#fee2e2'}; padding: 4px 6px; border-radius: 3px;">
                ${consoleConn ? `🔌 <strong>Console kabel actief:</strong> verbonden met <strong>${consoleConn.targetDevice.hostname}</strong> (${consoleConn.targetPort})` : `⚠️ <strong>Geen consolekabel:</strong> verbind een Console Kabel op het werkveld naar een router/switch.`}
              </div>
            </div>

            <!-- Connection Type Radio Buttons -->
            <div style="margin-top: 8px;">
              <span style="margin-right: 8px;">Connection type:</span>
              <label style="margin-right: 8px;"><input type="radio" name="puttyConnType" value="ssh" ${defaultConn === 'ssh' ? 'checked' : ''} onchange="document.getElementById('puttyNetFields').style.display='block'; document.getElementById('puttySerialFields').style.display='none'; document.getElementById('puttyPortInput').value='22';"> SSH</label>
              <label style="margin-right: 8px;"><input type="radio" name="puttyConnType" value="serial" ${defaultConn === 'serial' ? 'checked' : ''} onchange="document.getElementById('puttyNetFields').style.display='none'; document.getElementById('puttySerialFields').style.display='block';"> Serial (COM1)</label>
              <label style="margin-right: 8px;"><input type="radio" name="puttyConnType" value="telnet" onchange="document.getElementById('puttyNetFields').style.display='block'; document.getElementById('puttySerialFields').style.display='none'; document.getElementById('puttyPortInput').value='23';"> Telnet</label>
              <label><input type="radio" name="puttyConnType" value="raw" onchange="document.getElementById('puttyNetFields').style.display='block'; document.getElementById('puttySerialFields').style.display='none';"> Raw</label>
            </div>
          </fieldset>

          <!-- Saved Sessions Box -->
          <fieldset style="border: 1px solid #7f9db9; padding: 8px 12px; border-radius: 4px; background: #fff; flex: 1;">
            <legend style="padding: 0 4px; font-weight: bold; color: #0a246a;">Load, save or delete a stored session</legend>
            <div style="display: flex; gap: 8px; margin-bottom: 6px;">
              <input type="text" id="puttySessionName" value="Default Settings" style="flex: 1; padding: 3px 5px; border: 1px solid #7f9db9; font-size: 11px;">
              <button style="padding: 2px 8px; border: 1px solid #7f9db9; background: #ece9d8; cursor: pointer;">Save</button>
              <button style="padding: 2px 8px; border: 1px solid #7f9db9; background: #ece9d8; cursor: pointer;">Delete</button>
            </div>
            <select size="5" style="width: 100%; border: 1px solid #7f9db9; font-size: 11px; padding: 2px;">
              <option selected>Default Settings</option>
              <option>Console COM1 (Rollover Kabel)</option>
              <option>Cisco Router SSH (192.168.1.1)</option>
              <option>HPE Aruba Switch (192.168.1.10)</option>
              <option>MikroTik RouterOS (192.168.88.1)</option>
            </select>
          </fieldset>

          <!-- Buttons Bar -->
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
            <button style="padding: 5px 20px; font-weight: bold; background: #0a246a; color: #fff; border: 1px solid #000; border-radius: 3px; cursor: pointer;" onclick="openActivePuttyTerminal('${devId}')">Open</button>
            <button style="padding: 5px 16px; background: #ece9d8; border: 1px solid #7f9db9; border-radius: 3px; cursor: pointer;" onclick="window.PXLApp.openPcApp('cmd')">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Active PuTTY Terminal View Container (Hidden initially) -->
    <div id="puttyTerminalView" style="display: none; width: 100%; max-width: 780px; margin: 0 auto; box-shadow: 0 8px 30px rgba(0,0,0,0.5);">
      <div style="background: #000080; color: #fff; padding: 4px 8px; display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-family: 'Segoe UI', Tahoma, sans-serif; font-weight: bold; border-top-left-radius: 6px; border-top-right-radius: 6px;">
        <span id="puttyTerminalTitle">COM1 - PuTTY</span>
        <button style="background: #ece9d8; border: 1px solid #333; color: #000; padding: 1px 6px; font-size: 10px; cursor: pointer;" onclick="document.getElementById('puttyMainWindow').style.display='block'; document.getElementById('puttyTerminalView').style.display='none';">Disconnect</button>
      </div>
      <div style="background: #000000; color: #ffffff; font-family: 'Consolas', 'Lucida Console', monospace; font-size: 13px; height: 360px; overflow-y: auto; padding: 10px; line-height: 1.4; box-sizing: border-box;" id="puttyScreenArea"></div>
      <div style="background: #000000; border-top: 1px solid #222; padding: 4px 10px; display: flex; align-items: center;">
        <span style="color: #22c55e; font-family: monospace; font-size: 13px; margin-right: 6px;" id="puttyPromptSpan">&gt; </span>
        <input type="text" id="puttyTerminalInput" style="flex: 1; background: transparent; border: none; color: #ffffff; font-family: 'Consolas', 'Lucida Console', monospace; font-size: 13px; outline: none;" autocomplete="off" spellcheck="false">
      </div>
    </div>
  `;
}

/**
 * Handles the [Open] button click in PuTTY
 */
function openActivePuttyTerminal(devId) {
  const sim = window.PXLNetworkSim;
  const dev = sim ? sim.devices[devId] : null;
  if (!dev) return;

  const connType = document.querySelector('input[name="puttyConnType"]:checked')?.value || 'ssh';
  const mainWin = document.getElementById('puttyMainWindow');
  const termView = document.getElementById('puttyTerminalView');
  const termTitle = document.getElementById('puttyTerminalTitle');
  const screen = document.getElementById('puttyScreenArea');
  const input = document.getElementById('puttyTerminalInput');
  const promptEl = document.getElementById('puttyPromptSpan');

  if (!mainWin || !termView || !screen || !input) return;

  // 1. SERIAL CONNECTION OVER CONSOLE CABLE
  if (connType === 'serial') {
    const consoleConn = sim.getConsoleConnection(devId);
    if (!consoleConn) {
      alert(`PuTTY Fatal Error\n\nUnable to open connection to COM1:\nUnable to open serial port.\n\nGeen consolekabel aangesloten tussen ${dev.hostname} en een netwerkapparaat.\nVerbind een blauwe 'Console Kabel' op het werkveld tussen de RS-232 / USB poort van deze PC en de Console-poort van de switch of router.`);
      return;
    }

    const targetDev = consoleConn.targetDevice;
    mainWin.style.display = 'none';
    termView.style.display = 'block';
    termTitle.innerText = `${targetDev.hostname} (COM1 - 9600 baud) - PuTTY`;
    screen.innerHTML = `Connected to COM1 (9600, 8, N, 1) over Rollover Console Cable.\nTarget device: ${targetDev.hostname} [${targetDev.type.toUpperCase()}]\n\n`;

    let parser = null;
    const print = (t) => {
      screen.innerHTML += `${t}\n`;
      screen.scrollTop = screen.scrollHeight;
    };
    const updatePrompt = (p) => {
      if (promptEl) promptEl.innerText = p;
    };

    if (targetDev.type === 'hpe_switch') {
      parser = new HpeCLIParser(targetDev, print, updatePrompt, () => window.PXLApp.triggerScoreUpdate());
    } else if (targetDev.type === 'mikrotik') {
      parser = new MikroTikCLIParser(targetDev, print, updatePrompt, () => window.PXLApp.triggerScoreUpdate());
    } else if (targetDev.type === 'openwrt') {
      parser = new OpenWrtCLIParser(targetDev, print, updatePrompt, () => window.PXLApp.triggerScoreUpdate());
    } else {
      // Cisco Switch / Router
      parser = new CiscoCLIParser(targetDev, print, updatePrompt, () => window.PXLApp.triggerScoreUpdate());
    }

    const initialPrompt = targetDev.getPrompt ? targetDev.getPrompt() : '> ';
    updatePrompt(initialPrompt);
    input.value = '';
    input.focus();

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const val = input.value;
        screen.innerHTML += `${promptEl.innerText}${val}\n`;
        input.value = '';
        parser.handleCommand(val);
        screen.scrollTop = screen.scrollHeight;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (parser && typeof parser.tabComplete === 'function') {
          const comp = parser.tabComplete(input.value);
          if (comp && comp !== input.value) {
            input.value = comp;
            input.selectionStart = input.selectionEnd = comp.length;
          }
        }
      } else if (e.key === '?' && input.value.trim() === '') {
        e.preventDefault();
        parser.handleCommand('?');
      }
    };
    return;
  }

  // 2. SSH / TELNET NETWORK CONNECTION
  const targetHost = document.getElementById('puttyHostInput')?.value.trim() || '192.168.1.1';
  const ping = sim.executePing(devId, targetHost);
  if (!ping.success) {
    alert(`PuTTY Fatal Error\n\nNetwork error: Connection timed out\nCould not reach host ${targetHost} on port 22/23.`);
    return;
  }

  const dst = sim.findDeviceByIp(targetHost);
  if (!dst) {
    alert(`PuTTY Fatal Error\n\nNetwork error: Connection refused by ${targetHost}`);
    return;
  }

  const targetDev = dst.device;
  mainWin.style.display = 'none';
  termView.style.display = 'block';
  termTitle.innerText = `${targetDev.hostname} (${targetHost}) - PuTTY`;

  if (connType === 'telnet') {
    screen.innerHTML = `Trying ${targetHost}...\nConnected to ${targetHost}.\nEscape character is '^]'.\n\n`;
  } else {
    screen.innerHTML = `login as: admin\nAuthenticating with public key "pxl-key" or password...\nConnected to ${targetDev.hostname} over SSH v2.\n\n`;
  }

  let parser = null;
  const print = (t) => {
    screen.innerHTML += `${t}\n`;
    screen.scrollTop = screen.scrollHeight;
  };
  const updatePrompt = (p) => {
    if (promptEl) promptEl.innerText = p;
  };

  if (targetDev.type === 'hpe_switch') {
    parser = new HpeCLIParser(targetDev, print, updatePrompt, () => window.PXLApp.triggerScoreUpdate());
  } else if (targetDev.type === 'mikrotik') {
    parser = new MikroTikCLIParser(targetDev, print, updatePrompt, () => window.PXLApp.triggerScoreUpdate());
  } else if (targetDev.type === 'openwrt') {
    parser = new OpenWrtCLIParser(targetDev, print, updatePrompt, () => window.PXLApp.triggerScoreUpdate());
  } else {
    parser = new CiscoCLIParser(targetDev, print, updatePrompt, () => window.PXLApp.triggerScoreUpdate());
  }

  updatePrompt(targetDev.getPrompt ? targetDev.getPrompt() : '> ');
  input.value = '';
  input.focus();

  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const val = input.value;
      screen.innerHTML += `${promptEl.innerText}${val}\n`;
      input.value = '';
      if (val.toLowerCase() === 'exit' || val.toLowerCase() === 'quit') {
        screen.innerHTML += `\n[Connection closed by foreign host]\n`;
        setTimeout(() => {
          mainWin.style.display = 'block';
          termView.style.display = 'none';
        }, 1000);
        return;
      }
      parser.handleCommand(val);
      screen.scrollTop = screen.scrollHeight;
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (parser && typeof parser.tabComplete === 'function') {
        const comp = parser.tabComplete(input.value);
        if (comp && comp !== input.value) {
          input.value = comp;
          input.selectionStart = input.selectionEnd = comp.length;
        }
      }
    }
  };
}

if (typeof window !== 'undefined') {
  window.renderPuttyConfigHtml = renderPuttyConfigHtml;
  window.openActivePuttyTerminal = openActivePuttyTerminal;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderPuttyConfigHtml, openActivePuttyTerminal };
}
