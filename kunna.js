const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    makeCacheableSignalKeyStore,
    Browsers,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const pino = require('pino');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000; // Render-ന് 10000 ആണ് നല്ലത്
const PASTEBIN_API_KEY = 'G7KwwROZTb-HD81Pe7VEq2baVm3EtakR';

app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f0f2f5;">
            <div style="background:#fff;padding:30px;border-radius:15px;display:inline-block;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
                <h2 style="color:#075E54;">ZENX-V1 PAIRING</h2>
                <input type="text" id="num" placeholder="919876543210" style="padding:15px;width:280px;border-radius:8px;border:1px solid #ddd;"><br><br>
                <button onclick="getCode()" id="btn" style="padding:15px 30px;background:#25D366;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">GET CODE</button>
                <h3 id="code" style="color:#d32f2f;margin-top:20px;letter-spacing:2px;font-size:30px;"></h3>
                <p id="status" style="color:#666;"></p>
            </div>
            <script>
                async function getCode() {
                    const n = document.getElementById('num').value.trim();
                    if(!n) return alert('Enter Number!');
                    const btn = document.getElementById('btn');
                    btn.disabled = true;
                    document.getElementById('status').innerText = 'Requesting... Please check WhatsApp';
                    try {
                        const res = await fetch('/getcode?number=' + n);
                        const data = await response.json();
                        if(data.code) {
                            document.getElementById('code').innerText = data.code;
                        }
                    } catch(e) {}
                }
            </script>
        </body>
    `);
});

app.get('/getcode', async (req, res) => {
    let num = req.query.number.replace(/[^0-9]/g, '');
    if (fs.existsSync('./auth_info')) { fs.rmSync('./auth_info', { recursive: true }); }

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: Browsers.ubuntu("Chrome"),
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (s) => {
        if (s.connection === "open") {
            await delay(10000);
            const session = JSON.stringify(sock.authState.creds);
            const pRes = await axios.post('https://pastebin.com/api/api_post.php', qs.stringify({
                api_dev_key: PASTEBIN_API_KEY,
                api_option: 'paste',
                api_paste_code: session,
                api_paste_private: '1',
                api_paste_expire_date: '1M'
            }));
            const id = pRes.data.split('/').pop();
            await sock.sendMessage(sock.user.id, { text: "ZENX_V1_" + id });
            process.exit(0);
        }
    });

    if (!sock.authState.creds.registered) {
        await delay(3000);
        const code = await sock.requestPairingCode(num);
        if (!res.headersSent) res.json({ code });
    }
});

app.listen(PORT, () => console.log('Server Ready!'));
        
