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
        instructions: `
          ### Doel van het Lab
          Configureer het netwerk volgens het Cisco PXL lab model:
          - **LAN 1**: 172.16.1.0/24 (R1 Gi0/0/0 = .1, SW1 Vlan1 = .254, PCA = .5)
          - **WAN**: 192.168.1.160/30 (R1 Gi0/0/1 = .161, R2 Gi0/0/1 = .162)
          - **LAN 2**: 10.11.12.0/24 (R2 Gi0/0/0 = .1, SW2 Vlan1 = .254, PCB = .5)
          
          Zorg voor unieke hostnames, enable secret, console wachtwoord, banner motd, interface IP's, statische routes en SSH.
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
        instructions: `
          ### Zelfstandig Bekabelen en Configureren
          Plaats een Router (4331), een Switch (2960) en een PC.
          Verbind de PC via FastEthernet0 met Switch Fa0/1 (Straight-Through).
          Verbind Switch Gi0/1 met Router Gi0/0/0 (Straight-Through).
          Configureer IP 192.168.10.1/24 op de router en stel de PC in op 192.168.10.10.
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
        instructions: `
          ### Draadloos Netwerk Opzetten
          Verbind de Wireless Router / AP met de Switch.
          Configureer SSID 'PXL-Guest' met WPA2-PSK wachtwoord 'PXL2026Net!'.
          Ga naar de Laptop, open Desktop > PC Wireless en maak verbinding met het AP.
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
  initDeviceShelf() {
    const shelfItems = [
      // Network Devices - Cisco Routers
      { type: 'router', model: '4331', label: 'Cisco 4331', category: 'routers' },
      { type: 'router', model: '2911', label: 'Cisco 2911', category: 'routers' },
      // Network Devices - MikroTik & OpenWrt Routers
      { type: 'mikrotik', model: 'hEX lite (RB750r2)', label: 'MikroTik hEX lite', category: 'routers' },
      { type: 'openwrt', model: 'OpenWrt 23.05', label: 'OpenWrt Router', category: 'routers' },
      // Internet Gateways (Public Real NAT & Simulated Welkom op het Internet)
      { type: 'internet_simulated', model: 'PXL Internet (Simulated)', label: 'Internet (Simulated)', category: 'routers' },
      { type: 'internet_public', model: 'PXL Internet (Public NAT)', label: 'Internet (Public)', category: 'routers' },
      { type: 'internet_cloud', model: 'PXL Global Internet', label: 'Het Internet (Hybrid)', category: 'routers' },
      // Network Devices - Switches
      { type: 'switch', model: '2960-24TT', label: '2960-24TT Switch', category: 'switches' },
      { type: 'switch', model: '3560-24PS', label: '3560 Multilayer', category: 'switches' },
      { type: 'hpe_switch', model: 'Aruba-2530-24G', label: 'HPE Aruba 2530', category: 'switches' },
      { type: 'hpe_switch', model: 'Aruba-2930F-24G', label: 'HPE Aruba 2930F', category: 'switches' },
      // Network Devices - Wireless (SNE Networks 1 Ch 8)
      { type: 'wireless_router', model: 'WRT300N', label: 'WRT300N Router', category: 'wireless' },
      { type: 'wireless_ap', model: 'AIR-LAP3702', label: 'Cisco LAP-PT (AP)', category: 'wireless' },
      { type: 'wlc', model: '3504', label: 'Cisco 3504 WLC', category: 'wireless' },
      // End Devices
      { type: 'pc', model: 'Standard', label: 'PC-PT', category: 'end_devices' },
      { type: 'laptop', model: 'Standard', label: 'Laptop-PT', category: 'end_devices' },
      { type: 'server', model: 'Standard', label: 'Server-PT', category: 'end_devices' },
      // Connections
      { cableType: 'auto', label: 'Automatisch', category: 'connections', icon: '⚡' },
      { cableType: 'straight', label: 'Straight-Through', category: 'connections', icon: '⎯' },
      { cableType: 'crossover', label: 'Cross-Over', category: 'connections', icon: '╍' },
      { cableType: 'serial', label: 'Serial DCE', category: 'connections', icon: '↯' },
      { cableType: 'console', label: 'Console Kabel', category: 'connections', icon: '⌒' }
    ];

    const shelfContainer = document.getElementById('deviceShelfItems');
    if (!shelfContainer) return;

    shelfContainer.innerHTML = '';
    shelfItems.forEach(item => {
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
        if (this.presetExams[val]) {
          this.loadExam(this.presetExams[val]);
        }
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
  }

  populateExamSelector(selectedId) {
    const examSelect = document.getElementById('examSelector');
    if (!examSelect) return;
    examSelect.innerHTML = '';

    const ogDefault = document.createElement('optgroup');
    ogDefault.label = 'Standaard PXL Examens';
    ogDefault.innerHTML = `
      <option value="01_pxl_standard">Lab 1: PXL LAN/WAN Routing (Standaard)</option>
      <option value="02_cabling_scratch">Lab 2: Zelfstandig Bekabelen & Setup</option>
      <option value="03_wireless_lan">Lab 3: Wireless LAN & WPA2-PSK</option>
    `;
    examSelect.appendChild(ogDefault);

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

    if (selectedId) examSelect.value = selectedId;
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
    const cliTabBtn = document.getElementById('tabBtnCli');
    const desktopTabBtn = document.getElementById('tabBtnDesktop');
    const servicesTabBtn = document.getElementById('tabBtnServices');
    const webfigTabBtn = document.getElementById('tabBtnWebFig');
    const hpeWebTabBtn = document.getElementById('tabBtnHpeWeb');
    const wrtWebTabBtn = document.getElementById('tabBtnWrtWeb');
    const wlcWebTabBtn = document.getElementById('tabBtnWlcWeb');

    if (cliTabBtn) {
      cliTabBtn.style.display = (isHost || isWrt) ? 'none' : 'inline-block';
      if (device.type === 'mikrotik') {
        cliTabBtn.innerText = 'CLI (RouterOS)';
      } else if (device.type === 'openwrt') {
        cliTabBtn.innerText = 'CLI (Ash Linux)';
      } else if (device.type === 'hpe_switch') {
        cliTabBtn.innerText = 'CLI (ArubaOS-S)';
      } else if (device.type === 'wlc') {
        cliTabBtn.innerText = 'CLI (Cisco WLC)';
      } else if (device.type === 'internet_cloud' || device.type === 'internet_simulated' || device.type === 'internet_public') {
        cliTabBtn.innerText = device.type === 'internet_public' ? 'Status (Internet Public NAT)' : 'Status (Het Internet)';
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

    // Switch to primary operational tab
    if (isServer) {
      this.switchDeviceModalTab('services');
    } else if (isHost) {
      this.switchDeviceModalTab('desktop');
    } else if (isWrt) {
      this.switchDeviceModalTab('wrtweb');
    } else if (isWlc) {
      this.switchDeviceModalTab('wlcweb');
    } else if (device.type === 'wireless_ap') {
      this.switchDeviceModalTab('config');
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
    const tabs = ['physical', 'config', 'cli', 'desktop', 'services', 'webfig', 'hpeweb', 'wrtweb', 'wlcweb'];
    tabs.forEach(t => {
      const pane = document.getElementById(`modalPane${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (pane) pane.classList.remove('active');
    });
    document.querySelectorAll('.pt-device-tabs .pt-tab-btn').forEach(b => b.classList.remove('active'));

    const activePane = document.getElementById(`modalPane${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`);
    if (activePane) activePane.classList.add('active');

    const activeBtn = document.getElementById(`tabBtn${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');

    if (tabKey === 'physical') this.renderPhysicalTab();
    if (tabKey === 'config') this.renderConfigTab();
    if (tabKey === 'cli') this.renderCliTab();
    if (tabKey === 'desktop') this.renderDesktopTab();
    if (tabKey === 'services') this.renderServicesTab();
    if (tabKey === 'webfig') this.renderWebFigTab();
    if (tabKey === 'hpeweb') this.renderHpeWebTab();
    if (tabKey === 'wrtweb') this.renderWrtWebTab();
    if (tabKey === 'wlcweb') this.renderWlcWebTab();
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
            ${Object.keys(dev.interfaces).map(p => `
              <div class="pt-chassis-port">
                <div class="pt-port-led ${this.sim.isLinkUp(dev.id, p) ? 'green' : 'amber'}"></div>
                <div class="pt-port-jack"></div>
                <span class="pt-port-name">${p.replace('GigabitEthernet', 'Gi').replace('FastEthernet', 'Fa').replace('Serial', 'Se')}</span>
              </div>
            `).join('')}
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
          ${Object.keys(dev.interfaces).map(p => `
            <button class="pt-sidebar-port-btn" onclick="window.PXLApp.selectConfigPort('${p}')">${p}</button>
          `).join('')}
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

    editor.innerHTML = `
      <h4>Interface: ${portName}</h4>
      <div class="pt-form-group">
        <label>Poort Status:</label>
        <label class="pt-checkbox-label">
          <input type="checkbox" ${!intf.shutdown ? 'checked' : ''} onchange="window.PXLApp.updatePortShutdown('${portName}', !this.checked)">
          Poort Inschakelen (no shutdown)
        </label>
      </div>
      <div class="pt-form-group">
        <label>IP Adres:</label>
        <input type="text" class="pt-input" value="${intf.ip || ''}" onchange="window.PXLApp.updatePortIp('${portName}', this.value)">
      </div>
      <div class="pt-form-group">
        <label>Subnet Masker:</label>
        <input type="text" class="pt-input" value="${intf.mask || ''}" onchange="window.PXLApp.updatePortMask('${portName}', this.value)">
      </div>
      <div class="pt-form-group">
        <label>Beschrijving:</label>
        <input type="text" class="pt-input" value="${intf.description || ''}" onchange="window.PXLApp.updatePortDesc('${portName}', this.value)">
      </div>
    `;
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
      const trimmed = ip.trim();
      this.activeDevice.interfaces[portName].ip = trimmed;
      if (trimmed) {
        this.activeDevice.interfaces[portName].shutdown = false;
        if (this.activeDevice.type === 'switch' || this.activeDevice.type === 'hpe_switch') {
          this.activeDevice.ip = trimmed;
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

    // Internet Gateway Views (Public NAT / Simulated / Hybrid)
    if (dev.type === 'internet_cloud' || dev.type === 'internet_simulated' || dev.type === 'internet_public') {
      const isPublicOnly = (dev.type === 'internet_public');
      const isSimOnly = (dev.type === 'internet_simulated');
      const isLive = isPublicOnly ? true : (isSimOnly ? false : this.sim.liveInternetEnabled);

      container.innerHTML = `
        <div style="background: #0f172a; color: #f8fafc; padding: 25px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 15px; margin-bottom: 18px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 32px;">🌐</span>
              <div>
                <h3 style="margin: 0; color: #38bdf8;">
                  ${isPublicOnly ? 'Het Internet (Public NAT Bridge)' : (isSimOnly ? 'Het Internet (Gesimuleerd • Examen)' : 'Het Internet (PXL Global Cloud Gateway)')}
                </h3>
                <span style="font-size: 12px; color: #94a3b8;">
                  ${isPublicOnly ? 'Fysieke Netwerkadapter &bull; Echte Internettoegang' : (isSimOnly ? 'Gesloten Simulatiewebsite &bull; Examenveilig' : 'Virtuele WAN Gateway &bull; PXL NetSim')}
                </span>
              </div>
            </div>
            <div style="background: ${isLive ? '#065f46' : '#1e3a8a'}; color: ${isLive ? '#34d399' : '#60a5fa'}; font-weight: bold; font-size: 12px; padding: 5px 14px; border-radius: 20px; border: 1px solid ${isLive ? '#059669' : '#3b82f6'};">
              ${isLive ? '● LIVE INTERNET NAT (FYSIEKE ADAPTER)' : '● GESIMULEERD INTERNET (EXAMENMODUS)'}
            </div>
          </div>

          ${(!isPublicOnly && !isSimOnly) ? `
            <!-- Interactive Live Internet NAT Gateway Switch (Hybrid Device) -->
            <div style="background: #1e293b; padding: 16px 20px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
              <div style="max-width: 65%;">
                <strong style="color: #38bdf8; font-size: 14px;">🌐 Fysieke Internet NAT Bridge Schakelaar:</strong>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 3px; line-height: 1.4;">
                  Koppel deze wolk aan de fysieke adapter van de server (Google Cloud Run / Host).
                </div>
              </div>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; background: #0f172a; padding: 8px 16px; border-radius: 24px; border: 2px solid ${isLive ? '#10b981' : '#475569'};">
                <input type="checkbox" id="chkLiveInternetModal" ${isLive ? 'checked' : ''} onchange="window.PXLApp.toggleLiveInternet(this.checked)" style="width: 18px; height: 18px; cursor: pointer;">
                <span style="font-weight: 800; font-size: 12px; color: ${isLive ? '#34d399' : '#cbd5e1'};">
                  ${isLive ? 'LIVE NAT AAN' : 'SIMULATIE'}
                </span>
              </label>
            </div>
          ` : `
            <div style="background: ${isLive ? '#064e3b' : '#172554'}; padding: 14px 18px; border-radius: 8px; border: 1px solid ${isLive ? '#059669' : '#1d4ed8'}; margin-bottom: 18px;">
              <strong style="color: ${isLive ? '#a7f3d0' : '#bfdbfe'}; font-size: 13px;">
                ${isLive ? '🌐 Vaste Publieke NAT Interface Actief:' : '🔒 Vaste Gesimuleerde Omgeving Actief:'}
              </strong>
              <p style="margin: 4px 0 0; font-size: 12.5px; color: #e2e8f0; line-height: 1.5;">
                ${isLive
                  ? 'Dit apparaat is een <strong>fysieke NAT-gateway</strong>. Alle netwerkaanvragen (HTTP, DNS, ping/TCP probes) worden daadwerkelijk uitgestuurd via de netwerkadapter van de server (Google Cloud / Localhost).'
                  : 'Dit apparaat simuleert een <strong>afgesloten internetomgeving</strong>. Elk IP-adres en elke domeinnaam toont de interne landingspagina <em>"Welkom op het Internet"</em> met het PXL-symbool. Veilig voor examens en offline klassen.'}
              </p>
            </div>
          `}

          <div style="margin-top: 15px;">
            <h4 style="color: #38bdf8; margin-bottom: 10px; font-size: 13px;">Beschikbare Internet Ingress Poorten:</h4>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
              ${Object.entries(dev.interfaces).map(([p, intf]) => `
                <div style="background: #1e293b; padding: 10px; border-radius: 6px; border: 1px solid #334155; font-size: 12px;">
                  <strong style="color: #38bdf8;">${p}</strong>: ${intf.ip || 'DHCP/WAN'} <span style="color: #64748b;">(${intf.description})</span>
                </div>
              `).join('')}
            </div>
          </div>
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
      viewport.innerHTML = `
        <div class="pt-app-window">
          <h4>IP Configuration</h4>
          <div class="pt-form-group">
            <label>IPv4 Configuration:</label>
            <label><input type="radio" name="ipMode" ${!dev.dhcpEnabled ? 'checked' : ''} onchange="window.PXLApp.activeDevice.dhcpEnabled=false"> Static</label>
            <label><input type="radio" name="ipMode" ${dev.dhcpEnabled ? 'checked' : ''} onchange="window.PXLApp.activeDevice.dhcpEnabled=true"> DHCP</label>
          </div>
          <div class="pt-form-group">
            <label>IPv4 Address:</label>
            <input type="text" class="pt-input" id="pcIpInput" value="${dev.ip || ''}">
          </div>
          <div class="pt-form-group">
            <label>Subnet Mask:</label>
            <input type="text" class="pt-input" id="pcMaskInput" value="${dev.mask || ''}">
          </div>
          <div class="pt-form-group">
            <label>Default Gateway:</label>
            <input type="text" class="pt-input" id="pcGwInput" value="${dev.gateway || ''}">
          </div>
          <div class="pt-form-group">
            <label>DNS Server:</label>
            <input type="text" class="pt-input" id="pcDnsInput" value="${dev.dns || '8.8.8.8'}">
          </div>
          <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.savePcIpConfig()">Opslaan & Toepassen</button>
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
      modal.className = 'pt-modal';
      modal.style.zIndex = '9999';
      modal.innerHTML = `
        <div class="pt-modal-dialog" style="width: 92vw; max-width: 1250px; height: 85vh; display: flex; flex-direction: column; background: #0f172a; border-radius: 8px; border: 1px solid #334155; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); overflow: hidden;">
          <div style="background: #1e293b; padding: 8px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155;">
            <div style="display: flex; align-items: center; gap: 8px; color: #38bdf8; font-weight: 700; font-size: 14px;">
              <span>🦈 Wireshark Protocol Analyzer &amp; OSI Inspector (Topologie Capture)</span>
            </div>
            <button class="pt-btn-close" onclick="document.getElementById('globalWiresharkModal').classList.remove('active')">✕</button>
          </div>
          <div id="globalWiresharkViewport" style="flex: 1; overflow: hidden; height: calc(85vh - 45px);"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.classList.add('active');
    if (window.WiresharkApp) {
      const ws = new window.WiresharkApp(null, { isGlobal: true, containerId: 'globalWiresharkViewport' });
      ws.render();
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
        scoreBar.style.backgroundColor = evalResult.percentage >= 50 ? '#22c55e' : '#f59e0b';
      }
    }

    const canvasScorePct = document.getElementById('canvasScorePct');
    if (canvasScorePct) {
      canvasScorePct.innerText = `${evalResult.percentage}%`;
    }

    const panel = document.getElementById('rubricSidePanel');
    if (panel && panel.classList.contains('open')) {
      this.renderRubricSidePanel();
    }
  }

  toggleRubricPanel() {
    const panel = document.getElementById('rubricSidePanel');
    if (!panel) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      this.renderRubricSidePanel();
    }
  }

  renderRubricSidePanel() {
    const container = document.getElementById('rubricSidePanelContent');
    if (!container) return;

    const res = this.gradingEngine.evaluate();
    container.innerHTML = `
      <div class="pt-rubric-panel-header">
        <h4>Beoordelingsrubric & Criteria</h4>
        <div class="pt-rubric-summary-score">Totaal: <strong>${res.earnedPoints}</strong> / ${res.totalPoints} pt (${res.percentage}%)</div>
      </div>
      <div class="pt-rubric-panel-list">
        ${res.objectives.map(obj => `
          <div class="pt-rubric-panel-item ${obj.passed ? 'passed' : 'failed'}">
            <div class="pt-panel-item-top">
              <span class="pt-panel-item-status">${obj.passed ? '✅' : '❌'}</span>
              <strong class="pt-panel-item-title">${obj.title}</strong>
              <span class="pt-panel-item-pts">${obj.passed ? obj.points : 0}/${obj.points} pt</span>
            </div>
            <div class="pt-panel-item-desc">${obj.desc || ''}</div>
            <div class="pt-panel-item-detail">${obj.detail || ''}</div>
          </div>
        `).join('')}
      </div>
    `;
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

  showToast(msg) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    toast.innerText = msg;
    toast.className = 'pt-toast show';
    setTimeout(() => {
      toast.className = 'pt-toast';
    }, 3500);
  }

  // --- SERVER SERVICES (HTTP WEB, DNS, FTP) ---
  renderServicesTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPaneServices');
    if (!dev || !container) return;

    if (!dev.services) {
      dev.services = {
        http: { enabled: true, port: 80, content: '<h1>PXL Web Server</h1>' },
        dns: { enabled: true, records: [{ name: 'www.pxl.be', type: 'A', ip: dev.ip || '172.16.1.10' }] },
        ftp: { enabled: true, users: [{ username: 'cisco', password: 'cisco', permissions: 'RWDNL' }], files: [] }
      };
    }

    const sub = this.activeServiceSubtab || 'http';

    container.innerHTML = `
      <div class="pt-services-container">
        <div class="pt-services-sidebar">
          <h4 style="font-size: 11px; text-transform: uppercase; color: #94a3b8; padding-left: 8px; margin: 4px 0 10px;">Server Diensten</h4>
          <button class="pt-service-nav-btn ${sub === 'http' ? 'active' : ''}" onclick="window.PXLApp.switchServiceSubtab('http')">🌐 HTTP / Web</button>
          <button class="pt-service-nav-btn ${sub === 'dns' ? 'active' : ''}" onclick="window.PXLApp.switchServiceSubtab('dns')">🔎 DNS Service</button>
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

        <!-- File Selector & Actions Bar -->
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
    } else if (sub === 'dns') {
      const dns = dev.services.dns;
      return `
        <h3>🔎 DNS Server Configuratie</h3>
        <div class="pt-service-status-bar">
          <span>Dienst Status:</span>
          <label><input type="radio" name="srvDns" ${dns.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceDns(true)"> Ingeschakeld (On)</label>
          <label><input type="radio" name="srvDns" ${!dns.enabled ? 'checked' : ''} onchange="window.PXLApp.setServiceDns(false)"> Uitgeschakeld (Off)</label>
        </div>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 10px;">Nieuw Resource Record Toevoegen:</h4>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="dnsNameInput" class="pt-input" placeholder="Domeinnaam (bv. www.pxl.be)" style="flex: 2;">
            <select id="dnsTypeInput" class="pt-input" style="flex: 1;"><option value="A">A Record</option></select>
            <input type="text" id="dnsIpInput" class="pt-input" placeholder="IP Adres (bv. 172.16.1.10)" style="flex: 2;">
            <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.addDnsRecord()">+ Toevoegen</button>
          </div>
        </div>
        <h4>Actieve DNS Records:</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
              <th style="padding: 6px 10px;">Domeinnaam</th>
              <th style="padding: 6px 10px;">Type</th>
              <th style="padding: 6px 10px;">IP Adres</th>
              <th style="padding: 6px 10px; width: 60px;">Actie</th>
            </tr>
          </thead>
          <tbody>
            ${dns.records.map((r, i) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px 10px; font-weight: 600;">${r.name}</td>
                <td style="padding: 6px 10px;">${r.type}</td>
                <td style="padding: 6px 10px; font-family: monospace;">${r.ip}</td>
                <td style="padding: 6px 10px;"><button class="pt-btn-del" onclick="window.PXLApp.deleteDnsRecord(${i})">🗑️</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
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
          ${ftp.users.map(u => `<div>👤 Gebruiker: <strong>${u.username}</strong> | Permissies: <code>${u.permissions}</code></div>`).join('')}
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
            ${ftp.files.map(f => `
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

  setServiceDns(val) {
    if (this.activeDevice && this.activeDevice.services) {
      this.activeDevice.services.dns.enabled = val;
      this.triggerScoreUpdate();
    }
  }

  addDnsRecord() {
    const nameInput = document.getElementById('dnsNameInput');
    const ipInput = document.getElementById('dnsIpInput');
    if (!nameInput || !ipInput || !this.activeDevice) return;
    const name = nameInput.value.trim();
    const ip = ipInput.value.trim();
    if (!name || !IPUtils.isValidIp(ip)) {
      this.showToast('⚠️ Voer een geldige domeinnaam en IPv4-adres in');
      return;
    }
    this.activeDevice.services.dns.records.push({ name, type: 'A', ip });
    this.renderServicesTab();
    this.showToast(`✅ DNS Record '${name} -> ${ip}' toegevoegd`);
    this.triggerScoreUpdate();
  }

  deleteDnsRecord(idx) {
    if (this.activeDevice && this.activeDevice.services) {
      this.activeDevice.services.dns.records.splice(idx, 1);
      this.renderServicesTab();
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
  toggleOpdrachtDropdown() {
    const el = document.getElementById('opdrachtDropdownPanel');
    if (!el) return;
    const isHidden = (el.style.display === 'none' || !el.style.display);
    if (isHidden) {
      this.renderOpdrachtDropdown();
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  }

  closeOpdrachtDropdown() {
    const el = document.getElementById('opdrachtDropdownPanel');
    if (el) el.style.display = 'none';
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
      html += '<table style="width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; background: #ffffff;">';
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

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.slice(1, -1).split('|').map(c => c.trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'));
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
        html += `<h4 style="margin: 14px 0 6px; color: #0284c7; font-size: 13.5px; font-weight: 700;">${line.slice(5)}</h4>`;
      } else if (line.startsWith('### ')) {
        html += `<h3 style="margin: 16px 0 8px; color: #0f172a; font-size: 15px; font-weight: 700;">${line.slice(4)}</h3>`;
      } else if (line.startsWith('* ') || line.startsWith('- ')) {
        const text = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code style="background: #e2e8f0; color: #0f172a; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 11px;">$1</code>');
        html += `<div style="margin-left: 18px; margin-bottom: 4px; line-height: 1.5;">• ${text}</div>`;
      } else {
        const text = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code style="background: #e2e8f0; color: #0f172a; padding: 2px 5px; border-radius: 4px; font-family: monospace; font-size: 11px;">$1</code>');
        html += `<p style="margin: 4px 0; line-height: 1.5;">${text}</p>`;
      }
    }
    if (inTable) flushTable();
    return html;
  }

  renderOpdrachtDropdown() {
    const exam = this.activeExam;
    const titleEl = document.getElementById('opdrachtDropdownTitle');
    const bodyEl = document.getElementById('opdrachtDropdownBody');
    if (!exam || !bodyEl) return;

    if (titleEl) titleEl.innerText = exam.title;

    const evalRes = this.gradingEngine.evaluate();
    const objectives = evalRes.objectives || [];

    let rubricHtml = '';
    if (objectives.length > 0) {
      rubricHtml = `
        <h4 style="margin: 20px 0 8px; color: #0284c7; font-size: 14px; font-weight: 700;">🎯 Beoordelingscriteria & Live Punten (${evalRes.earnedPoints}/${evalRes.totalPoints} pt):</h4>
        <table style="width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; background: #ffffff;">
          <thead style="background: #0f172a; color: #ffffff;">
            <tr>
              <th style="padding: 7px 10px; text-align: left; border: 1px solid #cbd5e1;">Criterium</th>
              <th style="padding: 7px 10px; text-align: left; border: 1px solid #cbd5e1;">Omschrijving</th>
              <th style="width: 70px; text-align: center; border: 1px solid #cbd5e1;">Punten</th>
              <th style="width: 90px; text-align: center; border: 1px solid #cbd5e1;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${objectives.map(obj => `
              <tr style="border-bottom: 1px solid #e2e8f0; background: ${obj.passed ? '#f0fdf4' : '#ffffff'};">
                <td style="font-weight: 600; padding: 6px 10px; border: 1px solid #cbd5e1; color: #1e293b;">${obj.title}</td>
                <td style="font-size: 11px; color: #475569; padding: 6px 10px; border: 1px solid #cbd5e1;">${obj.desc || ''}</td>
                <td style="text-align: center; font-weight: 700; padding: 6px 10px; border: 1px solid #cbd5e1;">${obj.points} pt</td>
                <td style="text-align: center; font-weight: 700; padding: 6px 10px; border: 1px solid #cbd5e1; color: ${obj.passed ? '#16a34a' : '#94a3b8'};">
                  ${obj.passed ? '✅ GESLAAGD' : '⏳ NOG NIET'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const formattedInstructions = this.formatMarkdownInstructions(exam.instructions || '');

    bodyEl.innerHTML = `
      <div style="background: #f8fafc; border-left: 4px solid #0284c7; padding: 14px 16px; margin-bottom: 15px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <h4 style="margin: 0 0 8px; color: #0f172a; font-size: 15px; font-weight: 700;">Examen Opgave: ${exam.title}</h4>
        <div style="font-size: 12px; color: #334155; line-height: 1.6;">
          ${formattedInstructions}
        </div>
      </div>
      ${rubricHtml}
    `;
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
    if (!container) return;

    if (this.currentUser) {
      const isTeacher = (this.currentUser.role === 'teacher');
      container.innerHTML = `
        <span class="pt-auth-badge ${isTeacher ? 'teacher' : ''}">
          ${isTeacher ? '🎓 Docent' : '👨‍🎓 Student'}: ${this.currentUser.full_name}
        </span>
        ${!isTeacher ? `<span class="pt-autosave-indicator" id="autoSaveLabel">💾 Auto-save actief</span>` : ''}
        <button class="pt-btn pt-btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="window.PXLApp.logout()">
          Uitloggen
        </button>
      `;
    } else {
      container.innerHTML = `
        <button class="pt-btn pt-btn-secondary" id="btnLoginModal" onclick="window.PXLApp.openLoginModal()">
          🔑 Inloggen
        </button>
      `;
    }
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
}

// Bootstrap on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  window.PXLApp = new PXLNetSimApp();
});
