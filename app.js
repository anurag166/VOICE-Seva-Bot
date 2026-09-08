const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

// YOUR CREDENTIALS - Put in Render Env Variables
const TOKEN = process.env.TOKEN; // Your EAA... token
const PHONE_ID = "1288766307660996";
const VERIFY_TOKEN = "voice123"; // you set this in webhook

let tasks = {}; // { "91xxxx@s.whatsapp.net": { task: "Cleaning", status: "pending", name: "Prabhu" } }

// SEND MESSAGE FUNCTION
async function sendWhatsApp(to, text) {
  await fetch(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: text }
    })
  });
}

// WEBHOOK VERIFICATION (for Meta)
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// RECEIVE MESSAGES (YES/NO)
app.post('/webhook', async (req, res) => {
  const entry = req.body.entry?.[0]?.changes?.[0]?.value;
  const msg = entry?.messages?.[0];
  if (!msg) return res.sendStatus(200);

  const from = msg.from; // 91xxxxxxxxxx
  const text = msg.text?.body?.trim().toUpperCase();
  const name = entry.contacts?.[0]?.profile?.name || "Prabhu";

  if (text === "YES") {
    if (tasks[from]) {
      tasks[from].status = "done";
      await sendWhatsApp(from, `✅ Hare Krishna ${name}!\nSeva "${tasks[from].task}" marked as DONE. Thank you 🙏\n- VOICE Seva Setu`);
    }
  } else if (text.startsWith("NO")) {
    const reason = msg.text.body.substring(2).trim() || "No reason";
    if (tasks[from]) {
      tasks[from].status = "not_done";
      tasks[from].reason = reason;
      await sendWhatsApp(from, `📝 Noted ${name}. Seva pending due to: ${reason}\nJai Shri Krishna 🙏`);
    }
  } else if (text.startsWith("TASK ")) {
    // Admin: TASK 919876543210 Cleaning
    const parts = msg.text.body.split(' ');
    const target = parts[1];
    const taskName = parts.slice(2).join(' ');
    tasks[target] = { task: taskName, status: "pending", name: target };
    await sendWhatsApp(target, `🔔 *Seva Reminder - VOICE Seva Setu*\n\nHare Krishna 🙏\n📌 Your Seva Today: *${taskName}*\n\nReply:\nYES - if done\nNO <reason> - if not done`);
    await sendWhatsApp(from, `Task assigned to ${target}`);
  } else if (text === "REPORT") {
    let report = "*Daily Seva Report - VOICE*\n\n";
    for (let p in tasks) {
      report += `${p}: ${tasks[p].task} - ${tasks[p].status} ${tasks[p].reason || ''}\n`;
    }
    await sendWhatsApp(from, report);
  }

  res.sendStatus(200);
});

// DAILY REMINDER at 10:30 AM IST (5:00 AM UTC)
setInterval(async () => {
  const now = new Date();
  const istHour = (now.getUTCHours() + 5) % 24;
  const istMin = now.getUTCMinutes() + 30;
  if (istHour === 10 && istMin >= 30 && istMin < 31) {
    for (let num in tasks) {
      if (tasks[num].status === "pending") {
        await sendWhatsApp(num, `🔔 *Seva Reminder*\n📌 Task: *${tasks[num].task}*\n\nHave you completed it?\nReply YES/NO`);
      }
    }
  }
}, 60 * 1000);

app.get('/', (req,res)=> res.send('VOICE Seva Setu Bot Running'));
app.listen(3000, ()=> console.log('Bot running'));
