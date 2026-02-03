const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");
const express = require('express');
const pino = require('pino');
const fs = require('fs');
const axios = require('axios');
const qs = require('querystring');

const app = express();
const PORT = process.env.PORT || 10000;
const PASTEBIN_API_KEY = 'G7KwwROZTb-HD81Pe7VEq2baVm3EtakR';

app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#0f172a;color:white;">
            <div style="background:#1e293b;padding:30px;border-radius:15px;display:inline-block;box-shadow:0 10px 25px rgba(0,0,0,0.3);">
                <h2 style="color:#22c55e;">KNIGHT BOT SESSION</h2>
                <p>Enter number with country code (Ex: 919876543210)</p>
                <input type="text" id="num" placeholder="91..." style="padding:15px;width:280px;border-radius:8px;border:none;outline:none;"><br><br>
                <button onclick="getCode()" id="btn" style="padding:15px 30px;background:#22c55e;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">GET CODE</button>
                <h3 id="code" style="color:#ef4444;margin-top:20px;letter-spacing:3px;font-size:32px;"></h3>
                <p id="st" style="color:#94a3b8;"></p>
            </div>
            <script>
                async function getCode() {
                    const n = document.getElementById('num').value.trim();
                    if(!n) return alert('Enter Number!');
                    document.getElementById('btn').disabled = true;
                    document.getElementById('st').innerText = 'Requesting Code...';
                    const res = await fetch('/getcode?number=' + n);
                    const data = await res.json();
                    if(data.code) {
                        document.getElementById('code').innerText = data.code;
                        document.getElementById('st').innerText = 'Check WhatsApp notification now!';
                    } else {
                        document.getElementById('st').innerText = 'Error! Try again.';
                        document.getElementById('btn').disabled = false;
                    }
                }
            </script>
        </body>
    `);
});

app.get('/getcode', async (req, res) => {
    let num = req.query.number.replace(/[^0-9]/g, '');
    
    // Clear old session
    if (fs.existsSync('./session')) { fs.rmSync('./session', { recursive: true }); }

    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const XeonBotInc = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Knight Bot-ലെ അതേ ബ്രൗസർ
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        syncFullHistory: false,
    });

    XeonBotInc.ev.on('creds.update', saveCreds);

    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection } = s;
        if (connection === "open") {
            await delay(10000);
            const sessionData = JSON.stringify(XeonBotInc.authState.creds, null, 2);
            
            // Upload to Pastebin
            try {
                const pRes = await axios.post('https://pastebin.com/api/api_post.php', qs.stringify({
                    api_dev_key: PASTEBIN_API_KEY,
                    api_option: 'paste',
                    api_paste_code: sessionData,
                    api_paste_private: '1',
                    api_paste_expire_date: '1M'
                }));
                const id = pRes.data.split('/').pop();
                await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: "ZENX_V1_" + id });
            } catch (e) {}
            
            await delay(5000);
            process.exit(0);
        }
    });

    try {
        if (!XeonBotInc.authState.creds.registered) {
            await delay(3000);
            let code = await XeonBotInc.requestPairingCode(num);
            if (!res.headersSent) res.json({ code: code });
        }
    } catch (err) {
        if (!res.headersSent) res.json({ error: "Failed" });
    }
});

app.listen(PORT, () => console.log('Knight Bot Session Gen Live!'));
