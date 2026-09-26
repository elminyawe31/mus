// ═══════════════════════════════════════════════════════════════════════════
//  commands/Utility/boostcount.js — عرض عدد الـ boosts
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('boostcount')
        .setDescription('Show the server boost count and level'),

    aliases: ['bc', 'boosts'],

    async execute(interaction, client) {
        const guild = interaction.guild;
        const embed = new EmbedBuilder()
            .setColor('#FF73FA')
            .setTitle(`💎 ${guild.name} Boosts`)
            .addFields(
                { name: '📊 Boost Count', value: `\`${guild.premiumSubscriptionCount}\``, inline: true },
                { name: '🏆 Boost Level', value: `\`Level ${guild.premiumTier}\``, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const guild = message.guild;
        await message.reply(`💎 **${guild.name}** — Level ${guild.premiumTier} • ${guild.premiumSubscriptionCount} boosts`);
    },
};
