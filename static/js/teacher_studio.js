/**
 * teacher_studio.js - Visual Exam Builder, Rubric Matrix, Student Management & Live Scores
 * Part of PXL Web NetSim (Hogeschool PXL)
 * © Parren, Van Waeyenberg, Frissaer, Jean, Hombroeks
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
    this.allClasses = [];
    this.selectedClassFilter = [];
    this.selectedStudentIds = new Set();
    this.scoresClassFilter = new Set();
    this.activeSubtab = 'users';
    this.scoresRefreshTimer = null;
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
    this.switchTab(this.activeSubtab || 'users');
  }

  closeStudioModal() {
    const modal = document.getElementById('teacherStudioModal');
    if (modal) modal.style.display = 'none';
    if (this.scoresRefreshTimer) {
      clearInterval(this.scoresRefreshTimer);
      this.scoresRefreshTimer = null;
    }
  }

  createStudioModalDom() {
    const modal = document.createElement('div');
    modal.id = 'teacherStudioModal';
    modal.className = 'pt-modal-overlay';
    modal.innerHTML = `
      <div class="pt-studio-dialog" style="width: 1040px; max-width: 96vw; height: 720px; max-height: 92vh; display: flex; flex-direction: column;">
        <div class="pt-studio-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 18px; background: #0f172a; color: #fff;">
          <div class="pt-studio-title" style="display: flex; align-items: center; gap: 10px;">
            <span class="pt-studio-badge" style="background: #0284c7; color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: bold;">PXL TEACHER STUDIO</span>
            <h3 style="margin: 0; font-size: 15px; font-weight: 700;">Docentenportaal • Studenten, Scores & Examenbeheer</h3>
          </div>
          <button class="pt-btn-close" style="color: #fff; font-size: 18px;" onclick="window.PXLApp.teacherStudio.closeStudioModal()">✕</button>
        </div>

        <div class="pt-studio-tabs" style="display: flex; background: #f1f5f9; border-bottom: 2px solid #cbd5e1; padding: 0 10px; overflow-x: auto;">
          <button class="pt-tab-btn active" id="tabBtnUsers" onclick="window.PXLApp.teacherStudio.switchTab('users')">👥 1. Studenten & Klassen</button>
          <button class="pt-tab-btn" id="tabBtnScores" onclick="window.PXLApp.teacherStudio.switchTab('scores')">📊 2. Scores & Voortgang</button>
          <button class="pt-tab-btn" id="tabBtnExamMgmt" onclick="window.PXLApp.teacherStudio.switchTab('exam_mgmt')">⏱️ 3. Testen & Toewijzen</button>
          <button class="pt-tab-btn" id="tabBtnGeneral" onclick="window.PXLApp.teacherStudio.switchTab('general')">⚙️ 4. Examen Ontwerpen</button>
          <button class="pt-tab-btn" id="tabBtnTopology" onclick="window.PXLApp.teacherStudio.switchTab('topology')">📸 5. Topologie Snapshot</button>
          <button class="pt-tab-btn" id="tabBtnRubric" onclick="window.PXLApp.teacherStudio.switchTab('rubric')">⚡ 6. Rubric & PKA</button>
        </div>

        <div class="pt-studio-content" style="flex: 1; overflow-y: auto; padding: 18px; background: #ffffff;">

          <!-- TAB 1: GEBRUIKERS & KLASSEN -->
          <div id="studioTabUsers" class="pt-studio-pane active">
            <!-- Toolbar -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="display: flex; gap: 8px; align-items: center; flex: 1; min-width: 280px;">
                <input type="text" id="usersSearchInput" placeholder="🔍 Zoek op naam, studentnummer of klas..." class="pt-input" style="padding: 6px 10px; font-size: 12px; flex: 1;" oninput="window.PXLApp.teacherStudio.filterUsersTable()">
                <select id="usersClassFilter" class="pt-input" style="padding: 6px 10px; font-size: 12px; width: 140px;" onchange="window.PXLApp.teacherStudio.filterUsersTable()">
                  <option value="">Alle klassen</option>
                </select>
              </div>
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button class="pt-btn pt-btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="window.PXLApp.teacherStudio.openAddStudentModal()">
                  ➕ Student Toevoegen
                </button>
                <button class="pt-btn pt-btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="window.PXLApp.teacherStudio.toggleCsvImportBox()">
                  📥 Blackboard CSV Import
                </button>
                <button class="pt-btn pt-btn-danger" style="padding: 6px 12px; font-size: 12px; background: #ef4444; color: #fff;" onclick="window.PXLApp.teacherStudio.deleteSelectedStudents()">
                  🗑️ Verwijder Selectie
                </button>
              </div>
            </div>

            <!-- Move to Class Action Bar -->
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; background: #eff6ff; padding: 8px 12px; border-radius: 6px; border: 1px solid #bfdbfe;">
              <span style="font-size: 12px; font-weight: 600; color: #1e40af;">📦 Verplaats geselecteerde studenten via dropdown naar klas:</span>
              <select id="userMoveTargetClass" class="pt-input" style="padding: 4px 8px; font-size: 12px; width: 150px;"></select>
              <button class="pt-btn pt-btn-primary" style="padding: 5px 12px; font-size: 12px;" onclick="window.PXLApp.teacherStudio.moveSelectedToClass()">
                Verplaatsen
              </button>
              <span id="selectedCountLabel" style="font-size: 12px; color: #64748b; margin-left: auto;">0 geselecteerd</span>
            </div>

            <!-- Blackboard CSV Collapsible Box -->
            <div id="studioCsvBox" style="display: none; margin-bottom: 16px; background: #f8fafc; border: 1.5px dashed #0284c7; border-radius: 8px; padding: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4 style="margin: 0; font-size: 13px; color: #0369a1;">📥 Blackboard Student Export / CSV Importeren</h4>
                <button class="pt-btn-close" onclick="window.PXLApp.teacherStudio.toggleCsvImportBox()">✕</button>
              </div>
              <p style="font-size: 11px; color: #64748b; margin: 0 0 8px 0;">
                Ondersteunt direct het officiële Blackboard Grade Center CSV-formaat (<code>Achternaam,Voornaam,Gebruikersnaam</code> zoals <code>Abbiusi (2026-27 - GRSNE - 1SNEb),Matteo,12603952</code>) én standaard formaat (<code>username;wachtwoord;volledige_naam;klas</code>).
              </p>
              <textarea id="studioStudentCsv" class="pt-input" style="width: 100%; height: 90px; font-family: monospace; font-size: 11px; box-sizing: border-box;" placeholder="Plak hier je Blackboard CSV-inhoud..."></textarea>
              <div style="display: flex; gap: 10px; margin-top: 8px; align-items: center;">
                <button class="pt-btn pt-btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="window.PXLApp.teacherStudio.importStudentCsv()">
                  🚀 Start Import
                </button>
                <div id="studioCsvResult" style="font-size: 12px;"></div>
              </div>
            </div>

            <!-- Students Table Container -->
            <div id="studioStudentsListContainer" style="max-height: 440px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px;">
              <div style="padding: 30px; text-align: center; color: #64748b;">⏳ Studentenlijst ophalen uit database...</div>
            </div>
          </div>

          <!-- TAB 2: SCORES & VOORTGANG -->
          <div id="studioTabScores" class="pt-studio-pane" style="display: none;">
            <!-- Header Controls -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <label style="font-size: 12px; font-weight: 700; color: #334155;">Examen:</label>
                <select id="scoresExamSelect" class="pt-input" style="padding: 6px 10px; font-size: 12px; min-width: 220px;" onchange="window.PXLApp.teacherStudio.loadScoresTable()"></select>
                <button class="pt-btn pt-btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="window.PXLApp.teacherStudio.loadScoresTable()">
                  🔄 Vernieuwen
                </button>
              </div>
              <div>
                <button class="pt-btn pt-btn-primary" style="padding: 6px 14px; font-size: 12px; background: #059669;" onclick="window.PXLApp.teacherStudio.exportScoresCsv()">
                  📥 Exporteer Scores (CSV / Blackboard / Excel)
                </button>
              </div>
            </div>

            <!-- Multi-Select Class Checklist -->
            <div style="margin-bottom: 14px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: #1e293b;">Selecteer klassen om scores te bekijken (meerdere mogelijk):</span>
                <div style="display: flex; gap: 6px;">
                  <button class="pt-btn pt-btn-sm" style="font-size: 11px; padding: 3px 8px;" onclick="window.PXLApp.teacherStudio.selectAllScoreClasses(true)">✅ Alles Selecteren</button>
                  <button class="pt-btn pt-btn-sm" style="font-size: 11px; padding: 3px 8px;" onclick="window.PXLApp.teacherStudio.selectAllScoreClasses(false)">❌ Geen</button>
                </div>
              </div>
              <div id="scoresClassCheckboxes" style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 80px; overflow-y: auto; padding: 4px 0;">
                <!-- Dynamically populated class checkboxes -->
              </div>
            </div>

            <!-- Scores Table Container -->
            <div id="studioScoresTableContainer" style="max-height: 400px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px;">
              <div style="padding: 30px; text-align: center; color: #64748b;">⏳ Scores laden...</div>
            </div>
          </div>

          <!-- TAB 3: TESTEN BEHEREN & OPENZETTEN & RESET -->
          <div id="studioTabExamMgmt" class="pt-studio-pane" style="display: none;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px;">
              <!-- Assign Exam Box -->
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px;">
                <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #0284c7;">🚀 Test / Examen Openzetten voor Klassen</h4>
                <div class="pt-form-group" style="margin-bottom: 10px;">
                  <label style="font-size: 11px; font-weight: 600;">Kies Examen / Lab:</label>
                  <select id="mgmtAssignExamSelect" class="pt-input" style="width: 100%; font-size: 12px;"></select>
                </div>
                <div class="pt-form-group" style="margin-bottom: 10px;">
                  <label style="font-size: 11px; font-weight: 600;">Tijdslimiet (minuten):</label>
                  <input type="number" id="mgmtAssignTimeLimit" class="pt-input" value="80" min="5" max="360" style="width: 100px; font-size: 12px;">
                </div>
                <div class="pt-form-group" style="margin-bottom: 10px;">
                  <label style="font-size: 11px; font-weight: 600;">Doelgroep Klassen (vink aan):</label>
                  <div id="mgmtClassCheckboxes" style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 90px; overflow-y: auto; border: 1px solid #e2e8f0; padding: 6px; border-radius: 4px; background: #fff;"></div>
                </div>
                <button class="pt-btn pt-btn-primary" style="width: 100%; padding: 8px; font-size: 12px;" onclick="window.PXLApp.teacherStudio.submitExamAssignment()">
                  ✅ Examen Openzetten voor Geselecteerde Klassen
                </button>
              </div>

              <!-- Reset Exam Box -->
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px;">
                <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #b91c1c;">🔄 Examen Resetten (Opnieuw Laten Beginnen)</h4>
                <p style="font-size: 11px; color: #7f1d1d; margin-bottom: 10px;">
                  Selecteer hieronder studenten van wie je de examenvoortgang en scores wilt wissen. De student kan daarna met een schone lei opnieuw beginnen.
                </p>
                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                  <select id="mgmtResetClassSelect" class="pt-input" style="font-size: 12px; flex: 1;" onchange="window.PXLApp.teacherStudio.populateResetStudentsList()">
                    <option value="">Kies klas om studenten te tonen...</option>
                  </select>
                </div>
                <div id="mgmtResetStudentsList" style="max-height: 110px; overflow-y: auto; border: 1px solid #fca5a5; border-radius: 4px; background: #fff; padding: 6px; font-size: 11px; margin-bottom: 10px;">
                  <span style="color: #94a3b8;">Kies eerst een klas hierboven.</span>
                </div>
                <button class="pt-btn pt-btn-danger" style="width: 100%; padding: 8px; font-size: 12px; background: #dc2626; color: #fff;" onclick="window.PXLApp.teacherStudio.resetSelectedStudentsExam()">
                  🗑️ Examen Resetten voor Geselecteerde Studenten
                </button>
              </div>
            </div>

            <!-- Active Assignments List -->
            <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #1e293b;">📋 Actieve Examen Toewijzingen</h4>
            <div id="studioAssignmentsTableContainer" style="max-height: 200px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px;">
              <div style="padding: 15px; text-align: center; color: #64748b;">Toewijzingen laden...</div>
            </div>
          </div>

          <!-- TAB 4: GENERAL EXAM SETTINGS -->
          <div id="studioTabGeneral" class="pt-studio-pane" style="display: none;">
            <div class="pt-form-group">
              <label>Examen Titel:</label>
              <input type="text" id="studioExamTitle" class="pt-input" placeholder="bv. PXL SNE - Examen Netwerken 1: Routing & Switching">
            </div>
            <div class="pt-form-row" style="display: flex; gap: 12px; flex-wrap: wrap;">
              <div class="pt-form-group" style="flex: 1;">
                <label>Standaard Tijdslimiet (minuten):</label>
                <input type="number" id="studioExamTimer" class="pt-input" value="80" min="5" max="300">
              </div>
              <div class="pt-form-group" style="flex: 1;">
                <label>Score Weergave voor Student:</label>
                <select id="studioShowScore" class="pt-input">
                  <option value="true">Live score tonen tijdens examen (Oefenmodus)</option>
                  <option value="false">Score verbergen tot na inlevering (Strikte Examenmodus)</option>
                </select>
              </div>
              <div class="pt-form-group" style="flex: 1;">
                <label>🌐 Echte Internet NAT Gateway:</label>
                <select id="studioLiveInternet" class="pt-input" onchange="window.PXLApp.toggleLiveInternet(this.value === 'true')">
                  <option value="false">❌ Gesimuleerd Internet (Veilig voor examens • Lokale Pagina)</option>
                  <option value="true">✅ Echte Internet Toegang (NAT Bridge via Fysieke Cloud Adapter)</option>
                </select>
              </div>
            </div>
            <div class="pt-form-group">
              <label>Instructies voor Studenten (Markdown / HTML):</label>
              <textarea id="studioExamInstructions" class="pt-textarea" rows="8" placeholder="Beschrijf hier het adresseringsschema en de stappen..."></textarea>
            </div>
          </div>

          <!-- TAB 5: TOPOLOGY SNAPSHOT -->
          <div id="studioTabTopology" class="pt-studio-pane" style="display: none;">
            <p class="pt-help-text" style="font-size: 12px; color: #475569;">
              Gebruik de huidige situatie op het werkveld als startsituatie voor de student, of laat het werkveld leeg zodat de student zelf de volledige bekabeling en topologie moet opbouwen.
            </p>
            <div class="pt-snapshot-actions" style="margin-bottom: 12px; display: flex; gap: 10px;">
              <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.teacherStudio.captureInitialTopology()">
                📸 Sla Huidig Werkveld op als Startsituatie
              </button>
              <button class="pt-btn pt-btn-secondary" onclick="window.PXLApp.teacherStudio.clearInitialTopology()">
                🗑️ Startsituatie Leegmaken (Student bouwt alles zelf)
              </button>
            </div>
            <div id="studioTopologySummary" class="pt-summary-box" style="padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 12px;">
              Geen startsituatie opgeslagen (standaard start).
            </div>
          </div>

          <!-- TAB 6: RUBRIC & PKA IMPORT -->
          <div id="studioTabRubric" class="pt-studio-pane" style="display: none;">
            <div class="pt-rubric-toolbar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div class="pt-total-points-badge" style="font-size: 13px; font-weight: bold; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px;">
                Totaal Punten: <strong id="studioTotalPoints">0</strong> pt
              </div>
              <div class="pt-rubric-actions" style="display: flex; gap: 8px;">
                <button class="pt-btn pt-btn-sm" onclick="window.PXLApp.teacherStudio.autoGenerateRubricFromCanvas()">
                  ⚡ Genereer Rubric uit Werkveld
                </button>
                <button class="pt-btn pt-btn-sm" onclick="window.PXLApp.teacherStudio.addCustomPingCheck()">
                  + Voeg Ping Controle Toe
                </button>
              </div>
            </div>

            <div id="studioRubricList" class="pt-rubric-items-container" style="max-height: 240px; overflow-y: auto; margin-bottom: 16px;"></div>

            <!-- PKA Import Box -->
            <div class="pt-pka-dropzone" style="background: #f8fafc; border: 1.5px dashed #0284c7; border-radius: 8px; padding: 14px;">
              <div style="font-weight: 700; font-size: 13px; color: #0284c7; margin-bottom: 4px;">📦 Importeer een bestaand Cisco Packet Tracer bestand (.PKA / .PKT)</div>
              <p style="font-size: 11px; color: #64748b; margin: 0 0 8px 0;">Upload Packet Tracer v7, v8 of v9.0.1+. De Twofish crypto pipeline decodeert de XML en haalt apparaten en rubric op.</p>
              <div style="display: flex; gap: 10px; align-items: center;">
                <input type="file" id="studioPkaFileInput" accept=".pka,.pkt" class="pt-file-input" style="font-size: 11px;">
                <button class="pt-btn pt-btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="window.PXLApp.teacherStudio.uploadPkaFile()">
                  🚀 Converteer & Laad in NetSim
                </button>
              </div>
              <div id="studioPkaStatus" class="pt-status-msg" style="margin-top: 6px; font-size: 12px;"></div>
            </div>
          </div>

        </div>

        <div class="pt-studio-footer" style="padding: 10px 18px; background: #f8fafc; border-top: 1px solid #cbd5e1; display: flex; justify-content: flex-end; gap: 10px;">
          <button class="pt-btn pt-btn-secondary" onclick="window.PXLApp.teacherStudio.exportExamJson()">
            💾 Download Examen (.json)
          </button>
          <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.teacherStudio.applyExamToSession()">
            ✅ Activeer dit Examen in NetSim
          </button>
        </div>
      </div>

      <!-- Add Student Modal Dialog -->
      <div id="addStudentSubModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1010; align-items: center; justify-content: center;">
        <div style="width: 420px; background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; font-size: 14px;">➕ Nieuwe Student Toevoegen</h4>
            <button class="pt-btn-close" onclick="document.getElementById('addStudentSubModal').style.display = 'none'">✕</button>
          </div>
          <div class="pt-form-group" style="margin-bottom: 8px;">
            <label style="font-size: 11px; font-weight: 600;">Studentnummer / Login (Key):</label>
            <input type="text" id="newStudentUsername" class="pt-input" placeholder="bv. 12603952" style="width: 100%; box-sizing: border-box;">
          </div>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <div style="flex: 1;">
              <label style="font-size: 11px; font-weight: 600;">Voornaam:</label>
              <input type="text" id="newStudentFirst" class="pt-input" placeholder="Matteo" style="width: 100%; box-sizing: border-box;">
            </div>
            <div style="flex: 1;">
              <label style="font-size: 11px; font-weight: 600;">Achternaam:</label>
              <input type="text" id="newStudentLast" class="pt-input" placeholder="Abbiusi" style="width: 100%; box-sizing: border-box;">
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <div style="flex: 1;">
              <label style="font-size: 11px; font-weight: 600;">Richting:</label>
              <input type="text" id="newStudentProgram" class="pt-input" placeholder="GRSNE" value="GRSNE" style="width: 100%; box-sizing: border-box;">
            </div>
            <div style="flex: 1;">
              <label style="font-size: 11px; font-weight: 600;">Klas:</label>
              <input type="text" id="newStudentClass" class="pt-input" placeholder="1SNEb" value="1SNEb" style="width: 100%; box-sizing: border-box;">
            </div>
          </div>
          <div class="pt-form-group" style="margin-bottom: 8px;">
            <label style="font-size: 11px; font-weight: 600;">Academiejaar:</label>
            <input type="text" id="newStudentYear" class="pt-input" value="2026-27" style="width: 100%; box-sizing: border-box;">
          </div>
          <div class="pt-form-group" style="margin-bottom: 14px;">
            <label style="font-size: 11px; font-weight: 600;">Standaard Wachtwoord:</label>
            <input type="text" id="newStudentPassword" class="pt-input" value="PXL2026!" style="width: 100%; box-sizing: border-box;">
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button class="pt-btn pt-btn-secondary" onclick="document.getElementById('addStudentSubModal').style.display = 'none'">Annuleren</button>
            <button class="pt-btn pt-btn-primary" onclick="window.PXLApp.teacherStudio.submitNewStudent()">Student Opslaan</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  switchTab(tabKey) {
    this.activeSubtab = tabKey;
    const tabs = ['users', 'scores', 'exam_mgmt', 'general', 'topology', 'rubric'];
    tabs.forEach(t => {
      const pane = document.getElementById(`studioTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (pane) pane.style.display = (t === tabKey) ? 'block' : 'none';
      const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (btn) btn.classList.toggle('active', t === tabKey);
    });

    if (this.scoresRefreshTimer) {
      clearInterval(this.scoresRefreshTimer);
      this.scoresRefreshTimer = null;
    }

    if (tabKey === 'users') {
      this.loadClassesAndStudents();
    } else if (tabKey === 'scores') {
      this.loadScoresTab();
      // Auto-refresh scores every 10 seconds while on scores tab
      this.scoresRefreshTimer = setInterval(() => this.loadScoresTable(), 10000);
    } else if (tabKey === 'exam_mgmt') {
      this.loadExamMgmtTab();
    }
  }

  // --- TAB 1: USERS & CLASSES ---
  async loadClassesAndStudents() {
    try {
      const res = await fetch('/api/teacher/classes');
      const data = await res.json();
      this.allClasses = data.classes || [];

      // Populate class filter dropdown
      const filterSelect = document.getElementById('usersClassFilter');
      if (filterSelect) {
        const curVal = filterSelect.value;
        filterSelect.innerHTML = `<option value="">Alle klassen (${this.allClasses.length})</option>` +
          this.allClasses.map(c => `<option value="${c}" ${c === curVal ? 'selected' : ''}>${c}</option>`).join('');
      }

      // Populate move target class dropdown
      const moveSelect = document.getElementById('userMoveTargetClass');
      if (moveSelect) {
        moveSelect.innerHTML = this.allClasses.map(c => `<option value="${c}">${c}</option>`).join('');
      }

      await this.loadStudentsTable();
    } catch (e) {
      console.warn('Error loading classes:', e);
    }
  }

  async loadStudentsTable() {
    const container = document.getElementById('studioStudentsListContainer');
    if (!container) return;

    const filterClass = document.getElementById('usersClassFilter')?.value || '';
    const search = document.getElementById('usersSearchInput')?.value || '';

    try {
      const params = new URLSearchParams();
      if (filterClass) params.set('classes', filterClass);
      if (search) params.set('search', search);

      const res = await fetch(`/api/teacher/students?${params.toString()}`);
      const data = await res.json();
      const students = data.students || [];

      if (students.length === 0) {
        container.innerHTML = `<div style="padding: 30px; text-align: center; color: #94a3b8;">Geen studenten gevonden voor deze selectie.</div>`;
        return;
      }

      container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left; position: sticky; top: 0; z-index: 1;">
              <th style="padding: 8px 10px; width: 30px;"><input type="checkbox" id="selectAllStudentsCb" onchange="window.PXLApp.teacherStudio.toggleSelectAllStudents(this.checked)"></th>
              <th style="padding: 8px 10px;">Login / Studentnr</th>
              <th style="padding: 8px 10px;">Achternaam</th>
              <th style="padding: 8px 10px;">Voornaam</th>
              <th style="padding: 8px 10px;">Academiejaar</th>
              <th style="padding: 8px 10px;">Richting</th>
              <th style="padding: 8px 10px;">Klas</th>
              <th style="padding: 8px 10px; text-align: right;">Actie</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => `
              <tr style="border-bottom: 1px solid #e2e8f0; background: ${this.selectedStudentIds.has(s.id) ? '#eff6ff' : '#fff'};">
                <td style="padding: 6px 10px;">
                  <input type="checkbox" class="student-row-cb" value="${s.id}" ${this.selectedStudentIds.has(s.id) ? 'checked' : ''} onchange="window.PXLApp.teacherStudio.toggleStudentSelection(${s.id}, this.checked)">
                </td>
                <td style="padding: 6px 10px; font-weight: 700; font-family: monospace; color: #0f172a;">${s.username}</td>
                <td style="padding: 6px 10px; font-weight: 600;">${s.last_name || s.full_name}</td>
                <td style="padding: 6px 10px;">${s.first_name || '-'}</td>
                <td style="padding: 6px 10px; color: #64748b;">${s.academic_year || '2026-27'}</td>
                <td style="padding: 6px 10px;"><span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">${s.program || '-'}</span></td>
                <td style="padding: 6px 10px;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">${s.class_group || 'Algemeen'}</span></td>
                <td style="padding: 6px 10px; text-align: right;">
                  <button class="pt-btn pt-btn-sm" style="color: #ef4444; border: none; background: transparent; cursor: pointer; font-size: 13px;" title="Verwijder student" onclick="window.PXLApp.teacherStudio.deleteSingleStudent(${s.id}, '${s.username}')">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      this.updateSelectedCount();
    } catch (err) {
      container.innerHTML = `<div style="padding: 20px; color: #ef4444;">Fout bij ophalen van studenten: ${err.message}</div>`;
    }
  }

  filterUsersTable() {
    this.loadStudentsTable();
  }

  toggleSelectAllStudents(checked) {
    const cbs = document.querySelectorAll('.student-row-cb');
    cbs.forEach(cb => {
      cb.checked = checked;
      const id = parseInt(cb.value, 10);
      if (checked) this.selectedStudentIds.add(id);
      else this.selectedStudentIds.delete(id);
    });
    this.updateSelectedCount();
    // Update row highlights
    cbs.forEach(cb => {
      const row = cb.closest('tr');
      if (row) row.style.background = checked ? '#eff6ff' : '#fff';
    });
  }

  toggleStudentSelection(id, checked) {
    if (checked) this.selectedStudentIds.add(id);
    else this.selectedStudentIds.delete(id);
    this.updateSelectedCount();
  }

  updateSelectedCount() {
    const lbl = document.getElementById('selectedCountLabel');
    if (lbl) lbl.innerText = `${this.selectedStudentIds.size} student(en) geselecteerd`;
  }

  async moveSelectedToClass() {
    if (this.selectedStudentIds.size === 0) {
      alert('Selecteer eerst een of meerdere studenten via de selectievakjes.');
      return;
    }
    const targetClass = document.getElementById('userMoveTargetClass')?.value;
    if (!targetClass) return;

    try {
      const res = await fetch('/api/teacher/students/move-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: Array.from(this.selectedStudentIds),
          new_class_group: targetClass
        })
      });
      const data = await res.json();
      if (data.success) {
        this.app.showToast(`✅ ${data.count} student(en) verplaatst naar ${targetClass}`);
        this.selectedStudentIds.clear();
        await this.loadClassesAndStudents();
      } else {
        alert('Fout: ' + (data.error || 'Kon niet verplaatsen'));
      }
    } catch (err) {
      alert('Netwerkfout: ' + err.message);
    }
  }

  async deleteSelectedStudents() {
    if (this.selectedStudentIds.size === 0) {
      alert('Selecteer eerst studenten om te verwijderen.');
      return;
    }
    if (!confirm(`Weet je zeker dat je ${this.selectedStudentIds.size} geselecteerde student(en) wilt verwijderen uit de database?`)) {
      return;
    }

    try {
      const res = await fetch('/api/teacher/student/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: Array.from(this.selectedStudentIds) })
      });
      const data = await res.json();
      if (data.success) {
        this.app.showToast(`🗑️ ${data.count} student(en) verwijderd`);
        this.selectedStudentIds.clear();
        await this.loadStudentsTable();
      }
    } catch (err) {
      alert('Fout bij verwijderen: ' + err.message);
    }
  }

  async deleteSingleStudent(id, username) {
    if (!confirm(`Weet je zeker dat je student '${username}' wilt verwijderen?`)) return;
    try {
      const res = await fetch('/api/teacher/student/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: id })
      });
      const data = await res.json();
      if (data.success) {
        this.selectedStudentIds.delete(id);
        this.app.showToast(`🗑️ Student ${username} verwijderd`);
        await this.loadStudentsTable();
      }
    } catch (err) {
      alert('Fout: ' + err.message);
    }
  }

  openAddStudentModal() {
    const m = document.getElementById('addStudentSubModal');
    if (m) m.style.display = 'flex';
  }

  async submitNewStudent() {
    const uname = document.getElementById('newStudentUsername')?.value.trim();
    const first = document.getElementById('newStudentFirst')?.value.trim();
    const last = document.getElementById('newStudentLast')?.value.trim();
    const program = document.getElementById('newStudentProgram')?.value.trim();
    const classGrp = document.getElementById('newStudentClass')?.value.trim();
    const year = document.getElementById('newStudentYear')?.value.trim() || '2026-27';
    const pwd = document.getElementById('newStudentPassword')?.value.trim() || 'PXL2026!';

    if (!uname) {
      alert('Studentnummer / Login is verplicht!');
      return;
    }

    try {
      const res = await fetch('/api/teacher/student/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: uname,
          first_name: first,
          last_name: last,
          program: program,
          class_group: classGrp,
          academic_year: year,
          password: pwd
        })
      });
      const data = await res.json();
      if (data.success) {
        this.app.showToast(`✅ Student ${uname} succesvol toegevoegd`);
        document.getElementById('addStudentSubModal').style.display = 'none';
        document.getElementById('newStudentUsername').value = '';
        document.getElementById('newStudentFirst').value = '';
        document.getElementById('newStudentLast').value = '';
        await this.loadClassesAndStudents();
      } else {
        alert('Fout: ' + data.error);
      }
    } catch (err) {
      alert('Netwerkfout: ' + err.message);
    }
  }

  toggleCsvImportBox() {
    const box = document.getElementById('studioCsvBox');
    if (box) box.style.display = (box.style.display === 'none') ? 'block' : 'none';
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

    resultBox.innerHTML = `<span style="color: #0284c7;">⏳ Bezig met verwerken en opslaan in database...</span>`;

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
        this.app.showToast(`✅ ${data.created} studenten aangemaakt`);
        await this.loadClassesAndStudents();
      } else {
        resultBox.innerHTML = `<span style="color: #ef4444;">Fout: ${data.error || 'Kon niet importeren'}</span>`;
      }
    } catch (err) {
      resultBox.innerHTML = `<span style="color: #ef4444;">Netwerkfout: ${err.message}</span>`;
    }
  }

  // --- TAB 2: SCORES & LIVE EVALUATION ---
  async loadScoresTab() {
    // Populate exams dropdown
    const examSelect = document.getElementById('scoresExamSelect');
    if (examSelect) {
      const currentExam = this.app.activeExam ? this.app.activeExam.id : '01_pxl_standard';
      const labs = window.PXL_COURSE_LABS || [];
      let opts = `<option value="01_pxl_standard">01_pxl_standard (Standaard Examen)</option>`;
      labs.forEach(l => {
        opts += `<option value="${l.id}" ${l.id === currentExam ? 'selected' : ''}>${l.code || l.id}: ${l.title}</option>`;
      });
      examSelect.innerHTML = opts;
    }

    // Populate class checkboxes for multi-select
    if (this.allClasses.length === 0) {
      const res = await fetch('/api/teacher/classes');
      const data = await res.json();
      this.allClasses = data.classes || [];
    }

    const cbContainer = document.getElementById('scoresClassCheckboxes');
    if (cbContainer) {
      cbContainer.innerHTML = this.allClasses.map(c => `
        <label style="display: inline-flex; align-items: center; gap: 4px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
          <input type="checkbox" class="scores-class-cb" value="${c}" ${this.scoresClassFilter.has(c) ? 'checked' : ''} onchange="window.PXLApp.teacherStudio.toggleScoreClassFilter('${c}', this.checked)">
          <strong>${c}</strong>
        </label>
      `).join('');
    }

    await this.loadScoresTable();
  }

  toggleScoreClassFilter(className, checked) {
    if (checked) this.scoresClassFilter.add(className);
    else this.scoresClassFilter.delete(className);
    this.loadScoresTable();
  }

  selectAllScoreClasses(select) {
    const cbs = document.querySelectorAll('.scores-class-cb');
    cbs.forEach(cb => {
      cb.checked = select;
      if (select) this.scoresClassFilter.add(cb.value);
      else this.scoresClassFilter.delete(cb.value);
    });
    this.loadScoresTable();
  }

  async loadScoresTable() {
    const container = document.getElementById('studioScoresTableContainer');
    if (!container) return;

    const examId = document.getElementById('scoresExamSelect')?.value || '01_pxl_standard';
    const classes = Array.from(this.scoresClassFilter).join(',');

    try {
      const params = new URLSearchParams();
      params.set('exam_id', examId);
      if (classes) params.set('classes', classes);

      const res = await fetch(`/api/teacher/scores?${params.toString()}`);
      const data = await res.json();
      const students = data.scores || [];

      if (students.length === 0) {
        container.innerHTML = `<div style="padding: 30px; text-align: center; color: #94a3b8;">Geen scores gevonden voor deze klassenselectie.</div>`;
        return;
      }

      container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left; position: sticky; top: 0; z-index: 1;">
              <th style="padding: 8px 10px;">Studentnr</th>
              <th style="padding: 8px 10px;">Naam</th>
              <th style="padding: 8px 10px;">Richting</th>
              <th style="padding: 8px 10px;">Klas</th>
              <th style="padding: 8px 10px;">Score (pt)</th>
              <th style="padding: 8px 10px;">Percentage</th>
              <th style="padding: 8px 10px;">Laatste Auto-save (10s)</th>
              <th style="padding: 8px 10px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => {
              const pct = s.percentage || 0;
              const hasActivity = s.last_saved && s.last_saved !== '-';
              const color = pct >= 50 ? '#16a34a' : (pct > 0 ? '#d97706' : '#64748b');
              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 10px; font-weight: 700; font-family: monospace;">${s.username}</td>
                  <td style="padding: 6px 10px; font-weight: 600;">${s.full_name}</td>
                  <td style="padding: 6px 10px; font-size: 11px; color: #475569;">${s.program || '-'}</td>
                  <td style="padding: 6px 10px;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">${s.class_group}</span></td>
                  <td style="padding: 6px 10px; font-weight: 700; color: ${color};">${s.score} / ${s.max_score}</td>
                  <td style="padding: 6px 10px; font-weight: 700; color: ${color};">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span>${pct}%</span>
                      <div style="flex: 1; max-width: 60px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: ${color};"></div>
                      </div>
                    </div>
                  </td>
                  <td style="padding: 6px 10px; color: #64748b; font-size: 11px;">${s.last_saved}</td>
                  <td style="padding: 6px 10px;">
                    ${hasActivity ? '<span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;">Actief</span>' : '<span style="background: #f1f5f9; color: #94a3b8; padding: 2px 6px; border-radius: 4px; font-size: 10px;">Niet gestart</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } catch (e) {
      container.innerHTML = `<div style="padding: 20px; color: #ef4444;">Fout bij laden van scores: ${e.message}</div>`;
    }
  }

  exportScoresCsv() {
    const examId = document.getElementById('scoresExamSelect')?.value || '01_pxl_standard';
    const classes = Array.from(this.scoresClassFilter).join(',');
    const url = `/api/teacher/scores/export?exam_id=${encodeURIComponent(examId)}&classes=${encodeURIComponent(classes)}`;
    window.open(url, '_blank');
  }

  // --- TAB 3: EXAM ASSIGNMENTS, TIME LIMIT & RESET ---
  async loadExamMgmtTab() {
    // Populate exams select
    const examSelect = document.getElementById('mgmtAssignExamSelect');
    if (examSelect) {
      const labs = window.PXL_COURSE_LABS || [];
      let opts = `<option value="01_pxl_standard">01_pxl_standard: Standaard Routing & Switching Lab</option>`;
      labs.forEach(l => {
        opts += `<option value="${l.id}">${l.code || l.id}: ${l.title}</option>`;
      });
      examSelect.innerHTML = opts;
    }

    // Populate target classes checkboxes
    if (this.allClasses.length === 0) {
      const res = await fetch('/api/teacher/classes');
      const data = await res.json();
      this.allClasses = data.classes || [];
    }

    const cbContainer = document.getElementById('mgmtClassCheckboxes');
    if (cbContainer) {
      cbContainer.innerHTML = this.allClasses.map(c => `
        <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer; padding: 2px 6px; background: #f1f5f9; border-radius: 4px;">
          <input type="checkbox" class="mgmt-class-cb" value="${c}">
          <strong>${c}</strong>
        </label>
      `).join('');
    }

    // Populate reset class select
    const resetSelect = document.getElementById('mgmtResetClassSelect');
    if (resetSelect) {
      resetSelect.innerHTML = `<option value="">Kies klas om studenten te tonen...</option>` +
        this.allClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    await this.loadAssignmentsTable();
  }

  async submitExamAssignment() {
    const examId = document.getElementById('mgmtAssignExamSelect')?.value;
    const timeLimit = parseInt(document.getElementById('mgmtAssignTimeLimit')?.value, 10) || 80;
    const selectedClasses = [];
    document.querySelectorAll('.mgmt-class-cb:checked').forEach(cb => selectedClasses.push(cb.value));

    if (selectedClasses.length === 0) {
      alert('Vink minstens één klas aan om dit examen voor open te zetten.');
      return;
    }

    try {
      const res = await fetch('/api/teacher/exam/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_id: examId,
          title: examId,
          target_type: 'class',
          target_values: selectedClasses,
          time_limit_minutes: timeLimit,
          is_active: true
        })
      });
      const data = await res.json();
      if (data.success) {
        this.app.showToast(`✅ Examen ${examId} opengezet voor ${selectedClasses.join(', ')} (${timeLimit} min)`);
        await this.loadAssignmentsTable();
      }
    } catch (err) {
      alert('Fout: ' + err.message);
    }
  }

  async loadAssignmentsTable() {
    const container = document.getElementById('studioAssignmentsTableContainer');
    if (!container) return;

    try {
      const res = await fetch('/api/teacher/exam/assignments');
      const data = await res.json();
      const asgs = data.assignments || [];

      if (asgs.length === 0) {
        container.innerHTML = `<div style="padding: 15px; text-align: center; color: #94a3b8;">Nog geen actieve examen toewijzingen ingesteld.</div>`;
        return;
      }

      container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
              <th style="padding: 6px 10px;">Examen ID</th>
              <th style="padding: 6px 10px;">Doelgroep</th>
              <th style="padding: 6px 10px;">Waarde</th>
              <th style="padding: 6px 10px;">Tijdslimiet</th>
              <th style="padding: 6px 10px;">Status</th>
              <th style="padding: 6px 10px; text-align: right;">Acties</th>
            </tr>
          </thead>
          <tbody>
            ${asgs.map(a => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px 10px; font-weight: 700;">${a.exam_id}</td>
                <td style="padding: 6px 10px;">${a.target_type}</td>
                <td style="padding: 6px 10px;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${a.target_value}</span></td>
                <td style="padding: 6px 10px;">${a.time_limit_minutes} min</td>
                <td style="padding: 6px 10px;">
                  <span style="background: ${a.is_active ? '#dcfce7' : '#fee2e2'}; color: ${a.is_active ? '#15803d' : '#991b1b'}; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                    ${a.is_active ? '✅ Open' : '❌ Gesloten'}
                  </span>
                </td>
                <td style="padding: 6px 10px; text-align: right;">
                  <button class="pt-btn pt-btn-sm" style="font-size: 10px; padding: 2px 6px; margin-right: 4px;" onclick="window.PXLApp.teacherStudio.toggleAssignment(${a.id}, ${a.is_active ? 0 : 1})">
                    ${a.is_active ? 'Sluiten' : 'Openen'}
                  </button>
                  <button class="pt-btn pt-btn-sm" style="color: #ef4444; border: none; background: transparent; cursor: pointer;" onclick="window.PXLApp.teacherStudio.deleteAssignment(${a.id})">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (e) {
      container.innerHTML = `<div style="padding: 10px; color: #ef4444;">Fout: ${e.message}</div>`;
    }
  }

  async toggleAssignment(id, isActive) {
    try {
      await fetch('/api/teacher/exam/assignment/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, is_active: isActive })
      });
      await this.loadAssignmentsTable();
    } catch (e) {}
  }

  async deleteAssignment(id) {
    try {
      await fetch('/api/teacher/exam/assignment/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
      });
      await this.loadAssignmentsTable();
    } catch (e) {}
  }

  async populateResetStudentsList() {
    const classGrp = document.getElementById('mgmtResetClassSelect')?.value;
    const container = document.getElementById('mgmtResetStudentsList');
    if (!container) return;
    if (!classGrp) {
      container.innerHTML = `<span style="color: #94a3b8;">Kies eerst een klas hierboven.</span>`;
      return;
    }

    try {
      const res = await fetch(`/api/teacher/students?classes=${encodeURIComponent(classGrp)}`);
      const data = await res.json();
      const students = data.students || [];

      if (students.length === 0) {
        container.innerHTML = `<span style="color: #94a3b8;">Geen studenten gevonden in deze klas.</span>`;
        return;
      }

      container.innerHTML = `
        <div style="margin-bottom: 4px; display: flex; gap: 6px;">
          <button class="pt-btn pt-btn-sm" style="font-size: 10px;" onclick="document.querySelectorAll('.reset-student-cb').forEach(c => c.checked = true)">Alles Selecteren</button>
          <button class="pt-btn pt-btn-sm" style="font-size: 10px;" onclick="document.querySelectorAll('.reset-student-cb').forEach(c => c.checked = false)">Geen</button>
        </div>
        ${students.map(s => `
          <label style="display: flex; align-items: center; gap: 6px; padding: 2px 0;">
            <input type="checkbox" class="reset-student-cb" value="${s.id}">
            <span><strong>${s.username}</strong> - ${s.full_name} (${s.score} pt)</span>
          </label>
        `).join('')}
      `;
    } catch (e) {
      container.innerHTML = `<span style="color: #ef4444;">Fout: ${e.message}</span>`;
    }
  }

  async resetSelectedStudentsExam() {
    const selectedIds = [];
    document.querySelectorAll('.reset-student-cb:checked').forEach(cb => selectedIds.push(parseInt(cb.value, 10)));

    if (selectedIds.length === 0) {
      alert('Selecteer minstens één student om het examen te resetten.');
      return;
    }

    if (!confirm(`Weet je zeker dat je het examen voor ${selectedIds.length} student(en) wilt resetten? Hun opgeslagen werk en scores worden gewist zodat ze opnieuw kunnen beginnen.`)) {
      return;
    }

    try {
      const res = await fetch('/api/teacher/exam/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: selectedIds })
      });
      const data = await res.json();
      if (data.success) {
        this.app.showToast(`🔄 ${data.message}`);
        await this.populateResetStudentsList();
      }
    } catch (e) {
      alert('Fout bij resetten: ' + e.message);
    }
  }

  // --- TABS 4, 5, 6: EXAM BUILDER, TOPOLOGY & RUBRIC ---
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
      }
    }

    this.examDraft.rubric = newRubric;
    this.renderRubricList();
    this.app.showToast(`⚡ Rubric automatisch gegenereerd (${newRubric.length} regels)`);
  }

  addCustomPingCheck() {
    const id = 'ping_' + Date.now();
    this.examDraft.rubric.push({
      id: id,
      category: 'connectivity',
      title: 'End-to-End Ping Test',
      desc: 'Ping van bron naar doel IP moet slagen',
      points: 8,
      enabled: true,
      checkType: 'ping',
      condition: { fromDevice: 'PC1', targetIp: '192.168.1.1' }
    });
    this.renderRubricList();
  }

  renderRubricList() {
    const container = document.getElementById('studioRubricList');
    if (!container) return;

    const rubric = this.examDraft.rubric || [];
    let totalPoints = 0;

    container.innerHTML = rubric.map((item, idx) => {
      if (item.enabled) totalPoints += parseInt(item.points || 0, 10);
      return `
        <div class="pt-rubric-card" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 6px; background: #fff;">
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 12px;">${item.title}</div>
            <div style="font-size: 11px; color: #64748b;">${item.desc}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="number" value="${item.points}" min="1" max="100" style="width: 45px; padding: 3px; font-size: 11px;" onchange="window.PXLApp.teacherStudio.updateRubricPoints(${idx}, this.value)">
            <span style="font-size: 11px;">pt</span>
            <button class="pt-btn pt-btn-sm" style="color: #ef4444; border: none; background: transparent; cursor: pointer;" onclick="window.PXLApp.teacherStudio.removeRubricItem(${idx})">✕</button>
          </div>
        </div>
      `;
    }).join('');

    const totalEl = document.getElementById('studioTotalPoints');
    if (totalEl) totalEl.innerText = totalPoints;
  }

  updateRubricPoints(index, points) {
    if (this.examDraft.rubric[index]) {
      this.examDraft.rubric[index].points = parseInt(points, 10) || 0;
      this.renderRubricList();
    }
  }

  removeRubricItem(index) {
    this.examDraft.rubric.splice(index, 1);
    this.renderRubricList();
  }

  syncFormDraft() {
    this.examDraft.title = document.getElementById('studioExamTitle')?.value || 'PXL Examen';
    this.examDraft.timeLimitMinutes = parseInt(document.getElementById('studioExamTimer')?.value, 10) || 80;
    this.examDraft.showLiveScore = document.getElementById('studioShowScore')?.value === 'true';
    const liveInetEl = document.getElementById('studioLiveInternet');
    if (liveInetEl) {
      this.examDraft.liveInternet = liveInetEl.value === 'true';
    }
    this.examDraft.instructions = document.getElementById('studioExamInstructions')?.value || '';
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
      statusEl.innerHTML = `<span style="color: #16a34a; font-weight: bold;">✅ Bestand succesvol geconverteerd! Rubric en startsituatie geladen.</span>`;
    } catch (err) {
      statusEl.innerText = `❌ Fout bij converteren: ${err.message}`;
      statusEl.style.color = '#ef4444';
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TeacherStudio };
}
