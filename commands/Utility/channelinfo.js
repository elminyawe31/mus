// ═══════════════════════════════════════════════════════════════════════════
//  commands/Utility/channelinfo.js — معلومات القناة
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channelinfo')
        .setDescription('Show info about the current channel'),

    aliases: ['ci', 'channel'],

    async execute(interaction, client) {
        const channel = interaction.channel;
        const typeNames = {
            [ChannelType.GuildText]: 'Text',
            [ChannelType.GuildVoice]: 'Voice',
            [ChannelType.GuildCategory]: 'Category',
            [ChannelType.GuildAnnouncement]: 'Announcement',
            [ChannelType.GuildStage]: 'Stage',
        };

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`💬 #${channel.name}`)
            .addFields(
                { name: '🆔 ID', value: `\`${channel.id}\``, inline: true },
                { name: '📋 Type', value: typeNames[channel.type] || 'Unknown', inline: true },
                { name: '📁 Category', value: channel.parent ? channel.parent.name : 'None', inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '📍 Position', value: `\`${channel.position}\``, inline: true },
                { name: '🔞 NSFW', value: channel.nsfw ? 'Yes' : 'No', inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const channel = message.channel;
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`💬 #${channel.name}`)
            .addFields(
                { name: '🆔 ID', value: `\`${channel.id}\``, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '📍 Position', value: `\`${channel.position}\``, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    },
};
