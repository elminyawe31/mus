// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/speed.js — تغيير سرعة التشغيل
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
//  مستوحى من Groove-Music (بدون Lavalink — يستخدم نظامنا)
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('speed')
        .setDescription('Change the playback speed of the current song')
        .addNumberOption(opt =>
            opt.setName('speed')
                .setDescription('Playback speed (0.5 - 2.0)')
                .setMinValue(0.5)
                .setMaxValue(2.0)
                .setRequired(false)
        ),

    aliases: ['sp', 'tempo', 'سرعة'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة.', ephemeral: true });
        }

        const speed = interaction.options.getNumber('speed');
        const currentSpeed = player.playbackSpeed || 1.0;

        if (speed === null) {
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('🎚️ Speed Control')
                .setDescription(`**السرعة الحالية:** \`${currentSpeed}x\`\n**النطاق:** \`0.5x - 2.0x\``)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }

        try {
            // ✅ استخدم setPlaybackSpeed (يطبّق atempo filter فعلياً عبر FFmpeg)
            if (typeof player.setPlaybackSpeed === 'function') {
                const appliedSpeed = player.setPlaybackSpeed(speed);
                const embed = new EmbedBuilder()
                    .setColor(config.bot.embedColor)
                    .setTitle('🎚️ Speed Set')
                    .setDescription(`تم تغيير السرعة إلى: **${appliedSpeed}x**\n🎵 [${player.currentTrack.title}](${player.currentTrack.url})`)
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
            } else {
                // fallback: حفظ فقط بدون تطبيق فعلي
                player.playbackSpeed = speed;
                await interaction.reply({ content: `⚠️ تم حفظ السرعة \`${speed}x\` لكن البوت لا يدعم تطبيقها فعلياً على هذا الإصدار.` });
            }
        } catch (error) {
            console.error('Speed error:', error);
            await interaction.reply({ content: `❌ فشل تطبيق السرعة: ${error.message}`, ephemeral: true });
        }
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) return message.reply('❌ لا يوجد شيء قيد التشغيل.');
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة.');
        }
        const speed = parseFloat(args[0]);
        if (!speed || speed < 0.5 || speed > 2.0) {
            return message.reply('❌ استخدم: `!speed <0.5-2.0>`');
        }
        try {
            if (typeof player.setPlaybackSpeed === 'function') {
                const appliedSpeed = player.setPlaybackSpeed(speed);
                await message.reply(`🎚️ تم تغيير السرعة إلى: **${appliedSpeed}x**`);
            } else {
                player.playbackSpeed = speed;
                await message.reply(`🎚️ تم حفظ السرعة (الفلتر غير مُطبّق فعلياً).`);
            }
        } catch (error) {
            await message.reply(`❌ خطأ: ${error.message}`);
        }
    },
};
