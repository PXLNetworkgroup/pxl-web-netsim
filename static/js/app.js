/**
 * app.js - Main Application Coordinator & UI Controller for PXL Web NetSim
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class PXLNetSimApp {
  constructor() {
    this.activeExam = null;
    this.activeDevice = null;
    this.activeTerminalParser = null;
    this.timerSeconds = 80 * 60;
    this.timerInterval = null;

    // Components
    this.sim = window.PXLNetworkSim;
    this.gradingEngine = new GradingEngine();
    this.canvasWorkspace = new CanvasWorkspace('canvasContainer');
    this.simulationEngine = (typeof SimulationEngine !== 'undefined') ? new SimulationEngine(this.sim, this.canvasWorkspace) : null;
    this.teacherStudio = new TeacherStudio(this);
    this.currentUser = null;
    this.autoSaveInterval = null;
    this.activeServiceSubtab = 'http';
    this.isOpdrachtPinned = (localStorage.getItem('pxl_opdracht_pinned') === 'true');

    this.initPresetExams();
    this.initEventListeners();
    this.initDeviceShelf();
    this.startExamTimer();

    // Check authentication & initialize 1-minute auto-save
    this.checkAuthStatus();
    this.initAutoSaveTimer();

    // Initialize 10-second Running-Config scanner & live score updater
    this.initRunningConfigScanner();

    // Load default exam
    this.loadExam(this.presetExams['01_pxl_standard']);
    this.initPinnedPanel();
  }

  initRunningConfigScanner() {
    if (this._runningConfigInterval) {
      clearInterval(this._runningConfigInterval);
    }
    // Automatically inspect running-config and re-evaluate score every 10 seconds
    this._runningConfigInterval = setInterval(() => {
      if (this.activeExam) {
        this.triggerScoreUpdate();
      }
    }, 10000);
  }

  // --- PRESET EXAMS BUNDLED FOR STANDALONE RUNTIME ---
  initPresetExams() {
    this.presetExams = {
      '01_pxl_standard': {
        id: '01_pxl_standard',
        title: 'PXL SNE - Netwerken 1: Basis Router & Switch Configuratie (Gert & David)',
        timeLimitMinutes: 80,
        showLiveScore: true,
        instructions: `## PXL SNE - Netwerken 1: Basis Router & Switch Configuratie
**Cursus:** PXL Netwerken 1 & Routing Essentials (Gert Van Waeyenberg & David Parren)

### Doel van het Examen:
Configureer een redundant Cisco netwerk bestaande uit twee routers (R1, R2), twee switches (SW1, SW2) en twee student pc's (PC1, PC2).

#### Adresseringstabel
| Apparaat | Interface | IP-adres | Subnetmasker | Standaardgateway |
| :--- | :--- | :--- | :--- | :--- |
| **PCA** | FastEthernet0 | 172.16.1.5 | 255.255.255.0 | 172.16.1.1 |
| **SW1** | Vlan1 (SVI) | 172.16.1.254 | 255.255.255.0 | 172.16.1.1 |
| **R1** | GigabitEthernet0/0/0 | 172.16.1.1 | 255.255.255.0 | - |
| **R1** | GigabitEthernet0/0/1 | 192.168.1.161 | 255.255.255.252 | - |
| **R2** | GigabitEthernet0/0/1 | 192.168.1.162 | 255.255.255.252 | - |
| **R2** | GigabitEthernet0/0/0 | 10.11.12.1 | 255.255.255.0 | - |
| **SW2** | Vlan1 (SVI) | 10.11.12.254 | 255.255.255.0 | 10.11.12.1 |
| **PCB** | FastEthernet0 | 10.11.12.5 | 255.255.255.0 | 10.11.12.1 |

#### Doelhostnames van Netwerkapparaten:
* **Router 1**: \`hostname R1\`
* **Router 2**: \`hostname R2\`
* **Switch 1**: \`hostname SW1\`
* **Switch 2**: \`hostname SW2\`

#### Beveiligings- & Wachtwoordeneisen:
* **Enable Secret**: \`class\` op alle routers en switches
* **Line con 0**: \`password cisco\` en activeer \`login\`
* **Banner MOTD**: \`Geautoriseerde toegang alleen!\`
* **Password Encryption**: \`service password-encryption\`

#### Taken & Configuratie-eisen:
1. **Configuratie voor Router R1:**
   * Stel hostname in op \`R1\`.
   * Configureer enable secret, console wachtwoord en banner motd.
   * Schakel \`service password-encryption\` in.
   * Configureer Gi0/0/0 (172.16.1.1/24) en Gi0/0/1 (192.168.1.161/30) met \`no shutdown\`.
   * Voeg statische route toe naar LAN 2: \`ip route 10.11.12.0 255.255.255.0 192.168.1.162\`.
   * Sla configuratie op via \`copy run start\`.

2. **Configuratie voor Router R2:**
   * Stel hostname in op \`R2\`.
   * Configureer basisbeveiliging en password encryption.
   * Configureer Gi0/0/0 (10.11.12.1/24) en Gi0/0/1 (192.168.1.162/30) met \`no shutdown\`.
   * Voeg statische route toe naar LAN 1: \`ip route 172.16.1.0 255.255.255.0 192.168.1.161\`.
   * Sla configuratie op via \`copy run start\`.

3. **Configuratie voor Switches SW1 & SW2:**
   * Stel hostnames in op \`SW1\` en \`SW2\`.
   * Configureer management IP op interface Vlan1 en stel \`ip default-gateway\` in.

4. **Verificatie:**
   * Verifieer dat alle fysieke poorten groen zijn.
   * Voer een succesvolle ping uit van PCA naar PCB (\`10.11.12.5\`).
`,
        initialTopology: {
          devices: [
            { id: 'PCA', type: 'pc', model: 'Standard', hostname: 'PC1', x: 80, y: 240, ip: '172.16.1.5', mask: '255.255.255.0', gateway: '172.16.1.1' },
            { id: 'SW1', type: 'switch', model: '2960-24TT', hostname: 'Switch', x: 260, y: 240 },
            { id: 'R1',  type: 'router', model: '4331', hostname: 'Router', x: 440, y: 240 },
            { id: 'R2',  type: 'router', model: '4331', hostname: 'Router', x: 640, y: 240 },
            { id: 'SW2', type: 'switch', model: '2960-24TT', hostname: 'Switch', x: 820, y: 240 },
            { id: 'PCB', type: 'pc', model: 'Standard', hostname: 'PC2', x: 1000, y: 240, ip: '10.11.12.5', mask: '255.255.255.0', gateway: '10.11.12.1' }
          ],
          cables: [
            { id: 'c1', fromDevice: 'PCA', fromPort: 'FastEthernet0', toDevice: 'SW1', toPort: 'FastEthernet0/1', type: 'straight' },
            { id: 'c2', fromDevice: 'SW1', fromPort: 'GigabitEthernet0/1', toDevice: 'R1', toPort: 'GigabitEthernet0/0/0', type: 'straight' },
            { id: 'c3', fromDevice: 'R1', fromPort: 'GigabitEthernet0/0/1', toDevice: 'R2', toPort: 'GigabitEthernet0/0/1', type: 'straight' },
            { id: 'c4', fromDevice: 'R2', fromPort: 'GigabitEthernet0/0/0', toDevice: 'SW2', toPort: 'GigabitEthernet0/1', type: 'straight' },
            { id: 'c5', fromDevice: 'SW2', fromPort: 'FastEthernet0/1', toDevice: 'PCB', toPort: 'FastEthernet0', type: 'straight' }
          ]
        },
        rubric: [
          { id: 'r1', category: 'hostname', title: '1. Unieke Hostnames', desc: 'Geef alle routers en switches een unieke naam', points: 6, enabled: true, checkType: 'hostname' },
          { id: 'r2', category: 'security', title: '2. Enable Secret', desc: 'Stel een gehasht enable secret in op alle apparaten', points: 6, enabled: true, checkType: 'enable_secret' },
          { id: 'r3', category: 'security', title: '3. Console Beveiliging', desc: 'Wachtwoord en login vereist op line con 0', points: 6, enabled: true, checkType: 'console_password' },
          { id: 'r4', category: 'security', title: '4. Banner MOTD', desc: 'Waarschuwingsbanner bij inloggen', points: 6, enabled: true, checkType: 'banner_motd' },
          { id: 'r5', category: 'security', title: '5. Password Encryption', desc: 'service password-encryption actief', points: 8, enabled: true, checkType: 'password_encryption' },
          { id: 'r6', category: 'interface_ip', title: '6. Router R1 Interface IPs & UP', desc: 'G0/0/0 (172.16.1.1) en G0/0/1 (192.168.1.161)', points: 12, enabled: true, checkType: 'interface_ip', condition: { deviceId: 'R1', portName: 'GigabitEthernet0/0/0', expectedIp: '172.16.1.1', expectedMask: '255.255.255.0' } },
          { id: 'r7', category: 'interface_ip', title: '7. Router R2 Interface IPs & UP', desc: 'G0/0/0 (10.11.12.1) en G0/0/1 (192.168.1.162)', points: 12, enabled: true, checkType: 'interface_ip', condition: { deviceId: 'R2', portName: 'GigabitEthernet0/0/0', expectedIp: '10.11.12.1', expectedMask: '255.255.255.0' } },
          { id: 'r8', category: 'vlan', title: '8. Switch SW1 Management IP (VLAN 1)', desc: '172.16.1.254/24 en default gateway 172.16.1.1', points: 8, enabled: true, checkType: 'switch_svi', condition: { switchId: 'SW1', expectedIp: '172.16.1.254', expectedMask: '255.255.255.0', expectedGateway: '172.16.1.1' } },
          { id: 'r9', category: 'vlan', title: '9. Switch SW2 Management IP (VLAN 1)', desc: '10.11.12.254/24 en default gateway 10.11.12.1', points: 8, enabled: true, checkType: 'switch_svi', condition: { switchId: 'SW2', expectedIp: '10.11.12.254', expectedMask: '255.255.255.0', expectedGateway: '10.11.12.1' } },
          { id: 'r10', category: 'routing', title: '10. Statische Routering R1 naar LAN 2', desc: 'Route naar 10.11.12.0/24 via 192.168.1.162 of default route', points: 10, enabled: true, checkType: 'static_route', condition: { routerId: 'R1', network: '10.11.12.0', mask: '255.255.255.0', nextHop: '192.168.1.162' } },
          { id: 'r11', category: 'routing', title: '11. Statische Routering R2 naar LAN 1', desc: 'Route naar 172.16.1.0/24 via 192.168.1.161 of default route', points: 10, enabled: true, checkType: 'static_route', condition: { routerId: 'R2', network: '172.16.1.0', mask: '255.255.255.0', nextHop: '192.168.1.161' } },
          { id: 'r12', category: 'connectivity', title: '12. End-to-End Ping PC1 naar PC2', desc: 'PCA (172.16.1.5) kan succesvol pingen naar PCB (10.11.12.5)', points: 10, enabled: true, checkType: 'ping_test', condition: { fromDevice: 'PCA', targetIp: '10.11.12.5' } },
          { id: 'r13', category: 'saving', title: '13. Configuratie Opgeslagen (NVRAM)', desc: 'Running-config opgeslagen met copy run start op routers', points: 6, enabled: true, checkType: 'copy_run_start', condition: { targetDevice: 'R1' } }
        ]
      },

      '02_cabling_scratch': {
        id: '02_cabling_scratch',
        title: 'PXL SNE - Praktijkproef: Zelfstandig Bekabelen & Basisconfiguratie',
        timeLimitMinutes: 60,
        showLiveScore: true,
        instructions: `## PXL SNE - Praktijkproef: Zelfstandig Bekabelen & Basisconfiguratie
**Cursus:** PXL Netwerken 1 - Praktijk (Gert Van Waeyenberg & David Parren)

### Doel van de Proef:
In deze zelfstandige proef bekabel je een nieuw lokaal netwerk vanaf nul en configureer je de IP-adressering en basisconnectiviteit.

#### Adresseringstabel
| Apparaat | Interface | IP-adres | Subnetmasker | Standaardgateway |
| :--- | :--- | :--- | :--- | :--- |
| **PCA** | FastEthernet0 | 192.168.10.10 | 255.255.255.0 | 192.168.10.1 |
| **SW1** | Fa0/1 & Gi0/1 | L2 Switchports | - | - |
| **R1** | GigabitEthernet0/0/0 | 192.168.10.1 | 255.255.255.0 | - |

#### Doelhostnames van Netwerkapparaten:
* **Router**: \`hostname R1\`
* **Switch**: \`hostname SW1\`

#### Bekabelingseisen:
* Sluit **PCA (FastEthernet0)** aan op **SW1 (FastEthernet0/1)** met een Koper Straight-Through kabel.
* Sluit **SW1 (GigabitEthernet0/1)** aan op **R1 (GigabitEthernet0/0/0)** met een Koper Straight-Through kabel.

#### Taken & Configuratie-eisen:
1. **Bekabeling:** Sluit alle kabels aan volgens de bekabelingstabel.
2. **Hostnames:** Stel hostname \`R1\` in op de router en \`SW1\` op de switch.
3. **Router Interface:** Configureer IP \`192.168.10.1 255.255.255.0\` op interface GigabitEthernet0/0/0 en activeer de poort (\`no shutdown\`).
4. **PC IP-configuratie:** Stel op PCA IP \`192.168.10.10\`, subnetmasker \`255.255.255.0\` en default gateway \`192.168.10.1\` in.
5. **Connectiviteit:** Test via Command Prompt op PCA of je succesvol kunt pingen naar \`192.168.10.1\`.
6. **Opslaan:** Sla de configuratie op via \`copy run start\` op R1.
`,
        initialTopology: {
          devices: [
            { id: 'R1', type: 'router', model: '4331', hostname: 'Router', x: 500, y: 150 },
            { id: 'SW1', type: 'switch', model: '2960-24TT', hostname: 'Switch', x: 500, y: 320 },
            { id: 'PCA', type: 'pc', model: 'Standard', hostname: 'PC1', x: 500, y: 480 }
          ],
          cables: []
        },
        rubric: [
          { id: 'cb1', category: 'cabling', title: 'Bekabeling PC naar Switch', desc: 'PCA Fa0 naar SW1 Fa0/1 via Straight-Through kabel', points: 15, enabled: true, checkType: 'cabling', condition: { fromDevice: 'PCA', fromPort: 'FastEthernet0', toDevice: 'SW1', toPort: 'FastEthernet0/1', cableType: 'straight' } },
          { id: 'cb2', category: 'cabling', title: 'Bekabeling Switch naar Router', desc: 'SW1 Gi0/1 naar R1 Gi0/0/0 via Straight-Through kabel', points: 15, enabled: true, checkType: 'cabling', condition: { fromDevice: 'SW1', fromPort: 'GigabitEthernet0/1', toDevice: 'R1', toPort: 'GigabitEthernet0/0/0', cableType: 'straight' } },
          { id: 'cfg1', category: 'interface_ip', title: 'Router Gi0/0/0 IP & UP', desc: 'IP 192.168.10.1 / 255.255.255.0 en no shutdown', points: 20, enabled: true, checkType: 'interface_ip', condition: { deviceId: 'R1', portName: 'GigabitEthernet0/0/0', expectedIp: '192.168.10.1', expectedMask: '255.255.255.0' } },
          { id: 'cfg2', category: 'hostname', title: 'Hostnames Geconfigureerd', desc: 'Geef router en switch een naam', points: 15, enabled: true, checkType: 'hostname' },
          { id: 'ping1', category: 'connectivity', title: 'Ping Test PC naar Router Gateway', desc: 'PC1 kan pingen naar 192.168.10.1', points: 25, enabled: true, checkType: 'ping_test', condition: { fromDevice: 'PCA', targetIp: '192.168.10.1' } },
          { id: 'save1', category: 'saving', title: 'Configuratie Opgeslagen', desc: 'copy run start uitgevoerd', points: 10, enabled: true, checkType: 'copy_run_start', condition: { targetDevice: 'R1' } }
        ]
      },

      '03_wireless_lan': {
        id: '03_wireless_lan',
        title: 'PXL SNE - Wireless LAN (WLAN) Setup met Access Point & WPA2-PSK',
        timeLimitMinutes: 45,
        showLiveScore: true,
        instructions: `## PXL SNE - Wireless LAN (WLAN) Setup met Access Point & WPA2-PSK
**Cursus:** PXL Netwerken 1 - Wireless (Gert Van Waeyenberg & David Parren)

### Doel van het Lab:
In dit labo zet je een draadloos lokaal netwerk op via een Cisco WRT300N Wireless AP en verbind je een laptop via WPA2-Personal beveiliging.

#### Adresseringstabel & WLAN Parameters
| Apparaat | Interface | IP-adres | Subnetmasker | Standaardgateway |
| :--- | :--- | :--- | :--- | :--- |
| **SW1** | FastEthernet0/1 | Switchport (L2) | - | - |
| **AP1** | Ethernet 1 (LAN) | 192.168.0.1 | 255.255.255.0 | - |
| **LAP1** | Wireless (WLAN) | 192.168.0.100 (DHCP) | 255.255.255.0 | 192.168.0.1 |

#### Draadloze Netwerkparameters:
* **SSID**: \`PXL-Guest\`
* **Beveiliging**: \`WPA2-Personal (PSK)\` met AES encryptie
* **WPA Pre-Shared Key**: \`PXL2026Net!\`

#### Taken & Configuratie-eisen:
1. **Fysieke verbinding:** Sluit een Straight-Through kabel aan van **SW1 (FastEthernet0/1)** naar **AP1 (Ethernet 1)**.
2. **Access Point Configuratie:** Open de webinterface van AP1, stel de SSID in op \`PXL-Guest\`, kies WPA2-Personal en vul de sleutel \`PXL2026Net!\` in. Sla de instellingen op.
3. **Laptop Draadloze Verbinding:** Open op **LAP1** de app **Desktop > PC Wireless**. Klik op het tabblad **Connect**, vernieuw de lijst, selecteer \`PXL-Guest\` en meld aan met \`PXL2026Net!\`.
4. **Verificatie:** Controleer dat de draadloze golven zichtbaar zijn en voer een succesvolle ping uit naar \`192.168.0.1\`.
`,
        initialTopology: {
          devices: [
            { id: 'SW1', type: 'switch', model: '2960-24TT', hostname: 'Switch1', x: 300, y: 250 },
            { id: 'AP1', type: 'wireless_ap', model: 'WRT300N', hostname: 'HomeRouter', x: 550, y: 250, ssid: 'PXL-Guest', passphrase: 'PXL2026Net!' },
            { id: 'LAP1', type: 'laptop', model: 'Standard', hostname: 'Laptop1', x: 800, y: 250 }
          ],
          cables: [
            { id: 'wc1', fromDevice: 'SW1', fromPort: 'FastEthernet0/1', toDevice: 'AP1', toPort: 'Ethernet1', type: 'straight' }
          ]
        },
        rubric: [
          { id: 'w1', category: 'wireless', title: 'Draadloze Associatie Laptop met AP', desc: 'Laptop1 is verbonden met SSID PXL-Guest', points: 50, enabled: true, checkType: 'wireless_associated', condition: { clientId: 'LAP1', expectedAp: 'AP1' } },
          { id: 'w2', category: 'connectivity', title: 'Ping Test Laptop naar AP Gateway', desc: 'Laptop1 kan pingen naar 192.168.0.1', points: 50, enabled: true, checkType: 'ping_test', condition: { fromDevice: 'LAP1', targetIp: '192.168.0.1' } }
        ]
      }
    };

    // Load Course Labs from vwgert.github.io/networksess
    if (window.PXL_COURSE_LABS && Array.isArray(window.PXL_COURSE_LABS)) {
      window.PXL_COURSE_LABS.forEach(lab => {
        this.presetExams[lab.id] = lab;
      });
    }
  }

  loadExam(exam) {
    this.activeExam = exam;
    this.timerSeconds = (exam.timeLimitMinutes || 80) * 60;

    // Reset simulator
    this.sim.clear();

    const topo = exam.initialTopology || exam.topology || {};

    // Load initial devices
    if (topo.devices) {
      topo.devices.forEach(d => {
        const devId = d.id || d.name;
        const devHostname = d.hostname || d.name || devId;
        const dev = new CiscoDevice(devId, d.type, devHostname, d);
        this.sim.registerDevice(dev);
      });
    }

    // Load initial cables
    if (topo.cables) {
      topo.cables.forEach(c => {
        this.sim.addCable(c);
      });
    }

    // Set rubric
    this.gradingEngine.setExam(exam);

    // Update UI headers & Opdracht dropdown
    const titleEl = document.getElementById('examTitleLabel');
    if (titleEl) titleEl.innerText = exam.title;

    const opgTitle = document.getElementById('opdrachtDropdownTitle');
    if (opgTitle) opgTitle.innerText = exam.title;

    this.renderOpdrachtDropdown();

    if (typeof exam.liveInternet === 'boolean') {
      this.toggleLiveInternet(exam.liveInternet);
    }

    this.canvasWorkspace.render();
    if (this.simulationEngine) {
      this.simulationEngine.resetSimulation();
    }
    this.triggerScoreUpdate();
  }

  setSimulationMode(mode) {
    if (this.simulationEngine) {
      this.simulationEngine.setMode(mode);
    }
  }

  // --- DEVICE SHELF (BOTTOM DOCK) ---
  // --- DEVICE SHELF (BOTTOM DOCK) ---
  initDeviceShelf() {
    this.shelfCategories = [
      { id: 'routers_switches', label: 'Switch & Router devices', icon: '🔀' },
      { id: 'computers', label: 'Computer systems', icon: '💻' },
      { id: 'cloud', label: 'Cloud', icon: '☁️' },
      { id: 'wifi', label: 'Wifi', icon: '📶' },
      { id: 'cables', label: 'Cables & Patches', icon: '🔌' },
      { id: 'firewalls', label: 'Firewall & Security', icon: '🛡️' }
    ];

    this.allShelfItems = [
      // 1. Switch & Router devices
      { type: 'router', model: '4331', label: 'Cisco 4331', category: 'routers_switches' },
      { type: 'router', model: '2911', label: 'Cisco 2911', category: 'routers_switches' },
      { type: 'switch', model: '2960-24TT', label: '2960-24TT Switch', category: 'routers_switches' },
      { type: 'switch', model: '3560-24PS', label: '3560 Multilayer', category: 'routers_switches' },
      { type: 'hpe_switch', model: 'Aruba-2530-24G', label: 'HPE Aruba 2530', category: 'routers_switches' },
      { type: 'hpe_switch', model: 'Aruba-2930F-24G', label: 'HPE Aruba 2930F', category: 'routers_switches' },
      { type: 'mikrotik', model: 'hEX lite (RB750r2)', label: 'MikroTik hEX lite', category: 'routers_switches' },
      { type: 'openwrt', model: 'OpenWrt 23.05', label: 'OpenWrt Router', category: 'routers_switches' },

      // 2. Computer systems
      { type: 'pc', model: 'Standard', label: 'PC-PT', category: 'computers' },
      { type: 'laptop', model: 'Standard', label: 'Laptop-PT', category: 'computers' },
      { type: 'server', model: 'Standard', label: 'Server-PT', category: 'computers' },

      // 3. Cloud
      { type: 'internet_simulated', model: 'PXL Internet (Simulated)', label: 'Internet (Simulated)', category: 'cloud' },
      { type: 'internet_public', model: 'PXL Internet (Public NAT)', label: 'Internet (Public)', category: 'cloud' },
      { type: 'internet_cloud', model: 'PXL Global Internet', label: 'Het Internet (Hybrid)', category: 'cloud' },
      { type: 'cloud_wan', model: 'Cloud-PT', label: 'Cloud WAN / ISP', category: 'cloud' },

      // 4. Wifi
      { type: 'wireless_router', model: 'WRT300N', label: 'WRT300N Router', category: 'wifi' },
      { type: 'wireless_ap', model: 'AIR-LAP3702', label: 'Cisco LAP-PT (AP)', category: 'wifi' },
      { type: 'wlc', model: '3504', label: 'Cisco 3504 WLC', category: 'wifi' },
      { type: 'wireless_router', model: 'HomeGateway', label: 'Home Gateway', category: 'wifi' },

      // 5. Cables & Patches
      { cableType: 'auto', label: 'Automatisch (⚡)', category: 'cables', icon: '⚡' },
      { cableType: 'straight', label: 'Copper Straight (⎯)', category: 'cables', icon: '⎯' },
      { cableType: 'crossover', label: 'Copper Cross (╍)', category: 'cables', icon: '╍' },
      { cableType: 'serial', label: 'Serial DCE (↯)', category: 'cables', icon: '↯' },
      { cableType: 'console', label: 'Console Kabel (⌒)', category: 'cables', icon: '⌒' },
      { cableType: 'fiber', label: 'Fiber Optic Patch (🗲)', category: 'cables', icon: '🗲' },

      // 6. Firewall & Security
      { type: 'cisco_asa', model: 'ASA 5506-X', label: 'Cisco ASA 5506-X', category: 'firewalls' },
      { type: 'fortigate', model: 'FortiGate-60F', label: 'FortiGate (FortiOS)', category: 'firewalls' },
      { type: 'paloalto', model: 'PA-440', label: 'Palo Alto (PAN-OS)', category: 'firewalls' },
      { type: 'opnsense', model: 'OPNsense 24.1', label: 'OPNsense 24.1', category: 'firewalls' },
      { type: 'pfsense', model: 'pfSense Plus 23.09', label: 'pfSense Plus', category: 'firewalls' },
      { type: 'watchguard', model: 'FireboxV', label: 'WatchGuard FireboxV', category: 'firewalls' }
    ];

    if (!this.activeShelfCategory) {
      this.activeShelfCategory = 'routers_switches';
    }

    this.renderShelfCategoryButtons();
    this.renderShelfItems();
  }

  renderShelfCategoryButtons() {
    const catContainer = document.getElementById('shelfCategories');
    if (!catContainer) return;
    catContainer.innerHTML = '';

    this.shelfCategories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `pt-category-btn ${cat.id === this.activeShelfCategory ? 'active' : ''}`;
      btn.innerHTML = `<span style="font-size: 13px;">${cat.icon}</span> <span>${cat.label}</span>`;
      btn.title = cat.label;
      btn.onclick = () => {
        this.activeShelfCategory = cat.id;
        this.renderShelfCategoryButtons();
        this.renderShelfItems();
      };
      catContainer.appendChild(btn);
    });
  }

  renderShelfItems() {
    const shelfContainer = document.getElementById('deviceShelfItems');
    if (!shelfContainer) return;
    shelfContainer.innerHTML = '';

    const items = this.allShelfItems.filter(item => item.category === this.activeShelfCategory);
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'pt-shelf-btn';

      if (item.cableType) {
        btn.innerHTML = `<span class="pt-shelf-icon">${item.icon}</span><span class="pt-shelf-text">${item.label}</span>`;
        btn.onclick = () => {
          this.canvasWorkspace.setTool('cable');
          this.canvasWorkspace.cabling.setCableType(item.cableType);
          this.highlightActiveShelfBtn(btn);
          this.showToast(`🔌 Kabel: ${item.label}. Klik op een apparaat om te verbinden.`);
        };
      } else {
        btn.setAttribute('draggable', 'true');
        const svgIcon = getCiscoDeviceIcon(item.type, item.model);
        btn.innerHTML = `<div class="pt-shelf-svg">${svgIcon}</div><span class="pt-shelf-text">${item.label}</span>`;

        // Click to enter Place Mode (Packet Tracer style)
        btn.onclick = () => {
          this.canvasWorkspace.setPlacingDevice(item.type, item.model);
          this.highlightActiveShelfBtn(btn);
          this.showToast(`📍 Klik op het werkveld om ${item.label} te plaatsen.`);
        };

        // Drag to drop on Canvas
        btn.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ type: item.type, model: item.model }));
          e.dataTransfer.effectAllowed = 'copy';
        });
      }
      shelfContainer.appendChild(btn);
    });
  }

  highlightActiveShelfBtn(activeBtn) {
    document.querySelectorAll('.pt-shelf-btn').forEach(b => b.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
  }

  // --- EVENT LISTENERS ---
  initEventListeners() {
    // Mode switcher
    const modeBtn = document.getElementById('btnToggleStudio');
    if (modeBtn) {
      modeBtn.onclick = () => {
        this.teacherStudio.openStudioModal();
      };
    }

    // Exam selector
    this.populateExamSelector();
    const examSelect = document.getElementById('examSelector');
    if (examSelect) {
      examSelect.onchange = (e) => {
        const val = e.target.value;
        this.selectExamFromDropdown(val);
      };
    }

    // Rubric button
    const rubricBtn = document.getElementById('btnShowRubric');
    if (rubricBtn) {
      rubricBtn.onclick = () => this.toggleRubricPanel();
    }

    // Submit button
    const submitBtn = document.getElementById('btnSubmitExam');
    if (submitBtn) {
      submitBtn.onclick = () => this.openSubmissionModal();
    }

    // Escape key closes modals and floating panels
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeGlobalWireshark();
        this.closeDeviceModal();
        this.closeLoginModal();
        this.closeSubmissionModal();
        this.closeStudentStudioModal();
        this.closeTestPasswordModal();
        this.closeBugReportModal();
        if (!this.isOpdrachtPinned) {
          this.closeOpdrachtDropdown();
        }
        const pdu = document.getElementById('pduInspectorModal');
        if (pdu) pdu.style.display = 'none';
      }
    });
  }

  async populateExamSelector(selectedId) {
    const examSelect = document.getElementById('examSelector');
    if (!examSelect) return;
    examSelect.innerHTML = '';

    let assignedLabs = [];
    let assignedTests = [];
    this.assignedExamsMap = {};

    if (this.currentUser && this.currentUser.role === 'student') {
      try {
        const res = await fetch('/api/student/assigned-exams');
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.exams)) {
          data.exams.forEach(ex => {
            this.assignedExamsMap[ex.exam_id] = ex;
            if (ex.kind === 'test' || ex.assignment_type === 'test') {
              assignedTests.push(ex);
            } else {
              assignedLabs.push(ex);
            }
          });
        }
      } catch (err) {
        console.warn('Could not fetch assigned exams for student:', err);
      }
    }

    // 1. Assigned Tests (Official tests)
    if (assignedTests.length > 0) {
      const ogTests = document.createElement('optgroup');
      ogTests.label = '📝 Toegewezen Testen (Examens)';
      assignedTests.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.exam_id;
        const lockIcon = t.has_password ? '🔒 ' : '';
        const startIcon = t.is_started ? '▶️ ' : '⏳ ';
        opt.innerText = `${startIcon}${lockIcon}${t.title} (${t.time_limit_minutes} min)`;
        ogTests.appendChild(opt);
      });
      examSelect.appendChild(ogTests);
    }

    // 2. Assigned Labs (Practice labs)
    if (assignedLabs.length > 0) {
      const ogLabs = document.createElement('optgroup');
      ogLabs.label = '🔬 Toegewezen Oefenlabs';
      assignedLabs.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.exam_id;
        opt.innerText = `🔬 ${l.title} (${l.time_limit_minutes} min)`;
        ogLabs.appendChild(opt);
      });
      examSelect.appendChild(ogLabs);
    }

    // 3. Standaard PXL Examens
    const ogDefault = document.createElement('optgroup');
    ogDefault.label = 'Standaard PXL Examens';
    ogDefault.innerHTML = `
      <option value="01_pxl_standard">Lab 1: PXL LAN/WAN Routing (Standaard)</option>
      <option value="02_cabling_scratch">Lab 2: Zelfstandig Bekabelen & Setup</option>
      <option value="03_wireless_lan">Lab 3: Wireless LAN & WPA2-PSK</option>
    `;
    examSelect.appendChild(ogDefault);

    // 4. Course Labs
    if (window.PXL_COURSE_LABS && Array.isArray(window.PXL_COURSE_LABS)) {
      const ogCourse = document.createElement('optgroup');
      ogCourse.label = 'Cursus Labs (vwgert.github.io/networksess)';
      window.PXL_COURSE_LABS.forEach(lab => {
        const opt = document.createElement('option');
        opt.value = lab.id;
        opt.innerText = `${lab.code} - ${lab.title.split(':')[1]?.trim() || lab.title}`;
        ogCourse.appendChild(opt);
      });
      examSelect.appendChild(ogCourse);
    }

    if (selectedId) {
      examSelect.value = selectedId;
    } else if (this.activeExam) {
      examSelect.value = this.activeExam.id;
    }
  }

  async selectExamFromDropdown(val) {
    if (!val) return;
    const examSelect = document.getElementById('examSelector');

    const asg = this.assignedExamsMap ? this.assignedExamsMap[val] : null;
    if (asg && (asg.kind === 'test' || asg.assignment_type === 'test')) {
      if (!asg.is_started) {
        alert(`⏳ De test '${asg.title}' is nog niet gestart door de docent voor jouw groep.\n\nWacht tot je docent het startsein geeft.`);
        if (examSelect && this.activeExam) examSelect.value = this.activeExam.id;
        return;
      }
      if (asg.has_password) {
        this.openTestPasswordModal(asg);
        return;
      }
    }

    await this.loadExamById(val);
  }

  loadCourseLab(idOrFile) {
    if (!window.PXL_COURSE_LABS) return false;
    const clean = (idOrFile || '').replace(/\.json$/i, '');
    const lab = window.PXL_COURSE_LABS.find(l => 
      l.id === clean || l.code === clean || l.id === idOrFile || 
      (clean && clean.includes(l.id)) || (l.id && l.id.includes(clean))
    );
    if (lab) {
      this.loadExam(lab);
      return true;
    }
    return false;
  }

  async loadExamById(examId) {
    const examSelect = document.getElementById('examSelector');
    if (examSelect) examSelect.value = examId;

    if (this.presetExams && this.presetExams[examId]) {
      this.loadExam(this.presetExams[examId]);
      return;
    }

    if (this.loadCourseLab(examId)) {
      return;
    }

    try {
      const res = await fetch(`/api/exam/${encodeURIComponent(examId)}`);
      const data = await res.json();
      if (data.status === 'success' && data.exam) {
        this.loadExam(data.exam);
      } else {
        this.showToast(`Opdracht '${examId}' geopend.`);
      }
    } catch (e) {
      console.warn('Could not load exam from DB:', e);
      this.showToast(`Opdracht '${examId}' geactiveerd.`);
    }
  }

  exportCurrentLabJson() {
    if (!this.activeExam) return;
    const currentTopo = this.sim.exportTopology();
    const exportData = {
      ...this.activeExam,
      initialTopology: currentTopo
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    const safeTitle = (exportData.code || exportData.id || 'PXL_Lab').replace(/[^a-zA-Z0-9_-]/g, '_');
    dlAnchorElem.setAttribute("download", `${safeTitle}.json`);
    dlAnchorElem.click();
    this.showToast(`📤 Lab '${exportData.title}' succesvol geëxporteerd als JSON!`);
  }

  importLabJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const lab = JSON.parse(event.target.result);
          if (!lab.id || !lab.title) {
            throw new Error("Ongeldig labformaat: 'id' en 'title' zijn verplicht.");
          }
          this.presetExams[lab.id] = lab;
          this.populateExamSelector(lab.id);
          this.loadExam(lab);
          this.showToast(`📥 Lab '${lab.title}' succesvol geïmporteerd en geactiveerd!`);
        } catch (err) {
          alert(`Fout bij importeren van lab JSON: ${err.message}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // --- DEVICE MODAL (PHYSICAL / CONFIG / CLI / DESKTOP) ---
  openDeviceModal(deviceOrId) {
    const device = (typeof deviceOrId === 'string') ? (this.sim ? this.sim.devices[deviceOrId] : null) : deviceOrId;
    if (!device) return;
    this.activeDevice = device;
    const modal = document.getElementById('deviceModal');
    if (!modal) return;

    // Header
    document.getElementById('modalDeviceTitle').innerText = `${device.hostname} (${device.model || device.type})`;

    // Show/hide appropriate tabs
    const isHost = (device.type === 'pc' || device.type === 'laptop' || device.type === 'server');
    const isServer = (device.type === 'server');
    const isWrt = (device.type === 'wireless_router');
    const isWlc = (device.type === 'wlc');
    const isAp = (device.type === 'wireless_ap');
    const cliTabBtn = document.getElementById('tabBtnCli');
    const desktopTabBtn = document.getElementById('tabBtnDesktop');
    const servicesTabBtn = document.getElementById('tabBtnServices');
    const webfigTabBtn = document.getElementById('tabBtnWebFig');
    const hpeWebTabBtn = document.getElementById('tabBtnHpeWeb');
    const wrtWebTabBtn = document.getElementById('tabBtnWrtWeb');
    const wlcWebTabBtn = document.getElementById('tabBtnWlcWeb');
    const apWebTabBtn = document.getElementById('tabBtnApWeb');
    const fortiWebTabBtn = document.getElementById('tabBtnFortiWeb');
    const panWebTabBtn = document.getElementById('tabBtnPanWeb');
    const opnWebTabBtn = document.getElementById('tabBtnOpnWeb');
    const pfWebTabBtn = document.getElementById('tabBtnPfWeb');
    const wgWebTabBtn = document.getElementById('tabBtnWgWeb');

    if (cliTabBtn) {
      cliTabBtn.style.display = (isHost || isWrt) ? 'none' : 'inline-block';
      if (device.type === 'mikrotik') {
        cliTabBtn.innerText = 'CLI (RouterOS)';
      } else if (device.type === 'openwrt') {
        cliTabBtn.innerText = 'CLI (Ash Linux)';
      } else if (device.type === 'hpe_switch') {
        cliTabBtn.innerText = 'CLI (ArubaOS-S)';
      } else if (device.type === 'wlc') {
        cliTabBtn.innerText = 'CLI (AireOS)';
      } else if (device.type === 'cisco_asa') {
        cliTabBtn.innerText = 'CLI (ASA-OS)';
      } else if (device.type === 'fortigate') {
        cliTabBtn.innerText = 'CLI (FortiOS)';
      } else if (device.type === 'paloalto') {
        cliTabBtn.innerText = 'CLI (PAN-OS)';
      } else if (device.type === 'opnsense') {
        cliTabBtn.innerText = 'Console (OPNsense)';
      } else if (device.type === 'pfsense') {
        cliTabBtn.innerText = 'Console (pfSense)';
      } else if (device.type === 'watchguard') {
        cliTabBtn.innerText = 'CLI (Fireware OS)';
      } else if (device.type === 'internet_cloud' || device.type === 'internet_simulated' || device.type === 'internet_public' || device.type === 'cloud_wan') {
        cliTabBtn.innerText = '🌐 Uitleg & Aansluiting';
      } else {
        cliTabBtn.innerText = 'CLI (Cisco IOS)';
      }
    }
    if (desktopTabBtn) desktopTabBtn.style.display = isHost ? 'inline-block' : 'none';
    if (servicesTabBtn) servicesTabBtn.style.display = isServer ? 'inline-block' : 'none';
    if (webfigTabBtn) webfigTabBtn.style.display = (device.type === 'mikrotik') ? 'inline-block' : 'none';
    if (hpeWebTabBtn) hpeWebTabBtn.style.display = (device.type === 'hpe_switch') ? 'inline-block' : 'none';
    if (wrtWebTabBtn) wrtWebTabBtn.style.display = isWrt ? 'inline-block' : 'none';
    if (wlcWebTabBtn) wlcWebTabBtn.style.display = isWlc ? 'inline-block' : 'none';
    if (apWebTabBtn) apWebTabBtn.style.display = isAp ? 'inline-block' : 'none';
    if (fortiWebTabBtn) fortiWebTabBtn.style.display = (device.type === 'fortigate') ? 'inline-block' : 'none';
    if (panWebTabBtn) panWebTabBtn.style.display = (device.type === 'paloalto') ? 'inline-block' : 'none';
    if (opnWebTabBtn) opnWebTabBtn.style.display = (device.type === 'opnsense') ? 'inline-block' : 'none';
    if (pfWebTabBtn) pfWebTabBtn.style.display = (device.type === 'pfsense') ? 'inline-block' : 'none';
    if (wgWebTabBtn) wgWebTabBtn.style.display = (device.type === 'watchguard') ? 'inline-block' : 'none';

    // Switch to primary operational tab
    if (isServer) {
      this.switchDeviceModalTab('services');
    } else if (isHost) {
      this.switchDeviceModalTab('desktop');
    } else if (isWrt) {
      this.switchDeviceModalTab('wrtweb');
    } else if (isWlc) {
      this.switchDeviceModalTab('wlcweb');
    } else if (isAp) {
      this.switchDeviceModalTab('apweb');
    } else {
      this.switchDeviceModalTab('cli');
    }

    modal.style.display = 'flex';
  }

  closeDeviceModal() {
    const modal = document.getElementById('deviceModal');
    if (modal) modal.style.display = 'none';
    this.activeDevice = null;
  }

  switchDeviceModalTab(tabKey) {
    const tabs = ['physical', 'config', 'cli', 'desktop', 'services', 'webfig', 'hpeweb', 'wrtweb', 'wlcweb', 'apweb', 'fortiweb', 'panweb', 'opnweb', 'pfweb', 'wgweb'];
    tabs.forEach(t => {
      const pane = document.getElementById(`modalPane${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (pane) pane.classList.remove('active');
    });
    document.querySelectorAll('.pt-device-tabs .pt-tab-btn').forEach(b => b.classList.remove('active'));

    const activePane = document.getElementById(`modalPane${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`);
    if (activePane) activePane.classList.add('active');

    const activeBtn = document.getElementById(`tabBtn${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');

    const dev = this.activeDevice;
    if (tabKey === 'physical') this.renderPhysicalTab();
    if (tabKey === 'config') this.renderConfigTab();
    if (tabKey === 'cli') this.renderCliTab();
    if (tabKey === 'desktop') this.renderDesktopTab();
    if (tabKey === 'services') this.renderServicesTab();
    if (tabKey === 'webfig') this.renderWebFigTab();
    if (tabKey === 'hpeweb') this.renderHpeWebTab();
    if (tabKey === 'wrtweb') this.renderWrtWebTab();
    if (tabKey === 'wlcweb') this.renderWlcWebTab();
    if (tabKey === 'apweb') this.renderApWebTab();
    if (tabKey === 'fortiweb' && window.FirewallGuiRenderers) window.FirewallGuiRenderers.renderFortiWebTab(dev, document.getElementById('modalPaneFortiweb'));
    if (tabKey === 'panweb' && window.FirewallGuiRenderers) window.FirewallGuiRenderers.renderPanWebTab(dev, document.getElementById('modalPanePanweb'));
    if (tabKey === 'opnweb' && window.FirewallGuiRenderers) window.FirewallGuiRenderers.renderOpnWebTab(dev, document.getElementById('modalPaneOpnweb'));
    if (tabKey === 'pfweb' && window.FirewallGuiRenderers) window.FirewallGuiRenderers.renderPfWebTab(dev, document.getElementById('modalPanePfweb'));
    if (tabKey === 'wgweb' && window.FirewallGuiRenderers) window.FirewallGuiRenderers.renderWatchGuardWebTab(dev, document.getElementById('modalPaneWgweb'));
  }

  renderApWebTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPaneApweb');
    if (!dev || !container) return;
    if (typeof window.renderApWebInterfaceHtml === 'function') {
      container.innerHTML = window.renderApWebInterfaceHtml(dev, this.sim);
    } else {
      container.innerHTML = '<div style="padding:20px; color:#fff;">Cisco Aironet AP Web GUI module niet geladen.</div>';
    }
  }

  renderWrtWebTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPaneWrtweb');
    if (!dev || !container) return;
    if (typeof window.renderWrtWebInterfaceHtml === 'function') {
      container.innerHTML = window.renderWrtWebInterfaceHtml(dev, this.sim);
    } else {
      container.innerHTML = '<div style="padding:20px; color:#fff;">WRT300N Web GUI module niet geladen.</div>';
    }
  }

  renderWlcWebTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPaneWlcweb');
    if (!dev || !container) return;
    if (typeof window.renderWlcWebInterfaceHtml === 'function') {
      container.innerHTML = window.renderWlcWebInterfaceHtml(dev, this.sim);
    } else {
      container.innerHTML = '<div style="padding:20px; color:#fff;">Cisco WLC 3504 Web GUI module niet geladen.</div>';
    }
  }

  renderWebFigTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPaneWebfig');
    if (!dev || !container) return;
    if (typeof window.renderMikroTikWebFigHtml === 'function') {
      container.innerHTML = window.renderMikroTikWebFigHtml(dev, this.sim);
    } else {
      container.innerHTML = '<div style="padding:20px; color:#fff;">WebFig module niet geladen.</div>';
    }
  }

  renderHpeWebTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPaneHpeweb');
    if (!dev || !container) return;
    if (typeof window.renderHpeWebInterfaceHtml === 'function') {
      container.innerHTML = window.renderHpeWebInterfaceHtml(dev, this.sim);
    } else {
      container.innerHTML = '<div style="padding:20px; color:#fff;">HPE Web Management module niet geladen.</div>';
    }
  }

  // 1. PHYSICAL TAB
  renderPhysicalTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPanePhysical');
    if (!dev || !container) return;

    container.innerHTML = `
      <div class="pt-physical-container">
        <div class="pt-physical-controls">
          <div class="pt-power-switch-group">
            <label class="pt-switch-label">Aan/Uit Schakelaar:</label>
            <button class="pt-power-btn ${dev.powerOn ? 'on' : 'off'}" onclick="window.PXLApp.toggleDevicePower()">
              ${dev.powerOn ? '🟢 POWER ON' : '🔴 POWER OFF'}
            </button>
            <button class="pt-btn-secondary" style="margin-left: 15px; border-color: #ef4444; color: #ef4444;" onclick="window.PXLApp.factoryResetDevice()">
              ⚡ Wis Config (Factory Reset)
            </button>
          </div>
          <div class="pt-physical-desc">
            Model: <strong>Cisco ${dev.model}</strong> | Chassis Status: <strong>${dev.powerOn ? 'Operational' : 'Powered Down'}</strong>
          </div>
        </div>

        <div class="pt-faceplate-chassis">
          <div class="pt-faceplate-header">
            <span class="pt-cisco-logo">CISCO SYSTEMS</span>
            <span>${dev.model} Series Integrated Services Device</span>
          </div>
          <div class="pt-faceplate-ports">
            ${Object.keys(dev.interfaces).map(p => {
              const cable = this.sim.getCableOnPort(dev.id, p);
              const peer = cable ? (cable.fromDevice === dev.id ? this.sim.devices[cable.toDevice] : this.sim.devices[cable.fromDevice]) : null;
              const peerPort = cable ? (cable.fromDevice === dev.id ? cable.toPort : cable.fromPort) : '';
              const isUp = this.sim.isLinkUp(dev.id, p);
              const tooltip = cable ? `${p}: Aangesloten op ${peer?.hostname || 'Toestel'} [${peerPort}] (Klik om te beheren)` : `${p}: Niet aangesloten (Klik om kabel aan te sluiten)`;
              return `
                <div class="pt-chassis-port" title="${tooltip}" style="cursor: pointer;" onclick="window.PXLApp.switchDeviceModalTab('config'); window.PXLApp.selectConfigPort('${p}');">
                  <div class="pt-port-led ${isUp ? 'green' : (cable ? 'amber' : 'off')}"></div>
                  <div class="pt-port-jack ${cable ? 'plugged' : ''}"></div>
                  <span class="pt-port-name">${p.replace('GigabitEthernet', 'Gi').replace('FastEthernet', 'Fa').replace('Serial', 'Se')}${cable ? ' 🔌' : ''}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="pt-physical-modules" style="margin-top: 15px; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px;">
          <h4 style="margin: 0 0 8px 0; color: #38bdf8; font-size: 13px;">🔌 Interface Modules &amp; Uitbreidingsslots</h4>
          <div style="font-size: 12px; color: #cbd5e1; line-height: 1.6;">
            <div>• Vaste interface: <strong>${(dev.type === 'laptop' || dev.type === 'pc') ? 'FastEthernet0 (RJ45 100BASE-TX)' : 'GigabitEthernet'}</strong></div>
            ${dev.type === 'laptop' ? `
              <div style="margin-top: 6px; display: flex; align-items: center; justify-content: space-between;">
                <span>• Mini-PCIe Bay: <strong>Cisco-Linksys WPC300N Wireless Adapter</strong> (802.11a/b/g/n)</span>
                <span style="color: #10b981; font-weight: bold;">● Geïntegreerd</span>
              </div>
            ` : (dev.type === 'pc' || dev.type === 'server') ? `
              <div style="margin-top: 6px; display: flex; align-items: center; justify-content: space-between;">
                <span>• PCI Slot 1: <strong>${(dev.hasWirelessCard && dev.hasWirelessCard()) ? 'Linksys WMP300N Wireless PCI Adapter (802.11a/b/g/n)' : 'Leeg Slot (Geen Wi-Fi)'}</strong></span>
                ${(dev.hasWirelessCard && dev.hasWirelessCard()) ? `
                  <button class="pt-btn" style="padding: 3px 8px; font-size: 11px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="window.PXLApp.removePcWirelessCard()">
                    ➖ Verwijderen
                  </button>
                ` : `
                  <button class="pt-btn" style="padding: 3px 8px; font-size: 11px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="window.PXLApp.installPcWirelessCard()">
                    ➕ WMP300N Kaart Installeren
                  </button>
                `}
              </div>
            ` : (dev.type === 'wireless_ap' || dev.type === 'wireless_router') ? `
              <div style="margin-top: 6px;">
                <span>• Radio Modules: <strong>Dual-Band 802.11a/b/g/n/ac MIMO Antenne Array</strong></span>
                <span style="color: #10b981; font-weight: bold; margin-left: 10px;">● Zendvermogen 15 dBm</span>
              </div>
            ` : (dev.type === 'wlc') ? `
              <div style="margin-top: 6px;">
                <span>• WLC Controller Ports: <strong>4x GigabitEthernet PoE + 1x RJ45 Console</strong></span>
                <span style="color: #38bdf8; font-weight: bold; margin-left: 10px;">● AireOS / IOS-XE</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  toggleDevicePower() {
    if (this.activeDevice) {
      this.activeDevice.powerOn = !this.activeDevice.powerOn;
      this.renderPhysicalTab();
      this.canvasWorkspace.render();
      this.triggerScoreUpdate();
    }
  }

  // 2. CONFIG TAB (GUI)
  renderConfigTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPaneConfig');
    if (!dev || !container) return;

    container.innerHTML = `
      <div class="pt-config-layout">
        <div class="pt-config-sidebar">
          <h4>Interface Lijst</h4>
          ${Object.keys(dev.interfaces).map(p => {
            const hasCable = Boolean(this.sim.getCableOnPort(dev.id, p));
            return `
              <button class="pt-sidebar-port-btn" style="display:flex; justify-content:space-between; align-items:center;" onclick="window.PXLApp.selectConfigPort('${p}')">
                <span>${p}</span>
                <span style="font-size: 10px;">${hasCable ? '🔌' : '⚪'}</span>
              </button>
            `;
          }).join('')}
        </div>
        <div class="pt-config-body" id="configPortEditor">
          <h4>Algemene Instellingen</h4>
          <div class="pt-form-group">
            <label>Hostname:</label>
            <input type="text" class="pt-input" value="${dev.hostname}" onchange="window.PXLApp.updateDeviceHostname(this.value)">
          </div>
          ${dev.type === 'switch' ? `
            <div class="pt-form-group">
              <label>Default Gateway:</label>
              <input type="text" class="pt-input" value="${dev.defaultGateway || ''}" onchange="window.PXLApp.updateDeviceGateway(this.value)">
            </div>
          ` : ''}
          ${dev.type === 'mikrotik' ? `
            <div class="pt-form-group" style="margin-top: 15px; padding: 12px; background: #0f172a; border: 1px solid #0284c7; border-radius: 6px;">
              <label style="color: #38bdf8; font-weight: bold;">MikroTik WebFig (HTTP Server):</label>
              <label class="pt-checkbox-label" style="display:flex; align-items:center; gap:8px; margin-top:6px; cursor:pointer;">
                <input type="checkbox" id="cfgMikrotikWebfig" ${dev.mikrotikConfig && dev.mikrotikConfig.services && dev.mikrotikConfig.services.www ? 'checked' : ''} onchange="window.PXLApp.toggleMikrotikWebfig(this.checked)">
                WebFig Inschakelen (Poort 80 HTTP GUI)
              </label>
              <p style="font-size: 11px; color: #94a3b8; margin-top: 4px; margin-bottom: 0;">Hiermee kan je vanaf een aangesloten PC of Laptop via de browser (bv. http://192.168.88.1) of via het tabblad WebFig grafisch configureren.</p>
            </div>
          ` : ''}
          ${dev.type === 'hpe_switch' ? `
            <div class="pt-form-group" style="margin-top: 15px; padding: 12px; background: #0f172a; border: 1px solid #ff7900; border-radius: 6px;">
              <label style="color: #fb923c; font-weight: bold;">HPE Aruba Web Management (HTTP Server):</label>
              <label class="pt-checkbox-label" style="display:flex; align-items:center; gap:8px; margin-top:6px; cursor:pointer;">
                <input type="checkbox" id="cfgHpeWeb" ${dev.hpeConfig && dev.hpeConfig.webManagement ? 'checked' : ''} onchange="window.PXLApp.toggleHpeWeb(this.checked)">
                Web Management Inschakelen (HTTP GUI)
              </label>
              <p style="font-size: 11px; color: #94a3b8; margin-top: 4px; margin-bottom: 0;">Hiermee kan je de switch via het tabblad 'Aruba Web GUI' of via de browser op het management IP configureren.</p>
            </div>
          ` : ''}
          <p class="pt-help-text">Klik op een interface aan de linkerkant om IP, subnetmasker en poortstatus in te stellen.</p>
          <div style="margin-top: 25px; border-top: 1px solid #334155; padding-top: 15px;">
            <button class="pt-btn-secondary" style="border-color: #ef4444; color: #ef4444; width: 100%;" onclick="window.PXLApp.factoryResetDevice()">
              ⚡ Wis Configuratie & Fabrieksinstellingen
            </button>
          </div>
        </div>
      </div>
    `;
  }

  toggleMikrotikWebfig(enabled) {
    if (this.activeDevice && this.activeDevice.type === 'mikrotik') {
      if (!this.activeDevice.mikrotikConfig) this.activeDevice.mikrotikConfig = { services: { www: true } };
      if (!this.activeDevice.mikrotikConfig.services) this.activeDevice.mikrotikConfig.services = {};
      this.activeDevice.mikrotikConfig.services.www = enabled;
      this.showToast(`MikroTik WebFig ${enabled ? 'ingeschakeld (poort 80)' : 'uitgeschakeld'}`);
      this.triggerScoreUpdate();
    }
  }

  toggleHpeWeb(enabled) {
    if (this.activeDevice && this.activeDevice.type === 'hpe_switch') {
      if (!this.activeDevice.hpeConfig) this.activeDevice.hpeConfig = { webManagement: true };
      this.activeDevice.hpeConfig.webManagement = enabled;
      this.showToast(`HPE Aruba Web Management ${enabled ? 'ingeschakeld' : 'uitgeschakeld'}`);
      this.triggerScoreUpdate();
    }
  }

  factoryResetDevice() {
    const dev = this.activeDevice;
    if (!dev) return;
    if (confirm(`Weet je zeker dat je alle configuraties op ${dev.hostname} wilt wissen en herstellen naar fabrieksinstellingen?`)) {
      dev.factoryReset();
      this.renderPhysicalTab();
      this.renderConfigTab();
      this.canvasWorkspace.render();
      this.triggerScoreUpdate();
      this.showToast(`⚠️ ${dev.hostname} is hersteld naar fabrieksinstellingen`);
      const cliTab = document.getElementById('tabBtnCli');
      if (cliTab && cliTab.classList.contains('active')) {
        this.renderCliTab();
      }
    }
  }

  selectConfigPort(portName) {
    const dev = this.activeDevice;
    const intf = dev.interfaces[portName];
    const editor = document.getElementById('configPortEditor');
    if (!dev || !intf || !editor) return;

    if (portName.startsWith('Wireless')) {
      const w = dev.wireless || {};
      editor.innerHTML = `
        <h4>Draadloze Interface: ${portName}</h4>
        <div class="pt-form-group">
          <label>Poort Status:</label>
          <label class="pt-checkbox-label">
            <input type="checkbox" ${!intf.shutdown ? 'checked' : ''} onchange="window.PXLApp.updatePortShutdown('${portName}', !this.checked)">
            Poort Inschakelen (no shutdown)
          </label>
        </div>
        <div class="pt-form-group">
          <label>SSID (Netwerknaam):</label>
          <input type="text" class="pt-input" id="cfgPortWifiSsid" value="${w.ssid || ''}" onchange="window.PXLApp.updateWirelessParam('ssid', this.value)">
        </div>
        <div class="pt-form-group">
          <label>Beveiligingsmodus:</label>
          <select class="pt-input" id="cfgPortWifiAuth" onchange="window.PXLApp.updateWirelessParam('authMode', this.value)">
            <option value="Open" ${w.authMode === 'Open' ? 'selected' : ''}>Open (Geen beveiliging)</option>
            <option value="WPA2-PSK" ${w.authMode === 'WPA2-PSK' ? 'selected' : ''}>WPA2-PSK (AES-CCMP)</option>
            <option value="WPA3-SAE" ${w.authMode === 'WPA3-SAE' ? 'selected' : ''}>WPA3-SAE</option>
          </select>
        </div>
        <div class="pt-form-group" id="cfgPortWifiPassGroup" style="${w.authMode === 'Open' ? 'display:none;' : ''}">
          <label>WPA Preshared Key (Wachtwoord):</label>
          <input type="text" class="pt-input" id="cfgPortWifiPass" value="${w.passphrase || ''}" onchange="window.PXLApp.updateWirelessParam('passphrase', this.value)">
        </div>
        <div class="pt-form-group">
          <label>IP Adres:</label>
          <input type="text" class="pt-input" value="${intf.ip || dev.ip || ''}" onchange="window.PXLApp.updatePortIp('${portName}', this.value)">
        </div>
        <div class="pt-form-group">
          <label>Subnet Masker:</label>
          <input type="text" class="pt-input" value="${intf.mask || dev.mask || ''}" onchange="window.PXLApp.updatePortMask('${portName}', this.value)">
        </div>
        <div style="margin-top: 12px; padding: 10px; background: #0f172a; border-radius: 6px; font-size: 12px; border: 1px solid #334155;">
          <div>Status: <strong>${w.associatedAp ? 'Verbonden met ' + w.associatedAp : 'Niet verbonden'}</strong></div>
          ${w.associatedAp ? `<div>Signaal: <strong>${w.rssi} dBm</strong> | Snelheid: <strong>${w.txRate} Mbps</strong></div>` : ''}
        </div>
      `;
      return;
    }

    const cable = this.sim.getCableOnPort(dev.id, portName);
    const peer = cable ? (cable.fromDevice === dev.id ? this.sim.devices[cable.toDevice] : this.sim.devices[cable.fromDevice]) : null;
    const peerPort = cable ? (cable.fromDevice === dev.id ? cable.toPort : cable.fromPort) : null;
    const freePorts = this.sim.getAvailablePorts(dev.id, null, cable ? cable.type : 'straight').filter(p => p !== portName);

    editor.innerHTML = `
      <h4>Interface: ${portName}</h4>

      <!-- Physical Cable Connection Management -->
      <div class="pt-cable-interface-box" style="margin-bottom: 15px; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 6px;">
        <div style="font-weight: 600; font-size: 12px; margin-bottom: 8px; color: #38bdf8; display: flex; align-items: center; justify-content: space-between;">
          <span>🔌 Kabelverbinding / Bekabeling</span>
          ${cable ? `<span class="pt-badge" style="background:#0284c7; color:#fff; font-size:10px; padding:2px 6px; border-radius:3px;">${cable.type.toUpperCase()}</span>` : ''}
        </div>

        ${cable ? `
          <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 10px; line-height: 1.5;">
            Verbonden met: <strong style="color: #4ade80;">${peer ? peer.hostname : 'Onbekend'}</strong> op poort <strong style="color: #38bdf8;">[${peerPort}]</strong>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
              Linkstatus: <strong>${this.sim.isLinkUp(dev.id, portName) ? '🟢 Actief (Up)' : '🔴 Verbroken (Down)'}</strong>
            </div>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border-top: 1px solid #1e293b; padding-top: 10px;">
            ${freePorts.length > 0 ? `
              <div style="display: flex; align-items: center; gap: 6px;">
                <label style="font-size: 11px; color: #94a3b8;">Wissel poort:</label>
                <select id="cfgMovePortSelect" class="pt-input" style="font-size: 11px; padding: 3px 6px; width: auto;">
                  ${freePorts.map(p => `<option value="${p}">${p}</option>`).join('')}
                </select>
                <button class="pt-btn pt-btn-primary pt-btn-sm" onclick="window.PXLApp.moveCableToPort('${dev.id}', '${portName}', document.getElementById('cfgMovePortSelect').value)">
                  Wissel
                </button>
              </div>
            ` : ''}
            <button class="pt-btn pt-btn-secondary pt-btn-sm" onclick="window.PXLApp.moveCableToOtherDevice('${dev.id}', '${portName}')" title="Maak deze stekker los en prik hem in een ander toestel op het canvas">
              🔀 Naar ander toestel...
            </button>
            <button class="pt-btn pt-btn-secondary pt-btn-sm" style="color: #ef4444; border-color: #fca5a5;" onclick="window.PXLApp.disconnectCableFromPort('${dev.id}', '${portName}')">
              ✂️ Loskoppelen
            </button>
          </div>
        ` : `
          <div style="font-size: 12px; color: #94a3b8; display: flex; align-items: center; justify-content: space-between;">
            <span>⚪ Geen fysieke kabel aangesloten op deze poort.</span>
            <button class="pt-btn pt-btn-primary pt-btn-sm" onclick="window.PXLApp.startCablingFromPort('${dev.id}', '${portName}')">
              🔌 Kabel aansluiten...
            </button>
          </div>
        `}
      </div>

      <div class="pt-form-group">
        <label>Poort Status:</label>
        <label class="pt-checkbox-label">
          <input type="checkbox" ${!intf.shutdown ? 'checked' : ''} onchange="window.PXLApp.updatePortShutdown('${portName}', !this.checked)">
          Poort Inschakelen (no shutdown)
        </label>
      </div>
      <div class="pt-form-group">
        <label>IP Adres:</label>
        <input type="text" class="pt-input" id="cfgPortIpInput" value="${intf.ip || ''}" placeholder="bv. 192.168.88.1 of 192.168.88.1/24" onchange="window.PXLApp.updatePortIp('${portName}', this.value)">
      </div>
      <div class="pt-form-group">
        <label>Subnet Masker:</label>
        <input type="text" class="pt-input" id="cfgPortMaskInput" value="${intf.mask || ''}" placeholder="bv. 255.255.255.0" onchange="window.PXLApp.updatePortMask('${portName}', this.value)">
      </div>
      <div class="pt-form-group">
        <label>Beschrijving:</label>
        <input type="text" class="pt-input" value="${intf.description || ''}" onchange="window.PXLApp.updatePortDesc('${portName}', this.value)">
      </div>
    `;
  }

  disconnectCableFromPort(devId, portName) {
    const cable = this.sim.getCableOnPort(devId, portName);
    if (cable) {
      this.sim.removeCable(cable.id);
      this.showToast(`✂️ Kabel losgekoppeld van ${portName}`);
      this.renderPhysicalTab();
      this.renderConfigTab();
      this.selectConfigPort(portName);
      this.canvasWorkspace.render();
      this.triggerScoreUpdate();
    }
  }

  moveCableToPort(devId, oldPortName, newPortName) {
    if (!newPortName || newPortName === oldPortName) return;
    const cable = this.sim.getCableOnPort(devId, oldPortName);
    if (!cable) return;
    const side = (cable.fromDevice === devId) ? 'from' : 'to';
    this.sim.reconnectCableEndpoint(cable.id, side, newPortName);
    this.showToast(`✅ Kabel verplaatst naar ${newPortName}`);
    this.renderPhysicalTab();
    this.renderConfigTab();
    this.selectConfigPort(newPortName);
    this.canvasWorkspace.render();
    this.triggerScoreUpdate();
  }

  moveCableToOtherDevice(devId, portName) {
    const cable = this.sim.getCableOnPort(devId, portName);
    if (!cable) return;
    const side = (cable.fromDevice === devId) ? 'from' : 'to';
    this.closeDeviceModal();
    this.canvasWorkspace.cabling.detachAndReconnect(cable.id, side);
  }

  startCablingFromPort(devId, portName) {
    this.closeDeviceModal();
    const cabling = this.canvasWorkspace.cabling;
    cabling.pendingConnection = {
      fromDevId: devId,
      fromPortName: portName,
      type: 'auto'
    };
    cabling.activeCableType = 'auto';
    this.canvasWorkspace.activeTool = 'cable';
    if (this.canvasWorkspace.canvas) {
      this.canvasWorkspace.canvas.style.cursor = 'crosshair';
    }
    this.showToast(`🔌 Kabel aangesloten op ${portName}. Klik op het bestemmingsapparaat op het canvas.`);
    this.canvasWorkspace.render();
  }

  updateWirelessParam(key, val) {
    if (this.activeDevice && this.activeDevice.wireless) {
      this.activeDevice.wireless[key] = val;
      if (key === 'authMode') {
        const passGroup = document.getElementById('cfgPortWifiPassGroup');
        if (passGroup) passGroup.style.display = (val === 'Open') ? 'none' : 'block';
      }
      this.sim.updateWirelessAssociations();
      this.canvasWorkspace.render();
      this.triggerScoreUpdate();
    }
  }

  installPcWirelessCard() {
    if (this.activeDevice) {
      this.activeDevice.installWirelessCard('WMP300N');
      this.showToast(`✅ WMP300N Wi-Fi netwerkkaart geïnstalleerd in ${this.activeDevice.hostname}`);
      this.renderPhysicalTab();
      this.renderConfigTab();
      this.renderDesktopTab();
      this.openPcApp('wireless');
      this.canvasWorkspace.render();
      this.triggerScoreUpdate();
    }
  }

  removePcWirelessCard() {
    if (this.activeDevice) {
      this.activeDevice.removeWirelessCard();
      this.showToast(`➖ Wi-Fi netwerkkaart verwijderd uit ${this.activeDevice.hostname}`);
      this.renderPhysicalTab();
      this.renderConfigTab();
      this.renderDesktopTab();
      this.canvasWorkspace.render();
      this.triggerScoreUpdate();
    }
  }

  savePcWireless() {
    if (this.activeDevice && window.PXLWirelessApp) {
      window.PXLWirelessApp.saveAndConnect(this.activeDevice.id);
    }
  }

  updateDeviceHostname(val) {
    if (this.activeDevice && val.trim()) {
      this.activeDevice.hostname = val.trim();
      this.canvasWorkspace.render();
      this.triggerScoreUpdate();
    }
  }

  updateDeviceGateway(val) {
    if (this.activeDevice) {
      this.activeDevice.defaultGateway = val.trim();
      this.triggerScoreUpdate();
    }
  }

  updatePortShutdown(portName, isShutdown) {
    if (this.activeDevice && this.activeDevice.interfaces[portName]) {
      this.activeDevice.interfaces[portName].shutdown = isShutdown;
      this.canvasWorkspace.render();
      this.triggerScoreUpdate();
    }
  }

  updatePortIp(portName, ip) {
    if (this.activeDevice && this.activeDevice.interfaces[portName]) {
      let trimmed = ip.trim();
      let detectedMask = null;

      // Support CIDR notation e.g. "192.168.88.1/24"
      if (trimmed.includes('/')) {
        const [cleanIp, prefix] = trimmed.split('/');
        trimmed = cleanIp.trim();
        const pfx = parseInt(prefix, 10);
        if (!isNaN(pfx) && pfx >= 0 && pfx <= 32) {
          detectedMask = (typeof IPUtils !== 'undefined' && IPUtils.prefixToMask) ? IPUtils.prefixToMask(pfx) : '255.255.255.0';
        }
      }

      this.activeDevice.interfaces[portName].ip = trimmed;
      if (trimmed) {
        this.activeDevice.interfaces[portName].shutdown = false;
        if (detectedMask) {
          this.activeDevice.interfaces[portName].mask = detectedMask;
          const maskInput = document.getElementById('cfgPortMaskInput');
          if (maskInput) maskInput.value = detectedMask;
        } else if (!this.activeDevice.interfaces[portName].mask) {
          const autoMask = (typeof IPUtils !== 'undefined' && IPUtils.getDefaultMask) ? IPUtils.getDefaultMask(trimmed) : '255.255.255.0';
          this.activeDevice.interfaces[portName].mask = autoMask;
          const maskInput = document.getElementById('cfgPortMaskInput');
          if (maskInput) maskInput.value = autoMask;
        }

        if (this.activeDevice.type === 'switch' || this.activeDevice.type === 'hpe_switch' || this.activeDevice.type === 'mikrotik' || this.activeDevice.type === 'openwrt') {
          this.activeDevice.ip = trimmed;
          this.activeDevice.mask = this.activeDevice.interfaces[portName].mask;
        }

        if (this.activeDevice.type === 'mikrotik' && !this.activeDevice.mikrotikConfig) {
          this.activeDevice.mikrotikConfig = {
            identity: this.activeDevice.hostname || 'MikroTik',
            services: { www: { enabled: true, port: 80 } },
            users: { admin: { password: '', group: 'full' } }
          };
        }
      }
      this.triggerScoreUpdate();
    }
  }

  updatePortMask(portName, mask) {
    if (this.activeDevice && this.activeDevice.interfaces[portName]) {
      const trimmed = mask.trim();
      this.activeDevice.interfaces[portName].mask = trimmed;
      if (trimmed && (this.activeDevice.type === 'switch' || this.activeDevice.type === 'hpe_switch')) {
        this.activeDevice.mask = trimmed;
      }
      this.triggerScoreUpdate();
    }
  }

  updatePortDesc(portName, desc) {
    if (this.activeDevice && this.activeDevice.interfaces[portName]) {
      this.activeDevice.interfaces[portName].description = desc.trim();
      this.triggerScoreUpdate();
    }
  }

  // 3. CLI TAB (Cisco IOS / MikroTik / OpenWrt / Internet Gateway)
  renderCliTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPaneCli');
    if (!dev || !container) return;

    // Internet Gateway Views (Public NAT / Simulated / Hybrid - CCNA RFC 3849 Range: 209.165.200.224/30)
    if (dev.type === 'internet_cloud' || dev.type === 'internet_simulated' || dev.type === 'internet_public') {
      const isPublicOnly = (dev.type === 'internet_public');
      const isSimOnly = (dev.type === 'internet_simulated');
      const isLive = isPublicOnly ? true : (isSimOnly ? false : this.sim.liveInternetEnabled);

      container.innerHTML = `
        <div style="background: #0f172a; color: #f8fafc; padding: 22px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-height: 80vh; overflow-y: auto;">
          <!-- Top Cloud Header -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 14px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 36px;">☁️</span>
              <div>
                <h3 style="margin: 0; color: #38bdf8; font-size: 18px;">
                  ${isPublicOnly ? 'Het Internet (Public NAT Bridge • Live WAN)' : (isSimOnly ? 'Het Internet (Gesimuleerd • CCNA RFC 3849)' : 'Het Internet (PXL Global Cloud Gateway)')}
                </h3>
                <span style="font-size: 12px; color: #94a3b8;">
                  ISP Uplink: <code>209.165.200.225/30</code> &bull; Anycast DNS: <code>8.8.8.8</code>, <code>1.1.1.1</code>
                </span>
              </div>
            </div>
            <div style="background: ${isLive ? '#065f46' : '#1e3a8a'}; color: ${isLive ? '#34d399' : '#60a5fa'}; font-weight: bold; font-size: 11.5px; padding: 5px 14px; border-radius: 20px; border: 1px solid ${isLive ? '#059669' : '#3b82f6'};">
              ${isLive ? '● LIVE INTERNET NAT (ECHTE TOEGANG)' : '● GESIMULEERD CCNA INTERNET'}
            </div>
          </div>

          <!-- Connection Diagram Visual Banner -->
          <div style="background: #020617; border: 1px solid #1e293b; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-family: monospace; font-size: 11.5px; line-height: 1.6; color: #cbd5e1; text-align: center;">
            <span style="color: #38bdf8; font-weight: bold;">[Klant Edge Router]</span> <span style="color: #64748b;">(Gi0/0/0: 209.165.200.226/30)</span>
            &nbsp;─── <span style="color: #22c55e; font-weight: bold;">[Koperkabel]</span> ───&gt;&nbsp;
            <span style="color: #38bdf8; font-weight: bold;">[ISP Cloud]</span> <span style="color: #64748b;">(Gi0: 209.165.200.225/30)</span>
            &nbsp;───&gt;&nbsp;
            <span style="color: #f59e0b; font-weight: bold;">[8.8.8.8 / 1.1.1.1]</span>
          </div>

          <!-- CCNA RFC 3849 Standard Roles & IP Table -->
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 14px; margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px; color: #38bdf8; font-size: 13px;">📋 Bekende Publieke Internetadressen (Cisco Curriculum & Packet Tracer Standaard):</h4>
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;">
              In Cisco CCNA en Packet Tracer simuleert men een ISP-router met het officiële <strong>RFC 3849</strong> subnet <code>209.165.200.224/30</code> (masker <code>255.255.255.252</code>):
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
              <thead>
                <tr style="background: #0f172a; border-bottom: 2px solid #475569; text-align: left;">
                  <th style="padding: 6px 10px;">Rol</th>
                  <th style="padding: 6px 10px;">Interface</th>
                  <th style="padding: 6px 10px;">IP-adres / Subnet</th>
                  <th style="padding: 6px 10px;">Doel / Functie</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 6px 10px; font-weight: bold; color: #38bdf8;">Klant Edge Router</td>
                  <td style="padding: 6px 10px; font-family: monospace;">Gig0/0/0 (WAN)</td>
                  <td style="padding: 6px 10px; font-weight: bold; color: #22c55e;">209.165.200.226/30</td>
                  <td style="padding: 6px 10px; color: #cbd5e1;">Externe interface (NAT Outside)</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 6px 10px; font-weight: bold; color: #38bdf8;">ISP Cloud (Dit Apparaat)</td>
                  <td style="padding: 6px 10px; font-family: monospace;">GigabitEthernet0</td>
                  <td style="padding: 6px 10px; font-weight: bold; color: #38bdf8;">209.165.200.225/30</td>
                  <td style="padding: 6px 10px; color: #cbd5e1;">Default Gateway voor de klant</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 6px 10px; font-weight: bold; color: #f59e0b;">Google Anycast DNS</td>
                  <td style="padding: 6px 10px; font-family: monospace;">Loopback0</td>
                  <td style="padding: 6px 10px; font-weight: bold; color: #f59e0b;">8.8.8.8/32</td>
                  <td style="padding: 6px 10px; color: #cbd5e1;">Pingbaar doel & DNS resolutie</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 6px 10px; font-weight: bold; color: #f59e0b;">Cloudflare DNS</td>
                  <td style="padding: 6px 10px; font-family: monospace;">Loopback1</td>
                  <td style="padding: 6px 10px; font-weight: bold; color: #f59e0b;">1.1.1.1/32</td>
                  <td style="padding: 6px 10px; color: #cbd5e1;">Pingbaar doel & DNS resolutie</td>
                </tr>
                <tr>
                  <td style="padding: 6px 10px; font-weight: bold; color: #a78bfa;">Cisco CCNA Webserver</td>
                  <td style="padding: 6px 10px; font-family: monospace;">Loopback2</td>
                  <td style="padding: 6px 10px; font-weight: bold; color: #a78bfa;">209.165.200.230/30</td>
                  <td style="padding: 6px 10px; color: #cbd5e1;">Gesimuleerde HTTP website</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Step-by-Step Connection & Cisco IOS CLI Instructions -->
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 14px; margin-bottom: 16px;">
            <h4 style="margin: 0 0 8px; color: #22c55e; font-size: 13px;">⚙️ Hoe sluit je dit aan? (Cisco IOS Configuratie):</h4>
            <ol style="padding-left: 20px; font-size: 12px; color: #e2e8f0; line-height: 1.6; margin: 0;">
              <li>
                <strong>Kabel aansluiten:</strong> Sluit een koperkabel (Straight-Through of Cross-Over) aan tussen de WAN-poort van de router (bv. <code>GigabitEthernet0/0/0</code>) en de wolk (<code>GigabitEthernet0</code>).
              </li>
              <li>
                <strong>WAN-interface en Default Route instellen op de router:</strong>
                <pre style="background: #020617; color: #38bdf8; padding: 10px; border-radius: 4px; font-size: 11px; margin: 6px 0; overflow-x: auto;">
Router> enable
Router# configure terminal
Router(config)# interface GigabitEthernet0/0/0
Router(config-if)# ip address 209.165.200.226 255.255.255.252
Router(config-if)# no shutdown
Router(config-if)# exit
Router(config)# ip route 0.0.0.0 0.0.0.0 209.165.200.225
Router(config)# exit
Router# ping 209.165.200.225
Router# ping 8.8.8.8</pre>
              </li>
              <li>
                <strong>NAT Overload (PAT) configureren (zodat interne pc's kunnen pingen en surfen):</strong>
                <pre style="background: #020617; color: #38bdf8; padding: 10px; border-radius: 4px; font-size: 11px; margin: 6px 0; overflow-x: auto;">
Router(config)# interface GigabitEthernet0/0/0
Router(config-if)# ip nat outside
Router(config-if)# exit
Router(config)# interface GigabitEthernet0/0/1
Router(config-if)# ip nat inside
Router(config-if)# exit
Router(config)# access-list 1 permit 192.168.1.0 0.0.0.255
Router(config)# ip nat inside source list 1 interface GigabitEthernet0/0/0 overload</pre>
              </li>
            </ol>
          </div>

          <!-- Live vs Simulated Internet Mode Switch -->
          ${(!isPublicOnly && !isSimOnly) ? `
            <div style="background: #1e293b; padding: 14px 18px; border-radius: 8px; border: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #38bdf8; font-size: 13px;">🌐 Live NAT Adapter Wisselaar:</strong>
                <div style="font-size: 11.5px; color: #94a3b8; margin-top: 2px;">
                  Schakel om tussen afgesloten CCNA simulatie en echte live HTTP/DNS toegang via de serveradapter.
                </div>
              </div>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; background: #0f172a; padding: 6px 14px; border-radius: 20px; border: 2px solid ${isLive ? '#10b981' : '#475569'};">
                <input type="checkbox" id="chkLiveInternetModal" ${isLive ? 'checked' : ''} onchange="window.PXLApp.toggleLiveInternet(this.checked)" style="width: 16px; height: 16px; cursor: pointer;">
                <span style="font-weight: 800; font-size: 11.5px; color: ${isLive ? '#34d399' : '#cbd5e1'};">
                  ${isLive ? 'LIVE NAT AAN' : 'SIMULATIE'}
                </span>
              </label>
            </div>
          ` : ''}
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="pt-terminal-wrapper" style="cursor: text;">
        <div class="pt-terminal-screen" id="cliTerminalScreen"></div>
        <div class="pt-terminal-input-bar">
          <span class="pt-terminal-prompt" id="cliTerminalPrompt">${dev.getPrompt()}</span>
          <input type="text" class="pt-terminal-input" id="cliTerminalInput" autocomplete="off" spellcheck="false" autofocus>
        </div>
      </div>
    `;

    const screen = document.getElementById('cliTerminalScreen');
    const prompt = document.getElementById('cliTerminalPrompt');
    const input = document.getElementById('cliTerminalInput');
    const wrapper = container.querySelector('.pt-terminal-wrapper');

    // Clicking anywhere in the terminal focuses the input
    if (wrapper) {
      wrapper.onclick = () => {
        if (input) input.focus();
      };
    }

    if (dev.type === 'mikrotik') {
      this.activeTerminalParser = new MikroTikCLIParser(
        dev,
        (text) => {
          screen.innerHTML += `${text}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => {
          prompt.innerText = dev.getPrompt();
        },
        () => {
          this.triggerScoreUpdate();
        }
      );
      if (!dev.history || dev.history.length === 0) {
        screen.innerHTML = `MikroTik RouterOS 7.12 (c) 1994-2026\nRouterOS is active and ready.\nType '/help' or '?' for command reference.\n\n`;
      }
    } else if (dev.type === 'openwrt') {
      this.activeTerminalParser = new OpenWrtCLIParser(
        dev,
        (text) => {
          screen.innerHTML += `${text}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => {
          prompt.innerText = dev.getPrompt();
        },
        () => {
          this.triggerScoreUpdate();
        }
      );
      if (!dev.history || dev.history.length === 0) {
        screen.innerHTML = `  _______                     ________        __\n |       |.-----.-----.-----.|  |  |  |.----.|  |_\n |   -   ||  _  |  -__|     ||  |  |  ||   _||   _|\n |_______||   __|_____|__|__||________||__|  |____|\n          |__| W I R E L E S S   F R E E D O M\n -----------------------------------------------------\n OpenWrt 23.05.2, r23630-94290f9e3d\n -----------------------------------------------------\n\n`;
      }
    } else if (dev.type === 'hpe_switch') {
      this.activeTerminalParser = new HpeCLIParser(
        dev,
        (text) => {
          screen.innerHTML += `${text}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => {
          prompt.innerText = dev.getPrompt();
        },
        () => {
          this.triggerScoreUpdate();
        }
      );
      if (!dev.history || dev.history.length === 0) {
        screen.innerHTML = `HP J9773A 2530-24G Switch\nSoftware revision YA.16.10.0018\nCopyright (C) 1991-2026 Hewlett Packard Enterprise Development LP\n\nPress any key or enter commands. Type '?' or 'help' for command reference.\n\n`;
      }
    } else if (dev.type === 'wlc') {
      this.activeTerminalParser = new AireOSCLIParser(
        dev,
        (text) => {
          screen.innerHTML += `${text}\n`;
          dev.terminalBuffer = (dev.terminalBuffer || '') + `${text}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => {
          prompt.innerText = this.activeTerminalParser.getPrompt();
        },
        () => this.triggerScoreUpdate()
      );
      if (!dev.terminalBuffer) {
        dev.terminalBuffer = `(Cisco Controller)\nCisco 3504 Wireless LAN Controller\nSoftware Version: 8.10.190.0 (AireOS)\nType '?' or 'help' for command summary.\n\n`;
      }
    } else if (dev.type === 'cisco_asa') {
      this.activeTerminalParser = new CiscoASACLIParser(
        dev,
        (text) => {
          screen.innerHTML += `${text}\n`;
          dev.terminalBuffer = (dev.terminalBuffer || '') + `${text}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => {
          prompt.innerText = this.activeTerminalParser.getPrompt();
        },
        () => this.triggerScoreUpdate()
      );
      if (!dev.terminalBuffer) {
        dev.terminalBuffer = `Cisco Adaptive Security Appliance Software Version 9.14(2)\nDevice Manager Version 7.14(1)\nCompiled on Thu 16-Jul-20 23:59 by builders\nSystem image file is "disk0:/asa9142-smp-k8.bin"\n\nType "help" or "?" for a list of available commands.\n\n`;
      }
      screen.innerHTML = dev.terminalBuffer;
      prompt.innerText = this.activeTerminalParser.getPrompt();
    } else if (dev.type === 'fortigate') {
      this.activeTerminalParser = new FortiOSCLIParser(
        dev,
        (text) => {
          screen.innerHTML += `${text}\n`;
          dev.terminalBuffer = (dev.terminalBuffer || '') + `${text}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => {
          prompt.innerText = this.activeTerminalParser.getPrompt();
        },
        () => this.triggerScoreUpdate()
      );
      if (!dev.terminalBuffer) {
        dev.terminalBuffer = `FortiGate-60F (FGT60FTK23048921)\nFortiOS v7.4.2 build2573 (GA)\nType '?' or 'help' for command summary.\n\n`;
      }
      screen.innerHTML = dev.terminalBuffer;
      prompt.innerText = this.activeTerminalParser.getPrompt();
    } else if (dev.type === 'paloalto') {
      this.activeTerminalParser = new PANOSCLIParser(
        dev,
        (text) => {
          screen.innerHTML += `${text}\n`;
          dev.terminalBuffer = (dev.terminalBuffer || '') + `${text}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => {
          prompt.innerText = this.activeTerminalParser.getPrompt();
        },
        () => this.triggerScoreUpdate()
      );
      if (!dev.terminalBuffer) {
        dev.terminalBuffer = `Palo Alto Networks PA-440 (PAN-OS 11.0.2)\nLogin: admin\nLast login: ${new Date().toLocaleDateString()} from 192.168.1.100\n\n`;
      }
      screen.innerHTML = dev.terminalBuffer;
      prompt.innerText = this.activeTerminalParser.getPrompt();
    } else if (dev.type === 'opnsense') {
      this.activeTerminalParser = new OPNsenseConsoleParser(
        dev,
        (text) => {
          screen.innerHTML += `${text}\n`;
          dev.terminalBuffer = (dev.terminalBuffer || '') + `${text}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => {
          prompt.innerText = this.activeTerminalParser.getPrompt();
        },
        () => this.triggerScoreUpdate()
      );
      if (!dev.terminalBuffer) {
        this.activeTerminalParser.renderMenu();
      } else {
        screen.innerHTML = dev.terminalBuffer;
        prompt.innerText = this.activeTerminalParser.getPrompt();
      }
    } else if (dev.type === 'pfsense') {
      this.activeTerminalParser = new pfSenseConsoleParser(
        dev,
        (text) => {
          screen.innerHTML += `${text}\n`;
          dev.terminalBuffer = (dev.terminalBuffer || '') + `${text}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => {
          prompt.innerText = this.activeTerminalParser.getPrompt();
        },
        () => this.triggerScoreUpdate()
      );
      if (!dev.terminalBuffer) {
        this.activeTerminalParser.renderMenu();
      } else {
        screen.innerHTML = dev.terminalBuffer;
        prompt.innerText = this.activeTerminalParser.getPrompt();
      }
    } else if (dev.type === 'watchguard') {
      this.activeTerminalParser = new WatchGuardCLIParser(
        dev,
        (text) => {
          screen.innerHTML += `${text}\n`;
          dev.terminalBuffer = (dev.terminalBuffer || '') + `${text}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => {
          prompt.innerText = this.activeTerminalParser.getPrompt();
        },
        () => this.triggerScoreUpdate()
      );
      if (!dev.terminalBuffer) {
        dev.terminalBuffer = `WatchGuard FireboxV (Fireware OS v12.10.2 Build 684201)\nType '?' or 'help' for command summary.\n\n`;
      }
      screen.innerHTML = dev.terminalBuffer;
      prompt.innerText = this.activeTerminalParser.getPrompt();
    } else if (dev.type === 'cloud_wan') {
      this.activeTerminalParser = {
        getPrompt: () => 'Cloud-WAN> ',
        handleCommand: (c) => screen.innerHTML += `% Cloud WAN is een beheerde WAN-infrastructuur (Frame Relay/Cable/DSL ISP cloud). Sluit routers aan via Serial0/0/0 of Ethernet6.\n`,
        tabComplete: () => ''
      };
      screen.innerHTML = `PXL Multi-Access Cloud WAN Infrastructure\nProvider Backbone ISP Core (MPLS / DOCSIS / Frame Relay)\n\n`;
      prompt.innerText = 'Cloud-WAN> ';
    } else {
      this.activeTerminalParser = new CiscoCLIParser(
        dev,
        (text) => {
          screen.innerHTML += `${text}\n`;
          dev.terminalBuffer = (dev.terminalBuffer || '') + `${text}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => {
          prompt.innerText = getCurrentPrompt();
        },
        () => {
          this.triggerScoreUpdate();
        }
      );
      if (!dev.terminalBuffer) {
        dev.terminalBuffer = `Cisco IOS Software, ${dev.model} Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 15.4(3)M2\nTechnical Support: http://www.cisco.com/techsupport\nCopyright (c) 1986-2026 by Cisco Systems, Inc.\n\n`;
      }
      screen.innerHTML = dev.terminalBuffer;
      screen.scrollTop = screen.scrollHeight;
    }

    const getCurrentPrompt = () => {
      if (this.activeTerminalParser && typeof this.activeTerminalParser.getPrompt === 'function') {
        return this.activeTerminalParser.getPrompt();
      }
      return dev.getPrompt();
    };

    prompt.innerText = getCurrentPrompt();
    setTimeout(() => {
      if (input) input.focus();
    }, 50);

    input.onkeydown = (e) => {
      // Pager intercept for Space, Enter, q (--More--)
      if (this.activeTerminalParser && this.activeTerminalParser.pagerState) {
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          this.activeTerminalParser.handlePagerKey('space');
          prompt.innerText = getCurrentPrompt();
          screen.scrollTop = screen.scrollHeight;
          return;
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.activeTerminalParser.handlePagerKey('enter');
          prompt.innerText = getCurrentPrompt();
          screen.scrollTop = screen.scrollHeight;
          return;
        } else if (e.key === 'q' || e.key === 'Q') {
          e.preventDefault();
          this.activeTerminalParser.handlePagerKey('quit');
          prompt.innerText = getCurrentPrompt();
          screen.scrollTop = screen.scrollHeight;
          return;
        }
      }

      // Immediate Cisco Inline Help on '?' (no Enter key required, preserves input buffer)
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        const currentVal = input.value;
        const currentPrompt = getCurrentPrompt();
        screen.innerHTML += `${currentPrompt} ${currentVal}?\n`;
        dev.terminalBuffer = (dev.terminalBuffer || '') + `${currentPrompt} ${currentVal}?\n`;
        if (this.activeTerminalParser && typeof this.activeTerminalParser.handleInlineHelp === 'function') {
          this.activeTerminalParser.handleInlineHelp(currentVal);
        } else if (this.activeTerminalParser && typeof this.activeTerminalParser.showModeHelp === 'function') {
          this.activeTerminalParser.showModeHelp(currentVal.trim());
        }
        screen.scrollTop = screen.scrollHeight;
        input.value = currentVal;
        input.selectionStart = input.selectionEnd = currentVal.length;
        input.focus();
        return;
      }

      if (e.key === 'Enter') {
        const cmd = input.value;
        const currentPrompt = getCurrentPrompt();
        screen.innerHTML += `${currentPrompt} ${cmd}\n`;
        dev.terminalBuffer = (dev.terminalBuffer || '') + `${currentPrompt} ${cmd}\n`;
        input.value = '';
        this.activeTerminalParser.handleCommand(cmd);
        prompt.innerText = getCurrentPrompt();
        screen.scrollTop = screen.scrollHeight;
        this.triggerScoreUpdate();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (dev.history.length > 0 && dev.historyIndex > 0) {
          dev.historyIndex--;
          input.value = dev.history[dev.historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (dev.historyIndex < dev.history.length - 1) {
          dev.historyIndex++;
          input.value = dev.history[dev.historyIndex] || '';
        } else {
          dev.historyIndex = dev.history.length;
          input.value = '';
        }
      } else if (e.key === 'Tab' || e.keyCode === 9) {
        e.preventDefault();
        if (this.activeTerminalParser && typeof this.activeTerminalParser.tabComplete === 'function') {
          const completed = this.activeTerminalParser.tabComplete(input.value);
          if (completed && completed !== input.value) {
            input.value = completed;
            input.selectionStart = input.selectionEnd = completed.length;
          }
        }
        return;
      }
    };
  }

  // 4. DESKTOP TAB (PC / Laptop Apps)
  renderDesktopTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPaneDesktop');
    if (!dev || !container) return;

    container.innerHTML = `
      <div class="pt-desktop-grid">
        <div class="pt-desktop-icon" onclick="window.PXLApp.openPcApp('cmd')">
          <div class="pt-desktop-app-icon">⬛</div>
          <span>Command Prompt</span>
        </div>
        <div class="pt-desktop-icon" onclick="window.PXLApp.openPcApp('powershell')">
          <div class="pt-desktop-app-icon" style="background: #012456; color: #38bdf8; font-weight: 900; font-size: 14px; border: 1px solid #03449e; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">PS</div>
          <span>PowerShell</span>
        </div>
        <div class="pt-desktop-icon" onclick="window.PXLApp.openPcApp('linux')">
          <div class="pt-desktop-app-icon" style="background: #300a24; color: #e95420; font-weight: 900; font-size: 14px; border: 1px solid #772953; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🐧</div>
          <span>Linux Terminal</span>
        </div>
        <div class="pt-desktop-icon" onclick="window.PXLApp.openPcApp('putty')">
          <div class="pt-desktop-app-icon" style="background: #1e293b; color: #38bdf8; font-weight: 900; font-size: 14px; border: 1px solid #475569; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">💻</div>
          <span>PuTTY</span>
        </div>
        <div class="pt-desktop-icon" onclick="window.PXLApp.openPcApp('python')">
          <div class="pt-desktop-app-icon" style="background: #1e3a5f; color: #fbbf24; font-weight: 900; font-size: 14px; border: 1px solid #3b82f6; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🐍</div>
          <span>Python 3.12</span>
        </div>
        <div class="pt-desktop-icon" onclick="window.PXLApp.openPcApp('ipconfig')">
          <div class="pt-desktop-app-icon">⚙️</div>
          <span>IP Configuration</span>
        </div>
        <div class="pt-desktop-icon" onclick="window.PXLApp.openPcApp('web')">
          <div class="pt-desktop-app-icon">🌐</div>
          <span>Web Browser</span>
        </div>
        <div class="pt-desktop-icon" onclick="window.PXLApp.openPcApp('wireshark')">
          <div class="pt-desktop-app-icon" style="background: #0f172a; color: #38bdf8; font-weight: 900; font-size: 16px; border: 1px solid #0284c7; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🦈</div>
          <span>Wireshark</span>
        </div>
        ${(dev.hasWirelessCard && dev.hasWirelessCard()) || dev.type === 'laptop' ? `
          <div class="pt-desktop-icon" onclick="window.PXLApp.openPcApp('wireless')" title="PC Wireless Netwerkbeheer">
            <div class="pt-desktop-app-icon" style="background: #0284c7; color: #fff; font-size: 16px;">📶</div>
            <span>PC Wireless</span>
          </div>
        ` : ((dev.type === 'pc' || dev.type === 'server') ? `
          <div class="pt-desktop-icon" onclick="window.PXLApp.installPcWirelessCard()" title="WMP300N Wi-Fi Kaart installeren">
            <div class="pt-desktop-app-icon" style="background: rgba(14, 165, 233, 0.12); border: 1px dashed #0284c7; color: #38bdf8; font-size: 15px;">➕📶</div>
            <span style="color: #94a3b8;">Wi-Fi Installeren</span>
          </div>
        ` : '')}
        ${dev.type === 'server' ? `
          <div class="pt-desktop-icon" onclick="window.PXLApp.switchDeviceModalTab('services')">
            <div class="pt-desktop-app-icon">🖥️</div>
            <span>Server Services</span>
          </div>
        ` : ''}
      </div>
      <div id="pcAppContainer" class="pt-pc-app-viewport"></div>
    `;

    this.openPcApp('ipconfig');
  }

  openPcApp(appKey) {
    const dev = this.activeDevice;
    const viewport = document.getElementById('pcAppContainer');
    if (!dev || !viewport) return;

    if (appKey === 'ipconfig') {
      const isDhcp = !!dev.dhcpEnabled;
      viewport.innerHTML = `
        <div class="pt-app-window">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
            <h4 style="margin: 0; color: #0f172a; font-size: 14px;">⚙️ IP Configuration</h4>
            <span id="dhcpStatusIndicator" style="font-size: 11.5px; font-weight: 600; color: ${isDhcp ? (dev.ip?.startsWith('169.254') ? '#d97706' : '#16a34a') : '#64748b'};">
              ${isDhcp ? (dev.ip?.startsWith('169.254') ? '⚠️ APIPA Actief (Geen DHCP Server)' : '🟢 DHCP Actief (IP Verleend)') : 'Statische IP-modus'}
            </span>
          </div>
          <div class="pt-form-group" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px;">
            <label style="font-weight: 700; color: #334155; margin-right: 15px;">IP Configuration Mode:</label>
            <label style="cursor: pointer; margin-right: 15px;"><input type="radio" name="ipMode" ${!isDhcp ? 'checked' : ''} onchange="window.PXLApp.triggerPcDhcpRadio(false)"> Static</label>
            <label style="cursor: pointer;"><input type="radio" name="ipMode" ${isDhcp ? 'checked' : ''} onchange="window.PXLApp.triggerPcDhcpRadio(true)"> DHCP</label>
          </div>
          <div class="pt-form-group">
            <label>IPv4 Address:</label>
            <input type="text" class="pt-input" id="pcIpInput" value="${dev.ip || ''}" ${isDhcp ? 'readonly style="background:#f1f5f9; color:#475569;"' : ''}>
          </div>
          <div class="pt-form-group">
            <label>Subnet Mask:</label>
            <input type="text" class="pt-input" id="pcMaskInput" value="${dev.mask || ''}" ${isDhcp ? 'readonly style="background:#f1f5f9; color:#475569;"' : ''}>
          </div>
          <div class="pt-form-group">
            <label>Default Gateway:</label>
            <input type="text" class="pt-input" id="pcGwInput" value="${dev.gateway || ''}" ${isDhcp ? 'readonly style="background:#f1f5f9; color:#475569;"' : ''}>
          </div>
          <div class="pt-form-group">
            <label>DNS Server:</label>
            <input type="text" class="pt-input" id="pcDnsInput" value="${dev.dns || '8.8.8.8'}" ${isDhcp ? 'readonly style="background:#f1f5f9; color:#475569;"' : ''}>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.savePcIpConfig()">Opslaan & Toepassen</button>
            ${isDhcp ? `<button class="pt-btn pt-btn-secondary" onclick="window.PXLApp.triggerPcDhcpRadio(true)">🔄 DHCP Vernieuwen</button>` : ''}
          </div>
        </div>
      `;
    } else if (appKey === 'cmd') {
      viewport.innerHTML = `
        <div class="pt-app-window pt-cmd-window">
          <div class="pt-terminal-screen" id="pcCmdScreen">Command Prompt (Microsoft Windows PXL NetSim Edition)\n(c) Hogeschool PXL. All rights reserved.\n\n</div>
          <div class="pt-terminal-input-bar">
            <span class="pt-terminal-prompt" id="pcCmdPrompt">C:\\Users\\Student> </span>
            <input type="text" class="pt-terminal-input" id="pcCmdInput" autocomplete="off" spellcheck="false">
          </div>
        </div>
      `;

      const screen = document.getElementById('pcCmdScreen');
      const input = document.getElementById('pcCmdInput');
      const promptEl = document.getElementById('pcCmdPrompt');
      const handler = new PCDesktopHandler(
        dev,
        (t) => {
          screen.innerHTML += `${t}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => this.triggerScoreUpdate(),
        (newPrompt) => {
          if (promptEl) promptEl.innerText = newPrompt;
        }
      );

      input.focus();
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const val = input.value;
          const curPrompt = promptEl ? promptEl.innerText : 'C:\\Users\\Student> ';
          screen.innerHTML += `${curPrompt} ${val}\n`;
          input.value = '';
          handler.handleCommand(val);
          screen.scrollTop = screen.scrollHeight;
        } else if (e.key === 'Tab') {
          e.preventDefault();
          if (handler && typeof handler.tabComplete === 'function') {
            const completed = handler.tabComplete(input.value);
            if (completed && completed !== input.value) {
              input.value = completed;
              input.selectionStart = input.selectionEnd = completed.length;
            }
          }
        }
      };
    } else if (appKey === 'powershell') {
      const isServer = (dev.type === 'server');
      const defaultPrompt = isServer ? 'PS C:\\Users\\Administrator> ' : 'PS C:\\Users\\Student> ';
      viewport.innerHTML = `
        <div class="pt-app-window pt-powershell-window">
          <div class="pt-terminal-screen" id="pcPsScreen">Windows PowerShell (PXL NetSim Edition v7.4)\nCopyright (C) Microsoft Corporation / Hogeschool PXL (Toegepaste Informatica / SNE).\n\nTyp 'Get-Help' voor een lijst met ondersteunde cmdlets en netwerkcommando's.\n\n</div>
          <div class="pt-terminal-input-bar">
            <span class="pt-terminal-prompt" id="pcPsPrompt">${defaultPrompt}</span>
            <input type="text" class="pt-terminal-input" id="pcPsInput" autocomplete="off" spellcheck="false">
          </div>
        </div>
      `;

      const screen = document.getElementById('pcPsScreen');
      const input = document.getElementById('pcPsInput');
      const promptEl = document.getElementById('pcPsPrompt');
      const psHandler = new PowerShellHandler(
        dev,
        (t) => {
          screen.innerHTML += `${t}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => this.triggerScoreUpdate(),
        (newPrompt) => {
          if (promptEl) promptEl.innerText = newPrompt;
        }
      );

      input.focus();
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const val = input.value;
          const curPrompt = promptEl ? promptEl.innerText : defaultPrompt;
          screen.innerHTML += `${curPrompt}${val}\n`;
          input.value = '';
          psHandler.handleCommand(val);
          screen.scrollTop = screen.scrollHeight;
        } else if (e.key === 'Tab') {
          e.preventDefault();
          if (psHandler && typeof psHandler.tabComplete === 'function') {
            const completed = psHandler.tabComplete(input.value);
            if (completed && completed !== input.value) {
              input.value = completed;
              input.selectionStart = input.selectionEnd = completed.length;
            }
          }
        }
      };
    } else if (appKey === 'linux') {
      const isServer = (dev.type === 'server');
      const defaultUser = isServer ? 'root' : 'student';
      const defaultPrompt = isServer ? `root@${dev.hostname || 'pxl-server'}:~# ` : `student@${dev.hostname || 'pxl-client'}:~$ `;
      viewport.innerHTML = `
        <div class="pt-app-window pt-linux-window" style="background: #300a24; height: 100%; display: flex; flex-direction: column;">
          <div class="pt-terminal-screen" id="pcLinuxScreen" style="color: #ffffff; background: #300a24; flex: 1; padding: 12px; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; overflow-y: auto; white-space: pre-wrap;">Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-40-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

PXL NetSim Linux Terminal &amp; Networking Tools ready.
Type 'help', 'ip a', or 'python3' to get started.

</div>
          <div class="pt-terminal-input-bar" style="background: #300a24; border-top: 1px solid #772953; display: flex; align-items: center; padding: 6px 12px;">
            <span class="pt-terminal-prompt" id="pcLinuxPrompt" style="color: #4af626; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; font-weight: bold; margin-right: 6px;">${defaultPrompt}</span>
            <input type="text" class="pt-terminal-input" id="pcLinuxInput" autocomplete="off" spellcheck="false" style="color: #ffffff; background: transparent; border: none; outline: none; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; flex: 1;">
          </div>
        </div>
      `;

      const screen = document.getElementById('pcLinuxScreen');
      const input = document.getElementById('pcLinuxInput');
      const promptEl = document.getElementById('pcLinuxPrompt');
      const linuxHandler = new LinuxCLIHandler(
        dev,
        (t) => {
          screen.innerHTML += `${t}\n`;
          screen.scrollTop = screen.scrollHeight;
        },
        () => this.triggerScoreUpdate(),
        (newPrompt) => {
          if (promptEl) promptEl.innerText = newPrompt;
        }
      );

      input.focus();
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const val = input.value;
          const curPrompt = promptEl ? promptEl.innerText : defaultPrompt;
          screen.innerHTML += `${curPrompt}${val}\n`;
          input.value = '';
          linuxHandler.handleCommand(val);
          screen.scrollTop = screen.scrollHeight;
        } else if (e.key === 'Tab') {
          e.preventDefault();
          if (linuxHandler && typeof linuxHandler.tabComplete === 'function') {
            const completed = linuxHandler.tabComplete(input.value);
            if (completed && completed !== input.value) {
              input.value = completed;
              input.selectionStart = input.selectionEnd = completed.length;
            }
          }
        }
      };
    } else if (appKey === 'putty') {
      if (typeof renderPuttyConfigHtml === 'function') {
        viewport.innerHTML = renderPuttyConfigHtml(dev);
      } else {
        viewport.innerHTML = `<div style="padding:20px; color:#fff;">PuTTY module niet geladen.</div>`;
      }
    } else if (appKey === 'python') {
      if (typeof renderPythonAppHtml === 'function') {
        viewport.innerHTML = renderPythonAppHtml(dev);
      } else {
        viewport.innerHTML = `<div style="padding:20px; color:#fff;">Python 3.12 IDE module niet geladen.</div>`;
      }
    } else if (appKey === 'wireless') {
      if (typeof window.renderPcWirelessAppHtml === 'function') {
        viewport.innerHTML = window.renderPcWirelessAppHtml(dev, this.sim);
      } else {
        viewport.innerHTML = `<div style="padding:20px; color:#fff;">PC Wireless module niet geladen.</div>`;
      }
    } else if (appKey === 'web') {
      viewport.innerHTML = `
        <div class="pt-app-window pt-browser-window">
          <div class="pt-browser-bar">
            <span style="font-weight: 700; color: #475569; display: flex; align-items: center; gap: 4px;">🌐 URL:</span>
            <input type="text" id="browserUrlInput" value="http://www.pxl.be" placeholder="http://www.pxl.be of http://172.16.1.10">
            <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.browseToUrl()">Go</button>
          </div>
          <div class="pt-browser-frame" id="browserContentArea">
            <div style="text-align: center; color: #64748b; margin-top: 40px;">
              <div style="font-size: 32px; margin-bottom: 10px;">🌐</div>
              <p>Voer een webadres in (bv. <code>http://www.pxl.be</code>) en klik op <strong>Go</strong> om te verbinden via DNS en routering.</p>
            </div>
          </div>
        </div>
      `;
      const urlInput = document.getElementById('browserUrlInput');
      if (urlInput) {
        urlInput.onkeydown = (e) => {
          if (e.key === 'Enter') this.browseToUrl();
        };
      }
    } else if (appKey === 'wireshark') {
      if (window.WiresharkApp) {
        const ws = new window.WiresharkApp(dev, { containerId: 'pcAppContainer' });
        ws.render();
      } else {
        viewport.innerHTML = `<div style="padding:20px; color:#fff;">Wireshark module niet geladen.</div>`;
      }
    }
  }

  browseToUrl() {
    const input = document.getElementById('browserUrlInput');
    const area = document.getElementById('browserContentArea');
    if (!input || !area || !this.activeDevice) return;
    const url = input.value.trim();
    if (!url) return;

    area.innerHTML = `<div style="text-align: center; color: #0284c7; margin-top: 40px;">⏳ Verbinding maken met ${url}...</div>`;

    setTimeout(async () => {
      const res = this.sim.fetchHttp(this.activeDevice.id, url);
      if (res.success) {
        if (res.isLiveProxy) {
          area.innerHTML = `<div style="text-align: center; color: #0284c7; margin-top: 40px;">🌐 Echte live website ophalen via fysieke Cloud NAT Gateway: <strong>${res.liveUrl}</strong>...</div>`;
          try {
            const proxyRes = await fetch('/api/gateway/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: res.liveUrl })
            });
            const data = await proxyRes.json();
            if (data.success) {
              area.innerHTML = data.html;
            } else {
              area.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; color: #991b1b; text-align: left; max-width: 500px; margin: 20px auto;">
                  <h4 style="margin-top:0;">Kan live website niet laden</h4>
                  <p><strong>Fout:</strong> ${data.reason}</p>
                </div>
              `;
            }
          } catch (err) {
            area.innerHTML = `<div style="color: red; padding: 20px;">Fout bij verbinden met fysieke NAT gateway: ${err.message}</div>`;
          }
        } else {
          area.innerHTML = res.html;
        }
      } else {
        area.innerHTML = `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; color: #991b1b; text-align: left; max-width: 500px; margin: 20px auto;">
            <h4 style="margin-top:0;">Kan website niet openen</h4>
            <p><strong>Fout:</strong> ${res.reason}</p>
            <hr style="border: 0; border-top: 1px solid #fecaca; margin: 15px 0;">
            <p style="font-size: 11px; color: #7f1d1d;">Controleer of de host een correct IP-adres, Default Gateway en DNS Server IP heeft geconfigureerd, en of de webserver bereikbaar is via routering.</p>
          </div>
        `;
      }
    }, 100);
  }

  toggleLiveInternet(enabled) {
    this.sim.setLiveInternet(enabled);
    this.showToast(enabled ? '🌐 Echte Internet NAT Gateway geactiveerd (Live WAN)!' : '🔒 Gesimuleerde examenmodus geactiveerd.');
    const chk = document.getElementById('chkLiveInternetModal');
    if (chk) chk.checked = enabled;
    const studioSel = document.getElementById('studioLiveInternet');
    if (studioSel) studioSel.value = enabled ? 'true' : 'false';
    if (this.activeDevice && this.activeDevice.type === 'internet_cloud') {
      this.renderCliTab();
    }
  }

  openGlobalWireshark() {
    let modal = document.getElementById('globalWiresharkModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'globalWiresharkModal';
      modal.className = 'pt-modal-overlay';
      modal.style.zIndex = '9999';
      modal.innerHTML = `
        <div class="pt-device-dialog" style="width: 94vw; max-width: 1300px; height: 88vh; display: flex; flex-direction: column; background: #0f172a; border-radius: 8px; border: 2px solid #0284c7; box-shadow: 0 25px 60px rgba(0,0,0,0.75); overflow: hidden;">
          <div style="background: #1e293b; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155;">
            <div style="display: flex; align-items: center; gap: 8px; color: #38bdf8; font-weight: 700; font-size: 14px;">
              <span>🦈 Wireshark Protocol Analyzer &amp; OSI Inspector (Topologie Capture)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="pt-btn pt-btn-secondary" style="padding: 4px 10px; font-size: 11px; background: #334155; color: #f8fafc; border: 1px solid #475569; cursor: pointer;" onclick="window.PXLApp.closeGlobalWireshark()">Sluiten</button>
              <button class="pt-btn-close" style="color: #94a3b8; font-size: 20px; cursor: pointer; background: transparent; border: none; padding: 2px 6px;" onclick="window.PXLApp.closeGlobalWireshark()" title="Sluit Wireshark">✕</button>
            </div>
          </div>
          <div id="globalWiresharkViewport" style="flex: 1; overflow: hidden; height: calc(88vh - 50px);"></div>
        </div>
      `;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeGlobalWireshark();
        }
      });
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.classList.add('active');
    if (window.WiresharkApp) {
      const ws = new window.WiresharkApp(null, { isGlobal: true, containerId: 'globalWiresharkViewport' });
      ws.render();
    }
  }

  closeGlobalWireshark() {
    const modal = document.getElementById('globalWiresharkModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }

  triggerPcDhcpRadio(isDhcp) {
    const dev = this.activeDevice;
    if (!dev) return;
    dev.dhcpEnabled = isDhcp;

    const ipInput = document.getElementById('pcIpInput');
    const maskInput = document.getElementById('pcMaskInput');
    const gwInput = document.getElementById('pcGwInput');
    const dnsInput = document.getElementById('pcDnsInput');
    const statusEl = document.getElementById('dhcpStatusIndicator');

    if (isDhcp) {
      if (ipInput) { ipInput.readOnly = true; ipInput.style.background = '#f1f5f9'; ipInput.style.color = '#475569'; }
      if (maskInput) { maskInput.readOnly = true; maskInput.style.background = '#f1f5f9'; maskInput.style.color = '#475569'; }
      if (gwInput) { gwInput.readOnly = true; gwInput.style.background = '#f1f5f9'; gwInput.style.color = '#475569'; }
      if (dnsInput) { dnsInput.readOnly = true; dnsInput.style.background = '#f1f5f9'; dnsInput.style.color = '#475569'; }
      if (statusEl) { statusEl.innerHTML = '⏳ DHCP Discover / Request verzenden...'; statusEl.style.color = '#0284c7'; }

      setTimeout(() => {
        const res = this.sim.requestDhcp(dev.id);
        if (res.success) {
          if (ipInput) ipInput.value = res.ip;
          if (maskInput) maskInput.value = res.mask;
          if (gwInput) gwInput.value = res.gateway;
          if (dnsInput) dnsInput.value = res.dns;
          if (statusEl) {
            statusEl.innerHTML = `🟢 DHCP geslaagd! (${res.ip} via ${res.serverName})`;
            statusEl.style.color = '#16a34a';
          }
          this.showToast(`✅ DHCP IP-adres ontvangen: ${res.ip}`);
        } else {
          if (ipInput) ipInput.value = dev.ip || '169.254.x.x';
          if (maskInput) maskInput.value = dev.mask || '255.255.0.0';
          if (gwInput) gwInput.value = '';
          if (statusEl) {
            statusEl.innerHTML = `⚠️ DHCP mislukt. APIPA actief (${dev.ip})`;
            statusEl.style.color = '#d97706';
          }
          this.showToast(`⚠️ Geen DHCP-server gevonden (APIPA ${dev.ip})`);
        }
        this.triggerScoreUpdate();
      }, 150);
    } else {
      if (ipInput) { ipInput.readOnly = false; ipInput.style.background = '#ffffff'; ipInput.style.color = '#0f172a'; }
      if (maskInput) { maskInput.readOnly = false; maskInput.style.background = '#ffffff'; maskInput.style.color = '#0f172a'; }
      if (gwInput) { gwInput.readOnly = false; gwInput.style.background = '#ffffff'; gwInput.style.color = '#0f172a'; }
      if (dnsInput) { dnsInput.readOnly = false; dnsInput.style.background = '#ffffff'; dnsInput.style.color = '#0f172a'; }
      if (statusEl) { statusEl.innerHTML = 'Statische IP-modus'; statusEl.style.color = '#64748b'; }
      this.triggerScoreUpdate();
    }
  }

  savePcIpConfig() {
    const dev = this.activeDevice;
    if (!dev) return;
    dev.ip = document.getElementById('pcIpInput').value.trim();
    dev.mask = document.getElementById('pcMaskInput').value.trim();
    dev.gateway = document.getElementById('pcGwInput').value.trim();
    dev.dns = document.getElementById('pcDnsInput').value.trim();

    // Synchronize hardware FastEthernet0 port
    if (dev.interfaces) {
      if (!dev.interfaces['FastEthernet0']) {
        dev.interfaces['FastEthernet0'] = { ip: "", mask: "", shutdown: false, description: "FastEthernet0" };
      }
      dev.interfaces['FastEthernet0'].ip = dev.ip;
      dev.interfaces['FastEthernet0'].mask = dev.mask;
      dev.interfaces['FastEthernet0'].shutdown = false;
    }

    this.showToast('✅ IP configuratie opgeslagen');
    this.triggerScoreUpdate();
  }

  savePcWireless() {
    const dev = this.activeDevice;
    if (!dev) return;
    dev.wireless.ssid = document.getElementById('pcWlanSsid').value.trim();
    dev.wireless.passphrase = document.getElementById('pcWlanPass').value.trim();
    this.sim.updateWirelessAssociations();
    this.canvasWorkspace.render();
    this.showToast('📡 Draadloze instellingen bijgewerkt');
    this.triggerScoreUpdate();
  }

  // --- SCORE & RUBRIC MANAGEMENT ---
  triggerScoreUpdate() {
    const evalResult = this.gradingEngine.evaluate();

    const scoreText = document.getElementById('scoreText');
    const scoreBar = document.getElementById('scoreBar');

    if (scoreText && scoreBar) {
      if (this.activeExam && this.activeExam.showLiveScore === false) {
        scoreText.innerText = 'Examen Bezig';
        scoreBar.style.width = '100%';
        scoreBar.style.backgroundColor = '#38bdf8';
      } else {
        scoreText.innerText = `Score: ${evalResult.percentage}% (${evalResult.earnedPoints}/${evalResult.totalPoints} pt)`;
        scoreBar.style.width = `${evalResult.percentage}%`;
        scoreBar.style.backgroundColor = evalResult.percentage >= 80 ? 'var(--pt-green)' : (evalResult.percentage >= 50 ? 'var(--pxl-accent)' : 'var(--pt-red)');
      }
    }

    const canvasScorePct = document.getElementById('canvasScorePct');
    if (canvasScorePct) {
      canvasScorePct.innerText = `${evalResult.percentage}%`;
    }

    const panel = document.getElementById('opdrachtDropdownPanel');
    if (panel && (panel.classList.contains('open') || panel.classList.contains('pinned') || panel.style.display === 'flex')) {
      this.updateRubricSectionOnly(evalResult);
    }
  }

  toggleRubricPanel() {
    const panel = document.getElementById('opdrachtDropdownPanel');
    if (!panel) return;
    const isHidden = (panel.style.display === 'none' || !panel.style.display || !panel.classList.contains('open'));
    if (isHidden) {
      this.renderOpdrachtDropdown();
      panel.style.display = 'flex';
      panel.classList.add('open');
      const rubricEl = document.getElementById('rubricSidePanel');
      if (rubricEl) rubricEl.classList.add('open');
    }
    const rubricAnchor = document.getElementById('rubricSidePanel');
    if (rubricAnchor) {
      rubricAnchor.scrollIntoView({ behavior: 'smooth' });
    }
  }

  renderRubricSidePanel() {
    this.renderOpdrachtDropdown();
  }

  // --- EXAM TIMER ---
  startExamTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (this.timerSeconds > 0) {
        this.timerSeconds--;
        const mins = Math.floor(this.timerSeconds / 60);
        const secs = this.timerSeconds % 60;
        const timerEl = document.getElementById('examTimer');
        if (timerEl) {
          timerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
      }
    }, 1000);
  }

  // --- SUBMISSION MODAL ---
  openSubmissionModal() {
    const modal = document.getElementById('submissionModal');
    if (modal) modal.style.display = 'flex';
  }

  closeSubmissionModal() {
    const modal = document.getElementById('submissionModal');
    if (modal) modal.style.display = 'none';
  }

  submitExamPackage() {
    const name = document.getElementById('subStudentName').value || 'Student';
    const num = document.getElementById('subStudentNum').value || '00000000';
    const group = document.getElementById('subStudentGroup').value || '1SNE';

    SubmissionExporter.exportAndDownload({
      name: name,
      studentNumber: num,
      classGroup: group
    });

    this.closeSubmissionModal();
    this.showToast('🎉 Examen succesvol ingeleverd en gedownload!');
  }

  // --- BUG REPORT & DIAGNOSTICS SYSTEM ---
  openBugReportModal() {
    const modal = document.getElementById('bugReportModal');
    if (!modal) return;

    // Generate unique bug code: BUG-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randHex = Math.floor(Math.random() * 65535).toString(16).toUpperCase().padStart(4, '0');
    this.currentBugCode = `BUG-${dateStr}-${randHex}`;

    const codePill = document.getElementById('bugReportCodePill');
    if (codePill) codePill.innerText = this.currentBugCode;

    const user = this.currentUser || { username: 'gast', full_name: 'Anonieme Gebruiker', role: 'student', class_group: 'Geen klas' };
    const userInfoEl = document.getElementById('bugReportUserInfo');
    if (userInfoEl) {
      userInfoEl.innerText = `Melder: ${user.full_name || user.username} (${user.class_group || user.role})`;
    }

    const descEl = document.getElementById('bugReportDescription');
    if (descEl) descEl.value = '';

    modal.style.display = 'flex';
  }

  closeBugReportModal() {
    const modal = document.getElementById('bugReportModal');
    if (modal) modal.style.display = 'none';
  }

  generateBugSnapshotPayload() {
    const user = this.currentUser || { username: 'gast', full_name: 'Gast Gebruiker', role: 'student', class_group: '' };
    const examSelector = document.getElementById('examSelector');
    const examId = examSelector ? examSelector.value : 'vrij_lab';
    const examTitle = examSelector ? examSelector.options[examSelector.selectedIndex]?.text : 'Vrij Netwerk Lab';

    // 1. Export complete topology
    const topology = this.sim ? this.sim.exportTopology() : {};

    // 2. Export granular running configs & states of all devices
    const deviceConfigs = {};
    if (this.sim && this.sim.devices) {
      for (const [dId, dev] of Object.entries(this.sim.devices)) {
        deviceConfigs[dId] = {
          id: dev.id,
          hostname: dev.hostname,
          type: dev.type,
          model: dev.model,
          powerOn: dev.powerOn,
          runningConfig: (typeof dev.generateRunningConfig === 'function') ? dev.generateRunningConfig() : null,
          interfaces: JSON.parse(JSON.stringify(dev.interfaces || {})),
          staticRoutes: dev.staticRoutes ? JSON.parse(JSON.stringify(dev.staticRoutes)) : [],
          arpTable: dev.arpTable ? JSON.parse(JSON.stringify(dev.arpTable)) : {},
          macTable: dev.macTable ? JSON.parse(JSON.stringify(dev.macTable)) : {},
          services: dev.services ? JSON.parse(JSON.stringify(dev.services)) : {},
          mikrotikConfig: dev.mikrotikConfig ? JSON.parse(JSON.stringify(dev.mikrotikConfig)) : null,
          openwrtConfig: dev.openwrtConfig ? JSON.parse(JSON.stringify(dev.openwrtConfig)) : null,
          hpeConfig: dev.hpeConfig ? JSON.parse(JSON.stringify(dev.hpeConfig)) : null,
          history: dev.history ? dev.history.slice(-20) : []
        };
      }
    }

    const category = document.getElementById('bugReportCategory')?.value || 'general';
    const description = document.getElementById('bugReportDescription')?.value || '';

    return {
      bug_code: this.currentBugCode || `BUG-${Date.now()}`,
      created_at: new Date().toISOString(),
      status: 'open',
      reporter_username: user.username,
      reporter_name: user.full_name || user.username,
      reporter_role: user.role,
      reporter_class: user.class_group || '',
      exam_id: examId,
      exam_title: examTitle,
      category: category,
      user_description: description,
      browser_info: {
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        url: window.location.href,
        timestamp: new Date().toISOString()
      },
      topology: topology,
      device_configs: deviceConfigs
    };
  }

  async submitBugReport(event) {
    if (event) event.preventDefault();
    const payload = this.generateBugSnapshotPayload();
    if (!payload.user_description || !payload.user_description.trim()) {
      alert('Vul a.u.b. een korte toelichting in van wat er misging.');
      return;
    }

    try {
      const res = await fetch('/api/bug-report/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.closeBugReportModal();
        this.showToast(`✅ Bugmelding ${payload.bug_code} opgeslagen!`);
        alert(`🎉 Bugmelding succesvol geregistreerd met unieke code:\n\n${payload.bug_code}\n\nDe docent en AI-assistent hebben nu direct toegang tot je opgeslagen topologie en running-configs om het probleem te verhelpen.`);
        // Refresh Teacher Studio bugs tab if open
        if (window.teacherStudio && typeof window.teacherStudio.loadBugs === 'function') {
          window.teacherStudio.loadBugs();
        }
      } else {
        alert(`Fout bij verzenden van bug: ${data.error || 'Onbekende serverfout'}`);
      }
    } catch (err) {
      alert(`Netwerkfout bij bugmelding: ${err.message}`);
    }
  }

  exportCurrentBugJson() {
    const payload = this.generateBugSnapshotPayload();
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${payload.bug_code}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast(`📥 ${payload.bug_code}.json gedownload`);
  }

  showToast(msg) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    toast.innerText = msg;
    toast.className = 'pt-toast show';
    setTimeout(() => {
      toast.className = 'pt-toast';
    }, 3500);
  }

  // --- SERVER SERVICES (HTTP WEB, DHCP, DNS, LDAP, FTP) ---
  renderServicesTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPaneServices');
    if (!dev || !container) return;

    if (!dev.services) {
      dev.services = {};
    }
    if (!dev.services.http) {
      dev.services.http = { enabled: true, port: 80, content: '<h1>PXL Web Server</h1>' };
    }
    if (!dev.services.dhcp) {
      dev.services.dhcp = {
        enabled: true,
        poolName: 'serverPool',
        gateway: dev.gateway || '172.16.1.1',
        dns: dev.ip || '172.16.1.10',
        startIp: '172.16.1.100',
        mask: '255.255.255.0',
        maxUsers: 50,
        tftpServer: '0.0.0.0',
        wlcIp: '10.10.0.254',
        pools: [{ name: 'serverPool', gateway: dev.gateway || '172.16.1.1', dns: dev.ip || '172.16.1.10', startIp: '172.16.1.100', mask: '255.255.255.0', maxUsers: 50 }],
        leases: []
      };
    }
    if (!dev.services.dns) {
      dev.services.dns = {
        enabled: true,
        records: [
          { name: 'www.pxl.be', type: 'A', ip: dev.ip || '172.16.1.10' },
          { name: 'cisco.pxl', type: 'A', ip: dev.ip || '172.16.1.10' },
          { name: 'web.pxl.local', type: 'CNAME', target: 'www.pxl.be' }
        ],
        forwarders: { enabled: true, primary: '8.8.8.8', secondary: '1.1.1.1' }
      };
    }
    if (!dev.services.dns.forwarders) {
      dev.services.dns.forwarders = { enabled: true, primary: '8.8.8.8', secondary: '1.1.1.1' };
    }
    if (!dev.services.ldap) {
      dev.services.ldap = {
        enabled: true,
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
      };
    }
    if (!dev.services.ftp) {
      dev.services.ftp = {
        enabled: true,
        users: [{ username: 'cisco', password: 'cisco', permissions: 'RWDNL' }, { username: 'anonymous', password: '', permissions: 'R' }],
        files: [
          { name: 'c4300-universalk9-mz.SPA.154-3.M2.bin', size: '12402176 bytes' },
          { name: 'pxl-lab-oefening.pka', size: '45020 bytes' },
          { name: 'sample.txt', size: '1024 bytes' }
        ]
      };
    }

    const sub = this.activeServiceSubtab || 'http';

    container.innerHTML = `
      <div class="pt-services-container">
        <div class="pt-services-sidebar">
          <h4 style="font-size: 11px; text-transform: uppercase; color: #94a3b8; padding-left: 8px; margin: 4px 0 10px;">Server Diensten</h4>
          <button class="pt-service-nav-btn ${sub === 'http' ? 'active' : ''}" onclick="window.PXLApp.switchServiceSubtab('http')">🌐 HTTP / Web</button>
          <button class="pt-service-nav-btn ${sub === 'dhcp' ? 'active' : ''}" onclick="window.PXLApp.switchServiceSubtab('dhcp')">📡 DHCP Server</button>
          <button class="pt-service-nav-btn ${sub === 'dns' ? 'active' : ''}" onclick="window.PXLApp.switchServiceSubtab('dns')">🔎 DNS Service</button>
          <button class="pt-service-nav-btn ${sub === 'ldap' ? 'active' : ''}" onclick="window.PXLApp.switchServiceSubtab('ldap')">👥 LDAP / Active Directory</button>
          <button class="pt-service-nav-btn ${sub === 'ftp' ? 'active' : ''}" onclick="window.PXLApp.switchServiceSubtab('ftp')">📁 FTP Service</button>
        </div>
        <div class="pt-service-content">
          ${this.getServiceSubtabHtml(sub, dev)}
        </div>
      </div>
    `;
  }

  switchServiceSubtab(sub) {
    this.activeServiceSubtab = sub;
    this.renderServicesTab();
  }

  getServiceSubtabHtml(sub, dev) {
    if (sub === 'http') {
      const http = dev.services.http;
      if (!http.files) {
        http.files = {
          'index.html': http.content || '<h1>PXL Web Server</h1>\n<p>Welkom op de server van Hogeschool PXL!</p>',
          'helloworld.html': '<h2>Hello World!</h2>\n<p>PXL Network Essentials Web Server Test Pagina.</p>',
          'style.css': 'body { font-family: -apple-system, sans-serif; background: #f8fafc; color: #0f172a; padding: 25px; }\nh1 { color: #0284c7; }',
          'data.json': JSON.stringify({ school: 'Hogeschool PXL', department: 'Toegepaste Informatica / SNE', course: 'Network Essentials', status: 'online' }, null, 2),
          'info.txt': 'PXL Web NetSim Server v2.1\nMulti-format HTTP Server.\nOndersteunde formaten: .html, .css, .json, .txt'
        };
      }

      this.currentHttpFile = this.currentHttpFile || 'index.html';
      if (!http.files[this.currentHttpFile]) {
        this.currentHttpFile = Object.keys(http.files)[0] || 'index.html';
      }

      const activeContent = http.files[this.currentHttpFile] || '';

      return `
        <h3>🌐 HTTP Webserver Configuratie (Multi-Formaat Server)</h3>
        <div class="pt-service-status-bar">
          <span>Dienst Status:</span>
          <label><input type="radio" name="srvHttp" ${http.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceHttp(true)"> Ingeschakeld (On)</label>
          <label><input type="radio" name="srvHttp" ${!http.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceHttp(false)"> Uitgeschakeld (Off)</label>
          <span style="margin-left: auto; color: #64748b; font-size: 12px;">Poort: 80 &bull; Ondersteunt: HTML, CSS, JSON, TXT</span>
        </div>

        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <label style="font-weight: 600; font-size: 13px; color: #334155;">Actief Bestand:</label>
            <select id="httpFileSelect" class="pt-input" style="width: 220px;" onchange="window.PXLApp.selectHttpFile(this.value)">
              ${Object.keys(http.files).map(fn => `<option value="${fn}" ${fn === this.currentHttpFile ? 'selected' : ''}>${fn}</option>`).join('')}
            </select>
            <button class="pt-btn" style="background: #e2e8f0; color: #334155; font-size: 12px;" onclick="window.PXLApp.addNewHttpFile()">+ Nieuw Bestand</button>
            ${this.currentHttpFile !== 'index.html' ? `
              <button class="pt-btn-del" title="Verwijder bestand" onclick="window.PXLApp.deleteHttpFile('${this.currentHttpFile}')">🗑️</button>
            ` : ''}
          </div>
          <span style="font-size: 11.5px; color: #64748b; font-family: monospace;">URL: http://${dev.ip || 'server'}/${this.currentHttpFile}</span>
        </div>

        <div class="pt-form-group">
          <label style="display: flex; justify-content: space-between;">
            <span>Broncode van <code>${this.currentHttpFile}</code>:</span>
            <span style="font-size: 11px; color: #64748b;">Grootte: ${activeContent.length} tekens</span>
          </label>
          <textarea id="httpHtmlInput" class="pt-input" style="height: 220px; font-family: 'Consolas', monospace; font-size: 12px; line-height: 1.45;">${activeContent}</textarea>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.saveHttpContent()">💾 '${this.currentHttpFile}' Opslaan & Publiceren</button>
        </div>
      `;
    } else if (sub === 'dhcp') {
      const dhcp = dev.services.dhcp;
      const pool = (dhcp.pools && dhcp.pools.length > 0) ? dhcp.pools[0] : dhcp;

      return `
        <h3>📡 DHCP Server Service (Cisco Packet Tracer Style)</h3>
        <div class="pt-service-status-bar">
          <span>Dienst Status:</span>
          <label><input type="radio" name="srvDhcp" ${dhcp.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceDhcp(true)"> Ingeschakeld (On)</label>
          <label><input type="radio" name="srvDhcp" ${!dhcp.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceDhcp(false)"> Uitgeschakeld (Off)</label>
          <span style="margin-left: auto; color: #64748b; font-size: 12px;">Interface: <strong>FastEthernet0</strong></span>
        </div>

        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 12px; color: #0284c7; font-size: 13px;">DHCP Pool Eigenschappen:</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="font-size: 11.5px; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Pool Name:</label>
              <input type="text" id="dhcpPoolNameInput" class="pt-input" value="${pool.name || dhcp.poolName || 'serverPool'}" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Default Gateway:</label>
              <input type="text" id="dhcpGwInput" class="pt-input" value="${pool.gateway || dev.gateway || '172.16.1.1'}" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">DNS Server:</label>
              <input type="text" id="dhcpDnsInput" class="pt-input" value="${pool.dns || dev.ip || '172.16.1.10'}" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Start IP Address:</label>
              <input type="text" id="dhcpStartIpInput" class="pt-input" value="${pool.startIp || dhcp.startIp || '172.16.1.100'}" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Subnet Mask:</label>
              <input type="text" id="dhcpMaskInput" class="pt-input" value="${pool.mask || dhcp.mask || '255.255.255.0'}" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Maximum number of Users:</label>
              <input type="number" id="dhcpMaxUsersInput" class="pt-input" value="${pool.maxUsers || dhcp.maxUsers || 50}" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">TFTP Server:</label>
              <input type="text" id="dhcpTftpInput" class="pt-input" value="${dhcp.tftpServer || '0.0.0.0'}" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11.5px; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">WLC IP Address:</label>
              <input type="text" id="dhcpWlcInput" class="pt-input" value="${dhcp.wlcIp || '10.10.0.254'}" style="width: 100%;">
            </div>
          </div>
          <div style="margin-top: 14px; display: flex; gap: 10px;">
            <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.saveDhcpConfig()">💾 Opslaan / Toepassen Pool</button>
          </div>
        </div>

        <h4 style="margin: 16px 0 8px; color: #1e293b; font-size: 13px;">Actieve DHCP Leases (Verleende IP-adressen):</h4>
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 12px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                <th style="padding: 6px 10px;">Client Hostname</th>
                <th style="padding: 6px 10px;">Toegewezen IP</th>
                <th style="padding: 6px 10px;">MAC Adres</th>
                <th style="padding: 6px 10px;">Leasetijd / Tijdstip</th>
              </tr>
            </thead>
            <tbody>
              ${(!dhcp.leases || dhcp.leases.length === 0) ? `
                <tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8; font-style: italic;">Nog geen actieve DHCP leases geregistreerd. Verbind een client via DHCP om leases te zien.</td></tr>
              ` : dhcp.leases.map(l => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 10px; font-weight: 600; color: #0284c7;">💻 ${l.hostname || 'Client'}</td>
                  <td style="padding: 6px 10px; font-family: monospace; font-weight: 600;">${l.ip}</td>
                  <td style="padding: 6px 10px; font-family: monospace; color: #475569;">${l.mac}</td>
                  <td style="padding: 6px 10px; color: #64748b;">${l.timestamp || l.expires || 'Actief'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="pt-btn pt-btn-secondary" style="font-size: 11px;" onclick="window.PXLApp.renderServicesTab()">🔄 Verversen</button>
          <button class="pt-btn pt-btn-secondary" style="font-size: 11px; color: #ef4444; border-color: #fca5a5;" onclick="window.PXLApp.clearDhcpLeases()">🗑️ Wis Leases</button>
        </div>
      `;
    } else if (sub === 'dns') {
      const dns = dev.services.dns;
      if (!dns.forwarders) {
        dns.forwarders = { enabled: true, primary: '8.8.8.8', secondary: '1.1.1.1' };
      }

      return `
        <h3>🔎 DNS Server Service & Forwarders (Cisco Packet Tracer + Anycast / Live WAN)</h3>
        <div class="pt-service-status-bar">
          <span>Dienst Status:</span>
          <label><input type="radio" name="srvDns" ${dns.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceDns(true)"> Ingeschakeld (On)</label>
          <label><input type="radio" name="srvDns" ${!dns.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceDns(false)"> Uitgeschakeld (Off)</label>
        </div>

        <!-- Add Resource Record Form -->
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 10px; color: #0284c7; font-size: 13px;">Nieuw Resource Record Toevoegen:</h4>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <input type="text" id="dnsNameInput" class="pt-input" placeholder="Domeinnaam (bv. www.pxl.be of portal.pxl.local)" style="flex: 2; min-width: 180px;">
            <select id="dnsTypeInput" class="pt-input" style="flex: 1; min-width: 110px;" onchange="window.PXLApp.onDnsTypeChange(this.value)">
              <option value="A">A Record (Host)</option>
              <option value="CNAME">CNAME (Alias)</option>
            </select>
            <input type="text" id="dnsTargetInput" class="pt-input" placeholder="IP Adres (bv. 172.16.1.10)" style="flex: 2; min-width: 180px;">
            <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.addDnsRecord()">+ Toevoegen</button>
          </div>
        </div>

        <h4>Actieve DNS Records:</h4>
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                <th style="padding: 6px 10px;">Domeinnaam</th>
                <th style="padding: 6px 10px;">Type</th>
                <th style="padding: 6px 10px;">Doel (IP / Host Alias)</th>
                <th style="padding: 6px 10px; width: 60px;">Actie</th>
              </tr>
            </thead>
            <tbody>
              ${(dns.records || []).map((r, i) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 10px; font-weight: 600; color: #0284c7;">${r.name}</td>
                  <td style="padding: 6px 10px;"><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">${r.type}</span></td>
                  <td style="padding: 6px 10px; font-family: monospace;">${r.type === 'CNAME' ? (r.target || r.alias) : r.ip}</td>
                  <td style="padding: 6px 10px;"><button class="pt-btn-del" onclick="window.PXLApp.deleteDnsRecord(${i})">🗑️</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- DNS FORWARDERS CARD -->
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 14px; margin-top: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">🌐</span>
              <h4 style="margin: 0; color: #166534; font-size: 13px;">DNS Forwarders (Public Internet / Loopback Anycast)</h4>
            </div>
            <label style="font-size: 12px; font-weight: 600; color: #15803d; cursor: pointer;">
              <input type="checkbox" id="dnsForwarderCheck" ${dns.forwarders?.enabled !== false ? 'checked' : ''} style="margin-right: 4px;"> Forwarding Ingeschakeld
            </label>
          </div>
          <p style="font-size: 11.5px; color: #166534; margin: 0 0 10px; line-height: 1.45;">
            Wanneer een client een domeinnaam opvraagt die niet lokaal in de zone staat (bijv. <code>google.com</code>, <code>pxl.be</code>), stuurt de server de query door naar deze publieke upstream forwarders.
          </p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: #14532d; display: block; margin-bottom: 3px;">Primaire Forwarder (Google Anycast):</label>
              <input type="text" id="dnsFwdPrimary" class="pt-input" value="${dns.forwarders?.primary || '8.8.8.8'}" style="width: 100%; background: #ffffff;">
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: #14532d; display: block; margin-bottom: 3px;">Secundaire Forwarder (Cloudflare Anycast):</label>
              <input type="text" id="dnsFwdSecondary" class="pt-input" value="${dns.forwarders?.secondary || '1.1.1.1'}" style="width: 100%; background: #ffffff;">
            </div>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <span style="font-size: 11px; color: #15803d;">
              ${this.sim.isLiveInternet ? '🟢 <strong>Live WAN Proxy:</strong> Verbinding met fysieke internet gateway actief.' : '🟡 <strong>Simulatie:</strong> Beantwoordt via virtuele 8.8.8.8 / 1.1.1.1 Loopbacks op Cloud RFC 3849.'}
            </span>
            <button class="pt-btn pt-btn-primary" style="background: #16a34a; border-color: #15803d;" onclick="window.PXLApp.saveDnsForwarders()">💾 Forwarders Opslaan</button>
          </div>
        </div>
      `;
    } else if (sub === 'ldap') {
      const ldap = dev.services.ldap;
      const studentUser = this.currentUser?.username || 'student1';
      const studentFullName = this.currentUser?.full_name || 'PXL NetSim Student';

      return `
        <h3>👥 LDAP & Active Directory Domain Controller (DC01-PXL)</h3>
        <div class="pt-service-status-bar">
          <span>Dienst Status:</span>
          <label><input type="radio" name="srvLdap" ${ldap.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceLdap(true)"> Ingeschakeld (On)</label>
          <label><input type="radio" name="srvLdap" ${!ldap.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceLdap(false)"> Uitgeschakeld (Off)</label>
          <span style="margin-left: auto; color: #64748b; font-size: 12px;">Domein: <strong>${ldap.domain || 'pxl.local'}</strong> &bull; Host: <strong>${ldap.dcName || 'DC01-PXL'}</strong></span>
        </div>

        <!-- Current Active Student Card -->
        <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🎓</span>
              <div>
                <div style="font-weight: 700; color: #1e40af; font-size: 13.5px;">Actieve Student Inlogaccount: <code>${studentUser}</code></div>
                <div style="font-size: 11.5px; color: #3b82f6;">${studentFullName} &bull; Rol: Student</div>
              </div>
            </div>
            <span style="background: #10b981; color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">
              ⚡ WI-FI 802.1X GEKOPPELD
            </span>
          </div>
          <p style="font-size: 11.5px; color: #1e3a8a; margin: 4px 0 0; line-height: 1.45;">
            Deze LDAP / Active Directory service valideert Wi-Fi clients (WPA2-Enterprise) en 802.1X supplicants <strong>automatisch tegen het account van de actieve student</strong> (<code>${studentUser}</code>) én onderstaande geregistreerde domeingebruikers.
          </p>
        </div>

        <!-- RADIUS & Domain Configuration -->
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
          <h4 style="margin: 0 0 10px; color: #0284c7; font-size: 13px;">Active Directory & RADIUS Server Instellingen:</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: #334155; display: block; margin-bottom: 3px;">Domeinnaam (FQDN):</label>
              <input type="text" id="ldapDomainInput" class="pt-input" value="${ldap.domain || 'pxl.local'}" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: #334155; display: block; margin-bottom: 3px;">RADIUS Shared Secret:</label>
              <input type="text" id="ldapSecretInput" class="pt-input" value="${ldap.radiusSecret || 'PXL_Secret2026!'}" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: #334155; display: block; margin-bottom: 3px;">Auth Port (UDP):</label>
              <input type="number" id="ldapPortInput" class="pt-input" value="${ldap.radiusPort || 1812}" style="width: 100%;">
            </div>
          </div>
          <div style="margin-top: 10px;">
            <button class="pt-btn pt-btn-secondary" style="font-size: 11.5px;" onclick="window.PXLApp.saveLdapConfig()">💾 RADIUS & Domeinconfiguratie Opslaan</button>
          </div>
        </div>

        <!-- Add Domain User Form -->
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
          <h4 style="margin: 0 0 10px; color: #0284c7; font-size: 13px;">Nieuwe Domeingebruiker Toevoegen (Active Directory User):</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1.5fr 1fr auto; gap: 8px; align-items: end;">
            <div>
              <label style="font-size: 11px; font-weight: 600; color: #334155; display: block; margin-bottom: 3px;">Gebruikersnaam:</label>
              <input type="text" id="ldapNewUserInput" class="pt-input" placeholder="bv. janssens.j" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: #334155; display: block; margin-bottom: 3px;">Wachtwoord:</label>
              <input type="text" id="ldapNewPwInput" class="pt-input" placeholder="Wachtwoord" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: #334155; display: block; margin-bottom: 3px;">Volledige Naam:</label>
              <input type="text" id="ldapNewNameInput" class="pt-input" placeholder="Jan Janssens" style="width: 100%;">
            </div>
            <div>
              <label style="font-size: 11px; font-weight: 600; color: #334155; display: block; margin-bottom: 3px;">OU / Groep:</label>
              <select id="ldapNewGroupInput" class="pt-input" style="width: 100%;">
                <option value="Domain Users,WiFi-Students">Studenten (WiFi-Students)</option>
                <option value="Domain Admins,WiFi-Staff">Docenten (WiFi-Staff)</option>
                <option value="Domain Admins">Domein Administrators</option>
              </select>
            </div>
            <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.addLdapUser()">+ Toevoegen</button>
          </div>
        </div>

        <!-- Active Directory Users Table -->
        <h4>Actieve Domein Accounts in Active Directory (LDAP):</h4>
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                <th style="padding: 6px 10px;">Gebruikersnaam</th>
                <th style="padding: 6px 10px;">Volledige Naam</th>
                <th style="padding: 6px 10px;">Groep / Rol</th>
                <th style="padding: 6px 10px;">Wachtwoord</th>
                <th style="padding: 6px 10px; width: 60px;">Actie</th>
              </tr>
            </thead>
            <tbody>
              ${(ldap.users || []).map((u, i) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 10px; font-weight: 600; color: #0284c7;">👤 ${u.username}</td>
                  <td style="padding: 6px 10px;">${u.fullName || u.username}</td>
                  <td style="padding: 6px 10px;"><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${u.role || 'User'}</span> <code style="font-size: 10.5px; color: #64748b;">${u.group || ''}</code></td>
                  <td style="padding: 6px 10px; font-family: monospace; color: #64748b;">••••••••</td>
                  <td style="padding: 6px 10px;">
                    ${u.username !== 'Administrator' ? `<button class="pt-btn-del" onclick="window.PXLApp.deleteLdapUser(${i})">🗑️</button>` : '<span style="color:#94a3b8; font-size:11px;">Vast</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (sub === 'ftp') {
      const ftp = dev.services.ftp;
      return `
        <h3>📁 FTP Server Configuratie</h3>
        <div class="pt-service-status-bar">
          <span>Dienst Status:</span>
          <label><input type="radio" name="srvFtp" ${ftp.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceFtp(true)"> Ingeschakeld (On)</label>
          <label><input type="radio" name="srvFtp" ${!ftp.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceFtp(false)"> Uitgeschakeld (Off)</label>
        </div>
        <h4>Geregistreerde FTP Gebruikers:</h4>
        <div style="font-size: 12px; color: #475569; margin-bottom: 15px;">
          ${(ftp.users || []).map(u => `<div>👤 Gebruiker: <strong>${u.username}</strong> | Permissies: <code>${u.permissions}</code></div>`).join('')}
        </div>
        <h4>Beschikbare Bestanden op FTP Server:</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
              <th style="padding: 6px 10px;">Bestandsnaam</th>
              <th style="padding: 6px 10px;">Grootte</th>
            </tr>
          </thead>
          <tbody>
            ${(ftp.files || []).map(f => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px 10px; font-family: monospace;">${f.name}</td>
                <td style="padding: 6px 10px; color: #64748b;">${f.size}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    return '';
  }

  setServiceHttp(val) {
    if (this.activeDevice && this.activeDevice.services) {
      this.activeDevice.services.http.enabled = val;
      this.triggerScoreUpdate();
    }
  }

  selectHttpFile(fileName) {
    this.currentHttpFile = fileName;
    this.renderServicesTab();
  }

  addNewHttpFile() {
    const fn = prompt("Voer bestandsnaam in (bv. test.html, info.json, styles.css):", "nieuw_bestand.html");
    if (!fn) return;
    const cleanFn = fn.trim().replace(/[^a-zA-Z0-9._-]/g, '');
    if (!cleanFn) return;
    if (this.activeDevice && this.activeDevice.services && this.activeDevice.services.http) {
      if (!this.activeDevice.services.http.files) this.activeDevice.services.http.files = {};
      this.activeDevice.services.http.files[cleanFn] = `/* ${cleanFn} - Aangemaakt op ${new Date().toLocaleDateString()} */\n`;
      this.currentHttpFile = cleanFn;
      this.renderServicesTab();
      this.showToast(`✅ Bestand '${cleanFn}' aangemaakt.`);
    }
  }

  deleteHttpFile(fileName) {
    if (fileName === 'index.html') {
      alert("index.html kan niet worden verwijderd.");
      return;
    }
    if (confirm(`Weet je zeker dat je '${fileName}' wilt verwijderen?`)) {
      if (this.activeDevice?.services?.http?.files) {
        delete this.activeDevice.services.http.files[fileName];
        this.currentHttpFile = 'index.html';
        this.renderServicesTab();
        this.showToast(`🗑️ Bestand '${fileName}' verwijderd.`);
      }
    }
  }

  saveHttpContent() {
    const ta = document.getElementById('httpHtmlInput');
    const dev = this.activeDevice;
    if (dev && dev.services && dev.services.http && ta) {
      const fn = this.currentHttpFile || 'index.html';
      if (!dev.services.http.files) dev.services.http.files = {};
      dev.services.http.files[fn] = ta.value;
      if (fn === 'index.html') {
        dev.services.http.content = ta.value;
      }
      this.showToast(`✅ Bestand '${fn}' succesvol opgeslagen & gepubliceerd.`);
      this.triggerScoreUpdate();
    }
  }

  // --- DHCP SERVICE HELPERS ---
  setServiceDhcp(val) {
    if (this.activeDevice && this.activeDevice.services && this.activeDevice.services.dhcp) {
      this.activeDevice.services.dhcp.enabled = val;
      this.triggerScoreUpdate();
    }
  }

  saveDhcpConfig() {
    const dev = this.activeDevice;
    if (!dev || !dev.services || !dev.services.dhcp) return;

    const poolName = document.getElementById('dhcpPoolNameInput')?.value.trim() || 'serverPool';
    const gateway = document.getElementById('dhcpGwInput')?.value.trim() || dev.gateway || '172.16.1.1';
    const dns = document.getElementById('dhcpDnsInput')?.value.trim() || dev.ip || '172.16.1.10';
    const startIp = document.getElementById('dhcpStartIpInput')?.value.trim() || '172.16.1.100';
    const mask = document.getElementById('dhcpMaskInput')?.value.trim() || '255.255.255.0';
    const maxUsers = parseInt(document.getElementById('dhcpMaxUsersInput')?.value.trim(), 10) || 50;
    const tftpServer = document.getElementById('dhcpTftpInput')?.value.trim() || '0.0.0.0';
    const wlcIp = document.getElementById('dhcpWlcInput')?.value.trim() || '10.10.0.254';

    dev.services.dhcp.poolName = poolName;
    dev.services.dhcp.gateway = gateway;
    dev.services.dhcp.dns = dns;
    dev.services.dhcp.startIp = startIp;
    dev.services.dhcp.mask = mask;
    dev.services.dhcp.maxUsers = maxUsers;
    dev.services.dhcp.tftpServer = tftpServer;
    dev.services.dhcp.wlcIp = wlcIp;

    if (!dev.services.dhcp.pools) dev.services.dhcp.pools = [];
    const existingIdx = dev.services.dhcp.pools.findIndex(p => p.name === poolName);
    const poolObj = { name: poolName, gateway, dns, startIp, mask, maxUsers };
    if (existingIdx !== -1) {
      dev.services.dhcp.pools[existingIdx] = poolObj;
    } else {
      dev.services.dhcp.pools.push(poolObj);
    }

    this.renderServicesTab();
    this.showToast(`✅ DHCP Pool '${poolName}' succesvol opgeslagen.`);
    this.triggerScoreUpdate();
  }

  clearDhcpLeases() {
    const dev = this.activeDevice;
    if (dev?.services?.dhcp) {
      dev.services.dhcp.leases = [];
      this.renderServicesTab();
      this.showToast('🗑️ DHCP leases gewist.');
    }
  }

  // --- DNS SERVICE HELPERS ---
  setServiceDns(val) {
    if (this.activeDevice && this.activeDevice.services) {
      this.activeDevice.services.dns.enabled = val;
      this.triggerScoreUpdate();
    }
  }

  onDnsTypeChange(val) {
    const targetInput = document.getElementById('dnsTargetInput');
    if (targetInput) {
      if (val === 'CNAME') {
        targetInput.placeholder = 'Doelhost / Alias FQDN (bv. www.pxl.be)';
      } else {
        targetInput.placeholder = 'IP Adres (bv. 172.16.1.10)';
      }
    }
  }

  addDnsRecord() {
    const nameInput = document.getElementById('dnsNameInput');
    const typeInput = document.getElementById('dnsTypeInput');
    const targetInput = document.getElementById('dnsTargetInput');
    if (!nameInput || !typeInput || !targetInput || !this.activeDevice) return;

    const name = nameInput.value.trim();
    const type = typeInput.value.trim();
    const val = targetInput.value.trim();

    if (!name || !val) {
      this.showToast('⚠️ Voer domeinnaam en doel in');
      return;
    }
    if (type === 'A' && !IPUtils.isValidIp(val)) {
      this.showToast('⚠️ Voer een geldig IPv4-adres in voor A record');
      return;
    }

    if (!this.activeDevice.services.dns.records) this.activeDevice.services.dns.records = [];
    if (type === 'CNAME') {
      this.activeDevice.services.dns.records.push({ name, type: 'CNAME', target: val });
    } else {
      this.activeDevice.services.dns.records.push({ name, type: 'A', ip: val });
    }

    this.renderServicesTab();
    this.showToast(`✅ DNS Record '${name} [${type}] -> ${val}' toegevoegd`);
    this.triggerScoreUpdate();
  }

  deleteDnsRecord(idx) {
    if (this.activeDevice && this.activeDevice.services) {
      this.activeDevice.services.dns.records.splice(idx, 1);
      this.renderServicesTab();
      this.triggerScoreUpdate();
    }
  }

  saveDnsForwarders() {
    const dev = this.activeDevice;
    if (!dev?.services?.dns) return;

    const chk = document.getElementById('dnsForwarderCheck');
    const pInput = document.getElementById('dnsFwdPrimary');
    const sInput = document.getElementById('dnsFwdSecondary');

    if (!dev.services.dns.forwarders) {
      dev.services.dns.forwarders = {};
    }
    dev.services.dns.forwarders.enabled = chk ? chk.checked : true;
    dev.services.dns.forwarders.primary = pInput ? pInput.value.trim() : '8.8.8.8';
    dev.services.dns.forwarders.secondary = sInput ? sInput.value.trim() : '1.1.1.1';

    this.showToast(`✅ DNS Forwarders opgeslagen (${dev.services.dns.forwarders.primary}, ${dev.services.dns.forwarders.secondary})`);
    this.triggerScoreUpdate();
  }

  // --- LDAP / ACTIVE DIRECTORY SERVICE HELPERS ---
  setServiceLdap(val) {
    if (this.activeDevice?.services?.ldap) {
      this.activeDevice.services.ldap.enabled = val;
      this.triggerScoreUpdate();
    }
  }

  saveLdapConfig() {
    const dev = this.activeDevice;
    if (!dev?.services?.ldap) return;

    const dInput = document.getElementById('ldapDomainInput');
    const sInput = document.getElementById('ldapSecretInput');
    const pInput = document.getElementById('ldapPortInput');

    if (dInput) dev.services.ldap.domain = dInput.value.trim();
    if (sInput) dev.services.ldap.radiusSecret = sInput.value.trim();
    if (pInput) dev.services.ldap.radiusPort = parseInt(pInput.value.trim(), 10) || 1812;

    this.showToast('✅ Active Directory & RADIUS instellingen opgeslagen.');
    this.triggerScoreUpdate();
  }

  addLdapUser() {
    const dev = this.activeDevice;
    if (!dev?.services?.ldap) return;

    const uInput = document.getElementById('ldapNewUserInput');
    const pInput = document.getElementById('ldapNewPwInput');
    const nInput = document.getElementById('ldapNewNameInput');
    const gInput = document.getElementById('ldapNewGroupInput');

    const username = uInput ? uInput.value.trim() : '';
    const password = pInput ? pInput.value.trim() : '';
    const fullName = nInput ? nInput.value.trim() : username;
    const group = gInput ? gInput.value : 'Domain Users,WiFi-Students';

    if (!username || !password) {
      this.showToast('⚠️ Gebruikersnaam en wachtwoord zijn verplicht');
      return;
    }

    if (!dev.services.ldap.users) dev.services.ldap.users = [];
    dev.services.ldap.users.push({
      username,
      password,
      fullName: fullName || username,
      group,
      role: group.includes('Admins') ? 'Teacher' : 'Student'
    });

    this.renderServicesTab();
    this.showToast(`✅ Domeingebruiker '${username}' toegevoegd aan Active Directory.`);
    this.triggerScoreUpdate();
  }

  deleteLdapUser(idx) {
    const dev = this.activeDevice;
    if (dev?.services?.ldap?.users) {
      const removed = dev.services.ldap.users.splice(idx, 1);
      this.renderServicesTab();
      this.showToast(`🗑️ Domeingebruiker '${removed[0]?.username}' verwijderd.`);
      this.triggerScoreUpdate();
    }
  }

  setServiceFtp(val) {
    if (this.activeDevice && this.activeDevice.services) {
      this.activeDevice.services.ftp.enabled = val;
      this.triggerScoreUpdate();
    }
  }

  // --- OPDRACHT & RUBRIC DROPDOWN ---
  // --- UNIFIED OPDRACHT & RUBRIC SIDE PANEL (RECHTS MET VASTZETTEN) ---
  initPinnedPanel() {
    if (this.isOpdrachtPinned) {
      const panel = document.getElementById('opdrachtDropdownPanel');
      const pinCb = document.getElementById('pinOpdrachtPanel');
      if (pinCb) pinCb.checked = true;
      if (panel) {
        panel.classList.add('pinned');
        panel.classList.add('open');
        panel.style.display = 'flex';
        this.renderOpdrachtDropdown();
      }
      this.adjustWorkspaceForPinnedPanel();
    }
  }

  togglePinOpdrachtPanel(isPinned) {
    this.isOpdrachtPinned = !!isPinned;
    localStorage.setItem('pxl_opdracht_pinned', this.isOpdrachtPinned ? 'true' : 'false');
    const panel = document.getElementById('opdrachtDropdownPanel');
    const pinCb = document.getElementById('pinOpdrachtPanel');
    if (pinCb) pinCb.checked = this.isOpdrachtPinned;

    if (panel) {
      if (this.isOpdrachtPinned) {
        panel.classList.add('pinned');
        panel.classList.add('open');
        panel.style.display = 'flex';
        this.renderOpdrachtDropdown();
      } else {
        panel.classList.remove('pinned');
      }
    }
    this.adjustWorkspaceForPinnedPanel();
  }

  adjustWorkspaceForPinnedPanel() {
    const ws = document.querySelector('.pt-workspace');
    if (ws) {
      ws.style.transition = 'margin-right 0.25s ease';
      ws.style.marginRight = this.isOpdrachtPinned ? '480px' : '0px';
      if (this.canvasWorkspace) {
        setTimeout(() => {
          this.canvasWorkspace.handleResize();
          this.canvasWorkspace.render();
        }, 260);
      }
    }
  }

  toggleOpdrachtDropdown() {
    const el = document.getElementById('opdrachtDropdownPanel');
    if (!el) return;
    if (this.isOpdrachtPinned) {
      this.togglePinOpdrachtPanel(false);
      el.style.display = 'none';
      el.classList.remove('open');
      const rubricSide = document.getElementById('rubricSidePanel');
      if (rubricSide) rubricSide.classList.remove('open');
      return;
    }
    const isHidden = (el.style.display === 'none' || !el.style.display || !el.classList.contains('open'));
    if (isHidden) {
      this.renderOpdrachtDropdown();
      el.style.display = 'flex';
      el.classList.add('open');
      const rubricSide = document.getElementById('rubricSidePanel');
      if (rubricSide) rubricSide.classList.add('open');
    } else {
      el.style.display = 'none';
      el.classList.remove('open');
      const rubricSide = document.getElementById('rubricSidePanel');
      if (rubricSide) rubricSide.classList.remove('open');
    }
  }

  closeOpdrachtDropdown() {
    const el = document.getElementById('opdrachtDropdownPanel');
    if (this.isOpdrachtPinned) {
      this.togglePinOpdrachtPanel(false);
    }
    if (el) {
      el.style.display = 'none';
      el.classList.remove('open');
      el.classList.remove('pinned');
    }
    const rubricSide = document.getElementById('rubricSidePanel');
    if (rubricSide) rubricSide.classList.remove('open');
    this.adjustWorkspaceForPinnedPanel();
  }

  buildDynamicAddressingTable(exam) {
    if (!exam) return '';
    const topo = exam.initialTopology || exam.topology || {};
    const devs = topo.devices || [];
    const rubric = exam.rubric || [];
    const rows = [];
    const seen = new Set();

    const gwMap = {};
    devs.forEach(d => {
      const gw = d.gateway || d.defaultGateway;
      if (gw) gwMap[d.id] = gw;
    });
    rubric.forEach(r => {
      if (r.checkType === 'default_gateway' && r.condition && r.condition.expected) {
        const did = r.condition.deviceId || r.condition.targetDevice;
        if (did) gwMap[did] = r.condition.expected;
      }
    });

    devs.forEach(d => {
      const did = d.id || d.name;
      const gw = gwMap[did] || '-';
      if (['pc', 'laptop', 'server'].includes(d.type)) {
        let ip = d.ip;
        let mask = d.mask || '255.255.255.0';
        if (!ip) {
          const r = rubric.find(rb => rb.condition && rb.condition.deviceId === did && rb.condition.expectedIp);
          if (r) {
            ip = r.condition.expectedIp;
            mask = r.condition.expectedMask || '255.255.255.0';
          }
        }
        if (ip) {
          const key = `${did}_FastEthernet0`;
          if (!seen.has(key)) {
            seen.add(key);
            rows.push(`<tr><td style="padding:6px 10px; font-weight:700;">${did}</td><td style="padding:6px 10px;">FastEthernet0</td><td style="padding:6px 10px; font-family:monospace;">${ip}</td><td style="padding:6px 10px; font-family:monospace;">${mask}</td><td style="padding:6px 10px; font-family:monospace;">${gw}</td></tr>`);
          }
        }
      }
      if (d.interfaces) {
        Object.entries(d.interfaces).forEach(([pname, pcfg]) => {
          if (pcfg && pcfg.ip && pcfg.ip !== '0.0.0.0') {
            const key = `${did}_${pname}`;
            if (!seen.has(key)) {
              seen.add(key);
              rows.push(`<tr><td style="padding:6px 10px; font-weight:700;">${did}</td><td style="padding:6px 10px;">${pname}</td><td style="padding:6px 10px; font-family:monospace;">${pcfg.ip}</td><td style="padding:6px 10px; font-family:monospace;">${pcfg.mask || '255.255.255.0'}</td><td style="padding:6px 10px; font-family:monospace;">${gw}</td></tr>`);
            }
          }
        });
      }
    });

    rubric.forEach(r => {
      const cond = r.condition || {};
      if (r.checkType === 'switch_svi' && cond.expectedIp) {
        const did = cond.switchId || 'Switch';
        const key = `${did}_Vlan1`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push(`<tr><td style="padding:6px 10px; font-weight:700;">${did}</td><td style="padding:6px 10px;">Vlan1 (SVI)</td><td style="padding:6px 10px; font-family:monospace;">${cond.expectedIp}</td><td style="padding:6px 10px; font-family:monospace;">${cond.expectedMask || '255.255.255.0'}</td><td style="padding:6px 10px; font-family:monospace;">${gwMap[did] || '-'}</td></tr>`);
        }
      } else if (r.checkType === 'interface_ip' && cond.expectedIp) {
        const did = cond.deviceId || 'Router';
        const port = cond.portName || 'FastEthernet0';
        const key = `${did}_${port}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push(`<tr><td style="padding:6px 10px; font-weight:700;">${did}</td><td style="padding:6px 10px;">${port}</td><td style="padding:6px 10px; font-family:monospace;">${cond.expectedIp}</td><td style="padding:6px 10px; font-family:monospace;">${cond.expectedMask || '255.255.255.0'}</td><td style="padding:6px 10px; font-family:monospace;">${gwMap[did] || '-'}</td></tr>`);
        }
      }
    });

    if (rows.length === 0) return '';
    return `
      <div style="margin: 16px 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
        <div style="background: #0284c7; color: #ffffff; padding: 7px 12px; font-weight: 700; font-size: 12.5px; display: flex; align-items: center; gap: 6px;">
          <span>📊</span> Adresseringstabel &amp; Interfaces
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
              <th style="padding: 6px 10px;">Apparaat</th>
              <th style="padding: 6px 10px;">Interface</th>
              <th style="padding: 6px 10px;">IP-adres</th>
              <th style="padding: 6px 10px;">Subnetmasker</th>
              <th style="padding: 6px 10px;">Standaardgateway</th>
            </tr>
          </thead>
          <tbody>
            ${rows.join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  formatMarkdownInstructions(md) {
    if (!md) return '';
    if (md.includes('<table') || md.includes('<html')) {
      return md;
    }

    const lines = md.split('\n');
    let html = '';
    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];

    const flushTable = () => {
      if (!inTable) return;
      html += '<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden;">';
      if (tableHeaders.length > 0) {
        html += '<thead style="background: #0284c7; color: #ffffff;"><tr>';
        for (const h of tableHeaders) {
          html += `<th style="border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; font-weight: 700;">${h}</th>`;
        }
        html += '</tr></thead>';
      }
      html += '<tbody>';
      for (const row of tableRows) {
        html += '<tr style="border-bottom: 1px solid #e2e8f0;">';
        for (const cell of row) {
          html += `<td style="border: 1px solid #cbd5e1; padding: 6px 10px; color: #1e293b;">${cell}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    };

    const formatInline = (t) => {
      return t
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #0284c7; text-decoration: underline; font-weight: 600;">$1</a>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code style="background: #e2e8f0; color: #0f172a; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 11px;">$1</code>');
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.slice(1, -1).split('|').map(c => formatInline(c.trim()));
        if (cells.every(c => /^:?-+:?$/.test(c))) {
          continue;
        }
        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        flushTable();
      }

      if (!line) {
        html += '<div style="height: 6px;"></div>';
        continue;
      }

      if (line.startsWith('#### ')) {
        html += `<h4 style="margin: 14px 0 6px; color: #0284c7; font-size: 13.5px; font-weight: 700;">${formatInline(line.slice(5))}</h4>`;
      } else if (line.startsWith('### ')) {
        html += `<h3 style="margin: 16px 0 8px; color: #0f172a; font-size: 15px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">${formatInline(line.slice(4))}</h3>`;
      } else if (line.startsWith('## ')) {
        html += `<h2 style="margin: 18px 0 10px; color: #0369a1; font-size: 16.5px; font-weight: 800;">${formatInline(line.slice(3))}</h2>`;
      } else if (line.startsWith('# ')) {
        html += `<h1 style="margin: 20px 0 12px; color: #0f172a; font-size: 18px; font-weight: 800;">${formatInline(line.slice(2))}</h1>`;
      } else if (line.startsWith('* ') || line.startsWith('- ')) {
        html += `<div style="margin-left: 18px; margin-bottom: 4px; line-height: 1.5;">• ${formatInline(line.slice(2))}</div>`;
      } else if (/^\d+\.\s+/.test(line)) {
        const num = line.match(/^(\d+)\.\s+/)[1];
        const rest = line.replace(/^\d+\.\s+/, '');
        html += `<div style="margin-left: 12px; margin-bottom: 6px; line-height: 1.5; display: flex; gap: 6px;"><strong style="color: #0284c7;">${num}.</strong> <div>${formatInline(rest)}</div></div>`;
      } else {
        html += `<p style="margin: 4px 0; line-height: 1.5;">${formatInline(line)}</p>`;
      }
    }
    if (inTable) flushTable();
    return html;
  }

  renderOpdrachtDropdown() {
    const exam = this.activeExam;
    const titleEl = document.getElementById('opdrachtDropdownTitle');
    const bodyEl = document.getElementById('opdrachtDropdownBody');
    const pinCb = document.getElementById('pinOpdrachtPanel');
    if (pinCb) pinCb.checked = !!this.isOpdrachtPinned;
    if (!exam || !bodyEl) return;

    if (titleEl) titleEl.innerText = exam.title;

    const evalRes = this.gradingEngine ? this.gradingEngine.evaluate() : { earnedPoints: 0, totalPoints: 100, percentage: 0, objectives: [] };
    const objectives = evalRes.objectives || [];
    const rawInstr = exam.instructions || '';
    let formattedInstructions = this.formatMarkdownInstructions(rawInstr);

    // Fallback: If instructions do not contain an addressing table, dynamically build and append one!
    if (!rawInstr.includes('Adresseringstabel') && !rawInstr.includes('| Interface |')) {
      const dynamicTable = this.buildDynamicAddressingTable(exam);
      if (dynamicTable) {
        formattedInstructions += dynamicTable;
      }
    }

    bodyEl.innerHTML = `
      <!-- DEEL 1: DE OPDRACHT -->
      <div class="pt-opdracht-assignment-card" style="background: #f8fafc; border-left: 4px solid #0284c7; padding: 14px 16px; margin-bottom: 18px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <h4 style="margin: 0; color: #0f172a; font-size: 14.5px; font-weight: 700;">📝 Opdracht &amp; Netwerkschema: ${exam.title}</h4>
          <span style="font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 2px 7px; border-radius: 4px; font-weight: 700;">Hogeschool PXL</span>
        </div>
        <div style="font-size: 12.5px; color: #334155; line-height: 1.6;">
          ${formattedInstructions}
        </div>
      </div>

      <!-- DEEL 2: DE RUBRIC MET DE SCORES (DIRECT DAARONDER) -->
      <div id="rubricSidePanel" class="pt-rubric-section-unified open" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px;">
        <div id="rubricSidePanelContent">
          <div class="pt-rubric-panel-header" style="border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #0284c7; display: flex; align-items: center; gap: 6px;">
                <span>🎯</span> Beoordelingsrubric &amp; Criteria
              </h4>
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                Live evaluatie van criteria en vereisten
              </div>
            </div>
            <div style="text-align: right;">
              <div class="pt-rubric-summary-score" style="font-size: 14px; font-weight: 800; color: ${evalRes.percentage >= 80 ? '#16a34a' : (evalRes.percentage >= 50 ? '#d97706' : '#dc2626')};">
                ${evalRes.earnedPoints} / ${evalRes.totalPoints} pt (${evalRes.percentage}%)
              </div>
            </div>
          </div>

          <!-- Score Progress Bar -->
          <div style="background: #f1f5f9; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 14px; border: 1px solid #e2e8f0;">
            <div class="pt-rubric-live-bar" style="height: 100%; width: ${evalRes.percentage}%; background: ${evalRes.percentage >= 80 ? '#22c55e' : (evalRes.percentage >= 50 ? '#f59e0b' : '#ef4444')}; transition: width 0.3s ease;"></div>
          </div>

          <!-- Criteria List -->
          <div class="pt-rubric-panel-list" style="display: flex; flex-direction: column; gap: 8px;">
            ${objectives.map(obj => `
              <div class="pt-rubric-panel-item ${obj.passed ? 'passed' : 'failed'}" style="border: 1px solid ${obj.passed ? '#bbf7d0' : '#e2e8f0'}; background: ${obj.passed ? '#f0fdf4' : '#fafafa'}; border-radius: 6px; padding: 10px 12px; transition: all 0.2s;">
                <div class="pt-panel-item-top" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="pt-panel-item-status" style="font-size: 14px;">${obj.passed ? '✅' : '⏳'}</span>
                    <strong class="pt-panel-item-title" style="font-size: 12.5px; color: #0f172a;">${obj.title}</strong>
                  </div>
                  <span class="pt-panel-item-pts" style="font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: ${obj.passed ? '#dcfce7; color: #15803d;' : '#f1f5f9; color: #64748b;'}">
                    ${obj.passed ? obj.points : 0} / ${obj.points} pt
                  </span>
                </div>
                ${obj.desc ? `<div class="pt-panel-item-desc" style="font-size: 11.5px; color: #475569; margin-top: 4px; line-height: 1.4;">${obj.desc}</div>` : ''}
                ${obj.detail ? `<div class="pt-panel-item-detail" style="font-size: 11px; color: ${obj.passed ? '#15803d' : '#94a3b8'}; margin-top: 3px; font-family: monospace;">${obj.detail}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  updateRubricSectionOnly(evalRes) {
    const content = document.getElementById('rubricSidePanelContent');
    if (!content) return;
    const objectives = evalRes.objectives || [];

    const summaryScore = content.querySelector('.pt-rubric-summary-score');
    if (summaryScore) {
      summaryScore.innerText = `${evalRes.earnedPoints} / ${evalRes.totalPoints} pt (${evalRes.percentage}%)`;
      summaryScore.style.color = evalRes.percentage >= 80 ? '#16a34a' : (evalRes.percentage >= 50 ? '#d97706' : '#dc2626');
    }

    const liveBar = content.querySelector('.pt-rubric-live-bar');
    if (liveBar) {
      liveBar.style.width = `${evalRes.percentage}%`;
      liveBar.style.background = evalRes.percentage >= 80 ? '#22c55e' : (evalRes.percentage >= 50 ? '#f59e0b' : '#ef4444');
    }

    const list = content.querySelector('.pt-rubric-panel-list');
    if (list) {
      list.innerHTML = objectives.map(obj => `
        <div class="pt-rubric-panel-item ${obj.passed ? 'passed' : 'failed'}" style="border: 1px solid ${obj.passed ? '#bbf7d0' : '#e2e8f0'}; background: ${obj.passed ? '#f0fdf4' : '#fafafa'}; border-radius: 6px; padding: 10px 12px; transition: all 0.2s;">
          <div class="pt-panel-item-top" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="pt-panel-item-status" style="font-size: 14px;">${obj.passed ? '✅' : '⏳'}</span>
              <strong class="pt-panel-item-title" style="font-size: 12.5px; color: #0f172a;">${obj.title}</strong>
            </div>
            <span class="pt-panel-item-pts" style="font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; background: ${obj.passed ? '#dcfce7; color: #15803d;' : '#f1f5f9; color: #64748b;'}">
              ${obj.passed ? obj.points : 0} / ${obj.points} pt
            </span>
          </div>
          ${obj.desc ? `<div class="pt-panel-item-desc" style="font-size: 11.5px; color: #475569; margin-top: 4px; line-height: 1.4;">${obj.desc}</div>` : ''}
          ${obj.detail ? `<div class="pt-panel-item-detail" style="font-size: 11px; color: ${obj.passed ? '#15803d' : '#94a3b8'}; margin-top: 3px; font-family: monospace;">${obj.detail}</div>` : ''}
        </div>
      `).join('');
    }
  }

  // --- AUTHENTICATION & AUTOSAVE ---
  async checkAuthStatus() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated) {
        this.currentUser = data.user;
      } else {
        this.currentUser = null;
      }
      this.updateAuthUi();
      if (this.currentUser && this.currentUser.role === 'student') {
        this.loadSavedTopology();
      }
    } catch (err) {
      console.log('Auth check error (offline mode):', err);
    }
  }

  updateAuthUi() {
    const container = document.getElementById('userAuthContainer');
    const teacherStudioBtn = document.getElementById('btnToggleStudio');
    const studentStudioBtn = document.getElementById('btnToggleStudentStudio');

    if (this.currentUser) {
      const isTeacher = (this.currentUser.role === 'teacher' || this.currentUser.role === 'admin');

      // Only show Teacher Studio if teacher, and Student Studio if student
      if (teacherStudioBtn) teacherStudioBtn.style.display = isTeacher ? 'inline-flex' : 'none';
      if (studentStudioBtn) studentStudioBtn.style.display = !isTeacher ? 'inline-flex' : 'none';

      if (container) {
        container.innerHTML = `
          <span class="pt-auth-badge ${isTeacher ? 'teacher' : ''}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 4px 8px; border-radius: 4px; background: ${isTeacher ? '#fef3c7; color: #92400e; border: 1px solid #fde68a;' : '#e0f2fe; color: #0369a1; border: 1px solid #bae6fd;'} white-space: nowrap;">
            ${isTeacher ? '🎓 Docent' : '👨‍🎓 Student'}: ${this.currentUser.full_name || this.currentUser.username}
          </span>
          ${!isTeacher ? `
            <span class="pt-autosave-indicator" id="autoSaveLabel" style="font-size: 10px; color: #16a34a; white-space: nowrap;">💾 Auto-save</span>
          ` : ''}
          <button class="pt-btn pt-btn-secondary" id="btnLogoutBtn" style="padding: 4px 9px; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;" onclick="window.PXLApp.logout()" title="Sessie beëindigen en uitloggen">
            Uitloggen
          </button>
        `;
      }
    } else {
      if (teacherStudioBtn) teacherStudioBtn.style.display = 'none';
      if (studentStudioBtn) studentStudioBtn.style.display = 'none';

      if (container) {
        container.innerHTML = `
          <button class="pt-btn pt-btn-secondary" id="btnLoginModal" onclick="window.PXLApp.openLoginModal()" style="padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;">
            🔑 Inloggen
          </button>
        `;
      }
    }

    // Refresh exam selector dropdown
    this.populateExamSelector();
  }

  openLoginModal(defaultRole = 'student') {
    const modal = document.getElementById('loginModal');
    if (!modal) return;
    this.switchLoginTab(defaultRole);
    modal.style.display = 'flex';
    const userInput = document.getElementById('loginUsername');
    if (userInput) userInput.focus();
  }

  closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
    const err = document.getElementById('loginErrorMsg');
    if (err) err.style.display = 'none';
  }

  switchLoginTab(role) {
    const sBtn = document.getElementById('tabBtnLoginStudent');
    const tBtn = document.getElementById('tabBtnLoginTeacher');
    const uLabel = document.getElementById('loginUserLabel');
    const uInput = document.getElementById('loginUsername');

    if (role === 'teacher') {
      if (tBtn) tBtn.classList.add('active');
      if (sBtn) sBtn.classList.remove('active');
      if (uLabel) uLabel.innerText = 'Docenten Gebruikersnaam:';
      if (uInput) uInput.placeholder = 'teacher of david';
    } else {
      if (sBtn) sBtn.classList.add('active');
      if (tBtn) tBtn.classList.remove('active');
      if (uLabel) uLabel.innerText = 'Studentennummer / Gebruikersnaam:';
      if (uInput) uInput.placeholder = 'bv. student1 of 12600786';
    }
  }

  async handleLoginSubmit() {
    const uInput = document.getElementById('loginUsername');
    const pInput = document.getElementById('loginPassword');
    const errBox = document.getElementById('loginErrorMsg');

    const username = uInput ? uInput.value.trim() : '';
    const password = pInput ? pInput.value : '';

    if (!username || !password) return;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        this.currentUser = data.user;
        this.closeLoginModal();
        this.updateAuthUi();
        this.showToast(`👋 Welkom ${data.user.full_name}!`);
        if (pInput) pInput.value = '';
        if (this.currentUser.role === 'student') {
          this.checkAssignedExamAndLoad();
        }
      } else {
        if (errBox) {
          errBox.innerText = data.error || 'Inloggen mislukt';
          errBox.style.display = 'block';
        }
      }
    } catch (err) {
      if (errBox) {
        errBox.innerText = 'Netwerkfout bij inloggen: ' + err.message;
        errBox.style.display = 'block';
      }
    }
  }

  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    this.currentUser = null;
    this.updateAuthUi();
    this.showToast('Succesvol uitgelogd');
  }

  async checkAssignedExamAndLoad() {
    if (!this.currentUser || this.currentUser.role !== 'student') return;
    try {
      const res = await fetch('/api/student/assigned-exam');
      const data = await res.json();
      if (data.assigned && data.assignment) {
        const asg = data.assignment;
        if (asg.time_limit_minutes) {
          this.timerSeconds = asg.time_limit_minutes * 60;
          this.startExamTimer();
        }
        if (asg.exam_id && (!this.activeExam || this.activeExam.id !== asg.exam_id)) {
          // Switch to assigned exam if available in presets/labs
          const lab = window.PXL_COURSE_LABS ? window.PXL_COURSE_LABS.find(l => l.id === asg.exam_id || l.code === asg.exam_id) : null;
          if (lab) {
            this.loadCourseLab(lab.id);
          } else if (this.presetExams && this.presetExams[asg.exam_id]) {
            this.loadExam(this.presetExams[asg.exam_id]);
          } else {
            // Load custom or PKA exam directly from SQLite database
            try {
              const exRes = await fetch(`/api/exam/${encodeURIComponent(asg.exam_id)}`);
              const exData = await exRes.json();
              if (exData.status === 'success' && exData.exam) {
                this.loadExam(exData.exam);
              }
            } catch (err) {
              console.warn('Could not load custom exam from DB:', err);
            }
          }
        }
        this.showToast(`📋 Toegewezen examen: ${asg.title || asg.exam_id} (${asg.time_limit_minutes} min)`);
      }
    } catch (e) {
      console.warn('Could not check assigned exam:', e);
    }
    await this.loadSavedTopology();
  }

  initAutoSaveTimer() {
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    // Autosave every 10 seconds with running config testing
    this.autoSaveInterval = setInterval(() => {
      this.saveActiveTopology();
    }, 10000);
  }

  async saveActiveTopology() {
    if (!this.currentUser) return;
    const examId = this.activeExam ? this.activeExam.id : '01_pxl_standard';
    const evalResult = this.gradingEngine ? this.gradingEngine.evaluate() : { earnedPoints: 0, totalPoints: 100, percentage: 0 };
    const score = evalResult.earnedPoints || 0;
    const maxScore = evalResult.totalPoints || 100;
    const percentage = evalResult.percentage || 0;
    const topology = this.sim.exportTopology();

    // Snapshot running configs of all active devices
    const runningConfigs = {};
    if (this.sim && this.sim.devices) {
      for (const [dId, dev] of Object.entries(this.sim.devices)) {
        if (dev.getRunningConfig) {
          runningConfigs[dId] = dev.getRunningConfig();
        } else if (dev.runningConfig) {
          runningConfigs[dId] = dev.runningConfig;
        }
      }
    }

    try {
      const res = await fetch('/api/student/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_id: examId,
          topology: topology,
          running_config: runningConfigs,
          rubric_evaluation: evalResult.objectives || [],
          score: score,
          max_score: maxScore,
          percentage: percentage
        })
      });
      const data = await res.json();
      if (data.success) {
        const lbl = document.getElementById('autoSaveLabel');
        if (lbl) {
          lbl.innerText = `💾 10s Auto-save: ${data.saved_at}`;
          lbl.style.color = '#10b981';
        }
      }
    } catch (err) {
      console.warn('Auto-save failed:', err);
    }
  }

  async loadSavedTopology() {
    if (!this.currentUser) return;
    const examId = this.activeExam ? this.activeExam.id : '01_pxl_standard';
    try {
      const res = await fetch(`/api/student/load?exam_id=${examId}`);
      const data = await res.json();
      if (data.found && data.progress && data.progress.topology) {
        if (confirm(`Welkom terug ${this.currentUser.full_name}! Er is een eerdere sessie opgeslagen om ${data.progress.updated_at}. Wil je verdergaan waar je gebleven was?`)) {
          this.sim.importTopology(data.progress.topology);
          this.canvasWorkspace.render();
          this.triggerScoreUpdate();
          this.showToast(`✅ Eerdere sessie geladen (${data.progress.score}/${data.progress.max_score} pt)`);
        }
      }
    } catch (err) {
      console.warn('Could not load saved topology:', err);
    }
  }

  // --- STUDENT STUDIO & PASSWORD MANAGEMENT ---
  openStudentStudioModal() {
    const modal = document.getElementById('studentStudioModal');
    if (!modal) return;
    if (!this.currentUser) {
      this.openLoginModal('student');
      return;
    }

    // Populate user info card
    const uSpan = document.getElementById('studentInfoUsername');
    const nSpan = document.getElementById('studentInfoFullName');
    const cSpan = document.getElementById('studentInfoClass');
    const pSpan = document.getElementById('studentInfoProgram');
    const ySpan = document.getElementById('studentInfoYear');
    const bSpan = document.getElementById('studentStudioUserBadge');

    if (uSpan) uSpan.innerText = this.currentUser.username || '-';
    if (nSpan) nSpan.innerText = this.currentUser.full_name || '-';
    if (cSpan) cSpan.innerText = this.currentUser.class_group || '1SNEb';
    if (pSpan) pSpan.innerText = this.currentUser.program || 'PXL TI / SNE';
    if (ySpan) ySpan.innerText = this.currentUser.academic_year || '2026-27';
    if (bSpan) bSpan.innerText = `${this.currentUser.full_name} (${this.currentUser.class_group || 'Student'})`;

    modal.style.display = 'flex';
    this.switchStudentStudioTab('labs');
    this.loadStudentStudioData();
  }

  closeStudentStudioModal() {
    const modal = document.getElementById('studentStudioModal');
    if (modal) modal.style.display = 'none';
  }

  openStudentScoresModal() {
    this.openStudentStudioModal();
  }

  closeStudentScoresModal() {
    this.closeStudentStudioModal();
  }

  switchStudentStudioTab(tab) {
    const btnLabs = document.getElementById('tabBtnStudentLabs');
    const btnAcc = document.getElementById('tabBtnStudentAccount');
    const btnBugs = document.getElementById('tabBtnStudentBugs');
    const paneLabs = document.getElementById('paneStudentLabs');
    const paneAcc = document.getElementById('paneStudentAccount');
    const paneBugs = document.getElementById('paneStudentBugs');

    const tabs = [
      { key: 'labs', btn: btnLabs, pane: paneLabs },
      { key: 'account', btn: btnAcc, pane: paneAcc },
      { key: 'bugs', btn: btnBugs, pane: paneBugs }
    ];

    tabs.forEach(t => {
      const isActive = t.key === tab;
      if (t.btn) {
        t.btn.classList.toggle('active', isActive);
        t.btn.style.borderBottom = isActive ? '3px solid #0284c7' : '3px solid transparent';
        t.btn.style.color = isActive ? '#0f172a' : '#64748b';
      }
      if (t.pane) t.pane.style.display = isActive ? 'block' : 'none';
    });

    if (tab === 'bugs') {
      this.loadStudentBugs();
    }
  }

  async loadStudentBugs() {
    const container = document.getElementById('studentBugsContainer');
    if (!container) return;

    if (!this.currentUser) {
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: #64748b;">Log eerst in om je gemelde bugs te bekijken.</div>`;
      return;
    }

    container.innerHTML = `<div style="padding: 30px; text-align: center; color: #64748b;">⏳ Je gemelde bugs ophalen...</div>`;

    try {
      const res = await fetch(`/api/bug-report/list?reporter_username=${encodeURIComponent(this.currentUser.username)}`);
      const data = await res.json();
      const bugs = data.bugs || [];

      if (bugs.length === 0) {
        container.innerHTML = `
          <div style="padding: 40px 20px; text-align: center; background: #fff; border: 1.5px dashed #cbd5e1; border-radius: 8px;">
            <div style="font-size: 36px; margin-bottom: 8px;">✨</div>
            <h4 style="margin: 0 0 6px 0; color: #1e293b; font-size: 14px;">Geen Gemelde Bugs</h4>
            <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
              Je hebt nog geen bugs gemeld. Loop je vast of werkt iets niet naar verwachting?<br>
              Klik bovenaan op de knop <strong>🐞 Bug Melden</strong> om direct een snapshot van je lab door te sturen!
            </p>
          </div>
        `;
        return;
      }

      let html = `
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #fff;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                <th style="padding: 8px 12px; width: 130px;">Bug Code</th>
                <th style="padding: 8px 12px; width: 120px;">Datum</th>
                <th style="padding: 8px 12px; width: 140px;">Lab</th>
                <th style="padding: 8px 12px;">Omschrijving</th>
                <th style="padding: 8px 12px; width: 110px; text-align: center;">Status</th>
                <th style="padding: 8px 12px; width: 140px; text-align: right;">Actie</th>
              </tr>
            </thead>
            <tbody>
      `;

      bugs.forEach((b, idx) => {
        const isResolved = b.status === 'resolved';
        const dateStr = b.created_at ? new Date(b.created_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' }) : '-';
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

        html += `
          <tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0; line-height: 1.4;">
            <td style="padding: 10px 12px;">
              <strong style="color: #b91c1c; font-family: monospace;">${b.bug_code}</strong>
            </td>
            <td style="padding: 10px 12px; color: #64748b; font-size: 11px;">${dateStr}</td>
            <td style="padding: 10px 12px; color: #334155;">${b.exam_title || b.exam_id || 'Vrij Lab'}</td>
            <td style="padding: 10px 12px;">
              <div style="color: #0f172a; font-weight: 600;">${b.user_description}</div>
              ${b.resolution_notes ? `
                <div style="margin-top: 4px; padding: 6px 10px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; font-size: 11.5px; color: #166534;">
                  <strong>💡 Oplossing / Testinstructie:</strong> ${b.resolution_notes}
                </div>
              ` : ''}
            </td>
            <td style="padding: 10px 12px; text-align: center;">
              <span class="pt-badge" style="background: ${isResolved ? '#dcfce7' : '#fee2e2'}; color: ${isResolved ? '#166534' : '#991b1b'}; border: 1px solid ${isResolved ? '#86efac' : '#fca5a5'}; padding: 3px 8px; border-radius: 12px; font-weight: 700;">
                ${isResolved ? '🟢 Opgelost' : '🔴 In Behandeling'}
              </span>
            </td>
            <td style="padding: 10px 12px; text-align: right; white-space: nowrap;">
              <a href="/api/bug-report/${b.bug_code}/export" class="pt-btn pt-btn-secondary" style="font-size: 11px; padding: 4px 8px; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;" title="Download JSON bestand">
                📥 JSON
              </a>
              ${!isResolved ? `
                <button class="pt-btn" style="font-size: 11px; padding: 4px 8px; background: #dcfce7; color: #166534; border: 1px solid #86efac; border-radius: 4px; cursor: pointer; font-weight: 600;" onclick="window.PXLApp.confirmStudentBugResolved('${b.bug_code}')" title="Bevestig dat het probleem voor jou is opgelost">
                  ✅ Opgelost
                </button>
              ` : ''}
            </td>
          </tr>
        `;
      });

      html += `</tbody></table></div>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div style="padding: 20px; color: #ef4444; text-align: center;">Fout bij ophalen bugs: ${err.message}</div>`;
    }
  }

  async confirmStudentBugResolved(bugCode) {
    if (!confirm(`Wil je bug '${bugCode}' als opgelost bevestigen?`)) return;
    try {
      const res = await fetch('/api/bug-report/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bug_code: bugCode,
          status: 'resolved',
          resolution_notes: 'Bevestigd als opgelost door student na testen',
          resolved_by: this.currentUser ? this.currentUser.username : 'student'
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(`✅ ${bugCode} als opgelost bevestigd!`);
        this.loadStudentBugs();
      }
    } catch (err) {
      alert(`Fout bij bijwerken bug: ${err.message}`);
    }
  }

  async loadStudentStudioData() {
    const container = document.getElementById('studentAssignedListContainer');
    if (!container) return;

    try {
      container.innerHTML = `<div style="padding: 30px; text-align: center; color: #64748b;">⏳ Toegewezen labs en testen ophalen...</div>`;
      const res = await fetch('/api/student/assigned-exams');
      const data = await res.json();
      const exams = (data && data.exams) || [];

      if (exams.length === 0) {
        container.innerHTML = `
          <div style="padding: 40px 20px; text-align: center; background: #fff; border: 1.5px dashed #cbd5e1; border-radius: 8px;">
            <div style="font-size: 36px; margin-bottom: 8px;">🔬</div>
            <h4 style="margin: 0 0 6px 0; color: #1e293b; font-size: 14px;">Geen Toegewezen Labs of Testen</h4>
            <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
              Je docent heeft momenteel nog geen specifieke labs of testen aan jouw klas (${this.currentUser?.class_group || '1SNEb'}) gekoppeld.<br>
              Je kan altijd vrij oefenen met de standaard labs en cursusopdrachten in de menubalk!
            </p>
          </div>
        `;
        return;
      }

      let html = `
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #fff;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                <th style="padding: 8px 12px;">Opdracht / Examen</th>
                <th style="padding: 8px 12px; width: 110px;">Type</th>
                <th style="padding: 8px 12px; width: 120px;">Score</th>
                <th style="padding: 8px 12px; width: 130px;">Feedback</th>
                <th style="padding: 8px 12px; width: 140px; text-align: right;">Actie & Reset</th>
              </tr>
            </thead>
            <tbody>
      `;

      exams.forEach((ex, idx) => {
        const isTest = (ex.kind === 'test' || ex.assignment_type === 'test');
        const typeBadge = isTest
          ? `<span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 700;">📝 Test</span>`
          : `<span style="background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 700;">🔬 Lab</span>`;

        const hasScore = (ex.score !== null && ex.score !== undefined);
        const pct = hasScore ? Math.round(ex.percentage || 0) : 0;
        const isPassed = pct >= 50;
        const scoreColor = isPassed ? '#16a34a' : (pct > 0 ? '#d97706' : '#dc2626');
        const scoreDisplay = hasScore
          ? `<div><strong style="color: ${scoreColor}; font-size: 12.5px;">${pct}%</strong> <span style="font-size: 11px; color: #64748b;">(${ex.score}/${ex.max_score} pt)</span></div>
             <div style="font-size: 10px; color: #94a3b8;">${ex.last_saved ? ex.last_saved.split(' ')[1] : ''}</div>`
          : `<span style="color: #94a3b8; font-style: italic; font-size: 11px;">Nog niet ingediend</span>`;

        const rubricEval = ex.rubric_evaluation || [];
        const hasRubricEval = rubricEval.length > 0;
        const failedCount = rubricEval.filter(r => !r.passed).length;
        const passedCount = rubricEval.filter(r => r.passed).length;

        const feedbackBtn = hasRubricEval
          ? `<button class="pt-btn pt-btn-sm" style="font-size: 11px; padding: 3px 8px; background: ${failedCount > 0 ? '#fef2f2' : '#f0fdf4'}; border: 1px solid ${failedCount > 0 ? '#fecaca' : '#bbf7d0'}; color: ${failedCount > 0 ? '#b91c1c' : '#15803d'}; font-weight: 600;" onclick="window.PXLApp.toggleRubricFeedbackDetails(${idx})">
               🔍 ${failedCount > 0 ? `Fouten (${failedCount})` : 'Alle Rubrics ✅'}
             </button>`
          : `<span style="color: #94a3b8; font-size: 11px;">-</span>`;

        const resetBtn = isTest
          ? `<span style="font-size: 10px; color: #94a3b8; display: inline-flex; align-items: center; gap: 3px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;" title="Officiële testen kunnen uitsluitend door een docent gereset worden.">🔒 Enkel docent reset</span>`
          : `<button class="pt-btn pt-btn-sm" style="font-size: 10.5px; padding: 2px 7px; background: #fff; border: 1px solid #cbd5e1; color: #475569;" onclick="window.PXLApp.resetLabByStudent('${ex.exam_id}')" title="Reset dit oefenlabo om opnieuw vanaf blanco te beginnen">🔄 Reset</button>`;

        html += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px;">
              <div style="font-weight: 700; color: #0f172a;">${ex.title}</div>
              <div style="font-size: 10.5px; color: #64748b; display: flex; gap: 8px; margin-top: 2px;">
                <span>⏱️ ${ex.time_limit_minutes} min</span>
                ${isTest ? (ex.is_started ? '<span style="color: #16a34a; font-weight: 600;">▶️ Gestart</span>' : '<span style="color: #d97706; font-weight: 600;">⏳ Wacht op startsein docent</span>') : '<span style="color: #0284c7; font-weight: 600;">🟢 Direct beschikbaar</span>'}
              </div>
            </td>
            <td style="padding: 10px 12px;">${typeBadge}</td>
            <td style="padding: 10px 12px;">${scoreDisplay}</td>
            <td style="padding: 10px 12px;">${feedbackBtn}</td>
            <td style="padding: 10px 12px; text-align: right;">
              <div style="display: inline-flex; gap: 6px; align-items: center;">
                <button class="pt-btn pt-btn-primary" style="padding: 3px 8px; font-size: 11px;" onclick="window.PXLApp.openExamFromStudentStudio('${ex.exam_id}')">
                  🚀 Openen
                </button>
                ${resetBtn}
              </div>
            </td>
          </tr>
        `;

        if (hasRubricEval) {
          html += `
            <tr id="rubricFeedbackRow_${idx}" style="display: none; background: #fafafa; border-bottom: 1px solid #e2e8f0;">
              <td colspan="5" style="padding: 12px 16px;">
                <div style="margin-bottom: 8px; font-size: 12px; font-weight: 700; color: #1e293b; display: flex; justify-content: space-between;">
                  <span>📋 Gedetailleerde Rubric Evaluatie &amp; Foutenoverzicht:</span>
                  <span style="font-size: 11px; font-weight: 600; color: ${failedCount > 0 ? '#b91c1c' : '#15803d'};">
                    ${passedCount} behaald / ${failedCount} te verbeteren
                  </span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  ${rubricEval.map(crit => {
                    if (crit.passed) {
                      return `
                        <div style="color: #15803d; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 6px 10px; font-size: 11.5px; display: flex; justify-content: space-between; align-items: center;">
                          <div>
                            <strong>✅ ${crit.title || crit.name || 'Criterium'}</strong>
                            <div style="font-size: 10.5px; color: #166534; margin-top: 1px;">${crit.detail || 'Correct geconfigureerd.'}</div>
                          </div>
                          <strong style="color: #15803d; font-size: 11.5px;">+${crit.points} pt</strong>
                        </div>
                      `;
                    } else {
                      return `
                        <div style="color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 6px 10px; font-size: 11.5px; display: flex; justify-content: space-between; align-items: center;">
                          <div>
                            <strong>❌ ${crit.title || crit.name || 'Criterium'}</strong>
                            <div style="font-size: 10.5px; color: #b91c1c; margin-top: 1px;">
                              <em>Wat er niet goed was:</em> ${crit.detail || crit.reason || 'Niet of onvolledig geconfigureerd'}
                            </div>
                          </div>
                          <strong style="color: #dc2626; font-size: 11.5px;">0 / ${crit.points} pt</strong>
                        </div>
                      `;
                    }
                  }).join('')}
                </div>
              </td>
            </tr>
          `;
        }
      });

      html += `</tbody></table></div>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div style="padding: 20px; color: #ef4444; text-align: center;">Fout bij laden van Student Studio: ${err.message}</div>`;
    }
  }

  toggleRubricFeedbackDetails(idx) {
    const row = document.getElementById(`rubricFeedbackRow_${idx}`);
    if (row) {
      row.style.display = (row.style.display === 'none') ? 'table-row' : 'none';
    }
  }

  async handleStudentChangePassword(e) {
    e.preventDefault();
    const oldPw = document.getElementById('studentOldPw')?.value;
    const newPw = document.getElementById('studentNewPw')?.value;
    const confPw = document.getElementById('studentConfirmPw')?.value;
    const alertBox = document.getElementById('studentPwAlert');

    if (!alertBox) return;

    if (newPw !== confPw) {
      alertBox.style.display = 'block';
      alertBox.style.background = '#fef2f2';
      alertBox.style.color = '#b91c1c';
      alertBox.style.border = '1px solid #fecaca';
      alertBox.innerText = 'Het nieuwe wachtwoord en de bevestiging komen niet overeen.';
      return;
    }

    try {
      const res = await fetch('/api/student/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: oldPw, new_password: newPw })
      });
      const data = await res.json();
      alertBox.style.display = 'block';

      if (data.ok) {
        alertBox.style.background = '#f0fdf4';
        alertBox.style.color = '#15803d';
        alertBox.style.border = '1px solid #bbf7d0';
        alertBox.innerText = '✅ Wachtwoord succesvol gewijzigd!';
        document.getElementById('studentOldPw').value = '';
        document.getElementById('studentNewPw').value = '';
        document.getElementById('studentConfirmPw').value = '';
        this.showToast('🔐 Wachtwoord succesvol bijgewerkt!');
      } else {
        alertBox.style.background = '#fef2f2';
        alertBox.style.color = '#b91c1c';
        alertBox.style.border = '1px solid #fecaca';
        alertBox.innerText = '❌ ' + (data.error || 'Kon wachtwoord niet wijzigen');
      }
    } catch (err) {
      alertBox.style.display = 'block';
      alertBox.style.background = '#fef2f2';
      alertBox.style.color = '#b91c1c';
      alertBox.innerText = 'Netwerkfout: ' + err.message;
    }
  }

  async resetLabByStudent(examId) {
    if (!confirm(`Weet je zeker dat je het labo '${examId}' wil resetten?\n\nAl je opgeslagen configuraties en behaalde score worden gewist zodat je blanco opnieuw kunt oefenen.`)) {
      return;
    }

    try {
      const res = await fetch('/api/student/reset-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_id: examId })
      });
      const data = await res.json();
      if (data.ok) {
        this.showToast(`🔄 Lab '${examId}' succesvol gereset!`);
        await this.loadStudentStudioData();
        if (this.activeExam && this.activeExam.id === examId) {
          this.loadExam(this.activeExam);
        }
      } else {
        alert('Fout: ' + (data.error || 'Kon lab niet resetten'));
      }
    } catch (err) {
      alert('Netwerkfout: ' + err.message);
    }
  }

  async openExamFromStudentStudio(examId) {
    this.closeStudentStudioModal();
    await this.selectExamFromDropdown(examId);
  }

  // --- TEST PASSWORD MODAL CONTROLS ---
  openTestPasswordModal(assignedExam) {
    this.pendingTestExam = assignedExam;
    const modal = document.getElementById('testPasswordModal');
    if (!modal) return;
    const titleEl = document.getElementById('testPasswordModalTitle');
    const descEl = document.getElementById('testPasswordModalDesc');
    const inputEl = document.getElementById('inputTestPassword');
    const alertEl = document.getElementById('testPasswordAlert');

    if (titleEl) titleEl.innerText = `🔒 Test Wachtwoord: ${assignedExam.title}`;
    if (descEl) descEl.innerText = `Deze opdracht is een beveiligde test (${assignedExam.time_limit_minutes} min). Voer het test-wachtwoord in dat door je docent is vrijgegeven om de test te starten.`;
    if (alertEl) alertEl.style.display = 'none';
    if (inputEl) {
      inputEl.value = '';
      setTimeout(() => inputEl.focus(), 100);
    }
    modal.style.display = 'flex';
  }

  closeTestPasswordModal() {
    const modal = document.getElementById('testPasswordModal');
    if (modal) modal.style.display = 'none';
    this.pendingTestExam = null;
  }

  async submitTestPassword(e) {
    e.preventDefault();
    if (!this.pendingTestExam) return;
    const password = document.getElementById('inputTestPassword')?.value || '';
    const alertEl = document.getElementById('testPasswordAlert');

    try {
      const res = await fetch('/api/student/verify-test-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam_id: this.pendingTestExam.exam_id, password: password })
      });
      const data = await res.json();

      if (data.ok) {
        const examIdToLoad = this.pendingTestExam.exam_id;
        this.closeTestPasswordModal();
        await this.loadExamById(examIdToLoad);
        this.showToast(`🚀 Test '${this.pendingTestExam.title}' gestart! Veel succes!`);
      } else {
        if (alertEl) {
          alertEl.innerText = data.error || 'Onjuist wachtwoord';
          alertEl.style.display = 'block';
        }
      }
    } catch (err) {
      if (alertEl) {
        alertEl.innerText = 'Netwerkfout: ' + err.message;
        alertEl.style.display = 'block';
      }
    }
  }
}

// Bootstrap on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  window.PXLApp = new PXLNetSimApp();
});
