# PXL Web NetSim • Installatie- & Samenwerkingshandleiding voor Docenten
> **Hogeschool PXL — Departement Toegepaste Informatica / SNE (System & Network Engineering)**  
> **Auteurs:** © David Parren (owner), Gert Van Waeyenberg, Jeroen Jean, Guido Frissaer en Kathleen Hombroeks  
> **GitHub Repository:** [https://github.com/PXLNetworkgroup/pxl-web-netsim](https://github.com/PXLNetworkgroup/pxl-web-netsim)  
> **Live Productie URL:** [https://pxl-web-netsim-1088457364327.europe-west1.run.app](https://pxl-web-netsim-1088457364327.europe-west1.run.app)

---

## 1. Doel & Context van het Platform

PXL Web NetSim is een web-gebaseerd netwerksimulatie- en examenplatform dat speciaal ontwikkeld is voor **Schoolyear** examens binnen **Blackboard**. 

### Waarom dit platform?
1. **Geen lokale software op studententoestellen:** Studenten hoeven geen desktop Cisco Packet Tracer te installeren.
2. **Volledige lockdown integratie:** Het platform draait op één web-URL. Schoolyear kan de studentenlaptop 100% vergrendelen zonder dat er poorten naar externe software of lokale AI-tools (Copilot, lokale LLM's) moeten worden opengezet.
3. **Multi-Vendor Ondersteuning:** Biedt ondersteuning voor:
   - **Cisco IOS** (Routers 4331/2911, Catalyst 2960-24TT, 3560 Multilayer)
   - **MikroTik RouterOS** (hEX lite RB750r2 met CLI en SSH)
   - **OpenWrt** (BusyBox/Ash shell, UCI config en LuCI interface)
   - **Het Internet Simulator** (Cloud device dat reageert op elk IP en webpagina's simuleert met het PXL-logo)
4. **Automatische Beoordeling & Auto-Save:** Elke 60 seconden wordt de voortgang van de student opgeslagen in de centrale SQLite database. De rubric evalueert real-time de `running-config` en interface-statussen.

---

## 2. Installatie op je Eigen Toestel (Stap-voor-Stap)

Iedere docent kan het platform eenvoudig lokaal op zijn of haar laptop (Windows, macOS of Linux) draaien om examens voor te bereiden, topologieën te testen of nieuwe features toe te voegen.

### Stap 1: Vereisten
Zorg dat de volgende software geïnstalleerd is:
- **Git:** [https://git-scm.com/](https://git-scm.com/)
- **Python 3.10 of hoger:** [https://www.python.org/](https://www.python.org/) (Vink bij de installatie *Add Python to PATH* aan!)

### Stap 2: Code Ophalen (Clonen)
Open PowerShell, Terminal of Command Prompt en voer uit:
```bash
git clone https://github.com/PXLNetworkgroup/pxl-web-netsim.git
cd pxl-web-netsim
```

### Stap 3: Virtuele Omgeving & Dependencies Installeren
Maak een virtuele Python omgeving aan en installeer de vereiste packages:

**Op Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Op macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Stap 4: Lokale Server Starten
Start de applicatie:
```bash
python server.py
```
Je ziet nu:
```
 * Running on http://0.0.0.0:8080 (Press CTRL+C to quit)
```

Open je browser en surf naar:  
👉 **[http://localhost:8080](http://localhost:8080)**

---

## 3. Inloggen & Rollen

Het platform kent twee soorten gebruikers:

| Rol | Gebruikersnaam | Wachtwoord | Functionaliteit |
| :--- | :--- | :--- | :--- |
| **Docent / Teacher** | `teacher` | `SinterklaasOp6December` | Toegang tot de **Teacher Studio**: examens aanmaken, PKA-bestanden importeren, punten per commando instellen, studenten monitoren en CSV bulk importeren. |
| **Student** | `student1` | `PXL2026!` | Examen maken, netwerk bouwen, bekabelen, CLI configureren, auto-save elke minuut. |
| **Student 2** | `student2` | `PXL2026!` | Parallelle studentensessie om multi-user werking te testen. |

### Nieuwe Studenten Importeren (CSV)
Als docent kun je in de Teacher Studio via de knop **"Studenten Importeren (CSV)"** een volledige klas in één keer toevoegen.  
Formaat:
```csv
username;password;full_name;class
s1234567;Geheim123!;Jan Janssens;1TIN-A
s1234568;Welkom2026!;Sophie Peeters;1TIN-A
```

---

## 4. Samenwerken met Collega's via GitHub

Om ervoor te zorgen dat meerdere docenten tegelijkertijd kunnen ontwikkelen en bijdragen **zonder elkaars werk te overschrijven** én **zonder de live omgeving per ongeluk te breken**, hanteren we onderstaande strategie.

### Hoe zorgen we dat elke collega veilig kan werken?

#### Methode A: Persoonlijke Branches & Pull Requests (Aanbevolen Industrie-Standaard)
In Git is een **branch** een geïsoleerde werkomgeving. Je deelt dezelfde codebasis, maar jouw wijzigingen blijven strikt gescheiden totdat ze goedgekeurd worden.

1. **Maak voor jezelf een eigen branch aan:**
   ```bash
   git checkout -b collega/jouwnaam
   # Voorbeeld:
   git checkout -b collega/david
   ```
2. **Werk aan je bestanden en commit lokaal:**
   ```bash
   git add .
   git commit -m "Oefening 4 toegevoegd met MikroTik router"
   ```
3. **Push jouw branch naar GitHub:**
   ```bash
   git push -u origin collega/jouwnaam
   ```
4. **Pull Request (Samenvoegen):**
   - Surf naar [https://github.com/PXLNetworkgroup/pxl-web-netsim](https://github.com/PXLNetworkgroup/pxl-web-netsim).
   - Klik op **"Compare & pull request"**.
   - Collega's kunnen elkaars wijzigingen bekijken en testen.
   - Klik op **"Merge"** om de code veilig toe te voegen aan de `main` branch.

#### Methode B: Eigen Mappen per Collega (`collega-workspaces/`)
Wil een docent eigen laboefeningen, scripts, documentatie of testexamens bewaren zonder het centrale project aan te raken?  
Plaats die dan in de map:
```
pxl-web-netsim/
├── collega-workspaces/
│   ├── david/
│   │   └── labo_ospf_experiment.json
│   ├── gert/
│   └── lode/
```
Bestanden in je eigen submap kunnen nooit conflicteren met die van een collega!

---

## 5. Hoe Brengen we Gezamenlijk Wijzigingen naar de Live Omgeving?

De live productieomgeving draait op **Google Cloud Run** in Europa (europe-west1).

Om te voorkomen dat tussentijdse fouten live gaan, hanteren we de regel:  
> **Enkel code die gemerged is in de `main` branch wordt naar de live omgeving gepushed.**

### Het Live Deployment Script Uitvoeren
Wanneer een nieuwe versie getest en goedgekeurd is, kan de deployment in **één klik** worden uitgevoerd met het meegeleverde PowerShell script:

```powershell
.\deploy_gcloud.ps1
```

Dit script voert automatisch de volgende stappen uit:
1. Controleert of Google Cloud SDK (`gcloud`) geïnstalleerd en ingelogd is.
2. Schakelt naar het Google Cloud project `pxl-web-netsim`.
3. Activeert Cloud Run en Artifact Registry.
4. Bouwt de container image via Google Cloud Build.
5. Rolt de nieuwe revisie uit naar Cloud Run met publieke toegang.
6. Geeft de live URL terug:  
   👉 **`https://pxl-web-netsim-1088457364327.europe-west1.run.app`**

---

## 6. Apparaten & Mogelijkheden Samengevat

| Apparaat | Model | Besturingssysteem & CLI | Bijzonderheden |
| :--- | :--- | :--- | :--- |
| **Cisco Router** | Cisco 4331, 2911 | Cisco IOS CLI (`Switch>`, `Switch#`, `config#`) | Tab-completion, `--More--` pager, `write erase`, subinterfaces, static routes. |
| **Cisco Switch** | Catalyst 2960-24TT, 3560 | Cisco IOS CLI | 24 FastEthernet poorten, SVI Vlan1 beheer, MAC-table inspectie. |
| **MikroTik Router** | hEX lite (RB750r2) | MikroTik RouterOS 7.12 CLI | 5 FastEthernet poorten, RouterOS syntax (`/ip address add`, `/ip route add`, `/system identity`, `/export`), en **volledige SSH-toegang**. |
| **OpenWrt Router** | OpenWrt 23.05 | Linux BusyBox (Ash) Shell & LuCI Web GUI | `uci show network`, `uci set`, `uci commit`, `ifconfig`, `cat /etc/banner`, webinterface. |
| **Internet (Public NAT)** | PXL Public WAN | Live NAT Gateway via Fysieke Instance Adapter | Stuurt al het verkeer rechtstreeks uit via de fysieke netwerkadapter van de server (Google Cloud / Host). Biedt **echte live internettoegang** voor browsers en pings. |
| **Internet (Simulated)** | PXL Global Cloud | Offline Examen Gateway | Reageert met 100% succes op **ALLE IP-adressen** (bv. `8.8.8.8`, `1.1.1.1`, `pxl.be`) en toont in de browser de **"Welkom op het Internet"** webpagina met PXL-logo. 100% examenveilig. |
| **PC & Laptop** | PC-PT, Laptop-PT | Windows CMD & **PowerShell Terminal** | Volledige PowerShell ondersteuning (`Get-NetIPAddress`, `Get-NetIPConfiguration`, `Test-NetConnection`, `Resolve-DnsName`, `Invoke-WebRequest`, `Get-NetNeighbor`, `Get-NetRoute`, etc.), WPA2 Wireless, Web Browser, FTP Client. |
| **Server** | Server-PT | **Multi-Format Webserver** & Services | Multi-format bestandsbeheer (`index.html`, `style.css`, `data.json`, `info.txt`), actieve DNS Name Resolution zonebeheer, FTP server en **PowerShell**. |

---

## 7. Cursus Labs (Network Essentials) & AI Lab Authoring
Alle labs van de cursus [vwgert.github.io/networksess/](https://vwgert.github.io/networksess/) zijn voorgeprogrammeerd en direct selecteerbaar via het dropdownmenu:
- **H01-Labo1:** Les 01 Labo: Rechtstreekse verbinding tussen 2 Laptops (APIPA)
- **H02-Labo1:** Les 02 Labo: Statische IP-configuratie (PC ↔ Webserver)
- **H03-PT1:** Les 03 PT: Switch, ARP, ICMP en MAC-Address-Table
- **H04-PT1:** Les 04 PT: DHCP, DNS en HTTP Webserver in Simulation Mode
- **H05-Labo1:** Les 05 Labo 1: MikroTik hEX lite als Router (4 Netwerken)
- **H05-PT1:** Les 05 PT: Twee LANs via Eén Cisco Router
- **H05-PT2:** Les 05 PT: Twee LANs via Twee Cisco Routers (Static Routing)
- **H06-PT1:** Les 06 PT: Thuisrouter, NAT, DHCP, DNS, WiFi en WAN Internet
- **H08-Cisco:** Zelfstudie: Cisco IOS Netwerk (PC-SW-R-SW-PC) met SSH

### Labs Importeren & Exporteren
- **📥 Import:** Klik bovenaan op **📥 Import** om een willekeurig `.json` labbestand in te laden.
- **📤 Export:** Klik op **📤 Export** om het actieve lab inclusief de getekende topologie en rubric te downloaden als `.json`.
- **AI Lab Authoring:** Zie [`LAB_AUTHORING_GUIDE.md`](LAB_AUTHORING_GUIDE.md) en [`PXL_LAB_TEMPLATE.json`](PXL_LAB_TEMPLATE.json) om met behulp van AI in 30 seconden nieuwe labs te bouwen!

---

## 8. Hulp & Ondersteuning

Voor vragen over het platform, feature requests of ondersteuning bij examens:
- **E-mail:** David Parren (`david.parren@pxl.be`)
- **Departement:** Hogeschool PXL — Toegepaste Informatica / SNE (Hasselt)

