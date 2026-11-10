/**
 * course_labs.js - PXL Network Essentials Course Labs Repository
 * Sourced from https://vwgert.github.io/networksess/ (Gert Van Waeyenberg)
 * Hogeschool PXL (Toegepaste Informatica / SNE)
 */

window.PXL_COURSE_LABS = [
  {
    "id": "h01_labo1_apipa",
    "code": "H01-Labo1",
    "chapter": "Hoofdstuk 01 - Fysieke Laag & Directe Verbinding",
    "title": "Les 01 Labo: Rechtstreekse verbinding tussen 2 Laptops - APIPA",
    "timeLimitMinutes": 45,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 01 Labo: Rechtstreekse verbinding tussen 2 Laptops - APIPA\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les01_Labo.html](https://vwgert.github.io/networksess/Les01_Labo.html)\n\n### Doel van het labo:\nIn dit labo onderzoek je hoe twee laptops rechtstreeks met elkaar communiceren zonder tussenkomst van een router of DHCP-server. Je bestudeert het automatisch toekennen van een **APIPA-adres** (169.254.0.0/16) en test de connectiviteit via zowel **Command Prompt** als **PowerShell**.\n\n### Opdrachten:\n1. **Fysieke verbinding:** Sluit een netwerkkabel aan tussen `Laptop0` (FastEthernet0) en `Laptop1` (FastEthernet0).\n2. **DHCP controle:** Beide laptops staan ingesteld op DHCP. Windows kent automatisch een APIPA-adres toe (169.254.x.x / 255.255.0.0).\n3. **PowerShell onderzoek:**\n   - Open op `Laptop0` de **PowerShell** terminal.\n   - Voer `Get-NetIPAddress` (`gip`) en `Get-NetIPConfiguration` (`gipconfig`) uit.\n4. **Connectiviteitstest:** Ping vanuit PowerShell naar `Laptop1` via `Test-NetConnection 169.254.1.20` of `ping 169.254.1.20`.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "Laptop0",
          "name": "Laptop0",
          "type": "laptop",
          "x": 180,
          "y": 200,
          "dhcpEnabled": true,
          "ip": "169.254.1.10",
          "mask": "255.255.0.0",
          "gateway": "",
          "dns": ""
        },
        {
          "id": "Laptop1",
          "name": "Laptop1",
          "type": "laptop",
          "x": 520,
          "y": 200,
          "dhcpEnabled": true,
          "ip": "169.254.1.20",
          "mask": "255.255.0.0",
          "gateway": "",
          "dns": ""
        }
      ],
      "cables": []
    },
    "rubric": [
      {
        "id": "cable_connected",
        "category": "cabling",
        "title": "Bekabeling",
        "desc": "Rechtstreekse kabelverbinding tussen Laptop0 en Laptop1",
        "type": "cabling",
        "checkType": "cabling",
        "points": 40,
        "enabled": true,
        "condition": {
          "fromDevice": "Laptop0",
          "fromPort": "FastEthernet0",
          "toDevice": "Laptop1",
          "toPort": "FastEthernet0"
        }
      },
      {
        "id": "apipa_subnet_laptop0",
        "category": "interface_ip",
        "title": "APIPA Laptop0",
        "desc": "Laptop0 heeft een geldig APIPA 169.254.x.x adres met /16 subnetmasker",
        "type": "ip_subnet",
        "checkType": "ip_subnet",
        "points": 30,
        "enabled": true,
        "condition": {
          "deviceId": "Laptop0",
          "subnetPrefix": "169.254.",
          "expectedMask": "255.255.0.0"
        }
      },
      {
        "id": "ping_laptop0_laptop1",
        "category": "connectivity",
        "title": "ICMP Connectiviteit",
        "desc": "Succesvolle ping / Test-NetConnection tussen Laptop0 en Laptop1",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "Laptop0",
          "targetIp": "169.254.1.20"
        }
      }
    ]
  },
  {
    "id": "h02_labo1_statisch_ip",
    "code": "H02-Labo1",
    "chapter": "Hoofdstuk 02 - IPv4 Adressering & Webserver",
    "title": "Les 02 Labo: Statische IP-configuratie (PC ↔ Webserver)",
    "timeLimitMinutes": 45,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 02 Labo: Statische IP-configuratie (PC ↔ Webserver)\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les02_Labo.html](https://vwgert.github.io/networksess/Les02_Labo.html)\n\n### Doel van het labo:\nIn dit labo configureer je handmatig statische IP-adressen op een PC en een Server. Je test de connectiviteit via `Test-Connection` (of `ping`) en bezoekt de webpagina van de server via de webbrowser en PowerShell (`Invoke-WebRequest`).\n\n### Netwerktabel:\n| Apparaat | Interface | IP-Adres | Subnetmasker |\n| :--- | :--- | :--- | :--- |\n| PC0 | FastEthernet0 | 192.168.1.10 | 255.255.255.0 |\n| Server0 | FastEthernet0 | 192.168.1.100 | 255.255.255.0 |\n",
    "initialTopology": {
      "devices": [
        {
          "id": "PC0",
          "name": "PC0",
          "type": "pc",
          "x": 180,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "",
          "mask": "",
          "gateway": "",
          "dns": ""
        },
        {
          "id": "Server0",
          "name": "Server0",
          "type": "server",
          "x": 520,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "192.168.1.100",
          "mask": "255.255.255.0",
          "gateway": "",
          "dns": "",
          "services": {
            "http": true,
            "dns": false,
            "dhcp": false
          }
        }
      ],
      "cables": [
        {
          "fromDevice": "PC0",
          "fromPort": "FastEthernet0",
          "toDevice": "Server0",
          "toPort": "FastEthernet0",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "pc0_ip_configured",
        "category": "interface_ip",
        "title": "PC0 IP Configuratie",
        "desc": "PC0 heeft statisch IP 192.168.1.10 en masker 255.255.255.0",
        "type": "interface_ip",
        "checkType": "interface_ip",
        "points": 40,
        "enabled": true,
        "condition": {
          "deviceId": "PC0",
          "portName": "FastEthernet0",
          "expectedIp": "192.168.1.10",
          "expectedMask": "255.255.255.0"
        }
      },
      {
        "id": "ping_pc_server",
        "category": "connectivity",
        "title": "ICMP Ping Test",
        "desc": "Succesvolle ping tussen PC0 en Server0 (192.168.1.100)",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "PC0",
          "targetIp": "192.168.1.100"
        }
      },
      {
        "id": "server_http_active",
        "category": "services",
        "title": "HTTP Service",
        "desc": "HTTP webserver service actief op Server0",
        "type": "http_get",
        "checkType": "http_get",
        "points": 30,
        "enabled": true,
        "condition": {
          "serverId": "Server0"
        }
      }
    ]
  },
  {
    "id": "h03_challenge2_switch_chain",
    "code": "H03-Challenge2",
    "chapter": "Hoofdstuk 03 - Layer 2 Switching & MAC-Adrestabellen",
    "title": "Les 03 Challenge 2: Ketting van Switches & Lector Webserver",
    "timeLimitMinutes": 50,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 03 Challenge 2: Ketting van Switches tot aan de Lector Webserver\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les03_Challenge2.html](https://vwgert.github.io/networksess/Les03_Challenge2.html)\n\n### Overzicht Challenge:\nIn deze challenge koppelen studenten hun switches aan elkaar in een ketting tot aan de laptop/server van de lector:\n1. De lector draait een webserver op `192.168.100.42` in het /24-netwerk `192.168.100.0/24`.\n2. Verbind de switches met elkaar via Gigabit trunk-uplinks.\n3. Configureer handmatig een IP-adres op je studenten-laptop (bijv. `192.168.100.10` t/m `192.168.100.50`).\n4. Test de connectiviteit via ping en bezoek de webpagina van de lector via de browser of PowerShell `Invoke-WebRequest`.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "Lector-Server",
          "name": "Lector-Server",
          "type": "server",
          "x": 620,
          "y": 140,
          "dhcpEnabled": false,
          "ip": "192.168.100.42",
          "mask": "255.255.255.0",
          "gateway": "",
          "dns": "",
          "services": {
            "http": true
          }
        },
        {
          "id": "Switch-Lector",
          "name": "Switch-Lector",
          "type": "switch",
          "x": 450,
          "y": 140
        },
        {
          "id": "Switch-Studenten",
          "name": "Switch-Studenten",
          "type": "switch",
          "x": 270,
          "y": 240
        },
        {
          "id": "Laptop-Student1",
          "name": "Laptop-Student1",
          "type": "laptop",
          "x": 100,
          "y": 320,
          "dhcpEnabled": false,
          "ip": "",
          "mask": "",
          "gateway": "",
          "dns": ""
        },
        {
          "id": "Laptop-Student2",
          "name": "Laptop-Student2",
          "type": "laptop",
          "x": 260,
          "y": 360,
          "dhcpEnabled": false,
          "ip": "192.168.100.12",
          "mask": "255.255.255.0",
          "gateway": "",
          "dns": ""
        }
      ],
      "cables": [
        {
          "fromDevice": "Lector-Server",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch-Lector",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Switch-Lector",
          "fromPort": "GigabitEthernet0/1",
          "toDevice": "Switch-Studenten",
          "toPort": "GigabitEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Laptop-Student2",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch-Studenten",
          "toPort": "FastEthernet0/2",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "cable_student1",
        "category": "cabling",
        "title": "Kabel Student 1",
        "desc": "Laptop-Student1 verbonden met Switch-Studenten",
        "type": "cabling",
        "checkType": "cabling",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "Laptop-Student1",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch-Studenten",
          "toPort": "FastEthernet0/1"
        }
      },
      {
        "id": "ip_student1",
        "category": "interface_ip",
        "title": "IP Student 1",
        "desc": "Laptop-Student1 geconfigureerd in netwerk 192.168.100.0/24",
        "type": "ip_subnet",
        "checkType": "ip_subnet",
        "points": 35,
        "enabled": true,
        "condition": {
          "deviceId": "Laptop-Student1",
          "subnetPrefix": "192.168.100.",
          "expectedMask": "255.255.255.0"
        }
      },
      {
        "id": "ping_lector",
        "category": "connectivity",
        "title": "Ping Lector Webserver",
        "desc": "Succesvolle ping van Laptop-Student1 naar Lector-Server (192.168.100.42)",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 35,
        "enabled": true,
        "condition": {
          "fromDevice": "Laptop-Student1",
          "targetIp": "192.168.100.42"
        }
      }
    ]
  },
  {
    "id": "h03_pt1_mac_switch",
    "code": "H03-PT1",
    "chapter": "Hoofdstuk 03 - Layer 2 Switching & MAC-Adrestabellen",
    "title": "Les 03 PT: Switch, ARP, ICMP en MAC-Address-Table",
    "timeLimitMinutes": 45,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 03 PT: Switch, ARP, ICMP en MAC-Address-Table\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les03_PT_ARP_MAC_ADDR_TAB.html](https://vwgert.github.io/networksess/Les03_PT_ARP_MAC_ADDR_TAB.html)\n\n### Doel van het labo:\nOnderzoek hoe een switch Layer 2 frames doorschakelt en hoe de **MAC-address-table** dynamisch wordt opgebouwd. Je bestudeert ARP-verzoeken en ICMP echo-pakketten.\n\n### Opdrachten:\n1. Bekijk de initiële MAC-adrestabel van `Switch0` via de CLI: `show mac-address-table`.\n2. Configureer het IP-adres op `PC1`: `192.168.1.20` met masker `255.255.255.0`.\n3. Ping vanuit `PC0` (192.168.1.10) naar `PC1` (192.168.1.20).\n4. Controleer de MAC-adrestabel opnieuw en verifieer dat beide poorten geregistreerd zijn.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "PC0",
          "name": "PC0",
          "type": "pc",
          "x": 150,
          "y": 280,
          "dhcpEnabled": false,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "gateway": "",
          "dns": ""
        },
        {
          "id": "Switch0",
          "name": "Switch0",
          "type": "switch",
          "x": 350,
          "y": 180
        },
        {
          "id": "PC1",
          "name": "PC1",
          "type": "pc",
          "x": 550,
          "y": 280,
          "dhcpEnabled": false,
          "ip": "",
          "mask": "",
          "gateway": "",
          "dns": ""
        }
      ],
      "cables": [
        {
          "fromDevice": "PC0",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "PC1",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/2",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "pc1_ip_config",
        "category": "interface_ip",
        "title": "PC1 IP Configuratie",
        "desc": "PC1 heeft IP 192.168.1.20 met masker 255.255.255.0",
        "type": "interface_ip",
        "checkType": "interface_ip",
        "points": 50,
        "enabled": true,
        "condition": {
          "deviceId": "PC1",
          "portName": "FastEthernet0",
          "expectedIp": "192.168.1.20",
          "expectedMask": "255.255.255.0"
        }
      },
      {
        "id": "ping_pc0_pc1",
        "category": "connectivity",
        "title": "ICMP Ping",
        "desc": "Succesvolle ping tussen PC0 en PC1",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 50,
        "enabled": true,
        "condition": {
          "fromDevice": "PC0",
          "targetIp": "192.168.1.20"
        }
      }
    ]
  },
  {
    "id": "h03_pt2_multi_mac",
    "code": "H03-PT2",
    "chapter": "Hoofdstuk 03 - Layer 2 Switching & MAC-Adrestabellen",
    "title": "Les 03 PT: Meerdere MAC-adressen per switchpoort",
    "timeLimitMinutes": 50,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 03 PT: Meerdere MAC-adressen per switchpoort\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les03_PT_MAC_ADDR_TAB_Multi.html](https://vwgert.github.io/networksess/Les03_PT_MAC_ADDR_TAB_Multi.html)\n\n### Doel van het labo:\nOnderzoek hoe een switch MAC-adressen leert wanneer er achter een poort een tweede switch staat gekoppeld. Een switch leert het bron-MAC-adres van frames op de poort waar ze binnenkomen. Staan er meerdere toestellen achter die poort (zoals via een uplink-kabel), dan krijgen meerdere dynamische MAC-adressen dezelfde poort toegewezen.\n\n### Opdrachten:\n1. Verbind `Switch-Links` (GigabitEthernet0/1) met `Switch-Rechts` (GigabitEthernet0/1).\n2. Configureer IP `192.168.1.10` op `Laptop0` en `192.168.1.50` op `Laptop4`.\n3. Ping tussen `Laptop0` en `Laptop4`.\n4. Voer op `Switch-Links` het commando `show mac-address-table` uit en merk op dat de MAC-adressen van de rechterzijde allemaal op `GigabitEthernet0/1` verschijnen.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "Laptop0",
          "name": "Laptop0",
          "type": "laptop",
          "x": 120,
          "y": 140,
          "dhcpEnabled": false,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "gateway": "",
          "dns": ""
        },
        {
          "id": "Laptop1",
          "name": "Laptop1",
          "type": "laptop",
          "x": 120,
          "y": 280,
          "dhcpEnabled": false,
          "ip": "192.168.1.20",
          "mask": "255.255.255.0",
          "gateway": "",
          "dns": ""
        },
        {
          "id": "Switch-Links",
          "name": "Switch-Links",
          "type": "switch",
          "x": 280,
          "y": 210
        },
        {
          "id": "Switch-Rechts",
          "name": "Switch-Rechts",
          "type": "switch",
          "x": 480,
          "y": 210
        },
        {
          "id": "Laptop4",
          "name": "Laptop4",
          "type": "laptop",
          "x": 640,
          "y": 140,
          "dhcpEnabled": false,
          "ip": "",
          "mask": "",
          "gateway": "",
          "dns": ""
        },
        {
          "id": "Laptop5",
          "name": "Laptop5",
          "type": "laptop",
          "x": 640,
          "y": 280,
          "dhcpEnabled": false,
          "ip": "192.168.1.60",
          "mask": "255.255.255.0",
          "gateway": "",
          "dns": ""
        }
      ],
      "cables": [
        {
          "fromDevice": "Laptop0",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch-Links",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Laptop1",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch-Links",
          "toPort": "FastEthernet0/2",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Laptop5",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch-Rechts",
          "toPort": "FastEthernet0/2",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "uplink_cable",
        "category": "cabling",
        "title": "Uplink Switch-naar-Switch",
        "desc": "Gigabit-kabel tussen Switch-Links en Switch-Rechts",
        "type": "cabling",
        "checkType": "cabling",
        "points": 35,
        "enabled": true,
        "condition": {
          "fromDevice": "Switch-Links",
          "fromPort": "GigabitEthernet0/1",
          "toDevice": "Switch-Rechts",
          "toPort": "GigabitEthernet0/1"
        }
      },
      {
        "id": "laptop4_cable",
        "category": "cabling",
        "title": "Kabel Laptop4",
        "desc": "Laptop4 aangesloten op Switch-Rechts FastEthernet0/1",
        "type": "cabling",
        "checkType": "cabling",
        "points": 25,
        "enabled": true,
        "condition": {
          "fromDevice": "Laptop4",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch-Rechts",
          "toPort": "FastEthernet0/1"
        }
      },
      {
        "id": "laptop4_ip",
        "category": "interface_ip",
        "title": "IP Laptop4",
        "desc": "Laptop4 geconfigureerd met IP 192.168.1.50 / 255.255.255.0",
        "type": "interface_ip",
        "checkType": "interface_ip",
        "points": 20,
        "enabled": true,
        "condition": {
          "deviceId": "Laptop4",
          "portName": "FastEthernet0",
          "expectedIp": "192.168.1.50",
          "expectedMask": "255.255.255.0"
        }
      },
      {
        "id": "ping_across_switches",
        "category": "connectivity",
        "title": "End-to-End Ping",
        "desc": "Succesvolle ping tussen Laptop0 en Laptop4 over beide switches",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 20,
        "enabled": true,
        "condition": {
          "fromDevice": "Laptop0",
          "targetIp": "192.168.1.50"
        }
      }
    ]
  },
  {
    "id": "h04_challenge1_hosts_blackhole",
    "code": "H04-Challenge1",
    "chapter": "Hoofdstuk 04 - DNS, DHCP & Toepassingslaag",
    "title": "Les 04 Challenge: De hosts-file manipuleren & DNS Blackholing",
    "timeLimitMinutes": 45,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 04 Challenge: De hosts-file manipuleren\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les04_Challenge.html](https://vwgert.github.io/networksess/Les04_Challenge.html)\n\n### Overzicht Challenge:\nIn deze individuele opdracht ontdek je hoe Windows URL-namen naar IP-adressen omzet, en hoe je dat proces zelf kan beïnvloeden via de `hosts`-file (`C:\\Windows\\System32\\drivers\\etc\\hosts`).\nDe entries in deze file worden geraadpleegd vóór een DNS-server wordt gecontacteerd.\n\n### Opdrachten:\n1. Inspecteer de DNS instellingen op `Client-PC` via PowerShell: `Get-DnsClientServerAddress`.\n2. Verifieer dat `www.pxl.be` resolvet naar de PXL Webserver `192.168.1.20` via `Resolve-DnsName www.pxl.be`.\n3. Bekijk de lokale hosts entry via PowerShell `Get-Content C:\\Windows\\System32\\drivers\\etc\\hosts`.\n4. Pas de configuratie aan zodat `Client-PC` direct verbinding kan maken met de PXL Webserver.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "Client-PC",
          "name": "Client-PC",
          "type": "pc",
          "x": 150,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "192.168.1.50",
          "mask": "255.255.255.0",
          "gateway": "192.168.1.1",
          "dns": "192.168.1.10"
        },
        {
          "id": "Switch0",
          "name": "Switch0",
          "type": "switch",
          "x": 350,
          "y": 200
        },
        {
          "id": "DNS-Server",
          "name": "DNS-Server",
          "type": "server",
          "x": 550,
          "y": 120,
          "dhcpEnabled": false,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.1.1",
          "dns": "",
          "services": {
            "dns": true
          },
          "dnsRecords": [
            {
              "name": "www.pxl.be",
              "type": "A",
              "ip": "192.168.1.20"
            }
          ]
        },
        {
          "id": "PXL-Webserver",
          "name": "PXL-Webserver",
          "type": "server",
          "x": 550,
          "y": 280,
          "dhcpEnabled": false,
          "ip": "192.168.1.20",
          "mask": "255.255.255.0",
          "gateway": "192.168.1.1",
          "dns": "",
          "services": {
            "http": true
          }
        }
      ],
      "cables": [
        {
          "fromDevice": "Client-PC",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "DNS-Server",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/2",
          "type": "copper_straight"
        },
        {
          "fromDevice": "PXL-Webserver",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/3",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "dns_server_record",
        "category": "services",
        "title": "DNS Record www.pxl.be",
        "desc": "A-record voor www.pxl.be wijst naar 192.168.1.20",
        "type": "dns_record",
        "checkType": "dns_record",
        "points": 40,
        "enabled": true,
        "condition": {
          "name": "www.pxl.be",
          "ip": "192.168.1.20"
        }
      },
      {
        "id": "client_ping_dns",
        "category": "connectivity",
        "title": "Ping DNS Server",
        "desc": "Client-PC kan DNS-server pingen",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "Client-PC",
          "targetIp": "192.168.1.10"
        }
      },
      {
        "id": "client_ping_web",
        "category": "connectivity",
        "title": "Ping Webserver",
        "desc": "Client-PC kan PXL Webserver pingen",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "Client-PC",
          "targetIp": "192.168.1.20"
        }
      }
    ]
  },
  {
    "id": "h04_challenge2_team_dns",
    "code": "H04-Challenge2",
    "chapter": "Hoofdstuk 04 - DNS, DHCP & Toepassingslaag",
    "title": "Les 04 Challenge 2: Eigen DNS-server (labo.local) & Wireshark",
    "timeLimitMinutes": 50,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 04 Challenge 2: Eigen DNS-server (labo.local) & Wireshark\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les04_Challenge2.html](https://vwgert.github.io/networksess/Les04_Challenge2.html)\n\n### Overzicht Challenge:\nIn deze challenge richt één van de apparaten een DNS-zone `labo.local` in:\n1. Server configureert een forward lookup zone voor domein `labo.local` met A-records voor `ns1.labo.local` en `www.labo.local`.\n2. De client-laptop stelt het IP van deze DNS-server in (`192.168.1.10`).\n3. De client gebruikt PowerShell `Resolve-DnsName www.labo.local` en surft naar `http://www.labo.local` via `Invoke-WebRequest` of de browser.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "Student-Laptop",
          "name": "Student-Laptop",
          "type": "laptop",
          "x": 160,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "192.168.1.50",
          "mask": "255.255.255.0",
          "gateway": "",
          "dns": ""
        },
        {
          "id": "Switch-Lab",
          "name": "Switch-Lab",
          "type": "switch",
          "x": 360,
          "y": 200
        },
        {
          "id": "Labo-Server",
          "name": "Labo-Server",
          "type": "server",
          "x": 560,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "gateway": "",
          "dns": "192.168.1.10",
          "services": {
            "http": true,
            "dns": true
          },
          "dnsRecords": [
            {
              "name": "www.labo.local",
              "type": "A",
              "ip": "192.168.1.10"
            },
            {
              "name": "ns1.labo.local",
              "type": "A",
              "ip": "192.168.1.10"
            }
          ]
        }
      ],
      "cables": [
        {
          "fromDevice": "Student-Laptop",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch-Lab",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Labo-Server",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch-Lab",
          "toPort": "FastEthernet0/2",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "client_dns_config",
        "category": "interface_ip",
        "title": "Client DNS Server Ingesteld",
        "desc": "Student-Laptop heeft DNS server 192.168.1.10 geconfigureerd",
        "type": "interface_ip",
        "checkType": "interface_ip",
        "points": 35,
        "enabled": true,
        "condition": {
          "deviceId": "Student-Laptop",
          "dns": "192.168.1.10"
        }
      },
      {
        "id": "dns_record_labo",
        "category": "services",
        "title": "DNS Record www.labo.local",
        "desc": "A-record www.labo.local aanwezig op Labo-Server",
        "type": "dns_record",
        "checkType": "dns_record",
        "points": 35,
        "enabled": true,
        "condition": {
          "name": "www.labo.local",
          "ip": "192.168.1.10"
        }
      },
      {
        "id": "ping_server",
        "category": "connectivity",
        "title": "Ping Labo-Server",
        "desc": "Succesvolle ping tussen Student-Laptop en Labo-Server",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "Student-Laptop",
          "targetIp": "192.168.1.10"
        }
      }
    ]
  },
  {
    "id": "h04_pt1_dns_http",
    "code": "H04-PT1",
    "chapter": "Hoofdstuk 04 - DNS, DHCP & Toepassingslaag",
    "title": "Les 04 PT: DHCP, DNS en HTTP Webserver in Simulation Mode",
    "timeLimitMinutes": 50,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 04 PT: DHCP + DNS + HTTP in Simulation Mode\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les04_PT_DNS.html](https://vwgert.github.io/networksess/Les04_PT_DNS.html)\n\n### Doel van het labo:\nIn dit labo zie je hoe DHCP automatisch IP-adressen toekent, hoe DNS domeinnamen vertaalt naar IP-adressen, en hoe HTTP webpagina's serveert. Je test dit zowel via de browser als via Windows PowerShell.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "PC0",
          "name": "PC0",
          "type": "pc",
          "x": 140,
          "y": 220,
          "dhcpEnabled": true,
          "ip": "",
          "mask": "",
          "gateway": "",
          "dns": ""
        },
        {
          "id": "Switch0",
          "name": "Switch0",
          "type": "switch",
          "x": 320,
          "y": 220
        },
        {
          "id": "DHCP-DNS-Server",
          "name": "DHCP-DNS-Server",
          "type": "server",
          "x": 520,
          "y": 140,
          "dhcpEnabled": false,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "gateway": "",
          "dns": "192.168.1.10",
          "services": {
            "http": false,
            "dns": true,
            "dhcp": true
          },
          "dnsRecords": [
            {
              "name": "www.pxl.be",
              "type": "A",
              "ip": "192.168.1.100"
            }
          ]
        },
        {
          "id": "Webserver",
          "name": "Webserver",
          "type": "server",
          "x": 520,
          "y": 300,
          "dhcpEnabled": false,
          "ip": "192.168.1.100",
          "mask": "255.255.255.0",
          "gateway": "",
          "dns": "",
          "services": {
            "http": true,
            "dns": false,
            "dhcp": false
          }
        }
      ],
      "cables": [
        {
          "fromDevice": "PC0",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "DHCP-DNS-Server",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/2",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Webserver",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/3",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "pc0_dhcp_received",
        "category": "interface_ip",
        "title": "DHCP Lease PC0",
        "desc": "PC0 ontvangt een geldig IP in subnet 192.168.1.0/24",
        "type": "ip_subnet",
        "checkType": "ip_subnet",
        "points": 35,
        "enabled": true,
        "condition": {
          "deviceId": "PC0",
          "subnetPrefix": "192.168.1.",
          "expectedMask": "255.255.255.0"
        }
      },
      {
        "id": "dns_resolution",
        "category": "services",
        "title": "DNS Resolutie www.pxl.be",
        "desc": "DNS-server heeft record www.pxl.be -> 192.168.1.100",
        "type": "dns_record",
        "checkType": "dns_record",
        "points": 35,
        "enabled": true,
        "condition": {
          "name": "www.pxl.be",
          "ip": "192.168.1.100"
        }
      },
      {
        "id": "http_web_active",
        "category": "services",
        "title": "HTTP Web Server",
        "desc": "HTTP service actief op Webserver",
        "type": "http_get",
        "checkType": "http_get",
        "points": 30,
        "enabled": true,
        "condition": {
          "serverId": "Webserver"
        }
      }
    ]
  },
  {
    "id": "h05_labo1_mikrotik",
    "code": "H05-Labo1",
    "chapter": "Hoofdstuk 05 - Routering, Subnets & Gateways",
    "title": "Les 05 Labo 1: MikroTik hEX lite als Router (4 Netwerken)",
    "timeLimitMinutes": 50,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 05 Labo 1: MikroTik hEX lite als Router\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les05_Labo1.html](https://vwgert.github.io/networksess/Les05_Labo1.html)\n\n### Doel van het labo:\nIn dit labo configureer je een **MikroTik hEX lite** router via RouterOS CLI. Je kent IP-adressen toe aan interfaces en routeert verkeer tussen clients in afzonderlijke subnetten.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "MikroTik-R1",
          "name": "MikroTik-R1",
          "type": "mikrotik",
          "x": 360,
          "y": 180,
          "interfaces": {
            "ether1": {
              "ip": "192.168.1.1",
              "mask": "255.255.255.0",
              "shutdown": false
            },
            "ether2": {
              "ip": "192.168.2.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          }
        },
        {
          "id": "PC-LAN1",
          "name": "PC-LAN1",
          "type": "pc",
          "x": 160,
          "y": 280,
          "dhcpEnabled": false,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.1.1",
          "dns": ""
        },
        {
          "id": "PC-LAN2",
          "name": "PC-LAN2",
          "type": "pc",
          "x": 560,
          "y": 280,
          "dhcpEnabled": false,
          "ip": "",
          "mask": "",
          "gateway": "",
          "dns": ""
        }
      ],
      "cables": [
        {
          "fromDevice": "PC-LAN1",
          "fromPort": "FastEthernet0",
          "toDevice": "MikroTik-R1",
          "toPort": "ether1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "PC-LAN2",
          "fromPort": "FastEthernet0",
          "toDevice": "MikroTik-R1",
          "toPort": "ether2",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "pc_lan2_ip",
        "category": "interface_ip",
        "title": "PC-LAN2 IP & Gateway",
        "desc": "PC-LAN2 heeft IP 192.168.2.10 en gateway 192.168.2.1",
        "type": "interface_ip",
        "checkType": "interface_ip",
        "points": 40,
        "enabled": true,
        "condition": {
          "deviceId": "PC-LAN2",
          "portName": "FastEthernet0",
          "expectedIp": "192.168.2.10",
          "expectedMask": "255.255.255.0"
        }
      },
      {
        "id": "pc_lan2_gw",
        "category": "routing",
        "title": "Default Gateway",
        "desc": "Default gateway van PC-LAN2 is 192.168.2.1",
        "type": "default_gateway",
        "checkType": "default_gateway",
        "points": 30,
        "enabled": true,
        "condition": {
          "deviceId": "PC-LAN2",
          "expected": "192.168.2.1"
        }
      },
      {
        "id": "ping_inter_lan",
        "category": "connectivity",
        "title": "Inter-LAN Routing Ping",
        "desc": "Succesvolle ping van PC-LAN1 naar PC-LAN2 (192.168.2.10)",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "PC-LAN1",
          "targetIp": "192.168.2.10"
        }
      }
    ]
  },
  {
    "id": "h05_labo2_mikrotik_2lans",
    "code": "H05-Labo2",
    "chapter": "Hoofdstuk 05 - Routering, Subnets & Gateways",
    "title": "Les 05 Labo 2: MikroTik routeert tussen twee LAN-netwerken",
    "timeLimitMinutes": 50,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 05 - Labo 2: MikroTik routeert tussen twee LAN-netwerken\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les05_Labo2.html](https://vwgert.github.io/networksess/Les05_Labo2.html)\n\n### Overzicht en netwerktopologie:\nIn dit labo werken 2 teams (Team 1 en Team 2). Elk team hangt via een switch aan een poort van de MikroTik-router:\n- **Team 1:** `192.168.100.0/24` via switch op `ether2` (`192.168.100.1`)\n- **Team 2:** `192.168.200.0/24` via switch op `ether3` (`192.168.200.1`)\nDe MikroTik verzorgt de routering tussen beide netwerken zodat alle studenten met elkaar kunnen communiceren.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "MikroTik-Router",
          "name": "MikroTik-Router",
          "type": "mikrotik",
          "x": 370,
          "y": 140,
          "interfaces": {
            "ether2": {
              "ip": "192.168.100.1",
              "mask": "255.255.255.0",
              "shutdown": false
            },
            "ether3": {
              "ip": "192.168.200.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          }
        },
        {
          "id": "Switch-Team1",
          "name": "Switch-Team1",
          "type": "switch",
          "x": 200,
          "y": 240
        },
        {
          "id": "Switch-Team2",
          "name": "Switch-Team2",
          "type": "switch",
          "x": 540,
          "y": 240
        },
        {
          "id": "PC-Team1",
          "name": "PC-Team1",
          "type": "pc",
          "x": 120,
          "y": 340,
          "dhcpEnabled": false,
          "ip": "192.168.100.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.100.1",
          "dns": ""
        },
        {
          "id": "PC-Team2",
          "name": "PC-Team2",
          "type": "pc",
          "x": 620,
          "y": 340,
          "dhcpEnabled": false,
          "ip": "",
          "mask": "",
          "gateway": "",
          "dns": ""
        }
      ],
      "cables": [
        {
          "fromDevice": "MikroTik-Router",
          "fromPort": "ether2",
          "toDevice": "Switch-Team1",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "MikroTik-Router",
          "fromPort": "ether3",
          "toDevice": "Switch-Team2",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "PC-Team1",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch-Team1",
          "toPort": "FastEthernet0/2",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "cable_team2",
        "category": "cabling",
        "title": "Bekabeling Team 2",
        "desc": "PC-Team2 verbonden met Switch-Team2",
        "type": "cabling",
        "checkType": "cabling",
        "points": 25,
        "enabled": true,
        "condition": {
          "fromDevice": "PC-Team2",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch-Team2",
          "toPort": "FastEthernet0/2"
        }
      },
      {
        "id": "ip_team2",
        "category": "interface_ip",
        "title": "IP PC-Team2",
        "desc": "PC-Team2 heeft IP in 192.168.200.0/24",
        "type": "ip_subnet",
        "checkType": "ip_subnet",
        "points": 25,
        "enabled": true,
        "condition": {
          "deviceId": "PC-Team2",
          "subnetPrefix": "192.168.200.",
          "expectedMask": "255.255.255.0"
        }
      },
      {
        "id": "gw_team2",
        "category": "routing",
        "title": "Gateway Team 2",
        "desc": "PC-Team2 heeft default gateway 192.168.200.1",
        "type": "default_gateway",
        "checkType": "default_gateway",
        "points": 25,
        "enabled": true,
        "condition": {
          "deviceId": "PC-Team2",
          "expected": "192.168.200.1"
        }
      },
      {
        "id": "ping_teams",
        "category": "connectivity",
        "title": "Inter-Team Ping",
        "desc": "Succesvolle ping tussen Team 1 en Team 2",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 25,
        "enabled": true,
        "condition": {
          "fromDevice": "PC-Team1",
          "target": "PC-Team2"
        }
      }
    ]
  },
  {
    "id": "h05_labo3_mikrotik_static_routes",
    "code": "H05-Labo3",
    "chapter": "Hoofdstuk 05 - Routering, Subnets & Gateways",
    "title": "Les 05 Labo 3: Static routes tussen twee MikroTik routers",
    "timeLimitMinutes": 55,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 05 - Labo 3: Static routes tussen twee routers en twee LAN-netwerken\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les05_Labo3.html](https://vwgert.github.io/networksess/Les05_Labo3.html)\n\n### Overzicht en netwerktopologie:\nTwee teams zijn verbonden via twee routers met een inter-router link (`10.0.0.0/30`):\n- **Router 1:** `ether2` = `192.168.100.1/24`, `ether1` = `10.0.0.1/30`\n- **Router 2:** `ether2` = `192.168.200.1/24`, `ether1` = `10.0.0.2/30`\nOmdat routers elkaars LAN niet automatisch kennen, moeten **static routes** toegevoegd worden:\n- Op Router 1: route naar `192.168.200.0/24` via gateway `10.0.0.2`\n- Op Router 2: route naar `192.168.100.0/24` via gateway `10.0.0.1`\n",
    "initialTopology": {
      "devices": [
        {
          "id": "MikroTik-R1",
          "name": "MikroTik-R1",
          "type": "mikrotik",
          "x": 260,
          "y": 160,
          "interfaces": {
            "ether1": {
              "ip": "10.0.0.1",
              "mask": "255.255.255.252",
              "shutdown": false
            },
            "ether2": {
              "ip": "192.168.100.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          },
          "staticRoutes": [
            {
              "network": "192.168.200.0",
              "mask": "255.255.255.0",
              "nextHop": "10.0.0.2"
            }
          ]
        },
        {
          "id": "MikroTik-R2",
          "name": "MikroTik-R2",
          "type": "mikrotik",
          "x": 520,
          "y": 160,
          "interfaces": {
            "ether1": {
              "ip": "10.0.0.2",
              "mask": "255.255.255.252",
              "shutdown": false
            },
            "ether2": {
              "ip": "192.168.200.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          },
          "staticRoutes": [
            {
              "network": "192.168.100.0",
              "mask": "255.255.255.0",
              "nextHop": "10.0.0.1"
            }
          ]
        },
        {
          "id": "PC-Team1",
          "name": "PC-Team1",
          "type": "pc",
          "x": 120,
          "y": 260,
          "dhcpEnabled": false,
          "ip": "192.168.100.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.100.1",
          "dns": ""
        },
        {
          "id": "PC-Team2",
          "name": "PC-Team2",
          "type": "pc",
          "x": 660,
          "y": 260,
          "dhcpEnabled": false,
          "ip": "192.168.200.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.200.1",
          "dns": ""
        }
      ],
      "cables": [
        {
          "fromDevice": "MikroTik-R1",
          "fromPort": "ether1",
          "toDevice": "MikroTik-R2",
          "toPort": "ether1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "PC-Team1",
          "fromPort": "FastEthernet0",
          "toDevice": "MikroTik-R1",
          "toPort": "ether2",
          "type": "copper_straight"
        },
        {
          "fromDevice": "PC-Team2",
          "fromPort": "FastEthernet0",
          "toDevice": "MikroTik-R2",
          "toPort": "ether2",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "r1_static_route",
        "category": "routing",
        "title": "Static Route R1",
        "desc": "Router 1 heeft route naar 192.168.200.0/24 via 10.0.0.2",
        "type": "static_route",
        "checkType": "static_route",
        "points": 35,
        "enabled": true,
        "condition": {
          "routerId": "MikroTik-R1",
          "network": "192.168.200.0",
          "mask": "255.255.255.0",
          "nextHop": "10.0.0.2"
        }
      },
      {
        "id": "r2_static_route",
        "category": "routing",
        "title": "Static Route R2",
        "desc": "Router 2 heeft route naar 192.168.100.0/24 via 10.0.0.1",
        "type": "static_route",
        "checkType": "static_route",
        "points": 35,
        "enabled": true,
        "condition": {
          "routerId": "MikroTik-R2",
          "network": "192.168.100.0",
          "mask": "255.255.255.0",
          "nextHop": "10.0.0.1"
        }
      },
      {
        "id": "end_to_end_ping",
        "category": "connectivity",
        "title": "End-to-End Ping",
        "desc": "Succesvolle ping tussen PC-Team1 en PC-Team2 over beide routers",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "PC-Team1",
          "targetIp": "192.168.200.10"
        }
      }
    ]
  },
  {
    "id": "h05_challenge1_gateway_last_resort",
    "code": "H05-Challenge1",
    "chapter": "Hoofdstuk 05 - Routering, Subnets & Gateways",
    "title": "Les 05 Challenge 1: Routerketen & Gateway of Last Resort (0.0.0.0/0)",
    "timeLimitMinutes": 55,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 05 Challenge 1: Routerketen en Gateway of Last Resort\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les05_Challenge1.html](https://vwgert.github.io/networksess/Les05_Challenge1.html)\n\n### Overzicht Challenge:\nIn deze challenge tonen we aan dat een **default route** (`0.0.0.0/0` of Gateway of Last Resort) werkt als \"fallback\" naar de volgende router richting de lector/internet.\nZo hoef je niet op elke router alle individuele netwerken in te geven voor uitgaand verkeer.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "Student-PC",
          "name": "Student-PC",
          "type": "pc",
          "x": 120,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "192.168.100.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.100.1",
          "dns": ""
        },
        {
          "id": "Team-Router",
          "name": "Team-Router",
          "type": "mikrotik",
          "x": 320,
          "y": 200,
          "interfaces": {
            "ether1": {
              "ip": "10.10.10.2",
              "mask": "255.255.255.252",
              "shutdown": false
            },
            "ether2": {
              "ip": "192.168.100.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          },
          "staticRoutes": [
            {
              "network": "0.0.0.0",
              "mask": "0.0.0.0",
              "nextHop": "10.10.10.1"
            }
          ]
        },
        {
          "id": "Lector-Router",
          "name": "Lector-Router",
          "type": "mikrotik",
          "x": 520,
          "y": 200,
          "interfaces": {
            "ether1": {
              "ip": "10.10.10.1",
              "mask": "255.255.255.252",
              "shutdown": false
            },
            "ether2": {
              "ip": "172.16.0.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          },
          "staticRoutes": [
            {
              "network": "192.168.100.0",
              "mask": "255.255.255.0",
              "nextHop": "10.10.10.2"
            }
          ]
        },
        {
          "id": "Lector-Webserver",
          "name": "Lector-Webserver",
          "type": "server",
          "x": 700,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "172.16.0.50",
          "mask": "255.255.255.0",
          "gateway": "172.16.0.1",
          "dns": "",
          "services": {
            "http": true
          }
        }
      ],
      "cables": [
        {
          "fromDevice": "Student-PC",
          "fromPort": "FastEthernet0",
          "toDevice": "Team-Router",
          "toPort": "ether2",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Team-Router",
          "fromPort": "ether1",
          "toDevice": "Lector-Router",
          "toPort": "ether1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Lector-Router",
          "fromPort": "ether2",
          "toDevice": "Lector-Webserver",
          "toPort": "FastEthernet0",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "team_default_route",
        "category": "routing",
        "title": "Default Route (0.0.0.0/0)",
        "desc": "Team-Router heeft default route 0.0.0.0/0 via 10.10.10.1",
        "type": "static_route",
        "checkType": "static_route",
        "points": 40,
        "enabled": true,
        "condition": {
          "routerId": "Team-Router",
          "network": "0.0.0.0",
          "mask": "0.0.0.0",
          "nextHop": "10.10.10.1"
        }
      },
      {
        "id": "ping_lector_server",
        "category": "connectivity",
        "title": "Ping Lector Webserver",
        "desc": "Succesvolle ping van Student-PC naar Lector-Webserver (172.16.0.50)",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 35,
        "enabled": true,
        "condition": {
          "fromDevice": "Student-PC",
          "targetIp": "172.16.0.50"
        }
      },
      {
        "id": "lector_http",
        "category": "services",
        "title": "Lector HTTP Bereikbaar",
        "desc": "Webserver actief op Lector-Webserver",
        "type": "http_get",
        "checkType": "http_get",
        "points": 25,
        "enabled": true,
        "condition": {
          "serverId": "Lector-Webserver"
        }
      }
    ]
  },
  {
    "id": "h05_challenge2_rip_routing",
    "code": "H05-Challenge2",
    "chapter": "Hoofdstuk 05 - Routering, Subnets & Gateways",
    "title": "Les 05 Challenge 2: Routerketen & Dynamische Routering met RIP",
    "timeLimitMinutes": 55,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 05 Challenge 2: Routerketen en RIP Dynamische Routering\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les05_Challenge2.html](https://vwgert.github.io/networksess/Les05_Challenge2.html)\n\n### Overzicht Challenge:\nIn deze challenge bouwen routers een dynamische keten via het protocol **RIP** (Routing Information Protocol).\nAlle routers wisselen automatisch routes uit zodat elk team verbinding kan maken zonder handmatige static routes.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "PC-LAN1",
          "name": "PC-LAN1",
          "type": "pc",
          "x": 120,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "192.168.10.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.10.1",
          "dns": ""
        },
        {
          "id": "Router1",
          "name": "Router1",
          "type": "router",
          "x": 300,
          "y": 200,
          "interfaces": {
            "GigabitEthernet0/0/0": {
              "ip": "192.168.10.1",
              "mask": "255.255.255.0",
              "shutdown": false
            },
            "GigabitEthernet0/0/1": {
              "ip": "10.0.12.1",
              "mask": "255.255.255.252",
              "shutdown": false
            }
          },
          "staticRoutes": [
            {
              "network": "192.168.30.0",
              "mask": "255.255.255.0",
              "nextHop": "10.0.12.2"
            }
          ]
        },
        {
          "id": "Router2",
          "name": "Router2",
          "type": "router",
          "x": 500,
          "y": 200,
          "interfaces": {
            "GigabitEthernet0/0/0": {
              "ip": "10.0.12.2",
              "mask": "255.255.255.252",
              "shutdown": false
            },
            "GigabitEthernet0/0/1": {
              "ip": "192.168.30.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          },
          "staticRoutes": [
            {
              "network": "192.168.10.0",
              "mask": "255.255.255.0",
              "nextHop": "10.0.12.1"
            }
          ]
        },
        {
          "id": "PC-LAN3",
          "name": "PC-LAN3",
          "type": "pc",
          "x": 680,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "192.168.30.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.30.1",
          "dns": ""
        }
      ],
      "cables": [
        {
          "fromDevice": "PC-LAN1",
          "fromPort": "FastEthernet0",
          "toDevice": "Router1",
          "toPort": "GigabitEthernet0/0/0",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Router1",
          "fromPort": "GigabitEthernet0/0/1",
          "toDevice": "Router2",
          "toPort": "GigabitEthernet0/0/0",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Router2",
          "fromPort": "GigabitEthernet0/0/1",
          "toDevice": "PC-LAN3",
          "toPort": "FastEthernet0",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "r1_int_ip",
        "category": "interface_ip",
        "title": "Router1 IP Configuratie",
        "desc": "Gig0/0/0 geconfigureerd met 192.168.10.1",
        "type": "interface_ip",
        "checkType": "interface_ip",
        "points": 35,
        "enabled": true,
        "condition": {
          "deviceId": "Router1",
          "portName": "GigabitEthernet0/0/0",
          "expectedIp": "192.168.10.1",
          "expectedMask": "255.255.255.0"
        }
      },
      {
        "id": "r2_int_ip",
        "category": "interface_ip",
        "title": "Router2 IP Configuratie",
        "desc": "Gig0/0/1 geconfigureerd met 192.168.30.1",
        "type": "interface_ip",
        "checkType": "interface_ip",
        "points": 35,
        "enabled": true,
        "condition": {
          "deviceId": "Router2",
          "portName": "GigabitEthernet0/0/1",
          "expectedIp": "192.168.30.1",
          "expectedMask": "255.255.255.0"
        }
      },
      {
        "id": "ping_dynamic_converged",
        "category": "connectivity",
        "title": "End-to-End Ping",
        "desc": "Succesvolle communicatie tussen PC-LAN1 en PC-LAN3",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "PC-LAN1",
          "targetIp": "192.168.30.10"
        }
      }
    ]
  },
  {
    "id": "h05_pt1_cisco_1router",
    "code": "H05-PT1",
    "chapter": "Hoofdstuk 05 - Routering, Subnets & Gateways",
    "title": "Les 05 PT: Twee LANs via Eén Cisco Router",
    "timeLimitMinutes": 50,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 05 PT: Twee netwerken gekoppeld met 1 Cisco router\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les05_PT_1router.html](https://vwgert.github.io/networksess/Les05_PT_1router.html)\n\n### Doel van het labo:\nIn dit labo koppel je twee afzonderlijke LAN's via één Cisco router:\n- **LAN 1:** `192.168.1.0/24` via `GigabitEthernet0/0/0` (`192.168.1.1`)\n- **LAN 2:** `192.168.2.0/24` via `GigabitEthernet0/0/1` (`192.168.2.1`)\n",
    "initialTopology": {
      "devices": [
        {
          "id": "PC0",
          "name": "PC0",
          "type": "pc",
          "x": 140,
          "y": 280,
          "dhcpEnabled": false,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.1.1",
          "dns": ""
        },
        {
          "id": "Switch0",
          "name": "Switch0",
          "type": "switch",
          "x": 240,
          "y": 180
        },
        {
          "id": "Router0",
          "name": "Router0",
          "type": "router",
          "x": 400,
          "y": 140,
          "interfaces": {
            "GigabitEthernet0/0/0": {
              "ip": "192.168.1.1",
              "mask": "255.255.255.0",
              "shutdown": false
            },
            "GigabitEthernet0/0/1": {
              "ip": "192.168.2.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          }
        },
        {
          "id": "Switch1",
          "name": "Switch1",
          "type": "switch",
          "x": 560,
          "y": 180
        },
        {
          "id": "PC1",
          "name": "PC1",
          "type": "pc",
          "x": 660,
          "y": 280,
          "dhcpEnabled": false,
          "ip": "",
          "mask": "",
          "gateway": "",
          "dns": ""
        }
      ],
      "cables": [
        {
          "fromDevice": "PC0",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Switch0",
          "fromPort": "GigabitEthernet0/1",
          "toDevice": "Router0",
          "toPort": "GigabitEthernet0/0/0",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Router0",
          "fromPort": "GigabitEthernet0/0/1",
          "toDevice": "Switch1",
          "toPort": "GigabitEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Switch1",
          "fromPort": "FastEthernet0/1",
          "toDevice": "PC1",
          "toPort": "FastEthernet0",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "pc1_ip_config",
        "category": "interface_ip",
        "title": "PC1 IP Configuratie",
        "desc": "PC1 heeft IP 192.168.2.10 en masker 255.255.255.0",
        "type": "interface_ip",
        "checkType": "interface_ip",
        "points": 35,
        "enabled": true,
        "condition": {
          "deviceId": "PC1",
          "portName": "FastEthernet0",
          "expectedIp": "192.168.2.10",
          "expectedMask": "255.255.255.0"
        }
      },
      {
        "id": "pc1_gw_config",
        "category": "routing",
        "title": "PC1 Gateway",
        "desc": "Default gateway van PC1 is 192.168.2.1",
        "type": "default_gateway",
        "checkType": "default_gateway",
        "points": 35,
        "enabled": true,
        "condition": {
          "deviceId": "PC1",
          "expected": "192.168.2.1"
        }
      },
      {
        "id": "ping_routed_pc0_pc1",
        "category": "connectivity",
        "title": "Inter-VLAN / Routing Ping",
        "desc": "Succesvolle ping tussen PC0 en PC1 over de router",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "PC0",
          "targetIp": "192.168.2.10"
        }
      }
    ]
  },
  {
    "id": "h05_pt2_cisco_2routers",
    "code": "H05-PT2",
    "chapter": "Hoofdstuk 05 - Routering, Subnets & Gateways",
    "title": "Les 05 PT: Twee LANs via Twee Cisco Routers (Static Routing)",
    "timeLimitMinutes": 55,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 05 PT: Twee netwerken via twee Cisco routers (Static Routing)\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les05_PT_2routers.html](https://vwgert.github.io/networksess/Les05_PT_2routers.html)\n\n### Doel van het labo:\nIn dit labo verbind je twee routers met een point-to-point link en configureer je static routes op beide routers:\n- **Router0:** `GigabitEthernet0/0/0` = `192.168.1.1/24`, `GigabitEthernet0/0/1` = `10.0.0.1/30`\n- **Router1:** `GigabitEthernet0/0/0` = `10.0.0.2/30`, `GigabitEthernet0/0/1` = `192.168.2.1/24`\n- Static route op Router0: `ip route 192.168.2.0 255.255.255.0 10.0.0.2`\n- Static route op Router1: `ip route 192.168.1.0 255.255.255.0 10.0.0.1`\n",
    "initialTopology": {
      "devices": [
        {
          "id": "PC0",
          "name": "PC0",
          "type": "pc",
          "x": 100,
          "y": 240,
          "dhcpEnabled": false,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.1.1",
          "dns": ""
        },
        {
          "id": "Router0",
          "name": "Router0",
          "type": "router",
          "x": 280,
          "y": 160,
          "interfaces": {
            "GigabitEthernet0/0/0": {
              "ip": "192.168.1.1",
              "mask": "255.255.255.0",
              "shutdown": false
            },
            "GigabitEthernet0/0/1": {
              "ip": "10.0.0.1",
              "mask": "255.255.255.252",
              "shutdown": false
            }
          },
          "staticRoutes": [
            {
              "network": "192.168.2.0",
              "mask": "255.255.255.0",
              "nextHop": "10.0.0.2"
            }
          ]
        },
        {
          "id": "Router1",
          "name": "Router1",
          "type": "router",
          "x": 500,
          "y": 160,
          "interfaces": {
            "GigabitEthernet0/0/0": {
              "ip": "10.0.0.2",
              "mask": "255.255.255.252",
              "shutdown": false
            },
            "GigabitEthernet0/0/1": {
              "ip": "192.168.2.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          },
          "staticRoutes": [
            {
              "network": "192.168.1.0",
              "mask": "255.255.255.0",
              "nextHop": "10.0.0.1"
            }
          ]
        },
        {
          "id": "PC1",
          "name": "PC1",
          "type": "pc",
          "x": 680,
          "y": 240,
          "dhcpEnabled": false,
          "ip": "192.168.2.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.2.1",
          "dns": ""
        }
      ],
      "cables": [
        {
          "fromDevice": "PC0",
          "fromPort": "FastEthernet0",
          "toDevice": "Router0",
          "toPort": "GigabitEthernet0/0/0",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Router0",
          "fromPort": "GigabitEthernet0/0/1",
          "toDevice": "Router1",
          "toPort": "GigabitEthernet0/0/0",
          "type": "copper_straight"
        },
        {
          "fromDevice": "Router1",
          "fromPort": "GigabitEthernet0/0/1",
          "toDevice": "PC1",
          "toPort": "FastEthernet0",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "router0_static_route",
        "category": "routing",
        "title": "Static Route Router0",
        "desc": "Route op Router0 naar 192.168.2.0/24 via 10.0.0.2",
        "type": "static_route",
        "checkType": "static_route",
        "points": 35,
        "enabled": true,
        "condition": {
          "routerId": "Router0",
          "network": "192.168.2.0",
          "mask": "255.255.255.0",
          "nextHop": "10.0.0.2"
        }
      },
      {
        "id": "router1_static_route",
        "category": "routing",
        "title": "Static Route Router1",
        "desc": "Route op Router1 naar 192.168.1.0/24 via 10.0.0.1",
        "type": "static_route",
        "checkType": "static_route",
        "points": 35,
        "enabled": true,
        "condition": {
          "routerId": "Router1",
          "network": "192.168.1.0",
          "mask": "255.255.255.0",
          "nextHop": "10.0.0.1"
        }
      },
      {
        "id": "end_to_end_ping",
        "category": "connectivity",
        "title": "End-to-End Ping",
        "desc": "Succesvolle ping tussen PC0 en PC1",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "PC0",
          "targetIp": "192.168.2.10"
        }
      }
    ]
  },
  {
    "id": "h06_pt1_thuisrouter_nat",
    "code": "H06-PT1",
    "chapter": "Hoofdstuk 06 - Thuisnetwerken, WiFi & NAT",
    "title": "Les 06 PT: Thuisrouter, NAT, DHCP, DNS, WiFi en WAN Internet",
    "timeLimitMinutes": 50,
    "showLiveScore": true,
    "liveInternet": true,
    "instructions": "## Les 06 PT: Thuisrouter, NAT, DHCP, DNS, WiFi en Port Forwarding\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les06_PT_Thuisrouter.html](https://vwgert.github.io/networksess/Les06_PT_Thuisrouter.html)\n\n### Doel van het labo:\nIn dit labo onderzoek je een complete thuisnetwerktopologie met een geïntegreerde thuisrouter (zoals OpenWrt of Cisco SOHO):\n- WAN-zijde met publieke IP-translatie (NAT Masquerade)\n- LAN-zijde met DHCP server en switchpoorten\n- WiFi Access Point\n- Echte internettoegang via `internet_public` of veilige simulatie via `internet_simulated`.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "HomeRouter",
          "name": "HomeRouter",
          "type": "openwrt",
          "x": 360,
          "y": 180,
          "interfaces": {
            "eth0": {
              "ip": "203.0.113.2",
              "mask": "255.255.255.0",
              "shutdown": false
            },
            "br-lan": {
              "ip": "192.168.1.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          }
        },
        {
          "id": "PC-Thuis",
          "name": "PC-Thuis",
          "type": "pc",
          "x": 160,
          "y": 280,
          "dhcpEnabled": true,
          "ip": "192.168.1.15",
          "mask": "255.255.255.0",
          "gateway": "192.168.1.1",
          "dns": "192.168.1.1"
        },
        {
          "id": "Internet-Cloud",
          "name": "Internet (Public)",
          "type": "internet_public",
          "x": 580,
          "y": 180,
          "ip": "203.0.113.1",
          "mask": "255.255.255.0"
        }
      ],
      "cables": [
        {
          "fromDevice": "PC-Thuis",
          "fromPort": "FastEthernet0",
          "toDevice": "HomeRouter",
          "toPort": "br-lan",
          "type": "copper_straight"
        },
        {
          "fromDevice": "HomeRouter",
          "fromPort": "eth0",
          "toDevice": "Internet-Cloud",
          "toPort": "Internet",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "home_pc_dhcp",
        "category": "interface_ip",
        "title": "DHCP Lease Thuis PC",
        "desc": "PC-Thuis heeft geldig IP in subnet 192.168.1.0/24",
        "type": "ip_subnet",
        "checkType": "ip_subnet",
        "points": 35,
        "enabled": true,
        "condition": {
          "deviceId": "PC-Thuis",
          "subnetPrefix": "192.168.1.",
          "expectedMask": "255.255.255.0"
        }
      },
      {
        "id": "nat_gateway_reach",
        "category": "connectivity",
        "title": "Gateway Bereikbaar",
        "desc": "PC-Thuis kan default gateway 192.168.1.1 pingen",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 35,
        "enabled": true,
        "condition": {
          "fromDevice": "PC-Thuis",
          "targetIp": "192.168.1.1"
        }
      },
      {
        "id": "internet_public_reach",
        "category": "connectivity",
        "title": "Internet Toegang via NAT",
        "desc": "Succesvolle verbinding via NAT naar Internet-Cloud",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 30,
        "enabled": true,
        "condition": {
          "fromDevice": "PC-Thuis",
          "targetIp": "203.0.113.1"
        }
      }
    ]
  },
  {
    "id": "h07_labo_firewall_nat_rules",
    "code": "H07-Labo",
    "chapter": "Hoofdstuk 07 - Beveiliging, Firewalls & NAT",
    "title": "Les 07 Labo: Firewall, NAT Masquerade, Port Forwarding & Filter Rules",
    "timeLimitMinutes": 55,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 07 - Labo: Firewall, NAT, publishing en rules\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les07_Labo.html](https://vwgert.github.io/networksess/Les07_Labo.html)\n\n### Opzet van het labo:\nIn dit labo configureer je een **MikroTik Firewall** met WAN- en LAN-zijde:\n- WAN switch met WAN-laptops (`172.20.40.10/24`)\n- MikroTik ether1 (WAN): `172.20.40.1/24`\n- MikroTik ether2 (LAN): `192.168.123.1/24`\n- LAN-zijde met interne webserver (`192.168.123.80`)\n- NAT Masquerade rule voor uitgaand LAN-verkeer\n- Port Forwarding (dstnat) poort 80 WAN -> 192.168.123.80 (Web publishing)\n",
    "initialTopology": {
      "devices": [
        {
          "id": "WAN-Laptop",
          "name": "WAN-Laptop",
          "type": "laptop",
          "x": 120,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "172.20.40.10",
          "mask": "255.255.255.0",
          "gateway": "172.20.40.1",
          "dns": ""
        },
        {
          "id": "WAN-Switch",
          "name": "WAN-Switch",
          "type": "switch",
          "x": 260,
          "y": 200
        },
        {
          "id": "MikroTik-Firewall",
          "name": "MikroTik-Firewall",
          "type": "mikrotik",
          "x": 420,
          "y": 200,
          "interfaces": {
            "ether1": {
              "ip": "172.20.40.1",
              "mask": "255.255.255.0",
              "shutdown": false
            },
            "ether2": {
              "ip": "192.168.123.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          }
        },
        {
          "id": "LAN-Switch",
          "name": "LAN-Switch",
          "type": "switch",
          "x": 580,
          "y": 200
        },
        {
          "id": "LAN-Webserver",
          "name": "LAN-Webserver",
          "type": "server",
          "x": 720,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "192.168.123.80",
          "mask": "255.255.255.0",
          "gateway": "192.168.123.1",
          "dns": "",
          "services": {
            "http": true
          }
        }
      ],
      "cables": [
        {
          "fromDevice": "WAN-Laptop",
          "fromPort": "FastEthernet0",
          "toDevice": "WAN-Switch",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "WAN-Switch",
          "fromPort": "FastEthernet0/2",
          "toDevice": "MikroTik-Firewall",
          "toPort": "ether1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "MikroTik-Firewall",
          "fromPort": "ether2",
          "toDevice": "LAN-Switch",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "LAN-Switch",
          "fromPort": "FastEthernet0/2",
          "toDevice": "LAN-Webserver",
          "toPort": "FastEthernet0",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "wan_ping_gateway",
        "category": "connectivity",
        "title": "WAN Gateway Bereikbaar",
        "desc": "WAN-Laptop kan MikroTik ether1 (172.20.40.1) pingen",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 35,
        "enabled": true,
        "condition": {
          "fromDevice": "WAN-Laptop",
          "targetIp": "172.20.40.1"
        }
      },
      {
        "id": "lan_webserver_http",
        "category": "services",
        "title": "HTTP Service Webserver",
        "desc": "HTTP service actief op LAN-Webserver",
        "type": "http_get",
        "checkType": "http_get",
        "points": 35,
        "enabled": true,
        "condition": {
          "serverId": "LAN-Webserver"
        }
      },
      {
        "id": "firewall_interfaces_up",
        "category": "interface_ip",
        "title": "Firewall Interfaces UP",
        "desc": "MikroTik ether1 en ether2 correct geconfigureerd",
        "type": "interface_ip",
        "checkType": "interface_ip",
        "points": 30,
        "enabled": true,
        "condition": {
          "deviceId": "MikroTik-Firewall",
          "portName": "ether2",
          "expectedIp": "192.168.123.1",
          "expectedMask": "255.255.255.0"
        }
      }
    ]
  },
  {
    "id": "h08_cisco_ios_basis",
    "code": "H08-Cisco",
    "chapter": "Zelfstudie - Cisco IOS CLI & Beveiliging",
    "title": "Zelfstudie: Cisco IOS Netwerk (PC-SW-R-SW-PC) met SSH",
    "timeLimitMinutes": 60,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Zelfstudie: Cisco IOS Packet Tracer (PC-SW-R-SW-PC)\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Cisco_IOS_PT.html](https://vwgert.github.io/networksess/Cisco_IOS_PT.html)\n\n### Doel van de zelfstudie:\nIn deze oefening configureer je een volledig Cisco netwerk met twee switches en één router:\n- Hostnames instellen (`hostname R1`, `hostname S1`)\n- Beveiliging: `enable secret class`, `line console 0` met `password cisco`\n- Encryptie: `service password-encryption`\n- Banner: `banner motd #Geautoriseerde toegang alleen!#`\n- Interface IP's en `no shutdown`\n- SSH beheer configureren\n- Startup-configuratie opslaan in NVRAM (`copy run start`).\n",
    "initialTopology": {
      "devices": [
        {
          "id": "PC0",
          "name": "PC0",
          "type": "pc",
          "x": 100,
          "y": 260,
          "dhcpEnabled": false,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.1.1",
          "dns": ""
        },
        {
          "id": "S1",
          "name": "S1",
          "type": "switch",
          "x": 240,
          "y": 180,
          "hostname": "Switch"
        },
        {
          "id": "R1",
          "name": "R1",
          "type": "router",
          "x": 420,
          "y": 140,
          "hostname": "Router",
          "interfaces": {
            "GigabitEthernet0/0/0": {
              "ip": "192.168.1.1",
              "mask": "255.255.255.0",
              "shutdown": false
            },
            "GigabitEthernet0/0/1": {
              "ip": "192.168.2.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          }
        },
        {
          "id": "S2",
          "name": "S2",
          "type": "switch",
          "x": 600,
          "y": 180,
          "hostname": "Switch"
        },
        {
          "id": "PC1",
          "name": "PC1",
          "type": "pc",
          "x": 740,
          "y": 260,
          "dhcpEnabled": false,
          "ip": "192.168.2.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.2.1",
          "dns": ""
        }
      ],
      "cables": [
        {
          "fromDevice": "PC0",
          "fromPort": "FastEthernet0",
          "toDevice": "S1",
          "toPort": "FastEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "S1",
          "fromPort": "GigabitEthernet0/1",
          "toDevice": "R1",
          "toPort": "GigabitEthernet0/0/0",
          "type": "copper_straight"
        },
        {
          "fromDevice": "R1",
          "fromPort": "GigabitEthernet0/0/1",
          "toDevice": "S2",
          "toPort": "GigabitEthernet0/1",
          "type": "copper_straight"
        },
        {
          "fromDevice": "S2",
          "fromPort": "FastEthernet0/1",
          "toDevice": "PC1",
          "toPort": "FastEthernet0",
          "type": "copper_straight"
        }
      ]
    },
    "rubric": [
      {
        "id": "r1_hostname",
        "category": "security",
        "title": "R1 Hostname",
        "desc": "Router heeft hostname R1",
        "type": "hostname",
        "checkType": "hostname",
        "points": 25,
        "enabled": true,
        "condition": {
          "targetDevice": "R1",
          "expected": "R1"
        }
      },
      {
        "id": "s1_hostname",
        "category": "security",
        "title": "S1 Hostname",
        "desc": "Switch 1 heeft hostname S1",
        "type": "hostname",
        "checkType": "hostname",
        "points": 25,
        "enabled": true,
        "condition": {
          "targetDevice": "S1",
          "expected": "S1"
        }
      },
      {
        "id": "r1_password_enc",
        "category": "security",
        "title": "Wachtwoordversleuteling",
        "desc": "service password-encryption actief op R1",
        "type": "password_encryption",
        "checkType": "password_encryption",
        "points": 25,
        "enabled": true,
        "condition": {
          "targetDevice": "R1"
        }
      },
      {
        "id": "ping_end_to_end",
        "category": "connectivity",
        "title": "End-to-End Ping",
        "desc": "Succesvolle ping tussen PC0 en PC1",
        "type": "ping_test",
        "checkType": "ping_test",
        "points": 25,
        "enabled": true,
        "condition": {
          "fromDevice": "PC0",
          "targetIp": "192.168.2.10"
        }
      }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PXL_COURSE_LABS: window.PXL_COURSE_LABS };
}
