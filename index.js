const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// طباعة الـ QR Code في الـ Logs لتسهيل الفحص من Railway
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// رسالة التأكيد عند الاتصال
client.on('ready', () => {
    console.log('تم الاتصال بنجاح! البوت جاهز للعمل داخل المجموعات.');
});

// معالجة الرسائل القادمة من المجموعات
client.on('message', async (msg) => {
    try {
        const chat = await msg.getChat();

        // التأكد من أن الرسالة أُرسلت داخل مجموعة
        if (chat.isGroup) {
            if (msg.body === '!اوامر') {
                await msg.reply('قائمة الأوامر المتاحة:\n1. !اوامر - عرض الأوامر\n2. !منشئ - معلومات البوت');
            } else if (msg.body === '!منشئ') {
                await msg.reply('تم إنشاء هذا البوت بواسطة الفريق.');
            }
        }
    } catch (err) {
        console.error('حدث خطأ أثناء معالجة الرسالة:', err);
    }
});

client.initialize();
