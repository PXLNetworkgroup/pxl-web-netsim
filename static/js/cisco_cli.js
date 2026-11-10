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

    // Wake up console session if needed
    if (!dev.consoleReady) {
      dev.consoleReady = true;
      if (!line) {
        this.print("");
        this.updatePrompt();
        return;
      }
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
      this.print(`\n[Connection to ${dev.hostname} closed. Press RETURN to re-open]`);
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
        this.print("% Incomplete command. Use 'configure terminal' or 'conf t'");
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
        this.print("% Incomplete command. Syntax: copy running-config startup-config (or copy run start)");
      }
      return;
    }

    if (this.matchCmd(cmd0, 'write')) {
      if (tokens.length === 1 || this.matchCmd(tokens[1], 'memory')) {
        dev.saveStartupConfig();
        this.print("Building configuration...\n[OK]");
      } else if (tokens.length >= 2 && this.matchCmd(tokens[1], 'erase')) {
        dev.promptState = {
          type: 'ERASE_CONFIRM',
          promptText: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]'
        };
      }
      return;
    }

    if (this.matchCmd(cmd0, 'erase')) {
      if (tokens.length >= 2 && (this.matchCmd(tokens[1], 'startup-config') || tokens[1].startsWith('nvram'))) {
        dev.promptState = {
          type: 'ERASE_CONFIRM',
          promptText: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]'
        };
      } else {
        this.print("% Incomplete command. Syntax: erase startup-config (or write erase)");
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

    // enable secret <pass> / enable password <pass>
    if (this.matchCmd(cmd0, 'enable')) {
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'secret')) {
        const pass = tokens.slice(2).filter(t => t !== '5').join(' ');
        dev.enableSecret = CiscoCrypto.hashType5(pass);
        dev.markModified();
      } else if (tokens.length >= 3 && this.matchCmd(tokens[1], 'password')) {
        const pass = tokens.slice(2).filter(t => t !== '7').join(' ');
        dev.enablePassword = pass;
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

    // no service password-encryption / no ip domain-name
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

    // ip domain-name / ip default-gateway / ip route ...
    if (this.matchCmd(cmd0, 'ip')) {
      if (tokens.length >= 3 && (this.matchCmd(tokens[1], 'domain-name') || this.matchCmd(tokens[1], 'domain'))) {
        dev.domainName = tokens.slice(2).join('');
        dev.markModified();
        return;
      }
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'default-gateway')) {
        dev.defaultGateway = tokens[2];
        dev.markModified();
        return;
      }
      if (tokens.length >= 4 && this.matchCmd(tokens[1], 'ssh') && this.matchCmd(tokens[2], 'version')) {
        dev.sshVersion = tokens[3] === '2' ? 2 : 1;
        dev.markModified();
        return;
      }
      if (tokens.length >= 5 && this.matchCmd(tokens[1], 'route')) {
        const net = tokens[2];
        const mask = tokens[3];
        const next = tokens[4];
        const isIp = IPUtils.isValidIp(next);
        const resolvedIntf = !isIp ? this.resolveInterfaceName(next) : null;

        const routeObj = isIp
          ? { network: net, mask: mask, nextHop: next }
          : { network: net, mask: mask, interface: resolvedIntf || next };

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

    // interface <name> (or int <name>)
    if (this.matchCmd(cmd0, 'interface')) {
      if (tokens.length >= 2) {
        const rawName = tokens.slice(1).join(' ');
        const resolved = this.resolveInterfaceName(rawName);
        if (resolved) {
          dev.currentInterface = resolved;
          dev.mode = 'CONFIG_IF';
        } else {
          this.print(`% Invalid interface name '${rawName}'`);
        }
      } else {
        this.print("% Incomplete command: interface <port> (e.g. int g0/0/0 or int fa0/1)");
      }
      return;
    }

    // line console 0 / line vty 0 4
    if (this.matchCmd(cmd0, 'line')) {
      if (tokens.length >= 2) {
        const lineType = tokens[1].toLowerCase();
        if (this.matchCmd(lineType, 'console')) {
          dev.currentLine = 'con 0';
          dev.mode = 'CONFIG_LINE';
        } else if (this.matchCmd(lineType, 'vty')) {
          const start = tokens[2] ? parseInt(tokens[2], 10) : 0;
          const end = tokens[3] ? parseInt(tokens[3], 10) : (tokens[2] ? start : 4);
          dev.currentLine = `vty ${start} ${end}`;
          dev.maxConfiguredVty = Math.max(dev.maxConfiguredVty || 4, end);
          dev.mode = 'CONFIG_LINE';
        }
      }
      return;
    }

    if (this.matchCmd(cmd0, 'do')) {
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

    // ip address <ip> <mask> (or ip add <ip> <mask>)
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

    // description <text> (or desc <text>)
    if (this.matchCmd(cmd0, 'description')) {
      intf.description = tokens.slice(1).join(' ');
      dev.markModified();
      return;
    }

    // shutdown / no shutdown (or shut / no shut / sh / no sh)
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
        if (dev.currentLine && dev.currentLine.startsWith('con')) {
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
        if (dev.currentLine && dev.currentLine.startsWith('con')) {
          dev.consoleLoginRequired = true;
        } else {
          dev.vtyLoginMode = 'local';
        }
      } else {
        if (dev.currentLine && dev.currentLine.startsWith('con')) {
          dev.consoleLoginRequired = true;
        } else {
          dev.vtyLoginMode = 'login';
        }
      }
      dev.markModified();
      return;
    }

    // no login
    if (this.matchCmd(cmd0, 'no') && tokens.length >= 2 && this.matchCmd(tokens[1], 'login')) {
      if (dev.currentLine && dev.currentLine.startsWith('con')) {
        dev.consoleLoginRequired = false;
      } else {
        dev.vtyLoginMode = 'none';
      }
      dev.markModified();
      return;
    }

    // transport input ssh / telnet / all / none
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

    if (this.matchCmd(sub0, 'mac') || sub0.startsWith('mac')) {
      this.showMacAddressTable();
      return;
    }

    if (this.matchCmd(sub0, 'vlan')) {
      this.showVlanBrief();
      return;
    }

    if (this.matchCmd(sub0, 'interfaces') || this.matchCmd(sub0, 'int')) {
      this.showInterfaces();
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

  showVlanBrief() {
    const lines = [
      'VLAN Name                             Status    Ports',
      '---- -------------------------------- --------- -------------------------------',
      '1    default                          active    Fa0/1, Fa0/2, Fa0/3, Fa0/4',
      '                                                Fa0/5, Fa0/6, Fa0/7, Fa0/8',
      '                                                Fa0/9, Fa0/10, Fa0/11, Fa0/12',
      '                                                Fa0/13, Fa0/14, Fa0/15, Fa0/16',
      '                                                Fa0/17, Fa0/18, Fa0/19, Fa0/20',
      '                                                Fa0/21, Fa0/22, Fa0/23, Fa0/24',
      '                                                Gi0/1, Gi0/2',
      '1002 fddi-default                     act/unsup',
      '1003 token-ring-default               act/unsup',
      '1004 fddinet-default                  act/unsup',
      '1005 trnet-default                    act/unsup'
    ];
    this.print(lines.join('\n'));
  }

  showInterfaces() {
    const dev = this.device;
    const lines = [];
    for (const [name, intf] of Object.entries(dev.interfaces)) {
      lines.push(`${name} is ${intf.shutdown ? 'administratively down' : 'up'}, line protocol is ${intf.shutdown ? 'down' : 'up'}`);
      lines.push(`  Hardware is ${dev.model}, address is ${intf.mac || '0000.0000.0000'}`);
      if (intf.ip) {
        lines.push(`  Internet address is ${intf.ip}/${intf.mask || '24'}`);
      }
      lines.push(`  MTU 1500 bytes, BW 100000 Kbit/sec, DLY 100 usec`);
      lines.push('');
    }
    this.print(lines.join('\n'));
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
    for (const [name, intf] of Object.entries(dev.interfaces)) {
      if (intf.ip && intf.mask && !intf.shutdown) {
        const net = IPUtils.getNetwork(intf.ip, intf.mask);
        const prefix = IPUtils.maskToPrefix(intf.mask);
        lines.push(`C    ${net}/${prefix} is directly connected, ${name}`);
        lines.push(`L    ${intf.ip}/32 is directly connected, ${name}`);
      }
    }
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
      this.print("--More-- (Druk op Spatie voor volgende pagina, Enter voor regel, 'q' om te stoppen)");
    }
  }

  handlePagerKey(key) {
    if (!this.pagerState) return false;
    if (key === 'quit' || key === 'q') {
      this.pagerState = null;
      this.print("");
      this.updatePrompt();
      return true;
    }
    if (key === 'enter') {
      const { lines, index } = this.pagerState;
      if (index < lines.length) {
        this.print(lines[index]);
        this.pagerState.index += 1;
        if (this.pagerState.index >= lines.length) {
          this.pagerState = null;
          this.updatePrompt();
        }
      }
      return true;
    }
    if (key === 'space') {
      this.showNextPage();
      return true;
    }
    return false;
  }

  handlePagerInput(rawLine) {
    const k = rawLine.trim().toLowerCase();
    if (k === 'q') {
      this.handlePagerKey('quit');
      return;
    }
    this.handlePagerKey('space');
  }

  // --- MULTI-STEP PROMPT HANDLING ---
  handlePromptState(line) {
    const dev = this.device;
    const st = dev.promptState;

    if (st.type === 'ENABLE_PASSWORD') {
      if (dev.enableSecret) {
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

    if (st.type === 'ERASE_CONFIRM') {
      if (line === '' || line.toLowerCase() === 'y' || line.toLowerCase() === 'yes') {
        dev.savedStartupConfig = null;
        this.print("[OK]\nErase of nvram: complete\n%SYS-7-NV_BLOCK_INIT: Initialized the geometry of nvram");
      }
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

  /**
   * Resolves ANY Cisco interface abbreviation to canonical hardware name
   * Supports: g0/0/0, gi0/0/0, gig0/0/0, fa0/1, f0/1, se0/1/0, s0/1/0, vlan1, vl1
   */
  resolveInterfaceName(input) {
    if (!input) return null;
    const clean = input.toLowerCase().trim().replace(/\s+/g, '');

    // Match prefix + port number (e.g. gi0/0/0 or fa0/1 or se0/1/0 or vl1)
    const match = clean.match(/^([a-z]+)\s*([0-9\/\.]+)$/);
    if (match) {
      const typePrefix = match[1];
      const portNum = match[2];

      let canonicalPrefix = '';
      if (typePrefix.startsWith('gi') || typePrefix.startsWith('g')) {
        canonicalPrefix = 'GigabitEthernet';
      } else if (typePrefix.startsWith('fa') || typePrefix === 'f') {
        canonicalPrefix = 'FastEthernet';
      } else if (typePrefix.startsWith('se') || typePrefix === 's') {
        canonicalPrefix = 'Serial';
      } else if (typePrefix.startsWith('vl')) {
        canonicalPrefix = 'Vlan';
      }

      if (canonicalPrefix) {
        const candidate = `${canonicalPrefix}${portNum}`.toLowerCase();
        for (const realName of Object.keys(this.device.interfaces)) {
          if (realName.toLowerCase() === candidate) {
            return realName;
          }
        }

        // Auto-instantiate SVI Vlan interface on switch/router if requested
        if (canonicalPrefix === 'Vlan' && (this.device.type === 'switch' || this.device.type === 'router')) {
          const genMac = `0019.5e.${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}.${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}`;
          const sviName = `Vlan${portNum}`;
          this.device.interfaces[sviName] = {
            ip: "",
            mask: "",
            shutdown: true,
            description: `${sviName} SVI`,
            mac: genMac
          };
          return sviName;
        }
      }
    }

    // Direct / Prefix search
    for (const realName of Object.keys(this.device.interfaces)) {
      const realClean = realName.toLowerCase();
      if (realClean === clean) return realName;
      if (realClean.startsWith(clean)) return realName;
    }

    return null;
  }

  /**
   * Authentic Cisco IOS Context-Aware Tab Completer
   * Expands abbreviations and command prefixes according to the active CLI mode.
   */
  tabComplete(inputLine) {
    if (!inputLine) return "";
    const raw = inputLine;
    const dev = this.device;
    const mode = dev.mode || 'USER_EXEC';

    const inTokens = raw.trim().split(/\s+/);
    if (inTokens.length === 0 || !inTokens[0]) return raw;

    // 1. Interface completion in CONFIG mode (e.g. 'int fa0/1', 'int vlan 1')
    if (mode === 'CONFIG' && (inTokens[0].toLowerCase() === 'int' || inTokens[0].toLowerCase() === 'interface')) {
      if (inTokens.length >= 2) {
        const rawPort = inTokens.slice(1).join(' ');
        const resolved = this.resolveInterfaceName(rawPort);
        if (resolved) {
          return `interface ${resolved} `;
        }
      }
      return `interface `;
    }

    // 2. Grammar dictionary by active mode
    const modeGrammar = {
      USER_EXEC: [
        'enable',
        'exit',
        'ping',
        'show interfaces',
        'show ip interface brief',
        'show mac-address-table',
        'show version',
        'show vlan brief'
      ],
      PRIV_EXEC: [
        'configure terminal',
        'copy running-config startup-config',
        'disable',
        'erase startup-config',
        'exit',
        'ping',
        'reload',
        'show interfaces',
        'show ip interface brief',
        'show ip route',
        'show mac-address-table',
        'show running-config',
        'show startup-config',
        'show version',
        'show vlan brief',
        'write memory',
        'write erase'
      ],
      CONFIG: [
        'banner motd',
        'crypto key generate rsa',
        'do show ip interface brief',
        'do show running-config',
        'do show startup-config',
        'enable secret',
        'enable password',
        'end',
        'exit',
        'hostname',
        'interface',
        'ip address',
        'ip default-gateway',
        'ip domain-name',
        'ip route',
        'ip ssh version 2',
        'line console 0',
        'line vty 0 4',
        'no service password-encryption',
        'no shutdown',
        'service password-encryption',
        'username'
      ],
      CONFIG_IF: [
        'description',
        'do show ip interface brief',
        'do show running-config',
        'duplex auto',
        'end',
        'exit',
        'ip address',
        'no description',
        'no ip address',
        'no shutdown',
        'shutdown',
        'speed auto'
      ],
      CONFIG_LINE: [
        'do show running-config',
        'end',
        'exit',
        'login',
        'login local',
        'no login',
        'password',
        'transport input all',
        'transport input none',
        'transport input ssh',
        'transport input telnet'
      ]
    };

    const templates = modeGrammar[mode] || modeGrammar.USER_EXEC;

    // Filter templates where each typed token matches the template's token prefix
    const matches = templates.filter(tmpl => {
      const tmplTokens = tmpl.split(/\s+/);
      if (inTokens.length > tmplTokens.length) return false;
      for (let i = 0; i < inTokens.length; i++) {
        if (!tmplTokens[i].toLowerCase().startsWith(inTokens[i].toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    if (matches.length >= 1) {
      const chosenTmpl = matches[0];
      const tmplTokens = chosenTmpl.split(/\s+/);
      const completedTokens = inTokens.map((t, i) => tmplTokens[i]);

      if (matches.length === 1) {
        for (let i = inTokens.length; i < tmplTokens.length; i++) {
          completedTokens.push(tmplTokens[i]);
        }
        let result = completedTokens.join(' ') + ' ';
        if (result.trim() === 'banner motd') {
          result = 'banner motd # ';
        }
        return result;
      } else {
        const shared = [];
        for (let i = 0; i < inTokens.length; i++) {
          const val = tmplTokens[i];
          if (matches.every(m => m.split(/\s+/)[i].toLowerCase() === val.toLowerCase())) {
            shared.push(val);
          } else {
            break;
          }
        }
        if (shared.length === inTokens.length) {
          return shared.join(' ') + ' ';
        }
      }
    }

    return raw;
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
        ['configure', 'Enter configuration mode (conf t)'],
        ['copy', 'Copy from one file to another (copy run start)'],
        ['disable', 'Turn off privileged commands'],
        ['ping', 'Send ICMP echo messages'],
        ['reload', 'Halt and perform a cold restart'],
        ['show', 'Show running system information'],
        ['write', 'Write running configuration to memory (wr)'],
        ['exit', 'Exit from the EXEC']
      ],
      CONFIG: [
        ['banner', 'Define a login banner (banner motd # msg #)'],
        ['crypto', 'Encryption related commands (crypto key generate rsa)'],
        ['do', 'To run an EXEC command in config mode'],
        ['enable', 'Modify enable password parameters (enable secret <pw>)'],
        ['end', 'Exit to privileged EXEC mode'],
        ['exit', 'Exit from configure mode'],
        ['hostname', 'Set system network name (hostname <name>)'],
        ['interface', 'Select an interface to configure (int <port>)'],
        ['ip', 'Global IP configuration subcommands (ip route ...)'],
        ['line', 'Configure a terminal line (line con 0 / line vty 0 4)'],
        ['no', 'Negate a command or set its defaults'],
        ['service', 'Modify use of network based services (service password-encryption)'],
        ['username', 'Establish User Name Authentication']
      ],
      CONFIG_IF: [
        ['description', 'Interface specific description (desc <text>)'],
        ['do', 'To run an EXEC command in config mode'],
        ['exit', 'Exit from interface configuration mode'],
        ['ip', 'Interface IP config (ip address <ip> <mask>)'],
        ['no', 'Negate a command (no shutdown, no ip address)'],
        ['shutdown', 'Shutdown the selected interface (shut / no shut)']
      ],
      CONFIG_LINE: [
        ['do', 'To run an EXEC command in config mode'],
        ['exit', 'Exit from line configuration mode'],
        ['login', 'Enable password checking (login / login local)'],
        ['password', 'Assign a password to this line'],
        ['transport', 'Define transport protocols for line (transport input ssh)']
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
