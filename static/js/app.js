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
    this.teacherStudio = new TeacherStudio(this);

    this.initPresetExams();
    this.initEventListeners();
    this.initDeviceShelf();
    this.startExamTimer();

    // Load default exam
    this.loadExam(this.presetExams['01_pxl_standard']);
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
  }

  loadExam(exam) {
    this.activeExam = exam;
    this.timerSeconds = (exam.timeLimitMinutes || 80) * 60;

    // Reset simulator
    this.sim.clear();

    // Load initial devices
    if (exam.initialTopology && exam.initialTopology.devices) {
      exam.initialTopology.devices.forEach(d => {
        const dev = new CiscoDevice(d.id, d.type, d.hostname, d);
        this.sim.registerDevice(dev);
      });
    }

    // Load initial cables
    if (exam.initialTopology && exam.initialTopology.cables) {
      exam.initialTopology.cables.forEach(c => {
        this.sim.addCable(c);
      });
    }

    // Set rubric
    this.gradingEngine.setExam(exam);

    // Update UI headers
    const titleEl = document.getElementById('examTitleLabel');
    if (titleEl) titleEl.innerText = exam.title;

    this.canvasWorkspace.render();
    this.triggerScoreUpdate();
  }

  // --- DEVICE SHELF (BOTTOM DOCK) ---
  initDeviceShelf() {
    const shelfItems = [
      // Network Devices - Routers
      { type: 'router', model: '4331', label: 'Cisco 4331', category: 'routers' },
      { type: 'router', model: '2911', label: 'Cisco 2911', category: 'routers' },
      // Network Devices - Switches
      { type: 'switch', model: '2960-24TT', label: '2960-24TT Switch', category: 'switches' },
      { type: 'switch', model: '3560-24PS', label: '3560 Multilayer', category: 'switches' },
      // Network Devices - Wireless
      { type: 'wireless_ap', model: 'WRT300N', label: 'WRT300N Wireless', category: 'wireless' },
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

  // --- DEVICE MODAL (PHYSICAL / CONFIG / CLI / DESKTOP) ---
  openDeviceModal(device) {
    this.activeDevice = device;
    const modal = document.getElementById('deviceModal');
    if (!modal) return;

    // Header
    document.getElementById('modalDeviceTitle').innerText = `${device.hostname} (${device.model || device.type})`;

    // Show/hide appropriate tabs
    const isHost = (device.type === 'pc' || device.type === 'laptop' || device.type === 'server');
    const cliTabBtn = document.getElementById('tabBtnCli');
    const desktopTabBtn = document.getElementById('tabBtnDesktop');

    if (cliTabBtn) cliTabBtn.style.display = isHost ? 'none' : 'inline-block';
    if (desktopTabBtn) desktopTabBtn.style.display = isHost ? 'inline-block' : 'none';

    // Switch to primary operational tab
    this.switchDeviceModalTab(isHost ? 'desktop' : 'cli');

    modal.style.display = 'flex';
  }

  closeDeviceModal() {
    const modal = document.getElementById('deviceModal');
    if (modal) modal.style.display = 'none';
    this.activeDevice = null;
  }

  switchDeviceModalTab(tabKey) {
    const tabs = ['physical', 'config', 'cli', 'desktop'];
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
          <p class="pt-help-text">Klik op een interface aan de linkerkant om IP, subnetmasker en poortstatus in te stellen.</p>
        </div>
      </div>
    `;
  }

  selectConfigPort(portName) {
    const dev = this.activeDevice;
    const intf = dev.interfaces[portName];
    const editor = document.getElementById('configPortEditor');
    if (!dev || !intf || !editor) return;

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
      this.activeDevice.interfaces[portName].ip = ip.trim();
      this.triggerScoreUpdate();
    }
  }

  updatePortMask(portName, mask) {
    if (this.activeDevice && this.activeDevice.interfaces[portName]) {
      this.activeDevice.interfaces[portName].mask = mask.trim();
      this.triggerScoreUpdate();
    }
  }

  updatePortDesc(portName, desc) {
    if (this.activeDevice && this.activeDevice.interfaces[portName]) {
      this.activeDevice.interfaces[portName].description = desc.trim();
      this.triggerScoreUpdate();
    }
  }

  // 3. CLI TAB (Cisco IOS Monospace Console)
  renderCliTab() {
    const dev = this.activeDevice;
    const container = document.getElementById('modalPaneCli');
    if (!dev || !container) return;

    if (!dev.terminalBuffer) {
      dev.terminalBuffer = `Cisco IOS Software, ${dev.model} Software (X86_64_LINUX_IOSD-UNIVERSALK9-M), Version 15.4(3)M2\nTechnical Support: http://www.cisco.com/techsupport\nCopyright (c) 1986-2026 by Cisco Systems, Inc.\n\n`;
    }

    container.innerHTML = `
      <div class="pt-terminal-wrapper" style="cursor: text;">
        <pre class="pt-terminal-screen" id="cliTerminalScreen"></pre>
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

    screen.textContent = dev.terminalBuffer;
    screen.scrollTop = screen.scrollHeight;

    // Clicking anywhere in the terminal focuses the input
    if (wrapper) {
      wrapper.onclick = () => {
        if (input) input.focus();
      };
    }

    this.activeTerminalParser = new CiscoCLIParser(
      dev,
      (text) => {
        dev.terminalBuffer += `${text}\n`;
        screen.textContent = dev.terminalBuffer;
        screen.scrollTop = screen.scrollHeight;
      },
      () => {
        prompt.innerText = dev.getPrompt();
      },
      () => {
        this.triggerScoreUpdate();
      }
    );

    prompt.innerText = dev.getPrompt();
    setTimeout(() => {
      if (input) input.focus();
    }, 50);

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value;
        const currentPrompt = dev.getPrompt();
        dev.terminalBuffer += `${currentPrompt} ${cmd}\n`;
        screen.textContent = dev.terminalBuffer;
        input.value = '';
        this.activeTerminalParser.handleCommand(cmd);
        prompt.innerText = dev.getPrompt();
        screen.scrollTop = screen.scrollHeight;
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
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const val = input.value.trim();
        if (val === 'en') input.value = 'enable ';
        else if (val === 'conf t' || val === 'config t') input.value = 'configure terminal ';
        else if (val === 'sh run') input.value = 'show running-config ';
        else if (val === 'sh ip int br') input.value = 'show ip interface brief ';
        else if (val === 'copy run start') input.value = 'copy running-config startup-config ';
        else if (val === 'no sh') input.value = 'no shutdown ';
        else if (val.startsWith('int g') || val.startsWith('int gi')) input.value = 'interface GigabitEthernet0/0/0 ';
        else if (val.startsWith('int fa') || val.startsWith('int f')) input.value = 'interface FastEthernet0/1 ';
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
        <div class="pt-desktop-icon" onclick="window.PXLApp.openPcApp('ipconfig')">
          <div class="pt-desktop-app-icon">⚙️</div>
          <span>IP Configuration</span>
        </div>
        ${dev.type === 'laptop' ? `
          <div class="pt-desktop-icon" onclick="window.PXLApp.openPcApp('wireless')">
            <div class="pt-desktop-app-icon">📶</div>
            <span>PC Wireless</span>
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
            <span class="pt-terminal-prompt">C:\\Users\\Student></span>
            <input type="text" class="pt-terminal-input" id="pcCmdInput" autocomplete="off">
          </div>
        </div>
      `;

      const screen = document.getElementById('pcCmdScreen');
      const input = document.getElementById('pcCmdInput');
      const handler = new PCDesktopHandler(dev, (t) => {
        screen.innerHTML += `${t}\n`;
        screen.scrollTop = screen.scrollHeight;
      }, () => this.triggerScoreUpdate());

      input.focus();
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const val = input.value;
          screen.innerHTML += `C:\\Users\\Student> ${val}\n`;
          input.value = '';
          handler.handleCommand(val);
          screen.scrollTop = screen.scrollHeight;
        }
      };
    } else if (appKey === 'wireless') {
      viewport.innerHTML = `
        <div class="pt-app-window">
          <h4>PC Wireless Network Adapter (WPC300N)</h4>
          <p>Status: <strong>${dev.wireless && dev.wireless.associatedAp ? 'Verbonden met ' + dev.wireless.associatedAp : 'Niet verbonden'}</strong></p>
          <div class="pt-form-group">
            <label>Wireless SSID:</label>
            <input type="text" class="pt-input" id="pcWlanSsid" value="${(dev.wireless && dev.wireless.ssid) || ''}">
          </div>
          <div class="pt-form-group">
            <label>WPA2-PSK Wachtwoord:</label>
            <input type="password" class="pt-input" id="pcWlanPass" value="${(dev.wireless && dev.wireless.passphrase) || ''}">
          </div>
          <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.savePcWireless()">Verbinden</button>
        </div>
      `;
    }
  }

  savePcIpConfig() {
    const dev = this.activeDevice;
    if (!dev) return;
    dev.ip = document.getElementById('pcIpInput').value.trim();
    dev.mask = document.getElementById('pcMaskInput').value.trim();
    dev.gateway = document.getElementById('pcGwInput').value.trim();
    dev.dns = document.getElementById('pcDnsInput').value.trim();
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
}

// Bootstrap on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  window.PXLApp = new PXLNetSimApp();
});
