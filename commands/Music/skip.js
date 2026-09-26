// ═══════════════════════════════════════════════════════════════════════════
//  commands/skip.js — تخطّي الأغنية الحالية
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const LanguageManager = require('../../src/LanguageManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song and play the next one'),

    aliases: ['s', 'next', 'تخطي'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل حالياً.', ephemeral: true });
        }

        // تحقق من وجود المستخدم في نفس القناة
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        const skippedTrack = player.currentTrack;
        player.skip();

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏭️ Skipped')
            .setDescription(`**[${skippedTrack.title}](${skippedTrack.url})**`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) {
            return message.reply('❌ لا يوجد شيء قيد التشغيل حالياً.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        const skippedTrack = player.currentTrack;
        player.skip();

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏭️ Skipped')
            .setDescription(`**[${skippedTrack.title}](${skippedTrack.url})**`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
