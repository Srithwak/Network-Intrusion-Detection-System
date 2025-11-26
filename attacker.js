const axios = require('axios');
const net = require('net');
const dgram = require('dgram');
const config = require('./config.json');

// ⚠️ YOUR DEFENDER'S IP
const TARGET = config.attacker.targetIp;
const DELAY_BETWEEN_ATTACKS = config.attacker.delayBetweenAttacks;
const INITIAL_DELAY = config.attacker.initialDelay;

async function main() {
    console.log(`\n⚔️  GENERATING MIXED TRAFFIC ON ${TARGET}...\n`);

    // 1. FTP TRAFFIC (Port 21)
    console.log(`[1/6] Sending SAFE FTP login... (Should be GREEN)`);
    sendTcp(21, "USER guest\r\n"); // Normal user
    await sleep(INITIAL_DELAY);
    sendTcp(21, "PASS anonymous\r\n");
    await sleep(DELAY_BETWEEN_ATTACKS);

    console.log(`[2/6] Sending MALICIOUS FTP login... (Should be RED)`);
    sendTcp(21, "USER admin\r\n"); // Brute force target
    await sleep(INITIAL_DELAY);
    sendTcp(21, "PASS 123456\r\n"); // Bad password
    await sleep(DELAY_BETWEEN_ATTACKS);

    // 2. HTTP TRAFFIC (Port 80)
    console.log(`[3/6] Sending SAFE Web Request... (Should be GREEN)`);
    try {
        await axios.get(`http://${TARGET}/about.html`);
    } catch (e) { }
    await sleep(DELAY_BETWEEN_ATTACKS);

    console.log(`[4/6] Sending SQL INJECTION... (Should be RED)`);
    try {
        await axios.get(`http://${TARGET}/login?q=UNION SELECT * FROM users--`);
    } catch (e) { }
    await sleep(DELAY_BETWEEN_ATTACKS);

    // 3. UDP TRAFFIC (Port 9999)
    const client = dgram.createSocket('udp4');

    console.log(`[5/6] Sending SAFE UDP Ping... (Should be GREEN)`);
    client.send(Buffer.from("Hello Server, are you there?"), 9999, TARGET);
    await sleep(DELAY_BETWEEN_ATTACKS);

    console.log(`[6/6] Sending BOTNET Command... (Should be RED)`);
    client.send(Buffer.from("cmd.exe /c download_virus.exe"), 9999, TARGET);

    console.log(`\n✅ SIMULATION COMPLETE.`);
    setTimeout(() => process.exit(0), 1000);
}

function sendTcp(port, data) {
    try {
        const s = new net.Socket();
        s.connect(port, TARGET, () => {
            s.write(data);
            s.end();
        });
        s.on('error', () => { });
    } catch (e) { }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
main();