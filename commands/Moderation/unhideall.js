// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/unhideall.js — إظهار كل القنوات النصية
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unhideall')
        .setDescription('Unhide all text channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    aliases: ['uha', 'unhideall'],

    async execute(interaction, client) {
        await interaction.deferReply();
        const channels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        let unhidden = 0;
        for (const [, channel] of channels) {
            try {
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: null });
                unhidden++;
            } catch (e) {}
        }
        const embed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('👁️ All Channels Unhidden')
            .setDescription(`تم إظهار **${unhidden}** قناة نصية.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تملك الصلاحية.');
        const channels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        let unhidden = 0;
        for (const [, channel] of channels) {
            try { await channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: null }); unhidden++; } catch (e) {}
        }
        await message.reply(`👁️ تم إظهار **${unhidden}** قناة.`);
    },
};
