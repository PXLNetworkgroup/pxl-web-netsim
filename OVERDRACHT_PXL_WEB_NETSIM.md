# OVERDRACHT PXL WEB NETSIM • GEDEELD DOSSIER VOOR ANDER TOESTEL
**Auteurs:** David Parren, Gert Van Waeyenberg, Lode Frissaer, Jean, Hombroeks • Hogeschool PXL (Toegepaste Informatica / SNE)  
**Datum & Tijdstip Overdracht:** 10 november 2026 om 21:00  
**Status:** **100% Werkend & Operationeel** (Lokaal, GitHub & Google Cloud Run)

---

## 1. Directe Toegang & Credentials

| Dienst / Omgeving | URL / Locatie | Authenticatie & Toegang |
| :--- | :--- | :--- |
| **Google Cloud Run (Live Productie)** | [https://pxl-web-netsim-1088457364327.europe-west1.run.app](https://pxl-web-netsim-1088457364327.europe-west1.run.app) | Publiek toegankelijk (Schoolyear / Kiosk compatibel) |
| **GitHub Repository** | [https://github.com/PXLNetworkgroup/pxl-web-netsim](https://github.com/PXLNetworkgroup/pxl-web-netsim) | Public Repo • Branch `main` |
| **GitHub Account** | User: `PXLNetworkgroup` | PAT Token: *(Zie SHARED_CONTEXT.md op Google Drive)* |
| **Lokale Server** | `http://localhost:8080` | `python server.py` (poort 8080) |
| **Google Cloud Project** | Project: `precise-ether-507014-h7` | Regio: `europe-west1` • Service: `pxl-web-netsim` |
| **Docentenportaal Login** | Via knop *Docentenportaal* rechtsboven | `teacher` / `SinterklaasOp6December` |
| **Standaard Student Login** | Via login-venster | `student1` / `PXL2026!` (of bulk import CSV) |

---

## 2. Wat is er Recent Gebouwd en Opgelost?

### A. Oplossing voor "Site laadt niet meer volledig / geen objecten zichtbaar"
* **Oorzaak:** Tijdens het toevoegen van de Lab Import/Export helperfuncties in `static/js/app.js` was er op regel 393 een overtollige sluitaccolade `}` achtergebleven. Hierdoor werd de klasse `PXLNetSimApp` voortijdig gesloten en faalde de browser met `SyntaxError: Unexpected token '{' at openDeviceModal`.
* **Fix:**
  1. Overtollige `}` verwijderd uit `static/js/app.js`.
  2. Syntaxtest met `node -c` uitgevoerd over álle 16 JS-bestanden (100% OK).
  3. Browser mock-test uitgevoerd: `PXLNetSimApp successfully initialized! 6 devices, 5 cables, 12 preset exams`.
  4. Cache busters in `static/index.html` verhoogd naar `?v=20261110_v3` zodat browsers die de gecachte versie hadden direct de herstelde code laden zonder hard refresh.
  5. Gecommit (`664e952`), gepusht naar GitHub `main` en uitgerold naar Cloud Run (Revisie `pxl-web-netsim-00007-qbg`).

### B. Volledige Windows PowerShell Terminal (`powershell_engine.js`)
* Beschikbaar op alle hosts (**PC-PT**, **Laptop-PT** én **Server-PT**) onder het tabblad *Desktop*.
* Authentieke PowerShell UI: `#012456` donkerblauw thema, gele prompt `PS C:\Users\Student> ` (of `PS C:\Users\Administrator> ` op de server).
* **Ondersteunde cmdlets:**
  - Netwerk: `Get-NetIPAddress` (alias `gip`), `Get-NetIPConfiguration` (`gipconfig`), `Set-NetIPAddress`, `New-NetIPAddress`, `Set-DnsClientServerAddress`, `Resolve-DnsName`, `ipconfig` (`/all`, `/release`, `/renew`, `/flushdns`), `nslookup`.
  - Connectiviteit: `Test-NetConnection` (`tnc` met `-Port 80/53/22`), `Test-Connection` (`ping`), `tracert`.
  - Web & REST: `Invoke-WebRequest` (`iwr`, `curl`, `wget`), `Invoke-RestMethod` (`irm`).
  - L2/L3 & SSH: `Get-NetNeighbor` (`arp -a`), `Get-NetRoute` (`route print`), `ssh admin@<ip>`.
  - Systeem & Files: `Get-ChildItem` (`dir`, `ls`), `Get-Content` (`cat`, `type`), `Set-Content` (`sc`), `Get-Location` (`pwd`), `Set-Location` (`cd`), `Get-Service`, `Start-Service`, `Stop-Service`, `Get-Process`, `Clear-Host` (`cls`), `Get-Date`, `hostname`, `whoami`, `$PSVersionTable`, variabelen en tab-toets aanvulling.

### C. Twee Gescheiden Internet Apparaten op de Werkbalk
1. **🌐 `Internet (Public)` (`internet_public`):**
   - Live NAT Gateway gekoppeld aan de fysieke netwerkadapter van de server (Google Cloud Run / Host).
   - Verzoeken vanuit de gesimuleerde web browser worden via de proxy `/api/gateway/proxy` live van het echte internet opgehaald inclusief groene NAT statusbalk.
   - Pings voeren reële latentiemetingen en IP-resoluties uit via `/api/gateway/probe`.
2. **☁️ `Internet (Simulated)` (`internet_simulated`):**
   - Reageert op elk IP-adres en elke domeinnaam met de interne, veilige landingspagina *"Welkom op het Internet"* met het officiële PXL-logo.
   - 100% examenveilig en geïsoleerd.

### D. Multi-Format HTTP Webserver op Server-PT
* Het tabblad *Services -> HTTP* op de Server bevat nu een volledige multi-bestandsbeheerder:
  - Ondersteunt: `.html`, `.css`, `.json`, `.txt`, `.pkt`.
  - Standaard bestanden: `index.html`, `helloworld.html`, `style.css`, `data.json`, `info.txt`.
  - Docenten en studenten kunnen bestanden selecteren, bewerken, opslaan en nieuwe bestanden aanmaken (`+ Nieuw Bestand`).
  - URL-routing: de web browser en `Invoke-WebRequest` serveren direct het opgevraagde bestand via bv. `http://192.168.1.2/style.css` of `http://server/data.json`.

### E. Integratie van de Labs uit de Cursus (Gert Van Waeyenberg)
Bron: [https://vwgert.github.io/networksess/](https://vwgert.github.io/networksess/)
Alle onderstaande labs zijn voorgeprogrammeerd met rubrieken en selecteerbaar via de dropdown in de bovenbalk:
- `H01-Labo1`: Les 01: Rechtstreekse verbinding tussen 2 Laptops (APIPA)
- `H02-Labo1`: Les 02: Statische IP-configuratie (PC ↔ Webserver)
- `H03-PT1`: Les 03: Switch, ARP, ICMP en MAC-Address-Table
- `H04-PT1`: Les 04: DHCP, DNS en HTTP Webserver in Simulation Mode
- `H05-Labo1`: Les 05: MikroTik hEX lite als Router (4 Netwerken)
- `H05-PT1`: Les 05: Twee LANs via Eén Cisco Router (Subnets & Routing)
- `H05-PT2`: Les 05: Twee LANs via Twee Cisco Routers (Static Routing)
- `H06-PT1`: Les 06: Thuisrouter, NAT, DHCP, DNS, WiFi en WAN Internet
- `H08-Cisco`: Zelfstudie: Cisco IOS Netwerk (PC-SW-R-SW-PC) met SSH

### F. Import & Export van Labs (AI Template)
- Knoppen **📥 Import** en **📤 Export** in de bovenbalk van de applicatie.
- AI & Docenten Handleiding: [`LAB_AUTHORING_GUIDE.md`](LAB_AUTHORING_GUIDE.md)
- Schema Template: [`PXL_LAB_TEMPLATE.json`](PXL_LAB_TEMPLATE.json)

### G. Individuele Studentensessies, 10-Seconden Evaluatie & Docenten Examenbeheer (11 nov 2026)
1. **Volledige Blackboard Studentenlijsten Geïmporteerd (328 studenten):**
   - Bronbestanden: `gc_2627-GRSNE-41SNE1010_columns_2026-11-11-11-53-46.csv` (115 studenten) en `gc_2627-PBTIN-41TIN1230_columns_2026-11-11-11-52-24.csv` (213 studenten).
   - Ingeladen in SQLite database `data/netsim.db` met studentnummer / login als unieke sleutel (bv. `12603952` voor Matteo Abbiusi, `12603594` voor Mohammed Ait El Fassi).
   - Standaard studentenwachtwoord: `PXL2026!`.
2. **Tab 1 in Teacher Studio: Studenten & Klassen (Gebruikersbeheer):**
   - Live zoekbalk en klasfilter (`1SNEa`, `1SNEb`, `1TINa`, `1TINb`, etc.).
   - Manuele toevoegfunctie voor nieuwe studenten (`➕ Student Toevoegen`).
   - Manuele en bulk-verwijderfunctie (`🗑️ Verwijderen`).
   - **Verplaatsen via Dropdown:** Selecteer studenten via selectievakjes, kies een doelklas uit het dropdownmenu en klik op `Verplaatsen`.
   - Blackboard CSV-importondersteuning met directe verwerking van het PXL formaat `Achternaam (Academiejaar - Richting - Klas),Voornaam,Gebruikersnaam`.
3. **Tab 2 in Teacher Studio: Scores & Voortgang (Live Evaluatie):**
   - Multi-select filter met interactieve selectievakjes per klas (meerdere klassen tegelijk te selecteren, incl. *Alles Selecteren*).
   - Real-time scoretabel met live scores, percentages en auto-save status.
   - **Exporteerfunctie:** 1-klik exportknop die een direct in Blackboard Grade Center / Excel in te laden CSV genereert met alle kolommen.
4. **Tab 3 in Teacher Studio: Testen & Toewijzen (Openzetten, Tijdslimiet & Reset):**
   - Selecteer een examen of lab uit de cursus en stel een tijdslimiet in (bv. 80 minuten).
   - Wijs toe aan specifieke klassen of studenten d.m.v. selectievakjes.
   - Tabel met actieve toewijzingen en live Aan/Uit schakelaar.
   - **Examen Resetten:** Selecteer een of meerdere studenten om hun examenvoortgang en opgeslagen werk te wissen zodat ze met een schone lei opnieuw kunnen starten.
5. **10-Seconden Running-Config Evaluatie & Auto-Save:**
   - Evaluatie-engine scant elke 10 seconden de actieve devices en running-config.
   - Slaat topologie, rubric scores en running-config snapshots elke 10 seconden op naar de serverdatabase.
   - Studenten laden bij inloggen direct hun eigen individuele sessie en krijgen automatisch de ingestelde tijdslimiet van hun klas.
6. **Lokale Testomgeving Geconfigureerd:**
   - Python 3.12, Flask, PyCryptodome en MinGit geïnstalleerd op dit toestel.
   - 1-klik starter script `start_local.bat` toegevoegd (start direct op `http://localhost:8080`).

---

## 3. Belangrijke Bestanden & Structuur

```
G:\My Drive\antigravitylogs\pxl-web-netsim/
├── server.py                            # Flask server (API routes, proxy, probe, DB)
├── Dockerfile                           # Container definition voor Cloud Run
├── requirements.txt                     # Python packages (Flask, Werkzeug)
├── deploy_gcloud.ps1                    # One-click Cloud Run deployment script
├── git_push_pxlnetworkgroup.ps1         # One-click GitHub sync script met PAT token
├── PXL_LAB_TEMPLATE.json                # Schema template voor AI lab authoring
├── LAB_AUTHORING_GUIDE.md               # Volledige gids voor labs ontwerpen
├── COLLEGA_INSTALLATIE_HANDLEIDING.md   # Installatiegids voor collega-docenten
├── backend/
│   ├── database.py                      # SQLite database laag (accounts, auto-save, settings)
│   ├── pka_parser.py                    # Packet Tracer .pka / .pkt decrypter
├── data/
│   ├── netsim.db                        # Centrale SQLite database
│   └── course_labs/                     # Losse JSON specificaties van alle cursuslabs
└── static/
    ├── index.html                       # Hoofdinterface met layout, headers en modals
    ├── css/
    │   ├── packet_tracer.css            # Hoofdstijlen en canvas
    │   ├── modal.css                    # Modals voor apparaten en instellingen
    │   └── terminal.css                 # Monospace styling voor Cisco, MikroTik & PowerShell
    └── js/
        ├── app.js                       # Centrale app controller (v3)
        ├── canvas_workspace.js          # Canvas rendering, apparaten, kabels, pan/zoom
        ├── cisco_device.js              # Hardware state, interfaces, routingtabellen
        ├── cisco_cli.js                 # Cisco IOS parser met command completion
        ├── mikrotik_cli.js              # MikroTik RouterOS parser & SSH
        ├── openwrt_cli.js               # OpenWrt BusyBox/Ash shell
        ├── pc_desktop.js                # Windows Command Prompt & desktop apps
        ├── powershell_engine.js         # Volledige PowerShell engine met cmdlets
        ├── network_simulator.js         # L2/L3 forwarding, routing, DNS, HTTP, NAT
        ├── cabling_engine.js            # Bekabelingslogica en poortvalidatie
        ├── course_labs.js               # Ingebouwde cursuslabs repository
        ├── grading_engine.js            # Real-time automatische rubric evaluatie
        ├── submission_exporter.js       # Versleutelde examen export
        └── teacher_studio.js            # Docentenportaal & rubric editor
```

---

## 4. Hoe Verder Werken op het Andere Toestel?

### Als je lokaal wilt draaien:
```powershell
cd "G:\My Drive\antigravitylogs\pxl-web-netsim"
python server.py
# Open browser op http://localhost:8080
```

### Als je wijzigingen wilt pushen naar GitHub:
```powershell
cd "G:\My Drive\antigravitylogs\pxl-web-netsim"
git add -A
git commit -m "jouw omschrijving"
.\git_push_pxlnetworkgroup.ps1 -Token "<PAT_TOKEN_UIT_SHARED_CONTEXT>"
```

### Als je de live Google Cloud Run wilt updaten:
```powershell
cd "G:\My Drive\antigravitylogs\pxl-web-netsim"
.\deploy_gcloud.ps1
```
