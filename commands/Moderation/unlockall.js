// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/unlockall.js — فتح كل القنوات النصية
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlockall')
        .setDescription('Unlock all text channels in the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    aliases: ['ula', 'unlockdown'],

    async execute(interaction, client) {
        await interaction.deferReply();
        const channels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        let unlocked = 0;
        for (const [, channel] of channels) {
            try {
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
                unlocked++;
            } catch (e) {}
        }
        const embed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('🔓 All Channels Unlocked')
            .setDescription(`تم فتح **${unlocked}** قناة نصية.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تملك الصلاحية.');
        const channels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        let unlocked = 0;
        for (const [, channel] of channels) {
            try { await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }); unlocked++; } catch (e) {}
        }
        await message.reply(`🔓 تم فتح **${unlocked}** قناة.`);
    },
};
