// ═══════════════════════════════════════════════════════════════════════════
//  commands/clear.js — مسح قائمة الانتظار (بدون إيقاف التشغيل الحالي)
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear the queue (keeps the current song playing)'),

    aliases: ['cl', 'clr', 'مسح'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ لا يوجد قائمة انتظار.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        const removedCount = player.queue.length;
        // ✅ v26.4: clearQueue() المدمجة تحفظ الحالة — الكود القديم (queue = [])
        // كان يجعل الأغاني تعود بعد إعادة التشغيل
        if (typeof player.clearQueue === 'function') player.clearQueue();
        else { player.queue = []; player.scheduleStatePersist?.('cmd-clear', 0); }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🧹 Queue Cleared')
            .setDescription(`تم مسح **${removedCount}** أغنية من القائمة.\n🎵 الأغنية الحالية تستمر في التشغيل.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) {
            return message.reply('❌ لا يوجد قائمة انتظار.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        const removedCount = player.queue.length;
        // ✅ v26.4: نفس إصلاح وضع slash
        if (typeof player.clearQueue === 'function') player.clearQueue();
        else { player.queue = []; player.scheduleStatePersist?.('cmd-clear', 0); }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🧹 Queue Cleared')
            .setDescription(`تم مسح **${removedCount}** أغنية من القائمة.\n🎵 الأغنية الحالية تستمر في التشغيل.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
