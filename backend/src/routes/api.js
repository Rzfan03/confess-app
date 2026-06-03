import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createConfession, getConfession } from '../db.js';
import { waService } from '../services/whatsapp.js';

const router = Router();

router.post('/confess', async (req, res) => {
  try {
    const { senderName, crushName, message, contactValue } = req.body;

    if (!crushName || !message || !contactValue) {
      return res.status(400).json({ error: 'Nama crush, pesan, dan nomor WA wajib diisi' });
    }

    const id = uuidv4().slice(0, 8).toUpperCase();

    const confession = createConfession({
      id,
      senderName: senderName || 'Anonim',
      crushName,
      message,
      contactType: 'wa',
      contactValue,
    });

    const text = `Hai ${crushName}! 💌\n\nSeseorang yang peduli sama kamu titip pesan ini:\n\n"${message}"\n\n— ${senderName || 'Anonim'}`;

    let sendStatus = 'pending';
    let sendError = null;

    try {
      await waService.sendMessage(contactValue, text);
      const { markSent } = await import('../db.js');
      markSent(id);
      sendStatus = 'sent';
    } catch (sendErr) {
      sendError = sendErr.message;
      sendStatus = sendError.includes('belum siap') ? 'pending' : 'failed';
      const { markFailed } = await import('../db.js');
      markFailed(id, sendError);
    }

    res.json({
      success: true,
      id: confession.id,
      status: sendStatus,
      errorMessage: sendError,
      createdAt: confession.created_at,
      message: sendStatus === 'sent'
        ? 'Pesan berhasil dikirim ke crush kamu! 💌'
        : sendStatus === 'pending'
          ? 'Pesan akan dikirim setelah WhatsApp terhubung. Simpan ID untuk cek status.'
          : 'Pesan gagal dikirim. Cek detail di bawah.',
    });
  } catch (err) {
    console.error('POST /api/confess error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

router.get('/status/:id', (req, res) => {
  try {
    const confession = getConfession(req.params.id.toUpperCase());
    if (!confession) {
      return res.status(404).json({ error: 'ID tidak ditemukan' });
    }
    res.json({
      id: confession.id,
      senderName: confession.sender_name,
      crushName: confession.crush_name,
      contactValue: confession.contact_value,
      status: confession.status,
      errorMessage: confession.error_message,
      createdAt: confession.created_at,
      sentAt: confession.sent_at,
    });
  } catch (err) {
    console.error('GET /api/status error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

router.get('/wa-status', (req, res) => {
  res.json(waService.getStatus());
});

router.get('/qr', (req, res) => {
  const status = waService.getStatus();
  if (status.ready) {
    return res.send(`<html><head><meta http-equiv="refresh" content="5"></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fafafa"><div style="text-align:center"><h2 style="color:#059669">✅ WhatsApp sudah terhubung!</h2><p style="color:#666">Bisa kirim pesan sekarang.</p></div></body></html>`);
  }
  if (status.hasQr) {
    return res.send(`<html><head><meta http-equiv="refresh" content="30"></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fafafa;flex-direction:column;margin:0;padding:20px"><h2 style="margin-bottom:20px;color:#333;font-size:24px">Scan QR ini dengan WhatsApp</h2><img src="${status.qrCode}" alt="QR Code" style="border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.12);max-width:300px;width:100%"/><p style="margin-top:24px;color:#999;font-size:14px;text-align:center">Buka WhatsApp > Perangkat Tertaut ><br>Tautkan Perangkat</p><p style="color:#bbb;font-size:12px;margin-top:12px">Halaman auto-refresh tiap 30 detik</p></body></html>`);
  }
  res.send(`<html><head><meta http-equiv="refresh" content="3"></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fafafa"><div style="text-align:center"><h2 style="color:#d97706">⏳ Menyiapkan WhatsApp...</h2><p style="color:#666">Tunggu sebentar, halaman akan refresh otomatis.</p></div></body></html>`);
});

export default router;
