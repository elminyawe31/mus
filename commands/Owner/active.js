// ═══════════════════════════════════════════════════════════════════════════
//  commands/Owner/active.js — عرض السيرفرات النشطة بالبوت
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('active')
        .setDescription('Show servers where the bot is actively playing music (owner only)'),

    aliases: ['act', 'activeplayers'],

    async execute(interaction, client) {
        if (interaction.user.id !== config.info.developerId) {
            return interaction.reply({ content: '❌ هذا الأمر للمطور فقط.', ephemeral: true });
        }

        const activePlayers = Array.from(client.players.entries());
        if (activePlayers.length === 0) {
            return interaction.reply({ content: '📭 لا يوجد أي مشغّل نشط حالياً.', ephemeral: true });
        }

        let listText = '';
        activePlayers.forEach(([guildId, player], i) => {
            const guild = client.guilds.cache.get(guildId);
            const guildName = guild?.name || 'Unknown';
            const track = player.currentTrack?.title || 'N/A';
            listText += `\`${i + 1}.\` **${guildName}** — \`${track.substring(0, 40)}\`\n`;
        });

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🎵 Active Players (${activePlayers.length})`)
            .setDescription(listText)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async executePrefix(message, args, client) {
        if (message.author.id !== config.info.developerId) return message.reply('❌ للمطور فقط.');
        const active = Array.from(client.players.entries());
        if (active.length === 0) return message.reply('📭 لا يوجد مشغّل نشط.');
        let list = active.map(([gid, p], i) => `\`${i+1}.\` ${client.guilds.cache.get(gid)?.name} — ${p.currentTrack?.title || 'N/A'}`).join('\n');
        await message.reply(`🎵 **Active (${active.length}):**\n${list}`);
    },
};
