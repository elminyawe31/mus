// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/clearqueue.js — مسح القائمة بالكامل (alias لـ clear)
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearqueue')
        .setDescription('Clear the entire queue')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['cq', 'clearq'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ لا يوجد قائمة انتظار.', ephemeral: true });
        }
        const count = player.queue.length;
        // ✅ v26.4: clearQueue() المدمجة تحفظ الحالة (كانت الأغاني تعود بعد إعادة التشغيل)
        if (typeof player.clearQueue === 'function') player.clearQueue();
        else { player.queue = []; player.scheduleStatePersist?.('cmd-clearqueue', 0); }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🧹 Queue Cleared')
            .setDescription(`تم مسح **${count}** أغنية من القائمة.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) return message.reply('❌ لا يوجد قائمة انتظار.');
        const count = player.queue.length;
        // ✅ v26.4: نفس إصلاح وضع slash
        if (typeof player.clearQueue === 'function') player.clearQueue();
        else { player.queue = []; player.scheduleStatePersist?.('cmd-clearqueue', 0); }
        await message.reply(`🧹 تم مسح **${count}** أغنية.`);
    },
};
