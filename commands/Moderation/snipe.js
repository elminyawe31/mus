// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/snipe.js — عرض آخر رسالة محذوفة
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

// مخزن الرسائل المحذوفة (مؤقت، يُمسح عند إعادة التشغيل)
if (!global.snipeMap) global.snipeMap = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Show the last deleted message in this channel'),

    aliases: ['sn', 'سنايب'],

    async execute(interaction, client) {
        const channelId = interaction.channel.id;
        const sniped = global.snipeMap.get(channelId);

        if (!sniped) {
            return interaction.reply({ content: '📭 لا توجد رسائل محذوفة حديثة في هذه القناة.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🎯 Sniped Message')
            .setAuthor({ name: sniped.author, iconURL: sniped.avatar })
            .setDescription(sniped.content || '*[no text content]*')
            .addFields(
                { name: '👤 Author', value: `<@${sniped.authorId}>`, inline: true },
                { name: '⏰ Deleted at', value: `<t:${Math.floor(sniped.timestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        if (sniped.image) embed.setImage(sniped.image);

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const sniped = global.snipeMap.get(message.channel.id);
        if (!sniped) return message.reply('📭 لا توجد رسائل محذوفة حديثة.');

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🎯 Sniped')
            .setAuthor({ name: sniped.author, iconURL: sniped.avatar })
            .setDescription(sniped.content || '*[no text content]*')
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        if (sniped.image) embed.setImage(sniped.image);
        await message.reply({ embeds: [embed] });
    },
};
