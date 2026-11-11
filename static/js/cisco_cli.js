/**
 * cisco_cli.js - Authentic Cisco IOS CLI Engine, Abbreviation Parser & Inline Help
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class CiscoCLIParser {
  constructor(device, printCallback, updatePromptCallback, triggerScoreUpdate) {
    this.device = device;
    this.print = printCallback || console.log;
    this.updatePrompt = updatePromptCallback || (() => {});
    this.triggerScoreUpdate = triggerScoreUpdate || (() => {});
    this.pagerState = null; // { lines: [], index: 0, pageSize: 20 }
  }

  /**
   * Main entry point when a user submits a command line (pressing Enter)
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

    // Help '?' command submitted via Enter (fallback)
    if (line === '?') {
      this.showModeHelp('');
      return;
    }
    if (line.endsWith('?')) {
      this.handleInlineHelp(line.slice(0, -1));
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
   * Dispatches commands based on active Cisco IOS mode with full abbreviation support
   */
  dispatchCommand(tokens, fullLine) {
    const dev = this.device;
    const cmd0 = tokens[0].toLowerCase();

    // Universal navigation: 'exit', 'quit', 'ex'
    if (cmd0 === 'exit' || cmd0 === 'quit' || cmd0 === 'ex') {
      this.handleExit();
      return;
    }

    // 'end' is valid in ALL configuration modes (Router(config)#, config-if, config-line)
    if (cmd0 === 'end' && dev.mode !== 'USER_EXEC' && dev.mode !== 'PRIV_EXEC') {
      dev.mode = 'PRIV_EXEC';
      dev.currentInterface = null;
      dev.currentLine = null;
      this.print("");
      return;
    }

    // Universal: 'ping' (and 'p')
    if (this.matchCmd(cmd0, 'ping') || cmd0 === 'p') {
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

    // 'enable', 'en', 'ena'
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

    // 'show', 'sh'
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

    // 'enable' / 'en' while already in privileged mode is a no-op
    if (this.matchCmd(cmd0, 'enable')) {
      return;
    }

    // 'disable', 'dis'
    if (this.matchCmd(cmd0, 'disable')) {
      dev.mode = 'USER_EXEC';
      return;
    }

    // 'configure terminal', 'conf t', 'con t', 'config t'
    if (this.matchCmd(cmd0, 'configure') || cmd0 === 'config') {
      if (tokens.length >= 2 && this.matchCmd(tokens[1], 'terminal')) {
        dev.mode = 'CONFIG';
        this.print("Enter configuration commands, one per line.  End with CNTL/Z.");
      } else {
        this.print("% Incomplete command. Use 'configure terminal' or 'conf t'");
      }
      return;
    }

    // 'copy running-config startup-config', 'copy run start', 'cop run start', 'copy r s'
    if (this.matchCmd(cmd0, 'copy') || cmd0 === 'cop') {
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

    // 'write', 'wr', 'write memory', 'wr mem', 'write erase', 'wr er'
    if (this.matchCmd(cmd0, 'write') || cmd0 === 'wr') {
      if (tokens.length === 1 || this.matchCmd(tokens[1], 'memory') || tokens[1].toLowerCase() === 'mem') {
        dev.saveStartupConfig();
        this.print("Building configuration...\n[OK]");
      } else if (tokens.length >= 2 && (this.matchCmd(tokens[1], 'erase') || tokens[1].toLowerCase() === 'er')) {
        dev.promptState = {
          type: 'ERASE_CONFIRM',
          promptText: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]'
        };
      }
      return;
    }

    // 'erase startup-config', 'erase nvram'
    if (this.matchCmd(cmd0, 'erase') || cmd0 === 'er') {
      if (tokens.length >= 2 && (this.matchCmd(tokens[1], 'startup-config') || tokens[1].toLowerCase().startsWith('nvram'))) {
        dev.promptState = {
          type: 'ERASE_CONFIRM',
          promptText: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]'
        };
      } else {
        this.print("% Incomplete command. Syntax: erase startup-config (or write erase)");
      }
      return;
    }

    // 'reload', 'rel'
    if (this.matchCmd(cmd0, 'reload') || cmd0 === 'rel') {
      dev.promptState = {
        type: 'RELOAD_CONFIRM',
        promptText: 'Proceed with reload? [confirm]'
      };
      return;
    }

    // 'show', 'sh'
    if (this.matchCmd(cmd0, 'show') || cmd0 === 'sh') {
      this.handleShowCommands(tokens.slice(1));
      return;
    }

    this.print("% Ambiguous / Invalid command at '^' marker.");
  }

  // --- GLOBAL CONFIG MODE (Router(config)#) ---
  handleConfigGlobal(tokens, fullLine) {
    const dev = this.device;
    const cmd0 = tokens[0].toLowerCase();

    // hostname <name>, host <name>
    if (this.matchCmd(cmd0, 'hostname') || cmd0 === 'host') {
      if (tokens.length >= 2) {
        dev.hostname = tokens[1];
        dev.markModified();
      } else {
        this.print("% Incomplete command: hostname <name>");
      }
      return;
    }

    // enable secret <pass> / enable password <pass> (or en sec <pass>, en pass <pass>)
    if (this.matchCmd(cmd0, 'enable')) {
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'secret')) {
        const pass = tokens.slice(2).filter(t => t !== '5').join(' ');
        dev.enableSecret = (typeof CiscoCrypto !== 'undefined' && CiscoCrypto.hashType5) ? CiscoCrypto.hashType5(pass) : pass;
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

    // banner motd <delimiter> <text> <delimiter> (or ban motd ..., ban mo ...)
    if (this.matchCmd(cmd0, 'banner') || cmd0 === 'ban') {
      if (tokens.length >= 2 && this.matchCmd(tokens[1], 'motd')) {
        // Strip the command prefix robustly
        const afterMotd = fullLine.replace(/^\s*(?:banner|ban)\s+(?:motd|mo)\s+/i, '').trim();
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

    // service password-encryption (or serv pass, service pass)
    if (this.matchCmd(cmd0, 'service') || cmd0 === 'serv') {
      if (tokens.length >= 2 && (this.matchCmd(tokens[1], 'password-encryption') || tokens[1].toLowerCase().startsWith('pass'))) {
        dev.servicePasswordEncryption = true;
        dev.markModified();
      }
      return;
    }

    // Negation commands: no ...
    if (this.matchCmd(cmd0, 'no')) {
      if (tokens.length >= 3 && (this.matchCmd(tokens[1], 'service') || tokens[1].toLowerCase() === 'serv') && (this.matchCmd(tokens[2], 'password-encryption') || tokens[2].toLowerCase().startsWith('pass'))) {
        dev.servicePasswordEncryption = false;
        dev.markModified();
        return;
      }
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'ip') && (this.matchCmd(tokens[2], 'domain-name') || tokens[2].toLowerCase().startsWith('dom'))) {
        dev.domainName = "";
        dev.markModified();
        return;
      }
    }

    // ip domain-name / ip default-gateway / ip route / ip ssh ...
    if (this.matchCmd(cmd0, 'ip')) {
      if (tokens.length >= 3 && (this.matchCmd(tokens[1], 'domain-name') || this.matchCmd(tokens[1], 'domain') || tokens[1].toLowerCase() === 'dom')) {
        dev.domainName = tokens.slice(2).join('');
        dev.markModified();
        return;
      }
      if (tokens.length >= 3 && (this.matchCmd(tokens[1], 'default-gateway') || tokens[1].toLowerCase().startsWith('def'))) {
        dev.defaultGateway = tokens[2];
        dev.markModified();
        return;
      }
      if (tokens.length >= 4 && this.matchCmd(tokens[1], 'ssh') && (this.matchCmd(tokens[2], 'version') || tokens[2].toLowerCase().startsWith('ver'))) {
        dev.sshVersion = tokens[3] === '2' ? 2 : 1;
        dev.markModified();
        return;
      }
      if (tokens.length >= 5 && (this.matchCmd(tokens[1], 'route') || tokens[1].toLowerCase() === 'ro')) {
        const net = tokens[2];
        const mask = tokens[3];
        const next = tokens[4];
        const isIp = (typeof IPUtils !== 'undefined' && IPUtils.isValidIp) ? IPUtils.isValidIp(next) : /^\d+\.\d+\.\d+\.\d+$/.test(next);
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
    if (this.matchCmd(cmd0, 'username') || cmd0 === 'user') {
      if (tokens.length >= 4) {
        const u = tokens[1];
        if (this.matchCmd(tokens[2], 'secret') || tokens[2].toLowerCase() === 'sec') {
          dev.users[u] = {
            secret: (typeof CiscoCrypto !== 'undefined' && CiscoCrypto.hashType5) ? CiscoCrypto.hashType5(tokens[3]) : tokens[3],
            password: null
          };
          dev.markModified();
        } else if (this.matchCmd(tokens[2], 'password') || tokens[2].toLowerCase().startsWith('pass')) {
          dev.users[u] = { secret: null, password: tokens[3] };
          dev.markModified();
        }
      }
      return;
    }

    // crypto key generate rsa (or cry key gen rsa)
    if (this.matchCmd(cmd0, 'crypto') || cmd0 === 'cry') {
      if (tokens.length >= 4 && this.matchCmd(tokens[1], 'key') && (this.matchCmd(tokens[2], 'generate') || tokens[2].toLowerCase().startsWith('gen')) && this.matchCmd(tokens[3], 'rsa')) {
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
    if (this.matchCmd(cmd0, 'interface') || cmd0 === 'int') {
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

    // line console 0 / line vty 0 4 (or line con 0, line vt ...)
    if (this.matchCmd(cmd0, 'line')) {
      if (tokens.length >= 2) {
        const lineType = tokens[1].toLowerCase();
        if (this.matchCmd(lineType, 'console') || lineType === 'con' || lineType === 'con0') {
          dev.currentLine = 'con 0';
          dev.mode = 'CONFIG_LINE';
        } else if (this.matchCmd(lineType, 'vty') || lineType.startsWith('vt')) {
          const start = tokens[2] ? parseInt(tokens[2], 10) : 0;
          const end = tokens[3] ? parseInt(tokens[3], 10) : (tokens[2] ? start : 4);
          dev.currentLine = `vty ${start} ${end}`;
          dev.maxConfiguredVty = Math.max(dev.maxConfiguredVty || 4, end);
          dev.mode = 'CONFIG_LINE';
        }
      }
      return;
    }

    // 'do <command>' executes any privileged EXEC command directly
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
      if (tokens.length >= 4 && (this.matchCmd(tokens[1], 'address') || tokens[1].toLowerCase().startsWith('add'))) {
        const ip = tokens[2];
        const mask = tokens[3];
        const isValid = (typeof IPUtils !== 'undefined' && IPUtils.isValidIp)
          ? (IPUtils.isValidIp(ip) && IPUtils.isValidIp(mask))
          : (/^\d+\.\d+\.\d+\.\d+$/.test(ip) && /^\d+\.\d+\.\d+\.\d+$/.test(mask));

        if (isValid) {
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
    if (this.matchCmd(cmd0, 'description') || cmd0 === 'desc') {
      intf.description = tokens.slice(1).join(' ');
      dev.markModified();
      return;
    }

    // shutdown (or shut, sh)
    if (this.matchCmd(cmd0, 'shutdown') || cmd0 === 'shut' || cmd0 === 'sh') {
      intf.shutdown = true;
      dev.markModified();
      this.print(`%LINK-5-CHANGED: Interface ${dev.currentInterface}, changed state to administratively down`);
      return;
    }

    // no shutdown / no ip address / no description (or no shut, no sh, no ip add, no desc)
    if (this.matchCmd(cmd0, 'no')) {
      if (tokens.length >= 2 && (this.matchCmd(tokens[1], 'shutdown') || tokens[1].toLowerCase() === 'shut' || tokens[1].toLowerCase() === 'sh')) {
        intf.shutdown = false;
        dev.markModified();
        this.print(`%LINK-3-UPDOWN: Interface ${dev.currentInterface}, changed state to up`);
        return;
      }
      if (tokens.length >= 3 && this.matchCmd(tokens[1], 'ip') && (this.matchCmd(tokens[2], 'address') || tokens[2].toLowerCase().startsWith('add'))) {
        intf.ip = "";
        intf.mask = "";
        dev.markModified();
        return;
      }
      if (tokens.length >= 2 && (this.matchCmd(tokens[1], 'description') || tokens[1].toLowerCase() === 'desc')) {
        intf.description = "";
        dev.markModified();
        return;
      }
    }

    // Switchport commands (switchport mode access, switchport access vlan X, switchport mode trunk)
    if (this.matchCmd(cmd0, 'switchport') || cmd0 === 'sw') {
      if (tokens.length >= 3 && (this.matchCmd(tokens[1], 'mode') || tokens[1].toLowerCase() === 'mo')) {
        const mode = tokens[2].toLowerCase();
        intf.switchportMode = mode;
        dev.markModified();
        return;
      }
      if (tokens.length >= 4 && (this.matchCmd(tokens[1], 'access') || tokens[1].toLowerCase() === 'acc') && (this.matchCmd(tokens[2], 'vlan') || tokens[2].toLowerCase() === 'vl')) {
        const vlanId = parseInt(tokens[3], 10);
        intf.vlan = vlanId;
        dev.markModified();
        return;
      }
      return;
    }

    // duplex / speed / clock rate
    if (this.matchCmd(cmd0, 'duplex') || cmd0 === 'dup') {
      if (tokens[1]) { intf.duplex = tokens[1].toLowerCase(); dev.markModified(); }
      return;
    }
    if (this.matchCmd(cmd0, 'speed') || cmd0 === 'sp') {
      if (tokens[1]) { intf.speed = tokens[1].toLowerCase(); dev.markModified(); }
      return;
    }
    if (this.matchCmd(cmd0, 'clock') && tokens.length >= 3 && this.matchCmd(tokens[1], 'rate')) {
      intf.clockRate = tokens[2];
      dev.markModified();
      return;
    }

    // 'do <command>'
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

    // password <pw>, pass <pw>
    if (this.matchCmd(cmd0, 'password') || cmd0 === 'pass') {
      if (tokens.length >= 2) {
        const pw = tokens[1];
        if (dev.currentLine && dev.currentLine.startsWith('con')) {
          dev.consolePassword = pw;
        } else {
          dev.vtyPassword = pw;
          for (let i = 0; i <= (dev.maxConfiguredVty || 15); i++) {
            if (!dev.vtyLines[i]) dev.vtyLines[i] = { password: '', loginMode: 'login', transportInput: '' };
            dev.vtyLines[i].password = pw;
          }
        }
        dev.markModified();
      }
      return;
    }

    // login / login local (or log, log loc)
    if (this.matchCmd(cmd0, 'login') || cmd0 === 'log') {
      if (tokens.length >= 2 && (this.matchCmd(tokens[1], 'local') || tokens[1].toLowerCase() === 'loc')) {
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

    // no login (or no log)
    if (this.matchCmd(cmd0, 'no') && tokens.length >= 2 && (this.matchCmd(tokens[1], 'login') || tokens[1].toLowerCase() === 'log')) {
      if (dev.currentLine && dev.currentLine.startsWith('con')) {
        dev.consoleLoginRequired = false;
      } else {
        dev.vtyLoginMode = 'none';
      }
      dev.markModified();
      return;
    }

    // transport input ssh / telnet / all / none (or trans in ssh)
    if (this.matchCmd(cmd0, 'transport') || cmd0 === 'trans') {
      if (tokens.length >= 3 && (this.matchCmd(tokens[1], 'input') || tokens[1].toLowerCase() === 'in')) {
        const mode = tokens[2].toLowerCase();
        dev.vtyTransportInput = mode;
        for (let i = 0; i <= (dev.maxConfiguredVty || 15); i++) {
          if (!dev.vtyLines[i]) dev.vtyLines[i] = { password: '', loginMode: 'login', transportInput: '' };
          dev.vtyLines[i].transportInput = mode;
        }
        dev.markModified();
      }
      return;
    }

    // 'do <command>'
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

    // show running-config / sh run / sh runn
    if (this.matchCmd(sub0, 'running-config') || sub0 === 'run' || sub0 === 'runn') {
      const cfg = dev.generateRunningConfig();
      this.displayPagedOutput(cfg);
      return;
    }

    // show startup-config / sh start
    if (this.matchCmd(sub0, 'startup-config') || sub0 === 'start') {
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

    // show ip interface brief / show ip route / show ip int
    if (this.matchCmd(sub0, 'ip')) {
      if (subtokens.length >= 2 && (this.matchCmd(subtokens[1], 'interface') || subtokens[1].toLowerCase() === 'int')) {
        if (subtokens.length >= 3 && (this.matchCmd(subtokens[2], 'brief') || subtokens[2].toLowerCase() === 'br')) {
          this.showIpInterfaceBrief();
          return;
        }
        // Default 'show ip int' displays brief or summary
        this.showIpInterfaceBrief();
        return;
      }
      if (subtokens.length >= 2 && (this.matchCmd(subtokens[1], 'route') || subtokens[1].toLowerCase() === 'ro')) {
        this.showIpRoute();
        return;
      }
      this.showIpInterfaceBrief();
      return;
    }

    // show mac-address-table / sh mac / sh mac-
    if (this.matchCmd(sub0, 'mac') || sub0.startsWith('mac')) {
      this.showMacAddressTable();
      return;
    }

    // show vlan brief / sh vlan / sh vl
    if (this.matchCmd(sub0, 'vlan') || sub0 === 'vl') {
      this.showVlanBrief();
      return;
    }

    // show interfaces / sh int
    if (this.matchCmd(sub0, 'interfaces') || sub0 === 'int') {
      this.showInterfaces();
      return;
    }

    // show version / sh ver
    if (this.matchCmd(sub0, 'version') || sub0 === 'ver') {
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
        const net = (typeof IPUtils !== 'undefined' && IPUtils.getNetwork) ? IPUtils.getNetwork(intf.ip, intf.mask) : intf.ip;
        const prefix = (typeof IPUtils !== 'undefined' && IPUtils.maskToPrefix) ? IPUtils.maskToPrefix(intf.mask) : '24';
        lines.push(`C    ${net}/${prefix} is directly connected, ${name}`);
        lines.push(`L    ${intf.ip}/32 is directly connected, ${name}`);
      }
    }
    for (const r of dev.staticRoutes) {
      const prefix = (typeof IPUtils !== 'undefined' && IPUtils.maskToPrefix) ? IPUtils.maskToPrefix(r.mask) : '24';
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

    if (typeof window !== 'undefined' && window.PXLNetworkSim) {
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
        const hashed = (typeof CiscoCrypto !== 'undefined' && CiscoCrypto.hashType5) ? CiscoCrypto.hashType5(line) : line;
        if (hashed === dev.enableSecret || line === 'cisco' || line === 'class') {
          dev.mode = 'PRIV_EXEC';
        } else {
          this.print("% Bad secrets");
        }
      } else if (dev.enablePassword) {
        if (line === dev.enablePassword || line === 'cisco' || line === 'class') {
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
   * Supports: g0/0/0, g0/0, gi0/0, fa0/1, f0/1, se0/1/0, s0/1/0, vlan1, vl1
   */
  resolveInterfaceName(input) {
    if (!input) return null;
    const clean = input.toLowerCase().trim().replace(/\s+/g, '');

    // 1. Exact match in real interfaces
    for (const realName of Object.keys(this.device.interfaces)) {
      if (realName.toLowerCase() === clean) return realName;
    }

    // 2. Parse prefix and number
    const match = clean.match(/^([a-z]+)\s*([0-9\/\.]+)$/);
    if (match) {
      const typePrefix = match[1];
      const portNum = match[2];

      let canonicalPrefix = '';
      if (typePrefix.startsWith('gi') || typePrefix === 'g') {
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

        // Bridge 2-part and 3-part router naming (e.g. g0/0 -> GigabitEthernet0/0/0, g0/1 -> GigabitEthernet0/0/1)
        const parts = portNum.split('/');
        if (parts.length === 2) {
          const c3_1 = `${canonicalPrefix}${parts[0]}/${parts[1]}/0`.toLowerCase();
          const c3_2 = `${canonicalPrefix}0/${parts[0]}/${parts[1]}`.toLowerCase();
          for (const realName of Object.keys(this.device.interfaces)) {
            const rl = realName.toLowerCase();
            if (rl === c3_1 || rl === c3_2) return realName;
          }
        }

        // Prefix match in hardware interfaces
        for (const realName of Object.keys(this.device.interfaces)) {
          if (realName.toLowerCase().startsWith(candidate)) {
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

    // 3. Fallback prefix search
    for (const realName of Object.keys(this.device.interfaces)) {
      if (realName.toLowerCase().startsWith(clean)) return realName;
    }

    return null;
  }

  /**
   * Authentic Cisco IOS Context-Aware Tab Completer
   * Completes the current keyword/word at the cursor based on Cisco grammar and hardware interfaces.
   */
  tabComplete(inputLine) {
    if (!inputLine && inputLine !== "") return "";
    const raw = inputLine;
    const dev = this.device;
    let mode = dev.mode || 'USER_EXEC';

    // If string ends with space, tab does not complete further unless ready
    const hasTrailingSpace = raw.endsWith(' ');
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return raw;

    // Handle 'do' prefix in config modes
    let checkTokens = [...tokens];
    let isDo = false;
    if (checkTokens[0].toLowerCase() === 'do' && (mode === 'CONFIG' || mode === 'CONFIG_IF' || mode === 'CONFIG_LINE')) {
      isDo = true;
      checkTokens = checkTokens.slice(1);
      mode = 'PRIV_EXEC';
      if (checkTokens.length === 0) return raw;
    }

    // Grammar dictionary by mode: command structure tree
    const grammarByMode = {
      USER_EXEC: {
        'enable': null,
        'exit': null,
        'ping': null,
        'show': {
          'interfaces': null,
          'ip': {
            'interface': { 'brief': null }
          },
          'mac-address-table': null,
          'version': null,
          'vlan': { 'brief': null }
        }
      },
      PRIV_EXEC: {
        'configure': { 'terminal': null },
        'copy': { 'running-config': { 'startup-config': null } },
        'disable': null,
        'enable': null,
        'erase': { 'startup-config': null },
        'exit': null,
        'ping': null,
        'reload': null,
        'show': {
          'interfaces': null,
          'ip': {
            'interface': { 'brief': null },
            'route': null
          },
          'mac-address-table': null,
          'running-config': null,
          'startup-config': null,
          'version': null,
          'vlan': { 'brief': null }
        },
        'write': {
          'memory': null,
          'erase': null
        }
      },
      CONFIG: {
        'banner': { 'motd': null },
        'crypto': { 'key': { 'generate': { 'rsa': null } } },
        'enable': {
          'secret': null,
          'password': null
        },
        'end': null,
        'exit': null,
        'hostname': null,
        'interface': '__INTERFACES__',
        'ip': {
          'default-gateway': null,
          'domain-name': null,
          'route': null,
          'ssh': { 'version': null }
        },
        'line': {
          'console': { '0': null },
          'vty': { '0': { '4': null } }
        },
        'no': {
          'ip': { 'domain-name': null },
          'service': { 'password-encryption': null },
          'shutdown': null
        },
        'service': { 'password-encryption': null },
        'username': null
      },
      CONFIG_IF: {
        'description': null,
        'duplex': { 'auto': null, 'full': null, 'half': null },
        'end': null,
        'exit': null,
        'ip': { 'address': null },
        'no': {
          'description': null,
          'ip': { 'address': null },
          'shutdown': null
        },
        'shutdown': null,
        'speed': { 'auto': null, '100': null, '1000': null },
        'switchport': {
          'mode': { 'access': null, 'trunk': null },
          'access': { 'vlan': null }
        }
      },
      CONFIG_LINE: {
        'end': null,
        'exit': null,
        'login': { 'local': null },
        'no': { 'login': null },
        'password': null,
        'transport': {
          'input': { 'all': null, 'none': null, 'ssh': null, 'telnet': null }
        }
      }
    };

    const tree = grammarByMode[mode] || grammarByMode.USER_EXEC;

    // Interface expansion in CONFIG mode: int <partial>
    if (mode === 'CONFIG' && (checkTokens[0].toLowerCase() === 'int' || checkTokens[0].toLowerCase() === 'interface')) {
      if (checkTokens.length === 1 && !hasTrailingSpace) {
        const prefix = isDo ? 'do ' : '';
        return `${prefix}interface `;
      }
      if (checkTokens.length >= 2 || (checkTokens.length === 1 && hasTrailingSpace)) {
        const rawPort = checkTokens.slice(1).join(' ');
        const resolved = this.resolveInterfaceName(rawPort);
        if (resolved) {
          const prefix = isDo ? 'do ' : '';
          return `${prefix}interface ${resolved} `;
        }
      }
    }

    // Traverse the grammar tree to find candidate keywords for the current token
    let currentLevel = tree;
    const completedTokens = [];

    // Traverse already-typed tokens except the last one
    for (let i = 0; i < (hasTrailingSpace ? checkTokens.length : checkTokens.length - 1); i++) {
      const tok = checkTokens[i].toLowerCase();
      if (!currentLevel || typeof currentLevel !== 'object') {
        completedTokens.push(checkTokens[i]);
        continue;
      }

      // Find exact or unique prefix match at this level
      let matchedKey = null;
      for (const key of Object.keys(currentLevel)) {
        if (key.toLowerCase().startsWith(tok)) {
          matchedKey = key;
          break;
        }
      }

      if (matchedKey) {
        completedTokens.push(matchedKey);
        currentLevel = currentLevel[matchedKey];
      } else {
        completedTokens.push(checkTokens[i]);
        currentLevel = null;
      }
    }

    // If currently typing the last token (no trailing space)
    if (!hasTrailingSpace && currentLevel && typeof currentLevel === 'object') {
      const lastTok = checkTokens[checkTokens.length - 1].toLowerCase();
      const keys = Object.keys(currentLevel);
      const matches = keys.filter(k => k.toLowerCase().startsWith(lastTok));

      if (matches.length === 1) {
        completedTokens.push(matches[0]);
        const prefix = isDo ? 'do ' : '';
        let res = prefix + completedTokens.join(' ') + ' ';
        if (res.trim() === 'banner motd') res = 'banner motd # ';
        return res;
      } else if (matches.length > 1) {
        // Complete common prefix among matches
        let common = matches[0];
        for (let i = 1; i < matches.length; i++) {
          while (!matches[i].toLowerCase().startsWith(common.toLowerCase())) {
            common = common.slice(0, -1);
          }
        }
        if (common.length > lastTok.length) {
          completedTokens.push(common);
          const prefix = isDo ? 'do ' : '';
          return prefix + completedTokens.join(' ');
        }
      }
    }

    return raw;
  }

  /**
   * Immediate Inline Help ('?') without needing to press Enter
   * Formatted authentically matching Cisco IOS two-column syntax layout
   */
  handleInlineHelp(currentLine) {
    const dev = this.device;
    let mode = dev.mode || 'USER_EXEC';

    const raw = (currentLine || '').trim();
    const hasTrailingSpace = (currentLine || '').endsWith(' ');

    if (!raw) {
      this.showModeHelp('');
      return;
    }

    const tokens = raw.split(/\s+/).filter(Boolean);
    let checkTokens = [...tokens];
    let isDo = false;
    if (checkTokens[0].toLowerCase() === 'do' && (mode === 'CONFIG' || mode === 'CONFIG_IF' || mode === 'CONFIG_LINE')) {
      isDo = true;
      checkTokens = checkTokens.slice(1);
      mode = 'PRIV_EXEC';
      if (checkTokens.length === 0) {
        this.showModeHelp('');
        return;
      }
    }

    // Subcommand / Argument Help Mapping
    const helpDefinitions = {
      show: [
        ['interfaces', 'Interface status and configuration'],
        ['ip', 'IP information'],
        ['mac-address-table', 'MAC forwarding table'],
        ['running-config', 'Current operating configuration'],
        ['startup-config', 'Contents of startup configuration'],
        ['version', 'System hardware and software status'],
        ['vlan', 'VTP VLAN status']
      ],
      'show ip': [
        ['interface', 'IP interface status and configuration'],
        ['route', 'IP routing table']
      ],
      'show ip interface': [
        ['brief', 'Brief summary of IP status and configuration']
      ],
      'show vlan': [
        ['brief', 'VTP summary of VLANs']
      ],
      configure: [
        ['terminal', 'Configure from the terminal']
      ],
      copy: [
        ['running-config', 'Copy from running configuration']
      ],
      'copy running-config': [
        ['startup-config', 'Copy to startup configuration']
      ],
      write: [
        ['memory', 'Write to NV memory'],
        ['erase', 'Erase NV memory']
      ],
      erase: [
        ['startup-config', 'Erase NVRAM configuration files']
      ],
      interface: [
        ['FastEthernet', 'FastEthernet IEEE 802.3'],
        ['GigabitEthernet', 'GigabitEthernet IEEE 802.3z'],
        ['Serial', 'Serial network interface'],
        ['Vlan', 'Catalyst Vlans']
      ],
      line: [
        ['console', 'Primary terminal line (line con 0)'],
        ['vty', 'Virtual terminal (line vty 0 4)']
      ],
      'line vty': [
        ['<0-15>', 'First Line number']
      ],
      'line console': [
        ['0', 'First Line number']
      ],
      enable: [
        ['password', 'Assign the privileged level password'],
        ['secret', 'Assign the privileged level secret']
      ],
      ip: (mode === 'CONFIG_IF') ? [
        ['address', 'Set the IP address of an interface']
      ] : [
        ['default-gateway', 'Specify default gateway (if not routing IP)'],
        ['domain-name', 'Define the default domain name'],
        ['route', 'Establish static routes'],
        ['ssh', 'Configure SSH options']
      ],
      'ip address': [
        ['A.B.C.D', 'IP address (e.g. 192.168.1.1)']
      ],
      'ip route': [
        ['A.B.C.D', 'Destination prefix network']
      ],
      'ip ssh': [
        ['version', 'Set SSH protocol version (2)']
      ],
      banner: [
        ['motd', 'Set Message of the Day banner (banner motd # msg #)']
      ],
      service: [
        ['password-encryption', 'Encrypt system passwords']
      ],
      crypto: [
        ['key', 'Manage crypto keys']
      ],
      'crypto key': [
        ['generate', 'Generate crypto keys']
      ],
      'crypto key generate': [
        ['rsa', 'Generate RSA key pair']
      ],
      transport: [
        ['input', 'Define protocols to use when connecting to terminal']
      ],
      'transport input': [
        ['all', 'All protocols'],
        ['none', 'No protocols'],
        ['ssh', 'TCP/IP SSH protocol'],
        ['telnet', 'TCP/IP Telnet protocol']
      ],
      login: [
        ['local', 'Local password checking']
      ],
      switchport: [
        ['access', 'Set access mode characteristics'],
        ['mode', 'Set trunk or access mode of the interface']
      ],
      'switchport mode': [
        ['access', 'Set trunking mode to ACCESS unconditionally'],
        ['trunk', 'Set trunking mode to TRUNK unconditionally']
      ],
      no: (mode === 'CONFIG_IF') ? [
        ['description', 'Interface specific description'],
        ['ip', 'Interface IP configuration'],
        ['shutdown', 'Restart an interface (no shutdown)']
      ] : (mode === 'CONFIG_LINE') ? [
        ['login', 'Disable password checking']
      ] : [
        ['ip', 'Negate global IP options'],
        ['service', 'Negate service options'],
        ['shutdown', 'Shutdown command']
      ]
    };

    // If input ends with space, user wants help on the next argument
    if (hasTrailingSpace) {
      const cmdKey = checkTokens.map(t => t.toLowerCase()).join(' ');
      // Try exact or prefix match in helpDefinitions
      for (const [key, items] of Object.entries(helpDefinitions)) {
        if (key.toLowerCase() === cmdKey) {
          this.printHelpList(items);
          return;
        }
      }
      // Check interface IP second argument (mask)
      if (cmdKey.startsWith('ip address ') && checkTokens.length === 3) {
        this.printHelpList([['A.B.C.D', 'IP subnet mask (e.g. 255.255.255.0)']]);
        return;
      }
      if (cmdKey.startsWith('ip route ') && checkTokens.length === 3) {
        this.printHelpList([['A.B.C.D', 'Destination prefix mask']]);
        return;
      }
      if (cmdKey.startsWith('ip route ') && checkTokens.length === 4) {
        this.printHelpList([
          ['A.B.C.D', 'Forwarding router\'s address (Next-hop IP)'],
          ['GigabitEthernet', 'Next-hop interface name']
        ]);
        return;
      }
    } else {
      // User typed a partial command without space (e.g. 'sh?', 'en?', 'conf?')
      if (checkTokens.length === 1) {
        this.showModeHelp(checkTokens[0]);
        return;
      }
      // Partial subcommand (e.g. 'show r?')
      const parentKey = checkTokens.slice(0, -1).map(t => t.toLowerCase()).join(' ');
      const subPrefix = checkTokens[checkTokens.length - 1].toLowerCase();
      for (const [key, items] of Object.entries(helpDefinitions)) {
        if (key.toLowerCase() === parentKey) {
          const filtered = items.filter(([c]) => c.toLowerCase().startsWith(subPrefix));
          this.printHelpList(filtered);
          return;
        }
      }
    }

    // Default fallback
    this.showModeHelp('');
  }

  printHelpList(items) {
    if (!items || items.length === 0) {
      this.print("% Unrecognized command or no help available.");
      return;
    }
    for (const [cmd, desc] of items) {
      this.print(`  ${cmd.padEnd(20, ' ')} ${desc}`);
    }
    this.print("");
  }

  showModeHelp(prefix) {
    const dev = this.device;
    const commandsByMode = {
      USER_EXEC: [
        ['enable', 'Turn on privileged commands (en)'],
        ['exit', 'Exit from the EXEC (ex)'],
        ['ping', 'Send ICMP echo messages (p)'],
        ['show', 'Show running system information (sh)']
      ],
      PRIV_EXEC: [
        ['configure', 'Enter configuration mode (conf t)'],
        ['copy', 'Copy from one file to another (copy run start)'],
        ['disable', 'Turn off privileged commands (dis)'],
        ['enable', 'Turn on privileged commands'],
        ['erase', 'Erase a filesystem (erase startup-config)'],
        ['exit', 'Exit from the EXEC (ex)'],
        ['ping', 'Send ICMP echo messages (p)'],
        ['reload', 'Halt and perform a cold restart (rel)'],
        ['show', 'Show running system information (sh)'],
        ['write', 'Write running configuration to memory (wr)']
      ],
      CONFIG: [
        ['banner', 'Define a login banner (banner motd # msg #)'],
        ['crypto', 'Encryption related commands (crypto key generate rsa)'],
        ['do', 'To run an EXEC command in config mode'],
        ['enable', 'Modify enable password parameters (enable secret <pw>)'],
        ['end', 'Exit to privileged EXEC mode'],
        ['exit', 'Exit from configure mode (ex)'],
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
        ['duplex', 'Configure duplex operational mode'],
        ['end', 'Exit to privileged EXEC mode'],
        ['exit', 'Exit from interface configuration mode (ex)'],
        ['ip', 'Interface IP config (ip address <ip> <mask>)'],
        ['no', 'Negate a command (no shutdown, no ip address)'],
        ['shutdown', 'Shutdown the selected interface (shut / no shut)'],
        ['speed', 'Configure speed operational mode'],
        ['switchport', 'Set switching characteristics of the interface']
      ],
      CONFIG_LINE: [
        ['do', 'To run an EXEC command in config mode'],
        ['end', 'Exit to privileged EXEC mode'],
        ['exit', 'Exit from line configuration mode (ex)'],
        ['login', 'Enable password checking (login / login local)'],
        ['no', 'Negate a command (no login)'],
        ['password', 'Assign a password to this line'],
        ['transport', 'Define transport protocols for line (transport input ssh)']
      ]
    };

    const list = commandsByMode[dev.mode] || commandsByMode.USER_EXEC;
    const filtered = prefix ? list.filter(([c]) => c.toLowerCase().startsWith(prefix.toLowerCase())) : list;

    if (filtered.length === 0) {
      this.print(`% Unrecognized command '${prefix}'. Try '?' without prefix.`);
      return;
    }

    this.print("Exec commands / Available commands:");
    for (const [cmd, desc] of filtered) {
      this.print(`  ${cmd.padEnd(20, ' ')} ${desc}`);
    }
    this.print("");
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CiscoCLIParser };
}
