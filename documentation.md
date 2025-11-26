# Development Documentation: Distributed Cloud-Native Network Intrusion Detection System (NIDS)

## Project Objective

The goal was to engineer a distributed security system capable of monitoring a local home network for cyber threats and visualizing them on a centralized cloud dashboard. The project evolved from a simple network scanner into a complex Hybrid Cloud NIDS using a "Honeypot" architecture to detect SQL Injection, XSS, Brute Force, and DDoS attacks in real-time.

---

## Phase I: Cloud Infrastructure & Dashboard Setup

### The Setup

- **Infrastructure**: Created a Virtual Cloud Network (VCN) on Oracle Cloud Infrastructure (OCI) using the wizard
- **Compute**: Provisioned an Ubuntu VM inside the VCN
- **Network Security**: Configured the Oracle Cloud "Security List" to allow Ingress traffic on TCP Port 3000
- **Application**: Deployed a Node.js HTTP server binding to `0.0.0.0:3000`

### The Problem (Connectivity Failure)

While the server responded correctly to `curl localhost:3000` inside the VM, it was unreachable from the public internet (connection timed out).

### The Diagnosis

I suspected the VM's internal operating system firewall was blocking traffic that the Oracle Cloud network had already permitted. I validated this by running a "Nuclear Flush":

```bash
sudo iptables -P INPUT ACCEPT
sudo iptables -F
```

**Result**: Connectivity was immediately restored. This confirmed iptables was the blocker.

### The Solution (Secure Firewall Rebuild)

Leaving the firewall off is insecure. I implemented a robust iptables configuration to explicitly allow necessary services while dropping everything else:

```bash
# 1. Allow established traffic (keep SSH alive)
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 2. Allow Loopback (localhost processes)
sudo iptables -A INPUT -i lo -j ACCEPT

# 3. Allow SSH (Port 22)
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 4. Allow Node.js Server (Port 3000)
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT

# 5. Drop all other traffic
sudo iptables -A INPUT -j DROP

# 6. Persist rules across reboots
sudo netfilter-persistent save
```

---

## Phase II: Network Scanning (Discovery)

### The Setup

I attempted to build a script on my local Windows laptop to scan the Wi-Fi network and upload the device list to the Cloud VM.

### Iteration 1: The Virtual Adapter Conflict

**Issue**: The scanner reported "0 Devices Found" or only found the host machine.

**Root Cause**: The script automatically detected the first available network interface, which happened to be a VirtualBox Host-Only Adapter (`192.168.56.1`) instead of the actual Wi-Fi card.

**Fix**: Hardcoded the subnet range to the physical router's subnet:

```javascript
const SUBNET_RANGE = '192.168.1.0/24'; // Forced physical subnet
```

### Iteration 2: Windows ARP Limitations

**Issue**: The scanner found IPs but listed all device names as "Unknown."

**Root Cause**: Unlike Linux/Mac `arp -n`, the Windows `arp -a` command does not resolve hostnames, and standard DNS lookups fail for local devices on public DNS (8.8.8.8).

**Fix**: Implemented a hybrid lookup strategy:

1. Parsed the Windows ARP table for MAC addresses
2. Used `ping -a <IP>` to force Windows to resolve NetBIOS names
3. Scraped Port 80 HTML `<title>` tags to identify devices like printers and routers

---

## Phase III: The Intrusion Detection System (Passive Sniffing)

### The Objective

Pivot from scanning the network to protecting the laptop by sniffing traffic for attacks.

### Iteration 1: Raw Socket Sniffing (Npcap)

**Approach**: Used `cap` (node-cap) and Npcap driver to sniff raw packets off the Wi-Fi card.

**Issue**: The script failed to open the device `\Device\NPF_{...}`.

**Root Cause**: I had not installed Npcap in "WinPcap API-compatible Mode," so Node.js couldn't talk to the driver.

**Fix**: Reinstalled Npcap with legacy compatibility enabled.

### Iteration 2: Loopback Optimization

**Issue**: I ran the attacker script on the same laptop as the defender. Windows performed "Loopback Optimization," routing traffic internally without sending it to the network card. The sniffer saw nothing.

**Fix**: Attempted to bind to the Loopback adapter, but this proved unreliable for real-world simulation.

### Iteration 3: The Ghost Packets

**Issue**: Moved the attacker to a second laptop. Packets were sent, but the defender script (listening on TCP port 80) saw nothing.

**Root Cause**: Windows Firewall. Since no application was actually listening on Port 80, the OS kernel dropped the packets before passing them to the user-space sniffer.

**Fix**: Created a `dummy-server.js` to bind the port and force a Windows Firewall popup to "Allow Access."

---

## Phase IV: The Final Solution (Active Honeypot Architecture)

### The Pivot

Passive sniffing on Windows proved too fragile due to driver/OS filtering. I shifted to an **Active Honeypot architecture**. Instead of silently watching, the laptop would explicitly open ports to trap attackers.

### The Architecture

**Defender (Home Laptop)**: Runs `defender.js`:
- Opens Port 80 (HTTP) to catch SQL Injection & XSS
- Opens Port 21 (FTP) to catch Port Scanners
- Opens Port 2222 (SSH) to catch Brute Force attempts
- Opens Port 9999 (UDP) to catch DDoS floods

**Attacker (Second Device)**: Runs `attacker.js` targeting the Defender's IP (configurable via `config.json`)

**Cloud Aggregator (Oracle VM)**: Receives alerts via HTTP POST and displays them on a live dashboard

### Final Workflow

1. Attacker sends a malicious payload: `GET /login?user=admin' UNION SELECT...`
2. Defender's Port 80 trap accepts the connection
3. Regex Engine analyzes the payload and detects the `UNION SELECT` signature
4. Telemetry Client uploads the alert (SQL INJECTION DETECTED) to the Oracle Cloud VM
5. User views the attack in real-time on the Cloud Dashboard via their phone

### Why This Is the Correct Solution

- **Reliability**: Uses standard TCP/UDP sockets, bypassing Npcap driver instability
- **Visibility**: Guarantees detection because the OS hands the data directly to the application
- **Scalability**: Can easily be expanded to alert via Discord, Slack, or SMS

---

## Phase V: Deep Packet Inspection (The "Brain")

### The Objective

The previous "Honeypot" iteration only detected if a port was accessed. It generated false positives (e.g., a legitimate user logging into FTP looked the same as a hacker). The goal was to inspect the **Data Payload** to distinguish between harmless traffic and actual exploits.

### The Implementation

I implemented a **Signature-Based Detection Engine** (`inspectPacket`) that acts as a centralized filter for all open ports.

**Protocol Normalization**: Regardless of whether the traffic came from TCP (FTP), HTTP (Web), or UDP (Botnet), the data was normalized into a text string.

**Regex Heuristics**: The engine scans for known attack signatures:
- **SQLi**: `UNION SELECT`, `DROP TABLE`
- **RCE**: `cmd.exe`, `powershell`, `/bin/sh`
- **Traversal**: `../etc/passwd`
- **Scanning**: `User-Agent: Nmap`, `sqlmap`

**Threat Classification**: Attacks were categorized and unique threat types identified.

### The Result

The system successfully identified and differentiated 5 distinct attack vectors in a single test run, confirming that the inspection logic works across the application layer (Layer 7).

---

## Phase VI: Full-Spectrum Visualization (The "Traffic Center")

### The Objective

A silent security system is hard to trust. To demonstrate that the system was actively monitoring all flow (not just staying silent until an attack), I upgraded the Cloud Dashboard to visualize **Safe vs. Malicious traffic** in real-time. This moves the project from a simple "Alarm System" to a "Network Operations Center" (NOC).

### The Logic Change

**Defender (Laptop)**: Modified the inspection engine to handle "Safe" cases. If a packet payload matches none of the attack signatures, it is flagged as `SAFE TRAFFIC` and uploaded to the cloud instead of being ignored.

**Cloud (Dashboard)**: Implemented conditional CSS styling to differentiate traffic types visually:
- ✅ **Green Cards**: Represent safe traffic (e.g., `USER guest`, `GET /about.html`, Standard UDP Pings)
- ⚠️ **Red Cards**: Represent threats (e.g., `USER root`, `UNION SELECT`, `cmd.exe`)

### The Outcome

This update provided visual confirmation that the NIDS is active and correctly filtering traffic. It created a live, scrolling timeline showing the ratio of legitimate user behavior versus active exploitation attempts.

---

## Phase VII: Configuration Management & Code Organization

### The Objective

As the project grew, hardcoded values scattered across three files made it difficult to deploy and configure. The goal was to centralize all configuration into a single file and create comprehensive documentation.

### The Implementation

**Configuration File**: Created `config.json` with three sections:
- `server`: Dashboard settings (port, host, log capacity)
- `defender`: Honeypot settings (cloud URL, monitored ports)
- `attacker`: Simulation settings (target IP, timing delays)

**Code Refactoring**: Updated all three scripts (`server.js`, `defender.js`, `attacker.js`) to load settings from the config file instead of using hardcoded values.

**Documentation**: Created comprehensive README with:
- Architecture diagrams
- Step-by-step deployment instructions
- Troubleshooting guides
- Security warnings

### The Result

The project is now easier to deploy, configure, and understand. New users can quickly set up the system by editing a single config file rather than hunting through source code.

---

## Final Project Summary

**Project**: Distributed Cloud-Native Network Intrusion Detection System (NIDS)

**Core Architecture**: Engineered a hybrid-cloud security system consisting of distributed Node.js Sensors deployed on edge devices and a centralized Oracle Cloud dashboard for telemetry aggregation.

**Deep Packet Inspection (DPI)**: Developed a custom regex-based inspection engine capable of parsing raw TCP/UDP payloads to differentiate between legitimate user traffic and SQL Injection, RCE, and Brute Force attacks in real-time.

**Active Defense**: Implemented a multi-vector trap system (FTP, SSH, HTTP, UDP) to actively lure attackers, capturing identifying metadata (IP, User-Agent, Payloads) while ignoring background noise.

**Visualization & Telemetry**: Built a low-latency dashboard using Express.js to visualize network traffic flows, color-coding events to distinguish between benign requests and high-severity threats.

**Cloud Infrastructure**: Architected a secure VPC environment on Oracle Cloud Infrastructure (OCI), configuring Ingress/Egress security lists to safely expose the alert API while isolating internal components.

**Network Engineering**: Overcame OS-level packet filtering limitations on Windows by utilizing Raw Sockets and Loopback emulation to test and validate network security protocols.

**Configuration Management**: Centralized all settings into a single configuration file for easy deployment and maintenance.

---

## Technologies Used

- **Language**: JavaScript (Node.js)
- **Network Libraries**: `net`, `dgram`, `http`
- **HTTP Client**: `axios`
- **Web Framework**: `express`
- **Terminal Styling**: `chalk`
- **Cloud Platform**: Oracle Cloud Infrastructure (OCI)
- **Operating Systems**: Ubuntu (server), Windows (client testing)

---

## Lessons Learned

1. **OS-level networking** is complex and varies significantly between platforms
2. **Passive packet sniffing** on Windows requires careful driver configuration
3. **Active honeypots** are more reliable than passive sniffers for learning/testing
4. **Stateless firewalls** (iptables) can block legitimate traffic if not configured with ESTABLISHED,RELATED rules
5. **Deep packet inspection** is essential for reducing false positives
6. **Centralized configuration** makes projects significantly more maintainable

---

## Future Enhancements

Potential improvements for this project:

- Add machine learning-based anomaly detection
- Implement rate limiting and automatic IP blocking
- Add email/SMS/Discord notifications for critical alerts
- Create detailed analytics and reporting dashboard
- Support for HTTPS inspection with SSL/TLS decryption
- Container-based deployment with Docker
- Add support for more protocols (SMTP, DNS, etc.)