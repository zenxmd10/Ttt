const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const express = require("express");
const pino = require("pino");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;

/* -------------------- HOME UI -------------------- */
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
<title>ZENX Session Generator</title>
<style>
body{
    background:#0f172a;
    color:white;
    font-family:sans-serif;
    display:flex;
    justify-content:center;
    align-items:center;
    height:100vh;
}
.box{
    background:#1e293b;
    padding:30px;
    border-radius:15px;
    text-align:center;
    width:320px;
}
input{
    width:100%;
    padding:14px;
    border-radius:8px;
    border:none;
    margin-bottom:15px;
    font-size:16px;
}
button{
    padding:14px;
    width:100%;
    background:#22c55e;
    color:white;
    border:none;
    border-radius:8px;
    font-size:16px;
    cursor:pointer;
}
#code{
    margin-top:20px;
    font-size:28px;
    letter-spacing:4px;
    color:#f87171;
}
#status{
    margin-top:10px;
    color:#94a3b8;
}
</style>
</head>
<body>
<div class="box">
    <h2>ZENX-V1</h2>
    <input id="num" placeholder="919876543210">
    <button onclick="getCode()">Get Pairing Code</button>
    <div id="code"></div>
    <div id="status"></div>
</div>

<script>
async function getCode(){
    const n = document.getElementById("num").value.trim();
    if(!n) return alert("Enter number with country code");
    document.getElementById("status").innerText = "Requesting… wait 10 sec";
    document.getElementById("code").innerText = "";

    const r = await fetch("/getcode?number="+n);
    const d = await r.json();

    if(d.code){
        document.getElementById("code").innerText = d.code;
        document.getElementById("status").innerText =
          "WhatsApp → Linked Devices → Link with phone number";
    }else{
        document.getElementById("status").innerText = "Failed. Try again.";
    }
}
</script>
</body>
</html>
`);
});

/* -------------------- GET PAIRING CODE -------------------- */
app.get("/getcode", async (req, res) => {
    try {
        let num = (req.query.number || "").replace(/[^0-9]/g, "");

        if (!num || num.length < 10 || num.length > 15) {
            return res.json({ error: "Invalid number" });
        }

        const sessionPath = `./session_${num}`;

        // clear old session (IMPORTANT)
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            browser: ["Chrome (Linux)", "Chrome", "121"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    pino({ level: "fatal" })
                ),
            },
            syncFullHistory: false
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", (u) => {
            if (u.connection === "open") {
                console.log("✅ Socket connected");
            }
        });

        // VERY IMPORTANT DELAY (Render fix)
        await delay(8000);

        if (!sock.authState.creds.registered) {
            console.log("📲 Requesting pairing code...");
            const code = await sock.requestPairingCode(num);
            return res.json({ code });
        } else {
            return res.json({ error: "Already registered" });
        }

    } catch (e) {
        console.error(e);
        if (!res.headersSent) res.json({ error: "Failed" });
    }
});

/* -------------------- SERVER -------------------- */
app.listen(PORT, () => {
    console.log("✅ ZENX-V1 running on port", PORT);
});
