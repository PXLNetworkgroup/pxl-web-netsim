/**
 * cisco_device.js - Dynamic Data Model for Cisco Routers, Switches, Wireless, and PCs
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class CiscoDevice {
  constructor(id, type, defaultHostname, options = {}) {
    this.id = id;
    this.type = type; // 'router', 'switch', 'hpe_switch', 'pc', 'laptop', 'server', 'wireless_ap', 'mikrotik', 'openwrt'
    this.model = options.model || (type === 'router' ? '4331' : type === 'switch' ? '2960-24TT' : type === 'hpe_switch' ? 'Aruba-2530-24G' : 'Standard');
    this.hostname = defaultHostname || id;
    this.defaultHostname = defaultHostname || id;
    this.displayName = options.displayName || this.hostname;

    // Hardware locking per lab (disable GUI IP, disable config tab, etc.)
    this.lockedFeatures = options.lockedFeatures ? [...options.lockedFeatures] : [];

    // HPE Aruba Switch Configuration
    if (this.type === 'hpe_switch') {
      this.hpeConfig = {
        model: this.model || 'Aruba-2530-24G',
        hostname: this.hostname || (this.model.includes('2930') ? 'Aruba-2930F' : 'Aruba-2530'),
        firmware: 'YA.16.11.0003',
        webManagement: { enabled: true, port: 80, ssl: false },
        vlans: { 1: { id: 1, name: 'DEFAULT_VLAN', ip: '192.168.1.10', mask: '255.255.255.0', untagged: Array.from({ length: 28 }, (_, i) => String(i + 1)), tagged: [] } },
        mgmtIp: '192.168.1.10',
        mgmtMask: '255.255.255.0',
        defaultGateway: '192.168.1.1',
        portConfigs: {}
      };
      this.ip = '192.168.1.10';
      this.mask = '255.255.255.0';
      this.defaultGateway = '192.168.1.1';
    }

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
    this.mask = options.mask || (this.ip && typeof IPUtils !== 'undefined' ? IPUtils.getDefaultMask(this.ip) : (this.ip ? '255.255.255.0' : ''));
    this.gateway = options.gateway || "";
    this.dns = options.dns || "8.8.8.8";
    this.dhcpEnabled = options.dhcpEnabled || false;

    if (this.ip && this.interfaces) {
      if (this.interfaces['FastEthernet0']) {
        this.interfaces['FastEthernet0'].ip = this.ip;
        this.interfaces['FastEthernet0'].mask = this.mask;
        this.interfaces['FastEthernet0'].shutdown = false;
      }
      if (this.interfaces['Wireless0']) {
        this.interfaces['Wireless0'].ip = this.ip;
        this.interfaces['Wireless0'].mask = this.mask;
      }
    }

    // MikroTik RouterOS Configuration
    if (this.type === 'mikrotik') {
      this.mikrotikConfig = options.mikrotikConfig || {
        identity: this.hostname || 'MikroTik',
        services: {
          www: { enabled: true, port: 80 },
          ssh: { enabled: true, port: 22 },
          telnet: { enabled: true, port: 23 },
          winbox: { enabled: true, port: 8291 }
        },
        users: {
          admin: { password: '', group: 'full' }
        }
      };
      this.ip = options.ip || '192.168.88.1';
      this.mask = options.mask || '255.255.255.0';
    }

    // Wireless Router (Cisco Linksys WRT300N) Configuration
    if (this.type === 'wireless_router') {
      this.wrtConfig = {
        model: 'WRT300N',
        lanIp: options.lanIp || '192.168.0.1',
        lanMask: options.lanMask || '255.255.255.0',
        dhcpEnabled: options.dhcpEnabled !== undefined ? options.dhcpEnabled : true,
        dhcpStartIp: options.dhcpStartIp || '192.168.0.100',
        dhcpMaxUsers: options.dhcpMaxUsers || 50,
        dns: options.dns || '8.8.8.8',
        wanType: options.wanType || 'dhcp', // 'dhcp', 'static', 'pppoe'
        wanIp: options.wanIp || '',
        wanMask: options.wanMask || '',
        wanGateway: options.wanGateway || '',
        wanDns: options.wanDns || '8.8.8.8'
      };
      this.ip = this.wrtConfig.lanIp;
      this.mask = this.wrtConfig.lanMask;
    }

    // Cisco 3504 Wireless LAN Controller (WLC) Configuration
    if (this.type === 'wlc') {
      this.wlcConfig = {
        model: '3504',
        mgmtIp: options.mgmtIp || '10.10.0.254',
        mgmtMask: options.mgmtMask || '255.255.255.0',
        mgmtGateway: options.mgmtGateway || '10.10.0.1',
        interfaces: {
          'management': { name: 'management', vlan: 10, ip: '10.10.0.254', mask: '255.255.255.0', gateway: '10.10.0.1', dhcpServer: '10.10.0.1' },
          'int_staff': { name: 'int_staff', vlan: 20, ip: '10.20.0.254', mask: '255.255.255.0', gateway: '10.20.0.1', dhcpServer: '10.20.0.1' },
          'int_guest': { name: 'int_guest', vlan: 30, ip: '10.30.0.254', mask: '255.255.255.0', gateway: '10.30.0.1', dhcpServer: '10.30.0.1' }
        },
        wlans: [
          { id: 1, profile: 'WLAN-Staff', ssid: 'PXL-Staff', status: 'Enabled', intf: 'int_staff', vlan: 20, authMode: 'WPA2-PSK', passphrase: 'CiscoStaff123!' },
          { id: 2, profile: 'WLAN-Guest', ssid: 'PXL-Guest', status: 'Enabled', intf: 'int_guest', vlan: 30, authMode: 'Open', passphrase: '' }
        ]
      };
      this.ip = this.wlcConfig.mgmtIp;
      this.mask = this.wlcConfig.mgmtMask;
      this.defaultGateway = this.wlcConfig.mgmtGateway;
    }

    // Standalone / Autonomous Access Point Configuration
    if (this.type === 'wireless_ap') {
      this.apConfig = options.apConfig || {
        mode: options.apMode || 'autonomous', // 'autonomous' (Standalone) or 'lightweight' (CAPWAP/WLC)
        ip: options.ip || '10.10.0.100',
        mask: options.mask || '255.255.255.0',
        gateway: options.gateway || '10.10.0.1',
        dns: options.dns || '8.8.8.8',
        webEnabled: true,
        webPort: 80,
        dhcpEnabled: options.dhcpEnabled !== undefined ? options.dhcpEnabled : true,
        dhcpPool: {
          startIp: '10.10.0.101',
          mask: '255.255.255.0',
          gateway: '10.10.0.100',
          dns: '8.8.8.8',
          maxUsers: 30
        },
        dhcpLeases: [],
        authMode: options.authMode || 'WPA2-PSK', // 'Open', 'WPA2-PSK', 'WPA2-Enterprise'
        passphrase: options.passphrase || 'PXL_Geheim2026!',
        radiusServer: options.radiusServer || '10.10.0.10',
        radiusSecret: options.radiusSecret || 'PXL_Secret2026!'
      };
      this.ip = this.apConfig.ip;
      this.mask = this.apConfig.mask;
      this.defaultGateway = this.apConfig.gateway;
    }

    // WatchGuard FireboxV Next-Generation Firewall Configuration
    if (this.type === 'watchguard') {
      this.watchguardConfig = options.watchguardConfig || {
        model: 'FireboxV',
        osVersion: 'Fireware v12.10.2 (Build 684201)',
        serialNumber: 'WGV8829104',
        systemName: this.hostname || 'FireboxV',
        domain: 'pxl.local',
        uptime: '3 days 14 hours 22 minutes',
        policies: [
          { id: 1, name: 'Outgoing', type: 'TCP-UDP', from: 'Trusted, Optional', to: 'External', action: 'Allow' },
          { id: 2, name: 'Ping', type: 'ICMP', from: 'Any', to: 'Firebox', action: 'Allow' },
          { id: 3, name: 'WatchGuard-Web-UI', type: 'TCP 8080', from: 'Trusted', to: 'Firebox', action: 'Allow' },
          { id: 4, name: 'Default-Drop', type: 'Any', from: 'Any', to: 'Any', action: 'Deny' }
        ],
        natRules: [
          { id: 1, name: 'Dynamic-NAT-Out', type: '1-to-1 / Dynamic NAT', source: '192.168.1.0/24', outboundInterface: 'eth0 (External)' }
        ]
      };
      this.ip = options.ip || "192.168.1.1";
      this.mask = options.mask || "255.255.255.0";
    }

    // Wireless Settings (for PCs, Laptops, Servers, Routers, and APs)
    const isWifiDevice = (this.type === 'laptop' || this.type === 'wireless_ap' || this.type === 'wireless_router' || this.type === 'wlc' || options.hasWireless || options.wirelessInstalled);
    this.wireless = {
      installed: isWifiDevice,
      enabled: isWifiDevice,
      adapter: (this.type === 'laptop' ? 'WPC300N' : (this.type === 'pc' || this.type === 'server' ? 'WMP300N' : 'Internal')),
      ssid: options.ssid || (this.type === 'wireless_ap' ? 'PXL-Klas-AP' : this.type === 'wireless_router' ? 'PXL-Wireless-Router' : ''),
      authMode: options.authMode || 'WPA2-PSK', // 'Open', 'WEP', 'WPA2-PSK', 'WPA3-SAE', 'WPA2-Enterprise'
      passphrase: options.passphrase || ((this.type === 'wireless_ap' || this.type === 'wireless_router') ? 'PXL2026Net!' : ''),
      associatedAp: null,
      channel: options.channel || 6,
      band: options.band || '2.4GHz', // '2.4GHz' or '5GHz'
      channelWidth: options.channelWidth || 20, // 20, 40, 80 MHz
      txPower: options.txPower || 15, // dBm (PXL standard: 12-15 dBm)
      rssi: -95,
      snr: 0,
      noiseFloor: (options.band === '5GHz') ? -95 : -90,
      linkQuality: 0,
      txRate: 0,
      bars: 0,
      dhcpEnabled: options.dhcpEnabled !== undefined ? options.dhcpEnabled : true
    };

    // Server Services (HTTP Web Server, DNS Server, DHCP Server, LDAP Domain Controller, FTP Server)
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
      dhcp: {
        enabled: this.type === 'server',
        poolName: 'serverPool',
        gateway: '172.16.1.1',
        dns: '172.16.1.10',
        startIp: '172.16.1.100',
        mask: '255.255.255.0',
        maxUsers: 50,
        tftpServer: '0.0.0.0',
        wlcIp: '10.10.0.254',
        pools: [
          { name: 'serverPool', gateway: '172.16.1.1', dns: '172.16.1.10', startIp: '172.16.1.100', mask: '255.255.255.0', maxUsers: 50 }
        ],
        leases: []
      },
      dns: {
        enabled: this.type === 'server',
        forwardZones: [
          {
            id: 'fz_pxl_local',
            name: 'pxl.local',
            type: 'Primary',
            soa: {
              primaryServer: 'dc01.pxl.local',
              responsiblePerson: 'hostmaster.pxl.local',
              serialNumber: 2026111401,
              refreshInterval: 3600,
              retryInterval: 600,
              expiresAfter: 86400,
              minimumTtl: 3600
            },
            records: [
              { name: '@', type: 'SOA', target: 'dc01.pxl.local', ttl: 3600 },
              { name: '@', type: 'NS', target: 'dc01.pxl.local', ttl: 3600 },
              { name: 'dc01', type: 'A', ip: '172.16.1.10', ttl: 3600 },
              { name: 'www', type: 'A', ip: '172.16.1.10', ttl: 3600 },
              { name: 'web', type: 'CNAME', target: 'www.pxl.local', ttl: 3600 },
              { name: 'mail', type: 'A', ip: '172.16.1.15', ttl: 3600 },
              { name: '@', type: 'MX', target: 'mail.pxl.local', priority: 10, ttl: 3600 }
            ]
          }
        ],
        reverseZones: [
          {
            id: 'rz_172_16_1',
            name: '1.16.172.in-addr.arpa',
            networkPrefix: '172.16.1',
            type: 'Primary',
            soa: {
              primaryServer: 'dc01.pxl.local',
              responsiblePerson: 'hostmaster.pxl.local',
              serialNumber: 2026111401,
              refreshInterval: 3600,
              retryInterval: 600,
              expiresAfter: 86400,
              minimumTtl: 3600
            },
            records: [
              { name: '@', type: 'SOA', target: 'dc01.pxl.local', ttl: 3600 },
              { name: '@', type: 'NS', target: 'dc01.pxl.local', ttl: 3600 },
              { name: '10', type: 'PTR', target: 'dc01.pxl.local', ip: '172.16.1.10', ttl: 3600 },
              { name: '15', type: 'PTR', target: 'mail.pxl.local', ip: '172.16.1.15', ttl: 3600 }
            ]
          }
        ],
        records: [
          { name: 'www.pxl.be', type: 'A', ip: '172.16.1.10' },
          { name: 'cisco.pxl', type: 'A', ip: '172.16.1.10' },
          { name: 'web.pxl.local', type: 'CNAME', target: 'www.pxl.be' }
        ],
        forwarders: {
          enabled: true,
          primary: '8.8.8.8',
          secondary: '1.1.1.1'
        }
      },
      ldap: {
        enabled: this.type === 'server',
        domain: 'pxl.local',
        dcName: 'DC01-PXL',
        baseDn: 'dc=pxl,dc=local',
        radiusPort: 1812,
        radiusSecret: 'PXL_Secret2026!',
        users: [
          { username: 'student1', password: 'PXL2026!', fullName: 'PXL Student (1TIN-A)', group: 'Domain Users,WiFi-Students', role: 'Student' },
          { username: 'student', password: 'PXL2026!', fullName: 'PXL Student Generic', group: 'Domain Users,WiFi-Students', role: 'Student' },
          { username: 'pxl-student', password: '2025_PXL!', fullName: 'PXL Course Student', group: 'Domain Users,WiFi-Students', role: 'Student' },
          { username: 'david', password: 'PXL_Teacher2026!', fullName: 'David Parren (Docent & Netwerkbeheerder)', group: 'Domain Admins,Enterprise Admins', role: 'Teacher' },
          { username: 'teacher', password: 'SinterklaasOp6December', fullName: 'PXL Docent', group: 'Domain Admins,WiFi-Staff', role: 'Teacher' },
          { username: 'Administrator', password: 'PXL_Admin2026!', fullName: 'Built-in Administrator', group: 'Domain Admins,Schema Admins', role: 'Administrator' }
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
      // Cisco 4331 Router standard ports: Gi0/0/0, Gi0/0/1, Gi0/0/2, Serial0/1/0, Serial0/1/1, Vlan1, Console, Aux
      this.interfaces = {
        'GigabitEthernet0/0/0': { ip: "", mask: "", shutdown: true, description: "", speed: 'auto', duplex: 'auto', mac: genMac('00d0.ba') },
        'GigabitEthernet0/0/1': { ip: "", mask: "", shutdown: true, description: "", speed: 'auto', duplex: 'auto', mac: genMac('00d0.ba') },
        'GigabitEthernet0/0/2': { ip: "", mask: "", shutdown: true, description: "", speed: 'auto', duplex: 'auto', mac: genMac('00d0.ba') },
        'Serial0/1/0': { ip: "", mask: "", shutdown: true, description: "", clockRate: '2000000', mac: genMac('00d0.ba') },
        'Serial0/1/1': { ip: "", mask: "", shutdown: true, description: "", clockRate: '2000000', mac: genMac('00d0.ba') },
        'Vlan1': { ip: "", mask: "", shutdown: true, description: "", mac: genMac('00d0.ba') },
        'Console': { ip: "", mask: "", shutdown: false, description: "RJ-45 / USB Console Management Port", portType: 'console', mac: genMac('00d0.ba') },
        'Aux': { ip: "", mask: "", shutdown: false, description: "Auxiliary Serial Port", portType: 'aux', mac: genMac('00d0.ba') }
      };
    } else if (this.type === 'switch') {
      // Cisco Catalyst 2960-24TT Switch: SVI Vlan1 + 24 Fa ports + 2 Gi ports + Console
      this.interfaces = {
        'Vlan1': { ip: "", mask: "", shutdown: true, description: "", mac: genMac('0019.5e') },
        'Console': { ip: "", mask: "", shutdown: false, description: "RJ-45 Console Port", portType: 'console', mac: genMac('0019.5e') }
      };
      for (let p = 1; p <= 24; p++) {
        this.interfaces[`FastEthernet0/${p}`] = { ip: "", mask: "", shutdown: false, description: "", vlan: 1, mac: genMac('0019.5e') };
      }
      this.interfaces['GigabitEthernet0/1'] = { ip: "", mask: "", shutdown: false, description: "", vlan: 1, mac: genMac('0019.5e') };
      this.interfaces['GigabitEthernet0/2'] = { ip: "", mask: "", shutdown: false, description: "", vlan: 1, mac: genMac('0019.5e') };
    } else if (this.type === 'hpe_switch') {
      // HPE Aruba 2530-24G / 2930F-24G-4SFP+ Switch: 24 10/100/1000 ports + 4 SFP ports + Vlan1 + Console
      this.interfaces = {
        'Vlan1': { ip: "192.168.1.10", mask: "255.255.255.0", shutdown: false, description: "DEFAULT_VLAN Management", mac: genMac('b439.d6') },
        'Console': { ip: "", mask: "", shutdown: false, description: "Micro-USB / RJ-45 Serial Console", portType: 'console', mac: genMac('b439.d6') }
      };
      for (let p = 1; p <= 24; p++) {
        this.interfaces[`Port ${p}`] = { ip: "", mask: "", shutdown: false, description: "", vlan: 1, untagged: true, mac: genMac('b439.d6') };
      }
      for (let sfp = 25; sfp <= 28; sfp++) {
        this.interfaces[`Port ${sfp} (SFP)`] = { ip: "", mask: "", shutdown: false, description: "SFP Uplink", vlan: 1, untagged: true, mac: genMac('b439.d6') };
      }
    } else if (this.type === 'pc' || this.type === 'server') {
      this.interfaces = {
        'FastEthernet0': { ip: "", mask: "", shutdown: false, description: "FastEthernet Network Adapter", mac: genMac('0050.79') },
        'RS 232': { ip: "", mask: "", shutdown: false, description: "Serial RS-232 / COM1 Port", portType: 'serial_com' },
        'USB0': { ip: "", mask: "", shutdown: false, description: "USB Port (Console / Data)", portType: 'usb' }
      };
      if (this.wireless && this.wireless.installed) {
        this.interfaces['Wireless0'] = { ip: "", mask: "", shutdown: false, description: "WMP300N Wireless PCI Adapter", mac: genMac('0014.69') };
      }
    } else if (this.type === 'laptop') {
      this.interfaces = {
        'FastEthernet0': { ip: "", mask: "", shutdown: false, description: "FastEthernet Network Adapter", mac: genMac('0050.79') },
        'Wireless0': { ip: "", mask: "", shutdown: false, description: "WPC300N Wireless Adapter", mac: genMac('0060.2f') },
        'RS 232': { ip: "", mask: "", shutdown: false, description: "Serial RS-232 / COM1 Port", portType: 'serial_com' },
        'USB0': { ip: "", mask: "", shutdown: false, description: "USB Port (Console / Data)", portType: 'usb' }
      };
    } else if (this.type === 'wireless_router') {
      // Cisco Linksys WRT300N: 1 WAN (Internet) + 4 LAN FastEthernet Switch Ports + Dual-Band Wireless Radio
      this.interfaces = {
        'Internet': { ip: "", mask: "", shutdown: false, description: "WAN / Internet Uplink", mac: genMac('0021.d8') },
        'Ethernet1': { ip: "192.168.0.1", mask: "255.255.255.0", shutdown: false, description: "LAN Port 1 (Switch)", mac: genMac('0021.d8') },
        'Ethernet2': { ip: "192.168.0.1", mask: "255.255.255.0", shutdown: false, description: "LAN Port 2 (Switch)", mac: genMac('0021.d8') },
        'Ethernet3': { ip: "192.168.0.1", mask: "255.255.255.0", shutdown: false, description: "LAN Port 3 (Switch)", mac: genMac('0021.d8') },
        'Ethernet4': { ip: "192.168.0.1", mask: "255.255.255.0", shutdown: false, description: "LAN Port 4 (Switch)", mac: genMac('0021.d8') },
        'Wireless0': { ip: "192.168.0.1", mask: "255.255.255.0", shutdown: false, description: "Dual-Band 2.4/5GHz Radio", mac: genMac('0021.d8') }
      };
    } else if (this.type === 'wireless_ap') {
      // Cisco LAP-PT / Standalone AP (EAP320 / Aironet 3702i): Gigabit Uplink + Wireless Radio
      this.interfaces = {
        'GigabitEthernet0': { ip: "10.10.0.100", mask: "255.255.255.0", shutdown: false, description: "PoE+ Gigabit Uplink (Trunk/Native VLAN 10)", nativeVlan: 10, trunk: true, mac: genMac('0021.d8') },
        'Wireless0': { ip: "", mask: "", shutdown: false, description: "Omnidirectional Wireless Radio", mac: genMac('0021.d8') }
      };
    } else if (this.type === 'wlc') {
      // Cisco 3504 Wireless LAN Controller: 4 Gigabit Ethernet Ports + Console
      this.interfaces = {
        'GigabitEthernet0/1': { ip: "10.10.0.254", mask: "255.255.255.0", shutdown: false, description: "Trunk Uplink to Switch (VLAN 10, 20, 30)", trunk: true, mac: genMac('0024.97') },
        'GigabitEthernet0/2': { ip: "", mask: "", shutdown: false, description: "Gigabit Distribution Port 2", mac: genMac('0024.97') },
        'GigabitEthernet0/3': { ip: "", mask: "", shutdown: false, description: "Gigabit Distribution Port 3", mac: genMac('0024.97') },
        'GigabitEthernet0/4': { ip: "", mask: "", shutdown: false, description: "Gigabit Distribution Port 4", mac: genMac('0024.97') },
        'Console': { ip: "", mask: "", shutdown: false, description: "RJ-45 Management Console Port", portType: 'console', mac: genMac('0024.97') }
      };
    } else if (this.type === 'mikrotik') {
      // MikroTik hEX lite (RB750r2): 5 FastEthernet ports + Console
      this.interfaces = {
        'ether1': { ip: "", mask: "", shutdown: false, description: "WAN / ether1", mac: genMac('488f.5a') },
        'ether2': { ip: "192.168.88.1", mask: "255.255.255.0", shutdown: false, description: "LAN / ether2", mac: genMac('488f.5a') },
        'ether3': { ip: "", mask: "", shutdown: false, description: "LAN / ether3", mac: genMac('488f.5a') },
        'ether4': { ip: "", mask: "", shutdown: false, description: "LAN / ether4", mac: genMac('488f.5a') },
        'ether5': { ip: "", mask: "", shutdown: false, description: "LAN / ether5", mac: genMac('488f.5a') },
        'Console': { ip: "", mask: "", shutdown: false, description: "Serial / Console Port", portType: 'console', mac: genMac('488f.5a') }
      };
    } else if (this.type === 'openwrt') {
      // OpenWrt Router: 1 WAN (eth0) + 4 LAN (eth1-eth4) + Console
      this.interfaces = {
        'eth0': { ip: "", mask: "", shutdown: false, description: "WAN / eth0", mac: genMac('5254.00') },
        'eth1': { ip: "192.168.1.1", mask: "255.255.255.0", shutdown: false, description: "LAN1 / br-lan", mac: genMac('5254.00') },
        'eth2': { ip: "", mask: "", shutdown: false, description: "LAN2 / br-lan", mac: genMac('5254.00') },
        'eth3': { ip: "", mask: "", shutdown: false, description: "LAN3 / br-lan", mac: genMac('5254.00') },
        'eth4': { ip: "", mask: "", shutdown: false, description: "LAN4 / br-lan", mac: genMac('5254.00') },
        'Console': { ip: "", mask: "", shutdown: false, description: "Serial Console Port", portType: 'console', mac: genMac('5254.00') }
      };
    } else if (this.type === 'internet_cloud' || this.type === 'internet_simulated' || this.type === 'internet_public') {
      // Global Internet Gateway (Cisco CCNA RFC 3849 WAN Subnet: 209.165.200.224/30)
      this.isPublic = (this.type === 'internet_public');
      this.interfaces = {
        'GigabitEthernet0': {
          ip: "209.165.200.225",
          mask: "255.255.255.252",
          shutdown: false,
          description: this.isPublic ? "ISP Uplink (Live NAT Bridge: 209.165.200.225/30)" : "ISP Uplink (CCNA RFC 3849: 209.165.200.225/30)",
          mac: genMac('0001.64')
        }
      };
      this.ip = "209.165.200.225";
      this.mask = "255.255.255.252";
      this.loopbacks = {
        '8.8.8.8': 'Google Anycast DNS',
        '1.1.1.1': 'Cloudflare Anycast DNS',
        '9.9.9.9': 'Quad9 Anycast DNS',
        '208.67.222.222': 'OpenDNS Anycast',
        '209.165.200.230': 'Cisco CCNA Public Web Server'
      };
    } else if (this.type === 'cisco_asa') {
      // Cisco ASA 5506-X Security Appliance: 8 Gigabit ports + Management + Console
      this.interfaces = {
        'GigabitEthernet1/1': { ip: "203.0.113.2", mask: "255.255.255.0", nameif: "outside", securityLevel: 0, shutdown: false, description: "Outside WAN", mac: genMac('00d0.ba') },
        'GigabitEthernet1/2': { ip: "192.168.1.1", mask: "255.255.255.0", nameif: "inside", securityLevel: 100, shutdown: false, description: "Inside LAN", mac: genMac('00d0.ba') },
        'GigabitEthernet1/3': { ip: "172.16.1.1", mask: "255.255.255.0", nameif: "dmz", securityLevel: 50, shutdown: true, description: "DMZ Zone", mac: genMac('00d0.ba') },
        'GigabitEthernet1/4': { ip: "", mask: "", shutdown: true, description: "", mac: genMac('00d0.ba') },
        'GigabitEthernet1/5': { ip: "", mask: "", shutdown: true, description: "", mac: genMac('00d0.ba') },
        'GigabitEthernet1/6': { ip: "", mask: "", shutdown: true, description: "", mac: genMac('00d0.ba') },
        'GigabitEthernet1/7': { ip: "", mask: "", shutdown: true, description: "", mac: genMac('00d0.ba') },
        'GigabitEthernet1/8': { ip: "", mask: "", shutdown: true, description: "", mac: genMac('00d0.ba') },
        'Management1/1': { ip: "192.168.45.1", mask: "255.255.255.0", nameif: "mgmt", securityLevel: 100, shutdown: false, description: "ASDM Management", mac: genMac('00d0.ba') },
        'Console': { ip: "", mask: "", shutdown: false, description: "RJ-45 Management Console Port", portType: 'console', mac: genMac('00d0.ba') }
      };
      this.ip = "192.168.1.1";
      this.mask = "255.255.255.0";
    } else if (this.type === 'fortigate') {
      // Fortinet FortiGate-60F: wan1, wan2, port1-port5, Console
      this.interfaces = {
        'wan1': { ip: "198.51.100.2", mask: "255.255.255.0", allowAccess: "ping https ssh", shutdown: false, description: "WAN 1 Uplink", mac: genMac('704c.a5') },
        'wan2': { ip: "", mask: "", allowAccess: "ping", shutdown: true, description: "WAN 2 Backup", mac: genMac('704c.a5') },
        'port1': { ip: "192.168.1.99", mask: "255.255.255.0", allowAccess: "ping https ssh http", shutdown: false, description: "Internal LAN Port 1", mac: genMac('704c.a5') },
        'port2': { ip: "192.168.1.99", mask: "255.255.255.0", allowAccess: "ping https", shutdown: false, description: "Internal Switch Port 2", mac: genMac('704c.a5') },
        'port3': { ip: "192.168.1.99", mask: "255.255.255.0", allowAccess: "ping https", shutdown: false, description: "Internal Switch Port 3", mac: genMac('704c.a5') },
        'port4': { ip: "192.168.1.99", mask: "255.255.255.0", allowAccess: "ping https", shutdown: false, description: "Internal Switch Port 4", mac: genMac('704c.a5') },
        'port5': { ip: "192.168.1.99", mask: "255.255.255.0", allowAccess: "ping https", shutdown: false, description: "Internal Switch Port 5", mac: genMac('704c.a5') },
        'Console': { ip: "", mask: "", shutdown: false, description: "RJ-45 Management Console Port", portType: 'console', mac: genMac('704c.a5') }
      };
      this.ip = "192.168.1.99";
      this.mask = "255.255.255.0";
    } else if (this.type === 'paloalto') {
      // Palo Alto Networks PA-440: management, ethernet1/1 - ethernet1/4, console
      this.interfaces = {
        'management': { ip: "192.168.1.1", mask: "255.255.255.0", shutdown: false, description: "Dedicated MGT Port", mac: genMac('001b.17') },
        'ethernet1/1': { ip: "10.0.0.1", mask: "255.255.255.0", zone: "UNTRUST", shutdown: false, description: "WAN Untrusted", mac: genMac('001b.17') },
        'ethernet1/2': { ip: "192.168.10.1", mask: "255.255.255.0", zone: "TRUST", shutdown: false, description: "LAN Trusted", mac: genMac('001b.17') },
        'ethernet1/3': { ip: "", mask: "", zone: "DMZ", shutdown: true, description: "DMZ / HA1", mac: genMac('001b.17') },
        'ethernet1/4': { ip: "", mask: "", zone: "DMZ", shutdown: true, description: "DMZ / HA2", mac: genMac('001b.17') },
        'Console': { ip: "", mask: "", shutdown: false, description: "Serial Console Port", portType: 'console', mac: genMac('001b.17') }
      };
      this.ip = "192.168.10.1";
      this.mask = "255.255.255.0";
    } else if (this.type === 'opnsense') {
      // OPNsense 24.1: LAN (vtnet0), WAN (vtnet1), OPT1 (vtnet2), OPT2 (vtnet3), Console
      this.interfaces = {
        'vtnet0 (LAN)': { ip: "192.168.1.1", mask: "255.255.255.0", shutdown: false, description: "LAN Interface (vtnet0)", mac: genMac('0015.5d') },
        'vtnet1 (WAN)': { ip: "192.168.100.10", mask: "255.255.255.0", shutdown: false, description: "WAN Interface (vtnet1)", mac: genMac('0015.5d') },
        'vtnet2 (OPT1)': { ip: "", mask: "", shutdown: true, description: "OPT1 DMZ (vtnet2)", mac: genMac('0015.5d') },
        'vtnet3 (OPT2)': { ip: "", mask: "", shutdown: true, description: "OPT2 Sync (vtnet3)", mac: genMac('0015.5d') },
        'Console': { ip: "", mask: "", shutdown: false, description: "Serial Video / TTY Console", portType: 'console', mac: genMac('0015.5d') }
      };
      this.ip = "192.168.1.1";
      this.mask = "255.255.255.0";
    } else if (this.type === 'pfsense') {
      // pfSense Plus: WAN (vtnet0), LAN (vtnet1), OPT1 (vtnet2), OPT2 (vtnet3), Console
      this.interfaces = {
        'vtnet0 (WAN)': { ip: "198.51.100.15", mask: "255.255.255.0", shutdown: false, description: "WAN Interface (vtnet0)", mac: genMac('000c.29') },
        'vtnet1 (LAN)': { ip: "192.168.1.1", mask: "255.255.255.0", shutdown: false, description: "LAN Interface (vtnet1)", mac: genMac('000c.29') },
        'vtnet2 (OPT1)': { ip: "", mask: "", shutdown: true, description: "OPT1 DMZ (vtnet2)", mac: genMac('000c.29') },
        'vtnet3 (OPT2)': { ip: "", mask: "", shutdown: true, description: "OPT2 Sync (vtnet3)", mac: genMac('000c.29') },
        'Console': { ip: "", mask: "", shutdown: false, description: "Serial Video / TTY Console", portType: 'console', mac: genMac('000c.29') }
      };
      this.ip = "192.168.1.1";
      this.mask = "255.255.255.0";
    } else if (this.type === 'watchguard') {
      // WatchGuard FireboxV: eth0 (External), eth1 (Trusted), eth2 (Optional), eth3-eth7, Console
      this.interfaces = {
        'eth0 (External)': { ip: "203.0.113.100", mask: "255.255.255.0", zone: "External", shutdown: false, description: "External WAN Uplink (eth0)", mac: genMac('0090.7f') },
        'eth1 (Trusted)': { ip: "192.168.1.1", mask: "255.255.255.0", zone: "Trusted", shutdown: false, description: "Trusted Internal LAN (eth1)", mac: genMac('0090.7f') },
        'eth2 (Optional)': { ip: "10.0.1.1", mask: "255.255.255.0", zone: "Optional", shutdown: true, description: "Optional DMZ Zone (eth2)", mac: genMac('0090.7f') },
        'eth3': { ip: "", mask: "", zone: "Custom", shutdown: true, description: "Gigabit Interface 3", mac: genMac('0090.7f') },
        'eth4': { ip: "", mask: "", zone: "Custom", shutdown: true, description: "Gigabit Interface 4", mac: genMac('0090.7f') },
        'eth5': { ip: "", mask: "", zone: "Custom", shutdown: true, description: "Gigabit Interface 5", mac: genMac('0090.7f') },
        'eth6': { ip: "", mask: "", zone: "Custom", shutdown: true, description: "Gigabit Interface 6", mac: genMac('0090.7f') },
        'eth7': { ip: "", mask: "", zone: "Custom", shutdown: true, description: "Gigabit Interface 7", mac: genMac('0090.7f') },
        'Console': { ip: "", mask: "", shutdown: false, description: "Serial Management Console Port", portType: 'console', mac: genMac('0090.7f') }
      };
      this.ip = "192.168.1.1";
      this.mask = "255.255.255.0";
    } else if (this.type === 'cloud_wan') {
      // Cloud WAN / ISP Frame Relay & Cable/DSL Cloud
      this.interfaces = {
        'Serial0/0/0': { ip: "", mask: "", shutdown: false, description: "Frame Relay Serial DCE 0", mac: genMac('0002.17') },
        'Serial0/0/1': { ip: "", mask: "", shutdown: false, description: "Frame Relay Serial DCE 1", mac: genMac('0002.17') },
        'Ethernet6': { ip: "", mask: "", shutdown: false, description: "Gigabit WAN Uplink", mac: genMac('0002.17') },
        'Ethernet7': { ip: "", mask: "", shutdown: false, description: "Gigabit WAN Distribution", mac: genMac('0002.17') },
        'Coaxial7': { ip: "", mask: "", shutdown: false, description: "DOCSIS Cable RF Port", mac: genMac('0002.17') }
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

  isFeatureLocked(featureName) {
    if (!this.lockedFeatures || !Array.isArray(this.lockedFeatures)) return false;
    return this.lockedFeatures.includes(featureName) || this.lockedFeatures.includes('all');
  }

  getPrompt() {
    if (!this.powerOn) return '[Device is Powered Off]';
    if (this.promptState && this.promptState.promptText) {
      return this.promptState.promptText;
    }

    if (this.type === 'mikrotik') {
      const id = this.mikrotikConfig?.identity || this.hostname || 'MikroTik';
      return `[admin@${id}] > `;
    }

    if (this.type === 'openwrt') {
      const h = this.openwrtConfig?.hostname || this.hostname || 'OpenWrt';
      return `root@${h}:~# `;
    }

    if (this.type === 'hpe_switch') {
      const hname = this.hostname || 'Aruba-2530';
      switch (this.mode) {
        case 'USER_EXEC': return `${hname}> `;
        case 'PRIV_EXEC': return `${hname}# `;
        case 'CONFIG': return `${hname}(config)# `;
        case 'CONFIG_VLAN': return `${hname}(vlan-${this.currentVlan || '1'})# `;
        case 'CONFIG_IF': return `${hname}(eth-${this.currentInterface || '1'})# `;
        default: return `${hname}# `;
      }
    }

    if (this.type === 'internet_cloud' || this.type === 'internet_simulated' || this.type === 'internet_public') {
      return this.type === 'internet_public' ? `[Public Internet NAT Active]` : `[Simulated Internet Active]`;
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
    'ip', 'mask', 'gateway', 'dns', 'dhcpEnabled', 'wireless', 'services', 'mikrotikConfig', 'openwrtConfig', 'hpeConfig'
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
      if (intf.clockRate && name.toLowerCase().startsWith('serial')) {
        lines.push(` clock rate ${intf.clockRate}`);
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
      if (this.consoleLoginMode === 'local') {
        lines.push(' login local');
      } else {
        lines.push(' login');
      }
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

  // --- WIRELESS HARDWARE & NIC MANAGEMENT ---
  hasWirelessCard() {
    return !!(this.wireless && this.wireless.installed);
  }

  installWirelessCard(model = 'WMP300N') {
    if (!this.wireless) {
      this.wireless = {
        installed: true,
        enabled: true,
        adapter: model,
        ssid: '',
        authMode: 'Open',
        passphrase: '',
        associatedAp: null,
        channel: 6,
        band: '2.4GHz',
        channelWidth: 20,
        txPower: 15,
        rssi: -95,
        snr: 0,
        noiseFloor: -90,
        linkQuality: 0,
        txRate: 0,
        bars: 0,
        dhcpEnabled: true
      };
    } else {
      this.wireless.installed = true;
      this.wireless.enabled = true;
      this.wireless.adapter = model;
    }

    if (!this.interfaces['Wireless0']) {
      const genMac = (prefix) => `${prefix}.${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}.${Math.floor(Math.random() * 65535).toString(16).padStart(4, '0')}`;
      this.interfaces['Wireless0'] = {
        ip: this.ip || "",
        mask: this.mask || "",
        shutdown: false,
        description: `${model} Wireless Adapter`,
        mac: genMac('0014.69')
      };
    } else {
      this.interfaces['Wireless0'].shutdown = false;
    }
    return true;
  }

  removeWirelessCard() {
    if (this.wireless) {
      this.wireless.installed = false;
      this.wireless.enabled = false;
      this.wireless.associatedAp = null;
      this.wireless.rssi = -95;
      this.wireless.snr = 0;
      this.wireless.linkQuality = 0;
      this.wireless.txRate = 0;
      this.wireless.bars = 0;
    }
    delete this.interfaces['Wireless0'];
    return true;
  }

  toggleWirelessPower() {
    if (!this.wireless || !this.wireless.installed) return false;
    this.wireless.enabled = !this.wireless.enabled;
    if (!this.wireless.enabled) {
      this.wireless.associatedAp = null;
      this.wireless.rssi = -95;
      this.wireless.snr = 0;
      this.wireless.linkQuality = 0;
      this.wireless.txRate = 0;
      this.wireless.bars = 0;
    }
    return this.wireless.enabled;
  }
}

if (typeof window !== 'undefined') {
  window.CiscoDevice = CiscoDevice;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CiscoDevice };
}
