const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const config = require('../config');
const LanguageManager = require('./LanguageManager');
const MusicCard = require('./MusicCard');

class MusicEmbedManager {
    constructor(client) {
        this.client = client;
        // Çakışma önleme için işlem kuyruğu
        this.processingQueue = new Map(); // guildId -> Promise
        // Track card update intervals per guild (لتحديث progress bar كل 5 ثوان)
        this.cardIntervals = new Map();
        // ✅ v26.7: حالة تحديث الكارت لكل سيرفر (منع إعادة الرسم بلا داع + عداد الفشل)
        this.cardUpdateState = new Map(); // guildId -> { lastPos, lastPaused, lastVol, failures }
        // Track current card message per guild
        this.cardMessages = new Map();
        console.log(`[MusicEmbedManager] Canvas ready: ${MusicCard.isReady() ? 'YES ✅ (PNG cards enabled)' : 'NO ❌ (fallback to embeds)'}`);
    }

    /**
     * Queue'daki track'leri sırayla preload eder (donmayı önler)
     */
    async sequentialPreload(player, tracks) {
        for (const track of tracks) {
            // Eğer bu track zaten preload edilmişse veya preload sırasındaysa atla
            if (player.preloadedStreams.has(track.url) || player.preloadingQueue.includes(track.url)) {
                continue;
            }

            try {
                await player.preloadTrack(track);
                // Her preload arasında kısa bekleme (sistem yükünü azaltmak için)
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                console.error(`❌ Preload error for ${track.title}:`, err.message);
                // Hata olsa bile devam et
            }
        }
    }

    /**
     * Müzik verilerini işler ve uygun embed'i gönderir/günceller
     */
    async handleMusicData(guildId, trackData, member, interaction = null) {
        // Çakışma önleme - aynı guild için aynı anda sadece bir işlem
        if (this.processingQueue.has(guildId)) {
            await this.processingQueue.get(guildId);
        }

        const processingPromise = this._processMusic(guildId, trackData, member, interaction);
        this.processingQueue.set(guildId, processingPromise);

        try {
            const result = await processingPromise;
            return result;
        } finally {
            this.processingQueue.delete(guildId);
        }
    }

    async _processMusic(guildId, trackData, member, interaction) {
        const player = this.client.players.get(guildId);
        if (!player) return { success: false, message: 'No player found' };

        const wasPlayingBefore = player.currentTrack !== null;
        const isPlaylist = trackData.isPlaylist || false;
        const tracks = trackData.tracks;

        try {
            let firstTrackResult = null;
            const wasIdle = (!player.currentTrack && player.queue.length === 0);

            // Tüm track'leri player'a ekle (preload'ı tetikleyecek)
            for (let i = 0; i < tracks.length; i++) {
                const track = { ...tracks[i] };
                track.requestedBy = member;
                track.addedAt = Date.now();

                // İlk track ve player boşsa
                if (i === 0 && wasIdle) {
                    player.currentTrack = track;

                    // Ses kanalına bağlan ve çalmaya başla
                    try {
                        if (!player.connection) {
                            await player.connect();
                        }
                        await player.play();

                        // Yeni embed oluştur
                        firstTrackResult = await this.createNewMusicEmbed(player, track, member, interaction);
                    } catch (playError) {
                        console.error('Error in play process:', playError);
                        // Hata durumunda track'i sıraya ekle
                        player.currentTrack = null;
                        player.queue.push(track);
                    }
                } else {
                    // Kuyruğa ekle
                    player.queue.push(track);
                }
            }

            // Preload'ı tetikle - queue'daki track'leri sırayla preload et (donmayı önlemek için)
            this.sequentialPreload(player, player.queue.slice()).catch(err =>
                console.error('❌ Sequential preload error:', err.message)
            );

            // Eğer ilk şarkıyı çalmaya başladıysak ve playlist'te başka şarkılar varsa
            if (firstTrackResult && tracks.length > 1) {
                // Playlist'teki kalan şarkıları sıraya eklediğimizi bildiren mesaj göster
                await this.showPlaylistAdditionMessage(player, tracks, member, interaction, isPlaylist);
                // Kuyruk bilgisi güncellendi, embed'i de güncelle
                await this.updateNowPlayingEmbed(player);
                return firstTrackResult;
            }

            // Eğer sadece kuyruğa ekleme yaptıysak (zaten müzik çalıyordu)
            if (wasPlayingBefore || (!firstTrackResult && tracks.length > 0)) {
                return await this.handleQueueAddition(player, tracks, member, interaction, isPlaylist);
            }

            // Tek şarkı çalmaya başladıysak
            if (firstTrackResult) {
                return firstTrackResult;
            }

            return { success: true, message: 'Track processed successfully' };
        } catch (error) {
            return { success: false, message: 'Error processing music' };
        }
    }

    /**
     * Playlist ekleme mesajını gösterir (ilk şarkı çalıyorken kalan şarkıların eklendiğini bildirir)
     */
    async showPlaylistAdditionMessage(player, tracks, member, interaction, isPlaylist) {
        // Bilgi mesajı gönder (ilk şarkı hariç kalan şarkıları bildir)
        const remainingTracks = tracks.slice(1); // İlk şarkı hariç
        const messageText = await this.createQueueAdditionMessage(remainingTracks, member.guild.id, isPlaylist);

        // Mesajı text channel'a gönder (interaction değil)
        let infoMessage;
        try {
            infoMessage = await player.textChannel.send({ content: messageText });

            // Bilgi mesajını 10 saniye sonra sil
            setTimeout(async () => {
                try {
                    await infoMessage.delete();
                } catch (error) {
                    // Mesaj silinmiş olabilir
                }
            }, 10000);
        } catch (error) {
            console.error('Error sending playlist addition message:', error);
        }
    }

    /**
     * Yeni müzik embed'i oluşturur (çalan müzik yokken)
     * الآن يدعم PNG image card عبر @napi-rs/canvas مع fallback لـ embed
     */
    async createNewMusicEmbed(player, track, member, interaction) {
        const guildId = member?.guild?.id || player?.guild?.id || interaction?.guild?.id || interaction?.guildId;
        if (!guildId) {
            console.error('createNewMusicEmbed: Cannot determine guildId');
            return { success: false, message: 'Could not determine guild' };
        }

        // احصل على اسم الـ requester
        let requesterName = 'Unknown';
        let requesterId = null;
        if (member) {
            requesterId = member.id;
            // استخدم username أو displayName
            if (member.user) {
                requesterName = member.user.username || member.user.displayName || 'Unknown';
            } else if (member.displayName) {
                requesterName = member.displayName;
            }
        } else if (interaction?.user) {
            requesterId = interaction.user.id;
            requesterName = interaction.user.username || 'Unknown';
        }

        // ── محاولة توليد PNG card عبر canvas ─────────────────────────────
        let cardBuffer = null;
        try {
            const position = player.getCurrentTime ? player.getCurrentTime() : (player.currentTime || 0);
            cardBuffer = await MusicCard.generateMusicCard(track, player, position, {
                requesterName,
                developer: config.info.developer,
                guildId,   // ✅ v26.10: ثيم الكارت لكل سيرفر (/lite و /dark)
            });
        } catch (err) {
            console.error('[MusicEmbedManager] Card generation failed:', err.message);
            cardBuffer = null;
        }

        const buttons = await this.createControlButtons(player);
        let message;

        if (cardBuffer) {
            // ── PNG card mode ──────────────────────────────────────────────
            const attachment = new AttachmentBuilder(cardBuffer, { name: 'nowplaying.png' });

            if (interaction) {
                if (interaction.deferred || interaction.replied) {
                    message = await interaction.editReply({
                        content: null,
                        files: [attachment],
                        components: buttons,
                    });
                } else {
                    message = await interaction.reply({
                        files: [attachment],
                        components: buttons,
                        fetchReply: true,
                    });
                }
            } else {
                message = await player.textChannel.send({
                    files: [attachment],
                    components: buttons,
                });
            }

            player.nowPlayingMessage = message;
            player.requesterId = requesterId;

            // ── ابدأ تحديث الـ card كل 5 ثوان (progress bar) ─────────────
            this.startCardUpdateInterval(player, track, requesterName);

            return { success: true, message: 'Now playing (card mode)', isNewEmbed: true };
        } else {
            // ── Fallback: embed mode ───────────────────────────────────────
            console.warn('[MusicEmbedManager] Falling back to embed mode');
            const embed = await this.createNowPlayingEmbed(player, track, guildId);

            if (interaction) {
                if (interaction.deferred || interaction.replied) {
                    message = await interaction.editReply({
                        content: null,
                        embeds: [embed],
                        components: buttons,
                    });
                } else {
                    message = await interaction.reply({
                        embeds: [embed],
                        components: buttons,
                        fetchReply: true,
                    });
                }
            } else {
                message = await player.textChannel.send({
                    embeds: [embed],
                    components: buttons,
                });
            }

            player.nowPlayingMessage = message;
            player.requesterId = requesterId;
            return { success: true, message: 'Now playing (embed mode)', isNewEmbed: true };
        }
    }

    /**
     * يبدأ interval لتحديث الـ PNG card كل 5 ثوان (لتحديث progress bar)
     * مهم: لا يلمس منطق البث/التنزيل — فقط يُحدّث الصورة المعروضة
     */
    startCardUpdateInterval(player, track, requesterName) {
        const guildId = player.guild.id;

        // أوقف أي interval سابق
        this.stopCardUpdateInterval(guildId);

        // ✅ v26.7: حالة أولية — أول رسم دائماً يمر
        this.cardUpdateState.set(guildId, { lastPos: -1, lastPaused: null, lastVol: null, failures: 0 });

        const interval = setInterval(async () => {
            try {
                // تحقق أن الـ player ما زال نشطاً
                if (!this.client.players?.has(guildId)) {
                    this.stopCardUpdateInterval(guildId);
                    return;
                }

                // تحقق أن الرسالة ما زالت موجودة
                if (!player.nowPlayingMessage) {
                    this.stopCardUpdateInterval(guildId);
                    return;
                }

                // تحقق أن نفس الأغنية ما زالت تعمل
                if (!player.currentTrack || player.currentTrack.url !== track.url) {
                    this.stopCardUpdateInterval(guildId);
                    return;
                }

                // احصل على الموضع الحالي
                const position = player.getCurrentTime ? player.getCurrentTime() : (player.currentTime || 0);

                // ✅ v26.7: تخطَّ الرسم إذا لم يتغير شيء (موقوف مؤقتاً + نفس الصوت)
                // — يوفر CPU وrate limits أثناء الإيقاف المؤقت الطويل
                // ✅ v26.10: نرسم أيضاً لو تغيّر ثيم الكارت (/lite أو /dark أثناء الإيقاف)
                const st = this.cardUpdateState.get(guildId) || { lastPos: -1, lastPaused: null, lastVol: null, failures: 0 };
                const paused = !!player.paused;
                const vol = Math.round(player?.volume ?? 100);
                const themeNow = MusicCard.getGuildTheme ? MusicCard.getGuildTheme(guildId) : null;
                if (st.lastPos === position && st.lastPaused === paused && st.lastVol === vol && st.lastTheme === themeNow) {
                    return; // لا تغيير — لا رسم
                }

                // ولّد card جديد
                const newBuffer = await MusicCard.generateMusicCard(player.currentTrack, player, position, {
                    requesterName,
                    developer: config.info.developer,
                    guildId,   // ✅ v26.10: ثيم الكارت لكل سيرفر
                });

                if (!newBuffer) return;

                // حدّث الرسالة بالصورة الجديدة
                const attachment = new AttachmentBuilder(newBuffer, { name: 'nowplaying.png' });
                await player.nowPlayingMessage.edit({
                    files: [attachment],
                });

                // ✅ v26.7: نجاح — صفّر العداد وحدّث الحالة
                st.lastPos = position;
                st.lastPaused = paused;
                st.lastVol = vol;
                st.lastTheme = themeNow;
                st.failures = 0;
                this.cardUpdateState.set(guildId, st);
            } catch (err) {
                // إذا فشل التحديث (مثلاً الرسالة حُذفت)، أوقف الـ interval
                if (err.code === 10008 || err.message?.includes('Unknown Message')) {
                    this.stopCardUpdateInterval(guildId);
                    return;
                }
                // ✅ v26.7: عداد فشل — بعد 6 أعطال متتالية أوقف الـ interval
                // (يمنع تسرب CPU إذا كان هناك مشكلة مستمرة في القناة/الصلاحيات)
                const st = this.cardUpdateState.get(guildId) || { failures: 0 };
                st.failures = (st.failures || 0) + 1;
                this.cardUpdateState.set(guildId, st);
                if (st.failures >= 6) {
                    console.warn(`[MusicEmbedManager] Card update failed ${st.failures}x for ${guildId} — stopping interval`);
                    this.stopCardUpdateInterval(guildId);
                }
            }
        }, 5000); // كل 5 ثوان

        this.cardIntervals.set(guildId, interval);
    }

    /**
     * يوقف interval تحديث الـ card
     */
    stopCardUpdateInterval(guildId) {
        const interval = this.cardIntervals.get(guildId);
        if (interval) {
            clearInterval(interval);
            this.cardIntervals.delete(guildId);
        }
        // ✅ v26.7: نظّف حالة التحديث أيضاً (منع تسرب الذاكرة مع طول التشغيل)
        this.cardUpdateState?.delete(guildId);
    }

    /**
     * Kuyruğa şarkı eklenmesi durumunu yönetir
     */
    async handleQueueAddition(player, tracks, member, interaction, isPlaylist) {
        // Mevcut embed'i güncelle
        if (player.nowPlayingMessage && player.currentTrack) {
            await this.updateNowPlayingEmbed(player);
        }

        // Bilgi mesajı gönder
        const messageText = await this.createQueueAdditionMessage(tracks, member.guild.id, isPlaylist);

        let infoMessage;
        if (interaction) {
            if (interaction.deferred || interaction.replied) {
                infoMessage = await interaction.editReply({ content: messageText, embeds: [], components: [] });
            } else {
                infoMessage = await interaction.reply({ content: messageText, flags: [1 << 6] });
            }
        } else {
            infoMessage = await player.textChannel.send({ content: messageText });
        }

        // Bilgi mesajını 10 saniye sonra sil
        setTimeout(async () => {
            try {
                await infoMessage.delete();
            } catch (error) {
                // Mesaj silinmiş olabilir
            }
        }, 10000);

        return { success: true, message: 'Added to queue', isNewEmbed: false };
    }

    /**
     * Now Playing embed'ini oluşturur
     */
    async createNowPlayingEmbed(player, track, guildId) {
        // ── تصميم NowPlaying احترافي مطابق لـ modern Discord bots ──────────
        // يشمل: progress bar, thumbnail, info grid, بصمة المطور في الـ footer

        const nowPlayingTitle = await LanguageManager.getTranslation(guildId, 'commands.play.now_playing');

        // العنوان الرئيسي + اسم الأغنية في cyan
        const embed = new EmbedBuilder()
            .setTitle(`🎵 ${nowPlayingTitle}`)
            .setDescription(`**[${track.title}](${track.url})**`)
            .setColor(config.bot.embedColor || '#FF6B6B')
            .setTimestamp();

        // ── الصف الأول: Artist | Duration | Platform (3 columns) ──────────
        const artistLabel = await LanguageManager.getTranslation(guildId, 'commands.play.artist');
        const durationLabel = await LanguageManager.getTranslation(guildId, 'commands.play.duration');
        const platformLabel = await LanguageManager.getTranslation(guildId, 'commands.play.platform');

        const fields = [];

        if (track.artist) {
            fields.push({
                name: `👤 ${artistLabel}`,
                value: track.artist,
                inline: true,
            });
        }

        if (track.duration) {
            fields.push({
                name: `⏱️ ${durationLabel}`,
                value: `\`${this.formatDuration(track.duration)}\``,
                inline: true,
            });
        }

        if (track.platform) {
            const platformEmoji = this.getPlatformEmoji(track.platform);
            const platformName = track.platform.charAt(0).toUpperCase() + track.platform.slice(1);
            fields.push({
                name: `🎵 ${platformLabel}`,
                value: `${platformEmoji} ${platformName}`,
                inline: true,
            });
        }

        embed.addFields(fields);

        // ── الصف الثاني: Status | Requester | Loop Mode ────────────────────
        const statusLabel = await LanguageManager.getTranslation(guildId, 'commands.nowplaying.status');
        const statusKey = player.paused
            ? 'commands.nowplaying.status_paused'
            : 'commands.nowplaying.status_playing';
        let statusValue = await LanguageManager.getTranslation(guildId, statusKey);

        if (player.pauseReasons && player.pauseReasons.has('mute')) {
            statusValue = `${statusValue} 🔇`;
        } else if (player.pauseReasons && player.pauseReasons.has('alone')) {
            statusValue = `${statusValue} ⏳`;
        }

        // Requester info
        let requesterValue = 'Unknown';
        if (player.requesterId) {
            requesterValue = `<@${player.requesterId}>`;
        }

        // Loop mode display
        let loopValue = 'Off';
        let loopEmoji = '➡️';
        if (player.loop === 'track') {
            loopValue = 'Track';
            loopEmoji = '🔂';
        } else if (player.loop === 'queue') {
            loopValue = 'Queue';
            loopEmoji = '🔁';
        }

        embed.addFields(
            {
                name: `⚙️ ${statusLabel}`,
                value: `${player.paused ? '⏸️' : '▶️'} ${statusValue}`,
                inline: true,
            },
            {
                name: '🙋 Requested by',
                value: requesterValue,
                inline: true,
            },
            {
                name: `${loopEmoji} Loop`,
                value: loopValue,
                inline: true,
            }
        );

        // ── Progress bar (شريط التقدم) ─────────────────────────────────────
        // تصميم احترافي: ████████░░░░ 1:23 / 4:08
        try {
            const currentTime = player.getCurrentTime ? player.getCurrentTime() : (player.currentTime || 0);
            const currentSeconds = Math.floor(currentTime / 1000);
            const totalSeconds = track.duration || 0;

            if (totalSeconds > 0) {
                const progress = Math.min(currentSeconds / totalSeconds, 1);
                const barLength = 20;
                const filledLength = Math.floor(progress * barLength);
                const emptyLength = barLength - filledLength;

                const filled = '█'.repeat(filledLength);
                const empty = '░'.repeat(emptyLength);
                const progressBar = `${filled}${empty}`;

                const currentFormatted = this.formatDuration(currentSeconds);
                const totalFormatted = this.formatDuration(totalSeconds);

                embed.addFields({
                    name: '🎶 Progress',
                    value: `\`${progressBar}\` \`${currentFormatted} / ${totalFormatted}\``,
                    inline: false,
                });
            }
        } catch (e) {
            // تجاهل أخطاء حساب التقدم
        }

        // ── Queue info ──────────────────────────────────────────────────────
        if (player.queue && player.queue.length > 0) {
            const nextTrack = player.queue[0];
            const queueText = `**Next:** [${nextTrack.title.substring(0, 50)}${nextTrack.title.length > 50 ? '...' : ''}](${nextTrack.url})\n**In queue:** ${player.queue.length} track(s)`;
            embed.addFields({
                name: '📋 Queue',
                value: queueText,
                inline: false,
            });
        }

        // ── Thumbnail ──────────────────────────────────────────────────────
        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        // ── Footer مع بصمة المطور ELMINYAWE ────────────────────────────────
        const permissionInfo = await LanguageManager.getTranslation(guildId, 'musicmanager.control_permission_info');
        const footerText = `${config.bot.signature} • ${permissionInfo}`;

        // أيقونة المطور في footer icon (URL اختياري - حالياً نستخدم emoji فقط)
        embed.setFooter({
            text: footerText,
        });

        // Author info (يظهر فوق العنوان)
        embed.setAuthor({
            name: `${config.bot.name} v${config.bot.version}`,
            iconURL: player.guild.client.user?.displayAvatarURL(),
            url: config.bot.github,
        });

        return embed;
    }

    /**
     * Mevcut müzik embed'ini günceller
     * إذا كنا في card mode، فقط حدّث الـ buttons أو تخطّى
     * الـ card نفسها تتحدّث تلقائياً عبر startCardUpdateInterval
     */
    async updateNowPlayingEmbed(player) {
        if (!player.nowPlayingMessage || !player.currentTrack) return;

        try {
            // إذا كنا في card mode (PNG image)، حدّث الـ buttons فقط
            if (player.nowPlayingMessage.attachments?.size > 0) {
                const buttons = await this.createControlButtons(player);
                await player.nowPlayingMessage.edit({
                    components: buttons,
                });
                return;
            }

            // Fallback: embed mode
            const embed = await this.createNowPlayingEmbed(player, player.currentTrack, player.guild.id);
            const buttons = await this.createControlButtons(player);

            await player.nowPlayingMessage.edit({
                embeds: [embed],
                components: buttons
            });
        } catch (error) {
            console.error('Error updating now playing embed:', error);
        }
    }

    /**
     * Şarkı bittiğinde çağrılır
     * مُحدّث: يحذف الرسالة القديمة ويُنشئ واحدة جديدة للأغنية الجديدة
     */
    async handleTrackEnd(player) {
        if (player.queue.length > 0) {
            // Sıradaki şarkıya geç
            const nextTrack = player.queue.shift();
            player.currentTrack = nextTrack;

            // ── احذف الرسالة القديمة قبل بدء الأغنية الجديدة ───────────────────
            // هذا يحل مشكلة تراكم بطاقات NowPlaying عند الـ skip
            await this.deleteOldNowPlayingMessage(player);

            // أوقف interval القديم
            if (player.guild?.id) {
                this.stopCardUpdateInterval(player.guild.id);
            }

            const playResult = await player.play();

            // ✅ [FIX التضارب] لو جاء طلب تشغيل أحدث (seek/skip/skipto) أثناء تشغيل الأغنية
            // التالية، فلا تُنشئ كارتاً جديداً — العملية الأحدث ستتولى الواجهة (منع ظهور كارتين)
            if (playResult?.stale) return;

            // ── أنشئ بطاقة جديدة للأغنية الجديدة ──────────────────────────────
            // createNewMusicEmbed ستنشئ رسالة جديدة وتبدأ interval جديد
            if (player.nowPlayingMessage === null || player.nowPlayingMessage === undefined) {
                // نحتاج لاستدعاء createNewMusicEmbed عبر interaction أو message سابق
                // بما أن handleTrackEnd لا يملك interaction، نستخدم textChannel مباشرة
                const track = player.currentTrack;
                const guildId = player.guild.id;

                // احصل على requesterId من الأغنية إن وُجد
                const member = player.requesterId ? { id: player.requesterId, user: { username: 'User' } } : null;

                // استخدم createNewMusicEmbed مع interaction=null لإرسال عبر textChannel
                try {
                    await this.createNewMusicEmbed(player, track, member, null);
                } catch (err) {
                    console.error('Error creating new card after track end:', err);
                    // fallback: استخدم update التقليدي
                    await this.updateNowPlayingEmbed(player);
                }
            } else {
                await this.updateNowPlayingEmbed(player);
            }
        } else {
            // Tüm şarkılar bitti
            await this.handlePlaybackEnd(player);
        }
    }

    /**
     * يحذف الرسالة القديمة لـ NowPlaying بأمان
     */
    async deleteOldNowPlayingMessage(player) {
        try {
            if (player.nowPlayingMessage && player.nowPlayingMessage.deletable) {
                await player.nowPlayingMessage.delete().catch(() => {});
            }
        } catch (e) {
            // تجاهل
        }
        player.nowPlayingMessage = null;
    }

    /**
     * Tüm müzikler bittiğinde çağrılır
     */
    async handlePlaybackEnd(player) {
        // أوقف interval تحديث الـ card (إن وُجد)
        if (player.guild?.id) {
            this.stopCardUpdateInterval(player.guild.id);
        }

        // Butonları devre dışı bırak
        if (player.nowPlayingMessage) {
            try {
                const disabledButtons = await this.createControlButtons(player, true);
                await player.nowPlayingMessage.edit({
                    components: disabledButtons
                });
            } catch (error) {
                console.error('Error disabling buttons:', error);
            }
        }

        let endEmbed = null;
        const guildId = player.guild?.id;

        try {
            const title = guildId
                ? await LanguageManager.getTranslation(guildId, 'musicmanager.playback_ended')
                : 'Playback Ended';
            const description = guildId
                ? await LanguageManager.getTranslation(guildId, 'musicmanager.queue_empty')
                : 'Queue is now empty.';

            endEmbed = new EmbedBuilder()
                .setTitle(`🎵 ${title}`)
                .setDescription(description)
                .setColor('#FF6B6B')
                .setTimestamp();
        } catch (error) {
            console.error('Error preparing playback end embed:', error);
        }

        if (!endEmbed) {
            endEmbed = new EmbedBuilder()
                .setDescription('🎵 Playback ended')
                .setColor('#FF6B6B')
                .setTimestamp();
        }

        const textChannel = player.textChannel;
        if (textChannel && typeof textChannel.send === 'function') {
            try {
                await textChannel.send({ embeds: [endEmbed] });
            } catch (error) {
                // Suppress errors when channel is unavailable or permissions are missing
            }
        }

        // Player'ı temizle
        player.currentTrack = null;
        player.nowPlayingMessage = null;
    }

    /**
     * Kontrol butonlarını oluşturur
     */
    async createControlButtons(player, disabled = false) {
        const guildId = player.guild.id;
        const sessionId = player.sessionId;
        const requesterId = player.requesterId;
        const E = this.client.emoji || {}; // Groove server emojis

        // Button labels
        const pauseLabel = player.paused ?
            await LanguageManager.getTranslation(guildId, 'buttons.resume') :
            await LanguageManager.getTranslation(guildId, 'buttons.pause');

        const skipLabel = await LanguageManager.getTranslation(guildId, 'buttons.skip');
        const stopLabel = await LanguageManager.getTranslation(guildId, 'buttons.stop');
        const queueLabel = await LanguageManager.getTranslation(guildId, 'buttons.queue');
        const shuffleLabel = await LanguageManager.getTranslation(guildId, 'buttons.shuffle');

        const pauseButton = new ButtonBuilder()
            .setCustomId(`music_pause:${requesterId}:${sessionId}`)
            .setLabel(pauseLabel)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(player.paused ? (E.play || '▶️') : (E.pause || '⏸️'))
            .setDisabled(disabled);

        const skipButton = new ButtonBuilder()
            .setCustomId(`music_skip:${requesterId}:${sessionId}`)
            .setLabel(skipLabel)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(E.skip || '⏭️')
            .setDisabled(disabled || player.queue.length === 0); // Sırada müzik yoksa disabled

        const stopButton = new ButtonBuilder()
            .setCustomId(`music_stop:${requesterId}:${sessionId}`)
            .setLabel(stopLabel)
            .setStyle(ButtonStyle.Danger)
            .setEmoji(E.stop || '⏹️')
            .setDisabled(disabled);

        const queueButton = new ButtonBuilder()
            .setCustomId(`music_queue:${requesterId}:${sessionId}`)
            .setLabel(queueLabel)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(E.hastag || '📋')
            .setDisabled(false); // Queue butonu her zaman aktif

        const shuffleButton = new ButtonBuilder()
            .setCustomId(`music_shuffle:${requesterId}:${sessionId}`)
            .setLabel(shuffleLabel)
            .setStyle(player.shuffle ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(E.shuffle || '🔀')
            .setDisabled(disabled);

        const volumeLabel = await LanguageManager.getTranslation(guildId, 'buttons.volume');
        const volumeButton = new ButtonBuilder()
            .setCustomId(`music_volume:${requesterId}:${sessionId}`)
            .setLabel(volumeLabel)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(E.voldown || '🔊')
            .setDisabled(disabled);

        // Loop button - cycles through off -> track -> queue
        let loopLabel, loopEmoji, loopStyle;
        if (player.loop === 'track') {
            loopLabel = await LanguageManager.getTranslation(guildId, 'buttons.loop_track');
            loopEmoji = E.loop || '🔂';
            loopStyle = ButtonStyle.Success;
        } else if (player.loop === 'queue') {
            loopLabel = await LanguageManager.getTranslation(guildId, 'buttons.loop_queue');
            loopEmoji = E.loop || '🔁';
            loopStyle = ButtonStyle.Success;
        } else {
            loopLabel = await LanguageManager.getTranslation(guildId, 'buttons.loop_off');
            loopEmoji = E.loop || '➡️';
            loopStyle = ButtonStyle.Secondary;
        }

        const loopButton = new ButtonBuilder()
            .setCustomId(`music_loop:${requesterId}:${sessionId}`)
            .setLabel(loopLabel)
            .setStyle(loopStyle)
            .setEmoji(loopEmoji)
            .setDisabled(disabled);

        // Autoplay button
        let autoplayLabel, autoplayEmoji, autoplayStyle;
        if (player.autoplay) {
            autoplayLabel = await LanguageManager.getTranslation(guildId, 'buttons.autoplay_on');
            autoplayEmoji = E.dance || '🎲';
            autoplayStyle = ButtonStyle.Success;
        } else {
            autoplayLabel = await LanguageManager.getTranslation(guildId, 'buttons.autoplay_off');
            autoplayEmoji = E.dance || '🎲';
            autoplayStyle = ButtonStyle.Secondary;
        }

        const autoplayButton = new ButtonBuilder()
            .setCustomId(`music_autoplay:${requesterId}:${sessionId}`)
            .setLabel(autoplayLabel)
            .setStyle(autoplayStyle)
            .setEmoji(autoplayEmoji)
            .setDisabled(disabled);

        // Lyrics button (only show if lyrics available)
        const lyricsLabel = await LanguageManager.getTranslation(guildId, 'buttons.lyrics') || 'Lyrics';
        const lyricsButton = new ButtonBuilder()
            .setCustomId(`music_lyrics:${requesterId}:${sessionId}`)
            .setLabel(lyricsLabel)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(E.youtube || '🎤')
            .setDisabled(disabled || !player.hasLyrics());

        const row = new ActionRowBuilder()
            .addComponents(pauseButton, skipButton, stopButton, queueButton, shuffleButton);

        const row2 = new ActionRowBuilder()
            .addComponents(volumeButton, loopButton, autoplayButton, lyricsButton);

        return [row, row2];
    }

    /**
     * Kuyruk ekleme mesajı oluşturur
     */
    async createQueueAdditionMessage(tracks, guildId, isPlaylist) {
        if (isPlaylist) {
            return await LanguageManager.getTranslation(guildId, 'musicmanager.playlist_added_to_queue', {
                count: tracks.length
            });
        } else {
            const track = tracks[0];
            const title = track?.title || 'Unknown Track';
            return await LanguageManager.getTranslation(guildId, 'musicmanager.track_added_to_queue', {
                title: title
            });
        }
    }

    /**
     * Duration formatı
     */
    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0:00';

        const totalSeconds = Math.floor(Number(seconds) || 0);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const remainingSeconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }

    /**
     * Platform emoji'si
     */
    getPlatformEmoji(platform) {
        const emojis = {
            youtube: '🔴',
            spotify: '🟢',
            soundcloud: '🟠',
            direct: '🔗'
        };
        return emojis[platform] || '🎵';
    }
}

module.exports = MusicEmbedManager;
