/**
 * teacher_studio.js - Visual Exam Builder, Rubric Matrix, and PKA Importer
 * Part of PXL Web NetSim (Hogeschool PXL)
 */

class TeacherStudio {
  constructor(app) {
    this.app = app;
    this.examDraft = {
      id: "pxl_custom_exam_" + Date.now(),
      title: "Nieuw Cisco Praktijkexamen",
      timeLimitMinutes: 80,
      showLiveScore: true,
      requireStudentCabling: false,
      instructions: "## Examenopdracht\n\nConfigureer de apparaten volgens het adresseringsschema.",
      initialTopology: { devices: [], cables: [] },
      rubric: []
    };
  }

  openStudioModal() {
    if (!this.app.currentUser || this.app.currentUser.role !== 'teacher') {
      this.app.openLoginModal('teacher');
      this.app.showToast('🔒 Docentenruimte beveiligd: Log in met docentenaccount.');
      return;
    }
    let modal = document.getElementById('teacherStudioModal');
    if (!modal) {
      modal = this.createStudioModalDom();
    }
    this.populateStudioFields();
    modal.style.display = 'flex';
  }

  closeStudioModal() {
    const modal = document.getElementById('teacherStudioModal');
    if (modal) modal.style.display = 'none';
  }

  createStudioModalDom() {
    const modal = document.createElement('div');
    modal.id = 'teacherStudioModal';
    modal.className = 'pt-modal-overlay';
    modal.innerHTML = `
      <div class="pt-studio-dialog">
        <div class="pt-studio-header">
          <div class="pt-studio-title">
            <span class="pt-studio-badge">PXL TEACHER STUDIO</span>
            <h3>Examen & Rubric Builder (CiscoExa NextGen)</h3>
          </div>
          <button class="pt-btn-close" onclick="window.PXLApp.teacherStudio.closeStudioModal()">✕</button>
        </div>

        <div class="pt-studio-tabs">
          <button class="pt-tab-btn active" onclick="window.PXLApp.teacherStudio.switchTab('general')">1. Examen Instellingen</button>
          <button class="pt-tab-btn" onclick="window.PXLApp.teacherStudio.switchTab('topology')">2. Topologie Snapshot</button>
          <button class="pt-tab-btn" onclick="window.PXLApp.teacherStudio.switchTab('rubric')">3. Puntenverdeling & Rubric</button>
          <button class="pt-tab-btn" onclick="window.PXLApp.teacherStudio.switchTab('pka')">4. Packet Tracer (.PKA) Import</button>
          <button class="pt-tab-btn" onclick="window.PXLApp.teacherStudio.switchTab('students')">5. Studenten & CSV Import</button>
        </div>

        <div class="pt-studio-content">
          <!-- TAB 1: General Settings -->
          <div id="studioTabGeneral" class="pt-studio-pane active">
            <div class="pt-form-group">
              <label>Examen Titel:</label>
              <input type="text" id="studioExamTitle" class="pt-input" placeholder="bv. PXL SNE - Examen Netwerken 1: Routing & Switching">
            </div>
            <div class="pt-form-row">
              <div class="pt-form-group">
                <label>Tijdslimiet (minuten):</label>
                <input type="number" id="studioExamTimer" class="pt-input" value="80" min="5" max="300">
              </div>
              <div class="pt-form-group">
                <label>Score Weergave voor Student:</label>
                <select id="studioShowScore" class="pt-input">
                  <option value="true">Live score tonen tijdens examen (Oefenmodus)</option>
                  <option value="false">Score verbergen tot na inlevering (Strikte Examenmodus)</option>
                </select>
              </div>
              <div class="pt-form-group">
                <label>🌐 Echte Internet NAT Gateway (Live WAN Bridge):</label>
                <select id="studioLiveInternet" class="pt-input" onchange="window.PXLApp.toggleLiveInternet(this.value === 'true')">
                  <option value="false">❌ Gesimuleerd Internet (Veilig voor examens • Lokale Pagina)</option>
                  <option value="true">✅ Echte Internet Toegang (NAT Bridge via Fysieke Cloud Adapter)</option>
                </select>
                <small style="color: #64748b; font-size: 11px;">
                  Wanneer actief, wordt 'Het Internet' verbonden met de fysieke adapter van de server (Google Cloud Run / Host). Studenten krijgen dan vanuit de browser en pings daadwerkelijk live internettoegang.
                </small>
              </div>
            </div>
            <div class="pt-form-group">
              <label>Instructies voor Studenten (Markdown / HTML):</label>
              <textarea id="studioExamInstructions" class="pt-textarea" rows="8" placeholder="Beschrijf hier het adresseringsschema en de stappen..."></textarea>
            </div>
          </div>

          <!-- TAB 2: Topology Snapshot -->
          <div id="studioTabTopology" class="pt-studio-pane">
            <p class="pt-help-text">
              Gebruik de huidige situatie op het werkveld als startsituatie voor de student, of laat het werkveld leeg zodat de student zelf de volledige bekabeling en topologie moet opbouwen.
            </p>
            <div class="pt-snapshot-actions">
              <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.teacherStudio.captureInitialTopology()">
                📸 Sla Huidig Werkveld op als Startsituatie
              </button>
              <button class="pt-btn pt-btn-secondary" onclick="window.PXLApp.teacherStudio.clearInitialTopology()">
                🗑️ Startsituatie Leegmaken (Student moet alles zelf plaatsen & bekabelen)
              </button>
            </div>
            <div id="studioTopologySummary" class="pt-summary-box">
              Geen startsituatie opgeslagen (standaard start).
            </div>
          </div>

          <!-- TAB 3: Rubric & Points Matrix -->
          <div id="studioTabRubric" class="pt-studio-pane">
            <div class="pt-rubric-toolbar">
              <div class="pt-total-points-badge">
                Totaal Punten: <strong id="studioTotalPoints">0</strong> pt
              </div>
              <div class="pt-rubric-actions">
                <button class="pt-btn pt-btn-sm" onclick="window.PXLApp.teacherStudio.autoGenerateRubricFromCanvas()">
                  ⚡ Genereer Rubric uit Werkveld
                </button>
                <button class="pt-btn pt-btn-sm" onclick="window.PXLApp.teacherStudio.addCustomPingCheck()">
                  + Voeg Ping Controle Toe
                </button>
              </div>
            </div>

            <div id="studioRubricList" class="pt-rubric-items-container">
              <!-- Dynamically populated rubric items -->
            </div>
          </div>

          <!-- TAB 4: PKA Import -->
          <div id="studioTabPka" class="pt-studio-pane">
            <div class="pt-pka-dropzone">
              <div class="pt-pka-icon">📦</div>
              <h4>Importeer een bestaand Cisco Packet Tracer bestand</h4>
              <p>Upload een <strong>.pka</strong> of <strong>.pkt</strong> bestand (Cisco Packet Tracer v7, v8 of v9.0.1+). De Twofish crypto pipeline decodeert de XML, extraheert de topologie, IP-schema's en evaluatiepunten.</p>
              <input type="file" id="studioPkaFileInput" accept=".pka,.pkt" class="pt-file-input">
              <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.teacherStudio.uploadPkaFile()">
                🚀 Converteer & Laad in NetSim
              </button>
              <div id="studioPkaStatus" class="pt-status-msg"></div>
            </div>
          </div>

          <!-- TAB 5: Students & CSV Import -->
          <div id="studioTabStudents" class="pt-studio-pane">
            <h4>Studenten Accounts & Klaslijsten Beheren</h4>
            <p style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
              Importeer studentenaccounts in bulk via CSV. Studenten kunnen inloggen op de examensite en hun voortgang wordt elke minuut automatisch opgeslagen in de SQLite database.
            </p>
            <div class="pt-form-group">
              <label>CSV Invoer (formaat: <code>username;wachtwoord;volledige_naam;klas</code>):</label>
              <textarea id="studioStudentCsv" class="pt-input" style="height: 90px; font-family: monospace; font-size: 11px;" placeholder="jparren;Welkom2026!;Jonas Parren;1TIN-A&#10;mvwaeyen;Welkom2026!;Max Van Waeyenberg;1TIN-B&#10;sclaes;Welkom2026!;Sam Claes;1TIN-A"></textarea>
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
              <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.teacherStudio.importStudentCsv()">
                📥 Importeer Studentenlijst
              </button>
              <button class="pt-btn pt-btn-secondary" onclick="window.PXLApp.teacherStudio.loadStudentsTable()">
                🔄 Tabel Vernieuwen
              </button>
            </div>
            <div id="studioCsvResult" style="margin-bottom: 12px; font-size: 12px;"></div>
            <h4>Geregistreerde Studenten & Live Examenvoortgang</h4>
            <div id="studioStudentsListContainer" style="max-height: 200px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px;">
              <div style="padding: 20px; text-align: center; color: #94a3b8;">Studenten laden...</div>
            </div>
          </div>
        </div>

        <div class="pt-studio-footer">
          <button class="pt-btn pt-btn-secondary" onclick="window.PXLApp.teacherStudio.exportExamJson()">
            💾 Download Examen (.json)
          </button>
          <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.teacherStudio.applyExamToSession()">
            ✅ Activeer dit Examen in NetSim
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  switchTab(tabKey) {
    const tabs = ['general', 'topology', 'rubric', 'pka', 'students'];
    tabs.forEach(t => {
      const pane = document.getElementById(`studioTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (pane) pane.classList.remove('active');
    });
    const btns = document.querySelectorAll('.pt-studio-tabs .pt-tab-btn');
    btns.forEach(b => b.classList.remove('active'));

    const activePane = document.getElementById(`studioTab${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`);
    if (activePane) activePane.classList.add('active');

    // Highlight button
    const idx = tabs.indexOf(tabKey);
    if (idx >= 0 && btns[idx]) btns[idx].classList.add('active');

    if (tabKey === 'students') {
      this.loadStudentsTable();
    }
  }

  async loadStudentsTable() {
    const container = document.getElementById('studioStudentsListContainer');
    if (!container) return;
    container.innerHTML = `<div style="padding: 20px; text-align: center; color: #64748b;">⏳ Studentenlijst ophalen uit database...</div>`;

    try {
      const examId = this.app.activeExam ? this.app.activeExam.id : '01_pxl_standard';
      const res = await fetch(`/api/teacher/students?exam_id=${examId}`);
      const data = await res.json();
      const students = data.students || [];

      if (students.length === 0) {
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #94a3b8;">Nog geen studenten geregistreerd. Voer hierboven een CSV in.</div>`;
        return;
      }

      container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
              <th style="padding: 8px 12px;">Gebruikersnaam</th>
              <th style="padding: 8px 12px;">Naam</th>
              <th style="padding: 8px 12px;">Klas</th>
              <th style="padding: 8px 12px;">Live Score</th>
              <th style="padding: 8px 12px;">Laatste Auto-save</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: 600; font-family: monospace;">${s.username}</td>
                <td style="padding: 8px 12px;">${s.full_name}</td>
                <td style="padding: 8px 12px;"><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${s.class_group}</span></td>
                <td style="padding: 8px 12px; font-weight: 700; color: ${s.percentage >= 50 ? '#16a34a' : '#d97706'};">
                  ${s.score}/${s.max_score} (${s.percentage}%)
                </td>
                <td style="padding: 8px 12px; color: #64748b; font-size: 11px;">${s.last_saved}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<div style="padding: 20px; color: #ef4444;">Fout bij ophalen van studenten: ${err.message}</div>`;
    }
  }

  async importStudentCsv() {
    const input = document.getElementById('studioStudentCsv');
    const resultBox = document.getElementById('studioCsvResult');
    if (!input || !resultBox) return;

    const csvText = input.value.trim();
    if (!csvText) {
      resultBox.innerHTML = `<span style="color: #ef4444;">Voer eerst CSV-gegevens in.</span>`;
      return;
    }

    resultBox.innerHTML = `<span style="color: #0284c7;">⏳ Bezig met importeren in database...</span>`;

    try {
      const res = await fetch('/api/teacher/import-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_text: csvText })
      });
      const data = await res.json();

      if (data.success) {
        resultBox.innerHTML = `<span style="color: #16a34a; font-weight: 600;">✅ ${data.message}</span>`;
        input.value = '';
        this.loadStudentsTable();
        this.app.showToast(`✅ ${data.created} studenten accounts aangemaakt`);
      } else {
        resultBox.innerHTML = `<span style="color: #ef4444;">Fout: ${data.error || 'Kon niet importeren'}</span>`;
      }
    } catch (err) {
      resultBox.innerHTML = `<span style="color: #ef4444;">Netwerkfout: ${err.message}</span>`;
    }
  }

  populateStudioFields() {
    const draft = this.examDraft || this.app.activeExam || {};
    const titleEl = document.getElementById('studioExamTitle');
    const timerEl = document.getElementById('studioExamTimer');
    const scoreEl = document.getElementById('studioShowScore');
    const instrEl = document.getElementById('studioExamInstructions');

    if (titleEl) titleEl.value = draft.title || '';
    if (timerEl) timerEl.value = draft.timeLimitMinutes || 80;
    if (scoreEl) scoreEl.value = draft.showLiveScore !== false ? 'true' : 'false';
    const liveInetEl = document.getElementById('studioLiveInternet');
    if (liveInetEl) {
      if (typeof draft.liveInternet === 'boolean') {
        liveInetEl.value = draft.liveInternet ? 'true' : 'false';
      } else if (window.PXLApp && window.PXLApp.sim) {
        liveInetEl.value = window.PXLApp.sim.liveInternetEnabled ? 'true' : 'false';
      }
    }
    if (instrEl) instrEl.value = draft.instructions || '';

    const topo = draft.initialTopology || draft.topology || { devices: [], cables: [] };
    const numDevs = (topo.devices || []).length;
    const numCables = (topo.cables || []).length;
    const summary = document.getElementById('studioTopologySummary');
    if (summary && numDevs > 0) {
      summary.innerHTML = `<strong>Startsituatie:</strong> ${numDevs} apparaten en ${numCables} kabels vastgelegd.`;
      summary.style.borderColor = '#22c55e';
    }

    this.renderRubricList();
  }

  captureInitialTopology() {
    const sim = window.PXLNetworkSim;
    if (!sim) return;

    const devices = Object.values(sim.devices).map(d => ({
      id: d.id,
      type: d.type,
      model: d.model,
      hostname: d.hostname,
      x: d.x,
      y: d.y,
      powerOn: d.powerOn
    }));

    const cables = JSON.parse(JSON.stringify(sim.cables));

    this.examDraft.initialTopology = { devices, cables };
    const summary = document.getElementById('studioTopologySummary');
    if (summary) {
      summary.innerHTML = `<strong>Opgeslagen Startsituatie:</strong> ${devices.length} apparaten en ${cables.length} kabels vastgelegd.`;
      summary.style.borderColor = '#22c55e';
    }
  }

  clearInitialTopology() {
    this.examDraft.initialTopology = { devices: [], cables: [] };
    const summary = document.getElementById('studioTopologySummary');
    if (summary) {
      summary.innerHTML = `<strong>Startsituatie:</strong> Werkveld is leeg. Studenten moeten alle apparaten zelf plaatsen en bekabelen.`;
      summary.style.borderColor = '#38bdf8';
    }
  }

  autoGenerateRubricFromCanvas() {
    const sim = window.PXLNetworkSim;
    if (!sim) return;

    const newRubric = [];

    // 1. Cabling
    sim.cables.forEach((c, idx) => {
      newRubric.push({
        id: `cable_${idx + 1}`,
        category: 'cabling',
        title: `Bekabeling: ${c.fromDevice} (${c.fromPort}) naar ${c.toDevice} (${c.toPort})`,
        desc: `Verbind ${c.fromDevice} met ${c.toDevice} via ${c.type} kabel`,
        points: 4,
        enabled: true,
        checkType: 'cabling',
        condition: {
          fromDevice: c.fromDevice,
          fromPort: c.fromPort,
          toDevice: c.toDevice,
          toPort: c.toPort,
          cableType: c.type
        }
      });
    });

    // 2. Devices
    for (const dev of Object.values(sim.devices)) {
      if (dev.type === 'router' || dev.type === 'switch') {
        // Hostname
        newRubric.push({
          id: `hostname_${dev.id}`,
          category: 'hostname',
          title: `Hostname op ${dev.id}`,
          desc: `Stel de juiste naam in op ${dev.id}`,
          points: 3,
          enabled: true,
          checkType: 'hostname',
          condition: { targetDevice: dev.id, expected: dev.hostname }
        });

        // Passwords & security
        if (dev.enableSecret) {
          newRubric.push({
            id: `sec_${dev.id}`,
            category: 'security',
            title: `Enable secret op ${dev.id}`,
            desc: `Configureer het gehashte privilege exec wachtwoord`,
            points: 4,
            enabled: true,
            checkType: 'enable_secret',
            condition: { targetDevice: dev.id }
          });
        }

        // Interfaces
        for (const [pName, intf] of Object.entries(dev.interfaces)) {
          if (intf.ip && intf.mask) {
            newRubric.push({
              id: `intf_${dev.id}_${pName.replace(/\//g, '_')}`,
              category: 'interface_ip',
              title: `IP configuratie op ${dev.hostname} (${pName})`,
              desc: `IP: ${intf.ip} / ${intf.mask}, niet shutdown`,
              points: 5,
              enabled: true,
              checkType: 'interface_ip',
              condition: {
                deviceId: dev.id,
                portName: pName,
                expectedIp: intf.ip,
                expectedMask: intf.mask,
                checkNoShutdown: true
              }
            });
          }
        }

        // Static routes
        if (dev.type === 'router' && dev.staticRoutes && dev.staticRoutes.length > 0) {
          dev.staticRoutes.forEach((r, rIdx) => {
            newRubric.push({
              id: `route_${dev.id}_${rIdx}`,
              category: 'routing',
              title: `Statische route op ${dev.hostname} naar ${r.network}`,
              desc: `Route naar ${r.network}/${r.mask} via ${r.nextHop || r.interface}`,
              points: 6,
              enabled: true,
              checkType: 'static_route',
              condition: {
                routerId: dev.id,
                network: r.network,
                mask: r.mask,
                nextHop: r.nextHop || r.interface
              }
            });
          });
        }

        // Saved config
        newRubric.push({
          id: `save_${dev.id}`,
          category: 'saving',
          title: `Configuratie opslaan op ${dev.hostname}`,
          desc: `Sla de running-config op met 'copy run start'`,
          points: 2,
          enabled: true,
          checkType: 'copy_run_start',
          condition: { targetDevice: dev.id }
        });
      }
    }

    this.examDraft.rubric = newRubric;
    this.renderRubricList();
  }

  addCustomPingCheck() {
    const sim = window.PXLNetworkSim;
    const devs = Object.values(sim.devices);
    const srcId = devs[0] ? devs[0].id : 'PCA';
    const targetIp = '10.11.12.5';

    const item = {
      id: `ping_${Date.now()}`,
      category: 'connectivity',
      title: `End-to-end ping van ${srcId} naar ${targetIp}`,
      desc: `Verifieer dat ${srcId} succesvol kan pingen naar ${targetIp}`,
      points: 8,
      enabled: true,
      checkType: 'ping_test',
      condition: { fromDevice: srcId, targetIp: targetIp }
    };

    if (!this.examDraft.rubric) this.examDraft.rubric = [];
    this.examDraft.rubric.push(item);
    this.renderRubricList();
  }

  renderRubricList() {
    const container = document.getElementById('studioRubricList');
    if (!container) return;

    container.innerHTML = '';
    const rubric = this.examDraft.rubric || [];
    let totalPoints = 0;

    rubric.forEach((item, index) => {
      if (item.enabled) totalPoints += (item.points || 0);

      const row = document.createElement('div');
      row.className = `pt-rubric-card ${item.enabled ? 'active' : 'disabled'}`;
      row.innerHTML = `
        <div class="pt-rubric-check">
          <input type="checkbox" ${item.enabled ? 'checked' : ''} onchange="window.PXLApp.teacherStudio.toggleRubricItem(${index})">
        </div>
        <div class="pt-rubric-info">
          <input type="text" class="pt-rubric-title-input" value="${item.title}" onchange="window.PXLApp.teacherStudio.updateRubricTitle(${index}, this.value)">
          <div class="pt-rubric-desc">${item.desc || ''}</div>
        </div>
        <div class="pt-rubric-pts">
          <input type="number" class="pt-rubric-points-input" value="${item.points || 5}" min="1" max="50" onchange="window.PXLApp.teacherStudio.updateRubricPoints(${index}, this.value)"> pt
        </div>
        <button class="pt-btn-del" onclick="window.PXLApp.teacherStudio.deleteRubricItem(${index})">🗑️</button>
      `;
      container.appendChild(row);
    });

    const totalEl = document.getElementById('studioTotalPoints');
    if (totalEl) totalEl.innerText = totalPoints;
  }

  toggleRubricItem(index) {
    if (this.examDraft.rubric[index]) {
      this.examDraft.rubric[index].enabled = !this.examDraft.rubric[index].enabled;
      this.renderRubricList();
    }
  }

  updateRubricTitle(index, val) {
    if (this.examDraft.rubric[index]) {
      this.examDraft.rubric[index].title = val;
    }
  }

  updateRubricPoints(index, val) {
    if (this.examDraft.rubric[index]) {
      this.examDraft.rubric[index].points = parseInt(val, 10) || 0;
      this.renderRubricList();
    }
  }

  deleteRubricItem(index) {
    this.examDraft.rubric.splice(index, 1);
    this.renderRubricList();
  }

  exportExamJson() {
    this.syncFormDraft();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.examDraft, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    const safeTitle = this.examDraft.title.replace(/[^a-zA-Z0-9]/g, '_');
    dlAnchorElem.setAttribute("download", `${safeTitle}_Examen.json`);
    dlAnchorElem.click();
  }

  syncFormDraft() {
    this.examDraft.title = document.getElementById('studioExamTitle').value || 'PXL Examen';
    this.examDraft.timeLimitMinutes = parseInt(document.getElementById('studioExamTimer').value, 10) || 80;
    this.examDraft.showLiveScore = document.getElementById('studioShowScore').value === 'true';
    const liveInetEl = document.getElementById('studioLiveInternet');
    if (liveInetEl) {
      this.examDraft.liveInternet = liveInetEl.value === 'true';
    }
    this.examDraft.instructions = document.getElementById('studioExamInstructions').value || '';
  }

  applyExamToSession() {
    this.syncFormDraft();
    if (typeof this.examDraft.liveInternet === 'boolean' && window.PXLApp && window.PXLApp.toggleLiveInternet) {
      window.PXLApp.toggleLiveInternet(this.examDraft.liveInternet);
    }
    this.app.loadExam(this.examDraft);
    this.closeStudioModal();
    this.app.showToast('✅ Examen en rubric succesvol geactiveerd in de sessie!');
  }

  async uploadPkaFile() {
    const fileInput = document.getElementById('studioPkaFileInput');
    const statusEl = document.getElementById('studioPkaStatus');
    if (!fileInput.files || fileInput.files.length === 0) {
      statusEl.innerText = '⚠️ Selecteer eerst een .pka of .pkt bestand.';
      statusEl.style.color = '#f59e0b';
      return;
    }

    const file = fileInput.files[0];
    statusEl.innerText = `Decoderen van ${file.name} met Twofish crypto...`;
    statusEl.style.color = '#38bdf8';

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/convert-pka', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        throw new Error(`Server fout (${response.status})`);
      }
      const examData = await response.json();
      this.examDraft = examData;
      if (!this.examDraft.initialTopology && examData.topology) {
        this.examDraft.initialTopology = examData.topology;
      }
      this.populateStudioFields();

      const devs = examData.initialTopology?.devices || [];
      const cables = examData.initialTopology?.cables || [];
      const devNames = devs.map(d => d.name || d.id).join(', ');

      statusEl.innerHTML = `
        <div style="margin-top: 12px; padding: 14px; background: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 8px; text-align: left;">
          <div style="font-weight: 700; color: #15803d; font-size: 14px; margin-bottom: 6px;">
            ✅ Succesvol Geconverteerd uit Packet Tracer!
          </div>
          <div style="font-size: 12px; color: #334155; line-height: 1.6;">
            • <strong>${devs.length} Apparaten:</strong> ${devNames || 'Geen'}<br>
            • <strong>${cables.length} Bekabelde Verbindingen:</strong> hersteld tussen poorten<br>
            • <strong>${examData.rubric.length} Beoordelingscriteria:</strong> live geëxtraheerd uit Answer Tree
          </div>
          <button class="pt-btn pt-btn-primary" style="margin-top: 10px; width: 100%; font-weight: 700; font-size: 13px; padding: 8px;" onclick="window.PXLApp.teacherStudio.applyExamToSession()">
            🚀 Nu Toepassen & Direct Laden op Werkveld
          </button>
        </div>
      `;
    } catch (err) {
      statusEl.innerText = `❌ Fout bij converteren: ${err.message}. (Draait de backend server?)`;
      statusEl.style.color = '#ef4444';
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TeacherStudio };
}

