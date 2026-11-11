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
          <button class="pt-tab-btn" id="tabBtnExamMgmt" onclick="window.PXLApp.teacherStudio.switchTab('exam_mgmt')">📋 3. Opdrachten</button>
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

          <!-- TAB 3: OPDRACHTEN & EXAMEN MANAGEMENT -->
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

          <!-- TAB 4: GENERAL EXAM SETTINGS -->
          <div id="studioTabGeneral" class="pt-studio-pane" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <div>
                <span style="font-size: 13px; font-weight: 700; color: #1e293b;">⚙️ Examen Ontwerpen & Opslaan</span>
                <div style="font-size: 11px; color: #64748b;">Sla ontworpen praktijkproeven op in de database zodat ze direct toewijsbaar zijn in Tab 3 Opdrachten.</div>
              </div>
              <button class="pt-btn pt-btn-primary" style="padding: 6px 16px; font-size: 12px; background: #0284c7;" onclick="window.PXLApp.teacherStudio.saveCurrentExamToDb()">
                💾 Examen Opslaan in Database
              </button>
            </div>
            <div class="pt-form-group">
              <label style="font-weight: 700;">Examen Titel * (Verplicht voor database):</label>
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
              <p style="font-size: 11px; color: #64748b; margin: 0 0 8px 0;">Upload Packet Tracer v7, v8 of v9.0.1+. Twofish decodeert de XML. Vul een verplichte naam in om direct in de database op te slaan.</p>

              <div style="margin-bottom: 8px;">
                <label style="font-size: 11px; font-weight: 700; color: #0369a1;">🏷️ Naam voor examen / opdracht * (Verplicht voor database):</label>
                <input type="text" id="studioPkaTitleInput" class="pt-input" placeholder="bv. PXL SNE - Packet Tracer Routing Lab 1" style="width: 100%; box-sizing: border-box; font-size: 12px; margin-top: 2px;">
              </div>

              <div style="display: flex; gap: 10px; align-items: center;">
                <input type="file" id="studioPkaFileInput" accept=".pka,.pkt" class="pt-file-input" style="font-size: 11px; flex: 1;">
                <button class="pt-btn pt-btn-primary" style="padding: 6px 14px; font-size: 12px; background: #0284c7;" onclick="window.PXLApp.teacherStudio.uploadPkaFile()">
                  💾 Converteer & Opslaan in Database
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
      'exam_mgmt': { pane: 'studioTabExamMgmt', btn: 'tabBtnExamMgmt' },
      'general': { pane: 'studioTabGeneral', btn: 'tabBtnGeneral' },
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
      if (!this.allDbExams || this.allDbExams.length === 0) {
        try {
          const res = await fetch('/api/teacher/exams');
          const data = await res.json();
          this.allDbExams = data.exams || [];
        } catch (e) {}
      }
      const currentExam = this.app.activeExam ? this.app.activeExam.id : '01_pxl_standard';
      let opts = '';
      if (this.allDbExams && this.allDbExams.length > 0) {
        this.allDbExams.forEach(e => {
          opts += `<option value="${e.id}" ${e.id === currentExam ? 'selected' : ''}>${e.title}</option>`;
        });
      } else {
        opts = `<option value="01_pxl_standard">01_pxl_standard (Standaard Examen)</option>`;
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

  // --- TAB 3: OPDRACHTEN & EXAMEN TOEWIJZEN ---
  async loadExamMgmtTab() {
    // 1. Fetch all exams from SQLite database (course labs, PKA imports, presets, custom)
    try {
      const res = await fetch('/api/teacher/exams');
      const data = await res.json();
      this.allDbExams = data.exams || [];
      this.populateExamSelect(this.allDbExams);
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

  async submitTargetAssignments() {
    const examSelect = document.getElementById('mgmtAssignExamSelect');
    const examId = examSelect?.value;
    const examTitle = examSelect?.selectedOptions[0]?.text || examId;
    const timeLimit = parseInt(document.getElementById('mgmtAssignTimeLimit')?.value, 10) || 80;
    const isActive = document.getElementById('mgmtAssignActiveToggle')?.checked !== false;

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
          is_active: isActive
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
    const titleInput = document.getElementById('studioPkaTitleInput');
    const statusEl = document.getElementById('studioPkaStatus');
    if (!fileInput.files || fileInput.files.length === 0) {
      statusEl.innerText = '⚠️ Selecteer eerst een .pka of .pkt bestand.';
      statusEl.style.color = '#f59e0b';
      return;
    }

    const title = titleInput ? titleInput.value.trim() : '';
    if (!title) {
      statusEl.innerHTML = '<span style="color: #ef4444; font-weight: bold;">⚠️ Examen/opdracht naam is verplicht! Vul hierboven een naam in om op te slaan in de database.</span>';
      if (titleInput) {
        titleInput.focus();
        titleInput.style.borderColor = '#ef4444';
      }
      alert('Examen/opdracht naam is verplicht! Geef een naam op voor dit Packet Tracer bestand.');
      return;
    }
    if (titleInput) titleInput.style.borderColor = '#0284c7';

    const file = fileInput.files[0];
    statusEl.innerText = `Decoderen van ${file.name} met Twofish crypto & opslaan in database...`;
    statusEl.style.color = '#38bdf8';

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
      statusEl.innerHTML = `<span style="color: #16a34a; font-weight: bold;">✅ Examen '${title}' succesvol gedecodeerd & opgeslagen in SQLite database! Direct toewijsbaar in Tab 3 Opdrachten.</span>`;
      this.app.showToast(`💾 Examen '${title}' opgeslagen in database!`);
    } catch (err) {
      statusEl.innerText = `❌ Fout bij converteren: ${err.message}`;
      statusEl.style.color = '#ef4444';
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TeacherStudio };
}
