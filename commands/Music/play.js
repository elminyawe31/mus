// ═══════════════════════════════════════════════════════════════════════════
//  commands/play.js — أمر التشغيل (slash + prefix)
//  ─────────────────────────────────────────────────────────────────────────
//  يدعم طريقتين للاستدعاء:
//    • Slash:  /play query:ياه تامر عاشور
//    • Prefix: !play ياه تامر عاشور  (أو !p ياه تامر عاشور)
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const MusicPlayer = require('../../src/MusicPlayer');
const MusicEmbedManager = require('../../src/MusicEmbedManager');
const LanguageManager = require('../../src/LanguageManager');
const ErrorHandler = require('../../src/ErrorHandler');

module.exports = {
    // ── Slash command data ────────────────────────────────────────────────
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Plays music — Supports YouTube, Spotify, SoundCloud or direct links')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Song name, artist, YouTube/Spotify/SoundCloud URL or direct link')
                .setRequired(true)
        ),

    // ── Aliases للأوامر المختصرة (prefix فقط) ─────────────────────────────
    aliases: ['p', 'شغل', 'paly'],

    // ═══════════════════════════════════════════════════════════════════════
    //  Slash command executor
    // ═══════════════════════════════════════════════════════════════════════
    async execute(interaction, client) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }

            const query = interaction.options.getString('query');
            const member = interaction.member;
            const guild = interaction.guild;
            const channel = interaction.channel;

            const validationResult = await this.validateRequest(interaction, member, guild);
            if (!validationResult.success) {
                return await interaction.editReply({ content: validationResult.message });
            }

            let player = client.players.get(guild.id);
            if (!player) {
                player = new MusicPlayer(guild, channel, member.voice.channel);
                client.players.set(guild.id, player);
            }

            player.voiceChannel = member.voice.channel;
            player.textChannel = channel;

            const searchingMsg = await LanguageManager.getTranslation(guild.id, 'commands.play.searching_desc', { query });
            await interaction.editReply({ content: searchingMsg });

            const trackData = await this.getTrackData(query, guild.id);
            if (!trackData.success) {
                return await interaction.editReply({ content: trackData.message });
            }

            if (!client.musicEmbedManager) {
                client.musicEmbedManager = new MusicEmbedManager(client);
            }

            const embedResult = await client.musicEmbedManager.handleMusicData(
                guild.id,
                trackData,
                member,
                interaction
            );

            if (!embedResult.success) {
                return await interaction.editReply({ content: embedResult.message });
            }
        } catch (error) {
            const errorMsg = await ErrorHandler.handle(error, interaction.guild?.id, 'play.execute');
            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({ content: errorMsg });
                } else if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: errorMsg, ephemeral: true });
                }
            } catch (responseError) {
                console.error('Error sending error response:', responseError);
            }
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    //  Prefix command executor (!play or !p)
    // ═══════════════════════════════════════════════════════════════════════
    async executePrefix(message, args, client) {
        try {
            // تحقق من وجود arguments
            const query = args.join(' ').trim();
            if (!query) {
                return await message.reply('⚠️ استخدم: `!play <اسم الأغنية أو الرابط>`\nمثال: `!play ياه تامر عاشور`');
            }

            const member = message.member;
            const guild = message.guild;
            const channel = message.channel;

            // نفس التحقق من slash command
            const validationResult = await this.validateRequest({ reply: () => {}, editReply: () => {} }, member, guild);
            if (!validationResult.success) {
                return await message.reply(validationResult.message);
            }

            // أرسل رسالة مؤقتة
            const searchingMsg = await LanguageManager.getTranslation(guild.id, 'commands.play.searching_desc', { query });
            const statusMsg = await message.reply(searchingMsg);

            // أنشئ player جديد أو احصل على الموجود
            let player = client.players.get(guild.id);
            if (!player) {
                player = new MusicPlayer(guild, channel, member.voice.channel);
                client.players.set(guild.id, player);
            }

            player.voiceChannel = member.voice.channel;
            player.textChannel = channel;

            // احصل على بيانات الأغنية
            const trackData = await this.getTrackData(query, guild.id);
            if (!trackData.success) {
                return await statusMsg.edit(trackData.message);
            }

            if (!client.musicEmbedManager) {
                client.musicEmbedManager = new MusicEmbedManager(client);
            }

            // محاكاة interaction للـ handleMusicData
            // استخدام message.channel.send بدلاً من interaction.editReply
            const fakeInteraction = {
                deferred: true,
                replied: false,
                editReply: async (opts) => {
                    if (typeof opts === 'string') return await statusMsg.edit(opts);
                    return await statusMsg.edit(opts);
                },
                followUp: async (opts) => await message.channel.send(opts),
                reply: async (opts) => await message.channel.send(opts),
                user: message.author,
                member: message.member,
                guild: message.guild,
                channel: message.channel,
                guildId: message.guild.id,
            };

            const embedResult = await client.musicEmbedManager.handleMusicData(
                guild.id,
                trackData,
                member,
                fakeInteraction
            );

            if (!embedResult.success) {
                return await statusMsg.edit(embedResult.message);
            }
        } catch (error) {
            console.error('Prefix play error:', error);
            const errorMsg = await ErrorHandler.handle(error, message.guild?.id, 'play.executePrefix');
            await message.reply(errorMsg).catch(() => {});
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    //  Validation (مشترك بين slash و prefix)
    // ═══════════════════════════════════════════════════════════════════════
    async validateRequest(interaction, member, guild) {
        if (!member.voice.channel) {
            const errorMsg = await LanguageManager.getTranslation(guild.id, 'commands.play.voice_channel_required');
            return { success: false, message: errorMsg };
        }

        const permissions = member.voice.channel.permissionsFor(guild.members.me);
        if (!permissions || !permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            const errorMsg = await LanguageManager.getTranslation(guild.id, 'commands.play.no_permissions');
            return { success: false, message: errorMsg };
        }

        const botVoiceChannel = guild.members.me.voice.channel;
        if (botVoiceChannel && botVoiceChannel.id !== member.voice.channel.id) {
            const errorMsg = await LanguageManager.getTranslation(guild.id, 'commands.play.same_channel_required');
            return { success: false, message: errorMsg };
        }

        return { success: true };
    },

    // ═══════════════════════════════════════════════════════════════════════
    //  Get track data (مشترك)
    // ═══════════════════════════════════════════════════════════════════════
    async getTrackData(query, guildId) {
        const YouTube = require('../../src/YouTube');
        const Spotify = require('../../src/Spotify');
        const SoundCloud = require('../../src/SoundCloud');
        const DirectLink = require('../../src/DirectLink');
        const config = require('../../config');

        try {
            let tracks = [];
            let isPlaylist = false;

            const platform = this.detectPlatform(query);

            switch (platform) {
                case 'youtube':
                    if (YouTube.isPlaylist && YouTube.isPlaylist(query)) {
                        const playlistData = await YouTube.getPlaylist(query, guildId);
                        if (playlistData && playlistData.tracks && playlistData.tracks.length > 0) {
                            tracks = playlistData.tracks;
                            isPlaylist = true;
                        } else {
                            tracks = await YouTube.search(query, 1, guildId);
                        }
                    } else {
                        tracks = await YouTube.search(query, 1, guildId);
                    }
                    break;

                case 'spotify':
                    if (Spotify.isSpotifyURL(query)) {
                        const spotifyData = await Spotify.getFromURL(query, guildId);
                        tracks = spotifyData || [];
                        const { type } = Spotify.parseSpotifyURL(query);
                        isPlaylist = type === 'playlist' || type === 'album' || type === 'artist';
                    } else {
                        const spotifyData = await Spotify.search(query, 1, 'track', guildId);
                        tracks = spotifyData || [];
                    }
                    break;

                case 'soundcloud':
                    const soundcloudData = await SoundCloud.search(query, 1, guildId);
                    tracks = soundcloudData || [];
                    break;

                case 'direct':
                    const directData = await DirectLink.getInfo(query);
                    tracks = directData || [];
                    break;

                default:
                    // ── إستراتيجية البحث الهجين ────────────────────────────────────
                    // 1. ابحث في YouTube أولاً (سريع — يستخدم yt-dlp ytsearch)
                    // 2. إذا فشل (bot detection مثلاً)، ابحث في Spotify (مدمج في الكود)
                    // هذا يضمن أن البوت يجد الأغنية دائماً من أي مصدر متاح
                    tracks = await YouTube.search(query, 1, guildId);

                    // fallback لـ Spotify إذا فشل YouTube
                    if ((!tracks || tracks.length === 0) && config.spotify.clientId) {
                        try {
                            const spotifyData = await Spotify.search(query, 1, 'track', guildId);
                            tracks = spotifyData || [];
                        } catch (e) {
                            // تجاهل — لا يوجد نتائج في الاثنين
                        }
                    }
            }

            if (!tracks || tracks.length === 0) {
                const errorMsg = await LanguageManager.getTranslation(guildId, 'musicplayer.no_results_found');
                return { success: false, message: errorMsg };
            }

            return {
                success: true,
                isPlaylist: isPlaylist,
                tracks: tracks,
            };
        } catch (error) {
            const errorMsg = await ErrorHandler.handle(error, guildId, 'play.getTrackData');
            return { success: false, message: errorMsg };
        }
    },

    detectPlatform(query) {
        if (query.includes('youtube.com') || query.includes('youtu.be')) return 'youtube';
        if (query.includes('spotify.com')) return 'spotify';
        if (query.includes('soundcloud.com')) return 'soundcloud';
        if (query.startsWith('http') && (query.includes('.mp3') || query.includes('.wav') || query.includes('.ogg'))) return 'direct';
        return 'youtube';
    },
};
