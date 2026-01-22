import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";

// 👑 Your WhatsApp number
const owners = ["923035698438"];

// ⚠️ Variables
const warnings = new Map();        
const userCooldown = new Map();    
const badWords = ["fuck","bitch","asshole","shit"];

// 🔹 Start Bot
const startBot = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
  });

  // Save credentials automatically
  sock.ev.on("creds.update", saveCreds);

  // ✅ Handle QR codes manually
  sock.ev.on("connection.update", (update) => {
    const { qr, connection, lastDisconnect } = update;

    if (qr) {
      // Print scannable QR in terminal
      qrcode.generate(qr, { small: true });
      console.log("Scan this QR with WhatsApp to login.");
    }

    if (connection === "open") {
      console.log("✅ Bot is connected!");
    }

    if (connection === "close") {
      console.log("❌ Connection closed:", lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error);
    }
  });

  // 🔹 Listen for messages
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;

    const jid = m.key.remoteJid;
    const isGroup = jid.endsWith("@g.us");
    const sender = m.key.participant || jid;
    const senderNum = sender.replace("@s.whatsapp.net","");

    const text = m.message.conversation || m.message.extendedTextMessage?.text;
    if(!text) return;

    // ⚡ Anti-spam
    const now = Date.now();
    if(userCooldown.has(sender)){
      const last = userCooldown.get(sender);
      if(now - last < 3000){
        await sock.sendMessage(jid,{text:"⏳ Slow down! Anti-spam active."});
        return;
      }
    }
    userCooldown.set(sender,now);

    // ⚠️ Bad words filter
    const lower = text.toLowerCase();
    if(badWords.some(w => lower.includes(w))){
      let warn = warnings.get(sender) || 0;
      warn++;
      warnings.set(sender,warn);

      if(warn >= 3 && isGroup){
        await sock.sendMessage(jid,{text:`🚫 @${senderNum} removed for abuse.`,mentions:[sender]});
        await sock.groupParticipantsUpdate(jid,[sender],"remove");
      } else {
        await sock.sendMessage(jid,{text:`⚠️ @${senderNum} Warning ${warn}/3`,mentions:[sender]});
      }
    }

    // 🔹 Simple reply
    if(text.toLowerCase() === "menu"){
      await sock.sendMessage(jid,{text:"📜 Bot Commands:\n.menu\n.ping\n.rules\n.warn\n.kick\n.mute\n.echo <text>"});
    }
  });
};

startBot().catch(err => console.log("❌ Error starting bot:", err));
