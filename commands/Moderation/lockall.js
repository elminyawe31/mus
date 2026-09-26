// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/lockall.js — قفل كل القنوات النصية
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockall')
        .setDescription('Lock all text channels in the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    aliases: ['la', 'lockdownall'],

    async execute(interaction, client) {
        await interaction.deferReply();
        const channels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        let locked = 0;
        for (const [, channel] of channels) {
            try {
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
                locked++;
            } catch (e) {}
        }
        const embed = new EmbedBuilder()
            .setColor('#FF8800')
            .setTitle('🔒 All Channels Locked')
            .setDescription(`تم قفل **${locked}** قناة نصية.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تملك الصلاحية.');
        const channels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        let locked = 0;
        for (const [, channel] of channels) {
            try { await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }); locked++; } catch (e) {}
        }
        await message.reply(`🔒 تم قفل **${locked}** قناة.`);
    },
};
