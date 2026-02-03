const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const pino = require('pino');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;
const PASTEBIN_API_KEY = 'G7KwwROZTb-HD81Pe7VEq2baVm3EtakR';

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>ZENX-V1 SESSION GEN</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 40px 20px; background: #0f172a; color: white; margin: 0; }
                .container { background: #1e293b; padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 400px; margin: auto; }
                h2 { color: #22c55e; margin-bottom: 20px; }
                input { width: 100%; padding: 15px; margin: 20px 0; border: none; border-radius: 10px; font-size: 16px; outline: none; box-sizing: border-box; }
                button { width: 100%; padding: 15px; background: #22c55e; color: white; border: none; border-radius: 10px; font-weight: bold; font-size: 16px; cursor: pointer; transition: 0.3s; }
                button:disabled { background: #475569; cursor: not-allowed; }
                #code { font-size: 35px; font-weight: bold; color: #ef4444; margin-top: 25px; letter-spacing: 5px; min-height: 40px; }
                #status { color: #94a3b8; margin-top: 15px; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h2>ZENX-V1</h2>
                <p>Enter WhatsApp number with country code</p>
                <input type="text" id="num" placeholder="e.g. 919876543210">
                <button onclick="getCode()" id="btn">GET PAIRING CODE</button>
                <div id="code"></div>
                <p id="status"></p>
            </div>
            <script>
                async function getCode() {
                    const number = document.getElementById('num').value.replace(/[^0-9]/g, '');
                    if(!number || number.length < 10) return alert('Enter a valid WhatsApp number!');
                    
                    const btn = document.getElementById('btn');
                    const status = document.getElementById('status');
                    const codeDiv = document.getElementById('code');
                    
                    btn.disabled = true;
                    status.innerText = 'Connecting to WhatsApp...';
                    codeDiv.innerText = '';

                    try {
                        const response = await fetch('/getcode?number=' + number);
                        const data = await response.json();
                        if(data.code) {
                            codeDiv.innerText = data.code;
                            status.innerText = 'Check your WhatsApp notifications or go to Linked Devices > Link with Phone Number.';
                        } else {
                            status.innerText = 'Error: ' + (data.error || 'Failed to get code');
                            btn.disabled = false;
                        }
                    } catch(e) {
                        status.innerText = 'Server Error! Try again later.';
                        btn.disabled = false;
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/getcode', async (req, res) => {
    let num = req.query.number.replace(/[^0-9]/g, '');
    if (fs.existsSync('./session')) { fs.rmSync('./session', { recursive: true, force: true }); }

    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        // Request വരാൻ ഏറ്റവും അനുയോജ്യമായ ബ്രൗസർ സെറ്റിംഗ്സ്
        browser: ["Chrome (Linux)", "Chrome", "121.0.6167.160"],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (s) => {
        if (s.connection === "open") {
            await delay(5000);
            const sessionData = JSON.stringify(sock.authState.creds, null, 2);
            try {
                const pRes = await axios.post('https://pastebin.com/api/api_post.php', qs.stringify({
                    api_dev_key: PASTEBIN_API_KEY,
                    api_option: 'paste',
                    api_paste_code: sessionData,
                    api_paste_private: '1',
                    api_paste_expire_date: '1M'
                }));
                const id = pRes.data.split('/').pop();
                await sock.sendMessage(sock.user.id, { text: "ZENX_V1_" + id });
            } catch (e) {
                console.error("Pastebin Error");
            }
            await delay(3000);
            process.exit(0);
        }
    });

    try {
        if (!sock.authState.creds.registered) {
            await delay(3000);
            let code = await sock.requestPairingCode(num);
            if (!res.headersSent) res.json({ code: code });
        }
    } catch (err) {
        if (!res.headersSent) res.json({ error: "Request Failed" });
    }
});

app.listen(PORT, () => console.log('Server Live on ' + PORT));
