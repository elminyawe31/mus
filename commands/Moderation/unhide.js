// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/unhide.js — إظهار قناة مخفية
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unhide')
        .setDescription('Unhide the current channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    aliases: ['uh', 'إظهار'],

    async execute(interaction, client) {
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                ViewChannel: null,
            });
            const embed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle('👁️ Channel Unhidden')
                .setDescription(`تم إظهار ${interaction.channel} للجميع.`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({ content: `❌ فشل: ${err.message}`, ephemeral: true });
        }
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تملك الصلاحية.');
        try {
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: null });
            await message.reply('👁️ تم إظهار القناة.');
        } catch (err) {
            await message.reply(`❌ فشل: ${err.message}`);
        }
    },
};
