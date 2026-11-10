# PXL Web NetSim • CiscoExa NextGen
> **Online Cisco Packet Tracer Exam & Lab Simulation Platform**  
> *Ontwikkeld voor Hogeschool PXL — Departement Toegepaste Informatica / SNE (System & Network Engineering)*  
> **Auteurs & Copyright:** © David Parren, Gert Van Waeyenberg, Lode Frissaer, Jean, Hombroeks • Hogeschool PXL

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

---

## 🚀 Belangrijkste Verbeteringen t.o.v. het Eerste Prototype

| Eigenschap | Origineel Prototype | PXL Web NetSim (NextGen) |
| :--- | :--- | :--- |
| **Topologie Model** | Vaste lineaire 6-toestellen balk (`PCA-SW1-R1=R2-SW2-PCB`) | **Dynamische Graaf**: onbeperkt aantal routers, switches, PC's, laptops, wireless AP's |
| **Bekabeling** | Statisch en voorgeprogrammeerd | **Interactieve Bekabeling**: student trekt zelf straight-through, crossover, serial of console kabels |
| **Look & Feel** | Donkere generieke AI-dashboard layout | **Authentiek Cisco Packet Tracer**: rasterachtergrond, officiële Cisco SVG iconen, link-status LED's |
| **Draadloos (WiFi)** | Geen ondersteuning | **Volledige WLAN Simulatie**: WRT300N AP, SSID broadcast, WPA2-PSK authenticatie, draadloze golven |
| **CLI & Terminal** | Basis parser | **Geavanceerde Cisco IOS Engine**: afkortingen (`sh ip int br`), tab-completion, `?` help, pager (`--More--`), history |
| **Apparaatvenster** | Enkel console | **Multi-Tab**: *Physical* (chassis & powerswitch), *Config* (GUI), *CLI* (IOS), *Desktop* (Command Prompt, IP Config, Wireless) |
| **Examen Builder** | Hardcoded criteria in code | **Teacher Studio**: visuele rubric designer, punten per commando instellen, live activatie |
| **Packet Tracer Import** | Niet aanwezig | **Twofish .PKA / .PKT Decoder**: importeert bestaande Cisco NetAcad labs direct naar Web NetSim |
| **Anti-Cheat & Inlevering**| Ruwe tekst export | **Cryptografisch ondertekende `.pxlexam` bundel** met volledige commandologs, tijdsstempels en hash |

---

## 🛠️ Architectuur & Structuur

```
pxl-web-netsim/
├── server.py                          # Flask backend API & static webserver
├── requirements.txt                   # python afhankelijkheden (flask, pycryptodome)
├── README.md                          # Deze documentatie
├── backend/
│   ├── ptcrypto.py                    # Cisco Packet Tracer Twofish-128 crypto decoder (PT 7/8/9.0.1+)
│   ├── pka_parser.py                  # XML converter van .pka/.pkt naar WebNetSim JSON
│   └── __init__.py
├── exams/                             # Kant-en-klare examenpresets (JSON)
│   ├── 01_pxl_standard_lan_wan.json   # Volledig 6-toestellen routing & switching lab
│   ├── 02_cabling_and_basic_config.json # Zelfstandig bekabelen proef
│   └── 03_wireless_lan_wpa2.json      # Wireless LAN & WPA2-PSK lab
└── static/
    ├── index.html                     # Hoofdapplicatie (Schoolyear single-URL ready)
    ├── css/
    │   ├── packet_tracer.css          # Packet Tracer interface, knoppen, dock, rubric
    │   ├── modal.css                  # Hardware faceplates, config GUI, desktop apps, studio
    │   └── terminal.css               # Cisco IOS monospace terminal
    ├── js/
    │   ├── cisco_icons.js             # Officiële vector SVG iconen (Router, Switch, AP, PC, Laptop, Server)
    │   ├── cisco_crypto.js            # Type 7 & Type 5 password engine, IP subnetting berekeningen
    │   ├── cisco_device.js            # Datamodel voor apparaten, interfaces, NVRAM, running-config
    │   ├── cisco_cli.js               # Cisco IOS CLI parser, tab-completion, ?, prompt state-machine
    │   ├── pc_desktop.js              # PC desktop applicaties (ipconfig, ping, tracert, wireless)
    │   ├── network_simulator.js       # Dynamische netwerkgraaf, L2 switching, ARP, L3 routing, ICMP
    │   ├── cabling_engine.js          # Kabel trekken, poortselectie popover, link status evaluatie
    │   ├── canvas_workspace.js        # Packet Tracer canvas, zoom & pan, drag-and-drop, link LED's
    │   ├── grading_engine.js          # Dynamische rubric evaluator en realtime scoreberekening
    │   ├── submission_exporter.js     # Bouwt en downloadt cryptografisch ondertekende .pxlexam
    │   ├── teacher_studio.js          # Visuele Examen & Rubric Builder en .PKA upload
    │   └── app.js                     # Hoofd UI coördinator en event dispatcher
    └── img/
        └── pxl_logo.png               # Officieel Hogeschool PXL logo
```

---

## 💻 Hoe Te Draaien?

### Optie 1: Lokaal Draaien met Python (Aanbevolen voor docenten)

1. Open PowerShell of een terminal in de projectmap:
   ```bash
   cd "pxl-web-netsim"
   ```

2. Installeer de vereisten (indien nog niet aanwezig):
   ```bash
   pip install -r requirements.txt
   ```

3. Start de server:
   ```bash
   python server.py
   ```

4. Open je browser op:
   ```
   http://localhost:8080
   ```

### Optie 2: Server / Docker / Proxmox CT Deployment (Voor Examens)
Je kunt deze map op elke server draaien (zoals Gert's DuckDNS server, Proxmox LXC container 102, of een Docker container). De server luistert standaard op poort `8080` (of instelbaar via `PORT` omgevingsvariabele).

### Optie 3: Zuiver Statisch (bv. GitHub Pages)
Doordat de volledige netwerksimulatie, CLI-afhandeling, bekabeling en rubric-evaluatie in moderne JavaScript is geschreven, werkt de frontend ook **100% standalone zonder backend** door simpelweg `static/index.html` te serveren! *(De backend is enkel nodig voor de realtime `.pka` bestand upload-conversie).*

---

## 🧑‍🏫 Docentenhandleiding: Nieuwe Examens Maken in de Teacher Studio

1. Klik in de navigatiebalk bovenaan op **`🛠️ Teacher Studio`**.
2. **Tab 1: Examen Instellingen:**
   - Vul de Examentitel in (bv. *Netwerken 1 - Tweede Zittijd*).
   - Stel de tijdslimiet in (bv. *80 minuten*).
   - Kies of studenten tijdens het examen hun live score mogen zien (Oefenmodus) of pas bij inlevering (Strikte Examenmodus).
   - Typ de opdrachtomschrijving en het adresseringsschema.
3. **Tab 2: Topologie Snapshot:**
   - Bouw op het werkveld de gewenste startsituatie en klik op **`📸 Sla Huidig Werkveld op als Startsituatie`**.
   - Wil je dat studenten de bekabeling zelf trekken? Verwijder de kabels of klik op **`🗑️ Startsituatie Leegmaken`**.
4. **Tab 3: Puntenverdeling & Rubric:**
   - Klik op **`⚡ Genereer Rubric uit Werkveld`**. Het systeem detecteert automatisch alle geconfigureerde hostnames, interfaces, IP's, statische routes, wachtwoorden en bekabelingen.
   - Vink gewenste criteria aan of uit met de checkboxes.
   - Pas de punten per criterium aan (bv. 10 pt op statische routering, 4 pt op hostname).
   - Voeg optioneel extra Ping Connectiviteitstesten toe via **`+ Voeg Ping Controle Toe`**.
5. **Tab 4: Packet Tracer (.PKA) Import:**
   - Sleep een bestaand `.pka` bestand in het venster. De Twofish crypto pipeline decodeert de XML en vult automatisch de topologie en rubric in!
6. Klik onderaan op **`✅ Activeer dit Examen in NetSim`** of download het als **`💾 Examen (.json)`** om te delen met collega's.

---

## 🔒 Schoolyear Integratie in Blackboard

1. Maak in Blackboard een nieuwe Schoolyear toets aan.
2. Geef als **Toegestane URL** de URL van deze applicatie op (bv. `https://vwgert.duckdns.org/netsim/` of jullie PXL server URL).
3. Schakel in Schoolyear alle andere URL's en lokale applicaties uit.
4. De student logt in Blackboard in, Schoolyear start in fullscreen kioskmodus en vergrendelt de student op PXL Web NetSim.
5. Aan het einde van de toets klikt de student op **`🚀 Examen Inleveren`**. De browser genereert een cryptografisch ondertekend `.pxlexam` bestand dat de student inlevert via de Blackboard opdracht.

---

## 👥 Bijdragen & GitHub Repository

Dit project is open-source en vrij herbruikbaar voor collega-docenten van Hogeschool PXL en andere onderwijsinstellingen.

- **GitHub Repository:** [davidparren/pxl-web-netsim](https://github.com/davidparren/pxl-web-netsim)
- **Licentie:** MIT License
- **Vragen of suggesties?** Neem contact op met David Parren of Gert Van Waeyenberg.
