# PXL Web NetSim • Openstaande To-Do Roadmap & Volgende Stappen

> **Instructie voor AI-Agent bij sessie-start:**  
> Wanneer dit project geopend wordt: lees dit bestand uit, toon de onderstaande genummerde lijst aan de gebruiker en vraag:  
> *"Welk onderdeel wil je nu aanpakken of uitrollen? (kies per nummer of combineer meerdere onderdelen tegelijk)"*.

---

### 1. 🔒 Tabbladen & Features Locken via JSON-Context
* **Wat:** De AI-prompt en de JSON-labospecificaties uitbreiden zodat een labo expliciet kan aangeven welke tabbladen en invoervelden vergrendeld zijn (bv. `"lockedTabs": ["config", "desktop"]`, `"lockedFeatures": ["gui_ip_config", "disable_config_tab"]`). De AI kan dit dan automatisch genereren bij het opstellen van een labo.
* **Locatie:** `static/js/teacher_studio.js`, `static/js/app.js`, `data/course_labs/`.

### 2. 💡 Help- & Hintfunctie voor Studenten
* **Wat:** Een interactieve helpknop in de simulator toevoegen:
  * **Contextgevoelige syntaxhulp:** Snelle cheat-sheet met basiscommando's voor het actieve toestel (Cisco IOS, RouterOS, OpenWrt Ash, PowerShell).
  * **Progressieve hints:** Studenten kunnen (optioneel met een kleine puntaftrek of gratis in vrije oefenmodus) hints opvragen per niet-behaald rubric-criterium.
* **Locatie:** `static/js/app.js`, `static/index.html`.

### 3. 🗝️ Verborgen Oplossingen (Hidden Solutions) in de Rubric
* **Wat:** Een veld `solution` / `solutionConfig` toevoegen aan de rubric-items in het JSON-formaat:
  * **Docentenweergave:** In de Teacher Studio ziet de docent direct de exacte modelcommando's (bv. `R1(config-if)# ip address 192.168.1.1 255.255.255.0`).
  * **Studentenweergave:** Standaard strikt verborgen. Kan optioneel worden vrijgegeven na inlevering van het labo als zelfcorrectie.
* **Locatie:** `static/js/grading_engine.js`, `static/js/teacher_studio.js`, `data/course_labs/`.

### 4. 💻 Netwerkconfiguratie & Toetsing via PowerShell, Linux & Python
* **Wat:** Concrete labo-oefeningen ontwerpen waarbij studenten netwerkinstellingen moeten configureren via scripttalen:
  * **PowerShell:** Interfaces configureren met `New-NetIPAddress`, gateways instellen, en connectiviteit verifiëren met `Test-Connection`.
  * **Linux CLI (Ash/Bash):** Static routes en IP's toekennen via `ip addr add` en `uci`, en connectiviteit testen.
  * **Python:** Scripts uitvoeren op PC's/servers die socket-verbindingen testen of HTTP requests simuleren.
  * **Grading-uitbreiding:** De `GradingEngine` toetst of de instellingen via deze mechanismen correct zijn doorgevoerd.
* **Locatie:** `data/course_labs/`, `static/js/grading_engine.js`, `static/js/powershell_engine.js`, `static/js/pc_desktop.js`.

### 5. 🧪 End-to-End Testsuite voor Python, Linux CLI & PowerShell
* **Wat:** Een geautomatiseerde testsuite opzetten (`tests/test_scripting_and_terminals.py`) die aantoont dat de in-browser Python-interpreter, de OpenWrt/Linux CLI en de PowerShell-engine 100% stabiel, foutloos en interactief werken.
* **Locatie:** `tests/test_scripting_and_terminals.py`.

### 6. 📚 Oefeningen Sorteren per Hoofdstuk & Cursushiërarchie
* **Wat:** 
  * In het labo-overzicht (zowel voor studenten als docenten) een accordeon- of boomstructuur tonen per hoofdstuk (H01 Introductie & APIPA, H02 Statisch IP, H03 MAC & Switching, H04 DNS/HTTP, H05 Routing & MikroTik, etc.).
  * Dit hoofdstuk-metadata (`chapter`, `courseModule`, `difficulty`) standaard opnemen in het JSON-schema en de AI-context meegeven zodat AI-gegenereerde labo's automatisch in het juiste hoofdstuk terechtkomen.
* **Locatie:** `static/js/teacher_studio.js`, `static/js/app.js`, `backend/database.py`.

### 7. 🔄 Omgekeerde Export: JSON naar Cisco Packet Tracer (`.pkt`/`.pka`)
* **Wat:** Vanuit Web NetSim een ontworpen topologie kunnen exporteren naar een fysiek Packet Tracer-bestand via `backend/pka_generator.py`.
* **Locatie:** `backend/pka_generator.py`, `static/js/app.js`.

### 8. 👥 Peer-to-Peer Lab Exchange (Labo's Delen Tussen Studenten)
* **Wat:** Studenten hun eigen gemaakte topologieën laten opslaan en met een deelknop/exportcode direct kunnen delen met medestudenten om elkaars netwerkconfiguraties te testen.
* **Locatie:** `static/js/app.js` (Student Studio), `server.py`, `backend/database.py`.

### 9. 🎛️ Oefenmodus vs. Labo-Evaluatie Modus Toggle (Optioneel)
* **Wat:** Keuze tussen Vrije Oefenmodus (onbeperkt resetten, live score en hints direct beschikbaar) en Permanente Evaluatie Modus (tijdslimiet, wachtwoordbeveiliging, oplossingen pas na indiening).

### 10. 📸 Checkpoints & Snapshots (Optioneel)
* **Wat:** Studenten met 1 klik een herstelpunt laten maken op het canvas ("Snapshot vóór routering"), zodat ze veilig kunnen experimenteren.
