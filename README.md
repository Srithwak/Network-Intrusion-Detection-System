# Network Intrusion Detection System (NIDS)

A distributed, cloud-native Network Intrusion Detection System built with Node.js that uses honeypot architecture to detect and visualize cyber threats in real-time.

## 📋 Overview

This project consists of three main components:

- **Server** (`server.js`): Cloud dashboard hosted on Oracle Cloud Infrastructure (OCI) that aggregates and visualizes network traffic
- **Defender** (`defender.js`): Honeypot system that runs on your local network to detect attacks
- **Attacker** (`attacker.js`): Simulation tool to generate test traffic (both safe and malicious)

## 🏗️ Architecture

```
┌─────────────────┐
│  Attacker.js    │  (Different device on network)
│  Generates test │
│  traffic        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Defender.js    │─────\u003e│   Server.js      │
│  (Local Device) │ HTTP │   (OCI Cloud)    │
│  Port 80, 21,   │ POST │   Dashboard      │
│  2222, 9999     │      │   Port 3000      │
└─────────────────┘      └──────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Oracle Cloud Infrastructure account (for server deployment)
- Network access to the devices you want to monitor

### Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd network_sniffer
```

2. Install dependencies:
```bash
npm install
```

3. Configure the system by editing `config.json`:

> **Note**: `server.js` is standalone and doesn't require `config.json`. Only `defender.js` and `attacker.js` use the config file.

```json
{
  "defender": {
    "cloudUrl": "http://YOUR-CLOUD-IP:3000/alert",
    "ports": {
      "http": 80,
      "ftp": 21,
      "ssh": 2222,
      "udp": 9999
    }
  },
  "attacker": {
    "targetIp": "YOUR-DEFENDER-IP",
    "delayBetweenAttacks": 1000,
    "initialDelay": 500
  }
}
```

## 📦 Deployment

### 1. Deploy Server to Oracle Cloud

SSH into your OCI Ubuntu VM:

```bash
ssh ubuntu@YOUR-CLOUD-IP
```

Install Node.js and dependencies:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Upload `server.js` to your VM (no need to upload `config.json`), then configure the firewall:

```bash
# Configure iptables to allow necessary traffic
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -j DROP
sudo netfilter-persistent save
```

Configure OCI Security List to allow ingress on port 3000.

Start the server:

```bash
node server.js
```

### 2. Run Defender on Local Network

On your local machine (the device you want to protect):

```bash
node defender.js
```

**Note**: The defender needs to run with elevated privileges to bind to ports 80, 21, 2222, and 9999:

- **Linux/Mac**: Use `sudo node defender.js`
- **Windows**: Run as Administrator

### 3. Run Attacker for Testing

On a **different device** on the same network:

```bash
node attacker.js
```

This will generate a mix of safe and malicious traffic to test the detection system.

## ⚙️ Configuration

Configuration is in `config.json` for `defender.js` and `attacker.js`. `server.js` is standalone with hardcoded values.

### Server Settings (Hardcoded in server.js)

- Port: 3000
- Host: 0.0.0.0
- Max traffic log entries: 50

### Defender Settings

- `cloudUrl`: Full URL of your cloud server's alert endpoint
- `ports`: Port numbers for each honeypot service

### Attacker Settings

- `targetIp`: IP address of the defender machine
- `delayBetweenAttacks`: Milliseconds to wait between attack simulations
- `initialDelay`: Milliseconds to wait before follow-up packets

## 🛡️ Detection Capabilities

The system can detect the following attack types:

| Attack Type | Detection Signature |
|------------|-------------------|
| SQL Injection | `UNION SELECT`, `DROP TABLE`, `OR 1=1`, `--` |
| XSS Attack | `<script>`, `javascript:`, `onerror=` |
| Directory Traversal | `../`, `..\\`, `etc/passwd` |
| Brute Force | `USER root`, `USER admin`, `PASS 123456` |
| Scanner Detection | `sqlmap`, `nmap`, `nikto`, `curl` |
| RCE Attempt | `; ls`, `\| cat`, `cmd.exe`, `powershell` |

## 📊 Dashboard

Access the live traffic dashboard by navigating to:

```
http://YOUR-CLOUD-IP:3000
```

The dashboard automatically refreshes every 2 seconds and displays:

- ✅ **Green Cards**: Safe traffic
- ⚠️ **Red Cards**: Detected threats

Each event shows:
- Traffic type
- Source IP address
- Timestamp
- Payload content

## 📖 Project Structure

```
network_sniffer/
├── server.js           # Cloud dashboard server
├── defender.js         # Local honeypot defense system
├── attacker.js         # Attack simulation tool
├── config.json         # Centralized configuration
├── documentation.md    # Detailed development journey
├── README.md           # This file
├── package.json        # Node.js dependencies
└── .gitignore         # Git ignore rules
```

## 🔧 Troubleshooting

### Port Already in Use

If you get "Port Busy" errors, another application may be using the required ports:

**Windows**:
```bash
netstat -ano | findstr :80
taskkill /PID <PID> /F
```

**Linux/Mac**:
```bash
sudo lsof -i :80
sudo kill -9 <PID>
```

### Firewall Blocking Traffic

**Windows**: Allow the application through Windows Firewall when prompted

**Linux**: Configure iptables or ufw to allow the required ports

### Attacker Can't Reach Defender

- Ensure both devices are on the same network
- Verify the `targetIp` in `config.json` is correct
- Check that the defender is running and ports are open

## 📚 Development Journey

For a detailed account of how this project was built, including challenges faced and solutions implemented, see [`documentation.md`](documentation.md).

## 🔐 Security Notes

**WARNING**: This is a learning/demonstration project. Do not use in production environments without proper security hardening.

- The honeypot services intentionally have no authentication
- All traffic is logged in plain text
- The system does not actually block malicious traffic
- Defender should only run on isolated test networks

## 📝 License

This project is for educational purposes only.

## 🤝 Contributing

This is a personal learning project, but feedback and suggestions are welcome!
