// ═══════════════════════════════════════════════════════════════════════════
//  commands/lyrics.js — جلب كلمات الأغنية الحالية
//  MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
// LyricsManager يُصدِّر instance جاهز، لا تستخدم new
const lyricsManager = require('../../src/LyricsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Get lyrics for the currently playing song'),

    aliases: ['ly', 'كلمات'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const track = player.currentTrack;
            // ✅ استخدم fetchLyrics (الاسم الصحيح) بدل fetch (غير موجود)
            const lyrics = await lyricsManager.fetchLyrics({
                title: track.title,
                artist: track.artist || track.uploader,
                url: track.url,
                duration: track.duration, // ✅ v26.7: يرفع دقة مطابقة LRCLIB
            });

            if (!lyrics || !lyrics.plain) {
                return interaction.editReply('❌ لم يتم العثور على كلمات لهذه الأغنية.');
            }

            // اقتطاع الكلمات إذا كانت طويلة جداً (حد Discord 4096 حرف للـ description)
            const maxLen = 3800;
            let lyricsText = lyrics.plain;
            if (lyricsText.length > maxLen) {
                lyricsText = lyricsText.substring(0, maxLen) + '\n\n... (اقتطاع)';
            }

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle(`🎤 Lyrics: ${track.title}`)
                .setURL(track.url)
                .setDescription(lyricsText)
                .setFooter({ text: `${config.bot.signature} • Source: ${lyrics.source || 'Unknown'}` })
                .setTimestamp();

            if (track.thumbnail) {
                embed.setThumbnail(track.thumbnail);
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Lyrics error:', error.message);
            await interaction.editReply('❌ حدث خطأ أثناء جلب الكلمات: ' + error.message).catch(() => {});
        }
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) {
            return message.reply('❌ لا يوجد شيء قيد التشغيل.');
        }

        const statusMsg = await message.reply('🔍 جاري البحث عن الكلمات...');

        try {
            const track = player.currentTrack;
            const lyrics = await lyricsManager.fetchLyrics({
                title: track.title,
                artist: track.artist || track.uploader,
                url: track.url,
                duration: track.duration, // ✅ v26.7: يرفع دقة مطابقة LRCLIB
            });

            if (!lyrics || !lyrics.plain) {
                return statusMsg.edit('❌ لم يتم العثور على كلمات لهذه الأغنية.');
            }

            const maxLen = 3800;
            let lyricsText = lyrics.plain;
            if (lyricsText.length > maxLen) {
                lyricsText = lyricsText.substring(0, maxLen) + '\n\n... (اقتطاع)';
            }

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle(`🎤 Lyrics: ${track.title}`)
                .setURL(track.url)
                .setDescription(lyricsText)
                .setFooter({ text: `${config.bot.signature} • Source: ${lyrics.source || 'Unknown'}` })
                .setTimestamp();

            if (track.thumbnail) {
                embed.setThumbnail(track.thumbnail);
            }

            await statusMsg.edit({ content: null, embeds: [embed] });
        } catch (error) {
            console.error('Lyrics error:', error.message);
            await statusMsg.edit('❌ حدث خطأ أثناء جلب الكلمات: ' + error.message).catch(() => {});
        }
    },
};
