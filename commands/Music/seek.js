// ═══════════════════════════════════════════════════════════════════════════
//  commands/seek.js — الانتقال لنقطة معينة في الأغنية
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Seek to a specific time in the current song (format: 1:30 or 90)')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Time to seek to (e.g. 1:30 or 90 for 90 seconds)')
                .setRequired(true)
        ),

    aliases: ['sk', 'seek-to', 'انتقال'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        const timeStr = interaction.options.getString('time');
        const seconds = parseTime(timeStr);

        if (seconds === null) {
            return interaction.reply({ content: '❌ صيغة الوقت غير صحيحة. استخدم: `1:30` أو `90`.', ephemeral: true });
        }

        if (seconds > player.currentTrack.duration) {
            return interaction.reply({ content: `❌ الوقت يتجاوز مدة الأغنية (${formatDuration(player.currentTrack.duration)}).`, ephemeral: true });
        }

        try {
            const seekMs = seconds * 1000;
            await player.play(null, seekMs);

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('⏩ Seeked')
                .setDescription(`انتقل إلى: **${formatDuration(seconds)}** / ${formatDuration(player.currentTrack.duration)}`)
                .addFields(
                    { name: '🎵 Track', value: `[${player.currentTrack.title}](${player.currentTrack.url})`, inline: false }
                )
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Seek error:', error);
            await interaction.reply({ content: `❌ فشل الانتقال: ${error.message}`, ephemeral: true });
        }
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) {
            return message.reply('❌ لا يوجد شيء قيد التشغيل.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        const timeStr = args[0];
        if (!timeStr) {
            return message.reply('❌ استخدم: `!seek 1:30` أو `!seek 90`');
        }

        const seconds = parseTime(timeStr);
        if (seconds === null) {
            return message.reply('❌ صيغة الوقت غير صحيحة. استخدم: `1:30` أو `90`');
        }

        // ✅ v26.3: نفس فحص نسخة slash — منع التجاوز لمدة الأغنية
        if (player.currentTrack.duration && seconds > player.currentTrack.duration) {
            return message.reply(`❌ الوقت يتجاوز مدة الأغنية (${formatDuration(player.currentTrack.duration)}).`);
        }

        try {
            const seekMs = seconds * 1000;
            await player.play(null, seekMs);

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('⏩ Seeked')
                .setDescription(`انتقل إلى: **${formatDuration(seconds)}** / ${formatDuration(player.currentTrack.duration)}`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Seek error:', error);
            await message.reply(`❌ فشل الانتقال: ${error.message}`);
        }
    },
};

function parseTime(str) {
    if (/^\d+$/.test(str)) {
        return parseInt(str);
    }
    const match = str.match(/^(\d+):(\d{1,2})$/);
    if (match) {
        return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    const matchHMS = str.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
    if (matchHMS) {
        return parseInt(matchHMS[1]) * 3600 + parseInt(matchHMS[2]) * 60 + parseInt(matchHMS[3]);
    }
    return null;
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
