const http = require('http');
const net = require('net');
const dgram = require('dgram');
const axios = require('axios');
const chalk = require('chalk');
const config = require('./config.json');

// CONFIGURATION
const CLOUD_URL = config.defender.cloudUrl;
const PORTS = config.defender.ports;

console.log(chalk.cyan(`\n🕵️  DEEP PACKET INSPECTION MONITOR ACTIVE`));
console.log(chalk.gray(`   Scanning payloads on ports: ${PORTS.http}, ${PORTS.ftp}, ${PORTS.ssh}, ${PORTS.udp}`));

// ---------------------------------------------------------
// 1. HTTP TRAP (Port 80) - Scans URLs and Headers
// ---------------------------------------------------------
const webTrap = http.createServer((req, res) => {
    const srcIp = req.socket.remoteAddress;
    const method = req.method;
    const url = decodeURI(req.url);
    const userAgent = req.headers['user-agent'] || "Unknown";

    // Inspect URL + User Agent
    const evidence = `URL: ${url} | UA: ${userAgent}`;
    inspectPacket(srcIp, `HTTP (${PORTS.http})`, evidence);

    res.writeHead(403);
    res.end("Access Denied");
});

webTrap.listen(PORTS.http, () => console.log(chalk.green(`   ✅ HTTP Trap Armed`)));
webTrap.on('error', (e) => console.log(chalk.red(`   ❌ Port ${PORTS.http} Busy`)));

// ---------------------------------------------------------
// 2. FTP TRAP (Port 21) - Scans Usernames/Passwords
// ---------------------------------------------------------
const ftpTrap = net.createServer((socket) => {
    const srcIp = socket.remoteAddress;

    socket.write("220 Welcome to SecureFTP\r\n");

    socket.on('data', (data) => {
        const payload = data.toString().trim();
        // Inspect whatever they type (USER root, PASS admin, etc)
        inspectPacket(srcIp, `FTP (${PORTS.ftp})`, payload);
    });
});

ftpTrap.listen(PORTS.ftp, () => console.log(chalk.green(`   ✅ FTP Trap Armed`)));
ftpTrap.on('error', (e) => console.log(chalk.red(`   ❌ Port ${PORTS.ftp} Busy`)));

// ---------------------------------------------------------
// 3. SSH TRAP (Port 2222) - Scans Handshake Banner
// ---------------------------------------------------------
const sshTrap = net.createServer((socket) => {
    const srcIp = socket.remoteAddress;

    socket.on('data', (data) => {
        const payload = data.toString().trim();
        // SSH starts with a cleartext version string like "SSH-2.0-Putty"
        inspectPacket(srcIp, `SSH (${PORTS.ssh})`, payload);
        socket.end(); // Hang up immediately
    });
});

sshTrap.listen(PORTS.ssh, () => console.log(chalk.green(`   ✅ SSH Trap Armed`)));

// ---------------------------------------------------------
// 4. UDP TRAP (Port 9999) - Scans Botnet Commands
// ---------------------------------------------------------
const udpTrap = dgram.createSocket('udp4');

udpTrap.on('message', (msg, rinfo) => {
    const srcIp = rinfo.address;
    const payload = msg.toString();
    inspectPacket(srcIp, `UDP (${PORTS.udp})`, payload);
});

udpTrap.bind(PORTS.udp, () => console.log(chalk.green(`   ✅ UDP Trap Armed`)));

// ---------------------------------------------------------
// Deep Packet Inspection Engine
// ---------------------------------------------------------
function inspectPacket(ip, protocol, content) {
    let threatType = null;

    // --- DETECTION RULES ---
    if (content.match(/UNION SELECT|DROP TABLE|OR 1=1|--/i)) threatType = "SQL INJECTION";
    else if (content.match(/<script>|javascript:|onerror=/i)) threatType = "XSS ATTACK";
    else if (content.match(/\.\.\/ |\\.\\.\\|etc\/passwd/i)) threatType = "DIRECTORY TRAVERSAL";
    else if (content.match(/USER root|USER admin|PASS 123456/i)) threatType = "BRUTE FORCE ATTEMPT";
    else if (content.match(/sqlmap|nmap|nikto|curl/i)) threatType = "SCANNER DETECTED";
    else if (content.match(/; ls|\| cat|cmd\.exe|powershell/i)) threatType = "RCE ATTEMPT";

    // DECISION TIME
    if (threatType) {
        // BAD TRAFFIC (Red Alert)
        console.log(chalk.bgRed.white.bold(` [BLOCKED] ${threatType} `));
        console.log(chalk.yellow(`   Source: ${ip} (${protocol})`));
        sendToCloud(threatType, ip, `${protocol}: ${content}`);
    } else {
        // GOOD TRAFFIC (Green Log)
        // We now send this to the cloud too!
        console.log(chalk.bgGreen.black(` [ALLOWED] SAFE TRAFFIC `));
        console.log(chalk.gray(`   Source: ${ip} (${protocol})`));
        sendToCloud("SAFE TRAFFIC", ip, `${protocol}: ${content}`);
    }
}

async function sendToCloud(type, ip, payload) {
    try {
        await axios.post(CLOUD_URL, {
            type, ip, payload, timestamp: new Date().toLocaleTimeString()
        });
        console.log(chalk.blue(`   -> Uploaded to Oracle Cloud`));
    } catch (e) { }
}