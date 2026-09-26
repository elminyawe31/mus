// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/hideall.js — إخفاء كل القنوات النصية
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hideall')
        .setDescription('Hide all text channels from @everyone')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    aliases: ['hda', 'hideall'],

    async execute(interaction, client) {
        await interaction.deferReply();
        const channels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        let hidden = 0;
        for (const [, channel] of channels) {
            try {
                await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
                hidden++;
            } catch (e) {}
        }
        const embed = new EmbedBuilder()
            .setColor('#FF8800')
            .setTitle('🙈 All Channels Hidden')
            .setDescription(`تم إخفاء **${hidden}** قناة نصية.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تملك الصلاحية.');
        const channels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        let hidden = 0;
        for (const [, channel] of channels) {
            try { await channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false }); hidden++; } catch (e) {}
        }
        await message.reply(`🙈 تم إخفاء **${hidden}** قناة.`);
    },
};
