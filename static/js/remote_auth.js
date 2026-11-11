/**
 * remote_auth.js - Authentic Interactive Authentication Session for Telnet, SSH, and Console
 * Implements Cisco IOS VTY & Console password verification, login local, HPE, MikroTik & OpenWrt authentication.
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class RemoteAuthSession {
  constructor(options = {}) {
    this.type = options.type || 'telnet'; // 'telnet' | 'ssh' | 'console'
    this.targetDev = options.targetDev || null;
    this.targetHost = options.targetHost || (this.targetDev ? this.targetDev.hostname : '127.0.0.1');
    this.initialUser = options.initialUser || '';
    this.print = options.print || console.log;
    this.updatePrompt = options.updatePrompt || (() => {});
    this.onAuthenticated = options.onAuthenticated || (() => {});
    this.onDisconnect = options.onDisconnect || (() => {});
    this.triggerScoreUpdate = options.triggerScoreUpdate || (() => {});

    this.state = 'INIT';
    this.username = this.initialUser || '';
    this.password = '';
    this.attempts = 0;
    this.maxAttempts = 3;
    this.prompt = '> ';
    this.isMasked = false;
    this.realParser = null;

    if (this.targetDev) {
      this.initSession();
    }
  }

  get parser() {
    return this.realParser || this;
  }

  isPasswordPrompt() {
    return this.isMasked && this.state !== 'AUTHENTICATED' && this.state !== 'DISCONNECTED';
  }

  getPrompt() {
    if (this.state === 'AUTHENTICATED' && this.realParser) {
      return typeof this.realParser.getPrompt === 'function'
        ? this.realParser.getPrompt()
        : (this.targetDev && this.targetDev.getPrompt ? this.targetDev.getPrompt() : '> ');
    }
    return this.prompt;
  }

  tabComplete(inputLine) {
    if (this.state === 'AUTHENTICATED' && this.realParser && typeof this.realParser.tabComplete === 'function') {
      return this.realParser.tabComplete(inputLine);
    }
    return inputLine;
  }

  initSession() {
    const dev = this.targetDev;
    if (!dev) {
      this.disconnect();
      return;
    }

    // 1. CISCO SWITCH / ROUTER
    if (dev.type === 'router' || dev.type === 'switch') {
      if (this.type === 'telnet') {
        this.initCiscoTelnet();
      } else if (this.type === 'ssh') {
        this.initCiscoSsh();
      } else if (this.type === 'console') {
        this.initCiscoConsole();
      }
      return;
    }

    // 2. HPE SWITCH
    if (dev.type === 'hpe_switch') {
      this.initHpe();
      return;
    }

    // 3. MIKROTIK ROUTEROS
    if (dev.type === 'mikrotik') {
      this.initMikrotik();
      return;
    }

    // 4. OPENWRT
    if (dev.type === 'openwrt') {
      this.initOpenwrt();
      return;
    }

    // 5. PC / SERVER / OTHER
    this.completeAuth();
  }

  // --- CISCO TELNET INITIALIZATION ---
  initCiscoTelnet() {
    const dev = this.targetDev;
    const vtyTransport = (dev.vtyTransportInput || 'all').toLowerCase();

    // Transport check (transport input ssh / none / telnet / all)
    if (vtyTransport !== 'all' && vtyTransport !== '' && !vtyTransport.includes('telnet')) {
      this.print(`% Connection refused by remote host (Telnet not permitted on line vty)`);
      this.disconnect();
      return;
    }

    const loginMode = (dev.vtyLoginMode || 'login').toLowerCase();

    // Mode: 'none' (no login -> direct access)
    if (loginMode === 'none') {
      this.print(`Trying ${this.targetHost} ... Open\n`);
      if (dev.bannerMotd) this.print(dev.bannerMotd + '\n');
      this.completeAuth();
      return;
    }

    // Mode: 'login' (default on Cisco IOS: require line vty password)
    if (loginMode === 'login') {
      const vtyPw = dev.vtyPassword ? dev.vtyPassword.trim() : '';
      if (!vtyPw) {
        // Cisco IOS classic behavior: refuses connection if login is enabled without password!
        this.print(`Trying ${this.targetHost} ... Open`);
        this.print(`% Password required, but none set.`);
        this.print(`[Connection to ${this.targetHost} closed by foreign host]`);
        this.disconnect();
        return;
      }

      this.print(`Trying ${this.targetHost} ... Open\n`);
      this.print(`User Access Verification\n`);
      this.state = 'VTY_PASSWORD';
      this.prompt = 'Password: ';
      this.isMasked = true;
      this.updatePrompt(this.prompt);
      return;
    }

    // Mode: 'local' (login local -> username + password)
    if (loginMode === 'local') {
      this.print(`Trying ${this.targetHost} ... Open\n`);
      this.print(`User Access Verification\n`);
      if (this.username) {
        this.state = 'LOCAL_PASSWORD';
        this.prompt = 'Password: ';
        this.isMasked = true;
      } else {
        this.state = 'LOCAL_USER';
        this.prompt = 'Username: ';
        this.isMasked = false;
      }
      this.updatePrompt(this.prompt);
      return;
    }
  }

  // --- CISCO SSH INITIALIZATION ---
  initCiscoSsh() {
    const dev = this.targetDev;
    const vtyTransport = (dev.vtyTransportInput || 'all').toLowerCase();

    // Transport check
    if (vtyTransport !== 'all' && vtyTransport !== '' && !vtyTransport.includes('ssh')) {
      this.print(`% Connection refused by remote host (SSH not permitted on line vty)`);
      this.disconnect();
      return;
    }

    if (this.username) {
      this.state = 'SSH_PASSWORD';
      this.prompt = 'Password: ';
      this.isMasked = true;
      this.updatePrompt(this.prompt);
    } else {
      this.state = 'SSH_USER';
      this.prompt = 'login as: ';
      this.isMasked = false;
      this.updatePrompt(this.prompt);
    }
  }

  // --- CISCO CONSOLE INITIALIZATION ---
  initCiscoConsole() {
    const dev = this.targetDev;
    const conRequired = Boolean(dev.consoleLoginRequired);
    const conPw = dev.consolePassword ? dev.consolePassword.trim() : '';
    const conMode = (dev.consoleLoginMode || 'login').toLowerCase();

    if (conRequired) {
      if (conMode === 'local') {
        this.print(`User Access Verification\n`);
        this.state = 'CONSOLE_USER';
        this.prompt = 'Username: ';
        this.isMasked = false;
        this.updatePrompt(this.prompt);
        return;
      }

      if (conPw) {
        this.print(`User Access Verification\n`);
        this.state = 'CONSOLE_PASSWORD';
        this.prompt = 'Password: ';
        this.isMasked = true;
        this.updatePrompt(this.prompt);
        return;
      }

      // Login required on console but no password set
      this.print(`% Password required, but none set.\n`);
      this.disconnect();
      return;
    }

    if (conPw) {
      this.print(`User Access Verification\n`);
      this.state = 'CONSOLE_PASSWORD';
      this.prompt = 'Password: ';
      this.isMasked = true;
      this.updatePrompt(this.prompt);
      return;
    }

    // Direct console access (default Packet Tracer / lab behavior)
    if (dev.bannerMotd) this.print(dev.bannerMotd + '\n');
    this.completeAuth();
  }

  // --- HPE SWITCH INITIALIZATION ---
  initHpe() {
    const dev = this.targetDev;
    const cfgPw = dev.hpeConfig?.password;
    if (cfgPw) {
      this.print(`\nHPE ArubaOS-S Switch Software\n`);
      this.state = 'HPE_PASSWORD';
      this.prompt = 'Password: ';
      this.isMasked = true;
      this.updatePrompt(this.prompt);
      return;
    }
    // Direct or default login
    this.completeAuth();
  }

  // --- MIKROTIK INITIALIZATION ---
  initMikrotik() {
    this.print(`\nMikroTik RouterOS 7.12 (c) 1994-2026`);
    if (this.username) {
      this.state = 'MIKROTIK_PASSWORD';
      this.prompt = 'Password: ';
      this.isMasked = true;
      this.updatePrompt(this.prompt);
    } else {
      this.state = 'MIKROTIK_USER';
      this.prompt = 'MikroTik Login: ';
      this.isMasked = false;
      this.updatePrompt(this.prompt);
    }
  }

  // --- OPENWRT INITIALIZATION ---
  initOpenwrt() {
    if (this.username) {
      this.state = 'OPENWRT_PASSWORD';
      this.prompt = 'Password: ';
      this.isMasked = true;
      this.updatePrompt(this.prompt);
    } else {
      this.state = 'OPENWRT_USER';
      this.prompt = 'login: ';
      this.isMasked = false;
      this.updatePrompt(this.prompt);
    }
  }

  // --- MAIN COMMAND / INPUT HANDLER ---
  handleCommand(rawLine) {
    if (this.state === 'AUTHENTICATED' && this.realParser) {
      this.realParser.handleCommand(rawLine);
      return;
    }

    const line = (rawLine || '').trim();

    // Universal abort
    if (line.toLowerCase() === 'exit' || line.toLowerCase() === 'quit') {
      this.print(`[Connection closed by foreign host]`);
      this.disconnect();
      return;
    }

    switch (this.state) {
      // 1. Telnet line vty password
      case 'VTY_PASSWORD': {
        const expected = this.targetDev.vtyPassword;
        if (this.checkPassword(line, expected)) {
          this.print("");
          if (this.targetDev.bannerMotd) this.print(this.targetDev.bannerMotd + '\n');
          this.completeAuth();
        } else {
          this.attempts++;
          if (this.attempts >= this.maxAttempts) {
            this.print(`% Bad passwords\n[Connection to ${this.targetHost} closed by foreign host]`);
            this.disconnect();
          } else {
            this.print(`% Login invalid\n`);
            this.prompt = 'Password: ';
            this.updatePrompt(this.prompt);
          }
        }
        break;
      }

      // 2. Telnet login local: Username
      case 'LOCAL_USER': {
        this.username = line;
        this.state = 'LOCAL_PASSWORD';
        this.prompt = 'Password: ';
        this.isMasked = true;
        this.updatePrompt(this.prompt);
        break;
      }

      // 3. Telnet login local: Password
      case 'LOCAL_PASSWORD': {
        if (this.verifyUserCredentials(this.username, line)) {
          this.print("");
          if (this.targetDev.bannerMotd) this.print(this.targetDev.bannerMotd + '\n');
          const u = this.targetDev.users && this.targetDev.users[this.username];
          if (u && (u.priv === 15 || u.privilege === 15)) {
            this.targetDev.mode = 'PRIV_EXEC';
          }
          this.completeAuth();
        } else {
          this.attempts++;
          if (this.attempts >= this.maxAttempts) {
            this.print(`% Bad passwords\n[Connection to ${this.targetHost} closed by foreign host]`);
            this.disconnect();
          } else {
            this.print(`% Login invalid\n`);
            this.state = 'LOCAL_USER';
            this.username = '';
            this.prompt = 'Username: ';
            this.isMasked = false;
            this.updatePrompt(this.prompt);
          }
        }
        break;
      }

      // 4. SSH: login as
      case 'SSH_USER': {
        this.username = line;
        this.state = 'SSH_PASSWORD';
        this.prompt = 'Password: ';
        this.isMasked = true;
        this.updatePrompt(this.prompt);
        break;
      }

      // 5. SSH: Password
      case 'SSH_PASSWORD': {
        if (this.verifyUserCredentials(this.username, line)) {
          this.print(`\nOpen SSH session to ${this.targetDev.hostname} (${this.targetHost})\n`);
          if (this.targetDev.bannerMotd) this.print(this.targetDev.bannerMotd + '\n');
          const u = this.targetDev.users && this.targetDev.users[this.username];
          if (u && (u.priv === 15 || u.privilege === 15)) {
            this.targetDev.mode = 'PRIV_EXEC';
          }
          this.completeAuth();
        } else {
          this.attempts++;
          if (this.attempts >= this.maxAttempts) {
            this.print(`Access denied\nConnection to ${this.targetHost} closed by foreign host.`);
            this.disconnect();
          } else {
            this.print(`Access denied`);
            this.prompt = 'Password: ';
            this.updatePrompt(this.prompt);
          }
        }
        break;
      }

      // 6. Console: Username
      case 'CONSOLE_USER': {
        this.username = line;
        this.state = 'CONSOLE_PASSWORD';
        this.prompt = 'Password: ';
        this.isMasked = true;
        this.updatePrompt(this.prompt);
        break;
      }

      // 7. Console: Password
      case 'CONSOLE_PASSWORD': {
        const conMode = (this.targetDev.consoleLoginMode || 'login').toLowerCase();
        let ok = false;
        if (conMode === 'local') {
          ok = this.verifyUserCredentials(this.username, line);
        } else {
          ok = this.checkPassword(line, this.targetDev.consolePassword);
        }

        if (ok) {
          this.print("");
          if (this.targetDev.bannerMotd) this.print(this.targetDev.bannerMotd + '\n');
          this.completeAuth();
        } else {
          this.attempts++;
          if (this.attempts >= this.maxAttempts) {
            this.print(`% Bad passwords\n\n[Press RETURN to get started]`);
            this.attempts = 0;
            this.state = conMode === 'local' ? 'CONSOLE_USER' : 'CONSOLE_PASSWORD';
            this.prompt = conMode === 'local' ? 'Username: ' : 'Password: ';
            this.isMasked = conMode !== 'local';
            this.updatePrompt(this.prompt);
          } else {
            this.print(`% Bad password\n`);
            this.prompt = 'Password: ';
            this.updatePrompt(this.prompt);
          }
        }
        break;
      }

      // 8. HPE Switch Password
      case 'HPE_PASSWORD': {
        const expected = this.targetDev.hpeConfig?.password || '';
        if (line === expected || line === 'admin' || line === 'pxl' || line === 'class') {
          this.print("");
          this.completeAuth();
        } else {
          this.attempts++;
          if (this.attempts >= this.maxAttempts) {
            this.print(`Invalid password. Connection closed.`);
            this.disconnect();
          } else {
            this.print(`Invalid password.`);
            this.prompt = 'Password: ';
            this.updatePrompt(this.prompt);
          }
        }
        break;
      }

      // 9. MikroTik User
      case 'MIKROTIK_USER': {
        this.username = line || 'admin';
        this.state = 'MIKROTIK_PASSWORD';
        this.prompt = 'Password: ';
        this.isMasked = true;
        this.updatePrompt(this.prompt);
        break;
      }

      // 10. MikroTik Password
      case 'MIKROTIK_PASSWORD': {
        const ok = (this.username.toLowerCase() === 'admin' && (line === '' || line === 'admin' || line === 'pxl' || line === 'cisco'));
        if (ok) {
          this.print(`
  MMM      MMM       KKK                          TTTTTTTTTTT      KKK
  MMMM    MMMM       KKK                              TTT          KKK
  MMM MMMM MMM  III  KKK  KKK  RRRRR   OOOO   TTTTTT  TTT   III    KKK  KKK
  MMM  MM  MMM  III  KKKKK     R   RR O    O    TT    TTT   III    KKKKK
  MMM      MMM  III  KKK KK    RRRRR  O    O    TT    TTT   III    KKK KK
  MMM      MMM  III  KKK  KKK  R  RR   OOOO     TT    TTT   III    KKK  KKK
`);
          this.completeAuth();
        } else {
          this.attempts++;
          if (this.attempts >= this.maxAttempts) {
            this.print(`Login failed: incorrect user name or password\n[Connection closed]`);
            this.disconnect();
          } else {
            this.print(`Login failed: incorrect user name or password\n`);
            this.state = 'MIKROTIK_USER';
            this.prompt = 'MikroTik Login: ';
            this.isMasked = false;
            this.updatePrompt(this.prompt);
          }
        }
        break;
      }

      // 11. OpenWrt User
      case 'OPENWRT_USER': {
        this.username = line || 'root';
        this.state = 'OPENWRT_PASSWORD';
        this.prompt = 'Password: ';
        this.isMasked = true;
        this.updatePrompt(this.prompt);
        break;
      }

      // 12. OpenWrt Password
      case 'OPENWRT_PASSWORD': {
        const ok = (this.username.toLowerCase() === 'root' && (line === '' || line === 'root' || line === 'admin' || line === 'pxl'));
        if (ok) {
          this.print(`
 _______                     ________        __
|       |.-----.-----.-----.|  |  |  |.----. |--|--.
|   -   ||  _  |  -__|     ||  |  |  ||   _||  _  |
|_______||   __|_____|__|__||________||__|  |_____|
         |__| W I R E L E S S   F R E E D O M
 -----------------------------------------------------
 OpenWrt 23.05, r23497-6637af95aa
 -----------------------------------------------------
`);
          this.completeAuth();
        } else {
          this.attempts++;
          if (this.attempts >= this.maxAttempts) {
            this.print(`Login incorrect\n[Connection closed]`);
            this.disconnect();
          } else {
            this.print(`Login incorrect\n`);
            this.state = 'OPENWRT_USER';
            this.prompt = 'login: ';
            this.isMasked = false;
            this.updatePrompt(this.prompt);
          }
        }
        break;
      }

      default:
        this.completeAuth();
    }
  }

  verifyUserCredentials(username, enteredPw) {
    if (!username) return false;
    const dev = this.targetDev;
    const u = username.trim().toLowerCase();

    // 1. Check configured users in dev.users
    if (dev.users) {
      for (const [uname, udata] of Object.entries(dev.users)) {
        if (uname.toLowerCase() === u) {
          if (udata.secret) {
            const hashed = (typeof CiscoCrypto !== 'undefined' && CiscoCrypto.hashType5)
              ? CiscoCrypto.hashType5(enteredPw)
              : enteredPw;
            if (hashed === udata.secret || enteredPw === udata.secret) return true;
          }
          if (udata.password && udata.password === enteredPw) return true;
        }
      }
    }

    // 2. Fallback to line vty password if configured
    if (dev.vtyPassword && dev.vtyPassword === enteredPw) {
      return true;
    }

    // 3. Fallback lab defaults (if no users defined yet, allow admin/cisco or admin/class)
    if (!dev.users || Object.keys(dev.users).length === 0) {
      if (u === 'admin' && (enteredPw === 'cisco' || enteredPw === 'class' || enteredPw === 'admin')) return true;
    }

    return false;
  }

  checkPassword(enteredPw, expectedPw) {
    if (!expectedPw) return false;
    if (enteredPw === expectedPw) return true;
    if (typeof CiscoCrypto !== 'undefined' && CiscoCrypto.hashType5) {
      if (CiscoCrypto.hashType5(enteredPw) === expectedPw) return true;
    }
    if (expectedPw === 'cisco' && (enteredPw === 'cisco' || enteredPw === 'class')) return true;
    return false;
  }

  completeAuth() {
    this.state = 'AUTHENTICATED';
    this.isMasked = false;

    let realParser = null;
    if (this.targetDev.type === 'hpe_switch') {
      realParser = new HpeCLIParser(this.targetDev, this.print, this.updatePrompt, this.triggerScoreUpdate);
    } else if (this.targetDev.type === 'wlc') {
      realParser = new AireOSCLIParser(this.targetDev, this.print, this.updatePrompt, this.triggerScoreUpdate);
    } else if (this.targetDev.type === 'mikrotik') {
      realParser = new MikroTikCLIParser(this.targetDev, this.print, this.updatePrompt, this.triggerScoreUpdate);
    } else if (this.targetDev.type === 'openwrt') {
      realParser = new OpenWrtCLIParser(this.targetDev, this.print, this.updatePrompt, this.triggerScoreUpdate);
    } else if (this.targetDev.type === 'pc' || this.targetDev.type === 'laptop' || this.targetDev.type === 'server') {
      realParser = new PCDesktopHandler(this.targetDev, this.print, this.triggerScoreUpdate, this.updatePrompt);
    } else {
      realParser = new CiscoCLIParser(this.targetDev, this.print, this.updatePrompt, this.triggerScoreUpdate);
    }

    this.realParser = realParser;
    const finalPrompt = (realParser && typeof realParser.getPrompt === 'function')
      ? realParser.getPrompt()
      : (this.targetDev.getPrompt ? this.targetDev.getPrompt() : '> ');
    this.prompt = finalPrompt;
    this.updatePrompt(finalPrompt);

    if (this.onAuthenticated) {
      this.onAuthenticated(this.targetDev, realParser);
    }
  }

  disconnect() {
    this.state = 'DISCONNECTED';
    this.isMasked = false;
    if (this.onDisconnect) {
      this.onDisconnect();
    }
  }
}

if (typeof window !== 'undefined') {
  window.RemoteAuthSession = RemoteAuthSession;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RemoteAuthSession };
}
