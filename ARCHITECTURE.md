# PXL Web NetSim • Technische Systeemarchitectuur & Developer Onboarding

Welkom bij de ontwikkelaars- en docentengids voor **PXL Web NetSim**. Dit document biedt een diepgaand overzicht van de interne architectuur van de netwerksimulator, verklaart de belangrijkste ontwerpkeuzes en bevat concrete stappenplannen om nieuwe netwerkcommando's, apparaten en grading-regels toe te voegen.

---

## 1. Systeemoverzicht & Ontwerpkeuzes

PXL Web NetSim is een web-gebaseerde, educatieve netwerksimulator ontworpen voor studenten en docenten binnen de opleiding Toegepaste Informatica (Systemen & Netwerkbeheer) aan Hogeschool PXL.

```
+---------------------------------------------------------------------------------+
|                                 WEB BROWSER                                     |
|  +--------------------------+  +------------------------+  +------------------+ |
|  |     CanvasWorkspace      |  |     CiscoCLIParser     |  |  GradingEngine   | |
|  | (HTML5 Canvas 2D Engine) |  | (IOS/RouterOS/OpenWrt) |  | (Rubric Matrix)  | |
|  +------------+-------------+  +-----------+------------+  +--------+---------+ |
|               |                            |                        |           |
|               +--------------------+       |       +----------------+           |
|                                    v       v       v                            |
|                            +-------------------------------+                    |
|                            |   In-Memory Topology State    |                    |
|                            | (CiscoDevice, Interfaces, Cab)|                    |
|                            +---------------+---------------+                    |
|                                            |                                    |
|                                    +-------v--------+                           |
|                                    | NetworkSimulator|                          |
|                                    | (ARP/IP/ICMP)  |                           |
|                                    +-------+--------+                           |
+--------------------------------------------|------------------------------------+
                                             | HTTP JSON API
                                             v
+---------------------------------------------------------------------------------+
|                              BACKEND (Python / Flask)                           |
|  +--------------------+  +----------------------+  +-------------------------+  |
|  | server.py (API)    |  | ptcrypto.py & parser |  | SQLite (data/netsim.db) |  |
|  | Student / Teacher  |  | (Cisco PKA Decrypt)  |  | Users, Exams, Scores    |  |
|  +--------------------+  +----------------------+  +-------------------------+  |
+---------------------------------------------------------------------------------+
```

### Belangrijkste Ontwerpkeuzes:
1. **Client-Side Simulatie (Zero Server Compute voor Simulatielogica):**
   - De netwerksimulatie, packet forwarding, CLI tokenizing en rubric evaluatie draaien 100% in de browser van de client.
   - *Voordeel:* Extreem lage latency bij het typen in de CLI, minimale hostingkosten en schaalbaarheid naar honderden gelijktijdige studenten op een eenvoudige Cloud Run instance.
2. **Zero-Dependency Frontend:**
   - Geen React, Vue, Angular of Webpack/Vite runtime bundles. Pure ES6+ JavaScript modules, HTML5 Canvas en CSS3.
   - *Voordeel:* Directe bewerkbaarheid zonder build steps (`npm run build`), geen risico op verouderde npm-pakketten en maximale transparantie.
3. **Hybride Cisco PKA Cryptografie:**
   - Volledige reverse-engineered Cisco Packet Tracer cryptografie in `backend/ptcrypto.py` (Twofish-128 met Cisco IV transmutatie, positional XOR en Qt qCompress/zlib).
   - *Voordeel:* Docenten kunnen bestaande `.pka` opdrachten direct uploaden; NetSim ontcijfert de XML-structuur en bouwt automatisch de rubric en starttopologie op.
4. **Lightweight SQLite Persistentie:**
   - Alle gebruikers, klassenlijsten, opdrachten en scores worden beheerd in `data/netsim.db` via `backend/database.py`.

---

## 2. De Simulatie-Engine

De frontend is opgebouwd rond een modulair componentenmodel dat netwerkoperaties emuleert:

### 2.1 State Management (`CiscoDevice` & Apparaatgeheugen)
In `static/js/cisco_device.js` bevindt zich de klasse `CiscoDevice`. Elk apparaat op het canvas is een instantie hiervan:
- **Identiteit:** `id` (unieke slug), `name` (CLI/IOS hostname zoals `Router0`), `displayName` (canvas label).
- **Interfaces:** Een key-value store per poort (bv. `GigabitEthernet0/0` of `FastEthernet0/1`):
  ```javascript
  {
    ip: "192.168.1.1",
    mask: "255.255.255.0",
    mac: "0060.2F12.A4B1",
    shutdown: false,
    mode: "access",        // of 'trunk'
    vlan: 1,               // access VLAN ID
    allowedVlans: [1, 10], // trunk allowed VLANs
    duplex: "auto",
    speed: "auto"
  }
  ```
- **Routing & Services:** `staticRoutes` (array van `{ network, mask, nextHop }`), `vlanDb`, `services` (DHCP-pools, DNS-records, HTTP server flags).

### 2.2 Packet Forwarding, Switching & Routing (`NetworkSimulator` & `CablingEngine`)
Locatie: `static/js/network_simulator.js` en `static/js/cabling_engine.js`.
1. **L1 (Fysieke Laag):** `CablingEngine.getConnectedInterface(devId, portName)` controleert of er een kabel aangesloten is en of het kabeltype klopt (bv. crossover tussen switches tenzij Auto-MDIX).
2. **L2 (Datalink Laag):**
   - **Switches:** Onderhouden een dynamische CAM-tabel (MAC-adres naar fysieke poort binding) met een verouderingstimer.
   - **VLANs & Trunks:** Verkeer op een access poort wordt getagd met het configured VLAN; trunk-poorten ondersteunen 802.1Q encapsulation en controleren `allowedVlans`.
3. **L3 (Netwerk Laag):**
   - **ARP Cache:** Wordt geraadpleegd vóór packet verzending. Bij een miss genereert de simulator een L2 Broadcast ARP Request (`FF:FF:FF:FF:FF:FF`).
   - **Routing Engine:** Maakt gebruik van *Longest Prefix Match*. De router controleert:
     1. Direct aangesloten interfaces (waarvan `shutdown == false`).
     2. Statische routes (`staticRoutes`).
     3. Default gateway (0.0.0.0/0).
     4. Indien geen match: genereert ICMP Destination Host/Network Unreachable.
4. **Visualisatie:** Pakketten worden overgedragen aan `canvasWorkspace.flyingPackets` om als gekleurde enveloppen over de kabels te vliegen.

### 2.3 CLI Parser Hiërarchie
De command-line interfaces zijn geïsoleerd per besturingssysteem:
- **Cisco IOS:** `static/js/cisco_cli.js` (`CiscoCLIParser`)
  - Ondersteunt modale toestanden: `USER_EXEC` (`>`), `PRIV_EXEC` (`#`), `GLOBAL_CONFIG` (`(config)#`), `IF_CONFIG` (`(config-if)#`), `ROUTER_CONFIG` (`(config-router)#`).
- **MikroTik RouterOS:** `static/js/mikrotik_cli.js` (`MikroTikCLIParser`)
  - Pad-gebaseerde structuur: `/ip address`, `/ip route`, `/interface print`, etc.
- **OpenWrt:** `static/js/openwrt_cli.js` (`OpenWrtCLIParser`)
  - Linux Ash shell met UCI interface (`uci show`, `uci set network.lan.ipaddr=...`).
- **WatchGuard Fireware:** `static/js/firewall_security.js` (`WatchGuardCLIParser`)
  - Firebox console-omgeving (`WG>`, `WG#`, `interface eth0`).

---

## 3. Stapsgewijze Handleiding: Features Toevoegen

### 3.1 Hoe voeg ik een nieuw Cisco CLI commando toe?
*Voorbeeld: Je wilt het commando `ip default-gateway <ip>` toevoegen aan Switches.*

1. **Open `static/js/cisco_cli.js`:**
2. **Zoek de parser-methode voor de juiste modus:**
   - In dit geval `parseGlobalConfig(cmd, tokens, dev)` rond regel 450.
3. **Voeg de tokenizer matching toe:**
   ```javascript
   if (tokens[0] === 'ip' && tokens[1] === 'default-gateway') {
     const gw = tokens[2];
     if (!gw || !this.isValidIp(gw)) {
       return "% Incomplete or invalid IP address";
     }
     dev.defaultGateway = gw;
     this.triggerEvaluation(); // Herbereken rubric scores direct
     return ""; // Lege string = commando succesvol uitgevoerd zonder foutmelding
   }
   ```
4. **Ondersteun het commando in `show running-config`:**
   - Zoek `generateShowRun(dev)` in `cisco_cli.js` en voeg toe:
   ```javascript
   if (dev.defaultGateway) {
     lines.push(`ip default-gateway ${dev.defaultGateway}`);
   }
   ```
5. **Verifieer in de browser:** Open de CLI van een switch en test `ip default-gateway 192.168.1.254` en controleer `show run`.

---

### 3.2 Hoe voeg ik een nieuw apparaattype of model toe?
*Voorbeeld: Je wilt een "Cisco Layer 3 Switch 3650" toevoegen.*

1. **Icoon Definiëren (`static/js/cisco_icons.js`):**
   - Voeg een SVG tekenmethode toe in `CiscoIcons`, bv. `drawSwitchL3(ctx, x, y, width, height)`.
2. **Hardware Profiel Configureren (`static/js/cisco_device.js`):**
   - Voeg de modeldefinitie toe aan de constructor van `CiscoDevice`:
   ```javascript
   if (this.model === '3650') {
     this.type = 'switch';
     this.isLayer3 = true;
     this.ports = [
       'GigabitEthernet1/0/1', 'GigabitEthernet1/0/2',
       'GigabitEthernet1/0/3', 'GigabitEthernet1/0/4'
     ];
     // Genereer standaard interface objecten
     this.initInterfaces();
   }
   ```
3. **Device Shelf Knop Toevoegen (`static/index.html` & `static/js/app.js`):**
   - Voeg in `static/index.html` een knop toe aan het shelf paneel `#shelfSwitches`:
   ```html
   <button class="shelf-btn" data-type="switch" data-model="3650">
     <div class="shelf-icon">...</div>
     <span>Switch 3650 (L3)</span>
   </button>
   ```
   - In `static/js/app.js` wordt dit automatisch opgepikt door de click/drag listeners.
4. **Canvas Naming (`static/js/canvas_workspace.js`):**
   - Zorg dat de nummering automatisch werkt (bv. `SW-L3-1`, `SW-L3-2`).

---

## 4. Evaluatie- & Grading-Engine

Locatie: `static/js/grading_engine.js`.

### 4.1 Rubric Validatie
De `GradingEngine` evalueert continu (via debounced events of interval) de staat van alle apparaten ten opzichte van de actieve examen-rubric:
```javascript
// Structuur van een rubric-regel in een labo JSON:
{
  "id": "r1_g0_ip",
  "name": "R1 GigabitEthernet0/0 IP Adres",
  "category": "Addressing",
  "points": 2,
  "device": "R1",
  "target": "interfaces.GigabitEthernet0/0.ip",
  "type": "exact",
  "expected": "192.168.10.1"
}
```
Ondersteunde evaluatietypes:
- `exact`: Waarde moet exact overeenkomen.
- `interface_ip`: Valideert zowel IP als subnetmasker.
- `interface_up`: Valideert dat `shutdown === false` én er een actieve kabel verbonden is.
- `static_route`: Valideert netwerk, masker en next-hop in de routingtabel.
- `vlan_exists`: Controleert aanwezigheid van VLAN in `vlanDb`.
- `connectivity`: Simuleert een end-to-end ping achter de schermen tussen bron en doel.

> [!IMPORTANT]
> **Startscore Garantie:** Elke starttopologie moet bij opening **exact 0%** opleveren. Voorkom dat verwachte configuratiewaarden al in de starttopologie van het JSON-bestand zitten.

---

## 5. Backend Architectuur & API Endpoints

Locatie: `server.py` en `backend/database.py`.

### Belangrijkste Endpoints:
- `GET /api/student/exams`: Haalt alle gepubliceerde opdrachten op voor de actieve student.
- `POST /api/student/submit`: Slaat een student-inlevering op (inclusief topologie-JSON, CLI-logboek en rubric-resultaat).
- `GET /api/teacher/submissions`: Overzicht van alle studentenscores en pogingen voor docenten.
- `POST /api/teacher/exam/save`: Slaat een nieuw of bewerkt labo op in de database.
- `POST /api/pka/upload`: Ontvangt een Cisco `.pka`/`.pkt` bestand, decodeert dit via `ptcrypto.py` en geeft de geëxtraheerde JSON terug.

---

## 6. Lokale Installatie & Samenwerkingsworkflow

### 6.1 Lokaal Draaien
```bash
git clone https://github.com/PXLNetworkgroup/pxl-web-netsim.git
cd pxl-web-netsim
python -m venv venv
# Activeer de venv (Windows: .\venv\Scripts\activate, Linux/Mac: source venv/bin/activate)
pip install -r requirements.txt
python server.py
```
Open je browser op: `http://localhost:8080`.

### 6.2 Samenwerken via GitHub (Fork & Pull Request)
1. Maak een **Fork** van `https://github.com/PXLNetworkgroup/pxl-web-netsim` naar je eigen GitHub-account.
2. Clone jouw fork lokaal en maak een feature-branch aan:
   ```bash
   git checkout -b feature/naam-van-nieuwe-functie
   ```
3. Controleer vóór aanvang altijd het concurrency-bestand: `.ai-sync/LOCK.json`.
4. Breng je wijzigingen aan, test grondig met `pytest tests/`, commit en push:
   ```bash
   git add .
   git commit -m "feat: beschrijving van je toevoeging"
   git push origin feature/naam-van-nieuwe-functie
   ```
5. Dien via de GitHub-interface een **Pull Request** in naar de `main` branch van `PXLNetworkgroup/pxl-web-netsim`. Na collegiale review wordt de PR gemerged en automatisch gedeployd naar Google Cloud Run.