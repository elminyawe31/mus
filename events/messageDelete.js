// ═══════════════════════════════════════════════════════════════════════════
//  events/messageDelete.js — التقاط الرسائل المحذوفة لـ snipe
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message, client) {
        // تجاهل الرسائل الخاصة و DM
        if (!message.guild || message.author?.bot) return;

        // احفظ الرسالة في الـ snipe map
        if (!global.snipeMap) global.snipeMap = new Map();

        const snipeData = {
            content: message.content || '',
            author: message.author.tag,
            authorId: message.author.id,
            avatar: message.author.displayAvatarURL(),
            timestamp: Date.now(),
            image: null,
        };

        // احفظ أول attachment كصورة
        if (message.attachments && message.attachments.size > 0) {
            const firstAttachment = message.attachments.first();
            if (firstAttachment.contentType?.startsWith('image/')) {
                snipeData.image = firstAttachment.url;
            }
        }

        global.snipeMap.set(message.channel.id, snipeData);

        // ابدأ timeout لحذف الـ snipe بعد ساعة (لا نخزّن للأبد)
        setTimeout(() => {
            const current = global.snipeMap.get(message.channel.id);
            if (current && current.timestamp === snipeData.timestamp) {
                global.snipeMap.delete(message.channel.id);
            }
        }, 60 * 60 * 1000); // ساعة
    },
};
