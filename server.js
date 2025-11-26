const express = require('express');
const chalk = require('chalk');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';
const MAX_LOG_ENTRIES = 50;

app.use(express.json());

let trafficLog = [];

app.post('/alert', (req, res) => {
    const { type, ip, payload, timestamp } = req.body;

    // Log to server console with color
    if (type === "SAFE TRAFFIC") {
        console.log(chalk.green(` [LOG] ${type} from ${ip}`));
    } else {
        console.log(chalk.bgRed.white(` [ALERT] ${type} from ${ip} `));
    }

    // Add to list (Keep last N events)
    trafficLog.unshift({ type, ip, payload, timestamp });
    if (trafficLog.length > MAX_LOG_ENTRIES) trafficLog.pop();

    res.sendStatus(200);
});

app.get('/', (req, res) => {
    let html = `
    <html>
    <head>
        <meta http-equiv="refresh" content="2"> <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { background-color: #0f0f0f; color: #e0e0e0; font-family: 'Courier New', monospace; padding: 20px; }
            h1 { border-bottom: 2px solid #555; padding-bottom: 10px; color: #fff; }

            /* BASE CARD STYLE */
            .card {
                background: #1a1a1a;
                margin-bottom: 12px;
                padding: 12px;
                border-radius: 4px;
                border-left: 6px solid #555; /* Default Gray */
            }

            /* THREAT STYLES (Red) */
            .threat { border-left-color: #ff3333; }
            .threat .type { color: #ff3333; font-weight: bold; font-size: 1.1em; }

            /* SAFE STYLES (Green) */
            .safe { border-left-color: #00cc66; }
            .safe .type { color: #00cc66; font-weight: bold; font-size: 1.1em; }

            .meta { color: #888; font-size: 0.85em; margin: 4px 0; }
            .payload {
                background: #000;
                padding: 8px;
                color: #ccc;
                font-size: 0.8em;
                word-break: break-all;
                border: 1px solid #333;
                margin-top: 5px;
            }
        </style>
    </head>
    <body>
        <h1>🌐 LIVE TRAFFIC MONITOR</h1>
        <div id="feed">
    `;

    if (trafficLog.length === 0) {
        html += `<div style="color:#666; text-align:center; margin-top:50px;">Waiting for traffic...</div>`;
    } else {
        trafficLog.forEach(event => {
            // Determine styling class based on type
            const isSafe = event.type === "SAFE TRAFFIC";
            const cssClass = isSafe ? "card safe" : "card threat";
            const icon = isSafe ? "✅" : "⚠️";

            html += `
            <div class="${cssClass}">
                <div class="type">${icon} ${event.type}</div>
                <div class="meta">SOURCE: ${event.ip} • TIME: ${event.timestamp}</div>
                <div class="payload">${event.payload}</div>
            </div>`;
        });
    }

    html += `</div></body></html>`;
    res.send(html);
});

app.listen(PORT, HOST, () => {
    console.log(chalk.cyan(`\n☁️  DASHBOARD ONLINE at http://${HOST}:${PORT}`));
});