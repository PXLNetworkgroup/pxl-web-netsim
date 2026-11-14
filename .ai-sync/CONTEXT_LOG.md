# PXL Web NetSim • Shared AI & Developer Context Log
*Dit bestand fungeert als het gedeelde geheugen tussen samenwerkende ontwikkelaars en hun respectievelijke AI-assistenten (Antigravity, GitHub Copilot, VS Code).*

---

## [2026-11-14 17:15] • ROADMAP VASTGELEGD & SESSIE-START PROTOCOL
**Auteur / Agent:** David Parren & Antigravity  
**Status Lock:** FREE (Vrijgegeven)  
**Git Branch:** `main`  
**Live Cloud Run URL:** `https://pxl-web-netsim-1088457364327.europe-west1.run.app`  

### Volgende Fase Roadmap (`TODO.md`):
De volledige backlog voor de volgende fase is vastgelegd in `TODO.md` en verankerd in `AGENTS.md`.
Bij de eerstvolgende heropening van dit project zal de agent automatisch:
1. `TODO.md` uitlezen en tonen aan de gebruiker.
2. Expliciet vragen welke onderdelen (per nummer of gecombineerd) uitgerold moeten worden alvorens actie te ondernemen.

---

## [2026-11-14 17:10] • TOESTEL-EMULATIE, MIKROTIK ROUTEROS 7.X, SERVER DNS-ZONES (FLZ/RLZ) & LABO FEATURE LOCKING
**Auteur / Agent:** David Parren & Antigravity  
**Status Lock:** FREE (Vrijgegeven na succesvolle verificatie)  
**Git Branch:** `main`  
**Live Cloud Run URL:** `https://pxl-web-netsim-1088457364327.europe-west1.run.app`  

### 1. Wat is er gebouwd en gewijzigd?
* **MikroTik RouterOS 7.x Volledige CLI Implementatie (`static/js/mikrotik_cli.js`):**
  * Authentieke hiërarchische RouterOS context-navigatie: prompts veranderen dynamisch mee (`[admin@MikroTik] >`, `[admin@MikroTik] /ip address>`, `[admin@MikroTik] /interface bridge>`, etc.).
  * Volledige ondersteuning voor `/`, `..`, relatieve submenu-commando's en absolute paden.
  * Uitgebreide commando-set:
    * `/ip address` (`print`, `add address=... interface=...`, `remove`, `set`, `enable`, `disable`).
    * `/ip route` (`print`, `add dst-address=... gateway=... distance=...`, `remove`).
    * `/interface bridge` (`add name=...`, `print`, `port add bridge=... interface=...`, `port print`).
    * `/ip pool` (`add name=... ranges=...`, `print`) & `/ip dhcp-server` (`add`, `print`, `network add`, `lease print`).
    * `/ip dhcp-client` (`add interface=... disabled=no`, `print`).
    * `/ip dns` (`print`, `set servers=...`, `static add name=... address=...`, `static print`).
    * `/ip firewall filter` & `/ip firewall nat` (`print`, `add chain=... action=...`).
    * `/system resource print` (realistische CPU-load, MIPS 24Kc architectuur, RAM, uptime, RouterOS 7.14.1).
    * `/system routerboard print`, `/system clock print`, `/system identity [print|set]`.
    * `/export [compact]`, `/ping`, `/tool traceroute`, `/system reboot`, `/system reset-configuration`.
* **Overige Toestellen Geanalyseerd & Gecompleteerd:**
  * **OpenWrt Ash Shell (`static/js/openwrt_cli.js`):** Uitgebreid met Linux netwerk- en diagnosecommando's: `traceroute`, `nslookup`, `uname -a`, `uptime`, `free`, `df -h`, `ps`.
  * **Cisco IOS, Cisco ASA, FortiGate, Palo Alto PAN-OS, OPNsense, pfSense, WatchGuard FireboxV & HPE Aruba switches:** Gecontroleerd op consistentie en 100% syntaxis-validerend gebleken.
* **Server DNS-Zones: FLZ & RLZ Ondersteuning (`static/js/cisco_device.js`, `static/js/network_simulator.js`, `static/js/app.js`):**
  * `CiscoDevice` servers beschikken nu over gestructureerde `forwardZones` (FLZ) en `reverseZones` (RLZ met `.in-addr.arpa`).
  * `NetworkSimulator.resolveDns()` detecteert reverse lookups (zowel pure IP's als `*.in-addr.arpa`) en zoekt de overeenkomstige PTR records op.
  * `nslookup` (cmd.exe) en `Resolve-DnsName` (PowerShell) tonen correct PTR antwoorden met resolved hostnames.
  * Server GUI Services tabblad (`renderServicesTab`) voorzien van FLZ en RLZ subtabs met zone-aanmaak, auto-PTR checkbox bij toevoegen van A-records, en recordbeheer.
* **Onderdelen Vergrendelen per Labo (Didactische Feature Locking):**
  * Mogelijkheid om specifieke GUI-functies per labo te blokkeren:
    * `disable_config_tab`: Vergrendelt het "Config (GUI)" tabblad en dwingt studenten naar de CLI.
    * `gui_ip_config`: Schakelt IP- en Gateway-invoervelden uit in de router/switch GUI.
    * `routing_gui`: Blokkeert het handmatig invoeren van statische routes via de GUI.
    * `desktop_ip_config`: Blokkeert handmatige IP-invoer op PC's/laptops (dwingt DHCP af).
  * Zowel globale opdracht-locks als apparaat-specifieke locks ondersteund (`isFeatureLocked()`).
  * Geïntegreerd in de `TeacherStudio` AI Assignment & Rubric Editor met 4 handige checkboxes.
  * Visuele banner in de `TeacherStudio` Labocatalogus (Tab 3) die toont welke functies vergrendeld zijn.
* **Database & Persistence:**
  * SQLite kolom `locked_features TEXT DEFAULT '[]'` toegevoegd aan `exams` tabel in `backend/database.py`.
  * `save_exam`, `get_exam_by_id` en `list_labs_catalog` slaan `lockedFeatures` op en retourneren deze.
* **Geautomatiseerde Testen (`tests/test_devices_dns_locking.py`):**
  * Unit tests voor database persistentie, MikroTik RouterOS navigatie/commando's, DNS FLZ/RLZ en feature locking slagen 100%.
  * Alle frontend JS-bestanden compileren foutloos (`node -c`).

### 2. Gewijzigde Bestanden:
* `static/js/mikrotik_cli.js` (complete RouterOS 7.14.1 rewrite)
* `static/js/openwrt_cli.js` (diagnostische tools: traceroute, nslookup, uname, free, df, ps)
* `static/js/cisco_device.js` (forwardZones, reverseZones, isFeatureLocked)
* `static/js/network_simulator.js` (resolveDns PTR lookup)
* `static/js/pc_desktop.js` & `static/js/powershell_engine.js` (nslookup/Resolve-DnsName PTR support)
* `static/js/app.js` (DNS FLZ/RLZ beheerinterface, feature locking enforcement)
* `static/js/teacher_studio.js` (feature locking selectievakjes, catalogus badges)
* `backend/database.py` (kolom `locked_features`, CRUD integratie)
* `server.py` (API mapping `locked_features`)
* `tests/test_devices_dns_locking.py` (volledige automatische testsuite)
* `.ai-sync/LOCK.json` & `.ai-sync/CONTEXT_LOG.md`

---

## [2026-11-14 15:40] • DOCENTENOMGEVING: LABO- & RUBRIC-CATALOGUS, DOCENTENBEHEER & LAATST INGELOGD
**Auteur / Agent:** David Parren & Antigravity  
**Status Lock:** FREE (Vrijgegeven na succesvolle verificatie)  
**Git Branch:** `main`  
**Live Cloud Run URL:** `https://pxl-web-netsim-1088457364327.europe-west1.run.app`  

### 1. Wat is er gebouwd en gewijzigd?
* **📚 Labo- en Rubric-Overzicht (Tab 3: `📚 3. Labo- & Rubric-Overzicht`):**
  * Geïntegreerd in de `TeacherStudio` dialog met live responsive master-detail weergave.
  * Doorzoek alle beschikbare labo's en toetsen (zowel course labs als geïmporteerde PKA's en custom opdrachten) met instant zoekbalk en categoriefilter.
  * Gedetailleerde inspectie per labo:
    * Volledige opdrachtomschrijving / instructies in gerenderde Markdown styling (adresseringstabellen, doelstellingen, taken).
    * Volledige beoordelingsrubric met puntenverdeling per criterium, categorietags, type controle en gedetailleerde voorwaarden.
    * Metadata: totaal aantal punten, aantal apparaten, apparaatmodellen, tijdslimiet, auteur en datum.
  * Directe actieknoppen per labo:
    * `🚀 Direct Toewijzen aan Klas`: switcht met 1 klik naar het toewijzingspaneel met het geselecteerde labo voorgeselecteerd.
    * `🖥️ Open Start-Topologie op Canvas`: laadt het labo onmiddellijk in de simulator om het direct visueel te inspecteren.
* **👨‍🏫 Docentenbeheer (Tab 1 Subtab: `👨‍🏫 Docentenbeheer`):**
  * Subtab-wisseling binnen Tab 1 (`🎓 Studenten & Klassen` vs `👨‍🏫 Docentenbeheer`).
  * Nieuwe docentenaccounts toevoegen: formulier voor gebruikersnaam, wachtwoord, volledige naam en departement (default: `PXL-SNE`).
  * Overzichtstabel met alle actieve docenten, departement, aanmaakdatum en laatste inlogsessie.
  * Veilig verwijderen van docentenaccounts met dubbele beveiliging:
    * Een docent kan zijn/haar eigen actieve account niet verwijderen.
    * Het laatste docentenaccount kan niet worden verwijderd (beveiliging tegen lockouts).
* **⏱️ Studentenactiviteit Bijhouden ('Laatst Ingelogd'):**
  * SQLite database migratie via `_add_column_if_not_exists`: kolom `last_login_at TIMESTAMP` toegevoegd aan tabel `users`.
  * `authenticate_user()` werkt nu bij elke succesvolle login automatisch `last_login_at = CURRENT_TIMESTAMP` bij.
  * Kolom 'Laatst Ingelogd' toegevoegd aan:
    * Het studenten- en klassenoverzicht (`loadStudentsTable`).
    * Het algemene puntenoverzicht van alle studenten (`loadScoresTable`).
    * De specifieke toetsresultatentabel per labo.
  * Visuele badges: "Nu online (< 15 min)", "Xm geleden", "Vandaag om ...", "X dagen geleden" of datum badge.
* **Geautomatiseerde Testen (`tests/test_new_teacher_features.py`):**
  * 5/5 unit tests geslaagd (docentenlijst, docenten aanmaken/verwijderen, beveiligingscontroles, labocatalogus-extractie, timestamp tracking en API endpoints).

### 2. Gewijzigde Bestanden:
* `backend/database.py` (migratie `last_login_at`, docenten CRUD functies, `list_labs_catalog`, `get_user_by_id`)
* `server.py` (API endpoints `/api/teacher/teachers`, `/api/teacher/teacher/create`, `/api/teacher/teacher/delete`, `/api/teacher/labs-catalog`)
* `static/js/teacher_studio.js` (UI layout, subtab-routing, master-detail rubric viewer, docentenbeheer formulier en tabel, `formatLastLogin`)
* `tests/test_new_teacher_features.py` (geautomatiseerde testsuite)
* `.ai-sync/LOCK.json` & `.ai-sync/CONTEXT_LOG.md`

---

## [2026-11-14 13:10] • CATEGORIE 1 BUGS/UI FIXES & ARCHITECTUUR DOCUMENTATIE (AGENTS.md & ARCHITECTURE.md)
**Auteur / Agent:** David Parren & Antigravity  
**Status Lock:** FREE (Vrijgegeven na succesvolle verificatie)  
**Git Branch:** `main`  
**Live Cloud Run URL:** `https://pxl-web-netsim-1088457364327.europe-west1.run.app`  

### 1. Wat is er gebouwd en gewijzigd?
* **Bugs & UI/UX Verbeteringen (Categorie 1):**
  * **Refresh-bug Opgelost:** `.pt-header` en `.pt-toolbar` responsive gemaakt via flex-wrapping in `static/css/packet_tracer.css`; `app.js` slaat nu actieve examen-ID, shelf-categorie en studentenidentiteit op in `localStorage` zodat de interface stabiel herstelt na F5.
  * **Drag-and-Drop Dubbelplaatsing Gefixt:** Drop-handler in `static/js/canvas_workspace.js` geïsoleerd met event stopping, automatische cleanup van pendende plaatsingsacties en een cooldown timer van 350ms. `app.js` shelf click-handlers controleren nu `isDraggingItem`.
  * **Versleepbare Apparaat-Popups:** Apparaatconfiguratie modal (`#deviceModal`) voorzien van draggable drag handle via mousedown/mousemove listeners met viewport boundary clamping en dubbelklik-reset. Overlay styling aangepast zodat het canvas op de achtergrond klikbaar en zichtbaar blijft.
  * **Toestellen Hernoemen:** Weergavenaam (`displayName`) kan nu direct worden aangepast via dubbelklik op het canvas-label, via een nieuw rechtsklik-contextmenu en via een knop "✏️ Hernoemen" in de modal header.
* **Architectuur & AI Context Documentatie:**
  * **`AGENTS.md`:** Compacte AI referentiekaart aangemaakt (strikt onder de 200 regels) met tech stack, bestandsoverzicht, kern-datastructuren, 6-staps flows, strikte conventies en concurrency-regels.
  * **`ARCHITECTURE.md`:** Uitgebreide onboarding gids voor collega-docenten en ontwikkelaars met systeemoverzicht, simulatie-engine details, stapsgewijze handleiding voor nieuwe commando's en apparaten, en grading/export documentatie.

### 2. Gewijzigde Bestanden:
* `static/css/packet_tracer.css`
* `static/css/modal.css`
* `static/js/app.js`
* `static/js/canvas_workspace.js`
* `AGENTS.md`
* `ARCHITECTURE.md`
* `.ai-sync/CONTEXT_LOG.md`
**Auteur / Agent:** David Parren & Antigravity (Host-PC)  
**Status Lock:** FREE (Vrijgegeven na succesvolle verificatie)  
**Git Branch:** `main`  
**Live Cloud Run URL:** `https://pxl-web-netsim-1088457364327.europe-west1.run.app`  

### 1. Wat is er gebouwd en gewijzigd?
* **WatchGuard FireboxV Toegevoegd (`watchguard`):**
  * Geïntegreerd in de categorie `🛡️ Firewall & Security` op de apparatenbalk.
  * Vector SVG-icoon (`CiscoIcons.watchguard`) met authentiek WatchGuard Firebox-rood (`#c8102e`), wit schild-embleem en 8 GigabitEthernet RJ-45 interfaces + Console.
  * Dedicated interfaces: `eth0 (External)`, `eth1 (Trusted)`, `eth2 (Optional)`, `eth3` t/m `eth7`.
  * Authentieke Fireware OS CLI (`WatchGuardCLIParser`): `WG>`, `WG#`, `WG(config)#`, `WG(config-if-ethX)#`, commando's `show status`, `show interface`, `show run`, `show ip route`, `interface ethX`, `ip address <ip> <mask>`, `shutdown`, `no shutdown`, `ping`.
  * **WatchGuard Fireware Web UI Tab (`modalPaneWgweb`):** Dashboard met Appliance Information (Model FireboxV, Fireware v12.10.2, CPU/Memory/Uptime), live Interface Status en Active Firewall Policies (Packet Filter & Proxy).
* **Gegarandeerde Nul-score (0%) bij Start van Alle Testen & Examens:**
  * Oorzaak opgelost: `grading_engine.js` viel bij onbekende check types terug op `passed: true` en controleerde afwijkende type-aliassen onvolledig.
  * Oorzaak opgelost: In start-topologieën van course labs stonden voorgeconfigureerde IP-adressen, hostnames of statische routes die al punten opleverden bij opening.
  * Alle 18 course lab JSON-bestanden (`data/course_labs/*.json`), de browser client repo (`static/js/course_labs.js`) én alle 26 database-examens in SQLite (`data/netsim.db`) opgeschoond.
  * 100% van alle labs en examens geauditeerd: **starten nu gegarandeerd op exact 0%**.
* **Teacher Studio Hernieuwd & AI Opdracht Generator:**
  * Tabblad "5. Examen ontwerpen" (`#studioTabGeneral`) definitief verwijderd; resterende tabs netjes genummerd 1 t/m 6.
  * Onder Tab 6 (`⚡ 6. Rubric, PKA & AI Generator`) een complete **AI Opdracht Generator** ingebouwd:
    * JSON Schema & Copilot/ChatGPT prompt template kopieerknop en downloadknop.
    * Textarea en `.json` bestandsupload voor AI-gegenereerde JSON.
    * Interactieve Markdown preview en metadata editor.
    * Dynamische Rubric matrix editor (punten wijzigen, criteria toevoegen/verwijderen).
    * Knop `🧪 Test Opdracht (100% Validatie & 0% Garantie)`: controleert apparaten, bekabeling, syntax en simuleert of de opdracht gegarandeerd op 0% start.
    * Knop `🧹 Maak Starttopologie Schoon`: stript automatisch getoetste instellingen uit het draft.
    * Knop `💾 Opslaan in Database`: maakt de opdracht direct persistent beschikbaar als Lab of Toets via `/api/teacher/exam/save`.
* **Geautomatiseerde E2E Playwright Test (`tests/test_watchguard_and_ai_generator.py`):**
  * Volledige end-to-end verificatie: WatchGuard plaatsing + CLI + Web UI, 0% startscore verificatie, tab-structuur Teacher Studio, template generatie, JSON preview & rubric editor, validatietest en DB opslag: **alle 6 stappen 100% geslaagd**.

### 2. Gewijzigde Bestanden:
* `static/index.html` (WatchGuard GUI tab & pane)
* `static/js/app.js` (WatchGuard shelf item, modal routing, terminal parser binding, `loadCourseLab`)
* `static/js/canvas_workspace.js` (WatchGuard device prefix `WatchGuardX`)
* `static/js/cisco_device.js` (WatchGuard hardware- en interface configuratie)
* `static/js/cisco_icons.js` (WatchGuard SVG vectoricoon)
* `static/js/firewall_security.js` (WatchGuardCLIParser & renderWatchGuardWebTab)
* `static/js/grading_engine.js` (0% startscore validatie, strict check defaults, interface_ip & dns verfijnd)
* `static/js/course_labs.js` & `data/course_labs/*.json` (Alle 18 labs geschoond naar 0% start)
* `data/netsim.db` (Alle 26 examens geschoond naar 0% start)
* `static/js/teacher_studio.js` (AI Opdracht Generator UI, template generator, preview editor, 100% validator, Tab 5 verwijderd)
* `.gitignore` (toegevoegd: `scratch/`)
* `tests/test_watchguard_and_ai_generator.py` (Nieuwe geautomatiseerde E2E testsuite)
* `.ai-sync/LOCK.json` & `.ai-sync/CONTEXT_LOG.md`

---

## [2026-11-12 12:10] • 6 APPARATEN-CATEGORIEËN, 5 NEXT-GEN/OPEN SOURCE FIREWALLS & SAMENWERKINGSSYSTEEM
**Auteur / Agent:** David Parren & Antigravity (Host-PC)  
**Status Lock:** FREE (Vrijgegeven na afronding)  
**Git Branch:** `main`  
**Live Cloud Run URL:** `https://pxl-web-netsim-1088457364327.europe-west1.run.app`  

### 1. Wat is er gebouwd en gewijzigd?
* **Onderste Apparatenbalk Herindeling in 6 Categorieën:**
  * Geherstructureerd in een responsieve 2-koloms grid met duidelijke iconen en badges:
    1. `🔀 Switch & Router devices` (Cisco 4331, 2911, 2960 Switch, 3560 Multilayer, Aruba 2530/2930F, MikroTik hEX lite, OpenWrt)
    2. `💻 Computer systems` (PC-PT, Laptop-PT, Server-PT)
    3. `☁️ Cloud` (Internet Simulated, Internet Public NAT, Het Internet Hybrid, Cloud WAN/ISP)
    4. `📶 Wifi` (WRT300N Router, Cisco LAP-PT AP, Cisco 3504 WLC, Home Gateway)
    5. `🔌 Cables & Patches` (Automatisch, Straight-Through, Cross-Over, Serial DCE, Console, Fiber Optic)
    6. `🛡️ Firewall & Security` (Cisco ASA, FortiGate FortiOS, Palo Alto PAN-OS, OPNsense, pfSense)
* **5 Volwaardige Firewall & Security Platformen Toegevoegd:**
  * **Cisco ASA 5506-X (`cisco_asa`):** Volledige ASA-OS CLI implementatie (`nameif outside/inside/dmz`, `security-level 0-100`, `object network`, `nat (inside,outside) dynamic interface`, `show ip address`, `show run`, `route`).
  * **Fortinet FortiGate-60F (`fortigate`):** FortiOS 7.x CLI (`config system interface`, `edit port1`, `set allowaccess`, `config firewall policy`) + moderne donkere **FortiOS Web UI Tab** met live systeemstatus en firewall policies.
  * **Palo Alto Networks PA-440 (`paloalto`):** PAN-OS 11.x CLI (`set deviceconfig`, `set network interface ethernet`, `set zone`, `commit`) + **PAN-OS Web UI Tab** met Application Command Center en Security Policies.
  * **OPNsense 24.1 (`opnsense`):** Authentieke interactieve FreeBSD console menu (opties 0-14, optie 2 interactieve IP wizard, optie 8 FreeBSD Shell `root@opnsense:~ #`) + **OPNsense Web UI Tab**.
  * **pfSense Plus 23.09 (`pfsense`):** Authentieke Netgate console menu (opties 0-16, optie 8 FreeBSD Shell `[23.09-RELEASE][root@pfSense]/root:`) + **pfSense Web UI Tab**.
* **Beveiligd Samenwerkingsprotocol (`.ai-sync/`, `AGENTS.md`):**
  * `.ai-sync/LOCK.json` voor strikte exclusieve vergrendeling tijdens actieve werkzaamheden.
  * `.ai-sync/CONTEXT_LOG.md` voor contextbehoud tussen collega's en AI-tools.
  * `AGENTS.md` en `.github/copilot-instructions.md` voor automatische naleving van de regels.
  * `PXL_NetSim_Samenwerken_Handleiding.pdf` met een complete Nederlandstalige handleiding voor het toevoegen van het project in Antigravity of VS Code.

### 2. Gewijzigde & Nieuwe Bestanden:
* `static/index.html` (Tabs en panes voor FortiGate, PAN-OS, OPNsense en pfSense Web GUIs)
* `static/css/packet_tracer.css` (2-koloms grid voor categorieën)
* `static/js/app.js` (Categorie-filtering, shelf rendering, CLI parser dispatching, Web GUI tabs)
* `static/js/cisco_device.js` (Interface- en hardware-initialisatie voor alle firewalls)
* `static/js/cisco_icons.js` (Vector SVG iconen voor alle firewalls en Cloud WAN)
* `static/js/canvas_workspace.js` (Device prefix mappings)
* `static/js/firewall_security.js` (Nieuw: alle 5 firewall CLI parsers & Web GUI renderers)
* `.ai-sync/LOCK.json` & `.ai-sync/CONTEXT_LOG.md`
* `AGENTS.md` & `.github/copilot-instructions.md`
* `PXL_NetSim_Samenwerken_Handleiding.pdf`
* `tests/test_firewall_and_shelf_categories.py` (Geautomatiseerde E2E test, 6/6 geslaagd)

---

## [2026-11-12 11:55] • INITIAL CONTEXT ENTRY
**Auteur / Agent:** David Parren & Antigravity (Host-PC)  
**Status Lock:** FREE  
**Git Branch / Commit:** `main`  
**Live Cloud Run URL:** `https://pxl-web-netsim-1088457364327.europe-west1.run.app`  
**Lokale Server:** `http://localhost:8080` (Python 3.12 `server.py`)

### 1. Projectoverzicht & Doelstelling
**PXL Web NetSim** is een volwaardige, browsergebaseerde netwerksimulator en geautomatiseerd evaluatieplatform ontwikkeld voor Hogeschool PXL (Departement Toegepaste Informatica / System & Network Engineering - SNE). Het stelt studenten in staat om zonder zware lokale software (zoals Cisco Packet Tracer) netwerktopologieën te bouwen, kabels aan te sluiten, apparaten via authentieke CLI en Web GUIs te configureren, Wireshark packet captures uit te voeren en opdrachten cryptografisch ondertekend in te leveren via Blackboard/Schoolyear. Docenten kunnen toetsen klaarzetten, resultaten monitoren en Packet Tracer `.pka`/`.pkt` bestanden importeren en automatisch omzetten naar interactieve labs.

### 2. Volledige Architectuur & Tech-Stack
* **Frontend (100% Zero-Dependency Modular Vanilla Web):**
  * Geen zware Node.js/npm dependencies of bundlers nodig; laadt direct razendsnel in elke moderne browser.
  * `static/index.html`: Hoofdinterface met interactieve canvas werkruimte, topologie-knoppen, statusbalken, modale vensters en bottom device shelf.
  * `static/css/packet_tracer.css`: Packet Tracer geïnspireerde styling, responsive faceplates, terminals, modale vensters en dock.
  * `static/js/app.js`: Centrale controller (`PXLApp`), initialiseert alle deelsystemen, beheert modale vensters, auth-state en event listeners.
  * `static/js/canvas_workspace.js`: HTML5 Canvas rendering engine met soepele zoom, pan, grid-snapping, kabel-animaties, link LEDs en drag-and-drop.
  * `static/js/cisco_device.js`: Datamodel voor elk netwerkapparaat (interfaces, IP/mask, ARP/MAC-tabellen, routingtabellen, NVRAM startup/running-config).
  * `static/js/cisco_cli.js` & `cisco_ios.js`: Cisco IOS / AireOS state machine met command parsing, inline help (`?`), tab completion en paginering (`--More--`).
  * `static/js/simulation_engine.js`: Event-driven netwerksimulator (ARP requests, ICMP echo/reply, DHCP discover/offer, DNS lookups, TCP 3-way handshakes).
  * `static/js/wireshark_app.js`: Ingebouwde grafische packet analyzer met live packet stream, packet hex view en decodering.
  * `static/js/grading_engine.js`: Realtime rubric evaluatie-engine die de topologie en device running configs toetst aan gestelde eisen.
  * `static/js/teacher_studio.js`: Docentenpaneel voor live monitoring, examen- en labbeheer, PKA rubric generator en bug center.
* **Backend (Python 3.12 REST API & Database):**
  * `server.py`: Asynchrone en multithreaded HTTP server met sessiebeheer (cookies), static file caching en JSON REST endpoints.
  * `backend/database.py`: SQLite3 database (`data/netsim.db`) in WAL-modus met tabellen voor `users`, `exams`, `exam_assignments`, `student_saves`, `exam_submissions`, `system_settings` en `bug_reports`.
  * `backend/pka_generator.py`: Geavanceerde Packet Tracer parser die `.pka`/`.pkt` XML extract, running-configs uitleest, en automatische rubrics en gestripte starttopologieën bouwt.
  * `backend/crypto_verifier.py`: HMAC-SHA256 en RSA ondertekening van `.pxlexam` inzendpakketten ter voorkoming van fraude en manipulatie.
  * `deploy_gcloud.ps1`: Automatische één-klik deployment naar Google Cloud Run (regio `europe-west1`).

### 3. Belangrijke Ontwerpkeuzes & Logica
1. **Rolgebaseerde Studio Toegang:**
   * Studenten zien na inloggen enkel `[🧑‍🎓 Student Studio]`; docenten zien enkel `[🛠️ Teacher Studio]`. Niet-ingelogde gebruikers zien enkel een inlogknop.
2. **Onderverdeling Lab vs Test:**
   * **Labs (Oefenlabs):** Vrij toegankelijk, direct te starten, student kan zelf zijn voortgang resetten om blanco opnieuw te oefenen.
   * **Testen (Officiële Examens):** Vereisen een startsein van de docent (`is_started = 1`) en optioneel een test-wachtwoord. Studenten kunnen testen NOOIT zelfstandig resetten (beveiligd in backend).
3. **PKA Generator met Auto-Stripping:**
   * Docenten uploaden een 100% afgewerkte model-PKA. De docent vinkt in een interactieve checklist aan welke instellingen punten opleveren.
   * De generator wist automatisch die aangevinkte instellingen uit de studenten-topologie (zodat de student deze zelf moet invoeren) en genereert de instructietekst met Adresseringstabel.
4. **Bug Melding Systeem met AI-Export/Import:**
   * Knop `🐞 Bug Melden` maakt een complete JSON snapshot van alle actieve configs, kabels en topologie.
   * Exporteerbaar naar `<bug_code>.json`. Een AI kan de bug lokaal inspecteren en via een gestructureerde JSON-oplossing terugvoeden naar Teacher Studio Tab 4 en Student Studio Tab 3.
5. **Veilig Samenwerkingsprotocol (`.ai-sync/`):**
   * Strikte lock (`LOCK.json`) voorkomt gelijktijdige conflicterende commits tussen collega's en AI-assistenten.
   * `CONTEXT_LOG.md` garandeert dat alle context, achtergrondkennis en ontwerpkeuzes behouden blijven.

### 4. Actuele Status & Huidige Taak
* Cursuslabo's verrijkt met volledige adresseringstabellen en hostnames.
* MikroTik ping & WebFig compatibiliteit gefixt.
* Huidige actieve uitbreiding:
  * Herindeling van de onderste apparatenbalk in 6 duidelijke categorieën: `Switch & Router devices`, `Computer systems`, `Cloud`, `Wifi`, `Cables & Patches`, `Firewall & Security`.
  * Toevoegen van 5 volwaardige Next-Gen / Open Source Firewall platformen inclusief realistische CLI & Web GUI ondersteuning: **Cisco ASA**, **Fortinet FortiGate (FortiOS)**, **Palo Alto (PAN-OS)**, **OPNsense** en **pfSense**.
