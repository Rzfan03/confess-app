import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';
import { waService } from './services/whatsapp.js';
import { getPendingConfessions, markSent, markFailed } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function retryPending() {
  const pending = getPendingConfessions();
  if (pending.length === 0) return;

  console.log(`[RETRY] Mengirim ulang ${pending.length} pesan pending...`);

  for (const p of pending) {
    const text = `Hai ${p.crush_name}! 💌\n\nSeseorang yang peduli sama kamu titip pesan ini:\n\n"${p.message}"\n\n— ${p.sender_name || 'Anonim'}`;

    try {
      await waService.sendMessage(p.contact_value, text);
      markSent(p.id);
      console.log(`[RETRY] ✓ ${p.id} terkirim ke ${p.contact_value}`);
    } catch (err) {
      markFailed(p.id, err.message);
      console.log(`[RETRY] ✗ ${p.id} gagal: ${err.message}`);
    }
  }
}

let waRetries = 0;

async function initWA() {
  try {
    await waService.initialize();
    waRetries = 0;
    retryPending();
  } catch {
    waRetries++;
    const delay = Math.min(3000 * waRetries, 15000);
    console.error(`[WA] Init gagal (${waRetries}x). Coba lagi ${delay / 1000}s...`);
    setTimeout(initWA, delay);
  }
}

setInterval(() => {
  if (waService.ready) retryPending();
}, 10000);

app.listen(PORT, () => {
  console.log(`[BISIK] Server running on http://localhost:${PORT}`);
  initWA();
});
