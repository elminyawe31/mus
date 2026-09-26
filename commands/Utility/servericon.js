// ═══════════════════════════════════════════════════════════════════════════
//  commands/Utility/servericon.js — عرض أيقونة السيرفر
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('servericon')
        .setDescription('Show the server icon'),

    aliases: ['sicon', 'svicon', 'srvicon'],

    async execute(interaction, client) {
        const guild = interaction.guild;
        if (!guild.icon) {
            return interaction.reply({ content: '❌ هذا السيرفر ليس لديه أيقونة.', ephemeral: true });
        }
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🖼️ ${guild.name}'s Icon`)
            .setImage(guild.iconURL({ size: 1024, extension: 'png' }))
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const guild = message.guild;
        if (!guild.icon) return message.reply('❌ لا يوجد أيقونة.');
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🖼️ ${guild.name}'s Icon`)
            .setImage(guild.iconURL({ size: 1024, extension: 'png' }))
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    },
};
