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
const PORT = process.env.PORT || 3000;
const PASTEBIN_API_KEY = 'G7KwwROZTb-HD81Pe7VEq2baVm3EtakR';

app.get('/', (req, res) => {
    res.send(`
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f0f2f5;">
            <div style="background:#fff;padding:30px;border-radius:10px;display:inline-block;box-shadow:0 5px 15px rgba(0,0,0,0.1);">
                <h2>ZENX-V1 LOGIN</h2>
                <input type="text" id="num" placeholder="919876543210" style="padding:10px;width:250px;"><br><br>
                <button onclick="getCode()" style="padding:10px 20px;background:#25D366;color:#fff;border:none;border-radius:5px;cursor:pointer;">GET CODE</button>
                <h3 id="code" style="color:red;margin-top:20px;letter-spacing:2px;"></h3>
                <p id="status"></p>
            </div>
            <script>
                async function getCode() {
                    const n = document.getElementById('num').value;
                    document.getElementById('status').innerText = 'Requesting...';
                    const res = await fetch('/getcode?number=' + n);
                    const data = await res.json();
                    if(data.code) {
                        document.getElementById('code').innerText = data.code;
                        document.getElementById('status').innerText = 'Now link this code in your WhatsApp';
                    }
                }
            </script>
        </body>
    `);
});

app.get('/getcode', async (req, res) => {
    let num = req.query.number.replace(/[^0-9]/g, '');
    
    // പഴയ ഡാറ്റ പൂർണ്ണമായും നീക്കം ചെയ്യുന്നു
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
        syncFullHistory: false // വേഗത്തിൽ ലോഗിൻ ആകാൻ ഇത് സഹായിക്കും
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (s) => {
        if (s.connection === "open") {
            await delay(5000);
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

app.listen(PORT, () => console.log('Server is Live!'));
              
