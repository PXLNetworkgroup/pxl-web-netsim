/**
 * cisco_device.js - Dynamic Data Model for Cisco Routers, Switches, Wireless, and PCs
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class CiscoDevice {
  constructor(id, type, defaultHostname, options = {}) {
    this.id = id;
    this.type = type; // 'router', 'switch', 'pc', 'laptop', 'server', 'wireless_ap'
    this.model = options.model || (type === 'router' ? '4331' : type === 'switch' ? '2960-24TT' : 'Standard');
    this.hostname = defaultHostname || id;
    this.defaultHostname = defaultHostname || id;
    this.displayName = options.displayName || this.hostname;

    // Canvas Position & Power State
    this.x = options.x !== undefined ? options.x : 200;
    this.y = options.y !== undefined ? options.y : 200;
    this.powerOn = options.powerOn !== undefined ? options.powerOn : true;

    // Security & Passwords
    this.enableSecret = null;
    this.enablePassword = null;
    this.servicePasswordEncryption = false;
    this.bannerMotd = "";

    // SSH & User Accounts
    this.domainName = "";
    this.rsaKeyBits = null;
    this.sshVersion = null; // null (1.99) or 2
    this.users = {}; // username -> { secret, password, priv }

    // Line Configuration - consoleReady is TRUE by default like real Packet Tracer
    this.consolePassword = "";
    this.consoleLoginRequired = false;
    this.consoleReady = true;
    this.vtyLines = Array.from({ length: 16 }, () => ({
      password: "",
      loginMode: (this.type === 'pc' || this.type === 'laptop') ? 'none' : 'login',
      transportInput: ""
    }));
    this.maxConfiguredVty = (this.type === 'switch') ? 15 : 4;

    // Compatibility fields for line vty 0
    this.vtyPassword = "";
    this.vtyLoginMode = (this.type === 'pc' || this.type === 'laptop') ? 'none' : 'login';
    this.vtyTransportInput = "";

    // Interfaces: name -> { ip, mask, shutdown, description, speed, duplex, mac, cableId }
    this.interfaces = {};
    this.initDefaultInterfaces(options.interfaces);

    // Routing & Gateway
    this.defaultGateway = options.defaultGateway || "";
    this.staticRoutes = options.staticRoutes ? [...options.staticRoutes] : []; // { network, mask, nextHop, interface }
    this.ipClassless = this.type === 'router';

    // PC / End Device Specific Fields
    this.ip = options.ip || "";
    this.mask = options.mask || "";
    this.gateway = options.gateway || "";
    this.dns = options.dns || "8.8.8.8";
    this.dhcpEnabled = options.dhcpEnabled || false;

    // Wireless Settings (for Laptops, Smartphones, and APs)
    this.wireless = {
      enabled: this.type === 'laptop' || this.type === 'wireless_ap',
      ssid: options.ssid || (this.type === 'wireless_ap' ? 'PXL-Guest' : ''),
      authMode: options.authMode || 'WPA2-PSK', // 'Open', 'WPA2-PSK'
      passphrase: options.passphrase || (this.type === 'wireless_ap' ? 'PXL2026Net!' : ''),
      associatedAp: null,
      channel: options.channel || 6
    };

    // Server Services (HTTP Web Server, DNS Server, FTP Server)
    this.services = options.services ? JSON.parse(JSON.stringify(options.services)) : {
      http: {
        enabled: this.type === 'server',
        port: 80,
        content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PXL NetSim Web Server</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 40px; margin: 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 30px; display: inline-block; max-width: 520px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    h1 { color: #38bdf8; margin-top: 0; font-size: 24px; }
    .badge { background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; display: inline-block; margin-bottom: 15px; }
    p { color: #94a3b8; line-height: 1.6; font-size: 15px; }
    .footer { margin-top: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🌐 HTTP SERVER ACTIVE</div>
    <h1>Hogeschool PXL • NetSim Webserver</h1>
    <p>Welkom op het Cisco Packet Tracer simulatieplatform van Hogeschool PXL!</p>
    <p>De HTTP webdienst en DNS-resolutie functioneren succesvol over het netwerk.</p>
    <div class="footer">Cisco Systems • Integrated Services Architecture (v2.1)</div>
  </div>
</body>
</html>`
      },
      dns: {
        enabled: this.type === 'server',
        records: [
          { name: 'www.pxl.be', type: 'A', ip: '172.16.1.10' },
          { name: 'cisco.pxl', type: 'A', ip: '172.16.1.10' }
        ]
      },
      ftp: {
        enabled: this.type === 'server',
        users: [
          { username: 'cisco', password: 'cisco', permissions: 'RWDNL' },
          { username: 'anonymous', password: '', permissions: 'R' }
        ],
        files: [
          { name: 'c4300-universalk9-mz.SPA.154-3.M2.bin', size: '12402176 bytes' },
          { name: 'pxl-lab-oefening.pka', size: '45020 bytes' },
          { name: 'sample.txt', size: '1024 bytes' }
        ]
      }
    };

    // Layer 2 Dynamic Tables
    this.arpTable = {}; // ip -> { mac, intf, t }
    this.macTable = {}; // mac -> { port, t } (Switches only)

    // Cisco IOS State Machine
    this.mode = 'USER_EXEC'; // 'USER_EXEC', 'PRIV_EXEC', 'CONFIG', 'CONFIG_IF', 'CONFIG_LINE'
    this.currentInterface = null;
    this.currentLine = null;
    this.promptState = null; // null or { type, data, step, promptText }

    // NVRAM & Persistence
    this.savedStartupConfig = null;
    this.isModified = false;
    this.changeCount = 0;

    // Terminal History & Persistent Screen Buffer
    this.history = [];
    this.historyIndex = -1;
    this.terminalBuffer = `Cisco IOS Software, ${this.model} Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 15.4(3)M2\nTechnical Support: http://www.cisco.com/techsupport\nCopyright (c) 1986-2026 by Cisco Systems, Inc.\n\n`;

    // Snapshot factory state for clean reboots
    this.factoryState = this.snapshotConfig();
  }

  /**
   * Initializes hardware ports according to device type and model
   */
  initDefaultInterfaces(customIntfs) {
    const genMac = (prefix) => `${prefix}.${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}.${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}`;

    // 1. Always generate the full hardware interface set first based on device type and model!
    if (this.type === 'router') {
      // Cisco 4331 Router standard ports: Gi0/0/0, Gi0/0/1, Gi0/0/2, Serial0/1/0, Serial0/1/1, Vlan1
      this.interfaces = {
        'GigabitEthernet0/0/0': { ip: "", mask: "", shutdown: true, description: "", speed: 'auto', duplex: 'auto', mac: genMac('00d0.ba') },
        'GigabitEthernet0/0/1': { ip: "", mask: "", shutdown: true, description: "", speed: 'auto', duplex: 'auto', mac: genMac('00d0.ba') },
        'GigabitEthernet0/0/2': { ip: "", mask: "", shutdown: true, description: "", speed: 'auto', duplex: 'auto', mac: genMac('00d0.ba') },
        'Serial0/1/0': { ip: "", mask: "", shutdown: true, description: "", clockRate: '2000000', mac: genMac('00d0.ba') },
        'Serial0/1/1': { ip: "", mask: "", shutdown: true, description: "", clockRate: '2000000', mac: genMac('00d0.ba') },
        'Vlan1': { ip: "", mask: "", shutdown: true, description: "", mac: genMac('00d0.ba') }
      };
    } else if (this.type === 'switch') {
      // Cisco Catalyst 2960-24TT Switch: SVI Vlan1 + 24 Fa ports + 2 Gi ports
      this.interfaces = {
        'Vlan1': { ip: "", mask: "", shutdown: true, description: "", mac: genMac('0019.5e') }
      };
      for (let p = 1; p <= 24; p++) {
        this.interfaces[`FastEthernet0/${p}`] = { ip: "", mask: "", shutdown: false, description: "", vlan: 1, mac: genMac('0019.5e') };
      }
      this.interfaces['GigabitEthernet0/1'] = { ip: "", mask: "", shutdown: false, description: "", vlan: 1, mac: genMac('0019.5e') };
      this.interfaces['GigabitEthernet0/2'] = { ip: "", mask: "", shutdown: false, description: "", vlan: 1, mac: genMac('0019.5e') };
    } else if (this.type === 'pc' || this.type === 'server') {
      this.interfaces = {
        'FastEthernet0': { ip: "", mask: "", shutdown: false, description: "", mac: genMac('0050.79') }
      };
    } else if (this.type === 'laptop') {
      this.interfaces = {
        'FastEthernet0': { ip: "", mask: "", shutdown: false, description: "", mac: genMac('0050.79') },
        'Wireless0': { ip: "", mask: "", shutdown: false, description: "WPC300N Wireless Adapter", mac: genMac('0060.2f') }
      };
    } else if (this.type === 'wireless_ap') {
      this.interfaces = {
        'Internet': { ip: "", mask: "", shutdown: false, description: "WAN/Internet", mac: genMac('0021.d8') },
        'Ethernet1': { ip: "", mask: "", shutdown: false, description: "LAN Port 1", mac: genMac('0021.d8') },
        'Ethernet2': { ip: "", mask: "", shutdown: false, description: "LAN Port 2", mac: genMac('0021.d8') },
        'Wireless0': { ip: "192.168.0.1", mask: "255.255.255.0", shutdown: false, description: "2.4GHz Wireless Radio", mac: genMac('0021.d8') }
      };
    }

    // 2. Overlay any custom interface configurations (excluding null / None keys)
    if (customIntfs && typeof customIntfs === 'object') {
      for (const [k, v] of Object.entries(customIntfs)) {
        if (k && k !== 'null' && k !== 'None' && v && typeof v === 'object') {
          if (!this.interfaces[k]) {
            this.interfaces[k] = { ip: "", mask: "", shutdown: true, description: "", mac: genMac('0019.5e') };
          }
          Object.assign(this.interfaces[k], v);
        }
      }
    }
  }

  getPrompt() {
    if (!this.powerOn) return '[Device is Powered Off]';
    if (this.promptState && this.promptState.promptText) {
      return this.promptState.promptText;
    }

    switch (this.mode) {
      case 'USER_EXEC':
        return `${this.hostname}>`;
      case 'PRIV_EXEC':
        return `${this.hostname}#`;
      case 'CONFIG':
        return `${this.hostname}(config)#`;
      case 'CONFIG_IF':
        return `${this.hostname}(config-if)#`;
      case 'CONFIG_LINE':
        return `${this.hostname}(config-line)#`;
      case 'CONFIG_ROUTER':
        return `${this.hostname}(config-router)#`;
      default:
        return `${this.hostname}>`;
    }
  }

  markModified() {
    this.isModified = true;
    this.changeCount = (this.changeCount || 0) + 1;
  }

  static CONFIG_FIELDS = [
    'hostname', 'displayName', 'enableSecret', 'enablePassword', 'servicePasswordEncryption',
    'bannerMotd', 'domainName', 'rsaKeyBits', 'sshVersion', 'users', 'consolePassword',
    'consoleLoginRequired', 'vtyLines', 'maxConfiguredVty', 'vtyPassword', 'vtyLoginMode',
    'vtyTransportInput', 'interfaces', 'defaultGateway', 'staticRoutes', 'ipClassless',
    'ip', 'mask', 'gateway', 'dns', 'dhcpEnabled', 'wireless', 'services'
  ];

  snapshotConfig() {
    const snap = {};
    for (const f of CiscoDevice.CONFIG_FIELDS) {
      snap[f] = JSON.parse(JSON.stringify(this[f] === undefined ? null : this[f]));
    }
    return snap;
  }

  restoreConfig(snap) {
    if (!snap) return;
    for (const f of CiscoDevice.CONFIG_FIELDS) {
      if (snap[f] !== undefined) {
        this[f] = JSON.parse(JSON.stringify(snap[f]));
      }
    }
    this.mode = 'USER_EXEC';
    this.currentInterface = null;
    this.currentLine = null;
    this.promptState = null;
    this.consoleReady = true;
    this.isModified = false;
  }

  reboot() {
    if (!this.powerOn) return;
    if (this.savedStartupConfig) {
      this.restoreConfig(JSON.parse(this.savedStartupConfig));
    } else {
      this.factoryReset();
      return;
    }
    this.arpTable = {};
    this.macTable = {};
    this.terminalBuffer = `Cisco IOS Software, ${this.model} Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 15.4(3)M2\nTechnical Support: http://www.cisco.com/techsupport\nCopyright (c) 1986-2026 by Cisco Systems, Inc.\n\n`;
  }

  factoryReset() {
    this.savedStartupConfig = null;
    this.hostname = this.defaultHostname;
    this.enableSecret = null;
    this.enablePassword = null;
    this.servicePasswordEncryption = false;
    this.bannerMotd = "";
    this.domainName = "";
    this.rsaKeyBits = null;
    this.sshVersion = null;
    this.users = {};
    this.consolePassword = "";
    this.consoleLoginRequired = false;
    this.vtyPassword = "";
    this.defaultGateway = "";
    this.staticRoutes = [];
    this.arpTable = {};
    this.macTable = {};
    this.mode = 'USER_EXEC';
    this.currentInterface = null;
    this.currentLine = null;
    this.promptState = null;
    this.history = [];
    this.historyIndex = -1;

    // Reinitialize interfaces to clean state
    this.initDefaultInterfaces();

    this.terminalBuffer = `Cisco IOS Software, ${this.model} Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 15.4(3)M2\nTechnical Support: http://www.cisco.com/techsupport\nCopyright (c) 1986-2026 by Cisco Systems, Inc.\n\nPress RETURN to get started!\n\n`;
    this.markModified();
  }

  saveStartupConfig() {
    this.savedStartupConfig = JSON.stringify(this.snapshotConfig());
    this.isModified = false;
  }

  /**
   * Generates genuine Cisco IOS running-config text
   */
  generateRunningConfig() {
    if (this.type === 'pc' || this.type === 'laptop' || this.type === 'server') {
      return `Host Name: ${this.hostname}\nIP Address: ${this.ip || '0.0.0.0'}\nSubnet Mask: ${this.mask || '0.0.0.0'}\nDefault Gateway: ${this.gateway || '0.0.0.0'}\nDNS Server: ${this.dns || '0.0.0.0'}`;
    }

    const lines = [];
    lines.push('Building configuration...');
    lines.push('');
    lines.push('Current configuration : 1842 bytes');
    lines.push('!');
    lines.push('version 15.4');
    lines.push('no service timestamps log datetime msec');
    lines.push('no service timestamps debug datetime msec');

    if (this.servicePasswordEncryption) {
      lines.push('service password-encryption');
    } else {
      lines.push('no service password-encryption');
    }
    lines.push('!');
    lines.push(`hostname ${this.hostname}`);
    lines.push('!');

    if (this.bannerMotd) {
      lines.push(`banner motd #${this.bannerMotd}#`);
      lines.push('!');
    }

    if (this.enableSecret) {
      lines.push(`enable secret 5 ${this.enableSecret}`);
    }
    if (this.enablePassword) {
      const pwStr = this.servicePasswordEncryption ? `7 ${CiscoCrypto.encryptType7(this.enablePassword)}` : this.enablePassword;
      lines.push(`enable password ${pwStr}`);
    }

    if (Object.keys(this.users).length > 0) {
      for (const [u, data] of Object.entries(this.users)) {
        if (data.secret) {
          lines.push(`username ${u} secret 5 ${data.secret}`);
        } else if (data.password) {
          const p = this.servicePasswordEncryption ? `7 ${CiscoCrypto.encryptType7(data.password)}` : data.password;
          lines.push(`username ${u} password ${p}`);
        }
      }
      lines.push('!');
    }

    if (this.domainName) {
      lines.push(`ip domain-name ${this.domainName}`);
    }
    if (this.sshVersion) {
      lines.push(`ip ssh version ${this.sshVersion}`);
    }
    lines.push('!');

    // Interfaces
    for (const [name, intf] of Object.entries(this.interfaces)) {
      lines.push(`interface ${name}`);
      if (intf.description) lines.push(` description ${intf.description}`);
      if (intf.ip && intf.mask) {
        lines.push(` ip address ${intf.ip} ${intf.mask}`);
      } else {
        lines.push(' no ip address');
      }
      if (intf.shutdown) {
        lines.push(' shutdown');
      } else {
        lines.push(' no shutdown');
      }
      lines.push('!');
    }

    // Default Gateway (Switches)
    if (this.defaultGateway) {
      lines.push(`ip default-gateway ${this.defaultGateway}`);
      lines.push('!');
    }

    // Static Routes (Routers)
    if (this.staticRoutes && this.staticRoutes.length > 0) {
      for (const r of this.staticRoutes) {
        if (r.nextHop) {
          lines.push(`ip route ${r.network} ${r.mask} ${r.nextHop}`);
        } else if (r.interface) {
          lines.push(`ip route ${r.network} ${r.mask} ${r.interface}`);
        }
      }
      lines.push('!');
    }

    // Line con 0
    lines.push('line con 0');
    if (this.consolePassword) {
      const cp = this.servicePasswordEncryption ? `7 ${CiscoCrypto.encryptType7(this.consolePassword)}` : this.consolePassword;
      lines.push(` password ${cp}`);
    }
    if (this.consoleLoginRequired) {
      lines.push(' login');
    }
    lines.push('!');

    // Line vty
    const maxVty = this.maxConfiguredVty || 4;
    lines.push(`line vty 0 ${maxVty}`);
    if (this.vtyPassword) {
      const vp = this.servicePasswordEncryption ? `7 ${CiscoCrypto.encryptType7(this.vtyPassword)}` : this.vtyPassword;
      lines.push(` password ${vp}`);
    }
    if (this.vtyLoginMode === 'login') lines.push(' login');
    if (this.vtyLoginMode === 'local') lines.push(' login local');
    if (this.vtyTransportInput) lines.push(` transport input ${this.vtyTransportInput}`);
    lines.push('!');
    lines.push('end');

    return lines.join('\n');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CiscoDevice };
}
