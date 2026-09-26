// ═══════════════════════════════════════════════════════════════════════════
//  commands/Information/stats.js — إحصائيات البوت الكاملة
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Show detailed bot statistics'),

    aliases: ['statistics', 'stat'],

    async execute(interaction, client) {
        const uptime = process.uptime();
        const mem = process.memoryUsage();
        const guildCount = client.guilds.cache.size;
        const userCount = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const channelCount = client.channels.cache.size;
        const commandCount = client.commands.size;

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`📊 ${config.bot.name} v${config.bot.version} — Statistics`)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '🏠 Servers', value: `\`${guildCount}\``, inline: true },
                { name: '👥 Users', value: `\`${userCount.toLocaleString()}\``, inline: true },
                { name: '💬 Channels', value: `\`${channelCount}\``, inline: true },
                { name: '📋 Commands', value: `\`${commandCount}\``, inline: true },
                { name: '🎵 Active Players', value: `\`${client.players.size}\``, inline: true },
                { name: '🤖 Shards', value: `\`${client.shard?.count ?? 1}\``, inline: true },
                { name: '💾 Memory', value: `\`${(mem.rss / 1024 / 1024).toFixed(2)} MB\``, inline: true },
                { name: '⚡ API Latency', value: `\`${Math.round(client.ws.ping)}ms\``, inline: true },
                { name: '🟢 Status', value: client.ws.status === 0 ? 'Connected' : 'Disconnected', inline: true },
                { name: '⏱️ Uptime', value: `\`${formatUptime(uptime)}\``, inline: false },
                { name: '👨‍💻 Developer', value: `${config.info.developer}`, inline: true },
                { name: '📅 Started', value: `<t:${Math.floor(config.env.startTime / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const uptime = process.uptime();
        const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);
        const guilds = client.guilds.cache.size;
        const users = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`📊 ${config.bot.name} Stats`)
            .addFields(
                { name: '🏠 Servers', value: `\`${guilds}\``, inline: true },
                { name: '👥 Users', value: `\`${users}\``, inline: true },
                { name: '💾 Memory', value: `\`${mem} MB\``, inline: true },
                { name: '⏱️ Uptime', value: `\`${formatUptime(uptime)}\``, inline: false }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
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
