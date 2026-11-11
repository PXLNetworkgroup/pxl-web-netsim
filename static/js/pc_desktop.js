/**
 * pc_desktop.js - PC / Laptop Desktop Environment & Command Prompt
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class PCDesktopHandler {
  constructor(device, printCallback, triggerScoreUpdate, updatePromptCallback) {
    this.device = device;
    this.print = printCallback || console.log;
    this.triggerScoreUpdate = triggerScoreUpdate || (() => {});
    this.updatePrompt = updatePromptCallback || (() => {});
    this.activeSshSession = null;
  }

  get activeRemoteSession() {
    return this.activeSshSession;
  }

  set activeRemoteSession(val) {
    this.activeSshSession = val;
  }

  handleCommand(rawLine) {
    const dev = this.device;
    const line = rawLine.trim();

    // If inside an active SSH session to a remote device (Cisco, MikroTik, OpenWrt, HPE)
    if (this.activeSshSession) {
      if (line.toLowerCase() === 'exit' || line.toLowerCase() === 'quit') {
        const remoteName = this.activeSshSession.targetDev.hostname || 'remote';
        this.print(`[Connection to ${remoteName} closed]`);
        this.activeSshSession = null;
        this.updatePrompt('C:\\Users\\Student> ');
        return;
      }
      this.activeSshSession.parser.handleCommand(rawLine);
      const prompt = this.activeSshSession.targetDev.getPrompt ? this.activeSshSession.targetDev.getPrompt() : '> ';
      this.updatePrompt(prompt);
      if (this.triggerScoreUpdate) this.triggerScoreUpdate();
      return;
    }

    // If inside interactive Python REPL
    if (this.pythonReplActive) {
      if (line === 'exit()' || line === 'quit()' || line === 'exit' || line === 'quit') {
        this.pythonReplActive = false;
        this.print("");
        this.updatePrompt('C:\\Users\\Student> ');
        return;
      }
      if (window.PythonEngine && this.pythonEngine) {
        this.pythonEngine.evalLine(line, this.print);
        this.updatePrompt(this.pythonEngine.inMultiLine ? '... ' : '>>> ');
      }
      return;
    }

    if (!line) {
      this.print("");
      return;
    }

    dev.history.push(line);
    dev.historyIndex = dev.history.length;

    const parts = line.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case 'ipconfig':
        this.handleIpconfig(parts.slice(1));
        break;
      case 'ping':
        this.handlePing(parts.slice(1));
        break;
      case 'tracert':
      case 'traceroute':
        this.handleTracert(parts.slice(1));
        break;
      case 'nslookup':
        this.handleNslookup(parts.slice(1));
        break;
      case 'ssh':
        this.handleSsh(parts.slice(1));
        break;
      case 'telnet':
        this.handleTelnet(parts.slice(1));
        break;
      case 'ftp':
        this.handleFtp(parts.slice(1));
        break;
      case 'python':
      case 'python3':
        this.pythonReplActive = true;
        if (!this.pythonEngine && window.PythonEngine) {
          this.pythonEngine = new window.PythonEngine(this.device);
        }
        this.print("Python 3.12.3 (main, Mar 10 2026, 12:45:10) [MSC v.1938 64 bit (AMD64)] on win32");
        this.print('Type "help", "copyright", "credits" or "license" for more information.');
        this.print("Type 'exit()' or 'quit()' to exit Python.\n");
        this.updatePrompt('>>> ');
        return;
      case 'cls':
      case 'clear':
        if (window.PXLApp) window.PXLApp.clearActiveTerminal();
        break;
      case 'help':
        this.print("Supported commands: ipconfig, ipconfig /all, ping <ip>, tracert <ip>, nslookup <domain>, telnet <ip>, ssh [-l user] <ip>, python, ftp <target>, cls");
        break;
      default:
        this.print(`'${cmd}' is not recognized as an internal or external command.`);
    }

    if (this.triggerScoreUpdate) this.triggerScoreUpdate();
  }

  handleSsh(args) {
    if (args.length === 0) {
      this.print("usage: ssh [-l username] destination-ip (e.g. ssh admin@192.168.88.1 or ssh -l admin 192.168.88.1)");
      return;
    }

    let user = 'admin';
    let targetIp = '';

    if (args[0] === '-l') {
      user = args[1] || 'admin';
      targetIp = args[2] || '';
    } else if (args[0].includes('@')) {
      const parts = args[0].split('@');
      user = parts[0];
      targetIp = parts[1];
    } else {
      targetIp = args[0];
    }

    if (!targetIp) {
      this.print("ssh: missing destination IP address.");
      return;
    }

    const sim = window.PXLNetworkSim;
    if (!sim) {
      this.print("ssh: network simulation engine not loaded.");
      return;
    }

    // Check reachability
    const pingRes = sim.executePing(this.device.id, targetIp);
    if (!pingRes.success) {
      this.print(`ssh: connect to host ${targetIp} port 22: Connection timed out`);
      return;
    }

    const dstInfo = sim.findDeviceByIp(targetIp);
    if (!dstInfo) {
      this.print(`ssh: connect to host ${targetIp} port 22: Connection refused`);
      return;
    }

    const targetDev = dstInfo.device;

    // 1. MikroTik Router SSH
    if (targetDev.type === 'mikrotik') {
      const srv = targetDev.mikrotikConfig?.services?.ssh;
      if (srv && srv.enabled === false) {
        this.print(`ssh: connect to host ${targetIp} port 22: Connection refused (SSH service disabled on MikroTik)`);
        return;
      }
      this.print(`\nMikroTik RouterOS 7.12 (c) 1994-2026`);
      this.print(`Authenticated as '${user}' over secure SSH session.`);
      const parser = new MikroTikCLIParser(
        targetDev,
        this.print,
        () => this.updatePrompt(targetDev.getPrompt()),
        this.triggerScoreUpdate
      );
      this.activeSshSession = { targetDev, parser, user };
      this.updatePrompt(targetDev.getPrompt());
      return;
    }

    // 2. OpenWrt Router SSH
    if (targetDev.type === 'openwrt') {
      this.print(`\nOpenWrt 23.05 (r23630-94290f9e3d) - Dropbear SSH`);
      this.print(`Authenticated as '${user}' on ${targetDev.hostname}.\n`);
      const parser = new OpenWrtCLIParser(
        targetDev,
        this.print,
        () => this.updatePrompt(targetDev.getPrompt()),
        this.triggerScoreUpdate
      );
      this.activeSshSession = { targetDev, parser, user };
      this.updatePrompt(targetDev.getPrompt());
      return;
    }

    // 3. HPE Switch SSH
    if (targetDev.type === 'hpe_switch') {
      this.print(`\nHPE ArubaOS-S Switch Software (c) Copyright 2026 Hewlett Packard Enterprise`);
      this.print(`Authenticated as '${user}' on ${targetDev.hostname}.\n`);
      const parser = new HpeCLIParser(
        targetDev,
        this.print,
        (p) => this.updatePrompt(p),
        this.triggerScoreUpdate
      );
      this.activeSshSession = { targetDev, parser, user };
      this.updatePrompt(parser.getPrompt());
      return;
    }

    // 4. Cisco Switch / Router SSH
    if (targetDev.type === 'router' || targetDev.type === 'switch') {
      const vtyHasSsh = targetDev.vtyTransportInput.includes('ssh') || targetDev.vtyTransportInput === 'all';
      if (!vtyHasSsh && targetDev.vtyTransportInput !== "") {
        this.print(`% Connection refused by remote host (SSH not permitted on line vty)`);
        return;
      }
      this.print(`\nOpen SSH session to ${targetDev.hostname} (${targetIp})`);
      this.print(`User Access Verification - Connected via SSH v2\n`);
      const parser = new CiscoCLIParser(
        targetDev,
        this.print,
        () => this.updatePrompt(targetDev.getPrompt()),
        this.triggerScoreUpdate
      );
      this.activeSshSession = { targetDev, parser, user };
      this.updatePrompt(targetDev.getPrompt());
      return;
    }

    this.print(`ssh: connect to host ${targetIp} port 22: Protocol not supported on this device type`);
  }

  handleTelnet(args) {
    if (args.length === 0) {
      this.print("usage: telnet destination-ip [port]");
      return;
    }

    const targetIp = args[0].trim();
    const port = args[1] ? parseInt(args[1], 10) : 23;
    const sim = window.PXLNetworkSim;
    if (!sim) {
      this.print("telnet: network simulation engine not loaded.");
      return;
    }

    this.print(`Trying ${targetIp}...`);
    const pingRes = sim.executePing(this.device.id, targetIp);
    if (!pingRes.success) {
      this.print(`% Destination host unreachable / Connection timed out to ${targetIp}`);
      return;
    }

    const dstInfo = sim.findDeviceByIp(targetIp);
    if (!dstInfo) {
      this.print(`% Connection refused by ${targetIp}`);
      return;
    }

    const targetDev = dstInfo.device;

    if (targetDev.type === 'router' || targetDev.type === 'switch') {
      const vtyMode = (targetDev.vtyTransportInput || 'all').toLowerCase();
      if (vtyMode !== 'all' && vtyMode !== '' && !vtyMode.includes('telnet')) {
        this.print(`% Connection refused by remote host (Telnet not permitted on line vty)`);
        return;
      }
      this.print(`Connected to ${targetDev.hostname} (${targetIp}).`);
      this.print(`Escape character is '^]'.\n`);

      const parser = new CiscoCLIParser(
        targetDev,
        this.print,
        () => this.updatePrompt(targetDev.getPrompt()),
        this.triggerScoreUpdate
      );
      this.activeSshSession = { targetDev, parser, user: 'telnet' };
      this.updatePrompt(targetDev.getPrompt());
      return;
    }

    if (targetDev.type === 'hpe_switch') {
      this.print(`Connected to ${targetDev.hostname} (${targetIp}) over Telnet.\n`);
      const parser = new HpeCLIParser(
        targetDev,
        this.print,
        (p) => this.updatePrompt(p),
        this.triggerScoreUpdate
      );
      this.activeSshSession = { targetDev, parser, user: 'telnet' };
      this.updatePrompt(parser.getPrompt());
      return;
    }

    if (targetDev.type === 'mikrotik') {
      this.print(`Connected to ${targetDev.hostname} (MikroTik RouterOS 7.12).\n`);
      const parser = new MikroTikCLIParser(
        targetDev,
        this.print,
        () => this.updatePrompt(targetDev.getPrompt()),
        this.triggerScoreUpdate
      );
      this.activeSshSession = { targetDev, parser, user: 'telnet' };
      this.updatePrompt(targetDev.getPrompt());
      return;
    }

    if (targetDev.type === 'openwrt') {
      this.print(`Connected to ${targetDev.hostname} (OpenWrt).\n`);
      const parser = new OpenWrtCLIParser(
        targetDev,
        this.print,
        () => this.updatePrompt(targetDev.getPrompt()),
        this.triggerScoreUpdate
      );
      this.activeSshSession = { targetDev, parser, user: 'telnet' };
      this.updatePrompt(targetDev.getPrompt());
      return;
    }

    this.print(`% Connection to ${targetIp} closed by foreign host (port ${port} not open)`);
  }

  tabComplete(inputLine) {
    if (this.activeSshSession && this.activeSshSession.parser && typeof this.activeSshSession.parser.tabComplete === 'function') {
      return this.activeSshSession.parser.tabComplete(inputLine);
    }
    const pcCommands = ['ipconfig', 'ipconfig /all', 'ping', 'tracert', 'nslookup', 'ssh admin@', 'telnet', 'ftp', 'cls'];
    const match = pcCommands.find(c => c.startsWith(inputLine.trim()));
    if (match) return match + ' ';
    return inputLine;
  }

  handleIpconfig(args) {
    const dev = this.device;
    const isAll = args.includes('/all') || args.includes('-all');

    this.print("\nWindows IP Configuration\n");
    if (isAll) {
      this.print(`   Host Name . . . . . . . . . . . . : ${dev.hostname}`);
      this.print(`   Primary Dns Suffix  . . . . . . . : pxl.be`);
      this.print(`   Node Type . . . . . . . . . . . . : Hybrid`);
      this.print(`   IP Routing Enabled. . . . . . . . : No\n`);
    }

    const intf = dev.interfaces['FastEthernet0'] || dev.interfaces['Wireless0'] || {};
    this.print(`Ethernet adapter ${dev.type === 'laptop' ? 'Wireless Network Connection' : 'Ethernet0'}:`);
    this.print(`   Connection-specific DNS Suffix  . : `);
    if (isAll) {
      this.print(`   Physical Address. . . . . . . . . : ${intf.mac || '0050.7966.6801'}`);
      this.print(`   DHCP Enabled. . . . . . . . . . . : ${dev.dhcpEnabled ? 'Yes' : 'No'}`);
    }
    this.print(`   IPv4 Address. . . . . . . . . . . : ${dev.ip || '0.0.0.0'}`);
    this.print(`   Subnet Mask . . . . . . . . . . . : ${dev.mask || '0.0.0.0'}`);
    this.print(`   Default Gateway . . . . . . . . . : ${dev.gateway || '0.0.0.0'}`);
    if (isAll) {
      this.print(`   DNS Servers . . . . . . . . . . . : ${dev.dns || '0.0.0.0'}`);
    }
    this.print("");
  }

  handleNslookup(args) {
    if (args.length === 0) {
      this.print("Default Server: " + (this.device.dns || "Unknown"));
      this.print("Address: " + (this.device.dns || "0.0.0.0") + "\n");
      return;
    }
    const host = args[0];
    if (!this.device.dns) {
      this.print("*** Can't find server name for address: No response from server");
      this.print(`*** Default servers are not available\nServer:  UnKnown\nAddress:  0.0.0.0\n`);
      return;
    }
    this.print(`Server:  dns.pxl.be`);
    this.print(`Address:  ${this.device.dns}\n`);
    if (window.PXLNetworkSim) {
      const res = window.PXLNetworkSim.resolveDns(this.device.id, host);
      if (res.success) {
        this.print(`Name:    ${host}`);
        this.print(`Address: ${res.ip}\n`);
      } else {
        this.print(`*** dns.pxl.be can't find ${host}: Non-existent domain\n`);
      }
    }
  }

  handleFtp(args) {
    if (args.length === 0) {
      this.print("Usage: ftp [hostname/IP]");
      return;
    }
    const target = args[0];
    this.print(`Connected to ${target}.`);
    if (window.PXLNetworkSim) {
      let targetIp = target;
      if (!IPUtils.isValidIp(target)) {
        const dns = window.PXLNetworkSim.resolveDns(this.device.id, target);
        if (!dns.success) {
          this.print(`% Unknown host: ${target}`);
          return;
        }
        targetIp = dns.ip;
      }
      const ping = window.PXLNetworkSim.executePing(this.device.id, targetIp);
      if (!ping.success) {
        this.print(`ftp: connect: Connection timed out`);
        return;
      }
      const dst = window.PXLNetworkSim.findDeviceByIp(targetIp);
      if (dst && dst.device.services && dst.device.services.ftp && dst.device.services.ftp.enabled) {
        this.print("220 Cisco NetSim FTP Server ready.");
        this.print("230 User logged in (anonymous mode).");
        this.print("ftp> dir");
        this.print("200 PORT command successful.");
        this.print("150 Opening ASCII mode data connection for file list.");
        dst.device.services.ftp.files.forEach(f => {
          this.print(`-rw-r--r--   1 ftp      ftp      ${f.size.padEnd(14, ' ')} ${f.name}`);
        });
        this.print("226 Transfer complete.");
        this.print("221 Goodbye.\n");
        return;
      }
    }
    this.print("ftp: connect: Connection refused\n");
  }

  handlePing(args) {
    if (args.length === 0) {
      this.print("Usage: ping [-t] [-n count] target_name");
      return;
    }
    const target = args[args.length - 1];
    this.print(`\nPinging ${target} with 32 bytes of data:`);

    if (window.PXLNetworkSim) {
      const res = window.PXLNetworkSim.executePing(this.device.id, target);
      if (res.success) {
        for (let i = 0; i < 4; i++) {
          const time = Math.floor(Math.random() * 3) + 1;
          this.print(`Reply from ${target}: bytes=32 time=${time}ms TTL=128`);
        }
        this.print(`\nPing statistics for ${target}:`);
        this.print(`    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),`);
        this.print(`Approximate round trip times in milli-seconds:`);
        this.print(`    Minimum = 1ms, Maximum = 3ms, Average = 2ms\n`);
      } else {
        for (let i = 0; i < 4; i++) {
          this.print("Request timed out.");
        }
        this.print(`\nPing statistics for ${target}:`);
        this.print(`    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),\n`);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        this.print(`Reply from ${target}: bytes=32 time=2ms TTL=128`);
      }
    }
  }

  handleTracert(args) {
    if (args.length === 0) {
      this.print("Usage: tracert target_name");
      return;
    }
    const target = args[0];
    this.print(`\nTracing route to ${target} over a maximum of 30 hops:\n`);
    if (window.PXLNetworkSim) {
      const hops = window.PXLNetworkSim.traceRoute(this.device.id, target);
      if (hops && hops.length > 0) {
        hops.forEach((hop, idx) => {
          this.print(`  ${idx + 1}     1 ms    1 ms    1 ms  ${hop}`);
        });
        this.print("\nTrace complete.\n");
        return;
      }
    }
    this.print(`  1     1 ms    1 ms    1 ms  ${this.device.gateway || target}`);
    this.print("\nTrace complete.\n");
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PCDesktopHandler };
}

