// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/lock.js — قفل القناة (منع الكتابة)
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock the current channel (prevent messages)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    aliases: ['lockdown', 'قفل'],

    async execute(interaction, client) {
        const channel = interaction.channel;
        if (channel.type !== ChannelType.GuildText) {
            return interaction.reply({ content: '❌ يعمل فقط على القنوات النصية.', ephemeral: true });
        }
        try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: false,
            });
            const embed = new EmbedBuilder()
                .setColor('#FF8800')
                .setTitle('🔒 Channel Locked')
                .setDescription(`تم قفل ${channel} — لا يمكن للأعضاء الكتابة الآن.`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({ content: `❌ فشل: ${err.message}`, ephemeral: true });
        }
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ ليس لديك صلاحية `Manage Channels`.');
        }
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                SendMessages: false,
            });
            const embed = new EmbedBuilder()
                .setColor('#FF8800')
                .setTitle('🔒 Locked')
                .setDescription(`تم قفل ${message.channel}.`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await message.reply({ embeds: [embed] });
        } catch (err) {
            await message.reply(`❌ فشل: ${err.message}`);
        }
    },
};
