// ═══════════════════════════════════════════════════════════════════════════
//  commands/Information/support.js — رابط سيرفر الدعم
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('support')
        .setDescription('Get the support server link'),

    aliases: ['sup', 'help-server', 'دعم'],

    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('💬 Support Server')
            .setDescription(`انضم لسيرفر الدعم لـ **${config.bot.name}**!\nاحصل على مساعدة، تحديثات، وإعلانات.`)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('💬 Join Support')
                    .setStyle(ButtonStyle.Link)
                    .setURL(config.info.support),
                new ButtonBuilder()
                    .setLabel('📂 GitHub')
                    .setStyle(ButtonStyle.Link)
                    .setURL(config.bot.github),
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async executePrefix(message, args, client) {
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('💬 Support')
            .setDescription(`انضم: ${config.info.support}`)
            .setFooter({ text: config.bot.signature });
        await message.reply({ embeds: [embed] });
    },
};
