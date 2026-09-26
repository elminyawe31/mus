// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/unlock.js — فتح القناة
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    aliases: ['فتح'],

    async execute(interaction, client) {
        const channel = interaction.channel;
        try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: null,
            });
            const embed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle('🔓 Channel Unlocked')
                .setDescription(`تم فتح ${channel} — يمكن للأعضاء الكتابة الآن.`)
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
                SendMessages: null,
            });
            const embed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle('🔓 Unlocked')
                .setDescription(`تم فتح ${message.channel}.`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await message.reply({ embeds: [embed] });
        } catch (err) {
            await message.reply(`❌ فشل: ${err.message}`);
        }
    },
};
