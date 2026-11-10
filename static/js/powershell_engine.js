/**
 * powershell_engine.js - Windows PowerShell Simulation Engine
 * PXL Web NetSim • Hogeschool PXL (Toegepaste Informatica / SNE)
 * Supports PC, Laptop, and Server devices with realistic cmdlets, formatting, and tab completion.
 */

class PowerShellHandler {
  constructor(device, printCallback, triggerScoreUpdate, updatePromptCallback) {
    this.device = device;
    this.print = printCallback || console.log;
    this.triggerScoreUpdate = triggerScoreUpdate || (() => {});
    this.updatePrompt = updatePromptCallback || (() => {});
    this.activeSshSession = null;
    this.currentPath = device.type === 'server' ? 'C:\\Users\\Administrator' : 'C:\\Users\\Student';
    this.variables = {
      'env:COMPUTERNAME': device.hostname || device.name,
      'env:USERNAME': device.type === 'server' ? 'Administrator' : 'Student',
      'env:USERDOMAIN': 'PXL-LAB',
      'env:SYSTEMROOT': 'C:\\Windows'
    };

    // Simulated virtual filesystem per device
    if (!device.fileSystem) {
      this.initFileSystem();
    }
  }

  initFileSystem() {
    const dev = this.device;
    const isServer = dev.type === 'server';
    dev.fileSystem = {
      'C:\\': ['Users', 'Windows', 'Program Files'].concat(isServer ? ['inetpub', 'DNS'] : []),
      'C:\\Users': isServer ? ['Administrator', 'Public'] : ['Student', 'Public'],
      [this.currentPath]: ['Desktop', 'Documents', 'Downloads'],
      [`${this.currentPath}\\Desktop`]: ['notes.txt'],
      [`${this.currentPath}\\Documents`]: ['Labo_Opdracht.txt'],
      [`${this.currentPath}\\Downloads`]: []
    };

    dev.fileContents = {
      [`${this.currentPath}\\Desktop\\notes.txt`]: "PXL Network Essentials - PowerShell Lab Notes\nGebruik 'Get-NetIPConfiguration' of 'gip' om je IP-instellingen te bekijken.",
      [`${this.currentPath}\\Documents\\Labo_Opdracht.txt`]: "Welkom bij het PXL Netwerken labo!\nTest connectiviteit via: Test-NetConnection of tnc <ip>."
    };

    if (isServer) {
      dev.fileSystem['C:\\inetpub'] = ['wwwroot'];
      dev.fileSystem['C:\\inetpub\\wwwroot'] = ['index.html', 'style.css', 'data.json'];
      dev.fileContents['C:\\inetpub\\wwwroot\\index.html'] = dev.services?.http?.content || '<h1>PXL Web Server</h1>\n<p>Welkom op de server!</p>';
      dev.fileContents['C:\\inetpub\\wwwroot\\style.css'] = 'body { font-family: sans-serif; background: #f0f4f8; color: #1e293b; padding: 20px; }';
      dev.fileContents['C:\\inetpub\\wwwroot\\data.json'] = JSON.stringify({ status: 'online', school: 'Hogeschool PXL', course: 'Network Essentials' }, null, 2);
    }
  }

  getPrompt() {
    return `PS ${this.currentPath}> `;
  }

  handleCommand(rawLine) {
    const dev = this.device;
    const line = rawLine.trim();

    // Remote SSH session delegation (Cisco, MikroTik, OpenWrt)
    if (this.activeSshSession) {
      if (line.toLowerCase() === 'exit' || line.toLowerCase() === 'quit') {
        const remoteName = this.activeSshSession.targetDev.hostname || 'remote';
        this.print(`[Connection to ${remoteName} closed]`);
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

    if (!line) {
      this.print("");
      return;
    }

    dev.history.push(line);
    dev.historyIndex = dev.history.length;

    // Handle variable assignments: $x = "val"
    if (line.startsWith('$') && line.includes('=')) {
      const eqIdx = line.indexOf('=');
      const varName = line.substring(1, eqIdx).trim();
      const varVal = line.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      this.variables[varName] = varVal;
      return;
    }

    // Split command and arguments respecting quotes
    const tokens = this.tokenize(line);
    if (tokens.length === 0) return;

    let cmd = tokens[0];
    const args = tokens.slice(1);

    // Normalize command/alias
    const cmdLower = cmd.toLowerCase();

    switch (cmdLower) {
      // 1. IP Configuration Cmdlets
      case 'get-netipaddress':
      case 'gip':
        this.cmdGetNetIPAddress(args);
        break;

      case 'get-netipconfiguration':
      case 'gipconfig':
        this.cmdGetNetIPConfiguration(args);
        break;

      case 'set-netipaddress':
      case 'new-netipaddress':
        this.cmdSetNetIPAddress(args);
        break;

      case 'set-dnsclientserveraddress':
        this.cmdSetDnsClientServerAddress(args);
        break;

      case 'ipconfig':
        this.cmdIpconfig(args);
        break;

      // 2. Connectivity & Diagnostics
      case 'test-netconnection':
      case 'tnc':
        this.cmdTestNetConnection(args);
        break;

      case 'test-connection':
      case 'ping':
        this.cmdTestConnection(args);
        break;

      case 'tracert':
      case 'traceroute':
        this.cmdTracert(args);
        break;

      case 'resolve-dnsname':
        this.cmdResolveDnsName(args);
        break;

      case 'nslookup':
        this.cmdNslookup(args);
        break;

      // 3. Web & HTTP Requests
      case 'invoke-webrequest':
      case 'iwr':
      case 'curl':
      case 'wget':
        this.cmdInvokeWebRequest(args);
        break;

      case 'invoke-restmethod':
      case 'irm':
        this.cmdInvokeRestMethod(args);
        break;

      // 4. L2/L3 Network Tables
      case 'get-netneighbor':
      case 'arp':
        this.cmdGetNetNeighbor(args);
        break;

      case 'get-netroute':
      case 'route':
        this.cmdGetNetRoute(args);
        break;

      // 5. Remote Access
      case 'ssh':
        this.cmdSsh(args);
        break;

      // 6. Navigation & File System
      case 'get-location':
      case 'pwd':
      case 'gl':
        this.print(`\nPath\n----\n${this.currentPath}\n`);
        break;

      case 'set-location':
      case 'cd':
      case 'sl':
        this.cmdSetLocation(args);
        break;

      case 'get-childitem':
      case 'dir':
      case 'ls':
      case 'gci':
        this.cmdGetChildItem(args);
        break;

      case 'get-content':
      case 'cat':
      case 'type':
      case 'gc':
        this.cmdGetContent(args);
        break;

      case 'set-content':
      case 'out-file':
      case 'sc':
        this.cmdSetContent(args);
        break;

      // 7. System & Services
      case 'get-service':
      case 'gsv':
        this.cmdGetService(args);
        break;

      case 'start-service':
      case 'stop-service':
      case 'restart-service':
        this.cmdManageService(cmdLower, args);
        break;

      case 'get-process':
      case 'ps':
      case 'gps':
        this.cmdGetProcess(args);
        break;

      case 'get-date':
        this.print(new Date().toLocaleString('nl-BE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        break;

      case 'hostname':
        this.print(dev.hostname || dev.name);
        break;

      case 'whoami':
        this.print(`PXL-LAB\\${dev.type === 'server' ? 'Administrator' : 'Student'}`);
        break;

      case 'clear-host':
      case 'cls':
      case 'clear':
        if (window.PXLApp) window.PXLApp.clearActiveTerminal();
        break;

      case 'write-host':
      case 'write-output':
      case 'echo':
        this.print(args.join(' '));
        break;

      case '$psversiontable':
        this.print(`
Name                           Value
----                           -----
PSVersion                      7.4.2 (NetSim PXL Core)
PSEdition                      Core
GitCommitId                    7.4.2-pxl-education
OS                             Microsoft Windows 11 Education 10.0.22631
Platform                       Win32NT
PSCompatibleVersions           {1.0, 2.0, 3.0, 4.0, 5.0, 5.1, 6.0, 7.0, 7.4}
PSRemotingProtocolVersion      2.3
SerializationVersion           1.1.0.1
WSManStackVersion              3.0
`);
        break;

      case 'get-help':
      case 'help':
        this.cmdHelp(args);
        break;

      default:
        // Check if user entered variable name: $var
        if (cmd.startsWith('$')) {
          const varName = cmd.substring(1);
          if (this.variables[varName] !== undefined) {
            this.print(this.variables[varName]);
            break;
          }
        }
        this.print(`${cmd} : The term '${cmd}' is not recognized as the name of a cmdlet, function, script file, or operable program.`);
        this.print(`Check the spelling of the name, or if a path was included, verify that the path is correct and try again.`);
        this.print(`At line:1 char:1\n+ ${line}\n+ ~~~~~\n    + CategoryInfo          : ObjectNotFound: (${cmd}:String) [], CommandNotFoundException\n    + FullyQualifiedErrorId : CommandNotFoundException\n`);
    }

    if (this.triggerScoreUpdate) this.triggerScoreUpdate();
  }

  tokenize(str) {
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    const tokens = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
      tokens.push(match[1] || match[2] || match[0]);
    }
    return tokens;
  }

  // --- CMDLET IMPLEMENTATIONS ---

  cmdGetNetIPAddress(args) {
    const dev = this.device;
    const intfName = dev.type === 'laptop' ? 'Wireless0' : 'Ethernet0';
    const cidr = dev.mask ? (IPUtils.maskToPrefix ? IPUtils.maskToPrefix(dev.mask) : 24) : 24;

    this.print(`
IPAddress         : ${dev.ip || '0.0.0.0'}
InterfaceIndex    : 12
InterfaceAlias    : ${intfName}
AddressFamily     : IPv4
Type              : Unicast
PrefixLength      : ${cidr}
PrefixOrigin      : ${dev.dhcpEnabled ? 'Dhcp' : 'Manual'}
SuffixOrigin      : ${dev.dhcpEnabled ? 'Dhcp' : 'Manual'}
AddressState      : Preferred
ValidLifetime     : Infinite
PreferredLifetime : Infinite
SkipAsSource      : False
`);
  }

  cmdGetNetIPConfiguration(args) {
    const dev = this.device;
    const intfName = dev.type === 'laptop' ? 'Wireless0' : 'Ethernet0';
    const cidr = dev.mask ? (IPUtils.maskToPrefix ? IPUtils.maskToPrefix(dev.mask) : 24) : 24;

    this.print(`
InterfaceAlias               : ${intfName}
InterfaceIndex               : 12
InterfaceDescription         : Realtek PCIe GbE Family Controller (PXL NetSim)
NetProfile.Name              : PXL-Netwerk
IPv4Address                  : ${dev.ip || '0.0.0.0'}
IPv4DefaultGateway           : ${dev.gateway || ''}
DNSServer                    : ${dev.dns || '8.8.8.8'}
`);
  }

  cmdSetNetIPAddress(args) {
    const dev = this.device;
    let ip = '';
    let prefix = 24;
    let gw = '';

    for (let i = 0; i < args.length; i++) {
      const a = args[i].toLowerCase();
      if ((a === '-ipaddress' || a === '-ip') && args[i + 1]) ip = args[i + 1];
      if ((a === '-prefixlength' || a === '-prefix') && args[i + 1]) prefix = parseInt(args[i + 1], 10);
      if ((a === '-defaultgateway' || a === '-gateway') && args[i + 1]) gw = args[i + 1];
    }

    if (!ip && args.length > 0 && IPUtils.isValidIp(args[0])) {
      ip = args[0];
      if (args[1] && !isNaN(args[1])) prefix = parseInt(args[1], 10);
    }

    if (!ip || !IPUtils.isValidIp(ip)) {
      this.print("Set-NetIPAddress : Missing or invalid -IPAddress parameter.");
      return;
    }

    dev.ip = ip;
    dev.mask = IPUtils.prefixToMask ? IPUtils.prefixToMask(prefix) : '255.255.255.0';
    dev.dhcpEnabled = false;
    if (gw && IPUtils.isValidIp(gw)) dev.gateway = gw;

    // Synchronize interface
    const intfName = dev.type === 'laptop' ? 'Wireless0' : 'FastEthernet0';
    if (dev.interfaces && dev.interfaces[intfName]) {
      dev.interfaces[intfName].ip = dev.ip;
      dev.interfaces[intfName].mask = dev.mask;
      dev.interfaces[intfName].shutdown = false;
    }

    this.print(`Set-NetIPAddress : IPv4-adres ${dev.ip}/${prefix} succesvol ingesteld op interface.`);
    if (window.PXLApp) window.PXLApp.showToast(`✅ PowerShell: IP geconfigureerd naar ${dev.ip}/${prefix}`);
  }

  cmdSetDnsClientServerAddress(args) {
    const dev = this.device;
    let dns = '';

    for (let i = 0; i < args.length; i++) {
      const a = args[i].toLowerCase();
      if ((a === '-serveraddresses' || a === '-addresses') && args[i + 1]) {
        dns = args[i + 1].replace(/[()'"\s]/g, '');
      }
    }

    if (!dns && args[0]) {
      dns = args[0].replace(/[()'"\s]/g, '');
    }

    if (dns) {
      dev.dns = dns;
      this.print(`Set-DnsClientServerAddress : DNS-serveradressen succesvol ingesteld op ${dev.dns}`);
      if (window.PXLApp) window.PXLApp.showToast(`✅ PowerShell: DNS-server ingesteld op ${dev.dns}`);
    } else {
      this.print("Set-DnsClientServerAddress : Geen geldig serveradres opgegeven.");
    }
  }

  cmdIpconfig(args) {
    const dev = this.device;
    const isAll = args.includes('/all') || args.includes('-all');

    if (args.includes('/renew')) {
      this.print("\nWindows IP Configuration\n\nVernieuwen van DHCP lease voor Ethernet0...");
      dev.dhcpEnabled = true;
      this.print(`IPv4 Address. . . . . . . . . . . : ${dev.ip || '192.168.1.100'}`);
      this.print(`Subnet Mask . . . . . . . . . . . : ${dev.mask || '255.255.255.0'}`);
      this.print(`Default Gateway . . . . . . . . . : ${dev.gateway || '192.168.1.1'}\n`);
      return;
    }

    if (args.includes('/release')) {
      this.print("\nWindows IP Configuration\n\nDHCP lease vrijgegeven voor Ethernet0.");
      dev.ip = '0.0.0.0';
      dev.mask = '0.0.0.0';
      dev.gateway = '';
      return;
    }

    if (args.includes('/flushdns')) {
      this.print("\nWindows IP Configuration\n\nSuccessfully flushed the DNS Resolver Cache.\n");
      return;
    }

    this.print("\nWindows IP Configuration\n");
    if (isAll) {
      this.print(`   Host Name . . . . . . . . . . . . : ${dev.hostname}`);
      this.print(`   Primary Dns Suffix  . . . . . . . : pxl.be`);
      this.print(`   Node Type . . . . . . . . . . . . : Hybrid`);
      this.print(`   IP Routing Enabled. . . . . . . . : ${dev.type === 'server' ? 'Yes' : 'No'}\n`);
    }

    const intf = dev.interfaces['FastEthernet0'] || dev.interfaces['Wireless0'] || {};
    this.print(`Ethernet adapter ${dev.type === 'laptop' ? 'Wireless0' : 'Ethernet0'}:`);
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

  cmdTestNetConnection(args) {
    if (args.length === 0) {
      this.print("Test-NetConnection : Missing ComputerName or target.");
      return;
    }

    let target = args[0];
    let port = 0;
    let traceRoute = false;

    for (let i = 0; i < args.length; i++) {
      const a = args[i].toLowerCase();
      if ((a === '-computername' || a === '-target' || a === '-cn') && args[i + 1]) target = args[i + 1];
      if ((a === '-port' || a === '-p') && args[i + 1]) port = parseInt(args[i + 1], 10);
      if (a === '-traceroute' || a === '-tr') traceRoute = true;
    }

    target = target.replace(/^https?:\/\//i, '').split('/')[0];
    const sim = window.PXLNetworkSim;
    if (!sim) {
      this.print("Test-NetConnection : Simulation engine not available.");
      return;
    }

    let targetIp = target;
    let resolved = true;
    if (!IPUtils.isValidIp(target)) {
      const dnsRes = sim.resolveDns(this.device.id, target);
      if (dnsRes.success) {
        targetIp = dnsRes.ip;
      } else {
        resolved = false;
      }
    }

    if (!resolved) {
      this.print(`WARNING: Name resolution of ${target} failed`);
      this.print(`
ComputerName   : ${target}
RemoteAddress  :
InterfaceAlias : Ethernet0
SourceAddress  : ${this.device.ip || '0.0.0.0'}
PingSucceeded  : False
`);
      return;
    }

    const ping = sim.executePing(this.device.id, targetIp);
    const pingOk = ping.success;

    let tcpOk = false;
    if (port > 0) {
      if (pingOk) {
        // Port 80 / 443 (HTTP/HTTPS) or Port 53 (DNS) or Port 21 (FTP) or Port 22 (SSH)
        const dst = sim.findDeviceByIp(targetIp);
        if (dst && dst.device) {
          if (port === 80 || port === 443) tcpOk = !!dst.device.services?.http?.enabled;
          else if (port === 53) tcpOk = !!dst.device.services?.dns?.enabled;
          else if (port === 21) tcpOk = !!dst.device.services?.ftp?.enabled;
          else if (port === 22) tcpOk = (dst.device.type === 'mikrotik' || dst.device.type === 'openwrt' || dst.device.type === 'router' || dst.device.type === 'switch');
          else tcpOk = true;
        } else if (ping.hops.includes('Het Internet') || sim.liveInternetEnabled) {
          tcpOk = true; // Global Internet handles standard ports
        }
      }
    }

    this.print(`
ComputerName           : ${target}
RemoteAddress          : ${targetIp}
InterfaceAlias         : ${this.device.type === 'laptop' ? 'Wireless0' : 'Ethernet0'}
SourceAddress          : ${this.device.ip || '0.0.0.0'}
PingSucceeded          : ${pingOk ? 'True' : 'False'}
PingReplyDetails (RTT) : ${pingOk ? (Math.floor(Math.random() * 4) + 1) + ' ms' : '0 ms'}
${port > 0 ? `TcpTestSucceeded       : ${tcpOk ? 'True' : 'False'}\nRemotePort             : ${port}` : ''}
`);

    if (traceRoute && pingOk) {
      const hops = sim.traceRoute(this.device.id, targetIp);
      this.print("TraceRoute :");
      hops.forEach((h, i) => this.print(`  Hop ${i + 1} : ${h}`));
      this.print("");
    }
  }

  cmdTestConnection(args) {
    if (args.length === 0) {
      this.print("Test-Connection : Missing destination target.");
      return;
    }

    let target = args[0];
    let count = 4;
    for (let i = 0; i < args.length; i++) {
      const a = args[i].toLowerCase();
      if ((a === '-computername' || a === '-target') && args[i + 1]) target = args[i + 1];
      if ((a === '-count' || a === '-n') && args[i + 1]) count = parseInt(args[i + 1], 10) || 4;
    }

    target = target.replace(/^https?:\/\//i, '').split('/')[0];
    const sim = window.PXLNetworkSim;
    if (!sim) {
      this.print("Test-Connection : Simulation engine not active.");
      return;
    }

    let targetIp = target;
    if (!IPUtils.isValidIp(target)) {
      const dnsRes = sim.resolveDns(this.device.id, target);
      if (dnsRes.success) {
        targetIp = dnsRes.ip;
      } else {
        this.print(`Test-Connection : Testing connection to computer '${target}' failed: Name resolution failed.`);
        return;
      }
    }

    const res = sim.executePing(this.device.id, targetIp);
    this.print(`\n   Destination: ${target} (${targetIp})\n`);
    this.print("Pinging " + targetIp + " with 32 bytes of data:\n");

    if (res.success) {
      for (let i = 0; i < count; i++) {
        const rtt = Math.floor(Math.random() * 3) + 1;
        this.print(`Reply from ${targetIp}: bytes=32 time=${rtt}ms TTL=128`);
      }
      this.print(`\nPing statistics for ${targetIp}:`);
      this.print(`    Packets: Sent = ${count}, Received = ${count}, Lost = 0 (0% loss)`);
      this.print(`    Average round trip time: 2 ms\n`);
    } else {
      for (let i = 0; i < count; i++) {
        this.print("Request timed out.");
      }
      this.print(`\nPing statistics for ${targetIp}:`);
      this.print(`    Packets: Sent = ${count}, Received = 0, Lost = ${count} (100% loss)\n`);
    }
  }

  cmdTracert(args) {
    if (args.length === 0) {
      this.print("tracert : Missing target address or hostname.");
      return;
    }
    const target = args[0];
    this.print(`\nTracing route to ${target} over a maximum of 30 hops:\n`);
    const sim = window.PXLNetworkSim;
    if (sim) {
      const hops = sim.traceRoute(this.device.id, target);
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

  cmdResolveDnsName(args) {
    if (args.length === 0) {
      this.print("Resolve-DnsName : Missing Name parameter.");
      return;
    }

    let name = args[0];
    let recordType = 'A';
    for (let i = 0; i < args.length; i++) {
      const a = args[i].toLowerCase();
      if ((a === '-name' || a === '-n') && args[i + 1]) name = args[i + 1];
      if ((a === '-type' || a === '-t') && args[i + 1]) recordType = args[i + 1].toUpperCase();
    }

    const sim = window.PXLNetworkSim;
    if (!sim) {
      this.print("Resolve-DnsName : Simulator offline.");
      return;
    }

    const res = sim.resolveDns(this.device.id, name);
    if (res.success) {
      this.print(`
Name                                           Type   TTL   Section    IPAddress
----                                           ----   ---   -------    ---------
${name.padEnd(46, ' ')} ${recordType.padEnd(6, ' ')} 300   Answer     ${res.ip}
`);
    } else {
      this.print(`Resolve-DnsName : ${name} : DNS name does not exist.`);
      this.print(`At line:1 char:1\n+ Resolve-DnsName ${name}\n+ ~~~~~~~~~~~~~~~~~~~~~~~\n    + CategoryInfo          : ResourceUnavailable: (${name}:String) [Resolve-DnsName], Win32Exception\n    + FullyQualifiedErrorId : DNS_ERROR_RCODE_NAME_ERROR\n`);
    }
  }

  cmdNslookup(args) {
    if (args.length === 0) {
      this.print(`Default Server:  ${this.device.dns || 'Unknown'}\nAddress:  ${this.device.dns || '0.0.0.0'}\n`);
      return;
    }
    const host = args[0];
    this.print(`Server:  dns.pxl.be\nAddress:  ${this.device.dns || '8.8.8.8'}\n`);
    const sim = window.PXLNetworkSim;
    if (sim) {
      const res = sim.resolveDns(this.device.id, host);
      if (res.success) {
        this.print(`Name:    ${host}\nAddress: ${res.ip}\n`);
      } else {
        this.print(`*** dns.pxl.be can't find ${host}: Non-existent domain\n`);
      }
    }
  }

  cmdInvokeWebRequest(args) {
    if (args.length === 0) {
      this.print("Invoke-WebRequest : Cannot validate argument on parameter 'Uri'. Parameter is null or empty.");
      return;
    }

    let url = args[0];
    for (let i = 0; i < args.length; i++) {
      if ((args[i].toLowerCase() === '-uri' || args[i].toLowerCase() === '-url') && args[i + 1]) {
        url = args[i + 1];
      }
    }

    const sim = window.PXLNetworkSim;
    if (!sim) {
      this.print("Invoke-WebRequest : Simulator engine unavailable.");
      return;
    }

    const res = sim.fetchHttp(this.device.id, url);
    if (!res.success) {
      this.print(`Invoke-WebRequest : The remote name could not be resolved or server unreachable: '${url}'`);
      this.print(`At line:1 char:1\n+ Invoke-WebRequest ${url}\n+ ~~~~~~~~~~~~~~~~~~~~~~~~~~\n    + CategoryInfo          : InvalidOperation: (System.Net.HttpWebRequest) [Invoke-WebRequest], WebException\n    + FullyQualifiedErrorId : WebCmdletWebResponseException\n`);
      return;
    }

    const contentSnippet = res.isLiveProxy ? `[Live Internet Proxy Response from ${res.liveUrl}]` : (res.html || '').substring(0, 400);

    this.print(`
StatusCode        : 200
StatusDescription : OK
Content           : ${contentSnippet.replace(/\n/g, ' ').substring(0, 120)}...
RawContent        : HTTP/1.1 200 OK
                    Content-Type: text/html; charset=utf-8
                    Server: PXL-NetSim/2.1 (Hogeschool PXL SNE)
                    Date: ${new Date().toUTCString()}
                    Content-Length: ${(res.html || '').length}

Headers           : {[Content-Type, text/html; charset=utf-8], [Server, PXL-NetSim/2.1]}
Images            : {}
InputFields       : {}
Links             : {}
ParsedHtml        : mshtml.HTMLDocumentClass
`);
  }

  cmdInvokeRestMethod(args) {
    if (args.length === 0) {
      this.print("Invoke-RestMethod : Missing -Uri parameter.");
      return;
    }
    const url = args[0].replace(/^-uri\s+/i, '');
    const sim = window.PXLNetworkSim;
    if (!sim) return;

    const res = sim.fetchHttp(this.device.id, url);
    if (res.success) {
      this.print(`\n{\n  "status": "success",\n  "target": "${url}",\n  "timestamp": "${new Date().toISOString()}",\n  "gateway": "${this.device.gateway}"\n}\n`);
    } else {
      this.print(`Invoke-RestMethod : Request failed: ${res.reason}`);
    }
  }

  cmdGetNetNeighbor(args) {
    const dev = this.device;
    this.print(`
ifIndex IPAddress                     LinkLayerAddress      State       PolicyStore
------- ---------                     ----------------      -----       -----------
12      ${dev.gateway || '192.168.1.1'}           00-50-79-66-68-02     Reachable   ActiveStore
12      224.0.0.22                    01-00-5e-00-00-16     Permanent   ActiveStore
12      239.255.255.250               01-00-5e-7f-ff-fa     Permanent   ActiveStore
`);
  }

  cmdGetNetRoute(args) {
    const dev = this.device;
    const cidr = dev.mask ? (IPUtils.maskToPrefix ? IPUtils.maskToPrefix(dev.mask) : 24) : 24;
    const net = dev.ip && dev.mask ? IPUtils.getNetworkAddress(dev.ip, dev.mask) : '192.168.1.0';

    this.print(`
ifIndex DestinationPrefix       NextHop               RouteMetric ifMetric PolicyStore
------- -----------------       -------               ----------- -------- -----------
12      0.0.0.0/0               ${(dev.gateway || '0.0.0.0').padEnd(21, ' ')} 25          0        ActiveStore
12      ${(net + '/' + cidr).padEnd(23, ' ')} On-link               256         0        ActiveStore
12      ${(dev.ip || '127.0.0.1') + '/32' + ' '.repeat(Math.max(0, 23 - (dev.ip || '127.0.0.1').length - 3))} On-link               256         0        ActiveStore
12      255.255.255.255/32      On-link               256         0        ActiveStore
`);
  }

  cmdSsh(args) {
    if (args.length === 0) {
      this.print("ssh : Missing destination user or IP (e.g. ssh admin@192.168.88.1).");
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

    const sim = window.PXLNetworkSim;
    if (!sim) {
      this.print("ssh : Simulator not ready.");
      return;
    }

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

    if (targetDev.type === 'mikrotik') {
      this.print(`\nMikroTik RouterOS 7.12 (c) 1994-2026`);
      this.print(`Connected over SSH session as '${user}'.`);
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

    if (targetDev.type === 'openwrt') {
      this.print(`\nOpenWrt 23.05 - Dropbear SSH Session active.`);
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

    if (targetDev.type === 'router' || targetDev.type === 'switch') {
      this.print(`\nOpen SSH session to ${targetDev.hostname} (${targetIp})`);
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

    this.print(`ssh: connect to host ${targetIp} port 22: Service unavailable on device type.`);
  }

  cmdSetLocation(args) {
    if (args.length === 0) return;
    let target = args[0].replace(/\//g, '\\');

    if (target === '..') {
      const parts = this.currentPath.split('\\');
      if (parts.length > 1) {
        parts.pop();
        this.currentPath = parts.join('\\') || 'C:\\';
      }
      this.updatePrompt(this.getPrompt());
      return;
    }

    if (target === '\\' || target.toLowerCase() === 'c:\\') {
      this.currentPath = 'C:\\';
      this.updatePrompt(this.getPrompt());
      return;
    }

    let resolved = target.startsWith('C:\\') ? target : `${this.currentPath}\\${target}`;
    resolved = resolved.replace(/\\\\+/g, '\\');

    if (this.device.fileSystem && this.device.fileSystem[resolved]) {
      this.currentPath = resolved;
      this.updatePrompt(this.getPrompt());
    } else {
      this.print(`Set-Location : Cannot find path '${resolved}' because it does not exist.`);
    }
  }

  cmdGetChildItem(args) {
    const fs = this.device.fileSystem || {};
    const items = fs[this.currentPath] || [];

    this.print(`
    Directory: ${this.currentPath}

Mode                 LastWriteTime         Length Name
----                 -------------         ------ ----`);

    items.forEach(item => {
      const fullPath = `${this.currentPath}\\${item}`;
      const isDir = !!fs[fullPath];
      const mode = isDir ? 'd-----' : '-a----';
      const size = isDir ? '' : (this.device.fileContents?.[fullPath]?.length || 1024).toString().padStart(6, ' ');
      const time = '10/11/2026  12:00';
      this.print(`${mode}          ${time}         ${size.padStart(6, ' ')} ${item}`);
    });
    this.print("");
  }

  cmdGetContent(args) {
    if (args.length === 0) {
      this.print("Get-Content : Missing path argument.");
      return;
    }
    const filename = args[0];
    const fullPath = filename.startsWith('C:\\') ? filename : `${this.currentPath}\\${filename}`;
    const content = this.device.fileContents?.[fullPath];

    if (content !== undefined) {
      this.print(content);
    } else {
      this.print(`Get-Content : Cannot find path '${fullPath}' because it does not exist.`);
    }
  }

  cmdSetContent(args) {
    if (args.length < 2) {
      this.print("Set-Content : Usage: Set-Content <filename> <content>");
      return;
    }
    const filename = args[0];
    const text = args.slice(1).join(' ');
    const fullPath = filename.startsWith('C:\\') ? filename : `${this.currentPath}\\${filename}`;

    if (!this.device.fileContents) this.device.fileContents = {};
    this.device.fileContents[fullPath] = text;

    // Add to directory list if not present
    if (!this.device.fileSystem) this.device.fileSystem = {};
    if (!this.device.fileSystem[this.currentPath]) this.device.fileSystem[this.currentPath] = [];
    if (!this.device.fileSystem[this.currentPath].includes(filename)) {
      this.device.fileSystem[this.currentPath].push(filename);
    }

    this.print(`Set-Content : Inhoud succesvol weggeschreven naar '${filename}'.`);
  }

  cmdGetService(args) {
    const dev = this.device;
    const isServer = dev.type === 'server';
    const s = dev.services || {};

    this.print(`
Status   Name               DisplayName
------   ----               -----------
${isServer && s.http?.enabled ? 'Running ' : 'Stopped '} W3SVC              World Wide Web Publishing Service
${isServer && s.dns?.enabled ? 'Running ' : 'Stopped '} DNS                DNS Server Service
${isServer && s.ftp?.enabled ? 'Running ' : 'Stopped '} FTPSVC             Microsoft FTP Service
Running  Dhcp               DHCP Client
Running  Dnscache           DNS Client
Running  LanmanWorkstation  Workstation
`);
  }

  cmdManageService(action, args) {
    if (args.length === 0) {
      this.print(`${action} : Geef een servicenaam op (bv. W3SVC, DNS, FTPSVC).`);
      return;
    }

    const srvName = args[0].toUpperCase();
    const dev = this.device;
    if (dev.type !== 'server') {
      this.print(`${action} : Serverrollen zijn enkel beschikbaar op Server-apparaten.`);
      return;
    }

    if (!dev.services) dev.services = { http: { enabled: true }, dns: { enabled: true }, ftp: { enabled: true } };

    if (srvName === 'W3SVC') {
      dev.services.http.enabled = (action === 'start-service' || action === 'restart-service');
      this.print(`Service 'World Wide Web Publishing Service (W3SVC)' is nu ${dev.services.http.enabled ? 'Running' : 'Stopped'}.`);
    } else if (srvName === 'DNS') {
      dev.services.dns.enabled = (action === 'start-service' || action === 'restart-service');
      this.print(`Service 'DNS Server Service (DNS)' is nu ${dev.services.dns.enabled ? 'Running' : 'Stopped'}.`);
    } else if (srvName === 'FTPSVC') {
      dev.services.ftp.enabled = (action === 'start-service' || action === 'restart-service');
      this.print(`Service 'Microsoft FTP Service (FTPSVC)' is nu ${dev.services.ftp.enabled ? 'Running' : 'Stopped'}.`);
    } else {
      this.print(`${action} : Service '${srvName}' niet gevonden.`);
    }

    if (window.PXLApp) window.PXLApp.triggerScoreUpdate();
  }

  cmdGetProcess(args) {
    this.print(`
 NPM(K)    PM(M)      WS(M)     CPU(s)      Id  SI ProcessName
 ------    -----      -----     ------      --  -- -----------
     14    28.45      42.10       0.45    4820   1 powershell
      8     8.12      14.30       0.02    1204   1 explorer
      6     4.20       8.50       0.01     820   0 svchost
      4     2.10       5.20       0.00     312   0 smss
`);
  }

  cmdHelp(args) {
    this.print(`
PXL Web NetSim • PowerShell Commandlet Quick Reference:

Netwerk & IP Configuratie:
  Get-NetIPAddress (gip)                   Toon alle IPv4-adressen en interfaces
  Get-NetIPConfiguration (gipconfig)       Toon IP, Gateway en DNS configuratie
  Set-NetIPAddress / New-NetIPAddress      Configureer IP-adres en subnetmasker
  Set-DnsClientServerAddress               Configureer DNS serveradressen
  ipconfig [/all | /release | /renew]      Windows IP Configuratietool

Connectiviteit & Diagnostiek:
  Test-NetConnection (tnc) <Target> [-Port <p>] Test ICMP ping en TCP poortconnectie
  Test-Connection <Target> [-Count <n>]    PowerShell ping met statistieken
  Resolve-DnsName <Name> [-Type A]         Voer DNS lookups uit
  nslookup <Hostname>                      Klassieke DNS lookup
  tracert <Target>                         Traceer netwerkroute

Web & HTTP:
  Invoke-WebRequest (iwr, curl, wget) <Url> Voer een HTTP GET verzoek uit
  Invoke-RestMethod (irm) <Url>            Haal JSON/REST data op via HTTP

L2/L3 Tabellen & Beheer:
  Get-NetNeighbor (arp -a)                 Bekijk de lokale ARP-tabel
  Get-NetRoute (route print)               Bekijk de IPv4 routingtabel
  ssh <user@ip>                            Beveiligde SSH verbinding naar routers/switches

Bestandsbeheer & Systeem:
  Get-ChildItem (dir, ls)                  Toon bestanden en mappen
  Get-Content (cat, type) <File>           Lees bestand inhoud
  Set-Content (sc) <File> <Text>           Schrijf tekst naar bestand
  Set-Location (cd) <Path>                 Navigeer door mappen
  Get-Location (pwd)                       Toon huidige map
  Get-Service / Start-Service / Stop...    Beheer serverdiensten (W3SVC, DNS)
  Clear-Host (cls, clear)                  Maak het terminalscherm leeg
  $PSVersionTable                          Toon PowerShell versie-informatie
`);
  }

  tabComplete(inputLine) {
    if (this.activeSshSession && this.activeSshSession.parser && typeof this.activeSshSession.parser.tabComplete === 'function') {
      return this.activeSshSession.parser.tabComplete(inputLine);
    }

    const trimmed = inputLine.trim();
    if (!trimmed) return inputLine;

    const cmdlets = [
      'Get-NetIPAddress',
      'Get-NetIPConfiguration',
      'Set-NetIPAddress',
      'New-NetIPAddress',
      'Set-DnsClientServerAddress',
      'Test-NetConnection',
      'Test-Connection',
      'Resolve-DnsName',
      'Invoke-WebRequest',
      'Invoke-RestMethod',
      'Get-NetNeighbor',
      'Get-NetRoute',
      'Get-Service',
      'Start-Service',
      'Stop-Service',
      'Restart-Service',
      'Get-Process',
      'Get-ChildItem',
      'Get-Content',
      'Set-Content',
      'Get-Location',
      'Set-Location',
      'Clear-Host',
      'Write-Host',
      'Get-Date',
      'Get-Help',
      'ipconfig',
      'ipconfig /all',
      'ping',
      'tracert',
      'nslookup',
      'ssh admin@',
      'cls',
      'dir',
      'cat',
      'cd'
    ];

    const match = cmdlets.find(c => c.toLowerCase().startsWith(trimmed.toLowerCase()));
    if (match) return match + ' ';
    return inputLine;
  }
}

if (typeof window !== 'undefined') {
  window.PowerShellHandler = PowerShellHandler;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PowerShellHandler };
}
