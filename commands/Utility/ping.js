// ═══════════════════════════════════════════════════════════════════════════
//  commands/ping.js — فحص استجابة البوت
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot latency and response time'),

    aliases: ['pi', 'latency', 'بنج'],

    async execute(interaction, client) {
        const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);

        const status = latency < 100 ? '🟢 ممتاز' : latency < 300 ? '🟡 جيد' : '🔴 بطيء';
        const apiStatus = apiLatency < 100 ? '🟢 ممتاز' : apiLatency < 300 ? '🟡 جيد' : '🔴 بطيء';

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🏓 Pong!')
            .addFields(
                { name: '📡 Bot Latency', value: `\`${latency}ms\` ${status}`, inline: true },
                { name: '🌐 API Latency', value: `\`${apiLatency}ms\` ${apiStatus}`, inline: true },
                { name: '🤖 Shard', value: `\`${client.shard?.ids[0] ?? 0}\``, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const sent = await message.reply('🏓 Pinging...');
        const latency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);

        const status = latency < 100 ? '🟢 ممتاز' : latency < 300 ? '🟡 جيد' : '🔴 بطيء';
        const apiStatus = apiLatency < 100 ? '🟢 ممتاز' : apiLatency < 300 ? '🟡 جيد' : '🔴 بطيء';

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🏓 Pong!')
            .addFields(
                { name: '📡 Bot Latency', value: `\`${latency}ms\` ${status}`, inline: true },
                { name: '🌐 API Latency', value: `\`${apiLatency}ms\` ${apiStatus}`, inline: true },
                { name: '🤖 Shard', value: `\`${client.shard?.ids[0] ?? 0}\``, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await sent.edit({ content: null, embeds: [embed] });
    },
};
