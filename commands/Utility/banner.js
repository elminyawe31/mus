// ═══════════════════════════════════════════════════════════════════════════
//  commands/Utility/banner.js — عرض banner المستخدم
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription('Show a user\'s banner')
        .addUserOption(opt => opt.setName('user').setDescription('User to view').setRequired(false)),

    aliases: ['bn', 'banr'],

    async execute(interaction, client) {
        const user = interaction.options.getUser('user') || interaction.user;
        const fetchedUser = await client.users.fetch(user.id, { force: true });

        if (!fetchedUser.banner) {
            return interaction.reply({ content: `❌ ${user.username} ليس لديه banner.`, ephemeral: true });
        }

        const bannerUrl = fetchedUser.bannerURL({ size: 1024 });
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🖼️ ${user.username}'s Banner`)
            .setImage(bannerUrl)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const user = message.mentions.users.first() || message.author;
        const fetchedUser = await client.users.fetch(user.id, { force: true });
        if (!fetchedUser.banner) return message.reply('❌ لا يوجد banner.');
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🖼️ ${user.username}'s Banner`)
            .setImage(fetchedUser.bannerURL({ size: 1024 }))
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    },
};
