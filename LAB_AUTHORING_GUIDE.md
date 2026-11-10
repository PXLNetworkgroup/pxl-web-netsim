# Handleiding: Labs Ontwerpen, Importeren & Exporteren (AI & Docenten)
**PXL Web NetSim • Cisco IOS, MikroTik, OpenWrt & Internet Lab Simulator**  
*Auteurs: Gert Van Waeyenberg, David Parren, Kris Frissaer, Rembert Jean, Marc Hombroeks • Hogeschool PXL (Toegepaste Informatica / SNE)*

---

## 1. Doel & Overzicht
Dit document beschrijft de standaardspecificatie voor het ontwerpen en uitbreiden van netwerklabs binnen **PXL Web NetSim**. Zowel menselijke docenten als AI-assistenten (zoals Antigravity, Claude, ChatGPT) kunnen dit JSON-formaat gebruiken om automatisch nieuwe labs te genereren, te importeren, te exporteren en te beoordelen.

De labs zijn afgestemd op de officiële PXL cursus [Network Essentials](https://vwgert.github.io/networksess/).

---

## 2. Lab Specificatie Formaat (PXL Lab Schema v1.0)
Elk lab is een zelfstandig JSON-bestand (`.json`) met de volgende structuur:

```json
{
  "id": "h05_labo1_mikrotik",
  "code": "H05-Labo1",
  "chapter": "Hoofdstuk 05 - Routering & MikroTik RouterOS",
  "title": "Les 05 Labo 1: MikroTik hEX lite als Router (4 Netwerken)",
  "course": "PXL Network Essentials (vwgert.github.io/networksess)",
  "timeLimitMinutes": 80,
  "showLiveScore": true,
  "liveInternet": false,
  "instructions": "## Markdown geformatteerde instructies voor de student...",
  "initialTopology": {
    "devices": [ ... ],
    "cables": [ ... ]
  },
  "rubric": [
    {
      "id": "criterium_1",
      "description": "Beschrijving van het beoordelingspunt",
      "type": "ip_config | interface_ip | ping_test | http_web_test | dns_record | static_route | cisco_command",
      "points": 30
    }
  ]
}
```

---

## 3. Beschikbare Apparaattypen (`type`)
Bij het ontwerpen van een lab in `initialTopology.devices` kunnen de volgende apparaattypen worden opgegeven:

| Type (`type`) | Omschrijving | Typische interfaces |
| :--- | :--- | :--- |
| `pc` | Windows 11 PC Client (GUI, CMD & **PowerShell**) | `FastEthernet0` |
| `laptop` | Windows 11 Laptop (GUI, CMD, **PowerShell** & WiFi) | `FastEthernet0`, `Wireless0` |
| `server` | Multi-format Server (HTTP, DNS, FTP, **PowerShell**) | `FastEthernet0` |
| `router` | Cisco IOS Router (4331, 2911) | `GigabitEthernet0/0/0`, `GigabitEthernet0/0/1`, `GigabitEthernet0/0/2` |
| `switch` | Cisco Catalyst Switch (2960-24TT, 3560) | `FastEthernet0/1` t.e.m. `Fa0/24`, `Gi0/1`, `Gi0/2` |
| `mikrotik` | MikroTik hEX lite (RB750r2) RouterOS | `ether1`, `ether2`, `ether3`, `ether4`, `ether5` |
| `openwrt` | OpenWrt Linux Router (Ash shell, UCI config) | `eth0` (WAN), `eth1` (LAN1), `eth2` (LAN2), `eth3`, `eth4` |
| `internet_simulated` | Gesimuleerd Internet (Toont "Welkom op het Internet" pagina met PXL logo, beantwoordt elk IP) | `WAN`, `Ethernet0` t.e.m. `Ethernet3` |
| `internet_public` | **Publieke Internet NAT Bridge** (Gekoppeld aan fysieke serveradapter van Google Cloud / Host) | `WAN`, `Ethernet0` t.e.m. `Ethernet3` |
| `internet_cloud` | Hybride Internet (Schakelbaar tussen gesimuleerd en live NAT) | `WAN`, `Ethernet0` t.e.m. `Ethernet3` |
| `wireless_ap` | WRT300N Wireless Access Point | `Internet` (WAN), `Ethernet1` t.e.m. `Ethernet4`, `Wireless` |

---

## 4. Ondersteunde Rubric Criteria (`rubric[].type`)
De simulator voert elke 10 seconden automatisch de beoordelingsengine uit:

1. **`cable_connection`**: Controleert of twee specifieke apparaten en poorten verbonden zijn met een kabel.
2. **`cable_count`**: Controleert het minimum aantal aangesloten kabels.
3. **`ip_config`**: Controleert of een host (PC/Laptop/Server) het opgegeven IP-adres en subnetmasker heeft.
4. **`ip_subnet`**: Controleert of een host een IP heeft binnen het opgegeven netwerk/prefix (bv. APIPA `169.254.0.0/16`).
5. **`gateway_config`**: Controleert of de host de correcte default gateway heeft ingesteld.
6. **`interface_ip`**: Controleert of een Cisco router/switch interface een IP en `no shutdown` status heeft.
7. **`mikrotik_interface_ip`**: Controleert IP-toekenning op een MikroTik interface (`/ip address`).
8. **`ping_test`**: Voert een end-to-end ICMP ping uit tussen bron en doel (doorheen switches, routers en NAT).
9. **`http_web_test`**: Controleert of een webpagina kan worden opgehaald via HTTP (lokaal of via het internet).
10. **`dns_record`**: Controleert of een DNS-server een specifiek A-record heeft geregistreerd.
11. **`dns_resolution`**: Controleert of een client via zijn geconfigureerde DNS-server een domein kan resolven.
12. **`static_route`**: Controleert of een statische route (`ip route ...`) aanwezig is in de running config.
13. **`cisco_command`**: Regex/string controle op de actieve Cisco running-configuration (bv. `hostname R1`, `banner motd`, `enable secret`).

---

## 5. Hoe een Nieuw Lab Toevoegen met AI?
Geef aan een AI assistent de template [`PXL_LAB_TEMPLATE.json`](file:///G:/My%20Drive/antigravitylogs/pxl-web-netsim/PXL_LAB_TEMPLATE.json) samen met de lab-opdracht (bijvoorbeeld van [vwgert.github.io/networksess/](https://vwgert.github.io/networksess/)).
De AI genereert direct een valide JSON-bestand dat via de knop **📥 Import** in de applicatie kan worden ingeladen of aan de map `data/course_labs/` kan worden toegevoegd.
