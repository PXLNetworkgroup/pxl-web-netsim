# PXL Web NetSim • AI & Developer Fast Context Card
> Compacte referentiekaart voor AI-agents en ontwikkelaars. Minimaliseer bestandsanalyses en tokenverbruik.

## 1. Tech Stack & Lokaal Draaien
- **Frontend:** Pure Vanilla JavaScript (ES6+ modular classes), HTML5 Canvas 2D API, Custom CSS3. *Strikte eis:* 0 npm/build runtime dependencies.
- **Backend:** Python 3.10+ / Flask API, SQLite3 (`data/netsim.db`), Gunicorn (Cloud Run).
- **Crypto & PKA:** Pure Python Twofish-128 (EAX/CBC), positional XOR, zlib/Qt qCompress.
- **Installatie & Start:**
  ```bash
  pip install -r requirements.txt
  python server.py  # Draait op http://localhost:8080 (of run start_local.bat)
  ```
- **Tests:** `pytest tests/` (of `python -m pytest tests/test_all_new_features.py`)

## 2. Beknopte Mappen- en Bestandenstructuur
- `server.py`: Flask backend, API endpoints (`/api/student/*`, `/api/teacher/*`), statische routing.
- `backend/database.py`: SQLite database queries, tabellen (users, exams, submissions, classes, audit).
- `backend/pka_parser.py`: Cisco Packet Tracer 5.x–8.x `.pka`/`.pkt` decryptie en XML-extractie.
- `backend/ptcrypto.py`: Twofish engine & Cisco cryptografische transformaties.
- `backend/pka_generator.py`: Reverse-engineering en generatie van PKA-containers.
- `static/index.html`: Hoofdinterface, modals, shelf-balk, canvas container.
- `static/css/`: `packet_tracer.css` (layout/knoppen), `modal.css` (popups), `terminal.css` (CLI).
- `static/js/app.js`: App controller, modal routers, event listeners, opdrachten laden, auto-grading ticker.
- `static/js/canvas_workspace.js`: HTML5 Canvas 2D engine, drag/drop, zoom/pan, device rendering, packet animaties.
- `static/js/cisco_device.js`: `CiscoDevice` modelklasse, interfaces, hardware profielen en poortbeheer.
- `static/js/cisco_icons.js`: Vector SVG renders van routers, switches, servers, firewalls en pc's.
- `static/js/cabling_engine.js`: Bekabelingsvalidatie (straight/crossover/serial/fiber), link status, auto-kabel.
- `static/js/network_simulator.js`: Forwarding engine, ARP, IP routing, ICMP ping/traceroute, DHCP, DNS, NAT.
- `static/js/cisco_cli.js`: Cisco IOS parser (User/Privileged EXEC, Global Config, Interface Config).
- `static/js/mikrotik_cli.js`: MikroTik RouterOS CLI parser (`/ip address`, `/ip route`, export, etc.).
- `static/js/openwrt_cli.js`: OpenWrt Ash/UCI CLI parser (`uci set`, `uci commit`, `/etc/config`).
- `static/js/firewall_security.js`: WatchGuard Fireware OS CLI & Web UI tab parser.
- `static/js/grading_engine.js`: Client-side validatiematrix (interfaces, routes, VLANs, services, scoreberekening).
- `static/js/teacher_studio.js`: Docentenpaneel: live monitoring, rubric editor, AI lab generator, student scores.
- `static/js/wireshark_app.js`: In-browser packet sniffer & frame inspector.
- `data/netsim.db`: SQLite database met alle accounts, klassen, opdrachten en scores.
- `data/course_labs/*.json`: 18 gestandaardiseerde PXL vaklabo's (H01 t/m H08).
- `.ai-sync/`: `LOCK.json` (concurrency lock) en `CONTEXT_LOG.md` (sessiehistorie).

## 3. Kern-Datastructuren (Belangrijkste Velden)
- **`CiscoDevice`:**
  - `id`: Unieke string (bv. `"router-1698765432"`).
  - `name` / `displayName`: Systeemnaam en bewerkbare UI label (bv. `"R1"`).
  - `type`: `"router" | "switch" | "pc" | "server" | "firewall" | "cloud"`.
  - `model`: Specifiek model (bv. `"2911"`, `"2960"`, `"watchguard"`, `"mikrotik"`).
  - `x`, `y`: Canvas coördinaten.
  - `interfaces`: Object `{ [portName]: { name, ip, mask, mac, shutdown: bool, vlan: number, mode: 'access'|'trunk', duplex, speed } }`.
  - `staticRoutes`: Array `[ { network, mask, nextHop, metric } ]`.
  - `vlanDb`: Object `{ [vlanId]: { name, state } }`.
  - `services`: Object `{ dhcp: { pools }, dns: { records }, http: { enabled } }`.
  - `powerOn`: Boolean.
  - `lockedFeatures`: Array met geblokkeerde acties per labo.
- **`Cable`:**
  - `id`: String.
  - `fromDevice`, `fromPort`, `toDevice`, `toPort`: Verbonden apparaat-ID's en poortnamen.
  - `type`: `"straight" | "crossover" | "serial" | "fiber" | "console" | "auto"`.
- **`Packet`:**
  - `id`: String.
  - `protocol`: `"ARP" | "ICMP" | "TCP" | "UDP" | "DHCP" | "DNS" | "HTTP"`.
  - `srcIp`, `dstIp`, `srcMac`, `dstMac`: Netwerkadressen.
  - `srcDevId`, `dstDevId`, `srcPort`, `dstPort`: Link-level forwarding targets.
  - `payload`: Data inhoud / ICMP type.
  - `ttl`: Integer (hop limit).

## 4. De Hoofd-Flow (Max. 6 Stappen)

### A. CLI Commando Verwerking:
1. **Input:** Gebruiker voert commando in terminal DOM in -> `app.js` vangt `Enter` af.
2. **Dispatch:** Terminal routeert naar actieve parser (`CiscoCLIParser`, `MikroTikCLIParser`, etc.).
3. **Parse & Tokenize:** Commando-string wordt gesplitst, gecontroleerd op context-mode (bv. `config-if`) en gevalideerd.
4. **Mutatie:** Parser past eigenschappen direct aan op het actieve `CiscoDevice` object in het geheugen.
5. **Grading & UI Sync:** `GradingEngine.evaluate()` herberekent direct de score en werkt de rubric-checklist bij.
6. **Canvas Update:** `CanvasWorkspace.render()` ververst eventuele statusicoontjes of link-lampjes.

### B. Pakketje / Ping Doorgifte:
1. **Initiatie:** Ping commando start op bronapparaat -> `NetworkSimulator.sendPing(src, dstIp)`.
2. **Route Lookup:** Zoek langste subnetmatch in direct verbonden interfaces of `staticRoutes`.
3. **ARP / Next-Hop:** Als next-hop MAC onbekend is: stuur ARP Request broadcast over het switch/LAN-segment.
4. **Kabeltransmissie:** Pakket passeert `CablingEngine` (controleert kabeltype en poort `shutdown: false`).
5. **Canvas Visualisatie:** Pakketje wordt toegevoegd aan `canvasWorkspace.flyingPackets` voor vloeiende animatie.
6. **Aflevering & Wireshark:** Bestemming genereert ICMP Echo Reply; frame wordt gelogd in `wiresharkApp`.

## 5. Strikte Conventies & Valkuilen
- **Geen NPM Packages:** Nooit `npm install` libraries toevoegen aan de frontend. Alles blijft zero-dependency vanilla JS.
- **Startscore Garantie:** Nieuwe labo's of topologieën moeten ALTIJD op **exact 0%** starten. Geen getoetste IP's vooraf invullen!
- **Dual Naming:** Elk device heeft `name` (interne identifier/hostname) en `displayName` (visuele naam op canvas). Breek deze koppeling niet.
- **Modal Pointer Events:** Modal-overlay (`#deviceModal`) heeft `pointer-events: none` zodat het canvas interactief blijft; de modal zelf heeft `pointer-events: auto`.
- **SQLite Migraties:** Voeg kolommen toe via veilige `ALTER TABLE ... ADD COLUMN` try/except blokken in `backend/database.py`. Nooit de database zomaar droppen.
- **PKA Decryptie:** Wijzig niets aan `backend/ptcrypto.py` zonder de testsuite te draaien; Cisco encryptie is uiterst kwetsbaar voor bit-offsets.

## 6. Concurrency Protocol (.ai-sync/LOCK.json)
1. **Check:** Lees `.ai-sync/LOCK.json`. Als `status: "LOCKED"`, STOP en meld dit aan de gebruiker.
2. **Lock:** Indien `status: "FREE"`, zet op `"LOCKED"` met jouw naam/agent en commit naar git alvorens code te wijzigen.
3. **Log:** Documenteer na afronding in `.ai-sync/CONTEXT_LOG.md`.
4. **Unlock:** Zet `.ai-sync/LOCK.json` terug op `"FREE"` en commit/push alles naar GitHub.

## 7. Openstaande Roadmap & Sessie-Start Protocol
Wanneer de gebruiker dit project heropent of vraagt naar de volgende stappen:
1. **Lees altijd [TODO.md](file:///G:/My%20Drive/antigravitylogs/pxl-web-netsim/TODO.md) uit.**
2. **Presenteer de openstaande taken** (1 t/m 10) overzichtelijk aan de gebruiker.
3. **Vraag de gebruiker:** *"Welke onderdelen wil je nu aanpakken? Je kunt één specifiek nummer kiezen om stap voor stap uit te rollen, of meerdere onderdelen tegelijk selecteren."*
4. Voer pas wijzigingen uit nadat de gebruiker zijn/haar keuze heeft gemaakt.

---
Voor diepgaande technische uitleg, uitbreidingshandleidingen en architectuurdetails: zie [ARCHITECTURE.md](file:///G:/My%20Drive/antigravitylogs\pxl-web-netsim/ARCHITECTURE.md).