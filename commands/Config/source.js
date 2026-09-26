// ═══════════════════════════════════════════════════════════════════════════
//  commands/Config/source.js — عرض معلومات البوت ومصدر الكود
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('source')
        .setDescription('Show bot source code info and links'),

    aliases: ['src', 'repo', 'github'],

    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`📂 ${config.bot.name} — Source Code`)
            .setDescription(`${config.info.description}`)
            .addFields(
                { name: '👨‍💻 Developer', value: `[${config.info.developer}](https://github.com/elminyawe31)`, inline: true },
                { name: '📦 Version', value: `v${config.bot.version}`, inline: true },
                { name: '🔗 GitHub', value: `[elminyawe31/mus](${config.bot.github})`, inline: true },
                { name: '💬 Support', value: `[Discord Server](${config.info.support})`, inline: true },
                { name: '⚙️ Tech Stack', value: 'Discord.js 14 • Node.js 22 • Canvas • yt-dlp • ytmp3 API', inline: false }
            )
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setLabel('📂 GitHub').setStyle(ButtonStyle.Link).setURL(config.bot.github),
                new ButtonBuilder().setLabel('💬 Support').setStyle(ButtonStyle.Link).setURL(config.info.support),
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async executePrefix(message, args, client) {
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`📂 ${config.bot.name} — Source`)
            .setDescription(`**Developer:** ${config.info.developer}\n**Version:** v${config.bot.version}\n**GitHub:** [elminyawe31/mus](${config.bot.github})`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    },
};
