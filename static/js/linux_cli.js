/**
 * linux_cli.js - Authentic Linux Terminal (Bash / Ubuntu 24.04 LTS) for Desktops, Laptops & Servers
 * Provides realistic Linux CLI networking tools (ip, ifconfig, ping, traceroute, netstat, route, curl, ssh, python)
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class LinuxCLIHandler {
  constructor(device, printCallback, triggerScoreUpdate, updatePromptCallback) {
    this.device = device;
    this.print = printCallback || console.log;
    this.triggerScoreUpdate = triggerScoreUpdate || (() => {});
    this.updatePrompt = updatePromptCallback || (() => {});
    this.currentUser = (device.type === 'server') ? 'root' : 'student';
    this.currentPath = (this.currentUser === 'root') ? '/root' : '/home/student';
    this.activeSshSession = null;
    this.pythonReplActive = false;
    this.pythonEngine = null;

    // Simulated virtual Linux filesystem
    this.initFilesystem();
  }

  initFilesystem() {
    const dev = this.device;
    this.fs = {
      '/etc/resolv.conf': `nameserver ${dev.dns || '8.8.8.8'}\nsearch pxl.be\n`,
      '/etc/network/interfaces': `auto lo\niface lo inet loopback\n\nauto eth0\niface eth0 inet static\n  address ${dev.ip || '0.0.0.0'}\n  netmask ${dev.mask || '255.255.255.0'}\n  gateway ${dev.gateway || '0.0.0.0'}\n`,
      '/etc/os-release': `NAME="Ubuntu"\nVERSION="24.04.1 LTS (Noble Numbat)"\nID=ubuntu\nID_LIKE=debian\nPRETTY_NAME="Ubuntu 24.04.1 LTS"\nVERSION_ID="24.04"\nHOME_URL="https://www.ubuntu.com/"\n`,
      '/etc/hosts': `127.0.0.1\tlocalhost\n127.0.1.1\t${dev.hostname || 'pxl-client'}\n`,
      '/etc/hostname': `${dev.hostname || 'pxl-client'}\n`,
      '/var/log/syslog': `systemd[1]: Started Network Service.\nsystemd[1]: Reached target Network is Online.\n`,
      '/home/student/welcome.txt': `Welkom bij de PXL NetSim Linux Terminal!\nGebruik 'ip a', 'ping <ip>', 'traceroute <ip>', 'curl http://...', of typ 'python3'.\n`
    };
  }

  getPrompt() {
    const host = (this.device.hostname || 'pxl-host').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const user = this.currentUser;
    const isRoot = (user === 'root');
    let path = this.currentPath;
    if (path === `/home/${user}` || (isRoot && path === '/root')) {
      path = '~';
    }
    const symbol = isRoot ? '#' : '$';
    return `${user}@${host}:${path}${symbol} `;
  }

  handleCommand(rawLine) {
    const dev = this.device;
    const line = rawLine.trim();

    // 1. If inside an active SSH session
    if (this.activeSshSession) {
      if (line.toLowerCase() === 'exit' || line.toLowerCase() === 'quit') {
        const remoteName = this.activeSshSession.targetDev.hostname || 'remote';
        this.print(`Connection to ${remoteName} closed.`);
        this.activeSshSession = null;
        this.updatePrompt(this.getPrompt());
        return;
      }
      this.activeSshSession.parser.handleCommand(rawLine);
      const prompt = this.activeSshSession.targetDev.getPrompt ? this.activeSshSession.targetDev.getPrompt() : '> ';
      this.updatePrompt(prompt);
      if (this.triggerScoreUpdate) this.triggerScoreUpdate();
      return;
    }

    // 2. If inside interactive Python REPL
    if (this.pythonReplActive) {
      if (line === 'exit()' || line === 'quit()' || line === 'exit' || line === 'quit') {
        this.pythonReplActive = false;
        this.print("");
        this.updatePrompt(this.getPrompt());
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
      this.updatePrompt(this.getPrompt());
      return;
    }

    dev.history.push(line);
    dev.historyIndex = dev.history.length;

    const parts = line.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'ip':
        this.handleIpCommand(args);
        break;
      case 'ifconfig':
        this.handleIfconfig(args);
        break;
      case 'ping':
        this.handlePing(args);
        break;
      case 'traceroute':
      case 'tracepath':
        this.handleTraceroute(args);
        break;
      case 'netstat':
      case 'ss':
        this.handleNetstat(args);
        break;
      case 'route':
        this.handleRoute(args);
        break;
      case 'curl':
        this.handleCurl(args);
        break;
      case 'wget':
        this.handleWget(args);
        break;
      case 'ssh':
        this.handleSsh(args);
        break;
      case 'telnet':
        this.handleTelnet(args);
        break;
      case 'python':
      case 'python3':
        this.startPythonRepl(args);
        break;
      case 'cat':
        this.handleCat(args);
        break;
      case 'ls':
        this.handleLs(args);
        break;
      case 'pwd':
        this.print(this.currentPath);
        break;
      case 'cd':
        this.handleCd(args);
        break;
      case 'whoami':
        this.print(this.currentUser);
        break;
      case 'hostname':
        if (args.length > 0 && this.currentUser === 'root') {
          dev.hostname = args[0];
          this.print("");
        } else {
          this.print(dev.hostname || 'pxl-client');
        }
        break;
      case 'uname':
        if (args.includes('-a')) {
          this.print(`Linux ${dev.hostname || 'pxl-client'} 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`);
        } else {
          this.print("Linux");
        }
        break;
      case 'uptime':
        this.print(` 14:40:02 up  2:14,  1 user,  load average: 0.04, 0.08, 0.02`);
        break;
      case 'date':
        this.print(new Date().toUTCString());
        break;
      case 'sudo':
        this.handleSudo(args);
        break;
      case 'su':
        this.currentUser = 'root';
        this.currentPath = '/root';
        this.print("");
        break;
      case 'systemctl':
      case 'service':
        this.handleSystemctl(args);
        break;
      case 'clear':
      case 'cls':
        if (window.PXLApp) window.PXLApp.clearActiveTerminal();
        break;
      case 'help':
      case 'man':
        this.printHelp();
        break;
      default:
        this.print(`${cmd}: command not found`);
    }

    this.updatePrompt(this.getPrompt());
    if (this.triggerScoreUpdate) this.triggerScoreUpdate();
  }

  handleIpCommand(args) {
    const dev = this.device;
    const sub = (args[0] || 'a').toLowerCase();

    if (sub === 'a' || sub === 'addr' || sub === 'address') {
      const cidr = (IPUtils && dev.mask) ? IPUtils.maskToPrefix(dev.mask) : 24;
      const intf = dev.interfaces['FastEthernet0'] || dev.interfaces['Wireless0'] || {};
      const mac = intf.mac || '00:50:79:66:68:01';
      const isUp = dev.powerOn && !intf.shutdown && !!dev.ip;

      this.print(`1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000`);
      this.print(`    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00`);
      this.print(`    inet 127.0.0.1/8 scope host lo`);
      this.print(`       valid_lft forever preferred_lft forever\n`);

      const ifName = dev.type === 'laptop' ? 'wlan0' : 'eth0';
      this.print(`2: ${ifName}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state ${isUp ? 'UP' : 'DOWN'} group default qlen 1000`);
      this.print(`    link/ether ${mac} brd ff:ff:ff:ff:ff:ff`);
      if (dev.ip) {
        this.print(`    inet ${dev.ip}/${cidr} brd 255.255.255.255 scope global ${ifName}`);
        this.print(`       valid_lft forever preferred_lft forever`);
      }
      this.print("");
      return;
    }

    if (sub === 'r' || sub === 'route') {
      if (dev.gateway) {
        this.print(`default via ${dev.gateway} dev eth0 proto static metric 100`);
      }
      if (dev.ip && dev.mask) {
        const net = (IPUtils) ? IPUtils.getNetworkAddress(dev.ip, dev.mask) : dev.ip;
        const cidr = (IPUtils) ? IPUtils.maskToPrefix(dev.mask) : 24;
        this.print(`${net}/${cidr} dev eth0 proto kernel scope link src ${dev.ip} metric 100\n`);
      }
      return;
    }

    if (sub === 'link') {
      this.print(`1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000`);
      this.print(`2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default qlen 1000\n`);
      return;
    }

    this.print("Usage: ip [ addr | route | link ]");
  }

  handleIfconfig(args) {
    const dev = this.device;
    const ifName = dev.type === 'laptop' ? 'wlan0' : 'eth0';
    const intf = dev.interfaces['FastEthernet0'] || dev.interfaces['Wireless0'] || {};

    this.print(`${ifName}: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500`);
    if (dev.ip) {
      this.print(`        inet ${dev.ip}  netmask ${dev.mask || '255.255.255.0'}  broadcast 255.255.255.255`);
    }
    this.print(`        ether ${intf.mac || '00:50:79:66:68:01'}  txqueuelen 1000  (Ethernet)`);
    this.print(`        RX packets 142  bytes 18450 (18.4 KB)`);
    this.print(`        TX packets 138  bytes 17290 (17.2 KB)\n`);

    this.print(`lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536`);
    this.print(`        inet 127.0.0.1  netmask 255.0.0.0\n`);
  }

  handlePing(args) {
    if (args.length === 0) {
      this.print("ping: usage error: Destination address required");
      return;
    }
    const target = args[args.length - 1];
    this.print(`PING ${target} (${target}) 56(84) bytes of data.`);

    const sim = window.PXLNetworkSim;
    if (sim) {
      const res = sim.executePing(this.device.id, target);
      if (res.success) {
        for (let i = 1; i <= 4; i++) {
          const time = (Math.random() * 0.8 + 0.2).toFixed(3);
          this.print(`64 bytes from ${target}: icmp_seq=${i} ttl=64 time=${time} ms`);
        }
        this.print(`\n--- ${target} ping statistics ---`);
        this.print(`4 packets transmitted, 4 received, 0% packet loss, time 3004ms`);
      } else {
        this.print(`From ${this.device.ip || '127.0.0.1'} icmp_seq=1 Destination Host Unreachable`);
        this.print(`From ${this.device.ip || '127.0.0.1'} icmp_seq=2 Destination Host Unreachable`);
        this.print(`\n--- ${target} ping statistics ---`);
        this.print(`4 packets transmitted, 0 received, 100% packet loss`);
      }
    }
    this.print("");
  }

  handleTraceroute(args) {
    if (args.length === 0) {
      this.print("Usage: traceroute <destination>");
      return;
    }
    const target = args[0];
    this.print(`traceroute to ${target} (${target}), 30 hops max, 60 byte packets`);

    const sim = window.PXLNetworkSim;
    if (sim) {
      const res = sim.executeTraceroute(this.device.id, target);
      if (res.success) {
        res.hops.forEach((h, idx) => {
          const ms = (Math.random() * 1.5 + 0.5).toFixed(3);
          this.print(` ${idx + 1}  ${h}  ${ms} ms  ${ms} ms  ${ms} ms`);
        });
      } else {
        this.print(` 1  ${this.device.gateway || '*'}  0.812 ms  0.789 ms  0.754 ms`);
        this.print(` 2  * * * Request timed out`);
      }
    }
    this.print("");
  }

  handleNetstat(args) {
    this.print("Active Internet connections (only servers)");
    this.print("Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name");
    this.print("tcp        0      0 127.0.0.53:53           0.0.0.0:*               LISTEN      systemd-resolved");
    if (this.device.type === 'server') {
      this.print("tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      apache2");
      this.print("tcp        0      0 0.0.0.0:21              0.0.0.0:*               LISTEN      vsftpd");
      this.print("tcp        0      0 0.0.0.0:53              0.0.0.0:*               LISTEN      named");
    }
    this.print("tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      sshd\n");
  }

  handleRoute(args) {
    const dev = this.device;
    this.print("Kernel IP routing table");
    this.print("Destination     Gateway         Genmask         Flags Metric Ref    Use Iface");
    if (dev.gateway) {
      this.print(`0.0.0.0         ${dev.gateway.padEnd(15, ' ')} 0.0.0.0         UG    100    0        0 eth0`);
    }
    if (dev.ip && dev.mask) {
      const net = (IPUtils) ? IPUtils.getNetworkAddress(dev.ip, dev.mask) : dev.ip;
      this.print(`${net.padEnd(15, ' ')} 0.0.0.0         ${dev.mask.padEnd(15, ' ')} U     100    0        0 eth0`);
    }
    this.print("");
  }

  handleCurl(args) {
    if (args.length === 0) {
      this.print("curl: try 'curl --help' for more information");
      return;
    }
    const url = args[0];
    const sim = window.PXLNetworkSim;
    if (sim) {
      const res = sim.fetchHttp(this.device.id, url);
      if (res.success) {
        if (res.isLiveProxy) {
          this.print(`<!-- Live Proxy to ${res.liveUrl} -->`);
          this.print(`<!DOCTYPE html><html><body><h1>Live Website ${res.liveUrl} Connected</h1></body></html>`);
        } else {
          // Output HTML or strip tags for terminal viewing
          this.print(res.html || "HTTP/1.1 200 OK\nServer: PXL-NetSim\nContent-Type: text/html\n\n<h1>PXL Web Server OK</h1>");
        }
      } else {
        this.print(`curl: (7) Failed to connect to ${url}: ${res.reason}`);
      }
    }
  }

  handleWget(args) {
    if (args.length === 0) {
      this.print("wget: missing URL");
      return;
    }
    const url = args[0];
    this.print(`--2026-11-11 14:42:15--  ${url}`);
    this.print(`Resolving host...`);
    const sim = window.PXLNetworkSim;
    if (sim) {
      const res = sim.fetchHttp(this.device.id, url);
      if (res.success) {
        this.print(`Connecting... connected.`);
        this.print(`HTTP request sent, awaiting response... 200 OK`);
        this.print(`Length: 1024 (1.0K) [text/html]`);
        this.print(`Saving to: 'index.html'\n\nindex.html           100%[===================>]   1.00K  --.-KB/s    in 0.001s\n`);
        this.print(`2026-11-11 14:42:16 (1.00 MB/s) - 'index.html' saved [1024/1024]\n`);
        this.fs['/home/student/index.html'] = res.html;
      } else {
        this.print(`failed: ${res.reason}.`);
      }
    }
  }

  handleSsh(args) {
    if (args.length === 0) {
      this.print("usage: ssh [user@]hostname [command]");
      return;
    }
    let target = args[0];
    let user = 'admin';
    if (target.includes('@')) {
      const s = target.split('@');
      user = s[0];
      target = s[1];
    } else if (args[0] === '-l') {
      user = args[1] || 'admin';
      target = args[2] || '';
    }

    const sim = window.PXLNetworkSim;
    if (!sim) return;

    const ping = sim.executePing(this.device.id, target);
    if (!ping.success) {
      this.print(`ssh: connect to host ${target} port 22: Connection timed out`);
      return;
    }

    const dstInfo = sim.findDeviceByIp(target);
    if (!dstInfo) {
      this.print(`ssh: connect to host ${target} port 22: Connection refused`);
      return;
    }

    const targetDev = dstInfo.device;
    this.print(`\nAuthenticating to ${targetDev.hostname} (${target}) as '${user}'...`);

    if (targetDev.type === 'hpe_switch') {
      this.print(`HPE ArubaOS-S Switch Software (c) Copyright 2026 Hewlett Packard Enterprise`);
      const parser = new HpeCLIParser(targetDev, this.print, (p) => this.updatePrompt(p), this.triggerScoreUpdate);
      this.activeSshSession = { targetDev, parser, user };
      this.updatePrompt(parser.getPrompt());
      return;
    }

    if (targetDev.type === 'mikrotik') {
      this.print(`MikroTik RouterOS 7.12 (c) 1994-2026`);
      const parser = new MikroTikCLIParser(targetDev, this.print, () => this.updatePrompt(targetDev.getPrompt()), this.triggerScoreUpdate);
      this.activeSshSession = { targetDev, parser, user };
      this.updatePrompt(targetDev.getPrompt());
      return;
    }

    if (targetDev.type === 'router' || targetDev.type === 'switch') {
      this.print(`Cisco IOS Software, Version 15.4(3)M2\nUser Access Verification\n`);
      const parser = new CiscoCLIParser(targetDev, this.print, () => this.updatePrompt(targetDev.getPrompt()), this.triggerScoreUpdate);
      this.activeSshSession = { targetDev, parser, user };
      this.updatePrompt(targetDev.getPrompt());
      return;
    }

    this.print(`ssh: connected to remote server ${targetDev.hostname}`);
  }

  handleTelnet(args) {
    if (args.length === 0) {
      this.print("Usage: telnet <host> [port]");
      return;
    }

    const target = args[0].trim();
    const port = args[1] ? parseInt(args[1], 10) : 23;
    const sim = window.PXLNetworkSim;
    if (!sim) return;

    this.print(`Trying ${target}...`);
    const ping = sim.executePing(this.device.id, target);
    if (!ping.success) {
      this.print(`telnet: Unable to connect to remote host: Connection timed out`);
      return;
    }

    const dstInfo = sim.findDeviceByIp(target);
    if (!dstInfo) {
      this.print(`telnet: Unable to connect to remote host: Connection refused`);
      return;
    }

    const targetDev = dstInfo.device;
    let parser = null;
    if (targetDev.type === 'hpe_switch') {
      parser = new HpeCLIParser(targetDev, this.print, (p) => this.updatePrompt(p), this.triggerScoreUpdate);
    } else if (targetDev.type === 'mikrotik') {
      parser = new MikroTikCLIParser(targetDev, this.print, () => this.updatePrompt(targetDev.getPrompt()), this.triggerScoreUpdate);
    } else if (targetDev.type === 'openwrt') {
      parser = new OpenWrtCLIParser(targetDev, this.print, () => this.updatePrompt(targetDev.getPrompt()), this.triggerScoreUpdate);
    } else if (targetDev.type === 'router' || targetDev.type === 'switch') {
      parser = new CiscoCLIParser(targetDev, this.print, () => this.updatePrompt(targetDev.getPrompt()), this.triggerScoreUpdate);
    }

    if (parser) {
      this.print(`Connected to ${targetDev.hostname} (${target}).\nEscape character is '^]'.\n`);
      this.activeSshSession = { targetDev, parser, user: 'telnet' };
      this.updatePrompt(targetDev.getPrompt ? targetDev.getPrompt() : '> ');
    } else {
      this.print(`telnet: Connection closed by foreign host`);
    }
  }

  startPythonRepl(args) {
    this.pythonReplActive = true;
    if (!this.pythonEngine && window.PythonEngine) {
      this.pythonEngine = new window.PythonEngine(this.device);
    }
    this.print(`Python 3.12.3 (main, Mar 10 2026, 12:45:10) [GCC 13.2.0] on linux`);
    this.print(`Type "help", "copyright", "credits" or "license" for more information.`);
    this.print(`Type 'exit()' or 'quit()' to return to Linux bash.\n`);
    this.updatePrompt('>>> ');
  }

  handleCat(args) {
    if (args.length === 0) {
      this.print("cat: missing file operand");
      return;
    }
    const file = args[0];
    const fullPath = file.startsWith('/') ? file : `${this.currentPath}/${file}`.replace(/\/+/g, '/');
    if (this.fs[fullPath]) {
      this.print(this.fs[fullPath]);
    } else {
      this.print(`cat: ${file}: No such file or directory`);
    }
  }

  handleLs(args) {
    const isAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
    if (this.currentPath === '/home/student') {
      if (isAll) this.print(".  ..  .bashrc  .profile  welcome.txt");
      else this.print("welcome.txt");
    } else if (this.currentPath === '/etc') {
      this.print("hosts  hostname  network  os-release  resolv.conf");
    } else if (this.currentPath === '/') {
      this.print("bin  boot  dev  etc  home  lib  proc  root  sys  tmp  usr  var");
    } else {
      this.print("");
    }
  }

  handleCd(args) {
    if (args.length === 0 || args[0] === '~') {
      this.currentPath = (this.currentUser === 'root') ? '/root' : '/home/student';
      return;
    }
    const target = args[0];
    if (target === '/') this.currentPath = '/';
    else if (target === '/etc' || target === 'etc') this.currentPath = '/etc';
    else if (target === '..') {
      const parts = this.currentPath.split('/').filter(Boolean);
      parts.pop();
      this.currentPath = '/' + parts.join('/');
      if (!this.currentPath) this.currentPath = '/';
    } else {
      this.print(`bash: cd: ${target}: No such file or directory`);
    }
  }

  handleSudo(args) {
    if (args.length === 0 || args[0] === 'su' || args[0] === '-i') {
      this.currentUser = 'root';
      this.currentPath = '/root';
      this.print("");
      return;
    }
    // Execute remaining as root temporarily
    const savedUser = this.currentUser;
    this.currentUser = 'root';
    this.handleCommand(args.join(' '));
    this.currentUser = savedUser;
  }

  handleSystemctl(args) {
    const act = args[0] || 'status';
    const srv = args[1] || 'networking';
    this.print(`● ${srv}.service - ${srv.toUpperCase()} Service`);
    this.print(`     Loaded: loaded (/lib/systemd/system/${srv}.service; enabled; vendor preset: enabled)`);
    this.print(`     Active: active (running) since Tue 2026-11-11 12:00:00 CET; 2h ago`);
    this.print(`   Main PID: 452 (${srv})`);
    this.print(`      Tasks: 2 (limit: 4915)`);
    this.print(`     Memory: 6.4M`);
    this.print(`     CGroup: /system.slice/${srv}.service\n`);
  }

  printHelp() {
    this.print("\nPXL Linux Terminal (Bash) Commands:");
    this.print("  ip addr / ip a            Show IP addresses and network interfaces");
    this.print("  ifconfig                  Classic Linux network interface configuration");
    this.print("  ping <ip>                 ICMP echo request to target IP");
    this.print("  traceroute <ip>           Trace network route to destination host");
    this.print("  ip route / route -n       Display Linux kernel routing table");
    this.print("  netstat -tuln / ss        Display active listening TCP/UDP sockets");
    this.print("  curl <url>                Transfer data from HTTP web servers");
    this.print("  wget <url>                Download web page or file via HTTP");
    this.print("  ssh [user@]host           Open secure shell to Cisco, HPE, MikroTik, or Server");
    this.print("  telnet <host> [port]      Open Telnet terminal session to Cisco, HPE, or MikroTik");
    this.print("  python3 / python          Start interactive Python 3.12 REPL");
    this.print("  cat <file>                Print content of file (e.g. /etc/resolv.conf)");
    this.print("  sudo su / su              Elevate privileges to root administrator");
    this.print("  ls, pwd, cd, whoami       Linux directory navigation and information");
    this.print("  clear                     Clear terminal screen");
    this.print("");
  }

  tabComplete(inputLine) {
    if (this.activeSshSession && this.activeSshSession.parser && typeof this.activeSshSession.parser.tabComplete === 'function') {
      return this.activeSshSession.parser.tabComplete(inputLine);
    }
    const commands = [
      'ip addr', 'ip a', 'ip link', 'ip route', 'ifconfig', 'ping', 'traceroute',
      'netstat -tuln', 'ss -tulpn', 'route -n', 'curl http://', 'wget http://',
      'ssh admin@', 'telnet ', 'python3', 'cat /etc/resolv.conf', 'cat /etc/hosts',
      'sudo su', 'uname -a', 'clear', 'help'
    ];
    const match = commands.find(c => c.startsWith(inputLine.trim()));
    if (match) return match + ' ';
    return inputLine;
  }
}

if (typeof window !== 'undefined') {
  window.LinuxCLIHandler = LinuxCLIHandler;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LinuxCLIHandler };
}
