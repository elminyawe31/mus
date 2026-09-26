// ═══════════════════════════════════════════════════════════════════════════
//  commands/autoplay.js — تفعيل/تعطيل التشغيل التلقائي للأغانيات المشابهة
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Toggle autoplay mode (auto-play similar songs when queue ends)'),

    aliases: ['ap', 'auto', 'تلقائي'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ البوت لا يعمل حالياً.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        player.autoplay = !player.autoplay;

        const embed = new EmbedBuilder()
            .setColor(player.autoplay ? '#43B581' : config.bot.embedColor)
            .setTitle(`🎲 Autoplay: ${player.autoplay ? 'ON' : 'OFF'}`)
            .setDescription(
                player.autoplay
                    ? '✅ التشغيل التلقائي مفعّل. سيتم تشغيل أغانٍ مشابهة تلقائياً عند انتهاء القائمة.'
                    : '❌ التشغيل التلقائي معطّل.'
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) {
            return message.reply('❌ البوت لا يعمل حالياً.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        player.autoplay = !player.autoplay;

        const embed = new EmbedBuilder()
            .setColor(player.autoplay ? '#43B581' : config.bot.embedColor)
            .setTitle(`🎲 Autoplay: ${player.autoplay ? 'ON' : 'OFF'}`)
            .setDescription(
                player.autoplay
                    ? '✅ التشغيل التلقائي مفعّل. سيتم تشغيل أغانٍ مشابهة تلقائياً عند انتهاء القائمة.'
                    : '❌ التشغيل التلقائي معطّل.'
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
