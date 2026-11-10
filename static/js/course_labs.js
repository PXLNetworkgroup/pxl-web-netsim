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
    "instructions": "## Les 01 Labo: Rechtstreekse verbinding tussen 2 Laptops - APIPA\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les01_Labo.html](https://vwgert.github.io/networksess/Les01_Labo.html)\n\n### Doel van het labo:\nIn dit labo onderzoek je hoe twee laptops (Laptop0 en Laptop1) rechtstreeks met elkaar communiceren zonder tussenkomst van een router of DHCP-server. Je bestudeert het automatisch toekennen van een **APIPA-adres** (169.254.0.0/16) en test de connectiviteit via zowel **Command Prompt** als **PowerShell**.\n\n### Opdrachten:\n1. **Fysieke verbinding:** Sluit een netwerkkabel aan tussen `Laptop0` (FastEthernet0) en `Laptop1` (FastEthernet0).\n2. **DHCP controle:** Beide laptops staan standaard ingesteld op DHCP. Doordat er geen DHCP-server actief is, genereert Windows automatisch een APIPA-adres in het bereik `169.254.x.x` met subnetmasker `255.255.0.0`.\n3. **PowerShell onderzoek:**\n   - Open op `Laptop0` de applicatie **PowerShell**.\n   - Voer het cmdlet `Get-NetIPAddress` of `gip` uit om het toegekende IP-adres en PrefixLength (16) te inspecteren.\n   - Voer `Get-NetIPConfiguration` of `gipconfig` uit om de volledige interface-configuratie te bekijken.\n4. **Connectiviteitstest:**\n   - Ping vanuit PowerShell naar het APIPA-adres van `Laptop1` via:\n     `Test-NetConnection 169.254.1.20` of `tnc 169.254.1.20` (of `ping 169.254.1.20`).\n",
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
        "description": "Rechtstreekse kabelverbinding tussen Laptop0 en Laptop1",
        "type": "cable_connection",
        "dev1": "Laptop0",
        "port1": "FastEthernet0",
        "dev2": "Laptop1",
        "port2": "FastEthernet0",
        "points": 40
      },
      {
        "id": "apipa_subnet_laptop0",
        "description": "Laptop0 heeft een geldig APIPA 169.254.x.x adres met /16 subnetmasker",
        "type": "ip_subnet",
        "device": "Laptop0",
        "network": "169.254.0.0",
        "prefix": 16,
        "points": 30
      },
      {
        "id": "ping_apipa",
        "description": "Succesvolle ICMP connectiviteit (ping/Test-NetConnection) tussen beide laptops",
        "type": "ping_test",
        "from": "Laptop0",
        "to": "169.254.1.20",
        "points": 30
      }
    ]
  },
  {
    "id": "h02_labo1_statisch_ip",
    "code": "H02-Labo1",
    "chapter": "Hoofdstuk 02 - Statische IP-Adresering & Webserver",
    "title": "Les 02 Labo: Statische IP-configuratie (PC ↔ Webserver)",
    "timeLimitMinutes": 50,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 02 Labo: Statische IP-configuratie (PC ↔ Server)\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les02_PT_Statisch_IP.html](https://vwgert.github.io/networksess/Les02_PT_Statisch_IP.html)\n\n### Adreseringstabel:\n| Toestel | Interface | IP-adres | Subnetmasker | Rol |\n| :--- | :--- | :--- | :--- | :--- |\n| **PC0** | FastEthernet0 | `192.168.1.10` | `255.255.255.0` | Client host |\n| **Server0** | FastEthernet0 | `192.168.1.2` | `255.255.255.0` | HTTP Webserver |\n\n### Opdrachten:\n1. Verbind `PC0` rechtstreeks met `Server0` met een straight-through of cross-over netwerkkabel.\n2. Stel op `PC0` het IP-adres in op `192.168.1.10` met subnetmasker `255.255.255.0`.\n   *(Tip: Dit kan via Desktop -> IP Configuration OF via PowerShell met: `Set-NetIPAddress -IPAddress 192.168.1.10 -PrefixLength 24`)*\n3. Stel op `Server0` het IP-adres in op `192.168.1.2` met subnetmasker `255.255.255.0`.\n4. Controleer op `Server0` bij **Services -> HTTP** dat de webserver ingeschakeld (On) is.\n5. Test connectiviteit:\n   - Voer op `PC0` in PowerShell uit: `Test-NetConnection 192.168.1.2 -Port 80`\n   - Open de **Web Browser** op `PC0` en surf naar `http://192.168.1.2` of voer in PowerShell uit: `Invoke-WebRequest http://192.168.1.2`\n",
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
          "mask": ""
        },
        {
          "id": "Server0",
          "name": "Server0",
          "type": "server",
          "x": 520,
          "y": 200,
          "dhcpEnabled": false,
          "ip": "192.168.1.2",
          "mask": "255.255.255.0",
          "services": {
            "http": {
              "enabled": true,
              "content": "<h1>PXL Web Server</h1><p>Welkom op het statisch IP labo!</p>"
            }
          }
        }
      ],
      "cables": []
    },
    "rubric": [
      {
        "id": "cable_connected",
        "description": "Kabelverbinding aanwezig tussen PC0 en Server0",
        "type": "cable_connection",
        "dev1": "PC0",
        "port1": "FastEthernet0",
        "dev2": "Server0",
        "port2": "FastEthernet0",
        "points": 25
      },
      {
        "id": "pc0_ip",
        "description": "PC0 correct geconfigureerd met IP 192.168.1.10 en masker 255.255.255.0",
        "type": "ip_config",
        "device": "PC0",
        "ip": "192.168.1.10",
        "mask": "255.255.255.0",
        "points": 25
      },
      {
        "id": "server0_ip",
        "description": "Server0 correct geconfigureerd met IP 192.168.1.2 en masker 255.255.255.0",
        "type": "ip_config",
        "device": "Server0",
        "ip": "192.168.1.2",
        "mask": "255.255.255.0",
        "points": 20
      },
      {
        "id": "ping_test",
        "description": "Succesvolle ping tussen PC0 en Server0",
        "type": "ping_test",
        "from": "PC0",
        "to": "192.168.1.2",
        "points": 15
      },
      {
        "id": "http_test",
        "description": "Webserver bereikbaar via HTTP op 192.168.1.2",
        "type": "http_web_test",
        "from": "PC0",
        "target": "192.168.1.2",
        "points": 15
      }
    ]
  },
  {
    "id": "h03_pt1_mac_switch",
    "code": "H03-PT1",
    "chapter": "Hoofdstuk 03 - Switches, ARP & MAC-Adrestabel",
    "title": "Les 03 PT: Switch, ARP, ICMP en MAC-Address-Table",
    "timeLimitMinutes": 60,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 03 PT: Switch, ARP, ICMP en MAC-Address-Table\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les03_PT_ARP_MAC_ADDR_TAB.html](https://vwgert.github.io/networksess/Les03_PT_ARP_MAC_ADDR_TAB.html)\n\n### Adreseringstabel:\n| Toestel | Switchpoort | MAC-adres | IP-adres |\n| :--- | :--- | :--- | :--- |\n| **Laptop0** | Fa0/10 | `10AA.AAAA.AAAA` | `192.168.1.10/24` |\n| **Laptop1** | Fa0/20 | `20BB.BBBB.BBBB` | `192.168.1.20/24` |\n| **Laptop2** | Fa0/5  | `30CC.CCCC.CCCC` | `192.168.1.30/24` |\n| **Switch0** | -      | -                | `192.168.1.2/24` (Vlan1 mgmt) |\n\n### Opdrachten:\n1. Sluit de 3 laptops aan op de aangegeven switchpoorten van `Switch0` (Cisco 2960).\n2. Configureer op alle laptops het juiste statische IP-adres en subnetmasker.\n3. Ga naar de CLI van `Switch0` en bekijk de initiële MAC-adrestabel met `show mac address-table`.\n4. Voer een ping uit van `Laptop0` naar `Laptop1` (`192.168.1.20`).\n5. Controleer hoe de switch dynamisch de MAC-adressen leert op poorten `Fa0/10` en `Fa0/20`.\n6. Bekijk op de laptop de geleerde ARP-tabel in PowerShell via `Get-NetNeighbor` of `arp -a`.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "Switch0",
          "name": "Switch0",
          "type": "switch",
          "model": "2960-24TT",
          "x": 380,
          "y": 240
        },
        {
          "id": "Laptop0",
          "name": "Laptop0",
          "type": "laptop",
          "x": 160,
          "y": 100,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0"
        },
        {
          "id": "Laptop1",
          "name": "Laptop1",
          "type": "laptop",
          "x": 600,
          "y": 100,
          "ip": "192.168.1.20",
          "mask": "255.255.255.0"
        },
        {
          "id": "Laptop2",
          "name": "Laptop2",
          "type": "laptop",
          "x": 380,
          "y": 380,
          "ip": "192.168.1.30",
          "mask": "255.255.255.0"
        }
      ],
      "cables": []
    },
    "rubric": [
      {
        "id": "cables_switch",
        "description": "Alle 3 laptops bekabeld naar de switch",
        "type": "cable_count",
        "minCables": 3,
        "points": 30
      },
      {
        "id": "ip_all_laptops",
        "description": "Alle laptops voorzien van correct IP in 192.168.1.0/24",
        "type": "ip_subnet",
        "device": "Laptop0",
        "network": "192.168.1.0",
        "prefix": 24,
        "points": 30
      },
      {
        "id": "ping_l0_to_l1",
        "description": "Succesvolle ping tussen Laptop0 en Laptop1",
        "type": "ping_test",
        "from": "Laptop0",
        "to": "192.168.1.20",
        "points": 20
      },
      {
        "id": "ping_l0_to_l2",
        "description": "Succesvolle ping tussen Laptop0 en Laptop2",
        "type": "ping_test",
        "from": "Laptop0",
        "to": "192.168.1.30",
        "points": 20
      }
    ]
  },
  {
    "id": "h04_pt1_dns_http",
    "code": "H04-PT1",
    "chapter": "Hoofdstuk 04 - DNS, DHCP & Web Services",
    "title": "Les 04 PT: DHCP, DNS en HTTP Webserver in Simulation Mode",
    "timeLimitMinutes": 75,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 04 PT: DHCP + DNS + HTTP\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les04_PT_DNS.html](https://vwgert.github.io/networksess/Les04_PT_DNS.html)\n\n### Adresering & Server Rollen:\n| Server | IP-adres | Actieve Dienst | Details |\n| :--- | :--- | :--- | :--- |\n| **DHCP-Server** | `192.168.1.150` | DHCP Server | Pool: `192.168.1.10` - `.50`, DNS: `192.168.1.100` |\n| **DNS-Server**  | `192.168.1.100` | DNS Service | Record: `www.pxl.be` -> `192.168.1.200` |\n| **WEB-Server**  | `192.168.1.200` | HTTP Service | Bevat `index.html` en `style.css` |\n\n### Opdrachten:\n1. Sluit de servers en clients (PC0, Laptop0) aan op `Switch0`.\n2. Configureer op `DNS-Server` een DNS A-record voor `www.pxl.be` wijzend naar `192.168.1.200`.\n3. Stel op `PC0` en `Laptop0` de netwerkadapter in met DNS Server: `192.168.1.100`.\n4. Test DNS-resolutie vanuit PowerShell:\n   - `Resolve-DnsName www.pxl.be`\n   - `nslookup www.pxl.be`\n5. Surf in de Web Browser van PC0 naar `http://www.pxl.be` of voer uit: `Invoke-WebRequest http://www.pxl.be`.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "Switch0",
          "name": "Switch0",
          "type": "switch",
          "model": "2960-24TT",
          "x": 380,
          "y": 240
        },
        {
          "id": "DNS-Server",
          "name": "DNS-Server",
          "type": "server",
          "x": 160,
          "y": 80,
          "ip": "192.168.1.100",
          "mask": "255.255.255.0",
          "services": {
            "dns": {
              "enabled": true,
              "records": [
                {
                  "name": "www.pxl.be",
                  "type": "A",
                  "ip": "192.168.1.200"
                }
              ]
            }
          }
        },
        {
          "id": "WEB-Server",
          "name": "WEB-Server",
          "type": "server",
          "x": 600,
          "y": 80,
          "ip": "192.168.1.200",
          "mask": "255.255.255.0",
          "services": {
            "http": {
              "enabled": true,
              "content": "<h1>Hogeschool PXL</h1><p>Welkom op www.pxl.be via de lokale DNS-server!</p>"
            }
          }
        },
        {
          "id": "PC0",
          "name": "PC0",
          "type": "pc",
          "x": 180,
          "y": 380,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "dns": "192.168.1.100"
        },
        {
          "id": "Laptop0",
          "name": "Laptop0",
          "type": "laptop",
          "x": 580,
          "y": 380,
          "ip": "192.168.1.20",
          "mask": "255.255.255.0",
          "dns": "192.168.1.100"
        }
      ],
      "cables": [
        {
          "fromDevice": "DNS-Server",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/1"
        },
        {
          "fromDevice": "WEB-Server",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/2"
        },
        {
          "fromDevice": "PC0",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/3"
        },
        {
          "fromDevice": "Laptop0",
          "fromPort": "FastEthernet0",
          "toDevice": "Switch0",
          "toPort": "FastEthernet0/4"
        }
      ]
    },
    "rubric": [
      {
        "id": "dns_record",
        "description": "DNS A-record www.pxl.be -> 192.168.1.200 aanwezig op DNS-Server",
        "type": "dns_record",
        "device": "DNS-Server",
        "recordName": "www.pxl.be",
        "targetIp": "192.168.1.200",
        "points": 35
      },
      {
        "id": "dns_resolv",
        "description": "Succesvolle DNS resolutie van www.pxl.be vanaf PC0",
        "type": "dns_resolution",
        "from": "PC0",
        "query": "www.pxl.be",
        "expectedIp": "192.168.1.200",
        "points": 35
      },
      {
        "id": "web_access",
        "description": "Succesvol surfen naar http://www.pxl.be vanaf PC0",
        "type": "http_web_test",
        "from": "PC0",
        "target": "www.pxl.be",
        "points": 30
      }
    ]
  },
  {
    "id": "h05_labo1_mikrotik",
    "code": "H05-Labo1",
    "chapter": "Hoofdstuk 05 - Routering & MikroTik RouterOS",
    "title": "Les 05 Labo 1: MikroTik hEX lite als Router (4 Netwerken)",
    "timeLimitMinutes": 80,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 05: Labo 1 MikroTik hEX lite als router: 4 afzonderlijke netwerken\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les05_Labo1.html](https://vwgert.github.io/networksess/Les05_Labo1.html)\n\n### Netwerktopologie:\nDe **MikroTik hEX lite** verbindt 4 afzonderlijke netwerken op interfaces `ether2`, `ether3`, `ether4` en `ether5`.\n\n| Interface | Subnet | Router IP | Host IP Bereik |\n| :--- | :--- | :--- | :--- |\n| **ether2** | `192.168.10.0/24` | `192.168.10.1` | `192.168.10.10 - .50` |\n| **ether3** | `192.168.20.0/24` | `192.168.20.1` | `192.168.20.10 - .50` |\n| **ether4** | `192.168.30.0/24` | `192.168.30.1` | `192.168.30.10 - .50` |\n| **ether5** | `192.168.40.0/24` | `192.168.40.1` | `192.168.40.10 - .50` |\n\n### Opdrachten:\n1. Open de CLI van de MikroTik (`MikroTik1`).\n2. Verwijder eventuele bridges of standaard IPs en stel de IP-adressen in:\n   ```routeros\n   /ip address add address=192.168.10.1/24 interface=ether2\n   /ip address add address=192.168.20.1/24 interface=ether3\n   /ip address add address=192.168.30.1/24 interface=ether4\n   /ip address add address=192.168.40.1/24 interface=ether5\n   ```\n3. Verbind `PC1` met `ether2` (`192.168.10.10`, gateway `192.168.10.1`).\n4. Verbind `PC2` met `ether3` (`192.168.20.10`, gateway `192.168.20.1`).\n5. Test connectiviteit: ping vanuit `PC1` naar `PC2` (`192.168.20.10`).\n",
    "initialTopology": {
      "devices": [
        {
          "id": "MikroTik1",
          "name": "MikroTik1",
          "type": "mikrotik",
          "model": "hEX lite (RB750r2)",
          "x": 380,
          "y": 200
        },
        {
          "id": "PC1",
          "name": "PC1",
          "type": "pc",
          "x": 160,
          "y": 140,
          "ip": "192.168.10.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.10.1"
        },
        {
          "id": "PC2",
          "name": "PC2",
          "type": "pc",
          "x": 600,
          "y": 140,
          "ip": "192.168.20.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.20.1"
        }
      ],
      "cables": [
        {
          "fromDevice": "PC1",
          "fromPort": "FastEthernet0",
          "toDevice": "MikroTik1",
          "toPort": "ether2"
        },
        {
          "fromDevice": "PC2",
          "fromPort": "FastEthernet0",
          "toDevice": "MikroTik1",
          "toPort": "ether3"
        }
      ]
    },
    "rubric": [
      {
        "id": "mt_ether2",
        "description": "MikroTik ether2 geconfigureerd met 192.168.10.1/24",
        "type": "mikrotik_interface_ip",
        "device": "MikroTik1",
        "interface": "ether2",
        "ip": "192.168.10.1",
        "prefix": 24,
        "points": 35
      },
      {
        "id": "mt_ether3",
        "description": "MikroTik ether3 geconfigureerd met 192.168.20.1/24",
        "type": "mikrotik_interface_ip",
        "device": "MikroTik1",
        "interface": "ether3",
        "ip": "192.168.20.1",
        "prefix": 24,
        "points": 35
      },
      {
        "id": "ping_routed",
        "description": "Succesvol gerouteerde ping van PC1 naar PC2 door de MikroTik",
        "type": "ping_test",
        "from": "PC1",
        "to": "192.168.20.10",
        "points": 30
      }
    ]
  },
  {
    "id": "h05_pt1_cisco_1router",
    "code": "H05-PT1",
    "chapter": "Hoofdstuk 05 - Routering & Cisco IOS",
    "title": "Les 05 PT: Twee LANs via Eén Cisco Router (Subnets & Routing)",
    "timeLimitMinutes": 60,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 05 PT: 2 LAN's via 1 router\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les05_PT_1router.html](https://vwgert.github.io/networksess/Les05_PT_1router.html)\n\n### Adreseringstabel:\n| Toestel | Interface | IP-adres | Subnetmasker | Default Gateway |\n| :--- | :--- | :--- | :--- | :--- |\n| **R1** | GigabitEthernet0/0/0 | `192.168.1.1` | `255.255.255.0` | - |\n| **R1** | GigabitEthernet0/0/1 | `10.0.1.1`    | `255.255.255.0` | - |\n| **Laptop0** | FastEthernet0 | `192.168.1.10` | `255.255.255.0` | `192.168.1.1` |\n| **PC0**     | FastEthernet0 | `10.0.1.100`   | `255.255.255.0` | `10.0.1.1` |\n\n### Opdrachten:\n1. Configureer `R1` (Cisco 4331):\n   ```cisco\n   enable\n   configure terminal\n   hostname R1\n   interface GigabitEthernet0/0/0\n    ip address 192.168.1.1 255.255.255.0\n    no shutdown\n   interface GigabitEthernet0/0/1\n    ip address 10.0.1.1 255.255.255.0\n    no shutdown\n   exit\n   ```\n2. Test inter-LAN routering met ping van `Laptop0` naar `PC0` (`10.0.1.100`).\n",
    "initialTopology": {
      "devices": [
        {
          "id": "R1",
          "name": "R1",
          "type": "router",
          "model": "4331",
          "x": 380,
          "y": 200
        },
        {
          "id": "SW-Left",
          "name": "SW-Left",
          "type": "switch",
          "model": "2960-24TT",
          "x": 200,
          "y": 200
        },
        {
          "id": "SW-Right",
          "name": "SW-Right",
          "type": "switch",
          "model": "2960-24TT",
          "x": 560,
          "y": 200
        },
        {
          "id": "Laptop0",
          "name": "Laptop0",
          "type": "laptop",
          "x": 100,
          "y": 200,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.1.1"
        },
        {
          "id": "PC0",
          "name": "PC0",
          "type": "pc",
          "x": 660,
          "y": 200,
          "ip": "10.0.1.100",
          "mask": "255.255.255.0",
          "gateway": "10.0.1.1"
        }
      ],
      "cables": [
        {
          "fromDevice": "Laptop0",
          "fromPort": "FastEthernet0",
          "toDevice": "SW-Left",
          "toPort": "FastEthernet0/1"
        },
        {
          "fromDevice": "SW-Left",
          "fromPort": "GigabitEthernet0/1",
          "toDevice": "R1",
          "toPort": "GigabitEthernet0/0/0"
        },
        {
          "fromDevice": "R1",
          "fromPort": "GigabitEthernet0/0/1",
          "toDevice": "SW-Right",
          "toPort": "GigabitEthernet0/1"
        },
        {
          "fromDevice": "SW-Right",
          "fromPort": "FastEthernet0/1",
          "toDevice": "PC0",
          "toPort": "FastEthernet0"
        }
      ]
    },
    "rubric": [
      {
        "id": "r1_g0",
        "description": "R1 interface G0/0/0 geconfigureerd met 192.168.1.1/24 (no shutdown)",
        "type": "interface_ip",
        "device": "R1",
        "interface": "GigabitEthernet0/0/0",
        "ip": "192.168.1.1",
        "mask": "255.255.255.0",
        "points": 35
      },
      {
        "id": "r1_g1",
        "description": "R1 interface G0/0/1 geconfigureerd met 10.0.1.1/24 (no shutdown)",
        "type": "interface_ip",
        "device": "R1",
        "interface": "GigabitEthernet0/0/1",
        "ip": "10.0.1.1",
        "mask": "255.255.255.0",
        "points": 35
      },
      {
        "id": "ping_routed",
        "description": "Succesvol gerouteerde ICMP ping van Laptop0 naar PC0",
        "type": "ping_test",
        "from": "Laptop0",
        "to": "10.0.1.100",
        "points": 30
      }
    ]
  },
  {
    "id": "h05_pt2_cisco_2routers",
    "code": "H05-PT2",
    "chapter": "Hoofdstuk 05 - Static Routing & Multi-Router Netwerken",
    "title": "Les 05 PT: Twee LANs via Twee Cisco Routers (Static Routing)",
    "timeLimitMinutes": 75,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Les 05 PT: 2 netwerken via 2 routers (Static Routing)\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les05_PT_2routers.html](https://vwgert.github.io/networksess/Les05_PT_2routers.html)\n\n### Adreseringstabel:\n| Toestel | Interface | IP-adres | Subnetmasker |\n| :--- | :--- | :--- | :--- |\n| **R1** | GigabitEthernet0/0/0 (LAN) | `192.168.1.1` | `255.255.255.0` |\n| **R1** | GigabitEthernet0/0/1 (WAN) | `10.0.0.1`    | `255.255.255.252` |\n| **R2** | GigabitEthernet0/0/1 (WAN) | `10.0.0.2`    | `255.255.255.252` |\n| **R2** | GigabitEthernet0/0/0 (LAN) | `172.16.1.1`   | `255.255.255.0` |\n\n### Static Route Opdrachten:\n1. Configureer op `R1` een static route naar het LAN van R2:\n   `ip route 172.16.1.0 255.255.255.0 10.0.0.2`\n2. Configureer op `R2` een static route naar het LAN van R1:\n   `ip route 192.168.1.0 255.255.255.0 10.0.0.1`\n3. Test end-to-end connectiviteit tussen `Laptop0` (`192.168.1.10`) en `PC0` (`172.16.1.100`).\n",
    "initialTopology": {
      "devices": [
        {
          "id": "R1",
          "name": "R1",
          "type": "router",
          "model": "4331",
          "x": 280,
          "y": 200,
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
          }
        },
        {
          "id": "R2",
          "name": "R2",
          "type": "router",
          "model": "4331",
          "x": 480,
          "y": 200,
          "interfaces": {
            "GigabitEthernet0/0/1": {
              "ip": "10.0.0.2",
              "mask": "255.255.255.252",
              "shutdown": false
            },
            "GigabitEthernet0/0/0": {
              "ip": "172.16.1.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          }
        },
        {
          "id": "Laptop0",
          "name": "Laptop0",
          "type": "laptop",
          "x": 100,
          "y": 200,
          "ip": "192.168.1.10",
          "mask": "255.255.255.0",
          "gateway": "192.168.1.1"
        },
        {
          "id": "PC0",
          "name": "PC0",
          "type": "pc",
          "x": 660,
          "y": 200,
          "ip": "172.16.1.100",
          "mask": "255.255.255.0",
          "gateway": "172.16.1.1"
        }
      ],
      "cables": [
        {
          "fromDevice": "Laptop0",
          "fromPort": "FastEthernet0",
          "toDevice": "R1",
          "toPort": "GigabitEthernet0/0/0"
        },
        {
          "fromDevice": "R1",
          "fromPort": "GigabitEthernet0/0/1",
          "toDevice": "R2",
          "toPort": "GigabitEthernet0/0/1"
        },
        {
          "fromDevice": "R2",
          "fromPort": "GigabitEthernet0/0/0",
          "toDevice": "PC0",
          "toPort": "FastEthernet0"
        }
      ]
    },
    "rubric": [
      {
        "id": "r1_static_route",
        "description": "R1 heeft static route naar 172.16.1.0/24 via 10.0.0.2",
        "type": "static_route",
        "device": "R1",
        "network": "172.16.1.0",
        "mask": "255.255.255.0",
        "nextHop": "10.0.0.2",
        "points": 35
      },
      {
        "id": "r2_static_route",
        "description": "R2 heeft static route naar 192.168.1.0/24 via 10.0.0.1",
        "type": "static_route",
        "device": "R2",
        "network": "192.168.1.0",
        "mask": "255.255.255.0",
        "nextHop": "10.0.0.1",
        "points": 35
      },
      {
        "id": "ping_end_to_end",
        "description": "Succesvolle end-to-end ICMP ping tussen Laptop0 en PC0",
        "type": "ping_test",
        "from": "Laptop0",
        "to": "172.16.1.100",
        "points": 30
      }
    ]
  },
  {
    "id": "h06_pt1_thuisrouter_nat",
    "code": "H06-PT1",
    "chapter": "Hoofdstuk 06 - Thuisrouter, NAT, DHCP, WiFi & Internet",
    "title": "Les 06 PT: Thuisrouter, NAT, DHCP, DNS, WiFi en Port Forwarding",
    "timeLimitMinutes": 90,
    "showLiveScore": true,
    "liveInternet": true,
    "instructions": "## Les 06 PT: Thuisrouter, NAT, DHCP, DNS, WIFI en port forwarding\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Les06_PT_Thuisrouter.html](https://vwgert.github.io/networksess/Les06_PT_Thuisrouter.html)\n\n### Topologie Overzicht:\n- **LAN-zijde (172.30.0.0/24):** Laptops & PC's krijgen automatisch IP via DHCP van de router (`172.30.0.100+`).\n- **Thuisrouter (OpenWrt / MikroTik):** Verzorgt NAT Masquerade (PAT), DHCP-server en Wireless AP.\n- **WAN-zijde:** Verbonden met **Internet (Public)** of **Het Internet** (ingesteld op WAN IP `45.117.136.17/24`).\n\n### Opdrachten:\n1. Sluit de WAN-poort van de router aan op `InternetPublic` of `Het Internet`.\n2. Controleer dat NAT-translatie actief is zodat interne clients (`172.30.0.x`) naar het internet kunnen surfen en pingen.\n3. Open in `PC0` de **Web Browser** en surf naar `http://www.pxl.be` of `https://icanhazip.com`.\n4. Controleer via PowerShell: `Test-NetConnection 8.8.8.8` en `tnc 8.8.8.8 -Port 53`.\n",
    "initialTopology": {
      "devices": [
        {
          "id": "HomeRouter",
          "name": "HomeRouter",
          "type": "openwrt",
          "model": "OpenWrt 23.05",
          "x": 380,
          "y": 200,
          "interfaces": {
            "eth0": {
              "ip": "45.117.136.17",
              "mask": "255.255.255.0",
              "shutdown": false
            },
            "eth1": {
              "ip": "172.30.0.1",
              "mask": "255.255.255.0",
              "shutdown": false
            }
          }
        },
        {
          "id": "InternetPublic",
          "name": "InternetPublic",
          "type": "internet_public",
          "model": "PXL Internet (Public NAT)",
          "x": 620,
          "y": 200
        },
        {
          "id": "PC0",
          "name": "PC0",
          "type": "pc",
          "x": 160,
          "y": 140,
          "ip": "172.30.0.10",
          "mask": "255.255.255.0",
          "gateway": "172.30.0.1",
          "dns": "8.8.8.8"
        },
        {
          "id": "Laptop0",
          "name": "Laptop0",
          "type": "laptop",
          "x": 160,
          "y": 280,
          "ip": "172.30.0.20",
          "mask": "255.255.255.0",
          "gateway": "172.30.0.1",
          "dns": "8.8.8.8"
        }
      ],
      "cables": [
        {
          "fromDevice": "HomeRouter",
          "fromPort": "eth0",
          "toDevice": "InternetPublic",
          "toPort": "WAN"
        },
        {
          "fromDevice": "PC0",
          "fromPort": "FastEthernet0",
          "toDevice": "HomeRouter",
          "toPort": "eth1"
        },
        {
          "fromDevice": "Laptop0",
          "fromPort": "FastEthernet0",
          "toDevice": "HomeRouter",
          "toPort": "eth2"
        }
      ]
    },
    "rubric": [
      {
        "id": "wan_connected",
        "description": "Home Router WAN-poort correct verbonden met Internet Gateway",
        "type": "cable_connection",
        "dev1": "HomeRouter",
        "port1": "eth0",
        "dev2": "InternetPublic",
        "port2": "WAN",
        "points": 30
      },
      {
        "id": "pc_default_gw",
        "description": "PC0 heeft default gateway 172.30.0.1 geconfigureerd",
        "type": "gateway_config",
        "device": "PC0",
        "gateway": "172.30.0.1",
        "points": 35
      },
      {
        "id": "internet_ping",
        "description": "PC0 heeft internetverbinding via NAT (ping naar 8.8.8.8 succesvol)",
        "type": "ping_test",
        "from": "PC0",
        "to": "8.8.8.8",
        "points": 35
      }
    ]
  },
  {
    "id": "h08_cisco_ios_basis",
    "code": "H08-Cisco",
    "chapter": "Hoofdstuk 08 - Cisco IOS CLI & Beveiliging",
    "title": "Zelfstudie: Cisco IOS Netwerk (PC-SW-R-SW-PC) met SSH & Beveiliging",
    "timeLimitMinutes": 90,
    "showLiveScore": true,
    "liveInternet": false,
    "instructions": "## Zelfstudie: Cisco IOS Packet Tracer (PC-SW-R-SW-PC)\n**Cursus:** PXL Network Essentials (Gert Van Waeyenberg) • [vwgert.github.io/networksess/Cisco_IOS_PT.html](https://vwgert.github.io/networksess/Cisco_IOS_PT.html)\n\n### Adreseringstabel:\n| Toestel | Interface | IP-adres | Subnetmasker | Default Gateway |\n| :--- | :--- | :--- | :--- | :--- |\n| **PC-L** | NIC | `192.168.1.100` | `255.255.255.0` | `192.168.1.1` |\n| **SW-L** | VLAN 1 (mgmt) | `192.168.1.2` | `255.255.255.0` | `192.168.1.1` |\n| **R1**   | G0/0/0 | `192.168.1.1` | `255.255.255.0` | - |\n| **R1**   | G0/0/1 | `192.168.2.1` | `255.255.255.0` | - |\n| **SW-R** | VLAN 1 (mgmt) | `192.168.2.2` | `255.255.255.0` | `192.168.2.1` |\n| **PC-R** | NIC | `192.168.2.100` | `255.255.255.0` | `192.168.2.1` |\n\n### Cisco IOS Beveiligingsvereisten:\n- Hostname: `R1`\n- Secret: `enable secret class`\n- Console wachtwoord: `password cisco`, `login`\n- Banner: `banner motd #Geautoriseerde toegang alleen!#`\n- SSH: `ip domain-name pxl.be`, `crypto key generate rsa`, `username admin secret cisco123`, `transport input ssh`\n",
    "initialTopology": {
      "devices": [
        {
          "id": "R1",
          "name": "R1",
          "type": "router",
          "model": "4331",
          "x": 380,
          "y": 200
        },
        {
          "id": "SW-L",
          "name": "SW-L",
          "type": "switch",
          "model": "2960-24TT",
          "x": 200,
          "y": 200
        },
        {
          "id": "SW-R",
          "name": "SW-R",
          "type": "switch",
          "model": "2960-24TT",
          "x": 560,
          "y": 200
        },
        {
          "id": "PC-L",
          "name": "PC-L",
          "type": "pc",
          "x": 80,
          "y": 200,
          "ip": "192.168.1.100",
          "mask": "255.255.255.0",
          "gateway": "192.168.1.1"
        },
        {
          "id": "PC-R",
          "name": "PC-R",
          "type": "pc",
          "x": 680,
          "y": 200,
          "ip": "192.168.2.100",
          "mask": "255.255.255.0",
          "gateway": "192.168.2.1"
        }
      ],
      "cables": [
        {
          "fromDevice": "PC-L",
          "fromPort": "FastEthernet0",
          "toDevice": "SW-L",
          "toPort": "FastEthernet0/1"
        },
        {
          "fromDevice": "SW-L",
          "fromPort": "GigabitEthernet0/1",
          "toDevice": "R1",
          "toPort": "GigabitEthernet0/0/0"
        },
        {
          "fromDevice": "R1",
          "fromPort": "GigabitEthernet0/0/1",
          "toDevice": "SW-R",
          "toPort": "GigabitEthernet0/1"
        },
        {
          "fromDevice": "SW-R",
          "fromPort": "FastEthernet0/1",
          "toDevice": "PC-R",
          "toPort": "FastEthernet0"
        }
      ]
    },
    "rubric": [
      {
        "id": "r1_hostname",
        "description": "R1 hostname ingesteld",
        "type": "cisco_command",
        "device": "R1",
        "command": "hostname R1",
        "points": 15
      },
      {
        "id": "r1_secret",
        "description": "R1 enable secret beveiligd",
        "type": "cisco_command",
        "device": "R1",
        "command": "enable secret class",
        "points": 15
      },
      {
        "id": "r1_g0",
        "description": "R1 interface G0/0/0 ingesteld op 192.168.1.1/24",
        "type": "interface_ip",
        "device": "R1",
        "interface": "GigabitEthernet0/0/0",
        "ip": "192.168.1.1",
        "mask": "255.255.255.0",
        "points": 20
      },
      {
        "id": "r1_g1",
        "description": "R1 interface G0/0/1 ingesteld op 192.168.2.1/24",
        "type": "interface_ip",
        "device": "R1",
        "interface": "GigabitEthernet0/0/1",
        "ip": "192.168.2.1",
        "mask": "255.255.255.0",
        "points": 20
      },
      {
        "id": "r1_banner",
        "description": "R1 banner motd ingesteld",
        "type": "cisco_command",
        "device": "R1",
        "command": "banner motd",
        "points": 15
      },
      {
        "id": "ping_routed",
        "description": "Succesvolle ping tussen PC-L en PC-R",
        "type": "ping_test",
        "from": "PC-L",
        "to": "192.168.2.100",
        "points": 15
      }
    ]
  }
];
