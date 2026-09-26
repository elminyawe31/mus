// ═══════════════════════════════════════════════════════════════════════════
//  commands/Utility/avatar.js — عرض صورة المستخدم
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Show user avatar (yours or someone else\'s)')
        .addUserOption(opt => opt.setName('user').setDescription('User to view avatar').setRequired(false)),

    aliases: ['av', 'pfp', 'صورة'],

    async execute(interaction, client) {
        const user = interaction.options.getUser('user') || interaction.user;
        const sizes = [1024, 512, 256, 128];

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🖼️ ${user.tag}'s Avatar`)
            .setDescription(sizes.map(s => `[${s}x${s}](${user.displayAvatarURL({ size: s, extension: 'png' })})`).join(' • '))
            .setImage(user.displayAvatarURL({ size: 1024, extension: 'png' }))
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const user = message.mentions.users.first() || message.author;
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🖼️ ${user.tag}'s Avatar`)
            .setImage(user.displayAvatarURL({ size: 1024, extension: 'png' }))
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    },
};
