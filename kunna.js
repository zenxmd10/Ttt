const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const express = require("express");
const axios = require("axios");
const qs = require("querystring");
const pino = require("pino");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;
const PASTEBIN_API_KEY = process.env.PASTEBIN_API_KEY; // optional

/* -------------------- HOME -------------------- */
app.get("/", (req, res) => {
    res.send("ZENX-V1 ACTIVE");
});

/* -------------------- GET CODE -------------------- */
app.get("/getcode", async (req, res) => {
    try {
        let num = (req.query.number || "").replace(/[^0-9]/g, "");

        if (!num || num.length < 10 || num.length > 15) {
            return res.json({ error: "Invalid number" });
        }

        const sessionPath = `./session_${num}`;

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        let codeSent = false;

        const sock = makeWASocket({
            version,
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            browser: ["Chrome (Linux)", "Chrome", "120.0"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    pino({ level: "fatal" })
                ),
            },
            syncFullHistory: false, // ⚠️ heavy load avoid
        });

        sock.ev.on("creds.update", saveCreds);

        /* -------- CONNECTION UPDATE -------- */
        sock.ev.on("connection.update", async (update) => {
            const { connection } = update;

            if (connection === "open") {
                await delay(5000);

                // OPTIONAL: Pastebin backup
                if (PASTEBIN_API_KEY) {
                    try {
                        const sessionData = JSON.stringify(
                            sock.authState.creds,
                            null,
                            2
                        );

                        const pRes = await axios.post(
                            "https://pastebin.com/api/api_post.php",
                            qs.stringify({
                                api_dev_key: PASTEBIN_API_KEY,
                                api_option: "paste",
                                api_paste_code: sessionData,
                                api_paste_private: "1",
                                api_paste_expire_date: "1M",
                            })
                        );

                        const id = pRes.data.split("/").pop();
                        await sock.sendMessage(sock.user.id, {
                            text: "ZENX_V1_" + id,
                        });
                    } catch (e) {
                        console.log("Pastebin failed");
                    }
                }

                await sock.logout();
                await sock.end();
            }
        });

        /* -------- PAIRING CODE -------- */
        if (!sock.authState.creds.registered && !codeSent) {
            await delay(3000);
            codeSent = true;
            const code = await sock.requestPairingCode(num);
            return res.json({ code });
        }
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.json({ error: "Failed" });
    }
});

/* -------------------- SERVER -------------------- */
app.listen(PORT, () => {
    console.log("✅ ZENX-V1 Server Running on", PORT);
});
