const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    Browsers
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
    // ബാക്ക്റ്റിക്സ് (`) ഉപയോഗിക്കുന്നത് ഉറപ്പാക്കുക
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>ZENX-V1 SESSION</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: white; }
                .card { background: #1e293b; padding: 30px; border-radius: 15px; display: inline-block; box-shadow: 0 10px 25px rgba(0,0,0,0.3); max-width: 400px; width: 90%; }
                input { width: 100%; padding: 12px; margin: 20px 0; border: none; border-radius: 8px; box-sizing: border-box; outline: none; }
                button { width: 100%; padding: 12px; background: #22c55e; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
                #code { font-size: 30px; font-weight: bold; color: #ef4444; margin-top: 20px; letter-spacing: 3px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>ZENX-V1 PAIRING</h2>
                <p>Enter number with country code (e.g. 91...)</p>
                <input type="text" id="num" placeholder="919876543210">
                <button onclick="getCode()" id="btn">GET PAIRING CODE</button>
                <div id="code"></div>
                <p id="st" style="color: #94a3b8; margin-top: 10px;"></p>
            </div>
            <script>
                async function getCode() {
                    const n = document.getElementById('num').value.trim();
                    if(!n) return alert('Enter Number!');
                    document.getElementById('btn').disabled = true;
                    document.getElementById('st').innerText = 'Requesting... Please wait.';
                    try {
                        const response = await fetch('/getcode?number=' + n);
                        const data = await response.json();
                        if(data.code) {
                            document.getElementById('code').innerText = data.code;
                            document.getElementById('st').innerText = 'Check your WhatsApp Notification now!';
                        } else {
                            document.getElementById('st').innerText = 'Error! Try again.';
                            document.getElementById('btn').disabled = false;
                        }
                    } catch(e) {
                        document.getElementById('st').innerText = 'Request Failed!';
                        document.getElementById('btn').disabled = false;
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/getcode', async (req, res) => {
    let num = req.query.number.replace(/[^0-9]/g, '');
    if (fs.existsSync('./session')) { fs.rmSync('./session', { recursive: true }); }

    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.ubuntu("Chrome"),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (s) => {
        if (s.connection === "open") {
            await delay(10000);
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
                console.error("Pastebin Error:", e);
            }
            await delay(5000);
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
        if (!res.headersSent) res.json({ error: "Failed" });
    }
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
