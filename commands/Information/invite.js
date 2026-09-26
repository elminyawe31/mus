// ═══════════════════════════════════════════════════════════════════════════
//  commands/invite.js — رابط دعوة البوت لسيرفرات أخرى
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Get the bot invite link to add it to your server'),

    aliases: ['add', 'join', 'دعوة'],

    async execute(interaction, client) {
        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=36718592&scope=bot%20applications.commands`;

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`➕ Invite ${config.bot.name}`)
            .setDescription(`أضف **${config.bot.name}** إلى سيرفرك الآن!\n\nاستمتع بموسيقى عالية الجودة من YouTube و Spotify و SoundCloud.`)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '🔗 Invite URL', value: `[اضغط هنا للدعوة](${inviteUrl})`, inline: false },
                { name: '📂 GitHub', value: `[elminyawe31/mus](https://github.com/elminyawe31/mus)`, inline: true },
                { name: '💬 Support', value: `[Discord Server](https://discord.gg/2yJ7Uh5EtS)`, inline: true },
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('➕ Add to Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL(inviteUrl),
                new ButtonBuilder()
                    .setLabel('📂 GitHub')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://github.com/elminyawe31/mus'),
                new ButtonBuilder()
                    .setLabel('💬 Support')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://discord.gg/2yJ7Uh5EtS'),
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async executePrefix(message, args, client) {
        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=36718592&scope=bot%20applications.commands`;

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`➕ Invite ${config.bot.name}`)
            .setDescription(`أضف **${config.bot.name}** إلى سيرفرك الآن!\n\nاستمتع بموسيقى عالية الجودة من YouTube و Spotify و SoundCloud.`)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '🔗 Invite URL', value: `[اضغط هنا للدعوة](${inviteUrl})`, inline: false },
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('➕ Add to Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL(inviteUrl),
            );

        await message.reply({ embeds: [embed], components: [row] });
    },
};
