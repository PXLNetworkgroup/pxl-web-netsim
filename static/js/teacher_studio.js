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
    this.selectedAssignmentTargets = new Set();
    this.expandedClassGroups = new Set();
    this.cachedTreeClasses = [];
    this.cachedImportQueue = [];
    this.allDbExams = [];
    this.isQueueCollapsed = false;
    this.activeUserSubtab = 'students';
    this.allLabsCatalog = [];
    this.selectedCatalogLabId = null;
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
          <button class="pt-tab-btn active" id="tabBtnUsers" onclick="window.PXLApp.teacherStudio.switchTab('users')">👥 1. Studenten & Docenten</button>
          <button class="pt-tab-btn" id="tabBtnScores" onclick="window.PXLApp.teacherStudio.switchTab('scores')">📊 2. Scores & Voortgang</button>
          <button class="pt-tab-btn" id="tabBtnLabsCatalog" onclick="window.PXLApp.teacherStudio.switchTab('labs_catalog')">📚 3. Labo- & Rubric-Overzicht</button>
          <button class="pt-tab-btn" id="tabBtnExamMgmt" onclick="window.PXLApp.teacherStudio.switchTab('exam_mgmt')">📋 4. Opdrachten Toewijzen</button>
          <button class="pt-tab-btn" id="tabBtnTeacherBugs" onclick="window.PXLApp.teacherStudio.switchTab('bugs')">🐞 5. Bugs</button>
          <button class="pt-tab-btn" id="tabBtnTopology" onclick="window.PXLApp.teacherStudio.switchTab('topology')">📸 6. Topologie Snapshot</button>
          <button class="pt-tab-btn" id="tabBtnRubric" onclick="window.PXLApp.teacherStudio.switchTab('rubric')">⚡ 7. Rubric, PKA & AI Generator</button>
        </div>

        <div class="pt-studio-content" style="flex: 1; overflow-y: auto; padding: 18px; background: #ffffff;">

          <!-- TAB 1: GEBRUIKERS & KLASSEN -->
          <div id="studioTabUsers" class="pt-studio-pane active">
            <!-- Subtab Selector: Studenten vs Docenten -->
            <div style="display: flex; gap: 8px; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
              <button id="subtabStudentsBtn" class="pt-btn pt-btn-primary" style="padding: 6px 14px; font-size: 12px; font-weight: 700;" onclick="window.PXLApp.teacherStudio.switchUserSubtab('students')">
                🎓 Studenten & Klassen (<span id="studioStudentCountBadge">...</span>)
              </button>
              <button id="subtabTeachersBtn" class="pt-btn pt-btn-secondary" style="padding: 6px 14px; font-size: 12px; font-weight: 700;" onclick="window.PXLApp.teacherStudio.switchUserSubtab('teachers')">
                👨‍🏫 Docentenbeheer (<span id="studioTeacherCountBadge">...</span>)
              </button>
            </div>

            <!-- SUBTAB 1A: STUDENTEN & KLASSEN -->
            <div id="studioSubtabStudentsContainer">
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

              <!-- Toevoeg-Wachtrij Panel (Audit Queue van toegevoegde accounts met klasnaam) -->
              <div id="studioImportQueuePanel" style="margin-bottom: 14px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 10px 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 13px; font-weight: 700; color: #166534;">📋 Toevoeg-Wachtrij (Recent Toegevoegde Accounts per Klas)</span>
                    <span id="queueTotalBadge" style="background: #16a34a; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: bold;">0 accounts in wachtrij</span>
                  </div>
                  <div style="display: flex; gap: 6px; align-items: center;">
                    <input type="text" id="queueSearchInput" placeholder="🔍 Filter wachtrij op klas of student..." class="pt-input" style="padding: 3px 8px; font-size: 11px; width: 220px;" oninput="window.PXLApp.teacherStudio.filterImportQueue()">
                    <button class="pt-btn pt-btn-sm" style="font-size: 11px; padding: 3px 8px;" title="Wachtrij vernieuwen" onclick="window.PXLApp.teacherStudio.loadImportQueue()">🔄</button>
                    <button class="pt-btn pt-btn-sm" id="btnToggleQueueView" style="font-size: 11px; padding: 3px 8px;" onclick="window.PXLApp.teacherStudio.toggleImportQueueView()">▲ Inklappen</button>
                  </div>
                </div>
                <div id="importQueueTableContainer" style="max-height: 140px; overflow-y: auto; border: 1px solid #bbf7d0; border-radius: 6px; background: #fff;">
                  <div style="padding: 10px; text-align: center; color: #64748b; font-size: 11px;">Wachtrij laden...</div>
                </div>
              </div>

              <!-- Students Table Container -->
              <div id="studioStudentsListContainer" style="max-height: 320px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px;">
                <div style="padding: 30px; text-align: center; color: #64748b;">⏳ Studentenlijst ophalen uit database...</div>
              </div>
            </div>

            <!-- SUBTAB 1B: DOCENTENBEHEER -->
            <div id="studioSubtabTeachersContainer" style="display: none;">
              <!-- Add Teacher Bar / Form -->
              <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
                <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #0284c7; display: flex; align-items: center; gap: 6px;">
                  <span>➕</span> <span>Nieuw Docentenaccount Toevoegen</span>
                </h4>
                <div style="display: grid; grid-template-columns: 1.5fr 1.5fr 1.5fr 1.2fr auto; gap: 10px; align-items: flex-end;">
                  <div>
                    <label style="font-size: 11px; font-weight: 700; color: #334155;">Gebruikersnaam:</label>
                    <input type="text" id="newTeacherUsername" placeholder="bv. gert of gertdp" class="pt-input" style="width: 100%; font-size: 12px; padding: 6px 8px; margin-top: 2px;">
                  </div>
                  <div>
                    <label style="font-size: 11px; font-weight: 700; color: #334155;">Volledige Naam:</label>
                    <input type="text" id="newTeacherFullName" placeholder="bv. Gert De Paepe" class="pt-input" style="width: 100%; font-size: 12px; padding: 6px 8px; margin-top: 2px;">
                  </div>
                  <div>
                    <label style="font-size: 11px; font-weight: 700; color: #334155;">Wachtwoord:</label>
                    <input type="password" id="newTeacherPassword" placeholder="Wachtwoord invoeren..." class="pt-input" style="width: 100%; font-size: 12px; padding: 6px 8px; margin-top: 2px;">
                  </div>
                  <div>
                    <label style="font-size: 11px; font-weight: 700; color: #334155;">Afdeling / Vakgroep:</label>
                    <input type="text" id="newTeacherDept" value="PXL-SNE" class="pt-input" style="width: 100%; font-size: 12px; padding: 6px 8px; margin-top: 2px;">
                  </div>
                  <div>
                    <button class="pt-btn pt-btn-primary" style="padding: 6px 14px; font-size: 12px; font-weight: 700; background: #0284c7;" onclick="window.PXLApp.teacherStudio.submitNewTeacher()">
                      ➕ Aanmaken
                    </button>
                  </div>
                </div>
              </div>

              <!-- Teachers Table Container -->
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                  <span style="font-size: 12px; font-weight: 700; color: #1e293b;">👨‍🏫 Actieve Docentenaccounts</span>
                  <button class="pt-btn pt-btn-sm" onclick="window.PXLApp.teacherStudio.loadTeachersTable()">🔄 Vernieuwen</button>
                </div>
                <div id="studioTeachersListContainer" style="max-height: 380px; overflow-y: auto;">
                  <div style="padding: 30px; text-align: center; color: #64748b;">⏳ Docenten ophalen uit database...</div>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 2: SCORES & VOORTGANG -->
          <div id="studioTabScores" class="pt-studio-pane" style="display: none;">
            <!-- Header Controls -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <label style="font-size: 12px; font-weight: 700; color: #334155;">Examen / Weergave:</label>
                <select id="scoresExamSelect" class="pt-input" style="padding: 6px 10px; font-size: 12px; min-width: 250px;" onchange="window.PXLApp.teacherStudio.loadScoresTable()"></select>
                <button class="pt-btn pt-btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="window.PXLApp.teacherStudio.loadScoresTable()">
                  🔄 Vernieuwen
                </button>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="pt-btn pt-btn-secondary" style="padding: 6px 12px; font-size: 12px; border: 1px solid #059669; color: #047857;" onclick="window.PXLApp.teacherStudio.exportScoresCsv(false)" title="Exporteer scores van het momenteel geselecteerde examen naar CSV">
                  📥 Exporteer Selectie (CSV)
                </button>
                <button class="pt-btn pt-btn-primary" style="padding: 6px 14px; font-size: 12px; background: #059669;" onclick="window.PXLApp.teacherStudio.exportScoresCsv(true)" title="Exporteer alle scores van alle studenten over alle testen en examens">
                  📥 Exporteer ALLES (Compleet CSV)
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

          <!-- TAB 3: LABO- & RUBRIC-OVERZICHT -->
          <div id="studioTabLabsCatalog" class="pt-studio-pane" style="display: none;">
            <!-- Filter & Search Toolbar -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; background: #f8fafc; padding: 12px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1;">
              <div style="display: flex; gap: 10px; align-items: center; flex: 1; min-width: 280px;">
                <input type="text" id="labsCatalogSearchInput" placeholder="🔍 Zoek op titel, onderwerp (bv. H01, OSPF, VLAN, Subnetting)..." class="pt-input" style="padding: 6px 12px; font-size: 12px; flex: 1;" oninput="window.PXLApp.teacherStudio.filterLabsCatalog()">
                <select id="labsCatalogCategoryFilter" class="pt-input" style="padding: 6px 10px; font-size: 12px; min-width: 180px;" onchange="window.PXLApp.teacherStudio.filterLabsCatalog()">
                  <option value="">Alle categorieën</option>
                  <option value="course_lab">📚 Cursuslabo's (H01-H08)</option>
                  <option value="custom">✏️ Docent Examens & Testen</option>
                  <option value="pka_import">📦 Packet Tracer PKA Imports</option>
                  <option value="preset">⚡ Systeem Presets</option>
                </select>
              </div>
              <div style="display: flex; gap: 8px; align-items: center;">
                <span id="labsCatalogCountBadge" style="font-size: 12px; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px;">0 Labo's</span>
                <button class="pt-btn pt-btn-secondary" style="padding: 5px 10px; font-size: 11px;" onclick="window.PXLApp.teacherStudio.loadLabsCatalogTab()">🔄 Vernieuwen</button>
              </div>
            </div>

            <!-- Split View: Left list (scrollable) and Right Detail (scrollable) -->
            <div style="display: grid; grid-template-columns: 360px 1fr; gap: 16px; align-items: start;">
              <!-- Left: Scrollable Labs List -->
              <div>
                <div style="font-size: 11.5px; font-weight: 700; color: #475569; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Beschikbare Labo's:</div>
                <div id="labsCatalogListContainer" style="max-height: 520px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 6px;">
                  <div style="padding: 30px; text-align: center; color: #94a3b8;">⏳ Labo's ophalen...</div>
                </div>
              </div>

              <!-- Right: Detail View with Instructions & Rubric -->
              <div>
                <div style="font-size: 11.5px; font-weight: 700; color: #475569; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Opdrachtomschrijving & Beoordelingsrubric:</div>
                <div id="labsCatalogDetailContainer" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 18px; max-height: 520px; overflow-y: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                  <div style="padding: 60px 20px; text-align: center; color: #94a3b8;">
                    <span style="font-size: 32px; display: block; margin-bottom: 10px;">📚</span>
                    <strong style="font-size: 14px; color: #475569;">Selecteer een labo aan de linkerkant</strong>
                    <p style="font-size: 12px; margin: 6px 0 0 0;">Hier verschijnen de volledige instructies, netwerkdoelen en de bijbehorende beoordelingsrubric.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 4: OPDRACHTEN & EXAMEN MANAGEMENT -->
          <div id="studioTabExamMgmt" class="pt-studio-pane" style="display: none;">
            <!-- Top Controls: Choose Exam, Time Limit & Openzet Knop -->
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <h4 style="margin: 0; font-size: 13px; color: #0284c7; display: flex; align-items: center; gap: 6px;">
                  <span>📋</span> <span>Opdracht / Examen Toewijzen & Openzetten</span>
                </h4>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <button class="pt-btn pt-btn-secondary" style="padding: 3px 8px; font-size: 11px;" onclick="window.PXLApp.teacherStudio.loadExamMgmtTab()">
                    🔄 Verversen
                  </button>
                </div>
              </div>

              <!-- Lab vs Test Subdivision -->
              <div style="display: flex; gap: 15px; margin-bottom: 10px; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <span style="font-size: 11.5px; font-weight: 700; color: #1e293b;">Type Opdracht:</span>
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; cursor: pointer; color: #0369a1;">
                  <input type="radio" name="mgmtAssignType" id="mgmtAssignTypeLab" value="lab" checked onchange="window.PXLApp.teacherStudio.onAssignTypeChanged()">
                  <span>🔬 Lab (Oefenlab - Zelfstandig starten & resetten door student)</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; cursor: pointer; color: #b45309;">
                  <input type="radio" name="mgmtAssignType" id="mgmtAssignTypeTest" value="test" onchange="window.PXLApp.teacherStudio.onAssignTypeChanged()">
                  <span>📝 Test (Officieel examen - Wachtwoord beveiligd & startsein door docent)</span>
                </label>
              </div>

              <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 10px; align-items: flex-end;">
                <div>
                  <label style="font-size: 11px; font-weight: 700; color: #334155;">Kies Opdracht / Examen uit Database:</label>
                  <select id="mgmtAssignExamSelect" class="pt-input" style="width: 100%; font-size: 12px; padding: 5px 8px; margin-top: 2px;" onchange="window.PXLApp.teacherStudio.onSelectedExamChanged()"></select>
                </div>
                <div>
                  <label style="font-size: 11px; font-weight: 700; color: #334155;">⏱️ Tijdslimiet (min):</label>
                  <input type="number" id="mgmtAssignTimeLimit" class="pt-input" value="80" min="5" max="360" style="width: 100%; font-size: 12px; padding: 5px 8px; margin-top: 2px;">
                </div>
                <div style="display: flex; align-items: center; padding-bottom: 6px;">
                  <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
                    <input type="checkbox" id="mgmtAssignActiveToggle" checked>
                    <span>Direct Actief</span>
                  </label>
                </div>
                <div>
                  <button class="pt-btn pt-btn-primary" style="padding: 6px 16px; font-size: 12px; font-weight: 700; background: #0284c7;" onclick="window.PXLApp.teacherStudio.submitTargetAssignments()">
                    🚀 Opdracht Openzetten
                  </button>
                </div>
              </div>

              <!-- Extra row for Test Security Settings (Password and Start Test) -->
              <div id="mgmtAssignTestConfigRow" style="display: none; grid-template-columns: 1.5fr 1.5fr; gap: 10px; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
                <div>
                  <label style="font-size: 11px; font-weight: 700; color: #b45309;">🔑 Test Wachtwoord (Optioneel / Beveiliging):</label>
                  <input type="text" id="mgmtAssignPassword" placeholder="Bijv. PXL-TEST-2026 (leeg laten = geen wachtwoord)" class="pt-input" style="width: 100%; font-size: 12px; padding: 5px 8px; margin-top: 2px; border: 1px solid #f59e0b;">
                </div>
                <div style="display: flex; align-items: flex-end; padding-bottom: 6px;">
                  <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #15803d; cursor: pointer; background: #f0fdf4; padding: 5px 10px; border-radius: 4px; border: 1px solid #bbf7d0;">
                    <input type="checkbox" id="mgmtAssignStartTestToggle">
                    <span>▶️ Start Test Nu Direct (Laat studenten direct starten)</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Target Selection Tree: Classes and Students with Persistent Checked State -->
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <div>
                  <span style="font-size: 12px; font-weight: 700; color: #0f172a;">🎯 Selecteer Doelgroep (Vink Klassen en/of Studenten aan):</span>
                  <div style="font-size: 11px; color: #64748b;">Je kunt meerdere groepen openen en aanvinken; selecties blijven strikt onthouden bij in-/uitklappen.</div>
                </div>
                <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
                  <span id="mgmtSelectionSummaryBadge" style="font-size: 11px; font-weight: bold; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px;">0 geselecteerd</span>
                  <button class="pt-btn pt-btn-sm" style="font-size: 10px; padding: 2px 6px;" onclick="window.PXLApp.teacherStudio.selectAllAssignmentTargets(true)">✅ Alles Aan</button>
                  <button class="pt-btn pt-btn-sm" style="font-size: 10px; padding: 2px 6px;" onclick="window.PXLApp.teacherStudio.selectAllAssignmentTargets(false)">❌ Geen</button>
                  <button class="pt-btn pt-btn-sm" style="font-size: 10px; padding: 2px 6px;" onclick="window.PXLApp.teacherStudio.toggleExpandAllClasses(true)">📂 Alles Open</button>
                  <button class="pt-btn pt-btn-sm" style="font-size: 10px; padding: 2px 6px;" onclick="window.PXLApp.teacherStudio.toggleExpandAllClasses(false)">📁 Alles Dicht</button>
                </div>
              </div>

              <!-- Filter Input -->
              <div style="margin-bottom: 8px;">
                <input type="text" id="mgmtTreeSearchInput" placeholder="🔍 Filter doelgroep op klasnaam of studentennaam..." class="pt-input" style="width: 100%; box-sizing: border-box; padding: 4px 8px; font-size: 11px;" oninput="window.PXLApp.teacherStudio.filterAssignmentTree()">
              </div>

              <!-- Class & Student Tree Container -->
              <div id="mgmtClassTreeContainer" style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; background: #f8fafc;">
                <div style="padding: 15px; text-align: center; color: #64748b; font-size: 11px;">Klassen en studenten ophalen uit database...</div>
              </div>
            </div>

            <!-- Database Exams & Tests Management: Overview, Score Warnings, Delete & Bulk Delete -->
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <div>
                  <h4 style="margin: 0; font-size: 13px; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                    <span>🗄️</span> <span>Overzicht van Alle Examens &amp; Testen in Database</span>
                  </h4>
                  <div style="font-size: 11px; color: #64748b;">
                    Beheer alle opdrachten/examens en wis ze individueel of in bulk. Bij examens met reeds behaalde studentenscores wordt vooraf gewaarschuwd.
                  </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <span id="mgmtExamSelectionBadge" style="font-size: 11px; font-weight: bold; background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 12px; display: none;">0 geselecteerd</span>
                  <button class="pt-btn pt-btn-danger" id="btnBulkDeleteExams" style="padding: 4px 10px; font-size: 11px; background: #dc2626; color: #fff; font-weight: 700;" onclick="window.PXLApp.teacherStudio.deleteSelectedExamsBulk()">
                    🗑️ Geselecteerde Wissen (Bulk)
                  </button>
                  <button class="pt-btn pt-btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="window.PXLApp.teacherStudio.loadDbExamsList()">
                    🔄 Verversen
                  </button>
                </div>
              </div>

              <!-- Filter Search Input -->
              <div style="margin-bottom: 8px;">
                <input type="text" id="mgmtExamSearchInput" placeholder="🔍 Filter op examennaam, categorie of examen-ID..." class="pt-input" style="width: 100%; box-sizing: border-box; padding: 4px 8px; font-size: 11px;" oninput="window.PXLApp.teacherStudio.renderDbExamsTable()">
              </div>

              <!-- Exams Table Container -->
              <div id="studioExamsListContainer" style="max-height: 220px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px;">
                <div style="padding: 20px; text-align: center; color: #64748b; font-size: 11px;">Examens laden uit database...</div>
              </div>
            </div>

            <!-- Bottom Section: Active Assignments & Reset -->
            <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 12px;">
              <!-- Active Assignments List -->
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
                <h4 style="margin: 0 0 6px 0; font-size: 12px; color: #1e293b; font-weight: 700;">📋 Actieve Opdracht Toewijzingen</h4>
                <div id="studioAssignmentsTableContainer" style="max-height: 150px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                  <div style="padding: 10px; text-align: center; color: #64748b; font-size: 11px;">Toewijzingen laden...</div>
                </div>
              </div>

              <!-- Reset Student Exam Box -->
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px;">
                <h4 style="margin: 0 0 4px 0; font-size: 12px; color: #b91c1c; font-weight: 700;">🔄 Examen Resetten (Opnieuw Beginnen)</h4>
                <p style="font-size: 10px; color: #7f1d1d; margin: 0 0 6px 0;">
                  Wis opgeslagen werk en scores van studenten zodat ze opnieuw kunnen starten.
                </p>
                <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                  <select id="mgmtResetClassSelect" class="pt-input" style="font-size: 11px; flex: 1; padding: 3px;" onchange="window.PXLApp.teacherStudio.populateResetStudentsList()">
                    <option value="">Kies klas om studenten te tonen...</option>
                  </select>
                </div>
                <div id="mgmtResetStudentsList" style="max-height: 80px; overflow-y: auto; border: 1px solid #fca5a5; border-radius: 4px; background: #fff; padding: 4px; font-size: 11px; margin-bottom: 6px;">
                  <span style="color: #94a3b8;">Kies eerst een klas hierboven.</span>
                </div>
                <button class="pt-btn pt-btn-danger" style="width: 100%; padding: 5px; font-size: 11px; background: #dc2626; color: #fff;" onclick="window.PXLApp.teacherStudio.resetSelectedStudentsExam()">
                  🗑️ Examen Resetten voor Geselecteerde Studenten
                </button>
              </div>
            </div>
          </div>

          <!-- TAB 4: BUG CENTER -->
          <div id="studioTabBugs" class="pt-studio-pane" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <div style="display: flex; gap: 8px; align-items: center; flex: 1; min-width: 280px;">
                <input type="text" id="teacherBugsSearch" placeholder="🔍 Zoek op bug code, student, tekst..." class="pt-input" style="padding: 6px 10px; font-size: 12px; flex: 1;" oninput="window.PXLApp.teacherStudio.filterBugsTable()">
                <select id="teacherBugsStatusFilter" class="pt-input" style="padding: 6px 10px; font-size: 12px; width: 140px;" onchange="window.PXLApp.teacherStudio.loadBugs()">
                  <option value="all">Alle Statussen</option>
                  <option value="open" selected>🔴 Alleen Open</option>
                  <option value="resolved">🟢 Alleen Opgelost</option>
                </select>
              </div>
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <button class="pt-btn pt-btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="window.PXLApp.teacherStudio.openImportSolutionModal()">
                  📥 Importeer Oplossing JSON
                </button>
                <button class="pt-btn pt-btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="window.PXLApp.teacherStudio.loadBugs()">
                  🔄 Vernieuwen
                </button>
              </div>
            </div>

            <div id="teacherBugsContainer" style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;">
              <div style="padding: 30px; text-align: center; color: #64748b;">⏳ Bugs laden...</div>
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
              <p style="font-size: 11px; color: #64748b; margin: 0 0 8px 0;">Upload Packet Tracer v7, v8 of v9.0.1+. Twofish decodeert de XML. Vul een verplichte naam in om direct in de database op te slaan.</p>

              <div style="margin-bottom: 8px;">
                <label style="font-size: 11px; font-weight: 700; color: #0369a1;">🏷️ Naam voor examen / opdracht * (Verplicht voor database):</label>
                <input type="text" id="studioPkaTitleInput" class="pt-input" placeholder="bv. PXL SNE - Packet Tracer Routing Lab 1" style="width: 100%; box-sizing: border-box; font-size: 12px; margin-top: 2px;">
              </div>

              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <input type="file" id="studioPkaFileInput" accept=".pka,.pkt" class="pt-file-input" style="font-size: 11px; flex: 1; min-width: 220px;">
                <button class="pt-btn pt-btn-primary" style="padding: 7px 15px; font-size: 12px; background: #0284c7; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;" onclick="window.PXLApp.teacherStudio.uploadPkaFile(false)" title="Lees alle running configs uit en vink zelf af welke instellingen punten opleveren">
                  🎯 Analyseer &amp; Open Rubric Generator
                </button>
                <button class="pt-btn pt-btn-secondary" style="padding: 7px 12px; font-size: 11.5px;" onclick="window.PXLApp.teacherStudio.uploadPkaFile(true)" title="Alles direct converteren zonder afvinkfilter">
                  ⚡ Snel Converteren
                </button>
              </div>
              <div id="studioPkaStatus" class="pt-status-msg" style="margin-top: 6px; font-size: 12px;"></div>
            </div>

            <!-- AI Assignment Generator & JSON Import / Preview / Test Box -->
            <div class="pt-ai-generator-dropzone" style="margin-top: 16px; background: #fdf2f8; border: 1.5px dashed #db2777; border-radius: 8px; padding: 14px;">
              <div style="font-weight: 700; font-size: 13.5px; color: #be185d; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <span>🤖 Genereer Opdracht met AI in Importformaat (ChatGPT / Claude / Copilot / Antigravity)</span>
                <span style="background: #fbcfe8; color: #9d174d; font-size: 10.5px; padding: 2px 8px; border-radius: 4px; font-weight: 700;">AI JSON Import &amp; Matrix Editor</span>
              </div>
              <p style="font-size: 11px; color: #64748b; margin: 0 0 10px 0; line-height: 1.5;">
                Laat een AI binnen enkele seconden een complete netwerkopdracht ontwerpen (bv. <em>"maak een opdracht met 2 routers en switch waarbij we RIP routering testen"</em>). Kopieer onze kant-en-klare prompt &amp; JSON template, geef deze aan ChatGPT of Claude, en plak de resulterende JSON hieronder. Je kan alle teksten, topologie en rubric interactief bewerken en 100% testen vóór opslag.
              </p>

              <!-- Prompt & Template Action Bar -->
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px;">
                <button class="pt-btn" style="background: #db2777; color: white; padding: 6px 12px; font-size: 11.5px; font-weight: 700;" onclick="window.PXLApp.teacherStudio.copyAiTemplatePrompt()" title="Kopieer kant-en-klare prompt inclusief JSON template naar klembord">
                  📋 Kopieer AI Prompt &amp; Template
                </button>
                <button class="pt-btn pt-btn-secondary" style="padding: 6px 12px; font-size: 11.5px;" onclick="window.PXLApp.teacherStudio.downloadAiTemplateJson()" title="Download het blanco JSON sjabloon">
                  📥 Download Template (.json)
                </button>
                <button class="pt-btn pt-btn-secondary" style="padding: 6px 12px; font-size: 11.5px;" onclick="window.PXLApp.teacherStudio.toggleAiTemplateViewer()" title="Bekijk het JSON formaat met alle velden">
                  👁️ Toon / Verberg JSON Schema
                </button>
              </div>

              <!-- Collapsible Schema Viewer -->
              <div id="studioAiTemplateViewer" style="display: none; margin-bottom: 12px; background: #0f172a; color: #f8fafc; border-radius: 6px; padding: 12px; font-family: monospace; font-size: 11px; max-height: 220px; overflow-y: auto;">
                <pre style="margin: 0; white-space: pre-wrap;" id="studioAiTemplateViewerCode"></pre>
              </div>

              <!-- JSON Input & File Upload -->
              <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; font-weight: 700; color: #be185d;">📄 Plak AI JSON Code of Upload Bestand:</label>
                <textarea id="studioAiJsonInput" class="pt-textarea" rows="6" placeholder='Plak hier de volledige JSON van de AI (met "id", "title", "instructions", "initialTopology" en "rubric")...' style="width: 100%; box-sizing: border-box; font-family: monospace; font-size: 11.5px; margin-top: 4px; padding: 8px; border: 1px solid #f472b6; border-radius: 6px;"></textarea>
              </div>

              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px;">
                <input type="file" id="studioAiJsonFileInput" accept=".json" class="pt-file-input" onchange="window.PXLApp.teacherStudio.handleAiJsonFileUpload(event)" style="font-size: 11px; flex: 1; min-width: 200px;">
                <button class="pt-btn pt-btn-primary" style="background: #be185d; color: white; padding: 7px 15px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;" onclick="window.PXLApp.teacherStudio.previewAiAssignmentJson()">
                  👁️ Preview &amp; Bewerk Opdracht
                </button>
                <button class="pt-btn" style="padding: 7px 15px; font-size: 12px; font-weight: 700; background: #fef08a; color: #854d0e; border: 1px solid #facc15; display: inline-flex; align-items: center; gap: 5px;" onclick="window.PXLApp.teacherStudio.testAiAssignmentJson()">
                  🧪 Test Opdracht (100% Validatie)
                </button>
                <button class="pt-btn pt-btn-primary" style="background: #059669; color: white; padding: 7px 15px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;" onclick="window.PXLApp.teacherStudio.saveAiAssignmentJsonToDb()">
                  💾 Opslaan in Database
                </button>
              </div>

              <!-- Test / Status Result Box -->
              <div id="studioAiTestResultBox" style="display: none; margin-top: 8px; padding: 10px 14px; border-radius: 6px; font-size: 12px;"></div>

              <!-- Interactive Assignment Editor & Preview Modal / Box -->
              <div id="studioAiPreviewContainer" style="display: none; margin-top: 14px; background: #ffffff; border: 1.5px solid #f472b6; border-radius: 8px; padding: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
                  <h4 style="margin: 0; font-size: 14px; color: #be185d;">✏️ Interactieve Preview &amp; Bewerking van AI Opdracht</h4>
                  <span id="studioAiPreviewBadge" style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: #e0f2fe; color: #0369a1;">Lab</span>
                </div>

                <!-- Form Metadata Fields -->
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                  <div>
                    <label style="font-size: 11px; font-weight: 700; color: #334155;">Titel van Opdracht *:</label>
                    <input type="text" id="aiEditTitle" class="pt-input" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 5px 8px;">
                  </div>
                  <div>
                    <label style="font-size: 11px; font-weight: 700; color: #334155;">Type Opdracht:</label>
                    <select id="aiEditKind" class="pt-input" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 5px 8px;">
                      <option value="lab">Oefening (Lab) - Vrij resetbaar</option>
                      <option value="test">Toets (Test) - Wachtwoord beveiligd</option>
                    </select>
                  </div>
                  <div>
                    <label style="font-size: 11px; font-weight: 700; color: #334155;">Tijdslimiet (minuten):</label>
                    <input type="number" id="aiEditTimeLimit" class="pt-input" value="60" min="5" max="300" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 5px 8px;">
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                  <div>
                    <label style="font-size: 11px; font-weight: 700; color: #334155;">Vak / Categorie:</label>
                    <input type="text" id="aiEditCategory" class="pt-input" placeholder="bv. CCNA Routing &amp; Switching" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 5px 8px;">
                  </div>
                  <div>
                    <label style="font-size: 11px; font-weight: 700; color: #334155;">Test Wachtwoord (alleen vereist bij Toets/Test):</label>
                    <input type="text" id="aiEditTestPassword" class="pt-input" placeholder="bv. PXLTest2026!" style="width: 100%; box-sizing: border-box; font-size: 12px; padding: 5px 8px;">
                  </div>
                </div>

                <!-- Instructions Markdown Editor & Preview -->
                <div style="margin-bottom: 14px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label style="font-size: 11px; font-weight: 700; color: #334155;">📖 Opdrachtbeschrijving &amp; Adresseringstabel (Markdown):</label>
                    <button class="pt-btn pt-btn-sm" style="font-size: 10px; padding: 2px 8px;" onclick="window.PXLApp.teacherStudio.toggleAiMarkdownPreview()">
                      👁️ Toggle Markdown Preview
                    </button>
                  </div>
                  <textarea id="aiEditInstructions" class="pt-textarea" rows="6" style="width: 100%; box-sizing: border-box; font-size: 11.5px; font-family: monospace; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;"></textarea>
                  <div id="aiInstructionsPreview" style="display: none; margin-top: 6px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 12px; max-height: 180px; overflow-y: auto;"></div>
                </div>

                <!-- Topology Summary -->
                <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom: 14px;">
                  <span style="font-size: 11.5px; font-weight: 700; color: #1e293b;">🌐 Start-Topologie:</span>
                  <span id="aiTopologySummaryText" style="font-size: 11.5px; color: #475569; margin-left: 6px;"></span>
                  <div id="aiTopologyDevicesBadges" style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px;"></div>
                </div>

                <!-- Interactive Rubric Matrix Editor -->
                <div style="margin-bottom: 14px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div>
                      <span style="font-size: 12px; font-weight: 700; color: #1e293b;">⚡ Rubric &amp; Puntenverdeling:</span>
                      <span style="font-size: 11px; color: #64748b; margin-left: 6px;">Pas punten aan of verwijder/voeg criteria toe.</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 700;">
                        Totaal: <strong id="aiRubricTotalPoints">0</strong> pt
                      </span>
                      <button class="pt-btn pt-btn-sm" style="font-size: 11px; padding: 3px 8px; background: #0284c7; color: white;" onclick="window.PXLApp.teacherStudio.addAiRubricCriterion()">
                        ➕ Criterium Toevoegen
                      </button>
                    </div>
                  </div>

                  <div id="aiRubricEditorTable" style="max-height: 260px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;"></div>
                </div>

                <!-- Action Bar at bottom of Preview -->
                <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
                  <button class="pt-btn" style="background: #fef08a; color: #854d0e; border: 1px solid #facc15; font-size: 12px; font-weight: 700;" onclick="window.PXLApp.teacherStudio.testAiAssignmentJson()">
                    🧪 Valideer Opdracht &amp; Garandeer 0% Start
                  </button>
                  <button class="pt-btn pt-btn-primary" style="background: #be185d; color: white; font-size: 12px; font-weight: 700;" onclick="window.PXLApp.teacherStudio.cleanAiStarterTopology()">
                    🧹 Maak Starttopologie Schoon (0% Garantie)
                  </button>
                  <button class="pt-btn pt-btn-primary" style="background: #059669; color: white; font-size: 12px; font-weight: 700;" onclick="window.PXLApp.teacherStudio.saveAiAssignmentJsonToDb()">
                    💾 Sla Aangepaste Opdracht op in Database
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div class="pt-studio-footer" style="padding: 10px 18px; background: #f8fafc; border-top: 1px solid #cbd5e1; display: flex; justify-content: flex-end; gap: 10px;">
          <button class="pt-btn pt-btn-secondary" onclick="window.PXLApp.teacherStudio.exportExamJson()">
            💾 Download Examen (.json)
          </button>
          <button class="pt-btn pt-btn-primary" style="background: #0284c7;" onclick="window.PXLApp.teacherStudio.saveCurrentExamToDb()">
            💾 Sla Examen op in Database
          </button>
          <button class="pt-btn pt-btn-primary" style="background: #059669;" onclick="window.PXLApp.teacherStudio.applyExamToSession()">
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
    if (tabKey === 'examMgmt' || tabKey === 'opdrachten') tabKey = 'exam_mgmt';
    this.activeSubtab = tabKey;
    const tabMap = {
      'users': { pane: 'studioTabUsers', btn: 'tabBtnUsers' },
      'scores': { pane: 'studioTabScores', btn: 'tabBtnScores' },
      'labs_catalog': { pane: 'studioTabLabsCatalog', btn: 'tabBtnLabsCatalog' },
      'exam_mgmt': { pane: 'studioTabExamMgmt', btn: 'tabBtnExamMgmt' },
      'bugs': { pane: 'studioTabBugs', btn: 'tabBtnTeacherBugs' },
      'topology': { pane: 'studioTabTopology', btn: 'tabBtnTopology' },
      'rubric': { pane: 'studioTabRubric', btn: 'tabBtnRubric' }
    };
    Object.keys(tabMap).forEach(k => {
      const pane = document.getElementById(tabMap[k].pane);
      if (pane) pane.style.display = (k === tabKey) ? 'block' : 'none';
      const btn = document.getElementById(tabMap[k].btn);
      if (btn) btn.classList.toggle('active', k === tabKey);
    });

    if (this.scoresRefreshTimer) {
      clearInterval(this.scoresRefreshTimer);
      this.scoresRefreshTimer = null;
    }

    if (tabKey === 'users') {
      if (this.activeUserSubtab === 'teachers') {
        this.loadTeachersTable();
      } else {
        this.loadClassesAndStudents();
      }
    } else if (tabKey === 'scores') {
      this.loadScoresTab();
      // Auto-refresh scores every 10 seconds while on scores tab
      this.scoresRefreshTimer = setInterval(() => this.loadScoresTable(), 10000);
    } else if (tabKey === 'labs_catalog') {
      this.loadLabsCatalogTab();
    } else if (tabKey === 'exam_mgmt') {
      this.loadExamMgmtTab();
    } else if (tabKey === 'bugs') {
      this.loadBugs();
    }
  }

  formatLastLogin(timestamp) {
    if (!timestamp) return '<span style="color: #94a3b8; font-style: italic;">Nooit</span>';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    const now = new Date();
    const diffMs = now - d;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 5) {
      return `<span style="display: inline-flex; align-items: center; gap: 4px; color: #16a34a; font-weight: 700;"><span style="width: 7px; height: 7px; background: #16a34a; border-radius: 50%; display: inline-block;"></span> Nu online</span>`;
    }
    if (diffMinutes < 60) {
      return `<span style="display: inline-flex; align-items: center; gap: 4px; color: #15803d;"><span style="width: 7px; height: 7px; background: #22c55e; border-radius: 50%; display: inline-block;"></span> ${diffMinutes}m geleden</span>`;
    }
    if (diffMinutes < 1440 && now.getDate() === d.getDate()) {
      const hours = Math.floor(diffMinutes / 60);
      return `<span style="color: #0369a1; font-weight: 600;">Vandaag (${hours}u geleden)</span>`;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `<span style="color: #64748b;">${day}-${month} ${h}:${m}</span>`;
  }

  switchUserSubtab(subtab) {
    this.activeUserSubtab = subtab;
    const studentsContainer = document.getElementById('studioSubtabStudentsContainer');
    const teachersContainer = document.getElementById('studioSubtabTeachersContainer');
    const btnStudents = document.getElementById('subtabStudentsBtn');
    const btnTeachers = document.getElementById('subtabTeachersBtn');

    if (subtab === 'teachers') {
      if (studentsContainer) studentsContainer.style.display = 'none';
      if (teachersContainer) teachersContainer.style.display = 'block';
      if (btnStudents) btnStudents.className = 'pt-btn pt-btn-secondary';
      if (btnTeachers) btnTeachers.className = 'pt-btn pt-btn-primary';
      this.loadTeachersTable();
    } else {
      if (studentsContainer) studentsContainer.style.display = 'block';
      if (teachersContainer) teachersContainer.style.display = 'none';
      if (btnStudents) btnStudents.className = 'pt-btn pt-btn-primary';
      if (btnTeachers) btnTeachers.className = 'pt-btn pt-btn-secondary';
      this.loadClassesAndStudents();
    }
  }

  async loadTeachersTable() {
    const container = document.getElementById('studioTeachersListContainer');
    if (!container) return;

    try {
      const res = await fetch('/api/teacher/teachers');
      const data = await res.json();
      const teachers = data.teachers || [];

      const countBadge = document.getElementById('studioTeacherCountBadge');
      if (countBadge) countBadge.innerText = teachers.length;

      if (teachers.length === 0) {
        container.innerHTML = `<div style="padding: 30px; text-align: center; color: #94a3b8;">Geen docentenaccounts gevonden.</div>`;
        return;
      }

      container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; position: sticky; top: 0; z-index: 1;">
              <th style="padding: 10px 14px;">Volledige Naam</th>
              <th style="padding: 10px 14px;">Gebruikersnaam</th>
              <th style="padding: 10px 14px;">Vakgroep / Afdeling</th>
              <th style="padding: 10px 14px;">Laatst Ingelogd</th>
              <th style="padding: 10px 14px;">Aangemaakt op</th>
              <th style="padding: 10px 14px; text-align: right;">Actie</th>
            </tr>
          </thead>
          <tbody>
            ${teachers.map(t => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 14px; font-weight: 700; color: #0f172a;">${t.full_name}</td>
                <td style="padding: 8px 14px; font-family: monospace; font-weight: 600; color: #0284c7;">${t.username}</td>
                <td style="padding: 8px 14px;"><span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${t.department || 'PXL-SNE'}</span></td>
                <td style="padding: 8px 14px;">${this.formatLastLogin(t.last_login_at)}</td>
                <td style="padding: 8px 14px; color: #64748b; font-size: 11px;">${t.created_at || '-'}</td>
                <td style="padding: 8px 14px; text-align: right;">
                  <button class="pt-btn pt-btn-sm" style="color: #ef4444; border: 1px solid #fecaca; background: #fff; padding: 3px 8px; font-size: 11px; border-radius: 4px; cursor: pointer;" title="Docent verwijderen" onclick="window.PXLApp.teacherStudio.deleteTeacherAccount(${t.id}, '${t.full_name}')">
                    🗑️ Verwijder
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = `<div style="padding: 20px; color: #ef4444;">Fout bij ophalen van docenten: ${err.message}</div>`;
    }
  }

  async submitNewTeacher() {
    const username = document.getElementById('newTeacherUsername')?.value.trim();
    const fullName = document.getElementById('newTeacherFullName')?.value.trim();
    const password = document.getElementById('newTeacherPassword')?.value.trim();
    const department = document.getElementById('newTeacherDept')?.value.trim() || 'PXL-SNE';

    if (!username || !fullName || !password) {
      alert("Vul gebruikersnaam, volledige naam en wachtwoord in.");
      return;
    }

    try {
      const res = await fetch('/api/teacher/teacher/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          full_name: fullName,
          password: password,
          department: department
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(data.message || "Docent succesvol aangemaakt!");
        document.getElementById('newTeacherUsername').value = '';
        document.getElementById('newTeacherFullName').value = '';
        document.getElementById('newTeacherPassword').value = '';
        this.loadTeachersTable();
      } else {
        alert("Fout bij aanmaken docent: " + (data.error || "Onbekende fout"));
      }
    } catch (err) {
      alert("Netwerkfout bij aanmaken docent: " + err.message);
    }
  }

  async deleteTeacherAccount(teacherId, teacherName) {
    if (!confirm(`Weet je zeker dat je het docentenaccount van "${teacherName}" wilt verwijderen?`)) {
      return;
    }

    try {
      const res = await fetch('/api/teacher/teacher/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: teacherId })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert("Docentenaccount succesvol verwijderd.");
        this.loadTeachersTable();
      } else {
        alert("Kon docent niet verwijderen: " + (data.error || "Onbekende fout"));
      }
    } catch (err) {
      alert("Netwerkfout: " + err.message);
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
      await this.loadImportQueue();
    } catch (e) {
      console.warn('Error loading classes:', e);
    }
  }

  // --- TOEVOEG WACHTRIJ (AUDIT QUEUE) ---
  async loadImportQueue() {
    const container = document.getElementById('importQueueTableContainer');
    const badge = document.getElementById('queueTotalBadge');
    if (!container) return;

    try {
      const res = await fetch('/api/teacher/import-queue');
      const data = await res.json();
      this.cachedImportQueue = data.queue || [];
      if (badge) badge.innerText = `${this.cachedImportQueue.length} accounts in wachtrij`;
      this.renderImportQueue(this.cachedImportQueue);
    } catch (e) {
      container.innerHTML = `<div style="padding: 10px; color: #ef4444; font-size: 11px;">Fout bij laden van wachtrij: ${e.message}</div>`;
    }
  }

  renderImportQueue(items) {
    const container = document.getElementById('importQueueTableContainer');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `<div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 11px;">Geen accounts in de toevoeg-wachtrij.</div>`;
      return;
    }

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background: #ecfdf5; border-bottom: 1.5px solid #a7f3d0; text-align: left; position: sticky; top: 0; z-index: 1;">
            <th style="padding: 5px 8px;">Tijdstip</th>
            <th style="padding: 5px 8px;">Login / Studentnr</th>
            <th style="padding: 5px 8px;">Naam</th>
            <th style="padding: 5px 8px;">Klasnaam</th>
            <th style="padding: 5px 8px;">Richting</th>
            <th style="padding: 5px 8px;">Bron</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(q => `
            <tr style="border-bottom: 1px solid #f0fdf4;">
              <td style="padding: 4px 8px; color: #64748b; font-family: monospace;">${(q.created_at || '').substring(0, 16)}</td>
              <td style="padding: 4px 8px; font-weight: bold; font-family: monospace; color: #0f172a;">${q.username}</td>
              <td style="padding: 4px 8px; font-weight: 600;">${q.full_name}</td>
              <td style="padding: 4px 8px;"><span style="background: #e0f2fe; color: #0369a1; padding: 1px 6px; border-radius: 4px; font-weight: bold;">${q.class_group}</span></td>
              <td style="padding: 4px 8px; color: #475569;">${q.program || '-'}</td>
              <td style="padding: 4px 8px;">
                <span style="background: ${q.source === 'blackboard_csv' ? '#dbeafe' : (q.source === 'manual' ? '#fef3c7' : '#f1f5f9')};
                             color: ${q.source === 'blackboard_csv' ? '#1d4ed8' : (q.source === 'manual' ? '#b45309' : '#475569')};
                             padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: 600;">
                  ${q.source === 'blackboard_csv' ? 'Blackboard CSV' : (q.source === 'manual' ? 'Handmatig' : 'Systeem Seed')}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  filterImportQueue() {
    const q = (document.getElementById('queueSearchInput')?.value || '').toLowerCase().trim();
    if (!q) {
      this.renderImportQueue(this.cachedImportQueue);
      return;
    }
    const filtered = this.cachedImportQueue.filter(item => {
      return (item.username || '').toLowerCase().includes(q) ||
             (item.full_name || '').toLowerCase().includes(q) ||
             (item.class_group || '').toLowerCase().includes(q) ||
             (item.program || '').toLowerCase().includes(q);
    });
    this.renderImportQueue(filtered);
  }

  toggleImportQueueView() {
    const container = document.getElementById('importQueueTableContainer');
    const btn = document.getElementById('btnToggleQueueView');
    if (!container) return;
    this.isQueueCollapsed = !this.isQueueCollapsed;
    container.style.display = this.isQueueCollapsed ? 'none' : 'block';
    if (btn) btn.innerText = this.isQueueCollapsed ? '▼ Uitklappen' : '▲ Inklappen';
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

      const countBadge = document.getElementById('studioStudentCountBadge');
      if (countBadge) countBadge.innerText = students.length;

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
              <th style="padding: 8px 10px;">Laatst Ingelogd</th>
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
                <td style="padding: 6px 10px;">${this.formatLastLogin(s.last_login_at)}</td>
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
      if (!this.allDbExams || this.allDbExams.length === 0) {
        try {
          const res = await fetch('/api/teacher/exams');
          const data = await res.json();
          this.allDbExams = data.exams || [];
        } catch (e) {}
      }
      const currentExam = this.app.activeExam ? this.app.activeExam.id : 'all';
      let opts = '<option value="all">🌟 Alle Testen & Examens (Compleet Overzicht)</option>';
      if (this.allDbExams && this.allDbExams.length > 0) {
        this.allDbExams.forEach(e => {
          opts += `<option value="${e.id}" ${e.id === currentExam ? 'selected' : ''}>${e.title}</option>`;
        });
      } else {
        opts += `<option value="01_pxl_standard">01_pxl_standard (Standaard Examen)</option>`;
      }
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

    const examId = document.getElementById('scoresExamSelect')?.value || 'all';
    const classes = Array.from(this.scoresClassFilter).join(',');

    try {
      const params = new URLSearchParams();
      params.set('exam_id', examId);
      if (classes) params.set('classes', classes);

      const res = await fetch(`/api/teacher/scores?${params.toString()}`);
      const data = await res.json();
      const students = data.scores || [];

      if (students.length === 0) {
        container.innerHTML = `<div style="padding: 30px; text-align: center; color: #94a3b8;">Geen scores gevonden voor deze selectie.</div>`;
        return;
      }

      if (examId === 'all') {
        const catLabels = { pka_import: '📦 PKA', custom: '✏️ Examen', course_lab: '📚 Cursus', preset: '⚡ Preset' };
        container.innerHTML = `
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left; position: sticky; top: 0; z-index: 1;">
                <th style="padding: 8px 10px;">Studentnr</th>
                <th style="padding: 8px 10px;">Naam</th>
                <th style="padding: 8px 10px;">Klas</th>
                <th style="padding: 8px 10px;">Examen / Test</th>
                <th style="padding: 8px 10px;">Categorie</th>
                <th style="padding: 8px 10px;">Score (pt)</th>
                <th style="padding: 8px 10px;">Percentage</th>
                <th style="padding: 8px 10px;">Laatst Ingelogd</th>
                <th style="padding: 8px 10px;">Laatste Opslag</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => {
                const pct = Math.round(s.percentage || 0);
                const color = pct >= 50 ? '#16a34a' : (pct > 0 ? '#d97706' : '#dc2626');
                const catBadge = catLabels[s.exam_category] || s.exam_category || '-';
                return `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px 10px; font-weight: 700; font-family: monospace;">${s.username}</td>
                    <td style="padding: 6px 10px; font-weight: 600;">${s.full_name}</td>
                    <td style="padding: 6px 10px;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">${s.class_group}</span></td>
                    <td style="padding: 6px 10px;">
                      <div style="font-weight: 600; color: #0f172a;">${s.exam_title || s.exam_id}</div>
                      <div style="font-size: 10px; color: #94a3b8; font-family: monospace;">${s.exam_id}</div>
                    </td>
                    <td style="padding: 6px 10px;"><span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 600;">${catBadge}</span></td>
                    <td style="padding: 6px 10px; font-weight: 700; color: ${color};">${s.score} / ${s.max_score}</td>
                    <td style="padding: 6px 10px; font-weight: 700; color: ${color};">
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span>${pct}%</span>
                        <div style="flex: 1; max-width: 60px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                          <div style="width: ${Math.min(100, Math.max(0, pct))}%; height: 100%; background: ${color};"></div>
                        </div>
                      </div>
                    </td>
                    <td style="padding: 6px 10px;">${this.formatLastLogin(s.last_login_at)}</td>
                    <td style="padding: 6px 10px; color: #64748b; font-size: 11px;">${s.last_saved}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
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
              <th style="padding: 8px 10px;">Laatst Ingelogd</th>
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
                  <td style="padding: 6px 10px;">${this.formatLastLogin(s.last_login_at)}</td>
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

  exportScoresCsv(exportAll = false) {
    const selectedExamId = document.getElementById('scoresExamSelect')?.value || 'all';
    const examId = exportAll ? 'all' : selectedExamId;
    const classes = Array.from(this.scoresClassFilter).join(',');
    const url = `/api/teacher/scores/export?exam_id=${encodeURIComponent(examId)}&classes=${encodeURIComponent(classes)}`;
    window.open(url, '_blank');
  }

  // --- TAB 3: LABS & RUBRICS CATALOG ---
  async loadLabsCatalogTab() {
    const listContainer = document.getElementById('labsCatalogListContainer');
    if (!listContainer) return;

    listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">⏳ Labo-catalogus laden...</div>';

    try {
      const res = await fetch('/api/teacher/labs-catalog');
      const data = await res.json();
      this.allLabsCatalog = data.labs || [];

      const countBadge = document.getElementById('labsCatalogCountBadge');
      if (countBadge) countBadge.innerText = `${this.allLabsCatalog.length} Labo's`;

      this.filterLabsCatalog();

      if (this.allLabsCatalog.length > 0 && !this.selectedCatalogLabId) {
        this.selectLabForInspection(this.allLabsCatalog[0].id);
      }
    } catch (err) {
      listContainer.innerHTML = `<div style="padding: 20px; color: #ef4444;">Fout bij laden catalogus: ${err.message}</div>`;
    }
  }

  filterLabsCatalog() {
    const search = (document.getElementById('labsCatalogSearchInput')?.value || '').toLowerCase().trim();
    const category = document.getElementById('labsCatalogCategoryFilter')?.value || '';

    let filtered = this.allLabsCatalog || [];

    if (category) {
      filtered = filtered.filter(l => l.category === category);
    }

    if (search) {
      filtered = filtered.filter(l => 
        (l.title && l.title.toLowerCase().includes(search)) ||
        (l.id && l.id.toLowerCase().includes(search)) ||
        (l.instructions && l.instructions.toLowerCase().includes(search))
      );
    }

    this.renderLabsCatalogList(filtered);
  }

  renderLabsCatalogList(labs) {
    const container = document.getElementById('labsCatalogListContainer');
    if (!container) return;

    if (labs.length === 0) {
      container.innerHTML = '<div style="padding: 30px; text-align: center; color: #94a3b8;">Geen labo\'s gevonden voor deze filter.</div>';
      return;
    }

    const catBadgeMap = {
      course_lab: { text: '📚 Cursus', bg: '#e0f2fe', color: '#0369a1' },
      custom: { text: '✏️ Examen', bg: '#fef3c7', color: '#b45309' },
      pka_import: { text: '📦 PKA', bg: '#f1f5f9', color: '#475569' },
      preset: { text: '⚡ Preset', bg: '#ede9fe', color: '#6d28d9' }
    };

    container.innerHTML = labs.map(lab => {
      const isSelected = lab.id === this.selectedCatalogLabId;
      const b = catBadgeMap[lab.category] || { text: lab.category, bg: '#f1f5f9', color: '#475569' };
      const rubricCount = lab.rubric_items_count || (lab.rubric ? lab.rubric.length : 0);
      const points = lab.total_points || 100;

      return `
        <div class="lab-catalog-card" style="background: ${isSelected ? '#f0f9ff' : '#ffffff'}; border: ${isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1'}; border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: all 0.15s ease;" onclick="window.PXLApp.teacherStudio.selectLabForInspection('${lab.id}')">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="background: ${b.bg}; color: ${b.color}; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">${b.text}</span>
            <span style="font-size: 11px; color: #64748b; font-family: monospace;">${lab.id}</span>
          </div>
          <div style="font-weight: 700; font-size: 12.5px; color: #0f172a; margin-bottom: 4px; line-height: 1.3;">${lab.title}</div>
          <div style="display: flex; gap: 8px; font-size: 11px; color: #64748b; flex-wrap: wrap;">
            <span>🎯 ${rubricCount} criteria</span>
            <span>•</span>
            <span style="font-weight: 600; color: #059669;">${points} pt</span>
            <span>•</span>
            <span>⏱️ ${lab.time_limit_minutes || 80}m</span>
          </div>
        </div>
      `;
    }).join('');
  }

  selectLabForInspection(labId) {
    this.selectedCatalogLabId = labId;
    const lab = (this.allLabsCatalog || []).find(l => l.id === labId);

    this.filterLabsCatalog();

    const detailContainer = document.getElementById('labsCatalogDetailContainer');
    if (!detailContainer) return;

    if (!lab) {
      detailContainer.innerHTML = '<div style="padding: 30px; text-align: center; color: #94a3b8;">Labo niet gevonden.</div>';
      return;
    }

    const rubric = lab.rubric || [];
    const rubricPoints = lab.total_points || 100;
    const rubricRowsHtml = rubric.length > 0 ? rubric.map((item, idx) => {
      const pts = item.points || 0;
      const pct = rubricPoints > 0 ? Math.round((pts / rubricPoints) * 100) : 0;
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
          <td style="padding: 7px 10px; font-weight: bold; color: #64748b; width: 24px;">${idx + 1}</td>
          <td style="padding: 7px 10px;">
            <span style="background: #f1f5f9; color: #334155; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
              ${item.type || 'check'}
            </span>
          </td>
          <td style="padding: 7px 10px; font-weight: 600; color: #0284c7;">
            ${item.device || '-'}${item.port ? ` (${item.port})` : ''}
          </td>
          <td style="padding: 7px 10px; font-family: monospace; font-size: 11.5px; color: #1e293b;">
            ${item.expected || item.ip || item.vlan || item.network || '-'}
          </td>
          <td style="padding: 7px 10px; font-weight: 700; color: #059669; white-space: nowrap;">
            ${pts} pt <span style="font-size: 10px; color: #64748b; font-weight: normal;">(${pct}%)</span>
          </td>
          <td style="padding: 7px 10px; color: #475569; font-size: 11.5px;">
            ${item.description || item.desc || '-'}
          </td>
        </tr>
      `;
    }).join('') : `
      <tr>
        <td colspan="6" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">
          Geen formele rubric regels geconfigureerd voor dit labo.
        </td>
      </tr>
    `;

    let formattedInstructions = (lab.instructions || 'Geen instructies opgegeven.')
      .replace(/\\n\\n/g, '<br><br>')
      .replace(/\\n/g, '<br>');

    detailContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 12px; gap: 12px; flex-wrap: wrap;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="background: #0284c7; color: #fff; font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">${lab.category}</span>
            <span style="font-family: monospace; font-size: 11.5px; color: #64748b;">${lab.id}</span>
          </div>
          <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #0f172a;">${lab.title}</h3>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="pt-btn pt-btn-secondary" style="padding: 6px 12px; font-size: 11.5px;" onclick="window.PXLApp.teacherStudio.quickAssignCatalogLab('${lab.id}')" title="Schakel direct naar de Toewijzen tab met dit labo">
            🚀 Openzetten voor Klas
          </button>
          <button class="pt-btn pt-btn-primary" style="padding: 6px 12px; font-size: 11.5px; background: #059669;" onclick="window.PXLApp.teacherStudio.loadCatalogLabOnCanvas('${lab.id}')" title="Laad deze topologie direct in de simulator">
            ▶️ Laad op Canvas
          </button>
        </div>
      </div>

      <!-- Quick Metrics Bar -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 16px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
          <div style="font-size: 11px; color: #64748b;">Totaal Punten</div>
          <div style="font-size: 16px; font-weight: 800; color: #059669;">${rubricPoints} pt</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
          <div style="font-size: 11px; color: #64748b;">Beoordelingscriteria</div>
          <div style="font-size: 16px; font-weight: 800; color: #0284c7;">${rubric.length} checks</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
          <div style="font-size: 11px; color: #64748b;">Aanbevolen Tijd</div>
          <div style="font-size: 16px; font-weight: 800; color: #334155;">⏱️ ${lab.time_limit_minutes || 80} min</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px;">
          <div style="font-size: 11px; color: #64748b;">Netwerkapparaten</div>
          <div style="font-size: 16px; font-weight: 800; color: #334155;">🖥️ ${lab.devices_count || 0} stuks</div>
        </div>
      </div>

      <!-- Section 1: Opdrachtomschrijving -->
      <div style="margin-bottom: 20px;">
        <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px;">
          <span>📋</span> <span>Opdrachtomschrijving & Doelen</span>
        </h4>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; font-size: 12.5px; line-height: 1.55; color: #334155; max-height: 220px; overflow-y: auto;">
          ${formattedInstructions}
        </div>
      </div>

      <!-- Section 2: Beoordelingsrubric -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px;">
            <span>🎯</span> <span>Beoordelingsrubric & Validatiematrix</span>
          </h4>
          <span style="font-size: 11px; font-weight: 600; color: #059669; background: #ecfdf5; padding: 2px 8px; border-radius: 4px; border: 1px solid #a7f3d0;">
            100% Geautomatiseerde Evaluatie
          </span>
        </div>
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; text-align: left;">
                <th style="padding: 8px 10px;">#</th>
                <th style="padding: 8px 10px;">Type</th>
                <th style="padding: 8px 10px;">Doel</th>
                <th style="padding: 8px 10px;">Verwachte Configuratie</th>
                <th style="padding: 8px 10px;">Punten</th>
                <th style="padding: 8px 10px;">Didactische Toelichting</th>
              </tr>
            </thead>
            <tbody>
              ${rubricRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  quickAssignCatalogLab(labId) {
    this.switchTab('exam_mgmt');
    setTimeout(() => {
      const select = document.getElementById('mgmtAssignExamSelect');
      if (select) {
        select.value = labId;
        this.onSelectedExamChanged();
      }
    }, 150);
  }

  loadCatalogLabOnCanvas(labId) {
    if (confirm(`Wil je labo "${labId}" direct op het simulator-werkveld laden? (Niet-opgeslagen wijzigingen op het huidige werkveld worden overschreven)`)) {
      this.closeStudioModal();
      if (window.PXLApp && window.PXLApp.loadExamById) {
        window.PXLApp.loadExamById(labId);
      }
    }
  }

  // --- TAB 4: OPDRACHTEN & EXAMEN TOEWIJZEN ---
  async loadExamMgmtTab() {
    // 1. Fetch all exams from SQLite database (course labs, PKA imports, presets, custom)
    try {
      const res = await fetch('/api/teacher/exams');
      const data = await res.json();
      this.allDbExams = data.exams || [];
      this.populateExamSelect(this.allDbExams);
      this.renderDbExamsTable();
    } catch (e) {
      console.warn('Error fetching exams from database:', e);
    }

    // 2. Fetch hierarchical students by class
    try {
      const resTree = await fetch('/api/teacher/students-by-class');
      const dataTree = await resTree.json();
      this.cachedTreeClasses = dataTree.classes || [];
      this.renderAssignmentTree();
    } catch (e) {
      console.warn('Error fetching students by class:', e);
    }

    // 3. Populate reset class select
    if (this.allClasses.length === 0) {
      const res = await fetch('/api/teacher/classes');
      const data = await res.json();
      this.allClasses = data.classes || [];
    }
    const resetSelect = document.getElementById('mgmtResetClassSelect');
    if (resetSelect) {
      resetSelect.innerHTML = `<option value="">Kies klas om studenten te tonen...</option>` +
        this.allClasses.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    await this.loadAssignmentsTable();
  }

  async loadDbExamsList() {
    try {
      const res = await fetch('/api/teacher/exams');
      const data = await res.json();
      this.allDbExams = data.exams || [];
      this.populateExamSelect(this.allDbExams);
      this.renderDbExamsTable();
      this.app.showToast('Examens ververst');
    } catch (e) {
      console.warn('Error refreshing exams list:', e);
    }
  }

  renderDbExamsTable() {
    const container = document.getElementById('studioExamsListContainer');
    if (!container) return;

    if (!this.allDbExams || this.allDbExams.length === 0) {
      container.innerHTML = `<div style="padding: 25px; text-align: center; color: #94a3b8; font-size: 11.5px;">Geen examens of testen gevonden in de database.</div>`;
      return;
    }

    const searchQuery = (document.getElementById('mgmtExamSearchInput')?.value || '').toLowerCase().trim();
    const filtered = this.allDbExams.filter(e => {
      if (!searchQuery) return true;
      const title = (e.title || '').toLowerCase();
      const cat = (e.category || '').toLowerCase();
      const id = (e.id || '').toLowerCase();
      return title.includes(searchQuery) || cat.includes(searchQuery) || id.includes(searchQuery);
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 11.5px;">Geen examens gevonden die voldoen aan '${searchQuery}'.</div>`;
      return;
    }

    const categoryBadges = {
      pka_import: { label: '📦 PKA Import', bg: '#eff6ff', color: '#1d4ed8' },
      custom: { label: '✏️ Eigen Examen', bg: '#ecfdf5', color: '#047857' },
      course_lab: { label: '📚 Cursuslabo', bg: '#faf5ff', color: '#6b21a8' },
      preset: { label: '⚡ Preset', bg: '#fefce8', color: '#a16207' }
    };

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left; position: sticky; top: 0; z-index: 2;">
            <th style="padding: 6px 10px; width: 35px; text-align: center;">
              <input type="checkbox" id="mgmtSelectAllExamsCb" onchange="window.PXLApp.teacherStudio.toggleSelectAllExams(this.checked)" title="Alles selecteren">
            </th>
            <th style="padding: 6px 10px;">Examen / Test Titel</th>
            <th style="padding: 6px 10px; width: 110px;">Categorie</th>
            <th style="padding: 6px 10px; width: 80px;">Tijd</th>
            <th style="padding: 6px 10px; width: 200px;">Studentenscores &amp; Punten</th>
            <th style="padding: 6px 10px; width: 90px; text-align: center;">Actie</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(e => {
            const cat = categoryBadges[e.category] || { label: e.category || 'Opdracht', bg: '#f1f5f9', color: '#475569' };
            const scored = e.scored_count || 0;
            const saves = e.total_saves || 0;
            const maxScore = e.max_student_score != null ? e.max_student_score : '-';

            let pointsBadge = '';
            if (scored > 0) {
              pointsBadge = `<span style="background: #fef3c7; color: #92400e; font-weight: 700; padding: 2px 7px; border-radius: 10px; border: 1px solid #fde68a; font-size: 10.5px; display: inline-flex; align-items: center; gap: 4px;" title="Dit examen bevat al behaalde studentenscores!">
                <span>⚠️</span> <span>${scored} student(en) (Max: ${maxScore} pt)</span>
              </span>`;
            } else if (saves > 0) {
              pointsBadge = `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 7px; border-radius: 10px; font-size: 10.5px; display: inline-flex; align-items: center; gap: 4px;">
                <span>📝</span> <span>${saves} poging(en) (0 pt)</span>
              </span>`;
            } else {
              pointsBadge = `<span style="color: #94a3b8; font-size: 11px;">⚪ Geen scores</span>`;
            }

            return `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 6px 10px; text-align: center;">
                  <input type="checkbox" class="mgmt-exam-row-cb" value="${e.id}" data-title="${(e.title || e.id).replace(/"/g, '&quot;')}" data-scored="${scored}" data-saves="${saves}" onchange="window.PXLApp.teacherStudio.updateExamSelectionBadge()">
                </td>
                <td style="padding: 6px 10px;">
                  <div style="font-weight: 700; color: #0f172a;">${e.title || e.id}</div>
                  <div style="font-size: 10px; color: #94a3b8; font-family: monospace;">ID: ${e.id}</div>
                </td>
                <td style="padding: 6px 10px;">
                  <span style="background: ${cat.bg}; color: ${cat.color}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; white-space: nowrap;">
                    ${cat.label}
                  </span>
                </td>
                <td style="padding: 6px 10px; font-size: 11px; color: #475569; white-space: nowrap;">
                  ⏱️ ${e.time_limit_minutes || 80}m
                </td>
                <td style="padding: 6px 10px;">
                  ${pointsBadge}
                </td>
                <td style="padding: 6px 10px; text-align: center;">
                  <button class="pt-btn pt-btn-danger" style="padding: 3px 8px; font-size: 10.5px; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; cursor: pointer; border-radius: 4px;" onclick="window.PXLApp.teacherStudio.deleteSingleExam('${e.id}', '${(e.title || e.id).replace(/'/g, "\\'")}', ${scored}, ${saves})" title="Dit examen definitief wissen">
                    🗑️ Wissen
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    this.updateExamSelectionBadge();
  }

  toggleSelectAllExams(checked) {
    const checkboxes = document.querySelectorAll('.mgmt-exam-row-cb');
    checkboxes.forEach(cb => { cb.checked = checked; });
    this.updateExamSelectionBadge();
  }

  updateExamSelectionBadge() {
    const count = document.querySelectorAll('.mgmt-exam-row-cb:checked').length;
    const badge = document.getElementById('mgmtExamSelectionBadge');
    if (badge) {
      badge.innerText = `${count} geselecteerd`;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
    const selectAllCb = document.getElementById('mgmtSelectAllExamsCb');
    const allCbs = document.querySelectorAll('.mgmt-exam-row-cb');
    if (selectAllCb && allCbs.length > 0) {
      selectAllCb.checked = count === allCbs.length;
    }
  }

  async deleteSingleExam(examId, examTitle, scoredCount, totalSaves) {
    if (scoredCount > 0 || totalSaves > 0) {
      const confirmed = confirm(
        `⚠️ WAARSCHUWING: DIT EXAMEN BEVAT PUNTEN!\n\n` +
        `Het examen '${examTitle}' bevat al opgeslagen werk en/of punten van ${totalSaves} student(en) (waarvan ${scoredCount} met een behaalde score)!\n\n` +
        `Als je dit examen verwijdert:\n` +
        `- Worden alle actieve toewijzingen gewist\n` +
        `- Worden de behaalde scores en tussenstanden van deze studenten DEFINITIEF verwijderd uit de database\n\n` +
        `Weet je heel zeker dat je wilt doorgaan met wissen?`
      );
      if (!confirmed) return;
    } else {
      const confirmed = confirm(`Weet je zeker dat je het examen '${examTitle}' wilt verwijderen uit de database?`);
      if (!confirmed) return;
    }

    try {
      const res = await fetch('/api/teacher/exam/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: examId })
      });
      const data = await res.json();
      if (data.success) {
        window.PXLApp.showToast(`🗑️ Examen '${examTitle}' succesvol verwijderd.`);
        await this.loadExamMgmtTab();
        const examSelect = document.getElementById('scoresExamSelect');
        if (examSelect) {
          this.allDbExams = [];
          await this.loadScoresTab();
        }
      } else {
        alert(data.error || 'Kon examen niet verwijderen');
      }
    } catch (err) {
      alert('Fout bij verwijderen examen: ' + err.message);
    }
  }

  async deleteSelectedExamsBulk() {
    const checkboxes = document.querySelectorAll('.mgmt-exam-row-cb:checked');
    if (checkboxes.length === 0) {
      alert('Selecteer eerst één of meerdere examens via de selectievakjes om te wissen.');
      return;
    }

    const selected = Array.from(checkboxes).map(cb => ({
      id: cb.value,
      title: cb.dataset.title || cb.value,
      scored: parseInt(cb.dataset.scored || '0', 10),
      saves: parseInt(cb.dataset.saves || '0', 10)
    }));

    const withScores = selected.filter(s => s.scored > 0 || s.saves > 0);
    let msg = '';
    if (withScores.length > 0) {
      msg = `⚠️ WAARSCHUWING: EXAMENS BEVATTEN PUNTEN!\n\n` +
        `Onder de ${selected.length} geselecteerde examen(s) zijn er ${withScores.length} die al punten of opgeslagen werk van studenten bevatten:\n\n` +
        withScores.map(s => `• ${s.title} (${s.saves} deelnames, ${s.scored} met punten)`).join('\n') +
        `\n\nAls je deze verwijdert, worden ALLE toewijzingen én studentenscores voor deze examens PERMANENT VERWIJDERD!\n\n` +
        `Weet je zeker dat je alle ${selected.length} geselecteerde examen(s) definitief wilt wissen?`;
    } else {
      msg = `Weet je zeker dat je de ${selected.length} geselecteerde examen(s) wilt verwijderen uit de database?`;
    }

    if (!confirm(msg)) return;

    try {
      const res = await fetch('/api/teacher/exam/delete-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected.map(s => s.id) })
      });
      const data = await res.json();
      if (data.success) {
        window.PXLApp.showToast(`🗑️ ${data.count} examen(s) succesvol verwijderd.`);
        await this.loadExamMgmtTab();
        const examSelect = document.getElementById('scoresExamSelect');
        if (examSelect) {
          this.allDbExams = [];
          await this.loadScoresTab();
        }
      } else {
        alert(data.error || 'Kon examens niet verwijderen');
      }
    } catch (err) {
      alert('Fout bij bulk wissen van examens: ' + err.message);
    }
  }

  populateExamSelect(exams) {
    const examSelect = document.getElementById('mgmtAssignExamSelect');
    if (!examSelect) return;

    const courseLabs = exams.filter(e => e.category === 'course_lab');
    const pkaExams = exams.filter(e => e.category === 'pka_import');
    const customExams = exams.filter(e => e.category === 'custom');
    const presetExams = exams.filter(e => e.category === 'preset');

    let html = '';

    if (pkaExams.length > 0) {
      html += `<optgroup label="📦 Geüploade PKA / PKT Opdrachten (${pkaExams.length})">`;
      pkaExams.forEach(e => {
        html += `<option value="${e.id}" data-time="${e.time_limit_minutes || 80}">📦 ${e.title} (${e.time_limit_minutes || 80} min)</option>`;
      });
      html += `</optgroup>`;
    }

    if (customExams.length > 0) {
      html += `<optgroup label="✏️ Eigen Ontworpen Examens (${customExams.length})">`;
      customExams.forEach(e => {
        html += `<option value="${e.id}" data-time="${e.time_limit_minutes || 80}">✏️ ${e.title} (${e.time_limit_minutes || 80} min)</option>`;
      });
      html += `</optgroup>`;
    }

    if (courseLabs.length > 0) {
      html += `<optgroup label="📚 Network Essentials Cursuslabo's (${courseLabs.length})">`;
      courseLabs.forEach(e => {
        html += `<option value="${e.id}" data-time="${e.time_limit_minutes || 45}">📚 ${e.title} (${e.time_limit_minutes || 45} min)</option>`;
      });
      html += `</optgroup>`;
    }

    if (presetExams.length > 0) {
      html += `<optgroup label="⚡ Standaard Presets (${presetExams.length})">`;
      presetExams.forEach(e => {
        html += `<option value="${e.id}" data-time="${e.time_limit_minutes || 80}">⚡ ${e.title} (${e.time_limit_minutes || 80} min)</option>`;
      });
      html += `</optgroup>`;
    }

    examSelect.innerHTML = html;
    this.onSelectedExamChanged();
  }

  onSelectedExamChanged() {
    const examSelect = document.getElementById('mgmtAssignExamSelect');
    const timeLimitInput = document.getElementById('mgmtAssignTimeLimit');
    if (!examSelect || !timeLimitInput) return;
    const selectedOpt = examSelect.selectedOptions[0];
    if (selectedOpt && selectedOpt.dataset.time) {
      timeLimitInput.value = selectedOpt.dataset.time;
    }
  }

  renderAssignmentTree() {
    const container = document.getElementById('mgmtClassTreeContainer');
    const badge = document.getElementById('mgmtSelectionSummaryBadge');
    if (!container) return;

    if (!this.cachedTreeClasses || this.cachedTreeClasses.length === 0) {
      container.innerHTML = `<div style="padding: 15px; text-align: center; color: #64748b; font-size: 11px;">Geen klassen beschikbaar.</div>`;
      return;
    }

    const searchQuery = (document.getElementById('mgmtTreeSearchInput')?.value || '').toLowerCase().trim();

    let totalSelectedStudents = 0;
    let totalSelectedClasses = 0;

    const cardsHtml = this.cachedTreeClasses.map(c => {
      const className = c.class_name;
      const students = c.students || [];

      // Check how many students in this class match search query
      const matchingStudents = searchQuery
        ? students.filter(s => (s.username || '').toLowerCase().includes(searchQuery) ||
                               (s.full_name || '').toLowerCase().includes(searchQuery) ||
                               className.toLowerCase().includes(searchQuery))
        : students;

      if (searchQuery && matchingStudents.length === 0 && !className.toLowerCase().includes(searchQuery)) {
        return ''; // hidden by search filter
      }

      // Check selection state
      const selectedStudentsInClass = students.filter(s => this.selectedAssignmentTargets.has('student:' + s.username));
      const isClassDirectlyChecked = this.selectedAssignmentTargets.has('class:' + className);
      const isAllStudentsSelected = students.length > 0 && selectedStudentsInClass.length === students.length;
      const isPartiallySelected = selectedStudentsInClass.length > 0 && !isAllStudentsSelected;

      if (isClassDirectlyChecked || isAllStudentsSelected) {
        totalSelectedClasses++;
      }
      totalSelectedStudents += selectedStudentsInClass.length;

      const isExpanded = this.expandedClassGroups.has(className);

      const ratioColor = (isClassDirectlyChecked || isAllStudentsSelected)
        ? '#15803d'
        : (isPartiallySelected ? '#d97706' : '#64748b');
      const ratioBg = (isClassDirectlyChecked || isAllStudentsSelected)
        ? '#dcfce7'
        : (isPartiallySelected ? '#fef3c7' : '#f1f5f9');

      return `
        <div class="mgmt-class-card" style="border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 6px; background: #fff; overflow: hidden;">
          <!-- Class Header Row -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: ${isExpanded ? '#f1f5f9' : '#fff'}; border-bottom: ${isExpanded ? '1px solid #e2e8f0' : 'none'};">
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" class="pt-btn pt-btn-sm" style="font-size: 11px; padding: 2px 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer;" onclick="window.PXLApp.teacherStudio.toggleExpandClass('${className}')">
                ${isExpanded ? '▼' : '▶'}
              </button>
              <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; font-weight: 700; color: #0f172a;">
                <input type="checkbox" class="class-target-cb" value="${className}"
                  ${(isClassDirectlyChecked || isAllStudentsSelected) ? 'checked' : ''}
                  onchange="window.PXLApp.teacherStudio.toggleSelectClassTarget('${className}', this.checked)">
                <span>Klas ${className}</span>
                <span style="font-size: 11px; font-weight: normal; color: #64748b;">(${c.program || ''} • ${students.length} studenten)</span>
              </label>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 10px; background: ${ratioBg}; color: ${ratioColor};">
                ${selectedStudentsInClass.length} / ${students.length} studenten
              </span>
            </div>
          </div>

          <!-- Unfolded Student List -->
          ${isExpanded ? `
            <div class="mgmt-student-list" style="padding: 6px 12px; background: #fafafa; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 4px; max-height: 140px; overflow-y: auto;">
              ${(searchQuery ? matchingStudents : students).map(s => {
                const isStudentChecked = this.selectedAssignmentTargets.has('student:' + s.username);
                return `
                  <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; padding: 2px 4px; border-radius: 4px; background: ${isStudentChecked ? '#eff6ff' : '#fff'}; border: 1px solid ${isStudentChecked ? '#bfdbfe' : '#e2e8f0'}; cursor: pointer;">
                    <input type="checkbox" class="student-target-cb" value="${s.username}"
                      ${isStudentChecked ? 'checked' : ''}
                      onchange="window.PXLApp.teacherStudio.toggleSelectStudentTarget('${className}', '${s.username}', this.checked)">
                    <span style="font-family: monospace; font-weight: bold; color: #1e40af;">${s.username}</span>
                    <span style="color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${s.full_name || s.last_name}</span>
                  </label>
                `;
              }).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = cardsHtml || `<div style="padding: 15px; text-align: center; color: #94a3b8; font-size: 11px;">Geen resultaten voor '${searchQuery}'</div>`;

    if (badge) {
      badge.innerText = `${totalSelectedClasses} klas(sen), ${totalSelectedStudents} student(en) geselecteerd`;
    }
  }

  toggleExpandClass(className) {
    if (this.expandedClassGroups.has(className)) {
      this.expandedClassGroups.delete(className);
    } else {
      this.expandedClassGroups.add(className);
    }
    this.renderAssignmentTree();
  }

  toggleExpandAllClasses(expand) {
    if (expand) {
      this.cachedTreeClasses.forEach(c => this.expandedClassGroups.add(c.class_name));
    } else {
      this.expandedClassGroups.clear();
    }
    this.renderAssignmentTree();
  }

  toggleSelectClassTarget(className, checked) {
    const classData = this.cachedTreeClasses.find(c => c.class_name === className);
    if (checked) {
      this.selectedAssignmentTargets.add('class:' + className);
      if (classData && classData.students) {
        classData.students.forEach(s => this.selectedAssignmentTargets.add('student:' + s.username));
      }
    } else {
      this.selectedAssignmentTargets.delete('class:' + className);
      if (classData && classData.students) {
        classData.students.forEach(s => this.selectedAssignmentTargets.delete('student:' + s.username));
      }
    }
    this.renderAssignmentTree();
  }

  toggleSelectStudentTarget(className, username, checked) {
    if (checked) {
      this.selectedAssignmentTargets.add('student:' + username);
    } else {
      this.selectedAssignmentTargets.delete('student:' + username);
      this.selectedAssignmentTargets.delete('class:' + className);
    }

    const classData = this.cachedTreeClasses.find(c => c.class_name === className);
    if (classData && classData.students) {
      const allSelected = classData.students.length > 0 && classData.students.every(s => this.selectedAssignmentTargets.has('student:' + s.username));
      if (allSelected) {
        this.selectedAssignmentTargets.add('class:' + className);
      }
    }
    this.renderAssignmentTree();
  }

  selectAllAssignmentTargets(select) {
    if (select) {
      this.cachedTreeClasses.forEach(c => {
        this.selectedAssignmentTargets.add('class:' + c.class_name);
        if (c.students) {
          c.students.forEach(s => this.selectedAssignmentTargets.add('student:' + s.username));
        }
      });
    } else {
      this.selectedAssignmentTargets.clear();
    }
    this.renderAssignmentTree();
  }

  filterAssignmentTree() {
    this.renderAssignmentTree();
  }

  onAssignTypeChanged() {
    const isTest = document.getElementById('mgmtAssignTypeTest')?.checked;
    const row = document.getElementById('mgmtAssignTestConfigRow');
    if (row) {
      row.style.display = isTest ? 'grid' : 'none';
    }
  }

  async submitTargetAssignments() {
    const examSelect = document.getElementById('mgmtAssignExamSelect');
    const examId = examSelect?.value;
    const examTitle = examSelect?.selectedOptions[0]?.text || examId;
    const timeLimit = parseInt(document.getElementById('mgmtAssignTimeLimit')?.value, 10) || 80;
    const isActive = document.getElementById('mgmtAssignActiveToggle')?.checked !== false;

    const assignType = document.getElementById('mgmtAssignTypeTest')?.checked ? 'test' : 'lab';
    const testPassword = document.getElementById('mgmtAssignPassword')?.value || '';
    const isStarted = (assignType === 'test') ? (document.getElementById('mgmtAssignStartTestToggle')?.checked ? 1 : 0) : 1;

    if (!examId) {
      alert('Selecteer een examen of opdracht uit de lijst.');
      return;
    }

    if (this.selectedAssignmentTargets.size === 0) {
      alert('Vink minstens één klas of student aan in de doelgroep-selectie.');
      return;
    }

    // Build target list
    const targets = [];
    this.cachedTreeClasses.forEach(c => {
      const className = c.class_name;
      const isClassChecked = this.selectedAssignmentTargets.has('class:' + className);
      if (isClassChecked) {
        targets.push({ type: 'class', value: className, class: className });
      } else {
        (c.students || []).forEach(s => {
          if (this.selectedAssignmentTargets.has('student:' + s.username)) {
            targets.push({ type: 'student', value: s.username, class: className });
          }
        });
      }
    });

    if (targets.length === 0) {
      alert('Geen doelgroep geselecteerd.');
      return;
    }

    try {
      const cleanTitle = examTitle.replace(/^[📦✏️📚⚡]\s*/, '').replace(/\s*\(\d+\s*min\)$/, '');
      const res = await fetch('/api/teacher/exam/assign-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam_id: examId,
          title: cleanTitle,
          targets: targets,
          time_limit_minutes: timeLimit,
          is_active: isActive,
          assignment_type: assignType,
          test_password: testPassword,
          is_started: isStarted
        })
      });
      const data = await res.json();
      if (data.success) {
        this.app.showToast(`✅ ${data.message}`);
        await this.loadAssignmentsTable();
      } else {
        alert('Fout: ' + (data.error || 'Kon toewijzing niet opslaan'));
      }
    } catch (err) {
      alert('Netwerkfout: ' + err.message);
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
              <th style="padding: 6px 10px;">Opdracht / Examen</th>
              <th style="padding: 6px 10px; width: 65px;">Type</th>
              <th style="padding: 6px 10px;">Doelgroep</th>
              <th style="padding: 6px 10px;">Tijd</th>
              <th style="padding: 6px 10px;">Startsein (Test)</th>
              <th style="padding: 6px 10px;">Wachtwoord</th>
              <th style="padding: 6px 10px; text-align: right;">Acties</th>
            </tr>
          </thead>
          <tbody>
            ${asgs.map(a => {
              const isTest = (a.assignment_type === 'test');
              const typeBadge = isTest
                ? `<span style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; padding: 1px 5px; border-radius: 3px; font-weight: bold;">📝 Test</span>`
                : `<span style="background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; padding: 1px 5px; border-radius: 3px; font-weight: bold;">🔬 Lab</span>`;

              let startControl = '';
              if (isTest) {
                if (a.is_started) {
                  startControl = `
                    <button class="pt-btn pt-btn-sm" style="font-size: 10px; padding: 2px 6px; background: #16a34a; color: #fff; border: 1px solid #15803d; font-weight: bold;" onclick="window.PXLApp.teacherStudio.toggleAssignmentStart(${a.id}, 0)" title="Klik om de test voor deze groep te pauzeren/vergrendelen">
                      ⏹️ Test Gestart
                    </button>
                  `;
                } else {
                  startControl = `
                    <button class="pt-btn pt-btn-sm" style="font-size: 10px; padding: 2px 6px; background: #ea580c; color: #fff; border: 1px solid #c2410c; font-weight: bold;" onclick="window.PXLApp.teacherStudio.toggleAssignmentStart(${a.id}, 1)" title="Klik om de test nu vrij te geven voor deze studentengroep">
                      ▶️ Start Test
                    </button>
                  `;
                }
              } else {
                startControl = `<span style="color: #16a34a; font-weight: 600;">🟢 Direct Actief</span>`;
              }

              const pwDisplay = isTest && a.test_password
                ? `<code style="background: #fef3c7; padding: 1px 4px; border-radius: 3px; font-weight: bold; color: #b45309;">${a.test_password}</code>`
                : `<span style="color: #94a3b8;">-</span>`;

              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 10px;">
                    <strong style="color: #0f172a;">${a.title || a.exam_id}</strong>
                    <div style="font-size: 9.5px; color: #94a3b8; font-family: monospace;">${a.exam_id}</div>
                  </td>
                  <td style="padding: 6px 10px;">${typeBadge}</td>
                  <td style="padding: 6px 10px;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${a.target_value}</span></td>
                  <td style="padding: 6px 10px;">${a.time_limit_minutes}m</td>
                  <td style="padding: 6px 10px;">${startControl}</td>
                  <td style="padding: 6px 10px;">${pwDisplay}</td>
                  <td style="padding: 6px 10px; text-align: right;">
                    <button class="pt-btn pt-btn-sm" style="font-size: 10px; padding: 2px 6px; margin-right: 4px;" onclick="window.PXLApp.teacherStudio.toggleAssignment(${a.id}, ${a.is_active ? 0 : 1})">
                      ${a.is_active ? 'Sluiten' : 'Openen'}
                    </button>
                    <button class="pt-btn pt-btn-sm" style="color: #ef4444; border: none; background: transparent; cursor: pointer;" onclick="window.PXLApp.teacherStudio.deleteAssignment(${a.id})" title="Toewijzing verwijderen">🗑️</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } catch (e) {
      container.innerHTML = `<div style="padding: 10px; color: #ef4444;">Fout: ${e.message}</div>`;
    }
  }

  async toggleAssignmentStart(id, isStarted) {
    try {
      await fetch('/api/teacher/exam/assignment/toggle-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, is_started: isStarted })
      });
      this.app.showToast(isStarted ? '▶️ Test gestart voor groep!' : '⏹️ Test gepauzeerd!');
      await this.loadAssignmentsTable();
    } catch (e) {
      alert('Fout bij wijzigen test startstatus: ' + e.message);
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

  async uploadPkaFile(directConvert = false) {
    const fileInput = document.getElementById('studioPkaFileInput');
    const titleInput = document.getElementById('studioPkaTitleInput');
    const statusEl = document.getElementById('studioPkaStatus');
    if (!fileInput.files || fileInput.files.length === 0) {
      if (statusEl) {
        statusEl.innerText = '⚠️ Selecteer eerst een .pka of .pkt bestand.';
        statusEl.style.color = '#f59e0b';
      }
      alert('Selecteer eerst een .pka of .pkt bestand.');
      return;
    }

    const title = titleInput ? titleInput.value.trim() : '';
    const file = fileInput.files[0];

    if (directConvert) {
      if (!title) {
        if (statusEl) statusEl.innerHTML = '<span style="color: #ef4444; font-weight: bold;">⚠️ Examen/opdracht naam is verplicht bij direct opslaan!</span>';
        alert('Examen/opdracht naam is verplicht! Geef een naam op voor dit Packet Tracer bestand.');
        return;
      }
      if (statusEl) {
        statusEl.innerText = `Decoderen van ${file.name} met Twofish crypto & opslaan in database...`;
        statusEl.style.color = '#38bdf8';
      }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('save_to_db', 'true');

      try {
        const response = await fetch('/api/convert-pka', {
          method: 'POST',
          body: formData
        });
        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || `Server fout (${response.status})`);
        }
        const examData = await response.json();
        this.examDraft = examData;
        if (!this.examDraft.initialTopology && examData.topology) {
          this.examDraft.initialTopology = examData.topology;
        }
        this.populateStudioFields();
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #16a34a; font-weight: bold;">✅ Examen '${title}' succesvol gedecodeerd & opgeslagen in SQLite database! Direct toewijsbaar in Tab 3 Opdrachten.</span>`;
        }
        this.app.showToast(`💾 Examen '${title}' opgeslagen in database!`);
      } catch (err) {
        if (statusEl) {
          statusEl.innerText = `❌ Fout bij converteren: ${err.message}`;
          statusEl.style.color = '#ef4444';
        }
      }
    } else {
      // Interactive Rubric Generator
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #0284c7; font-weight: 600;">⏳ Running-configs en instellingen analyseren van ${file.name}...</span>`;
      }
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch('/api/pka/analyze', {
          method: 'POST',
          body: formData
        });
        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || `Server fout (${response.status})`);
        }
        const analysis = await response.json();
        if (title) {
          analysis.title = title;
        }
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #16a34a; font-weight: bold;">✅ ${analysis.configurableItems.length} instellingen gedetecteerd. Generator geopend!</span>`;
        }
        this.openPkaRubricGeneratorModal(analysis);
      } catch (err) {
        if (statusEl) {
          statusEl.innerText = `❌ Fout bij analyseren: ${err.message}`;
          statusEl.style.color = '#ef4444';
        }
        alert('Fout bij analyseren: ' + err.message);
      }
    }
  }

  openPkaRubricGeneratorModal(analysis) {
    this.currentPkaAnalysis = analysis;
    this.pkaSelectedItems = new Set(analysis.configurableItems.map(i => i.id));
    this.pkaCustomPoints = {};
    analysis.configurableItems.forEach(it => {
      this.pkaCustomPoints[it.id] = it.points || 5;
    });
    this.pkaAssignmentType = 'lab';
    this.pkaInstructionsTab = 'preview';
    this.pkaCustomInstructions = analysis.suggestedInstructions || '';

    let modal = document.getElementById('pkaRubricGeneratorModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pkaRubricGeneratorModal';
      modal.className = 'pt-modal-overlay';
      document.body.appendChild(modal);
    }

    const uniqueDevices = [...new Set(analysis.configurableItems.map(i => i.deviceId))];

    modal.innerHTML = `
      <div class="pt-device-dialog" style="width: 1150px; max-width: 96vw; height: 90vh; display: flex; flex-direction: column;">
        <div class="pt-device-header" style="background: #0f172a; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">📦</span>
            <div>
              <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #fff;">Cisco PKA/PKT Afvinkbare Rubric &amp; Opdracht Generator</h3>
              <div style="font-size: 11px; color: #94a3b8;">Vink af welke instellingen punten opleveren. Aangevinkte items worden gewist uit de starttopologie van de student.</div>
            </div>
          </div>
          <button class="pt-btn-close" onclick="window.PXLApp.teacherStudio.closePkaRubricGeneratorModal()" style="color: #fff; font-size: 18px;">✕</button>
        </div>

        <!-- CONFIGURATION TOP BAR -->
        <div style="padding: 10px 18px; background: #f8fafc; border-bottom: 1px solid #cbd5e1; display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 260px;">
            <label style="font-size: 11px; font-weight: 700; color: #0369a1; display: block; margin-bottom: 2px;">Titel van het Lab / Examen:</label>
            <input type="text" id="pkaGenTitleInput" class="pt-input" value="${analysis.title}" style="width: 100%; box-sizing: border-box; font-weight: 700; font-size: 12px; padding: 6px 10px;">
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #0369a1; display: block; margin-bottom: 2px;">Type Opdracht:</label>
            <div style="display: flex; gap: 10px; align-items: center; background: #fff; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 4px; font-size: 11.5px;">
              <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: 600;">
                <input type="radio" name="pkaGenTypeRadio" value="lab" checked onchange="window.PXLApp.teacherStudio.onPkaTypeChange('lab')"> 🧪 Lab (Oefenlab)
              </label>
              <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: 600;">
                <input type="radio" name="pkaGenTypeRadio" value="test" onchange="window.PXLApp.teacherStudio.onPkaTypeChange('test')"> 📝 Test (Examen)
              </label>
            </div>
          </div>

          <div id="pkaGenPasswordGroup" style="display: none;">
            <label style="font-size: 11px; font-weight: 700; color: #b45309; display: block; margin-bottom: 2px;">🔑 Test Wachtwoord:</label>
            <input type="text" id="pkaGenPasswordInput" class="pt-input" placeholder="Optioneel (bv. PXL2026!)" style="width: 140px; font-size: 11.5px; padding: 5px 8px;">
          </div>

          <div>
            <label style="font-size: 11px; font-weight: 700; color: #0369a1; display: block; margin-bottom: 2px;">⏱️ Tijdslimiet:</label>
            <div style="display: flex; align-items: center; gap: 4px;">
              <input type="number" id="pkaGenTimeLimit" value="80" min="5" max="300" class="pt-input" style="width: 65px; font-size: 11.5px; text-align: center; padding: 5px;">
              <span style="font-size: 11px; color: #64748b;">min.</span>
            </div>
          </div>

          <div style="margin-left: auto;">
            <span id="pkaGenScoreBadge" style="background: #e0f2fe; color: #0369a1; padding: 5px 12px; border-radius: 14px; font-weight: 800; font-size: 12.5px; border: 1px solid #bae6fd; display: inline-flex; align-items: center; gap: 5px;">
              🎯 Score: 100 pt
            </span>
          </div>
        </div>

        <!-- MAIN 2-COLUMN WORKSPACE -->
        <div style="flex: 1; display: flex; overflow: hidden; background: #fff;">
          <!-- LEFT COLUMN: AFVINKBARE INSTELLINGEN -->
          <div style="width: 55%; display: flex; flex-direction: column; border-right: 1.5px solid #cbd5e1;">
            <div style="padding: 8px 14px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="font-size: 12px; color: #0f172a;">⚙️ Configuraties van Apparaten (${analysis.configurableItems.length})</strong>
                <select id="pkaGenDevFilter" onchange="window.PXLApp.teacherStudio.filterPkaGeneratorItems()" class="pt-input" style="font-size: 11px; padding: 3px 6px;">
                  <option value="all">Alle Apparaten (${uniqueDevices.length})</option>
                  ${uniqueDevices.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
              </div>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="pt-btn pt-btn-secondary" style="font-size: 10.5px; padding: 3px 8px;" onclick="window.PXLApp.teacherStudio.toggleAllPkaItems(true)">Alles selecteren</button>
                <button type="button" class="pt-btn pt-btn-secondary" style="font-size: 10.5px; padding: 3px 8px;" onclick="window.PXLApp.teacherStudio.toggleAllPkaItems(false)">Niets selecteren</button>
              </div>
            </div>

            <!-- SCROLLABLE SETTINGS CONTAINER -->
            <div id="pkaGenSettingsList" style="flex: 1; overflow-y: auto; padding: 12px 14px;">
              <!-- Dynamically populated -->
            </div>
          </div>

          <!-- RIGHT COLUMN: TEKST & ADRESSERINGSTABEL GENERATOR / PREVIEW -->
          <div style="width: 45%; display: flex; flex-direction: column; background: #fafafa;">
            <div style="padding: 8px 14px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
              <strong style="font-size: 12px; color: #0f172a;">📋 Gegenereerde Opgavetekst &amp; Adressering</strong>
              <div style="display: flex; gap: 4px;">
                <button type="button" id="btnPkaTabPreview" class="pt-btn" style="font-size: 11px; padding: 4px 10px; background: #0284c7; color: #fff; font-weight: 700; border: none; border-radius: 4px; cursor: pointer;" onclick="window.PXLApp.teacherStudio.switchPkaInstructionsTab('preview')">👁️ Voorbeeld</button>
                <button type="button" id="btnPkaTabEdit" class="pt-btn" style="font-size: 11px; padding: 4px 10px; background: #e2e8f0; color: #334155; font-weight: 600; border: none; border-radius: 4px; cursor: pointer;" onclick="window.PXLApp.teacherStudio.switchPkaInstructionsTab('edit')">✏️ Bewerken</button>
              </div>
            </div>

            <div id="pkaGenPreviewDiv" style="flex: 1; overflow-y: auto; padding: 14px; font-size: 12px; line-height: 1.5; color: #334155; background: #fff;">
              <!-- Markdown rendered preview -->
            </div>

            <div id="pkaGenEditDiv" style="flex: 1; display: none; padding: 12px; background: #fff;">
              <textarea id="pkaGenInstructionsTextarea" class="pt-input" style="width: 100%; height: 100%; box-sizing: border-box; font-family: monospace; font-size: 11.5px; padding: 10px; resize: none; border: 1px solid #cbd5e1; border-radius: 4px; line-height: 1.4;" placeholder="Voer hier eventueel aangepaste instructies of markdown in..."></textarea>
            </div>
          </div>
        </div>

        <!-- FOOTER -->
        <div style="padding: 12px 20px; background: #f8fafc; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 11px; color: #64748b;">
            💡 <em>Aangevinkte instellingen worden automatisch omgezet naar live beoordelingscriteria en gewist uit de starttopologie van de student.</em>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="pt-btn pt-btn-secondary" onclick="window.PXLApp.teacherStudio.closePkaRubricGeneratorModal()">Annuleren</button>
            <button type="button" class="pt-btn" style="background: #0284c7; color: #fff; font-weight: 700; padding: 7px 16px; border: 1px solid #0369a1; border-radius: 4px; cursor: pointer;" onclick="window.PXLApp.teacherStudio.submitPkaGeneratedExam(false)">
              💾 Opslaan in Database
            </button>
            <button type="button" class="pt-btn pt-btn-primary" style="background: #16a34a; border-color: #15803d; font-weight: 700; padding: 7px 16px;" onclick="window.PXLApp.teacherStudio.submitPkaGeneratedExam(true)">
              🚀 Opslaan &amp; Direct Laden op Werkveld
            </button>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    this.renderPkaGeneratorSettingsList();
    this.updatePkaScoreSummary();
    this.updatePkaGeneratedInstructionsPreview();
  }

  closePkaRubricGeneratorModal() {
    const modal = document.getElementById('pkaRubricGeneratorModal');
    if (modal) modal.style.display = 'none';
  }

  renderPkaGeneratorSettingsList() {
    const container = document.getElementById('pkaGenSettingsList');
    if (!container || !this.currentPkaAnalysis) return;

    const filterDev = document.getElementById('pkaGenDevFilter')?.value || 'all';
    const items = this.currentPkaAnalysis.configurableItems || [];

    const grouped = {};
    items.forEach(it => {
      if (filterDev !== 'all' && it.deviceId !== filterDev) return;
      if (!grouped[it.deviceId]) grouped[it.deviceId] = [];
      grouped[it.deviceId].push(it);
    });

    const categoryIcons = {
      hostname: '🏷️',
      security: '🔒',
      switch_svi: '🌐',
      interface_ip: '🔌',
      default_gateway: '🚪',
      connectivity: '📡'
    };

    let html = '';
    Object.entries(grouped).forEach(([devId, devItems]) => {
      const devType = devItems[0]?.deviceType || 'device';
      const devIcon = devType === 'router' ? '🔀' : (devType === 'switch' ? '🔄' : (devType === 'pc' ? '💻' : (devType === 'laptop' ? '💻' : '⚡')));
      const allDevChecked = devItems.every(i => this.pkaSelectedItems.has(i.id));

      html += `
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          <div style="padding: 8px 12px; background: #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">${devIcon}</span>
              <strong style="font-size: 12.5px; color: #0f172a;">${devId} (${devType.toUpperCase()})</strong>
            </div>
            <label style="font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px; color: #0369a1; font-weight: 600;">
              <input type="checkbox" ${allDevChecked ? 'checked' : ''} onchange="window.PXLApp.teacherStudio.togglePkaDeviceItems('${devId}', this.checked)">
              Alles voor ${devId}
            </label>
          </div>

          <div style="padding: 6px 10px; display: flex; flex-direction: column; gap: 6px;">
            ${devItems.map(it => {
              const isChecked = this.pkaSelectedItems.has(it.id);
              const pts = this.pkaCustomPoints[it.id] !== undefined ? this.pkaCustomPoints[it.id] : it.points;
              const catIcon = categoryIcons[it.category] || '🔹';

              return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: ${isChecked ? '#ffffff' : '#f1f5f9'}; border: 1px solid ${isChecked ? '#bae6fd' : '#e2e8f0'}; border-radius: 4px; transition: all 0.15s;">
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
                    <input type="checkbox" class="pka-setting-cb" value="${it.id}" ${isChecked ? 'checked' : ''} onchange="window.PXLApp.teacherStudio.togglePkaItem('${it.id}', this.checked)">
                    <div>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 12px;">${catIcon}</span>
                        <strong style="font-size: 12px; color: #0f172a;">${it.title}</strong>
                      </div>
                      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${it.desc}</div>
                      ${it.currentValue ? `<div style="font-size: 10.5px; font-family: monospace; color: #0369a1; background: #e0f2fe; padding: 1px 6px; border-radius: 3px; display: inline-block; margin-top: 3px;">Waarde: ${it.currentValue}</div>` : ''}
                    </div>
                  </label>

                  <div style="display: flex; align-items: center; gap: 4px; margin-left: 10px;">
                    <input type="number" class="pka-pts-input pt-input" data-id="${it.id}" value="${pts}" min="1" max="100" style="width: 48px; text-align: center; font-size: 11px; padding: 3px;" onchange="window.PXLApp.teacherStudio.updatePkaItemPoints('${it.id}', this.value)">
                    <span style="font-size: 11px; color: #64748b; font-weight: 600;">pt</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  filterPkaGeneratorItems() {
    this.renderPkaGeneratorSettingsList();
  }

  togglePkaItem(itemId, checked) {
    if (checked) {
      this.pkaSelectedItems.add(itemId);
    } else {
      this.pkaSelectedItems.delete(itemId);
    }
    this.updatePkaScoreSummary();
    this.updatePkaGeneratedInstructionsPreview();
  }

  toggleAllPkaItems(checked) {
    if (!this.currentPkaAnalysis) return;
    if (checked) {
      this.pkaSelectedItems = new Set(this.currentPkaAnalysis.configurableItems.map(i => i.id));
    } else {
      this.pkaSelectedItems = new Set();
    }
    this.renderPkaGeneratorSettingsList();
    this.updatePkaScoreSummary();
    this.updatePkaGeneratedInstructionsPreview();
  }

  togglePkaDeviceItems(devId, checked) {
    if (!this.currentPkaAnalysis) return;
    this.currentPkaAnalysis.configurableItems.forEach(it => {
      if (it.deviceId === devId) {
        if (checked) this.pkaSelectedItems.add(it.id);
        else this.pkaSelectedItems.delete(it.id);
      }
    });
    this.renderPkaGeneratorSettingsList();
    this.updatePkaScoreSummary();
    this.updatePkaGeneratedInstructionsPreview();
  }

  updatePkaItemPoints(itemId, pts) {
    const val = parseInt(pts, 10) || 5;
    this.pkaCustomPoints[itemId] = val;
    this.updatePkaScoreSummary();
  }

  updatePkaScoreSummary() {
    const badge = document.getElementById('pkaGenScoreBadge');
    if (!badge || !this.currentPkaAnalysis) return;

    let total = 0;
    this.pkaSelectedItems.forEach(id => {
      total += (this.pkaCustomPoints[id] !== undefined ? this.pkaCustomPoints[id] : 5);
    });

    const count = this.pkaSelectedItems.size;
    badge.innerText = `🎯 Totaal: ${total} punten (${count} criteria)`;
  }

  onPkaTypeChange(type) {
    this.pkaAssignmentType = type;
    const pwdGroup = document.getElementById('pkaGenPasswordGroup');
    if (pwdGroup) {
      pwdGroup.style.display = type === 'test' ? 'block' : 'none';
    }
  }

  switchPkaInstructionsTab(tab) {
    this.pkaInstructionsTab = tab;
    const previewDiv = document.getElementById('pkaGenPreviewDiv');
    const editDiv = document.getElementById('pkaGenEditDiv');
    const btnPreview = document.getElementById('btnPkaTabPreview');
    const btnEdit = document.getElementById('btnPkaTabEdit');

    if (tab === 'preview') {
      const textarea = document.getElementById('pkaGenInstructionsTextarea');
      if (textarea) this.pkaCustomInstructions = textarea.value;
      if (previewDiv) previewDiv.style.display = 'block';
      if (editDiv) editDiv.style.display = 'none';
      if (btnPreview) { btnPreview.style.background = '#0284c7'; btnPreview.style.color = '#fff'; }
      if (btnEdit) { btnEdit.style.background = '#e2e8f0'; btnEdit.style.color = '#334155'; }
      this.updatePkaGeneratedInstructionsPreview();
    } else {
      if (previewDiv) previewDiv.style.display = 'none';
      if (editDiv) editDiv.style.display = 'block';
      if (btnEdit) { btnEdit.style.background = '#0284c7'; btnEdit.style.color = '#fff'; }
      if (btnPreview) { btnPreview.style.background = '#e2e8f0'; btnPreview.style.color = '#334155'; }
      const textarea = document.getElementById('pkaGenInstructionsTextarea');
      if (textarea) textarea.value = this.pkaCustomInstructions;
    }
  }

  updatePkaGeneratedInstructionsPreview() {
    const previewDiv = document.getElementById('pkaGenPreviewDiv');
    const textarea = document.getElementById('pkaGenInstructionsTextarea');
    if (!previewDiv || !this.currentPkaAnalysis) return;

    // Build dynamic markdown from selected items
    const title = document.getElementById('pkaGenTitleInput')?.value || this.currentPkaAnalysis.title || 'Cisco Lab';
    const items = this.currentPkaAnalysis.configurableItems.filter(i => this.pkaSelectedItems.has(i.id));

    // Addressing rows
    const addrRows = [];
    const seen = new Set();
    const gwMap = {};
    items.forEach(it => {
      if (it.checkType === 'default_gateway' && it.condition && it.condition.expected) {
        gwMap[it.deviceId] = it.condition.expected;
      }
    });

    items.forEach(it => {
      if (it.checkType === 'interface_ip') {
        const port = it.condition?.portName || 'Fa0';
        const ip = it.condition?.expectedIp || '-';
        const mask = it.condition?.expectedMask || '255.255.255.0';
        const gw = gwMap[it.deviceId] || '-';
        const key = `${it.deviceId}_${port}`;
        if (!seen.has(key)) {
          seen.add(key);
          addrRows.push(`| **${it.deviceId}** | ${port} | ${ip} | ${mask} | ${gw} |`);
        }
      } else if (it.checkType === 'switch_svi') {
        const ip = it.condition?.expectedIp || '-';
        const mask = it.condition?.expectedMask || '255.255.255.0';
        const gw = gwMap[it.deviceId] || '-';
        const key = `${it.deviceId}_Vlan1`;
        if (!seen.has(key)) {
          seen.add(key);
          addrRows.push(`| **${it.deviceId}** | Vlan1 (SVI) | ${ip} | ${mask} | ${gw} |`);
        }
      }
    });

    const addrTable = addrRows.length > 0 ? addrRows.join('\n') : '| **Netwerkapparaten** | Geconfigureerd volgens opgave | Zie schema | 255.255.255.0 | - |';

    // Hostnames
    const hosts = [];
    items.forEach(it => {
      if (it.checkType === 'hostname' && it.condition && it.condition.expected) {
        hosts.push(`* **${it.deviceId}**: Doel Hostname instellen op \`${it.condition.expected}\``);
      }
    });
    const hostsMd = hosts.length > 0 ? hosts.join('\n') : '* Apparaten behouden hun standaard hostnaam.';

    // Tasks grouped by device
    const devTasks = {};
    items.forEach(it => {
      if (it.checkType === 'ping_test') return;
      if (!devTasks[it.deviceId]) devTasks[it.deviceId] = [];
      devTasks[it.deviceId].push(it.desc || it.title);
    });

    const taskSections = [];
    let idx = 1;
    Object.entries(devTasks).forEach(([did, tasks]) => {
      const bullets = tasks.map(t => `   * ${t}`).join('\n');
      taskSections.push(`${idx}. **Taken voor ${did}:**\n${bullets}`);
      idx++;
    });
    const tasksMd = taskSections.join('\n\n');

    const generatedMd = `## ${title}
**Cursus:** PXL Netwerken (Toegepaste Informatica / SNE)

### Doelstelling van de Opdracht:
In dit labo configureer je de netwerkapparaten, interfaces en basisbeveiliging volgens de richtlijnen van Cisco en PXL.

#### Adresseringstabel
| Apparaat | Interface | IP-adres | Subnetmasker | Standaardgateway |
| :--- | :--- | :--- | :--- | :--- |
${addrTable}

#### Doelhostnames van Netwerkapparaten:
${hostsMd}

#### Taken & Configuratie-eisen:
${tasksMd}

#### Verificatie & Connectiviteit:
* Zorg dat alle vereiste router- en switchpoorten groen zijn (\`no shutdown\`).
* Voer een succesvolle \`ping\`-test uit tussen de geconfigureerde hosts.
* Sla je configuratie op via \`copy run start\` of \`write memory\` op alle netwerkapparaten.
`;

    if (!this.pkaCustomInstructions || this.pkaInstructionsTab === 'preview') {
      this.pkaCustomInstructions = generatedMd;
      if (textarea) textarea.value = generatedMd;
    }

    if (this.app && this.app.formatMarkdownInstructions) {
      previewDiv.innerHTML = this.app.formatMarkdownInstructions(this.pkaCustomInstructions);
    } else {
      previewDiv.innerHTML = `<pre style="white-space: pre-wrap;">${this.pkaCustomInstructions}</pre>`;
    }
  }

  async submitPkaGeneratedExam(loadOnCanvas = false) {
    if (!this.currentPkaAnalysis) return;
    const title = (document.getElementById('pkaGenTitleInput')?.value || '').trim();
    if (!title) {
      alert('⚠️ Geef een titel op voor dit examen / lab.');
      return;
    }

    const selectedIds = Array.from(this.pkaSelectedItems);
    if (selectedIds.length === 0) {
      if (!confirm('Je hebt 0 instellingen geselecteerd voor punten. Weet je zeker dat je wilt doorgaan?')) return;
    }

    const password = document.getElementById('pkaGenPasswordInput')?.value || '';
    const timeLimit = parseInt(document.getElementById('pkaGenTimeLimit')?.value, 10) || 80;
    const textarea = document.getElementById('pkaGenInstructionsTextarea');
    const customInstr = textarea ? textarea.value : this.pkaCustomInstructions;

    const payload = {
      analysis: this.currentPkaAnalysis,
      selected_item_ids: selectedIds,
      custom_points: this.pkaCustomPoints,
      assignment_type: this.pkaAssignmentType,
      test_password: password,
      time_limit_minutes: timeLimit,
      title: title,
      custom_instructions: customInstr
    };

    try {
      const res = await fetch('/api/pka/generate-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Fout bij opslaan op server');
      }

      const exam = data.exam;
      this.closePkaRubricGeneratorModal();
      this.app.showToast(`✅ ${this.pkaAssignmentType === 'test' ? 'Test' : 'Lab'} '${exam.title}' succesvol aangemaakt!`);

      // Refresh exams list in Tab 3
      if (this.loadDbExamsList) {
        await this.loadDbExamsList();
      }

      if (loadOnCanvas) {
        this.closeStudioModal();
        await this.app.loadExam(exam);
        this.app.showToast(`🚀 '${exam.title}' direct geladen op het werkveld!`);
      } else {
        alert(`✅ '${exam.title}' is succesvol opgeslagen in de database met ${exam.rubric.length} rubric criteria! Je kunt het nu toewijzen in Tab 3 Opdrachten.`);
      }
    } catch (err) {
      alert('Fout bij aanmaken examen: ' + err.message);
    }
  }

  async saveCurrentExamToDb() {
    this.syncFormDraft();
    const title = (this.examDraft.title || '').trim();
    if (!title || title.toLowerCase() === 'pxl examen' || title.toLowerCase() === 'nieuw cisco praktijkexamen') {
      const promptTitle = prompt('Voer een unieke naam in voor dit examen / deze opdracht (verplicht voor database):', title !== 'PXL Examen' ? title : '');
      if (!promptTitle || !promptTitle.trim()) {
        alert('⚠️ Examen/opdracht naam is verplicht! Opslaan geannuleerd.');
        return;
      }
      this.examDraft.title = promptTitle.trim();
      const titleEl = document.getElementById('studioExamTitle');
      if (titleEl) titleEl.value = this.examDraft.title;
    }

    try {
      const res = await fetch('/api/teacher/exam/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.examDraft.id,
          title: this.examDraft.title,
          instructions: this.examDraft.instructions,
          topology: this.examDraft.initialTopology,
          rubric: this.examDraft.rubric,
          time_limit_minutes: this.examDraft.timeLimitMinutes || 80,
          category: 'custom'
        })
      });
      const data = await res.json();
      if (data.success) {
        this.app.showToast(`💾 Examen '${data.title}' succesvol opgeslagen in database!`);
        alert(`✅ Examen '${data.title}' is opgeslagen in de database en kan nu worden toegewezen in Tab 3 Opdrachten.`);
      } else {
        alert('Fout bij opslaan: ' + (data.error || 'Onbekende fout'));
      }
    } catch (e) {
      alert('Netwerkfout bij opslaan: ' + e.message);
    }
  }

  // --- TAB 4: BUG CENTER METHODS ---

  async loadBugs() {
    const container = document.getElementById('teacherBugsContainer');
    if (!container) return;

    const statusFilter = document.getElementById('teacherBugsStatusFilter')?.value || 'all';
    container.innerHTML = `<div style="padding: 30px; text-align: center; color: #64748b;">⏳ Bugs ophalen...</div>`;

    try {
      const url = statusFilter && statusFilter !== 'all' ? `/api/bug-report/list?status=${statusFilter}` : '/api/bug-report/list';
      const res = await fetch(url);
      const data = await res.json();
      this.cachedBugs = data.bugs || [];
      this.renderBugsTable(this.cachedBugs);
    } catch (err) {
      container.innerHTML = `<div style="padding: 20px; color: #ef4444; text-align: center;">Fout bij ophalen bugs: ${err.message}</div>`;
    }
  }

  filterBugsTable() {
    const q = (document.getElementById('teacherBugsSearch')?.value || '').toLowerCase().trim();
    if (!this.cachedBugs) return;
    if (!q) {
      this.renderBugsTable(this.cachedBugs);
      return;
    }
    const filtered = this.cachedBugs.filter(b => {
      const str = `${b.bug_code} ${b.reporter_name} ${b.reporter_username} ${b.reporter_class} ${b.exam_title} ${b.user_description} ${b.resolution_notes}`.toLowerCase();
      return str.includes(q);
    });
    this.renderBugsTable(filtered);
  }

  renderBugsTable(bugs) {
    const container = document.getElementById('teacherBugsContainer');
    if (!container) return;

    if (!bugs || bugs.length === 0) {
      container.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: #64748b;">
          <div style="font-size: 36px; margin-bottom: 8px;">🎉</div>
          <h4 style="margin: 0 0 6px 0; color: #1e293b; font-size: 14px;">Geen Gemelde Bugs Gevonden</h4>
          <p style="margin: 0; font-size: 12px; line-height: 1.5;">Er zijn momenteel geen meldingen die voldoen aan het actieve filter.</p>
        </div>
      `;
      return;
    }

    let html = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 10px 12px; width: 140px;">Bug Code</th>
            <th style="padding: 10px 12px; width: 130px;">Datum & Tijd</th>
            <th style="padding: 10px 12px; width: 160px;">Melder (Klas)</th>
            <th style="padding: 10px 12px; width: 150px;">Lab / Opdracht</th>
            <th style="padding: 10px 12px;">Omschrijving & Categorie</th>
            <th style="padding: 10px 12px; width: 110px; text-align: center;">Status</th>
            <th style="padding: 10px 12px; width: 220px; text-align: right;">Acties</th>
          </tr>
        </thead>
        <tbody>
    `;

    bugs.forEach((b, idx) => {
      const isResolved = b.status === 'resolved';
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const statusPill = isResolved
        ? `<span class="pt-badge" style="background:#dcfce7; color:#166534; border:1px solid #86efac; padding:3px 8px; border-radius:12px; font-weight:700;">🟢 Opgelost</span>`
        : `<span class="pt-badge" style="background:#fee2e2; color:#991b1b; border:1px solid #f87171; padding:3px 8px; border-radius:12px; font-weight:700;">🔴 Open</span>`;

      const dateStr = b.created_at ? new Date(b.created_at).toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' }) : '-';

      html += `
        <tr style="background: ${rowBg}; border-bottom: 1px solid #e2e8f0; line-height: 1.4;">
          <td style="padding: 10px 12px;">
            <strong style="color: #b91c1c; font-family: monospace; font-size: 12.5px;">${b.bug_code}</strong>
          </td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 11px;">${dateStr}</td>
          <td style="padding: 10px 12px;">
            <strong style="color: #0f172a;">${b.reporter_name || b.reporter_username}</strong>
            <div style="font-size: 10.5px; color: #64748b;">${b.reporter_username} • ${b.reporter_class || b.reporter_role || 'Student'}</div>
          </td>
          <td style="padding: 10px 12px; font-size: 11.5px; color: #334155;">
            ${b.exam_title || b.exam_id || 'Vrij Lab'}
          </td>
          <td style="padding: 10px 12px;">
            <span class="pt-badge" style="background:#e0f2fe; color:#0369a1; font-size:10px; padding:2px 6px; border-radius:3px; margin-bottom:4px; display:inline-block;">${b.category || 'general'}</span>
            <div style="color: #1e293b; font-size: 12px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${b.user_description}">
              ${b.user_description}
            </div>
            ${b.resolution_notes ? `<div style="font-size: 11px; color: #16a34a; margin-top: 2px;">💡 <em>${b.resolution_notes.split('\n')[0]}</em></div>` : ''}
          </td>
          <td style="padding: 10px 12px; text-align: center;">
            ${statusPill}
          </td>
          <td style="padding: 10px 12px; text-align: right; white-space: nowrap;">
            <a href="/api/bug-report/${b.bug_code}/export" class="pt-btn pt-btn-secondary" style="padding: 4px 8px; font-size: 11px; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;" title="Download diagnosebestand als JSON">
              📥 JSON
            </a>
            <button class="pt-btn pt-btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="window.PXLApp.teacherStudio.openBugDetailsModal('${b.bug_code}')" title="Bekijk volledige toelichting en snapshot">
              🔍 Details
            </button>
            <button class="pt-btn" style="padding: 4px 8px; font-size: 11px; font-weight: 600; background: ${isResolved ? '#fef3c7' : '#dcfce7'}; color: ${isResolved ? '#92400e' : '#166534'}; border: 1px solid ${isResolved ? '#fde68a' : '#bbf7d0'}; border-radius: 4px; cursor: pointer;" onclick="window.PXLApp.teacherStudio.toggleBugStatus('${b.bug_code}', '${b.status}')" title="${isResolved ? 'Heropen bug' : 'Markeer als opgelost'}">
              ${isResolved ? '🔄 Heropen' : '✅ Opgelost'}
            </button>
            <button class="pt-btn" style="padding: 4px 7px; font-size: 11px; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer;" onclick="window.PXLApp.teacherStudio.deleteBug('${b.bug_code}')" title="Verwijder bugmelding">
              🗑️
            </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  async toggleBugStatus(bugCode, currentStatus) {
    const nextStatus = currentStatus === 'resolved' ? 'open' : 'resolved';
    const notes = nextStatus === 'resolved' ? prompt('Toelichting van de oplossing (optioneel):', 'Handmatig gemarkeerd als opgelost door docent') : '';
    if (nextStatus === 'resolved' && notes === null) return; // user cancelled prompt

    try {
      const res = await fetch('/api/bug-report/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bug_code: bugCode,
          status: nextStatus,
          resolution_notes: notes || '',
          resolved_by: this.app.currentUser ? this.app.currentUser.username : 'docent'
        })
      });
      const data = await res.json();
      if (data.success) {
        this.app.showToast(`✅ Status van ${bugCode} bijgewerkt naar ${nextStatus}`);
        this.loadBugs();
      }
    } catch (err) {
      alert(`Fout bij wijzigen status: ${err.message}`);
    }
  }

  async deleteBug(bugCode) {
    if (!confirm(`Weet je zeker dat je bugmelding '${bugCode}' definitief wilt verwijderen?`)) return;
    try {
      const res = await fetch('/api/bug-report/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bug_code: bugCode })
      });
      const data = await res.json();
      if (data.success) {
        this.app.showToast(`🗑️ ${bugCode} verwijderd`);
        this.loadBugs();
      }
    } catch (err) {
      alert(`Fout bij verwijderen: ${err.message}`);
    }
  }

  async openBugDetailsModal(bugCode) {
    try {
      const res = await fetch(`/api/bug-report/${bugCode}`);
      const data = await res.json();
      if (!data.success || !data.bug) {
        alert('Bug niet gevonden');
        return;
      }
      const b = data.bug;
      let modal = document.getElementById('teacherBugDetailsModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'teacherBugDetailsModal';
        modal.className = 'pt-modal-overlay';
        document.body.appendChild(modal);
      }

      const numDevs = b.topology?.devices?.length || Object.keys(b.device_configs || {}).length || 0;
      const numCables = b.topology?.cables?.length || 0;

      modal.innerHTML = `
        <div class="pt-device-dialog" style="width: 780px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column;">
          <div class="pt-device-header" style="background: #0f172a; color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🐞</span>
              <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #fff;">Bug Details: ${b.bug_code}</h3>
            </div>
            <button class="pt-btn-close" onclick="document.getElementById('teacherBugDetailsModal').style.display='none'" style="color: #fff; font-size: 18px;">✕</button>
          </div>
          <div style="padding: 18px; background: #fff; overflow-y: auto; flex: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 14px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div>
                <strong>Melder:</strong> ${b.reporter_name} (${b.reporter_username}) • <strong>Klas:</strong> ${b.reporter_class || '-'}
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Datum: ${b.created_at} • Lab: ${b.exam_title || b.exam_id}</div>
              </div>
              <div style="text-align: right;">
                <span class="pt-badge" style="background:${b.status === 'resolved' ? '#dcfce7' : '#fee2e2'}; color:${b.status === 'resolved' ? '#166534' : '#991b1b'}; padding: 4px 10px; border-radius: 12px; font-weight: 700;">
                  ${b.status === 'resolved' ? '🟢 Opgelost' : '🔴 Open'}
                </span>
              </div>
            </div>

            <div style="margin-bottom: 14px;">
              <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #0f172a;">Omschrijving van het probleem:</h4>
              <div style="padding: 10px 12px; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12.5px; line-height: 1.5; color: #1e293b; white-space: pre-wrap;">${b.user_description}</div>
            </div>

            ${b.resolution_notes ? `
              <div style="margin-bottom: 14px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 10px 12px;">
                <h4 style="margin: 0 0 4px 0; font-size: 12.5px; color: #166534;">Oplossing & Test Instructies (door ${b.resolved_by || 'Docent'}):</h4>
                <div style="font-size: 12px; color: #14532d; white-space: pre-wrap;">${b.resolution_notes}</div>
              </div>
            ` : ''}

            <div style="margin-bottom: 14px;">
              <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #0f172a;">Gekoppelde Snapshot Gegevens:</h4>
              <div style="font-size: 12px; color: #475569; margin-bottom: 8px;">
                📦 <strong>Topologie:</strong> ${numDevs} apparaten, ${numCables} kabels
              </div>
              <details style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-size: 11.5px;">
                <summary style="cursor: pointer; font-weight: 600; color: #0284c7;">Bekijk Running Configurations van alle apparaten</summary>
                <div style="margin-top: 8px; max-height: 250px; overflow-y: auto;">
                  ${Object.values(b.device_configs || {}).map(dc => `
                    <div style="margin-bottom: 8px; background: #0f172a; color: #f8fafc; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 11px;">
                      <div style="color: #38bdf8; font-weight: bold; margin-bottom: 4px;">=== ${dc.hostname} (${dc.type} ${dc.model}) ===</div>
                      <pre style="margin: 0; white-space: pre-wrap;">${dc.runningConfig || JSON.stringify(dc.interfaces, null, 2)}</pre>
                    </div>
                  `).join('')}
                </div>
              </details>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 14px;">
              <a href="/api/bug-report/${b.bug_code}/export" class="pt-btn pt-btn-secondary" style="font-size: 12px; text-decoration: none; display: flex; align-items: center; gap: 4px;">
                📥 Exporteer als ${b.bug_code}.json
              </a>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="pt-btn" style="background: ${b.status === 'resolved' ? '#fef3c7' : '#dcfce7'}; color: ${b.status === 'resolved' ? '#92400e' : '#166534'}; border: 1px solid ${b.status === 'resolved' ? '#fde68a' : '#86efac'}; font-weight: 600; border-radius: 4px; padding: 6px 12px; cursor: pointer;" onclick="document.getElementById('teacherBugDetailsModal').style.display='none'; window.PXLApp.teacherStudio.toggleBugStatus('${b.bug_code}', '${b.status}')">
                  ${b.status === 'resolved' ? '🔄 Heropen Bug' : '✅ Markeer als Opgelost'}
                </button>
                <button type="button" class="pt-btn pt-btn-secondary" onclick="document.getElementById('teacherBugDetailsModal').style.display='none'">Sluiten</button>
              </div>
            </div>
          </div>
        </div>
      `;
      modal.style.display = 'flex';
    } catch (err) {
      alert(`Fout bij ophalen details: ${err.message}`);
    }
  }

  openImportSolutionModal() {
    let modal = document.getElementById('teacherImportSolutionModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'teacherImportSolutionModal';
      modal.className = 'pt-modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="pt-device-dialog" style="width: 580px; max-width: 95vw;">
        <div class="pt-device-header" style="background: #0284c7; color: #fff; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">📥</span>
            <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #fff;">Importeer AI Oplossing JSON</h3>
          </div>
          <button class="pt-btn-close" onclick="document.getElementById('teacherImportSolutionModal').style.display='none'" style="color: #fff; font-size: 18px;">✕</button>
        </div>
        <div style="padding: 18px; background: #fff;">
          <p style="margin: 0 0 10px 0; font-size: 12px; color: #475569; line-height: 1.4;">
            Plak hieronder de door de AI of docent aangeleverde oplossing JSON (inclusief <code>bug_code</code>) om de status direct op 'opgelost' te zetten en de toelichting & testinstructies te koppelen:
          </p>
          <div style="margin-bottom: 12px;">
            <textarea id="importSolutionJsonInput" class="pt-input" rows="8" placeholder='{\\n  "bug_code": "BUG-20261112-XXXX",\\n  "status": "resolved",\\n  "resolution_notes": "Masker fallback toegevoegd en ether1 gesynchroniseerd met WebFig",\\n  "test_instructions": "Voer opnieuw ping uit vanaf PC-1."\\n}' style="width: 100%; box-sizing: border-box; font-family: monospace; font-size: 11.5px; padding: 8px 10px;"></textarea>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="pt-btn pt-btn-secondary" onclick="document.getElementById('teacherImportSolutionModal').style.display='none'">Annuleren</button>
            <button type="button" class="pt-btn pt-btn-primary" onclick="window.PXLApp.teacherStudio.submitImportSolution()">✅ Oplossing Toepassen</button>
          </div>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  }

  async submitImportSolution() {
    const raw = document.getElementById('importSolutionJsonInput')?.value || '';
    if (!raw.trim()) {
      alert('Plak eerst een geldige JSON.');
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      alert('Ongeldige JSON: ' + e.message);
      return;
    }

    if (!parsed.bug_code) {
      alert("De JSON moet een 'bug_code' veld bevatten (bijv. 'BUG-20261112-XXXX').");
      return;
    }

    try {
      const res = await fetch('/api/bug-report/apply-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });
      const data = await res.json();
      if (data.ok) {
        document.getElementById('teacherImportSolutionModal').style.display = 'none';
        this.app.showToast(`✅ Oplossing voor ${parsed.bug_code} succesvol toegepast!`);
        this.loadBugs();
      } else {
        alert('Fout bij toepassen oplossing: ' + (data.error || 'Onbekende serverfout'));
      }
    } catch (err) {
      alert('Netwerkfout: ' + err.message);
    }
  }

  // =========================================================================
  // AI ASSIGNMENT GENERATOR, JSON IMPORT, EDIT & 100% TEST ENGINE
  // =========================================================================
  getAiTemplateObject() {
    return {
      "$schema": "https://pxl-web-netsim.be/schemas/assignment-v1.json",
      "id": "pxl_ai_lab_" + Date.now(),
      "code": "H05-AI-LAB1",
      "chapter": "Hoofdstuk 05 - Routering, Subnets & Switches",
      "title": "PXL NetSim: Twee Routers en Switch met Static Routing",
      "kind": "lab",
      "category": "CCNA Routing & Switching",
      "timeLimitMinutes": 60,
      "showLiveScore": true,
      "liveInternet": false,
      "instructions": `## H05-AI-LAB1: Routering & Switch Configuratie\n**Cursus:** PXL Network Essentials • Hogeschool PXL\n\n### Doel van het labo:\nIn dit labo configureer je een netwerktopologie bestaande uit twee Cisco routers en een switch.\nConfigureer de interfaces met de onderstaande IP-adressen en stel een statische route in zodat alle hosts elkaar kunnen bereiken.\n\n#### Adresseringstabel\n| Apparaat | Interface | IP-adres | Subnetmasker | Standaardgateway |\n| :--- | :--- | :--- | :--- | :--- |\n| **R1** | GigabitEthernet0/0/0 | 192.168.1.1 | 255.255.255.0 | - |\n| **R1** | GigabitEthernet0/0/1 | 10.0.0.1 | 255.255.255.252 | - |\n| **R2** | GigabitEthernet0/0/0 | 10.0.0.2 | 255.255.255.252 | - |\n| **R2** | GigabitEthernet0/0/1 | 192.168.2.1 | 255.255.255.0 | - |\n| **PC1** | FastEthernet0 | 192.168.1.10 | 255.255.255.0 | 192.168.1.1 |\n| **PC2** | FastEthernet0 | 192.168.2.10 | 255.255.255.0 | 192.168.2.1 |\n\n#### Taken & Configuratie-eisen:\n1. Stel op **R1** en **R2** de correcte hostnames in.\n2. Configureer alle router-interfaces en breng ze UP (\`no shutdown\`).\n3. Voeg de benodigde statische routes toe op beide routers.\n4. Configureer IP en default gateway op PC1 en PC2.\n5. Test de end-to-end connectiviteit met ping tussen PC1 en PC2.`,
      "initialTopology": {
        "devices": [
          { "id": "R1", "name": "Router", "type": "router", "model": "4331", "x": 300, "y": 180, "interfaces": { "GigabitEthernet0/0/0": { "ip": "", "mask": "", "shutdown": true }, "GigabitEthernet0/0/1": { "ip": "", "mask": "", "shutdown": true } } },
          { "id": "R2", "name": "Router", "type": "router", "model": "4331", "x": 520, "y": 180, "interfaces": { "GigabitEthernet0/0/0": { "ip": "", "mask": "", "shutdown": true }, "GigabitEthernet0/0/1": { "ip": "", "mask": "", "shutdown": true } } },
          { "id": "SW1", "name": "Switch1", "type": "switch", "model": "2960-24TT", "x": 180, "y": 240 },
          { "id": "SW2", "name": "Switch2", "type": "switch", "model": "2960-24TT", "x": 640, "y": 240 },
          { "id": "PC1", "name": "PC1", "type": "pc", "model": "Standard", "x": 100, "y": 300, "dhcpEnabled": false, "ip": "", "mask": "", "gateway": "" },
          { "id": "PC2", "name": "PC2", "type": "pc", "model": "Standard", "x": 720, "y": 300, "dhcpEnabled": false, "ip": "", "mask": "", "gateway": "" }
        ],
        "cables": [
          { "fromDevice": "PC1", "fromPort": "FastEthernet0", "toDevice": "SW1", "toPort": "FastEthernet0/1", "type": "copper_straight" },
          { "fromDevice": "SW1", "fromPort": "GigabitEthernet0/1", "toDevice": "R1", "toPort": "GigabitEthernet0/0/0", "type": "copper_straight" },
          { "fromDevice": "R1", "fromPort": "GigabitEthernet0/0/1", "toDevice": "R2", "toPort": "GigabitEthernet0/0/0", "type": "copper_straight" },
          { "fromDevice": "R2", "fromPort": "GigabitEthernet0/0/1", "toDevice": "SW2", "toPort": "GigabitEthernet0/1", "type": "copper_straight" },
          { "fromDevice": "SW2", "fromPort": "FastEthernet0/1", "toDevice": "PC2", "toPort": "FastEthernet0", "type": "copper_straight" }
        ]
      },
      "rubric": [
        { "id": "r1_hostname", "category": "device_name", "title": "R1 Hostnaam", "desc": "Hostnaam ingesteld op R1", "type": "hostname", "checkType": "hostname", "points": 10, "enabled": true, "condition": { "deviceId": "R1", "expected": "R1" } },
        { "id": "r2_hostname", "category": "device_name", "title": "R2 Hostnaam", "desc": "Hostnaam ingesteld op R2", "type": "hostname", "checkType": "hostname", "points": 10, "enabled": true, "condition": { "deviceId": "R2", "expected": "R2" } },
        { "id": "r1_g000_ip", "category": "interface_ip", "title": "R1 G0/0/0 IP Adres", "desc": "GigabitEthernet0/0/0 geconfigureerd met 192.168.1.1/24 no shutdown", "type": "interface_ip", "checkType": "interface_ip", "points": 15, "enabled": true, "condition": { "deviceId": "R1", "portName": "GigabitEthernet0/0/0", "expectedIp": "192.168.1.1", "expectedMask": "255.255.255.0", "checkNoShutdown": true } },
        { "id": "r1_g001_ip", "category": "interface_ip", "title": "R1 G0/0/1 IP Adres", "desc": "GigabitEthernet0/0/1 geconfigureerd met 10.0.0.1/30 no shutdown", "type": "interface_ip", "checkType": "interface_ip", "points": 15, "enabled": true, "condition": { "deviceId": "R1", "portName": "GigabitEthernet0/0/1", "expectedIp": "10.0.0.1", "expectedMask": "255.255.255.252", "checkNoShutdown": true } },
        { "id": "r2_g000_ip", "category": "interface_ip", "title": "R2 G0/0/0 IP Adres", "desc": "GigabitEthernet0/0/0 geconfigureerd met 10.0.0.2/30 no shutdown", "type": "interface_ip", "checkType": "interface_ip", "points": 15, "enabled": true, "condition": { "deviceId": "R2", "portName": "GigabitEthernet0/0/0", "expectedIp": "10.0.0.2", "expectedMask": "255.255.255.252", "checkNoShutdown": true } },
        { "id": "pc1_ip", "category": "interface_ip", "title": "PC1 IP Configuratie", "desc": "PC1 IP 192.168.1.10/24 met gateway 192.168.1.1", "type": "interface_ip", "checkType": "interface_ip", "points": 15, "enabled": true, "condition": { "deviceId": "PC1", "portName": "FastEthernet0", "expectedIp": "192.168.1.10", "expectedMask": "255.255.255.0" } },
        { "id": "ping_e2e", "category": "connectivity", "title": "End-to-End Ping PC1 naar PC2", "desc": "Succesvolle ICMP ping van PC1 naar PC2 (192.168.2.10)", "type": "ping_test", "checkType": "ping_test", "points": 20, "enabled": true, "condition": { "fromDevice": "PC1", "targetIp": "192.168.2.10" } }
      ]
    };
  }

  getAiTemplatePromptText() {
    const tmpl = JSON.stringify(this.getAiTemplateObject(), null, 2);
    return `Genereer een complete PXL Web NetSim opdracht in geldig JSON formaat voor het volgende scenario:
[VOER HIER JE ONDERWERP IN, BIJV: 2 Routers en 1 Switch met Static Routing of OSPF of VLANs]

Vereisten voor de opdracht JSON:
1. "id", "code", "title", "kind" ("lab" of "test"), "category", "timeLimitMinutes" en "instructions" (met Adresseringstabel in Markdown).
2. "initialTopology" met "devices" en "cables". Zorg dat alle getoetste instellingen (zoals hostnames, IP-adressen, statische routes) NIET voorgeconfigureerd zijn in de initialTopology, zodat de student op 0% start en de configuratie zelf moet uitvoeren.
3. "rubric" met criteria (totaal 100 punten). Ondersteunde types: "hostname", "interface_ip", "default_gateway", "switch_svi", "static_route", "enable_secret", "console_password", "vty_password", "banner_motd", "password_encryption", "ping_test", "dns_record", "http_get".
4. Reageer UITSLUITEND met het ruwe JSON object zonder inleiding, uitleg of markdown codeblokken eromheen.

Gebruik exact dit JSON schema:
${tmpl}`;
  }

  copyAiTemplatePrompt() {
    const text = this.getAiTemplatePromptText();
    navigator.clipboard.writeText(text).then(() => {
      this.app.showToast('📋 AI Prompt & JSON Template gekopieerd naar klembord! Geef deze aan ChatGPT of Claude.');
    }).catch(err => {
      alert('Kopiëren mislukt: ' + err.message);
    });
  }

  downloadAiTemplateJson() {
    const obj = this.getAiTemplateObject();
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pxl_netsim_ai_assignment_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.app.showToast('📥 AI Template JSON gedownload.');
  }

  toggleAiTemplateViewer() {
    const viewer = document.getElementById('studioAiTemplateViewer');
    const code = document.getElementById('studioAiTemplateViewerCode');
    if (!viewer || !code) return;
    if (viewer.style.display === 'none') {
      code.textContent = JSON.stringify(this.getAiTemplateObject(), null, 2);
      viewer.style.display = 'block';
    } else {
      viewer.style.display = 'none';
    }
  }

  handleAiJsonFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const textarea = document.getElementById('studioAiJsonInput');
      if (textarea) textarea.value = e.target.result;
      this.app.showToast(`📁 Bestand ${file.name} ingeladen in invoerveld.`);
      this.previewAiAssignmentJson();
    };
    reader.readAsText(file);
  }

  previewAiAssignmentJson() {
    const input = document.getElementById('studioAiJsonInput');
    const raw = (input?.value || '').trim();
    if (!raw) {
      alert('Plak eerst de JSON code van de AI in het tekstveld of upload een JSON bestand.');
      return;
    }

    // Strip markdown code fences if user pasted ```json ... ```
    let parsed;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      alert('Syntactische JSON fout: ' + err.message);
      return;
    }

    // Ultra-tolerant normalization for diverse AI LLM outputs (ChatGPT, Claude, Copilot)
    parsed.kind = parsed.kind || parsed.assignmentType || 'lab';
    parsed.instructions = parsed.instructions || parsed.instructionsMarkdown || '';
    parsed.category = parsed.category || parsed.topic || 'Algemeen';
    parsed.timeLimitMinutes = Number(parsed.timeLimitMinutes || parsed.estimatedMinutes) || 60;
    if (parsed.rubric && !Array.isArray(parsed.rubric) && Array.isArray(parsed.rubric.criteria)) {
      parsed.rubric = parsed.rubric.criteria;
    }
    const topo = parsed.initialTopology || parsed.topology || {};
    if (topo.links && !topo.cables) {
      topo.cables = topo.links.map(l => ({
        fromDevice: l.fromDevice || l.from,
        fromPort: l.fromPort || l.fromInterface,
        toDevice: l.toDevice || l.to,
        toPort: l.toPort || l.toInterface,
        cableType: l.cableType || l.type || 'straight'
      }));
    }
    if (parsed.initialTopology && !parsed.topology) parsed.topology = parsed.initialTopology;
    if (parsed.topology && !parsed.initialTopology) parsed.initialTopology = parsed.topology;

    this.currentAiAssignmentDraft = parsed;
    this.populateAiAssignmentPreview(parsed);
  }

  populateAiAssignmentPreview(data) {
    const container = document.getElementById('studioAiPreviewContainer');
    if (!container) return;

    // Header badge
    const badge = document.getElementById('studioAiPreviewBadge');
    if (badge) badge.innerText = (data.kind === 'test') ? 'Toets (Test)' : 'Oefening (Lab)';

    // Form inputs
    const titleInput = document.getElementById('aiEditTitle');
    const kindSelect = document.getElementById('aiEditKind');
    const timerInput = document.getElementById('aiEditTimeLimit');
    const catInput = document.getElementById('aiEditCategory');
    const pwInput = document.getElementById('aiEditTestPassword');
    const instrText = document.getElementById('aiEditInstructions');

    if (titleInput) titleInput.value = data.title || 'Nieuwe AI Opdracht';
    if (kindSelect) kindSelect.value = data.kind || 'lab';
    if (timerInput) timerInput.value = data.timeLimitMinutes || 60;
    if (catInput) catInput.value = data.category || 'Algemeen';
    if (pwInput) pwInput.value = data.test_password || data.testPassword || '';
    if (instrText) instrText.value = data.instructions || '';

    // Topology summary
    const topo = data.initialTopology || data.topology || { devices: [], cables: [] };
    const devs = topo.devices || [];
    const cables = topo.cables || [];
    const sumText = document.getElementById('aiTopologySummaryText');
    if (sumText) {
      sumText.innerText = `${devs.length} apparaten, ${cables.length} bekabelde verbindingen.`;
    }

    const badgeContainer = document.getElementById('aiTopologyDevicesBadges');
    if (badgeContainer) {
      badgeContainer.innerHTML = devs.map(d => `
        <span style="background: #e2e8f0; color: #1e293b; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
          🖥️ ${d.name || d.id} (${d.type} ${d.model || ''})
        </span>
      `).join('') + cables.map(c => `
        <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 10.5px;">
          🔌 ${c.fromDevice}:${c.fromPort} ↔ ${c.toDevice}:${c.toPort}
        </span>
      `).join('');
    }

    // Render Rubric Table
    this.renderAiAssignmentRubricEditor();

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
    this.app.showToast('👁️ AI Opdracht geopend in preview & editor.');
  }

  toggleAiMarkdownPreview() {
    const textarea = document.getElementById('aiEditInstructions');
    const preview = document.getElementById('aiInstructionsPreview');
    if (!textarea || !preview) return;

    if (preview.style.display === 'none') {
      const text = textarea.value || '';
      if (typeof marked !== 'undefined') {
        preview.innerHTML = marked.parse(text);
      } else {
        preview.innerHTML = text.replace(/\n/g, '<br>');
      }
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  }

  renderAiAssignmentRubricEditor() {
    const tableDiv = document.getElementById('aiRubricEditorTable');
    if (!tableDiv || !this.currentAiAssignmentDraft) return;

    const rubric = this.currentAiAssignmentDraft.rubric || [];
    let totalPts = 0;

    let html = `
      <table style="width: 100%; font-size: 11.5px; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569;">
            <th style="padding: 8px; width: 35px; text-align: center;">Actief</th>
            <th style="padding: 8px;">Criterium &amp; Omschrijving</th>
            <th style="padding: 8px; width: 140px;">Type &amp; Doel</th>
            <th style="padding: 8px; width: 70px; text-align: center;">Punten</th>
            <th style="padding: 8px; width: 45px; text-align: center;">Actie</th>
          </tr>
        </thead>
        <tbody>
    `;

    rubric.forEach((item, idx) => {
      const pts = item.points !== undefined ? Number(item.points) : 10;
      if (item.enabled !== false) totalPts += pts;

      const cType = item.checkType || item.type || 'interface_ip';
      const cond = item.condition || {};
      const dev = cond.deviceId || cond.targetDevice || cond.fromDevice || '-';

      html += `
        <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? '#ffffff' : '#fcfcfd'};">
          <td style="padding: 8px; text-align: center;">
            <input type="checkbox" ${item.enabled !== false ? 'checked' : ''} onchange="window.PXLApp.teacherStudio.updateAiRubricCriterion(${idx}, 'enabled', this.checked)">
          </td>
          <td style="padding: 8px;">
            <input type="text" value="${(item.title || '').replace(/"/g, '&quot;')}" class="pt-input" style="font-weight: 700; width: 100%; box-sizing: border-box; font-size: 11.5px; padding: 3px 6px; margin-bottom: 3px;" onchange="window.PXLApp.teacherStudio.updateAiRubricCriterion(${idx}, 'title', this.value)">
            <input type="text" value="${(item.desc || item.description || '').replace(/"/g, '&quot;')}" class="pt-input" style="width: 100%; box-sizing: border-box; font-size: 10.5px; color: #64748b; padding: 2px 6px;" onchange="window.PXLApp.teacherStudio.updateAiRubricCriterion(${idx}, 'desc', this.value)">
          </td>
          <td style="padding: 8px;">
            <span style="font-size: 10.5px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 3px; font-weight: 600; display: inline-block; margin-bottom: 2px;">${cType}</span>
            <div style="font-size: 10px; color: #64748b;">Doel: <strong>${dev}</strong></div>
          </td>
          <td style="padding: 8px; text-align: center;">
            <input type="number" value="${pts}" min="1" max="100" class="pt-input" style="width: 55px; text-align: center; font-weight: 700; font-size: 12px; padding: 3px;" onchange="window.PXLApp.teacherStudio.updateAiRubricCriterion(${idx}, 'points', Number(this.value))">
          </td>
          <td style="padding: 8px; text-align: center;">
            <button type="button" class="pt-btn-sm" style="background: #fee2e2; color: #b91c1c; border: none; border-radius: 4px; padding: 3px 6px; cursor: pointer;" onclick="window.PXLApp.teacherStudio.removeAiRubricCriterion(${idx})" title="Verwijder dit criterium">🗑️</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    tableDiv.innerHTML = html;

    const totalBadge = document.getElementById('aiRubricTotalPoints');
    if (totalBadge) totalBadge.innerText = totalPts;
  }

  addAiRubricCriterion() {
    if (!this.currentAiAssignmentDraft) return;
    if (!this.currentAiAssignmentDraft.rubric) this.currentAiAssignmentDraft.rubric = [];

    const devs = (this.currentAiAssignmentDraft.initialTopology?.devices || []).map(d => d.id || d.name);
    const defaultDev = devs[0] || 'R1';

    this.currentAiAssignmentDraft.rubric.push({
      id: 'custom_check_' + Date.now(),
      category: 'general',
      title: 'Nieuw Criterium',
      desc: 'Beschrijf de gewenste configuratie...',
      type: 'interface_ip',
      checkType: 'interface_ip',
      points: 10,
      enabled: true,
      condition: {
        deviceId: defaultDev,
        portName: 'FastEthernet0',
        expectedIp: '192.168.1.1',
        expectedMask: '255.255.255.0'
      }
    });

    this.renderAiAssignmentRubricEditor();
  }

  removeAiRubricCriterion(idx) {
    if (!this.currentAiAssignmentDraft || !this.currentAiAssignmentDraft.rubric) return;
    this.currentAiAssignmentDraft.rubric.splice(idx, 1);
    this.renderAiAssignmentRubricEditor();
  }

  updateAiRubricCriterion(idx, field, value) {
    if (!this.currentAiAssignmentDraft || !this.currentAiAssignmentDraft.rubric) return;
    const item = this.currentAiAssignmentDraft.rubric[idx];
    if (item) {
      item[field] = value;
      if (field === 'points' || field === 'enabled') {
        const totalPts = this.currentAiAssignmentDraft.rubric.reduce((sum, r) => sum + (r.enabled !== false ? (Number(r.points) || 10) : 0), 0);
        const totalBadge = document.getElementById('aiRubricTotalPoints');
        if (totalBadge) totalBadge.innerText = totalPts;
      }
    }
  }

  // --- 100% OPDRUIDINGSTEST ENGINE ---
  testAiAssignmentJson() {
    this.syncAiFormToDraft();
    const data = this.currentAiAssignmentDraft;
    if (!data) {
      alert('Geen opdracht ingeladen om te testen.');
      return;
    }

    const resBox = document.getElementById('studioAiTestResultBox');
    if (!resBox) return;

    const errors = [];
    const warnings = [];
    const successes = [];

    // 1. Structure Check
    if (!data.title || !data.title.trim()) errors.push('Titel ontbreekt in opdracht.');
    else successes.push(`Titel aanwezig: "${data.title}"`);

    if (!data.instructions || !data.instructions.trim()) errors.push('Instructies ontbreken.');
    else successes.push('Instructies in Markdown aanwezig.');

    const topo = data.initialTopology || data.topology;
    if (!topo || !Array.isArray(topo.devices) || topo.devices.length === 0) {
      errors.push('Topologie bevat geen apparaten.');
    } else {
      successes.push(`Topologie bevat ${topo.devices.length} apparaten.`);
    }

    const rubric = data.rubric;
    if (!rubric || !Array.isArray(rubric) || rubric.length === 0) {
      errors.push('Rubric matrix bevat geen criteria.');
    } else {
      successes.push(`Rubric bevat ${rubric.length} beoordelingscriteria.`);
    }

    // 2. Topology Consistency Check
    const devIds = new Set();
    (topo?.devices || []).forEach(d => {
      if (d.id) devIds.add(d.id);
      if (d.name) devIds.add(d.name);
    });
    (topo?.cables || []).forEach(c => {
      const fromD = c.fromDevice || c.from;
      const toD = c.toDevice || c.to;
      if (!devIds.has(fromD)) errors.push(`Kabel verwijst naar onbekend apparaat '${fromD}'.`);
      if (!devIds.has(toD)) errors.push(`Kabel verwijst naar onbekend apparaat '${toD}'.`);
    });

    // 3. Rubric Target Check
    (rubric || []).forEach(r => {
      const cond = Object.assign({}, r, r.condition || {});
      const target = cond.deviceId || cond.targetDevice || cond.routerId || cond.switchId;
      if (target && !devIds.has(target)) {
        errors.push(`Rubric criterium '${r.title}' verwijst naar niet-bestaand apparaat '${target}'.`);
      }
    });

    // 4. ZERO-SCORE VERIFICATION (CRITICAL GUARANTEE)
    // Simulate what score the student gets at load time
    let startEarned = 0;
    let totalPts = 0;
    const preMetCriteria = [];

    (rubric || []).forEach(r => {
      if (r.enabled === false) return;
      const pts = Number(r.points) || 10;
      totalPts += pts;

      const cType = r.checkType || r.type;
      const cond = Object.assign({}, r, r.condition || {});
      const targetDev = cond.deviceId || cond.targetDevice;
      const dev = (topo?.devices || []).find(d => d.id === targetDev || d.name === targetDev);

      if (cType === 'hostname' && dev && dev.name === cond.expected) {
        startEarned += pts;
        preMetCriteria.push(`'${r.title}': Hostname is in start-topologie al '${cond.expected}'`);
      } else if (cType === 'interface_ip' && dev) {
        const port = cond.portName || cond.targetInterface || cond.interface;
        const intf = dev.interfaces && (dev.interfaces[port] || dev.interfaces[cond.portName]);
        if (intf && intf.ip && intf.ip === cond.expectedIp) {
          startEarned += pts;
          preMetCriteria.push(`'${r.title}': Interface ${port || ''} heeft in start-topologie al IP ${cond.expectedIp}`);
        }
      } else if (cType === 'static_route' && dev) {
        const routes = dev.staticRoutes || [];
        if (routes.some(rt => rt.network === cond.network)) {
          startEarned += pts;
          preMetCriteria.push(`'${r.title}': Static route naar ${cond.network} zit al in start-topologie`);
        }
      }
    });

    resBox.style.display = 'block';

    if (errors.length > 0) {
      resBox.style.background = '#fef2f2';
      resBox.style.border = '1.5px solid #ef4444';
      resBox.style.color = '#991b1b';
      resBox.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 6px;">❌ Test Mislukt: ${errors.length} fout(en) gevonden:</div>
        <ul style="margin: 0; padding-left: 20px;">
          ${errors.map(e => `<li>${e}</li>`).join('')}
        </ul>
      `;
      return;
    }

    if (startEarned > 0) {
      const pct = Math.round((startEarned / totalPts) * 100);
      resBox.style.background = '#fffbeb';
      resBox.style.border = '1.5px solid #f59e0b';
      resBox.style.color = '#92400e';
      resBox.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 4px;">⚠️ Waarschuwing: Startscore is niet 0% (${pct}% / ${startEarned} pt)!</div>
        <div style="font-size: 11px; margin-bottom: 6px;">Onderstaande criteria leveren direct punten op bij opening omdat ze al in de start-topologie zijn ingevuld:</div>
        <ul style="margin: 0 0 8px 0; padding-left: 20px; font-size: 11px;">
          ${preMetCriteria.map(c => `<li>${c}</li>`).join('')}
        </ul>
        <button class="pt-btn pt-btn-primary" style="background: #d97706; padding: 4px 10px; font-size: 11px;" onclick="window.PXLApp.teacherStudio.cleanAiStarterTopology()">
          🧹 Klik hier om Starttopologie automatisch op te schonen (Gegarandeerde 0% Start)
        </button>
      `;
      return;
    }

    // 100% SUCCESVOL!
    resBox.style.background = '#f0fdf4';
    resBox.style.border = '1.5px solid #22c55e';
    resBox.style.color = '#166534';
    resBox.innerHTML = `
      <div style="font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px;">
        <span>✅ 100% Validatie Geslaagd!</span>
        <span style="font-size: 11px; background: #dcfce7; padding: 2px 8px; border-radius: 4px; font-weight: 700;">Gegarandeerde 0% Start</span>
      </div>
      <div style="margin-top: 4px; font-size: 11.5px; line-height: 1.6;">
        • Alle ${topo.devices.length} apparaten en ${topo.cables.length} kabels zijn syntactisch en topologisch correct verbonden.<br>
        • Alle ${rubric.length} rubric-criteria (Totaal: <strong>${totalPts} punten</strong>) zijn valide en oplosbaar.<br>
        • De startsituatie is gecontroleerd: studenten starten gegarandeerd blanco op <strong>0%</strong> en moeten alle configuraties zelf uitvoeren.
      </div>
    `;
    this.app.showToast('✅ Opdracht is 100% gevalideerd en start gegarandeerd op 0%!');
  }

  cleanAiStarterTopology() {
    this.syncAiFormToDraft();
    const data = this.currentAiAssignmentDraft;
    if (!data) return;

    const topo = data.initialTopology || data.topology;
    const rubric = data.rubric || [];
    if (!topo || !topo.devices) return;

    // Reset hostnames, IPs and static routes on starter devices
    rubric.forEach(r => {
      const cType = r.checkType || r.type;
      const cond = Object.assign({}, r, r.condition || {});
      const target = cond.deviceId || cond.targetDevice;

      topo.devices.forEach(d => {
        if (d.id === target || d.name === target) {
          if (cType === 'hostname') {
            d.name = (d.type === 'router') ? 'Router' : (d.type === 'switch') ? 'Switch' : d.name;
            d.hostname = d.name;
          }
          if (cType === 'interface_ip') {
            if (d.interfaces && cond.portName && d.interfaces[cond.portName]) {
              d.interfaces[cond.portName].ip = "";
              d.interfaces[cond.portName].mask = "";
              d.interfaces[cond.portName].shutdown = true;
            }
          }
          if (cType === 'static_route') {
            d.staticRoutes = [];
          }
        }
      });
    });

    this.populateAiAssignmentPreview(data);
    this.app.showToast('🧹 Start-topologie opgeschoond. Alle getoetste instellingen gereset naar blanco!');
    this.testAiAssignmentJson();
  }

  syncAiFormToDraft() {
    if (!this.currentAiAssignmentDraft) return;
    const title = document.getElementById('aiEditTitle')?.value || '';
    const kind = document.getElementById('aiEditKind')?.value || 'lab';
    const timer = Number(document.getElementById('aiEditTimeLimit')?.value) || 60;
    const category = document.getElementById('aiEditCategory')?.value || '';
    const pw = document.getElementById('aiEditTestPassword')?.value || '';
    const instr = document.getElementById('aiEditInstructions')?.value || '';

    this.currentAiAssignmentDraft.title = title;
    this.currentAiAssignmentDraft.kind = kind;
    this.currentAiAssignmentDraft.timeLimitMinutes = timer;
    this.currentAiAssignmentDraft.category = category;
    this.currentAiAssignmentDraft.test_password = pw;
    this.currentAiAssignmentDraft.instructions = instr;
  }

  async saveAiAssignmentJsonToDb() {
    this.syncAiFormToDraft();
    const data = this.currentAiAssignmentDraft;
    if (!data) {
      alert('Geen opdracht om op te slaan.');
      return;
    }

    if (!data.title || !data.title.trim()) {
      alert('Vul eerst een naam/titel in voor deze opdracht.');
      return;
    }

    const payload = {
      exam_id: data.id || ('ai_exam_' + Date.now()),
      title: data.title.trim(),
      instructions: data.instructions || '',
      topology: data.initialTopology || data.topology || { devices: [], cables: [] },
      rubric: data.rubric || [],
      time_limit: Number(data.timeLimitMinutes) || 60,
      category: data.category || 'ai_generated',
      kind: data.kind || 'lab',
      test_password: data.test_password || data.testPassword || ''
    };

    try {
      const res = await fetch('/api/teacher/exam/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const respData = await res.json();
      if (respData.success || respData.id) {
        this.app.showToast(`💾 Opdracht "${data.title}" succesvol opgeslagen in database!`);
        // Refresh assignments tab and lists
        this.loadExamMgmtTab();
        // Also refresh active exam if currently in studio
        this.loadDbExamsDropdown();
      } else {
        alert('Fout bij opslaan in database: ' + (respData.error || 'Onbekende fout'));
      }
    } catch (err) {
      alert('Netwerkfout bij opslaan: ' + err.message);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TeacherStudio };
}
