# PXL Web NetSim • CiscoExa NextGen (v2.1)
> **Online Cisco Packet Tracer Exam & Lab Simulation Platform**  
> *Ontwikkeld voor Hogeschool PXL — Departement Toegepaste Informatica / SNE (System & Network Engineering)*  
> **Auteurs & Copyright:** © David Parren (owner), Gert Van Waeyenberg, Jeroen Jean, Guido Frissaer en Kathleen Hombroeks • Hogeschool PXL

---

## 📌 Context & Waarom dit Platform?

Tijdens praktijkexamens Netwerken (zoals Cisco CCNA / NetAcad) maken we binnen **Blackboard** gebruik van **Schoolyear**. Schoolyear vergrendelt de laptop van de student volledig in een beveiligde browser-kiosk en geeft enkel toegang tot **één specifieke web-URL**.

### Het Probleem met Desktop Cisco Packet Tracer
Wanneer studenten de native desktopversie van Cisco Packet Tracer draaien, moet de Schoolyear lockdown worden doorbroken of versoepeld. Hierdoor behouden studenten toegang tot:
1. Lokale bestanden en samenvattingen op hun harde schijf.
2. Lokale AI-assistenten en code-modellen (GitHub Copilot, Ollama, LM Studio, lokale LLM's).
3. Externe communicatiekanalen.

### De Oplossing: PXL Web NetSim
**PXL Web NetSim** brengt de volledige Packet Tracer simulatie- en examenervaring naar de browser op **één enkele URL**:
- Draait 100% binnen de beveiligde Schoolyear kiosk-browser.
- Geen externe software of installaties nodig op studentenlaptops.
- Biedt een authentieke Cisco Packet Tracer interface (officiële Cisco symbolen, grid-canvas, dynamische bekabeling, fysieke chassis, Cisco IOS CLI en PC desktop).
- Inclusief **Teacher Studio** waarmee docenten in enkele klikken nieuwe examens kunnen ontwerpen, punten per commando kunnen instellen en bestaande `.pka` bestanden kunnen importeren!
- Bevat **Server Services** (HTTP Webserver, DNS Service, FTP Server) en PC **Web Browser** en **FTP Client**.
- Volledige **SQLite persistentie met 1-minuut auto-save** en docenten monitoring via CSV-import.

---

## 🚀 Overzicht van Functionaliteiten

| Module | Eigenschappen |
| :--- | :--- |
| **Topologie & Canvas** | Dynamische canvas met zoom, pan, selectie, grid snap, officiële Cisco SVG iconen, real-time link LED's (groen/oranje/rood). |
| **Bekabeling** | Koper straight-through, crossover, console kabel, serial kabel met automatische interfacekeuze en link negotiation. |
| **Cisco IOS CLI** | CLI met `--More--` pager (Spatiebalk voor volgende pagina, Enter voor regel, `q` om af te breken), context-aware tab-completion, `?` inline syntaxhulp, command history (pijltjes), verkorte commando's (`en`, `conf t`, `sh run`, `no sh`). |
| **MikroTik RouterOS** | Volledige emulatie van de **MikroTik hEX lite (RB750r2)** met 5 FastEthernet poorten, RouterOS CLI (`/ip address add`, `/ip route add`, `/system identity`, `/export`) en **beveiligde SSH-toegang**. |
| **OpenWrt Router** | Emulatie van **OpenWrt 23.05** met BusyBox/Ash shell (`uci show network`, `uci set`, `uci commit`, `ifconfig`, `cat /etc/banner`) en LuCI webinterface. |
| **Het Internet Simulator** | Cloud device dat op het canvas gesleept kan worden. Reageert met 100% succes op **ALLE IP-adressen** en toont in de browser de **"Welkom op het Internet"** webpagina met PXL-logo. |
| **Factory Reset** | Wis switch/router configuratie via `write erase` / `erase startup-config` / `reload` én via de fysieke "Wis Config" knop in de GUI. |
| **Server Services** | Server-PT ondersteunt **HTTP Webserver** (met bewerkbare `index.html`), **DNS Service** (A-records met dynamische domeinnaamresolutie) en **FTP Service** (gebruikersbeheer en bestandsopslag). |
| **PC & Laptop Desktop** | Command Prompt (`ping`, `traceroute`, `ipconfig`, `nslookup`, `ssh admin@<ip>`, `ftp`), IP Configuration, PC Wireless WPA2 utility en **Web Browser** app met HTTP URL browsing. |
| **Opdracht Dropdown** | Altijd toegankelijk via de header: toont opgave, netwerkschema, adresseringstabel en live rubric checklist. |
| **Database & Accounts** | SQLite database (`data/netsim.db`) met gehashte wachtwoorden, studentensessies, en **automatische auto-save elke 60 seconden**. |
| **Teacher Studio** | Beveiligd met docentenlogin (`teacher` / `SinterklaasOp6December`), rubric score editor, live studentenmonitor en **CSV bulk student import** (`username;password;full_name;class`). |
| **Team Samenwerking** | Uitgebreide docentenhandleiding [`COLLEGA_INSTALLATIE_HANDLEIDING.md`](file:///G:/Mijn%20Drive/antigravitylogs/pxl-web-netsim/COLLEGA_INSTALLATIE_HANDLEIDING.md) met GitHub branch workflow, persoonlijke `collega-workspaces/` en 1-klik GitHub synchronisatie. |
| **Cloud Deployment** | Kant-en-klaar voor **Google Cloud Run** met Dockerfile en één-klik PowerShell script (`deploy_gcloud.ps1`). |

---

## 🛠️ Architectuur & Structuur

```
pxl-web-netsim/
├── server.py                          # Flask backend API, authenticatie & auto-save
├── Dockerfile                         # Productie container voor Google Cloud Run (Gunicorn)
├── deploy_gcloud.ps1                  # 1-klik Google Cloud deployment script
├── requirements.txt                   # flask, pycryptodome, gunicorn
├── README.md                          # Deze documentatie
├── data/
│   └── netsim.db                      # SQLite database met gebruikers en studentensaves
├── backend/
│   ├── database.py                    # SQLite persistentie engine & wachtwoord hashing
│   ├── ptcrypto.py                    # Cisco Twofish-128 crypto decoder (PT 7/8/9.0.1+)
│   ├── pka_parser.py                  # XML converter van .pka/.pkt naar WebNetSim JSON
│   └── __init__.py
├── exams/                             # Kant-en-klare examenpresets (JSON)
│   ├── 01_pxl_standard_lan_wan.json   # Volledig routing & switching lab
│   ├── 02_cabling_and_basic_config.json # Zelfstandig bekabelen proef
│   └── 03_wireless_lan_wpa2.json      # Wireless LAN & WPA2-PSK lab
└── static/
    ├── index.html                     # Hoofdapplicatie (Schoolyear single-URL ready)
    ├── img/pxl_logo.png               # Officieel PXL logo
    ├── css/
    │   ├── packet_tracer.css          # Packet Tracer interface styling & canvas
    │   ├── modal.css                  # Toestel configurator, tabs, dropdowns & browser
    │   └── terminal.css               # Cisco IOS terminal & console styling
    └── js/
        ├── app.js                     # Hoofdapplicatie controller & auto-save loop
        ├── network_simulator.js       # Packet tracer routering, switching, DNS & HTTP
        ├── cisco_device.js            # Cisco apparaat datamodel & services
        ├── cisco_cli.js               # Authentieke Cisco IOS CLI parser & pager
        ├── pc_desktop.js              # PC Desktop, Web Browser & terminal tools
        ├── canvas_workspace.js        # HTML5 Canvas interactie & bekabeling
        ├── grading_engine.js          # Real-time rubric & punten evaluatie
        └── teacher_studio.js          # Docenten studio, rubric designer & CSV import
```

---

## 🔑 Standaard Accounts & Toegang

### Docenten (Teacher Studio & Beheer)
- **Gebruikersnaam:** `teacher` • **Wachtwoord:** `SinterklaasOp6December`
- **Gebruikersnaam:** `david` • **Wachtwoord:** `PXL_Teacher2026!`

### Voorbeeld Studenten
- **Gebruikersnaam:** `student1` • **Wachtwoord:** `PXL2026!`
- **Gebruikersnaam:** `student2` • **Wachtwoord:** `PXL2026!`

*Docenten kunnen in Teacher Studio via het tabblad **"5. Studenten & CSV Import"** met één klik een volledige klaslijst importeren in het formaat:*
```csv
username;password;full_name;class
jdesmet;Geheim123!;Jan De Smet;1TIN-A
apeeters;Geheim123!;An Peeters;1TIN-A
```

---

## 📖 How-To: Installatie, AI Context & Samenwerken via GitHub

### 1. AI Context Files gebruiken (`AGENTS.md` & `ARCHITECTURE.md`)
Deze repository bevat twee gestandaardiseerde documentatiebestanden die speciaal zijn ontworpen voor naadloze samenwerking tussen docenten en AI-assistenten (zoals Google Antigravity, GitHub Copilot, Cursor of Claude):
- **[`AGENTS.md`](AGENTS.md):** Een ultra-compacte referentiekaart (< 200 regels) met de tech stack, bestandsstructuur, kern-datastructuren, forwarding-flows en strikte ontwikkelconventies. AI-agents lezen dit bestand bij aanvang van een sessie automatisch in, waardoor onnodig bestanden scannen en tokenverbruik geminimaliseerd worden.
  - *In Antigravity / Cursor / Claude Code:* Wordt automatisch geladen vanuit de hoofdmap.
  - *In GitHub Copilot (VS Code):* Typ `@workspace bekijk AGENTS.md` of voeg `#file:AGENTS.md` toe aan je prompt.
- **[`ARCHITECTURE.md`](ARCHITECTURE.md):** De diepgaande technische gids met codevoorbeelden voor het toevoegen van nieuwe CLI-commando's, nieuwe hardwaremodellen, grading-regels en simulatie-uitbreidingen.
- **Concurrency Vergrendeling (`.ai-sync/LOCK.json`):** Controleer vóór aanvang van code-aanpassingen altijd of `status` op `"FREE"` staat om merge-conflicten tussen collega's en AI-agents te vermijden.

---

### 2. Lokaal Opzetten & Uitvoeren (Stap voor Stap)
Volg onderstaande stappen om het project binnen 2 minuten lokaal draaiend te hebben:

```bash
# 1. Clone de repository
git clone https://github.com/PXLNetworkgroup/pxl-web-netsim.git
cd pxl-web-netsim

# 2. Maak een virtuele omgeving aan en activeer deze
python -m venv venv
.\venv\Scripts\activate      # Op Windows (PowerShell / CMD)
# of: source venv/bin/activate op macOS / Linux

# 3. Installeer de vereiste Python-pakketten
pip install -r requirements.txt

# 4. Start de server
python server.py
# of dubbelklik op: start_local.bat
```
Open vervolgens je browser op: **`http://localhost:8080`**.

---

### 3. Samenwerken via GitHub: Fork, Branch & Pull Request
Om aanpassingen of nieuwe labo's veilig voor te stellen voor de live productieomgeving:

1. **Maak een Fork:**
   - Navigeer naar [https://github.com/PXLNetworkgroup/pxl-web-netsim](https://github.com/PXLNetworkgroup/pxl-web-netsim).
   - Klik rechtsboven op **Fork** om een persoonlijke kopie onder jouw GitHub-account te plaatsen.
2. **Kloon jouw Fork lokaal en maak een Feature-Branch:**
   ```bash
   git clone https://github.com/<jouw-account>/pxl-web-netsim.git
   cd pxl-web-netsim
   git checkout -b feature/naam-van-jouw-wijziging
   ```
3. **Voer wijzigingen door & Test lokaal:**
   - Pas de gewenste bestanden aan conform de richtlijnen in `AGENTS.md`.
   - Voer geautomatiseerde tests uit met `pytest tests/`.
4. **Commit en Push naar jouw Fork:**
   ```bash
   git add .
   git commit -m "feat(module): duidelijke beschrijving van de toevoeging"
   git push origin feature/naam-van-jouw-wijziging
   ```
5. **Dien een Pull Request in voor de Live Omgeving:**
   - Ga op GitHub naar jouw geforkte repository en klik op **"Compare & pull request"**.
   - Selecteer als target: `PXLNetworkgroup/pxl-web-netsim` op branch `main`.
   - Voeg een toelichting toe en dien de PR in.
   - Na collegiale review door de auteurs wordt de PR gemerged, waarna de Cloud Run deployment automatisch de live web-app bijwerkt.

---

## ☁️ Implementatie naar Google Cloud (cloud.google.com)

Het platform kan met één klik live worden gebracht op **Google Cloud Run** via de meegeleverde scripts.

### Vereisten:
1. Google Cloud SDK (`gcloud`) geïnstalleerd.
2. Een Google Cloud Project met facturering gekoppeld.

### Uitvoeren:
Open PowerShell in de projectmap en voer uit:
```powershell
.\deploy_gcloud.ps1
```
Of handmatig via de CLI:
```bash
gcloud auth login
gcloud config set project UW_PROJECT_ID
gcloud run deploy pxl-web-netsim --source . --region europe-west1 --allow-unauthenticated
```
Google Cloud Run bouwt de Docker container automatisch via Cloud Build en levert een beveiligde, wereldwijd bereikbare HTTPS URL op:  
`https://pxl-web-netsim-1088457364327.europe-west1.run.app`. Deze URL kan direct in **Schoolyear** worden ingegeven.

---

## 👥 Auteurs & Licentie
Ontwikkeld voor intern onderwijs- en examenbeheer aan **Hogeschool PXL**:  
© David Parren (owner), Gert Van Waeyenberg, Jeroen Jean, Guido Frissaer en Kathleen Hombroeks  
Departement Toegepaste Informatica / System & Network Engineering (SNE)  
Campus Elfde-Linie, Hasselt, België.
