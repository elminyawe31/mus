// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/nuke.js — حذف وإعادة إنشاء القناة (تنظيف كامل)
//  MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻
//  ✅ تم إصلاح: لا نستخدم deferReply (لأن القناة ستُحذف قبل editReply)
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('Nuke the current channel (delete and recreate)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    aliases: ['n', 'nukethis', 'قصف'],

    async execute(interaction, client) {
        const channel = interaction.channel;

        // ✅ لا نستخدم deferReply: لأننا سنحذف القناة، والـ reply مرتبط بها
        // احفظ بيانات القناة BEFORE أي reply
        const position = channel.position;
        const topic = channel.topic;
        const nsfw = channel.nsfw;
        const rateLimit = channel.rateLimitPerUser;
        const channelName = channel.name;
        const channelType = channel.type;
        const parentId = channel.parentId;
        const userId = interaction.user.id;
        const userTag = interaction.user.tag;
        const guild = interaction.guild;

        try {
            // احفظ قائمة الـ pinned messages
            const pinned = await channel.messages.fetchPinned().catch(() => ({ size: 0 }));

            // احذف القناة — هذا سيُلغي أي interaction reply معلّقة تلقائياً
            await channel.delete(`Nuke by: ${userTag}`);

            // أنشئ قناة جديدة بنفس الاسم والإعدادات
            const newChannel = await guild.channels.create({
                name: channelName,
                type: channelType,
                parent: parentId,
                position,
                topic,
                nsfw,
                rateLimitPerUser: rateLimit,
            });

            const embed = new EmbedBuilder()
                .setColor('#FF4444')
                .setTitle('💥 Channel Nuked')
                .setDescription(`تم تنظيف القناة بالكامل.\nالقناة القديمة حُذفت وأنشئت جديدة بنفس الإعدادات.`)
                .addFields(
                    { name: '🛡️ By', value: `<@${userId}>`, inline: true },
                    { name: '📍 Position', value: `\`${position}\``, inline: true }
                )
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await newChannel.send({ embeds: [embed] });

            // إعادة تثبيت الـ pinned messages
            if (pinned.size > 0) {
                for (const [, msg] of pinned) {
                    try {
                        if (msg.content) await newChannel.send({ content: msg.content });
                    } catch (e) {}
                }
            }
            // لا نستخدم interaction.reply أو interaction.editReply — القناة الأصلية محذوفة
        } catch (err) {
            console.error('❌ Nuke error:', err.message);
            // لا يمكن الرد على interaction إذا كانت القناة محذوفة — نتجاهل فقط
        }
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ ليس لديك صلاحية `Manage Channels`.');
        }
        const channel = message.channel;
        const position = channel.position;
        const topic = channel.topic;

        try {
            // ✅ استخدم clone بدل الإنشاء اليدوي (أبسط وأسرع)
            const newChannel = await channel.clone({ position, topic });
            await channel.delete(`Nuke by: ${message.author.tag}`);

            const embed = new EmbedBuilder()
                .setColor('#FF4444')
                .setTitle('💥 Nuked')
                .setDescription(`تم تنظيف القناة بواسطة ${message.author}.`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await newChannel.send({ embeds: [embed] });
        } catch (err) {
            console.error('❌ Nuke prefix error:', err.message);
            // القناة قد تكون محذوفة بالفعل، لذا نتجاهل خطأ الـ reply
        }
    },
};
