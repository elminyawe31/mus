// ═══════════════════════════════════════════════════════════════════════════
//  commands/info.js — معلومات البوت الكاملة + بصمة المطور
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Show detailed bot information and stats'),

    aliases: ['i', 'stats', 'botinfo', 'معلومات'],

    async execute(interaction, client) {
        const uptime = process.uptime();
        const uptimeStr = formatUptime(uptime);

        const guildCount = client.guilds.cache.size;
        const memoryUsage = process.memoryUsage();
        const memoryMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🎵 ${config.bot.name} — Bot Info`)
            .setDescription(config.info.description)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                {
                    name: '🤖 Bot',
                    value: [
                        `**Name:** ${config.bot.name}`,
                        `**Version:** v${config.bot.version}`,
                        `**ID:** \`${client.user.id}\``,
                        `**Tag:** ${client.user.tag}`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '👨‍💻 Developer',
                    value: [
                        `**Dev:** ${config.info.developer}`,
                        `**GitHub:** [elminyawe31](https://github.com/elminyawe31)`,
                        `**Repo:** [MUS](https://github.com/elminyawe31/mus)`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '📊 Stats',
                    value: [
                        `**Servers:** ${guildCount}`,
                        `**Shards:** ${client.shard?.count ?? 1}`,
                        `**Active Players:** ${client.players.size}`,
                        `**Memory:** ${memoryMB} MB`,
                        `**Uptime:** ${uptimeStr}`,
                        `**Node.js:** ${process.version}`,
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: '✨ Features',
                    value: [
                        '🎵 YouTube + Spotify + SoundCloud',
                        '🎬 Hybrid Commands (Slash + Prefix)',
                        '🍪 Smart Cookies Auto-Refresh',
                        '🛡️ PO Token (bgutil) Bypass',
                        '🌐 IPv6 Native Support',
                        '📡 23 Languages Supported',
                        '🎙️ Audio Filters (Bass, Nightcore, etc.)',
                        '📊 Live Now Playing Cards',
                        '🔄 Loop & Autoplay Modes',
                        '📋 Queue Management',
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: '🌍 Environment',
                    value: [
                        `**Platform:** ${config.env.platform}`,
                        `**Mode:** ${config.env.connectionMode}`,
                        `**IPv6:** ${config.env.ipv6Available ? '✅ Enabled' : '❌ Disabled'}`,
                        `**Railway:** ${config.env.isRailway ? '✅ Yes' : '❌ No'}`,
                    ].join('\n'),
                    inline: true,
                }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('📂 GitHub')
                    .setStyle(ButtonStyle.Link)
                    .setURL(config.bot.github),
                new ButtonBuilder()
                    .setLabel('💬 Support')
                    .setStyle(ButtonStyle.Link)
                    .setURL(config.bot.supportServer),
                new ButtonBuilder()
                    .setLabel('➕ Invite Bot')
                    .setStyle(ButtonStyle.Link)
                    .setURL(config.bot.invite),
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async executePrefix(message, args, client) {
        const uptime = process.uptime();
        const uptimeStr = formatUptime(uptime);
        const guildCount = client.guilds.cache.size;
        const memoryMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🎵 ${config.bot.name} — Bot Info`)
            .setDescription(config.info.description)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                {
                    name: '🤖 Bot',
                    value: [
                        `**Name:** ${config.bot.name}`,
                        `**Version:** v${config.bot.version}`,
                        `**Tag:** ${client.user.tag}`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '👨‍💻 Developer',
                    value: [
                        `**Dev:** ${config.info.developer}`,
                        `**GitHub:** elminyawe31/mus`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '📊 Stats',
                    value: [
                        `**Servers:** ${guildCount}`,
                        `**Active Players:** ${client.players.size}`,
                        `**Memory:** ${memoryMB} MB`,
                        `**Uptime:** ${uptimeStr}`,
                        `**Node.js:** ${process.version}`,
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: '✨ Features',
                    value: [
                        '🎵 YouTube + Spotify + SoundCloud',
                        '🎬 Hybrid Commands (Slash + Prefix)',
                        '🍪 Smart Cookies Auto-Refresh',
                        '🛡️ PO Token (bgutil) Bypass',
                        '🌐 IPv6 Native Support',
                        '📡 23 Languages',
                        '🔄 Loop & Autoplay',
                        '📋 Queue Management',
                    ].join('\n'),
                    inline: false,
                }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
}
