/**
 * python_engine.js - Python 3.12 Interactive REPL & Script Runner for PXL Web NetSim
 * Integrates socket, ipaddress, urllib.request, and network automation simulation
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class PythonEngine {
  constructor(device) {
    this.device = device;
    this.inMultiLine = false;
    this.multiLineBuffer = [];
    this.scope = {
      print: console.log,
      device_ip: device.ip || '0.0.0.0',
      hostname: device.hostname || 'pxl-client'
    };
  }

  evalLine(line, printCallback) {
    const print = printCallback || console.log;
    const trimmed = line.trim();

    if (!trimmed) {
      if (this.inMultiLine) {
        // Execute buffered multi-line block
        const code = this.multiLineBuffer.join('\n');
        this.inMultiLine = false;
        this.multiLineBuffer = [];
        this.executeCode(code, print);
        return;
      }
      return;
    }

    if (trimmed.endsWith(':') || this.inMultiLine) {
      this.inMultiLine = true;
      this.multiLineBuffer.push(line);
      return;
    }

    this.executeCode(line, print);
  }

  executeCode(code, printCallback) {
    const print = printCallback || console.log;
    const sim = window.PXLNetworkSim;
    const dev = this.device;

    try {
      // 1. Check for simulated Python network libraries
      if (code.startsWith('import socket') || code.startsWith('from socket')) {
        print(">>> [Module 'socket' loaded successfully]");
        return;
      }
      if (code.startsWith('import ipaddress') || code.startsWith('from ipaddress')) {
        print(">>> [Module 'ipaddress' loaded successfully]");
        return;
      }
      if (code.startsWith('import urllib') || code.startsWith('from urllib')) {
        print(">>> [Module 'urllib.request' loaded successfully]");
        return;
      }

      // 2. Custom pythonic print wrapper
      const pyPrint = (...args) => {
        print(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
      };

      // 3. Socket simulation helper
      const pySocket = () => ({
        connect: (addrTuple) => {
          const [host, port] = addrTuple;
          const ping = sim ? sim.executePing(dev.id, host) : { success: false };
          if (ping.success) {
            pyPrint(`[Socket Connected] to ${host}:${port} via local interface ${dev.ip}`);
            return true;
          } else {
            throw new Error(`ConnectionRefusedError: [Errno 111] Connection refused to ${host}:${port}`);
          }
        },
        send: (data) => pyPrint(`[Socket TX] sent ${data.length || 0} bytes`),
        recv: (size) => `HTTP/1.1 200 OK\r\nServer: PXL-NetSim\r\n\r\nOK`,
        close: () => pyPrint("[Socket Closed]")
      });

      // 4. IPAddress simulation helper
      const pyIpAddress = {
        IPv4Network: (cidrStr) => {
          let [ip, prefix] = cidrStr.split('/');
          const pfx = parseInt(prefix, 10) || 24;
          const mask = IPUtils ? IPUtils.cidrToMask(pfx) : '255.255.255.0';
          const net = IPUtils ? IPUtils.getNetworkAddress(ip, mask) : ip;
          const totalHosts = Math.pow(2, 32 - pfx);
          return {
            network_address: net,
            netmask: mask,
            num_addresses: totalHosts,
            usable_hosts: Math.max(0, totalHosts - 2),
            prefixlen: pfx,
            hosts: () => [`${net.substring(0, net.lastIndexOf('.'))}.1`, '...', `${net.substring(0, net.lastIndexOf('.'))}.${totalHosts - 2}`]
          };
        },
        IPv4Address: (ipStr) => ({
          exploded: ipStr,
          is_private: ipStr.startsWith('192.168.') || ipStr.startsWith('10.') || ipStr.startsWith('172.16.')
        })
      };

      // 5. urllib.request simulation helper
      const pyUrllib = {
        request: {
          urlopen: (url) => {
            const res = sim ? sim.fetchHttp(dev.id, url) : { success: false, reason: 'No network' };
            if (!res.success) throw new Error(`urllib.error.URLError: <urlopen error ${res.reason}>`);
            return {
              status: 200,
              read: () => ({ decode: () => res.html || '<html>OK</html>' })
            };
          }
        }
      };

      // Evaluate in safe mock sandbox
      const sandboxFn = new Function(
        'print', 'socket', 'ipaddress', 'urllib', 'dev', 'sim',
        `
        const socket_module = { socket: socket, AF_INET: 2, SOCK_STREAM: 1 };
        ${code.replace(/print\(/g, 'print(').replace(/socket\.socket/g, 'socket_module.socket')}
        `
      );

      const result = sandboxFn(pyPrint, pySocket, pyIpAddress, pyUrllib, dev, sim);
      if (result !== undefined) {
        pyPrint(result);
      }
    } catch (err) {
      print(`Traceback (most recent call last):\n  File "<stdin>", line 1, in <module>\n${err.name}: ${err.message}`);
    }
  }

  runScript(scriptText, printCallback) {
    const print = printCallback || console.log;
    print(`===== START: script.py (${this.device.hostname}) =====\n`);
    const lines = scriptText.split('\n');
    let block = '';

    for (const l of lines) {
      if (l.trim().startsWith('#')) continue; // Skip comments
      block += l + '\n';
    }

    this.executeCode(block, print);
    print(`\n===== FINISHED [Exit Code: 0] =====`);
  }
}

// Global exposure
if (typeof window !== 'undefined') {
  window.PythonEngine = PythonEngine;
}

/**
 * HTML UI Generator for Python Script Runner Desktop Application
 */
function renderPythonAppHtml(device) {
  const devId = device.id;
  const devIp = device.ip || '192.168.1.50';

  const defaultScript = `# Python Network Script for ${device.hostname}
import socket
import ipaddress
import urllib

# 1. Subnet Calculator
net = ipaddress.IPv4Network('${devIp}/24')
print(f"Netwerk Adres: {net.network_address}")
print(f"Subnet Mask:   {net.netmask} (/{net.prefixlen})")
print(f"Totaal Hosts:  {net.num_addresses} (Bruikbaar: {net.usable_hosts})")

# 2. Socket Connectivity Test
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect(('192.168.1.1', 80))
    s.send(b'GET / HTTP/1.1\\r\\nHost: gateway\\r\\n\\r\\n')
    response = s.recv(1024)
    print(f"Socket Response: {response}")
    s.close()
except Exception as e:
    print(f"Socket Fout: {e}")
`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #0f172a; color: #f8fafc; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; min-height: 480px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
      <!-- IDE Header -->
      <div style="background: #1e293b; padding: 10px 16px; border-bottom: 2px solid #38bdf8; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">🐍</span>
          <div>
            <div style="font-weight: bold; font-size: 13px; color: #f8fafc;">Python 3.12.3 Network Automation IDE</div>
            <div style="font-size: 11px; color: #94a3b8;">Host: <strong>${device.hostname}</strong> &bull; IP: <strong>${devIp}</strong></div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <select id="pyTemplateSelect" style="background: #0f172a; color: #38bdf8; border: 1px solid #475569; border-radius: 4px; padding: 4px 8px; font-size: 11px;" onchange="
            const val = this.value;
            const ta = document.getElementById('pyScriptEditor');
            if (val === 'socket') {
              ta.value = 'import socket\\n\\ntry:\\n    s = socket.socket()\\n    s.connect((\\'192.168.1.1\\', 80))\\n    print(\\'Verbinding succesvol!\\')\\n    s.close()\\nexcept Exception as e:\\n    print(f\\'Fout: {e}\\')';
            } else if (val === 'subnet') {
              ta.value = 'import ipaddress\\n\\nlan = ipaddress.IPv4Network(\\'172.16.0.0/16\\')\\nprint(f\\'Netwerk: {lan.network_address}\\')\\nprint(f\\'Mask: {lan.netmask}\\')\\nprint(f\\'Aantal adressen: {lan.num_addresses}\\')';
            } else if (val === 'http') {
              ta.value = 'import urllib\\n\\nres = urllib.request.urlopen(\\'http://www.pxl.be\\')\\nprint(f\\'HTTP Status: {res.status}\\')\\nhtml = res.read().decode()\\nprint(html[:200])';
            } else {
              ta.value = document.getElementById('pyOriginalScript').value;
            }
          ">
            <option value="default">📋 Template: Basis Netwerk Script</option>
            <option value="socket">🔌 Template: Socket TCP Ping</option>
            <option value="subnet">📐 Template: IPv4 Subnet Calculator</option>
            <option value="http">🌐 Template: HTTP Web Client (urllib)</option>
          </select>
          <button class="pt-btn pt-btn-primary" style="padding: 5px 14px; font-weight: bold; background: #0284c7;" onclick="
            const code = document.getElementById('pyScriptEditor').value;
            const term = document.getElementById('pyScriptOutput');
            term.innerHTML = '';
            const dev = window.PXLNetworkSim.devices['${devId}'];
            if (dev && window.PythonEngine) {
              const eng = new window.PythonEngine(dev);
              eng.runScript(code, (t) => {
                term.innerHTML += t + '\\n';
                term.scrollTop = term.scrollHeight;
              });
              window.PXLApp.triggerScoreUpdate();
            }
          ">▶ Run Script</button>
        </div>
      </div>

      <!-- Hidden backup for restore -->
      <textarea id="pyOriginalScript" style="display:none;">${defaultScript}</textarea>

      <!-- Code Editor Textarea -->
      <div style="flex: 1; padding: 10px; background: #020617; border-bottom: 1px solid #334155;">
        <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; display: flex; justify-content: space-between;">
          <span>📄 script.py</span>
          <span>Python 3.12.3 (CPython)</span>
        </div>
        <textarea id="pyScriptEditor" style="width: 100%; height: 180px; background: #020617; color: #38bdf8; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; border: 1px solid #334155; border-radius: 4px; padding: 8px; box-sizing: border-box; resize: vertical;" spellcheck="false">${defaultScript}</textarea>
      </div>

      <!-- Output Terminal Window -->
      <div style="background: #090d16; padding: 10px; height: 150px; overflow-y: auto; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; color: #22c55e;" id="pyScriptOutput">
        Klik op <strong>▶ Run Script</strong> om het Python-programma uit te voeren over het gesimuleerde netwerk...
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.PythonEngine = PythonEngine;
  window.renderPythonAppHtml = renderPythonAppHtml;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PythonEngine, renderPythonAppHtml };
}
