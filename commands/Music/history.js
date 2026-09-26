// ═══════════════════════════════════════════════════════════════════════════
//  commands/history.js — عرض الأغانيات التي عُزلت مؤخراً
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('Show recently played songs'),

    aliases: ['hist', 'recent', 'سجل'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        // ✅ استخدم player.previousTracks (الـ property الصحيح) بدل player.history
        if (!player || !player.previousTracks || player.previousTracks.length === 0) {
            return interaction.reply({ content: '📭 لا يوجد سجل للأغانيات المشغّلة مؤخراً.', ephemeral: true });
        }

        const history = player.previousTracks.slice(-15).reverse();
        let historyText = '';

        history.forEach((track, i) => {
            const title = track.title.length > 50 ? track.title.substring(0, 47) + '...' : track.title;
            historyText += `\`${(i + 1).toString().padStart(2, '0')}.\` [${title}](${track.url}) | \`${formatDuration(track.duration)}\`\n`;
        });

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('📜 Recently Played')
            .setDescription(historyText)
            .setFooter({ text: `${config.bot.signature} • آخر ${history.length} أغنية` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.previousTracks || player.previousTracks.length === 0) {
            return message.reply('📭 لا يوجد سجل للأغانيات المشغّلة مؤخراً.');
        }

        const history = player.previousTracks.slice(-15).reverse();
        let historyText = '';

        history.forEach((track, i) => {
            const title = track.title.length > 50 ? track.title.substring(0, 47) + '...' : track.title;
            historyText += `\`${(i + 1).toString().padStart(2, '0')}.\` [${title}](${track.url}) | \`${formatDuration(track.duration)}\`\n`;
        });

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('📜 Recently Played')
            .setDescription(historyText)
            .setFooter({ text: `${config.bot.signature} • آخر ${history.length} أغنية` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
