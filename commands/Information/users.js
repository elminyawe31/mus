// ═══════════════════════════════════════════════════════════════════════════
//  commands/Information/users.js — عرض إجمالي المستخدمين الذين يخدمهم البوت
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('users')
        .setDescription('Show total users the bot serves'),

    aliases: ['usrs', 'totalusers'],

    async execute(interaction, client) {
        const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
        const totalServers = client.guilds.cache.size;

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('👥 User Statistics')
            .addFields(
                { name: '🏠 Total Servers', value: `\`${totalServers}\``, inline: true },
                { name: '👥 Total Users', value: `\`${totalUsers.toLocaleString()}\``, inline: true },
                { name: '📊 Avg Users/Server', value: `\`${Math.round(totalUsers / totalServers)}\``, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const total = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
        await message.reply(`👥 Total Users: **${total.toLocaleString()}** across **${client.guilds.cache.size}** servers.`);
    },
};
