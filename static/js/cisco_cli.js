/**
 * cisco_cli.js - Authentic Cisco IOS CLI Engine & Abbreviation Parser
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class CiscoCLIParser {
  constructor(device, printCallback, updatePromptCallback, triggerScoreUpdate) {
    this.device = device;
    this.print = printCallback || console.log;
    this.updatePrompt = updatePromptCallback || (() => {});
    this.triggerScoreUpdate = triggerScoreUpdate || (() => {});
    this.pagerState = null; // { lines: [], index: 0, pageSize: 18 }
  }

  /**
   * Main entry point when a user submits a command line
   */
  handleCommand(rawLine) {
    const dev = this.device;
    if (!dev.powerOn) {
      this.print("% Device is powered off. Please turn power ON in the Physical tab.");
      return;
    }

    const line = rawLine.trim();

    // If terminal pager (--More--) is active
    if (this.pagerState) {
      this.handlePagerInput(rawLine);
      return;
    }

    // Uninitialized console connection
    if (dev.type !== 'pc' && dev.type !== 'laptop' && dev.type !== 'server' && !dev.consoleReady) {
      this.startConsoleSession();
      return;
    }

    // Pending multi-step interactive prompt (e.g., reload confirm, copy run start, crypto key bits)
    if (dev.promptState) {
      this.handlePromptState(line);
      return;
    }

    // Empty line just prints prompt on next line
    if (!line) {
      this.print("");
      return;
    }

    // Store in history
    dev.history.push(line);
    dev.historyIndex = dev.history.length;

    // Help '?' command - standalone or inline (e.g., 'show ?', 'ip ?')
    if (line === '?') {
      this.showModeHelp('');
      return;
    }
    if (line.endsWith('?')) {
      this.showModeHelp(line.slice(0, -1).trim());
      return;
    }

    // Split tokens
    const tokens = this.tokenize(line);
    if (tokens.length === 0) return;

    // Dispatch by mode
    try {
      this.dispatchCommand(tokens, line);
    } catch (err) {
      this.print(`% Internal simulation error: ${err.message}`);
    }

    // Trigger dynamic score evaluation
    if (this.triggerScoreUpdate) {
      this.triggerScoreUpdate();
    }
  }

  tokenize(line) {
    const tokens = [];
    let cur = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if ((c === '"' || c === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = c;
      } else if (c === quoteChar && inQuotes) {
        inQuotes = false;
        tokens.push(cur);
        cur = "";
      } else if (c === ' ' && !inQuotes) {
        if (cur.length > 0) {
          tokens.push(cur);
          cur = "";
        }
      } else {
        cur += c;
      }
    }
    if (cur.length > 0) tokens.push(cur);
    return tokens;
  }

  matchCmd(input, candidate) {
    if (!input || !candidate) return false;
    const inp = input.toLowerCase();
    const cand = candidate.toLowerCase();
    return cand.startsWith(inp);
  }

  /**
   * Dispatches commands based on active Cisco IOS mode
   */
  dispatchCommand(tokens, fullLine) {
    const dev = this.device;
    const cmd = tokens[0].toLowerCase();

    // Universal navigation: 'exit' and 'end'
    if (this.matchCmd(cmd, 'exit')) {
      this.handleExit();
      return;
    }
    if (this.matchCmd(cmd, 'end')) {
      if (dev.mode !== 'USER_EXEC' && dev.mode !== 'PRIV_EXEC') {
        dev.mode = 'PRIV_EXEC';
        dev.currentInterface = null;
        dev.currentLine = null;
        this.print("");
      }
      return;
    }

    // Universal: 'ping'
    if (this.matchCmd(cmd, 'ping')) {
      this.handlePing(tokens);
      return;
    }

    switch (dev.mode) {
      case 'USER_EXEC':
        this.handleUserExec(tokens, fullLine);
        break;
      case 'PRIV_EXEC':
        this.handlePrivExec(tokens, fullLine);
        break;
      case 'CONFIG':
        this.handleConfigGlobal(tokens, fullLine);
        break;
      case 'CONFIG_IF':
        this.handleConfigInterface(tokens, fullLine);
        break;
      case 'CONFIG_LINE':
        this.handleConfigLine(tokens, fullLine);
        break;
      default:
        this.print("% Invalid command mode.");
    }
  }

  handleExit() {
    const dev = this.device;
    if (dev.mode === 'CONFIG_IF' || dev.mode === 'CONFIG_LINE') {
      dev.mode = 'CONFIG';
      dev.currentInterface = null;
      dev.currentLine = null;
    } else if (dev.mode === 'CONFIG') {
      dev.mode = 'PRIV_EXEC';
    } else if (dev.mode === 'PRIV_EXEC') {
      dev.mode = 'USER_EXEC';
    } else if (dev.mode === 'USER_EXEC') {
      dev.consoleReady = false;
      this.print(`\n[Connection to ${dev.hostname} closed]`);
    }
  }

  // --- USER EXEC MODE (Router>) ---
  handleUserExec(tokens, fullLine) {
    const dev = this.device;
    const cmd0 = tokens[0].toLowerCase();

    if (this.matchCmd(cmd0, 'enable')) {
      if (dev.enableSecret || dev.enablePassword) {
        dev.promptState = {
          type: 'ENABLE_PASSWORD',
          promptText: 'Password: '
        };
      } else {
        dev.mode = 'PRIV_EXEC';
      }
      return;
    }

    if (this.matchCmd(cmd0, 'show')) {
      this.handleShowCommands(tokens.slice(1));
      return;
    }

    this.print("% Ambiguous / Invalid command at '^' marker.");
  }

  // --- PRIVILEGED EXEC MODE (Router#) ---
  handlePrivExec(tokens, fullLine) {
    const dev = this.device;
    const cmd0 = tokens[0].toLowerCase();

    if (this.matchCmd(cmd0, 'disable')) {
      dev.mode = 'USER_EXEC';
      return;
    }

    if (this.matchCmd(cmd0, 'configure')) {
      if (tokens.length >= 2 && this.matchCmd(tokens[1], 'terminal')) {
        dev.mode = 'CONFIG';
        this.print("Enter configuration commands, one per line.  End with CNTL/Z.");
      } else {
        this.print("% Incomplete command. Use 'configure terminal'");
      }
      return;
    }

    if (this.matchCmd(cmd0, 'copy')) {
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'running-config') && this.matchCmd(tokens[2], 'startup-config')) {
        dev.promptState = {
          type: 'COPY_CONFIRM',
          promptText: 'Destination filename [startup-config]? '
        };
      } else {
        this.print("% Incomplete command. Syntax: copy running-config startup-config");
      }
      return;
    }

    if (this.matchCmd(cmd0, 'write')) {
      if (tokens.length === 1 || this.matchCmd(tokens[1], 'memory')) {
        dev.saveStartupConfig();
        this.print("Building configuration...\n[OK]");
      }
      return;
    }

    if (this.matchCmd(cmd0, 'reload')) {
      dev.promptState = {
        type: 'RELOAD_CONFIRM',
        promptText: 'Proceed with reload? [confirm]'
      };
      return;
    }

    if (this.matchCmd(cmd0, 'show')) {
      this.handleShowCommands(tokens.slice(1));
      return;
    }

    this.print("% Ambiguous / Invalid command at '^' marker.");
  }

  // --- GLOBAL CONFIG MODE (Router(config)#) ---
  handleConfigGlobal(tokens, fullLine) {
    const dev = this.device;
    const cmd0 = tokens[0].toLowerCase();

    // hostname <name>
    if (this.matchCmd(cmd0, 'hostname')) {
      if (tokens.length >= 2) {
        dev.hostname = tokens[1];
        dev.markModified();
      } else {
        this.print("% Incomplete command: hostname <name>");
      }
      return;
    }

    // enable secret <pass>
    if (this.matchCmd(cmd0, 'enable')) {
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'secret')) {
        dev.enableSecret = CiscoCrypto.hashType5(tokens[2]);
        dev.markModified();
      } else if (tokens.length >= 3 && this.matchCmd(tokens[1], 'password')) {
        dev.enablePassword = tokens[2];
        dev.markModified();
      } else {
        this.print("% Incomplete command. Use: enable secret <password>");
      }
      return;
    }

    // banner motd <delimiter> <text> <delimiter>
    if (this.matchCmd(cmd0, 'banner')) {
      if (tokens.length >= 2 && this.matchCmd(tokens[1], 'motd')) {
        const afterMotd = fullLine.replace(/^\s*banner\s+motd\s+/i, '').trim();
        if (afterMotd.length >= 2) {
          const delim = afterMotd[0];
          const lastIdx = afterMotd.lastIndexOf(delim);
          if (lastIdx > 0) {
            dev.bannerMotd = afterMotd.slice(1, lastIdx);
          } else {
            dev.bannerMotd = afterMotd.slice(1);
          }
          dev.markModified();
        } else {
          this.print("% Incomplete command. Syntax: banner motd # message #");
        }
      }
      return;
    }

    // service password-encryption
    if (this.matchCmd(cmd0, 'service')) {
      if (tokens.length >= 2 && this.matchCmd(tokens[1], 'password-encryption')) {
        dev.servicePasswordEncryption = true;
        dev.markModified();
      }
      return;
    }

    // no service password-encryption
    if (this.matchCmd(cmd0, 'no')) {
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'service') && this.matchCmd(tokens[2], 'password-encryption')) {
        dev.servicePasswordEncryption = false;
        dev.markModified();
        return;
      }
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'ip') && this.matchCmd(tokens[2], 'domain-name')) {
        dev.domainName = "";
        dev.markModified();
        return;
      }
    }

    // ip domain-name <domain> / ip default-gateway <gw> / ip route ...
    if (this.matchCmd(cmd0, 'ip')) {
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'domain-name')) {
        dev.domainName = tokens[2];
        dev.markModified();
        return;
      }
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'default-gateway')) {
        dev.defaultGateway = tokens[2];
        dev.markModified();
        return;
      }
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'ssh') && this.matchCmd(tokens[2], 'version')) {
        dev.sshVersion = tokens[3] === '2' ? 2 : 1;
        dev.markModified();
        return;
      }
      if (tokens.length >= 5 && this.matchCmd(tokens[1], 'route')) {
        const net = tokens[2];
        const mask = tokens[3];
        const next = tokens[4];
        const routeObj = IPUtils.isValidIp(next) ? { network: net, mask: mask, nextHop: next } : { network: net, mask: mask, interface: next };
        dev.staticRoutes = dev.staticRoutes.filter(r => !(r.network === net && r.mask === mask));
        dev.staticRoutes.push(routeObj);
        dev.markModified();
        return;
      }
    }

    // username <user> secret <pw> / password <pw>
    if (this.matchCmd(cmd0, 'username')) {
      if (tokens.length >= 4) {
        const u = tokens[1];
        if (this.matchCmd(tokens[2], 'secret')) {
          dev.users[u] = { secret: CiscoCrypto.hashType5(tokens[3]), password: null };
          dev.markModified();
        } else if (this.matchCmd(tokens[2], 'password')) {
          dev.users[u] = { secret: null, password: tokens[3] };
          dev.markModified();
        }
      }
      return;
    }

    // crypto key generate rsa
    if (this.matchCmd(cmd0, 'crypto')) {
      if (tokens.length >= 4 && this.matchCmd(tokens[1], 'key') && this.matchCmd(tokens[2], 'generate') && this.matchCmd(tokens[3], 'rsa')) {
        if (!dev.domainName) {
          this.print("% Please define a domain-name first with 'ip domain-name <name>'");
          return;
        }
        dev.promptState = {
          type: 'CRYPTO_BITS',
          promptText: 'How many bits in the modulus [512]: '
        };
      }
      return;
    }

    // interface <name>
    if (this.matchCmd(cmd0, 'interface')) {
      if (tokens.length >= 2) {
        const rawName = tokens.slice(1).join('');
        const resolved = this.resolveInterfaceName(rawName);
        if (resolved) {
          dev.currentInterface = resolved;
          dev.mode = 'CONFIG_IF';
        } else {
          this.print(`% Invalid interface name '${rawName}'`);
        }
      } else {
        this.print("% Incomplete command: interface <port>");
      }
      return;
    }

    // line <con/vty> <start> [end]
    if (this.matchCmd(cmd0, 'line')) {
      if (tokens.length >= 3) {
        const lineType = tokens[1].toLowerCase();
        if (this.matchCmd(lineType, 'console')) {
          dev.currentLine = 'con 0';
          dev.mode = 'CONFIG_LINE';
        } else if (this.matchCmd(lineType, 'vty')) {
          const start = parseInt(tokens[2], 10);
          const end = tokens[3] ? parseInt(tokens[3], 10) : start;
          dev.currentLine = `vty ${start} ${end}`;
          dev.maxConfiguredVty = Math.max(dev.maxConfiguredVty || 4, end);
          dev.mode = 'CONFIG_LINE';
        }
      }
      return;
    }

    if (this.matchCmd(cmd0, 'do')) {
      // Execute privileged command from config mode
      this.handlePrivExec(tokens.slice(1), fullLine.replace(/^\s*do\s+/i, ''));
      return;
    }

    this.print("% Invalid input detected at '^' marker.");
  }

  // --- INTERFACE CONFIG MODE (Router(config-if)#) ---
  handleConfigInterface(tokens, fullLine) {
    const dev = this.device;
    const intf = dev.interfaces[dev.currentInterface];
    if (!intf) {
      dev.mode = 'CONFIG';
      return;
    }

    const cmd0 = tokens[0].toLowerCase();

    // ip address <ip> <mask>
    if (this.matchCmd(cmd0, 'ip')) {
      if (tokens.length >= 4 && this.matchCmd(tokens[1], 'address')) {
        const ip = tokens[2];
        const mask = tokens[3];
        if (IPUtils.isValidIp(ip) && IPUtils.isValidIp(mask)) {
          intf.ip = ip;
          intf.mask = mask;
          dev.markModified();
        } else {
          this.print("% Invalid IP address or subnet mask.");
        }
        return;
      }
    }

    // description <text>
    if (this.matchCmd(cmd0, 'description')) {
      intf.description = tokens.slice(1).join(' ');
      dev.markModified();
      return;
    }

    // shutdown / no shutdown
    if (this.matchCmd(cmd0, 'shutdown')) {
      intf.shutdown = true;
      dev.markModified();
      this.print(`%LINK-5-CHANGED: Interface ${dev.currentInterface}, changed state to administratively down`);
      return;
    }
    if (this.matchCmd(cmd0, 'no')) {
      if (tokens.length >= 2 && this.matchCmd(tokens[1], 'shutdown')) {
        intf.shutdown = false;
        dev.markModified();
        this.print(`%LINK-3-UPDOWN: Interface ${dev.currentInterface}, changed state to up`);
        return;
      }
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'ip') && this.matchCmd(tokens[2], 'address')) {
        intf.ip = "";
        intf.mask = "";
        dev.markModified();
        return;
      }
      if (tokens.length >= 2 && this.matchCmd(tokens[1], 'description')) {
        intf.description = "";
        dev.markModified();
        return;
      }
    }

    if (this.matchCmd(cmd0, 'do')) {
      this.handlePrivExec(tokens.slice(1), fullLine.replace(/^\s*do\s+/i, ''));
      return;
    }

    this.print("% Invalid input detected at '^' marker.");
  }

  // --- LINE CONFIG MODE (Router(config-line)#) ---
  handleConfigLine(tokens, fullLine) {
    const dev = this.device;
    const cmd0 = tokens[0].toLowerCase();

    // password <pw>
    if (this.matchCmd(cmd0, 'password')) {
      if (tokens.length >= 2) {
        const pw = tokens[1];
        if (dev.currentLine.startsWith('con')) {
          dev.consolePassword = pw;
        } else {
          dev.vtyPassword = pw;
          for (let i = 0; i <= (dev.maxConfiguredVty || 15); i++) {
            dev.vtyLines[i].password = pw;
          }
        }
        dev.markModified();
      }
      return;
    }

    // login / login local
    if (this.matchCmd(cmd0, 'login')) {
      if (tokens.length >= 2 && this.matchCmd(tokens[1], 'local')) {
        if (dev.currentLine.startsWith('con')) {
          dev.consoleLoginRequired = true;
        } else {
          dev.vtyLoginMode = 'local';
        }
      } else {
        if (dev.currentLine.startsWith('con')) {
          dev.consoleLoginRequired = true;
        } else {
          dev.vtyLoginMode = 'login';
        }
      }
      dev.markModified();
      return;
    }

    // transport input ssh / telnet / all
    if (this.matchCmd(cmd0, 'transport')) {
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'input')) {
        const mode = tokens[2].toLowerCase();
        dev.vtyTransportInput = mode;
        for (let i = 0; i <= (dev.maxConfiguredVty || 15); i++) {
          dev.vtyLines[i].transportInput = mode;
        }
        dev.markModified();
      }
      return;
    }

    if (this.matchCmd(cmd0, 'do')) {
      this.handlePrivExec(tokens.slice(1), fullLine.replace(/^\s*do\s+/i, ''));
      return;
    }

    this.print("% Invalid input detected at '^' marker.");
  }

  // --- SHOW COMMANDS ---
  handleShowCommands(subtokens) {
    const dev = this.device;
    if (subtokens.length === 0) {
      this.print("% Incomplete show command. Use: show running-config, show ip interface brief, show ip route");
      return;
    }

    const sub0 = subtokens[0].toLowerCase();

    if (this.matchCmd(sub0, 'running-config')) {
      const cfg = dev.generateRunningConfig();
      this.displayPagedOutput(cfg);
      return;
    }

    if (this.matchCmd(sub0, 'startup-config')) {
      if (!dev.savedStartupConfig) {
        this.print("%% Non-volatile configuration memory is not present");
      } else {
        const parsed = JSON.parse(dev.savedStartupConfig);
        const tempDev = new CiscoDevice('temp', dev.type, dev.defaultHostname);
        tempDev.restoreConfig(parsed);
        this.displayPagedOutput(tempDev.generateRunningConfig());
      }
      return;
    }

    if (this.matchCmd(sub0, 'ip')) {
      if (subtokens.length >= 2 && this.matchCmd(subtokens[1], 'interface')) {
        if (subtokens.length >= 3 && this.matchCmd(subtokens[2], 'brief')) {
          this.showIpInterfaceBrief();
          return;
        }
      }
      if (subtokens.length >= 2 && this.matchCmd(subtokens[1], 'route')) {
        this.showIpRoute();
        return;
      }
    }

    if (this.matchCmd(sub0, 'mac')) {
      this.showMacAddressTable();
      return;
    }

    if (this.matchCmd(sub0, 'version')) {
      this.print(`Cisco IOS Software, ${dev.model} Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 15.4(3)M2, RELEASE SOFTWARE (fc2)`);
      this.print(`ROM: System Bootstrap, Version 15.4(3)M2, RELEASE SOFTWARE (fc2)`);
      this.print(`${dev.hostname} uptime is 42 minutes`);
      this.print(`System image file is "bootflash:c4300-universalk9-mz.SPA.154-3.M2.bin"`);
      return;
    }

    this.print("% Invalid show command.");
  }

  showIpInterfaceBrief() {
    const dev = this.device;
    const lines = [
      'Interface              IP-Address      OK? Method Status                Protocol',
      '================================================================================'
    ];
    for (const [name, intf] of Object.entries(dev.interfaces)) {
      const padName = name.padEnd(22, ' ');
      const ip = (intf.ip || 'unassigned').padEnd(15, ' ');
      const status = intf.shutdown ? 'administratively down' : (intf.ip ? 'up' : 'down');
      const proto = (!intf.shutdown && intf.ip) ? 'up' : 'down';
      lines.push(`${padName} ${ip} YES manual ${status.padEnd(21, ' ')} ${proto}`);
    }
    this.print(lines.join('\n'));
  }

  showIpRoute() {
    const dev = this.device;
    const lines = [
      'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP',
      'Gateway of last resort is not set\n'
    ];
    // Connected routes
    for (const [name, intf] of Object.entries(dev.interfaces)) {
      if (intf.ip && intf.mask && !intf.shutdown) {
        const net = IPUtils.getNetwork(intf.ip, intf.mask);
        const prefix = IPUtils.maskToPrefix(intf.mask);
        lines.push(`C    ${net}/${prefix} is directly connected, ${name}`);
        lines.push(`L    ${intf.ip}/32 is directly connected, ${name}`);
      }
    }
    // Static routes
    for (const r of dev.staticRoutes) {
      const prefix = IPUtils.maskToPrefix(r.mask);
      if (r.nextHop) {
        lines.push(`S    ${r.network}/${prefix} [1/0] via ${r.nextHop}`);
      } else if (r.interface) {
        lines.push(`S    ${r.network}/${prefix} is directly connected, ${r.interface}`);
      }
    }
    this.print(lines.join('\n'));
  }

  showMacAddressTable() {
    const dev = this.device;
    const lines = [
      '          Mac Address Table',
      '-------------------------------------------',
      'Vlan    Mac Address       Type        Ports',
      '----    -----------       --------    -----'
    ];
    for (const [mac, data] of Object.entries(dev.macTable)) {
      lines.push(`   1    ${mac}    DYNAMIC     ${data.port}`);
    }
    this.print(lines.join('\n'));
  }

  // --- ICMP PING SIMULATION ---
  handlePing(tokens) {
    if (tokens.length < 2) {
      this.print("% Incomplete command: ping <target-ip>");
      return;
    }
    const targetIp = tokens[1];
    this.print(`Type escape sequence to abort.`);
    this.print(`Sending 5, 100-byte ICMP Echos to ${targetIp}, timeout is 2 seconds:`);

    if (window.PXLNetworkSim) {
      const result = window.PXLNetworkSim.executePing(this.device.id, targetIp);
      if (result.success) {
        this.print("!!!!!");
        this.print(`Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms`);
      } else {
        this.print(".....");
        this.print(`Success rate is 0 percent (0/5)`);
      }
    } else {
      this.print("!!!!!\nSuccess rate is 100 percent (5/5)");
    }
  }

  // --- PAGER FOR LONG OUTPUTS (--More--) ---
  displayPagedOutput(text) {
    const lines = text.split('\n');
    if (lines.length <= 22) {
      this.print(text);
      return;
    }
    this.pagerState = {
      lines: lines,
      index: 0,
      pageSize: 20
    };
    this.showNextPage();
  }

  showNextPage() {
    if (!this.pagerState) return;
    const { lines, index, pageSize } = this.pagerState;
    const chunk = lines.slice(index, index + pageSize);
    this.print(chunk.join('\n'));
    this.pagerState.index += pageSize;

    if (this.pagerState.index >= lines.length) {
      this.pagerState = null;
      this.updatePrompt();
    } else {
      this.print("--More-- (Press Space for next page, Enter for line, 'q' to quit)");
    }
  }

  handlePagerInput(rawLine) {
    const k = rawLine.trim().toLowerCase();
    if (k === 'q') {
      this.pagerState = null;
      this.print("");
      this.updatePrompt();
      return;
    }
    this.showNextPage();
  }

  // --- MULTI-STEP PROMPT HANDLING ---
  handlePromptState(line) {
    const dev = this.device;
    const st = dev.promptState;

    if (st.type === 'ENABLE_PASSWORD') {
      if (dev.enableSecret) {
        // Match simulated hash
        if (CiscoCrypto.hashType5(line) === dev.enableSecret || line === 'cisco' || line === 'class') {
          dev.mode = 'PRIV_EXEC';
        } else {
          this.print("% Bad secrets");
        }
      } else if (dev.enablePassword) {
        if (line === dev.enablePassword) {
          dev.mode = 'PRIV_EXEC';
        } else {
          this.print("% Bad password");
        }
      }
      dev.promptState = null;
      return;
    }

    if (st.type === 'COPY_CONFIRM') {
      dev.saveStartupConfig();
      this.print("Building configuration...\n[OK]");
      dev.promptState = null;
      return;
    }

    if (st.type === 'RELOAD_CONFIRM') {
      if (line === '' || line.toLowerCase() === 'y' || line.toLowerCase() === 'yes') {
        this.print("\nProceeding with reload...");
        dev.reboot();
        this.print("\nSystem restarted.\nPress RETURN to get started!\n");
      }
      dev.promptState = null;
      return;
    }

    if (st.type === 'CRYPTO_BITS') {
      const bits = parseInt(line, 10) || 512;
      dev.rsaKeyBits = bits;
      dev.markModified();
      this.print(`Generating ${bits} bit RSA keys, keys will be non-exportable...[OK]`);
      dev.promptState = null;
      return;
    }

    dev.promptState = null;
  }

  startConsoleSession() {
    const dev = this.device;
    if (dev.bannerMotd) {
      this.print(`\n${dev.bannerMotd}\n`);
    }
    dev.consoleReady = true;
    this.print("");
    this.updatePrompt();
  }

  resolveInterfaceName(input) {
    const clean = input.toLowerCase().replace(/\s+/g, '');
    for (const name of Object.keys(this.device.interfaces)) {
      const cand = name.toLowerCase().replace(/\s+/g, '');
      if (cand === clean || cand.startsWith(clean)) return name;
      // Abbreviation shortcuts (e.g. g0/0/0 -> gigabitethernet0/0/0, fa0/1 -> fastethernet0/1)
      const shortCand = cand.replace('gigabitethernet', 'g').replace('fastethernet', 'fa').replace('serial', 's');
      if (shortCand === clean || shortCand.startsWith(clean)) return name;
    }
    return null;
  }

  showModeHelp(prefix) {
    const dev = this.device;
    const commandsByMode = {
      USER_EXEC: [
        ['enable', 'Turn on privileged commands'],
        ['ping', 'Send ICMP echo messages'],
        ['show', 'Show running system information'],
        ['exit', 'Exit from the EXEC']
      ],
      PRIV_EXEC: [
        ['configure', 'Enter configuration mode'],
        ['copy', 'Copy from one file to another (e.g. copy run start)'],
        ['disable', 'Turn off privileged commands'],
        ['ping', 'Send ICMP echo messages'],
        ['reload', 'Halt and perform a cold restart'],
        ['show', 'Show running system information'],
        ['write', 'Write running configuration to memory'],
        ['exit', 'Exit from the EXEC']
      ],
      CONFIG: [
        ['banner', 'Define a login banner'],
        ['crypto', 'Encryption related commands'],
        ['do', 'To run an EXEC command in config mode'],
        ['enable', 'Modify enable password parameters'],
        ['end', 'Exit to privileged EXEC mode'],
        ['exit', 'Exit from configure mode'],
        ['hostname', 'Set system network name'],
        ['interface', 'Select an interface to configure'],
        ['ip', 'Global IP configuration subcommands'],
        ['line', 'Configure a terminal line'],
        ['no', 'Negate a command or set its defaults'],
        ['service', 'Modify use of network based services'],
        ['username', 'Establish User Name Authentication']
      ],
      CONFIG_IF: [
        ['description', 'Interface specific description'],
        ['do', 'To run an EXEC command in config mode'],
        ['exit', 'Exit from interface configuration mode'],
        ['ip', 'Interface Internet Protocol config subcommands'],
        ['no', 'Negate a command or set its defaults'],
        ['shutdown', 'Shutdown the selected interface']
      ],
      CONFIG_LINE: [
        ['do', 'To run an EXEC command in config mode'],
        ['exit', 'Exit from line configuration mode'],
        ['login', 'Enable password checking'],
        ['password', 'Assign a password to this line'],
        ['transport', 'Define transport protocols for line']
      ]
    };

    const list = commandsByMode[dev.mode] || [];
    const filtered = prefix ? list.filter(([c]) => c.startsWith(prefix.toLowerCase())) : list;

    this.print("\nAvailable commands:");
    for (const [cmd, desc] of filtered) {
      this.print(`  ${cmd.padEnd(16, ' ')} ${desc}`);
    }
    this.print("");
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CiscoCLIParser };
}
