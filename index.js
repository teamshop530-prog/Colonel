const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = { GoogleGenerativeAI: require('@google/generative-ai').GoogleGenerativeAI };

const OWNER_JID = '201066396249@c.us'; // ضع رقمك هنا بصيغة دولية
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

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

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('تم الاتصال بنجاح! البوت جاهز ومحمي.');
});

// فحص الألفاظ السيئة عبر الذكاء الاصطناعي
async function checkProfanityWithAI(text) {
    if (!genAI || !text) return false;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Evaluate if the following text contains explicit severe profanity, hate speech, or harsh insults in ANY language. Respond strictly with "YES" or "NO". Text: "${text}"`;
        const result = await model.generateContent(prompt);
        return result.response.text().trim().toUpperCase().includes("YES");
    } catch (e) {
        console.error("AI Error:", e);
        return false;
    }
}

// جلب تفاصيل المود من Modrinth
async function fetchModrinthMod(query) {
    try {
        const searchRes = await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=1`);
        const searchData = await searchRes.json();
        
        if (!searchData.hits || searchData.hits.length === 0) return null;

        const mod = searchData.hits[0];
        const projectRes = await fetch(`https://api.modrinth.com/v2/project/${mod.project_id}`);
        const projectData = await projectRes.json();

        let imageUrl = null;
        if (projectData.gallery && projectData.gallery.length > 0) {
            imageUrl = projectData.gallery[0].url;
        } else if (projectData.icon_url) {
            imageUrl = projectData.icon_url;
        }

        return {
            title: projectData.title,
            description: projectData.description,
            downloads: projectData.downloads,
            link: `https://modrinth.com/${projectData.project_type}/${projectData.slug}`,
            imageUrl: imageUrl
        };
    } catch (e) {
        return null;
    }
}

client.on('message', async (msg) => {
    try {
        const chat = await msg.getChat();
        if (!chat.isGroup) return;

        const senderId = msg.author || msg.from;
        const body = msg.body;
        const senderContact = await client.getContactById(senderId);
        const senderName = senderContact.pushname || senderContact.number;

        // 1. التعامل مع روابط الواتساب (حذف وإرسال تقرير خاص)
        const waLinkRegex = /(chat\.whatsapp\.com\/|wa\.me\/)/i;
        if (waLinkRegex.test(body)) {
            await msg.delete(true);
            await chat.sendMessage('تم حذف رابط واتساب من الرسالة.');
            
            // إرسال تقرير للمالك على الخاص
            await client.sendMessage(OWNER_JID, `🚨 *تقرير حذف رابط*\n- *المجموعة:* ${chat.name}\n- *المستخدم:* ${senderName} (${senderId})\n- *الرسالة المحذوفة:* ${body}`);
            return;
        }

        // 2. كشف الشتايم وطرد العضو وإرسال تقرير
        const isBad = await checkProfanityWithAI(body);
        if (isBad) {
            await msg.delete(true);
            await chat.removeParticipants([senderId]);
            await chat.sendMessage(`تم طرد العضو ${senderName} بسبب إرسال ألفاظ غير لائقة.`);
            
            // إرسال تقرير للمالك على الخاص
            await client.sendMessage(OWNER_JID, `🚫 *تقرير طرد عضو*\n- *المجموعة:* ${chat.name}\n- *المستخدم المطرود:* ${senderName} (${senderId})\n- *السبب:* إرسال ألفاظ سيئة\n- *الرسالة:* ${body}`);
            return;
        }

        // 3. نظام الأوامر (مقتصر على المالك فقط)
        if (body.startsWith('!')) {
            if (senderId !== OWNER_JID) {
                await msg.reply('عذراً، الأوامر مقتصرة على المالك فقط.');
                return;
            }

            if (body.startsWith('!مود ')) {
                const modName = body.replace('!مود ', '').trim();
                if (!modName) {
                    await msg.reply('يرجى تحديد اسم المود.');
                    return;
                }

                const modInfo = await fetchModrinthMod(modName);
                if (!modInfo) {
                    await msg.reply('لم يتم العثور على المود.');
                    return;
                }

                const responseText = `📌 *اسم المود:* ${modInfo.title}\n📝 *الوصف:* ${modInfo.description}\n📥 *التحميلات:* ${modInfo.downloads}\n🔗 *الرابط:* ${modInfo.link}`;

                if (modInfo.imageUrl) {
                    const media = await MessageMedia.fromUrl(modInfo.imageUrl);
                    await client.sendMessage(chat.id._serialized, media, { caption: responseText });
                } else {
                    await msg.reply(responseText);
                }
            } else if (body === '!اوامر') {
                await msg.reply('الأوامر المتاحة:\n- !مود [اسم المود]');
            }
        }
    } catch (err) {
        console.error('Error handling message:', err);
    }
});

client.initialize();
