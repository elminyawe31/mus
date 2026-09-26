// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/hide.js — إخفاء قناة عن @everyone
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hide')
        .setDescription('Hide the current channel from @everyone')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    aliases: ['hd', 'اخفاء'],

    async execute(interaction, client) {
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                ViewChannel: false,
            });
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('🙈 Channel Hidden')
                .setDescription(`تم إخفاء ${interaction.channel} عن @everyone.`)
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
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false });
            await message.reply('🙈 تم إخفاء القناة.');
        } catch (err) {
            await message.reply(`❌ فشل: ${err.message}`);
        }
    },
};
