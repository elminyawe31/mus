// ═══════════════════════════════════════════════════════════════════════════
//  commands/Utility/serverinfo.js — معلومات السيرفر
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Display info about the current server'),

    aliases: ['si', 'server', 'سيرفر'],

    async execute(interaction, client) {
        const guild = interaction.guild;
        const owner = await guild.fetchOwner().catch(() => null);

        const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
        const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
        const roles = guild.roles.cache.size;

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🏰 ${guild.name}`)
            .setThumbnail(guild.iconURL({ size: 256 }))
            .addFields(
                { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
                { name: '👑 Owner', value: owner ? `<@${owner.id}>` : 'Unknown', inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '👥 Members', value: `\`${guild.memberCount}\``, inline: true },
                { name: '💬 Text Channels', value: `\`${textChannels}\``, inline: true },
                { name: '🔊 Voice Channels', value: `\`${voiceChannels}\``, inline: true },
                { name: '📁 Categories', value: `\`${categories}\``, inline: true },
                { name: '🎭 Roles', value: `\`${roles}\``, inline: true },
                { name: '💎 Boost Level', value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount} boosts)`, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const guild = message.guild;
        const owner = await guild.fetchOwner().catch(() => null);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🏰 ${guild.name}`)
            .setThumbnail(guild.iconURL({ size: 256 }))
            .addFields(
                { name: '🆔 ID', value: `\`${guild.id}\``, inline: true },
                { name: '👑 Owner', value: owner ? `<@${owner.id}>` : 'Unknown', inline: true },
                { name: '👥 Members', value: `\`${guild.memberCount}\``, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    },
};
