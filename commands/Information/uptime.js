// ═══════════════════════════════════════════════════════════════════════════
//  commands/Information/uptime.js — وقت تشغيل البوت
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uptime')
        .setDescription('Show how long the bot has been running'),

    aliases: ['up', 'time'],

    async execute(interaction, client) {
        const uptime = process.uptime();
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏱️ Bot Uptime')
            .setDescription(`البوت يعمل منذ:\n**${formatUptime(uptime)}**`)
            .addFields({ name: '📅 Started', value: `<t:${Math.floor(config.env.startTime / 1000)}:R>`, inline: true })
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        await message.reply(`⏱️ Uptime: **${formatUptime(process.uptime())}**`);
    },
};

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}
