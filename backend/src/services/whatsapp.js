import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import { execSync } from 'child_process';

class WhatsAppService {
  constructor() {
    this.client = null;
    this.ready = false;
    this.qrCodeData = null;
    this.initializing = false;
  }

  killOrphanChromium() {
    try {
      execSync('pkill -f "chrome.*--disable-background-networking" 2>/dev/null || true');
    } catch {}
  }

  async initialize() {
    if (this.initializing) return;
    this.initializing = true;
    this.qrCodeData = null;
    this.ready = false;

    this.killOrphanChromium();

    try {
      const chromePath = process.env.CHROME_PATH || '/usr/bin/chromium';

      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
        puppeteer: {
          executablePath: chromePath,
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-software-rasterizer',
          ],
        },
      });

      this.client.on('qr', async (qr) => {
        try {
          this.qrCodeData = await qrcode.toDataURL(qr);
          console.log('[WA] QR code ready. Buka http://localhost:3001/api/qr');
        } catch (qrErr) {
          console.error('[WA] QR encode error:', qrErr.message);
        }
      });

      this.client.on('ready', () => {
        this.ready = true;
        this.qrCodeData = null;
        this.initializing = false;
        console.log('[WA] WhatsApp terhubung!');
      });

      this.client.on('disconnected', (reason) => {
        this.ready = false;
        this.initializing = false;
        console.log('[WA] Disconnected:', reason);
      });

      this.client.on('auth_failure', (msg) => {
        this.ready = false;
        this.initializing = false;
        console.error('[WA] Auth gagal:', msg);
      });

      await this.client.initialize();
    } catch (err) {
      this.initializing = false;
      this.qrCodeData = null;
      console.error('[WA] Init error:', err.message);
      await this.destroy();
      throw err;
    }
  }

  async destroy() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {}
      this.client = null;
    }
  }

  async sendMessage(phoneNumber, message) {
    if (!this.client) throw new Error('WhatsApp belum diinisialisasi');
    if (!this.ready) throw new Error('WhatsApp belum siap. Scan QR code dulu!');

    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    const formatted = cleaned.startsWith('62')
      ? `${cleaned}@c.us`
      : `62${cleaned.replace(/^0+/, '')}@c.us`;

    await this.client.sendMessage(formatted, message);
  }

  getStatus() {
    return {
      ready: this.ready,
      hasQr: !!this.qrCodeData,
      qrCode: this.qrCodeData,
      initializing: this.initializing,
    };
  }
}

export const waService = new WhatsAppService();
