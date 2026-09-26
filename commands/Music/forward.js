// ═══════════════════════════════════════════════════════════════════════════
//  commands/forward.js — تقديم التشغيل بعدد ثواني
//  MUS Bot v19.0 — Dev: ELMINYAWE 👨‍💻
//  مستوحى من Groove-Music
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forward')
        .setDescription('Fast forward the current song by specified seconds')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Seconds to fast-forward (default: 10)')
                .setMinValue(1)
                .setRequired(false)
        ),

    aliases: ['ff', 'fastforward', 'تقديم'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        const seconds = interaction.options.getInteger('seconds') || 10;
        const currentTime = player.getCurrentTime ? player.getCurrentTime() : (player.currentTime || 0);
        const currentSec = Math.floor(currentTime / 1000);
        const targetSec = currentSec + seconds;
        const totalSec = player.currentTrack.duration || 0;

        if (targetSec >= totalSec) {
            // تجاوز نهاية الأغنية — تخطّي
            player.skip();
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('⏩ Forward → Skipped')
                .setDescription(`وصلنا لنهاية الأغنية — تم التخطّي للأغنية التالية.`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }

        await player.play(null, targetSec * 1000);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏩ Forwarded')
            .setDescription(`تم التقديم **${seconds}** ثانية.`)
            .addFields(
                { name: '🎵 Track', value: `[${player.currentTrack.title}](${player.currentTrack.url})`, inline: true },
                { name: '⏱️ Position', value: `${formatDuration(targetSec)} / ${formatDuration(totalSec)}`, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) {
            return message.reply('❌ لا يوجد شيء قيد التشغيل.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        const seconds = parseInt(args[0]) || 10;
        // ✅ v26.4: رفض القيم السالبة (كانت تجعل forward يرجع للخلف!)
        // slash لديها setMinValue(1) — النصي كان بلا فحص
        if (seconds < 1) {
            return message.reply('❌ استخدم: `!forward <seconds>` — قيمة موجبة.');
        }
        const currentTime = player.getCurrentTime ? player.getCurrentTime() : (player.currentTime || 0);
        const currentSec = Math.floor(currentTime / 1000);
        const targetSec = currentSec + seconds;
        const totalSec = player.currentTrack.duration || 0;

        if (targetSec >= totalSec) {
            player.skip();
            return message.reply('⏩ وصلنا لنهاية الأغنية — تم التخطّي.');
        }

        await player.play(null, targetSec * 1000);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏩ Forwarded')
            .setDescription(`تم التقديم **${seconds}** ثانية.`)
            .addFields(
                { name: '🎵 Track', value: `[${player.currentTrack.title}](${player.currentTrack.url})`, inline: true },
                { name: '⏱️ Position', value: `${formatDuration(targetSec)} / ${formatDuration(totalSec)}`, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
