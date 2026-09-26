// ═══════════════════════════════════════════════════════════════════════════
//  src/ResilienceManager.js — نظام التوقعات وحالات الحافة
//  ─────────────────────────────────────────────────────────────────────────
//  هذا الملف يتعامل مع كل الحالات غير المتوقعة:
//
//  التوقعات التي نعالجها:
//    1. اللاعب يخرج من القناة الصوتية أثناء البث
//    2. اللاعب يعطي disconnect للبوت أثناء البث
//    3. البوت ينقطع عن السيرفر أثناء البث
//    4. القناة الصوتية تصبح فارغة
//    5. البوت يُطرد من السيرفر
//    6. السيرفر يُحذف
//    7. انقطاع الإنترنت أثناء البث
//    8. ffmpeg يفشل في معالجة الصوت
//    9. yt-dlp يفشل في جلب stream URL
//   10. voice connection تُقطع فجأة
//   11. البوت يحاول الانضمام لقناة ممتلئة
//   12. الـ token ينتهي أو يُبطل
//   13. القناة الصوتية تُحذف أثناء البث
//   14. العضو يُطرد أثناء البث
//
//  لكل حالة: استجابة محددة + محاولة استرداد + إشعار المستخدم
// ═══════════════════════════════════════════════════════════════════════════
const { VoiceConnectionStatus, getVoiceConnection, entersState } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const chalk = require('chalk');

class ResilienceManager {
    constructor(client) {
        this.client = client;
        // تتبع محاولات إعادة الاتصال لكل guild
        this.reconnectAttempts = new Map();
        // تتبع التايمرات النشطة لكل guild
        this.activeTimers = new Map();
        // تتبع آخر حالة صوتية لكل guild (للاسترداد)
        this.lastKnownStates = new Map();
    }

    /**
     * يتعامل مع VoiceStateUpdate — الحدث الرئيسي للتوقعات
     */
    async handleVoiceStateUpdate(oldState, newState) {
        const guild = oldState.guild;
        const player = this.client.players?.get(guild.id);
        if (!player) return;

        const botMember = guild.members.me;
        const botId = botMember?.id ?? this.client.user.id;
        const involvesBot = oldState.id === botId || newState.id === botId;

        // ── التوقع 2 & 3: البوت يتعرض لـ disconnect ──
        if (involvesBot) {
            return await this.handleBotVoiceChange(oldState, newState, player, guild);
        }

        // ── توقع 1, 4: تغيير حالة اللاعب ──
        return await this.handleUserVoiceChange(oldState, newState, player, guild);
    }

    /**
     * يتعامل مع تغيير حالة البوت الصوتية
     * يشمل: تم قطع البوت، البوت نُقل لقناة أخرى، البوت كُتم
     */
    async handleBotVoiceChange(oldState, newState, player, guild) {
        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;

        // ── التوقع 2: البوت تم disconnect (طُرد من القناة) ──
        if (oldChannelId && !newChannelId) {
            console.log(chalk.yellow(`⚠️ [${guild.name}] Bot was disconnected from voice channel`));

            // ✅ 24/7 mode: لو مفعّل، حاول إعادة الاتصال فوراً
            if (player.stayInChannel) {
                console.log(chalk.cyan(`🔁 [${guild.name}] 24/7 mode is ON — attempting auto-reconnect...`));
                // احفظ معرّف القناة الأخيرة قبل المحاولة
                player.lastVoiceChannelId = oldChannelId;

                // لا تنظّف player — نحاول إعادة الاتصال
                try {
                    // أمّن حالة الـ UI بحيث لا يظهر "stopped" خلال محاولة إعادة الاتصال
                    // (لا نستدعي handlePlaybackEnd هنا)
                    await this.attemptVoiceReconnect247(guild.id, oldChannelId, player);
                } catch (err) {
                    console.error('❌ 24/7 reconnect attempt failed:', err.message);
                    // fallback للتنظيف إذا فشلت إعادة الاتصال
                    setTimeout(() => {
                        try { player.cleanup(); } catch (e) {}
                        this.client.players.delete(guild.id);
                        this.clearTimers(guild.id);
                    }, config.resilience.cleanupDelay);
                }
                return;
            }

            // حفظ الحالة قبل التنظيف للاسترداد لاحقاً
            this.saveStateForRecovery(guild.id, player);

            // تحديث الـ UI لإظهار "توقف البث"
            try {
                const embedManager = this.client.musicEmbedManager || global.clients?.musicEmbedManager;
                player.pendingEndReason = 'forced-disconnect';

                if (embedManager) {
                    await embedManager.handlePlaybackEnd(player);
                } else if (typeof player.showQueueCompleted === 'function') {
                    await player.showQueueCompleted();
                }
            } catch (error) {
                console.error('Failed to update UI after forced disconnect:', error);
            } finally {
                // تنظيف الموارد بعد تأخير قصير
                setTimeout(() => {
                    try {
                        player.cleanup();
                        this.client.players.delete(guild.id);
                        this.clearTimers(guild.id);
                        console.log(chalk.green(`✅ [${guild.name}] Cleaned up after forced disconnect`));
                    } catch (e) {
                        console.error('Cleanup error:', e);
                    }
                }, config.resilience.cleanupDelay);
            }
            return;
        }

        // ── التوقع 10: البوت نُقل لقناة أخرى ──
        if (newChannelId && oldChannelId !== newChannelId) {
            console.log(chalk.cyan(`🔄 [${guild.name}] Bot moved to channel ${newChannelId}`));
            try {
                if (newState.channel) {
                    await player.moveToChannel(newState.channel);
                    player.clearInactivityTimer(false);

                    if (this.client.musicEmbedManager) {
                        await this.client.musicEmbedManager.updateNowPlayingEmbed(player);
                    }

                    // استئناف التشغيل إذا كان متوقفاً بسبب "alone"
                    if (player.pauseReasons?.has('alone')) {
                        player.resumeFor('alone');
                    }
                }
            } catch (error) {
                console.error('Failed to move bot to new channel:', error);
            }
            return;
        }

        // ── كتم/إلغاء كتم البوت ──
        const wasMuted = oldState.serverMute || oldState.serverDeaf || oldState.suppress;
        const isMuted = newState.serverMute || newState.serverDeaf || newState.suppress;

        if (!wasMuted && isMuted) {
            console.log(chalk.gray(`🔇 [${guild.name}] Bot was muted/deafened — pausing playback`));
            const paused = player.pauseFor('mute');
            if (paused && this.client.musicEmbedManager) {
                await this.client.musicEmbedManager.updateNowPlayingEmbed(player);
            }
        } else if (wasMuted && !isMuted) {
            console.log(chalk.gray(`🔊 [${guild.name}] Bot was unmuted — resuming playback`));
            const resumed = player.resumeFor('mute');
            if (this.client.musicEmbedManager && (resumed || !player.pauseReasons?.has('mute'))) {
                await this.client.musicEmbedManager.updateNowPlayingEmbed(player);
            }
        }
    }

    /**
     * يتعامل مع تغيير حالة المستخدم (لا البوت)
     * يشمل: لاعب خرج من القناة، القناة أصبحت فارغة، لاعب انضم
     */
    async handleUserVoiceChange(oldState, newState, player, guild) {
        const voiceChannelId = player.voiceChannel?.id;
        if (!voiceChannelId) return;

        // إذا كان التغيير في قناة البوت
        if (oldState.channelId === voiceChannelId || newState.channelId === voiceChannelId) {
            const channel = guild.channels.cache.get(voiceChannelId);

            // ── التوقع 13: القناة الصوتية حُذفت ──
            if (!channel) {
                console.log(chalk.yellow(`⚠️ [${guild.name}] Voice channel was deleted — cleaning up`));
                player.cleanup();
                this.client.players.delete(guild.id);
                this.clearTimers(guild.id);
                return;
            }

            const listeners = channel.members.filter(member => !member.user.bot).size;

            // ── التوقع 4: القناة أصبحت فارغة ──
            if (listeners === 0) {
                // ✅ 24/7 mode: لو مفعّل، لا تبدأ timer و لا تُوقف التشغيل
                if (player.stayInChannel) {
                    console.log(chalk.cyan(`🕐 [${guild.name}] Channel empty — 24/7 mode is ON, staying in channel`));
                    return;
                }
                console.log(chalk.cyan(`🔇 [${guild.name}] Voice channel empty — starting inactivity timer`));
                const alreadyPaused = player.pauseReasons?.has('alone');
                player.startInactivityTimer();

                if (!alreadyPaused && this.client.musicEmbedManager && player.currentTrack) {
                    await this.client.musicEmbedManager.updateNowPlayingEmbed(player);
                }
            } else {
                // ── التوقع 1: عاد لاعب للقناة ──
                const wasPausedForAlone = player.pauseReasons?.has('alone');
                player.clearInactivityTimer(true);

                if (wasPausedForAlone && this.client.musicEmbedManager && player.currentTrack) {
                    await this.client.musicEmbedManager.updateNowPlayingEmbed(player);
                }
            }
        }
    }

    /**
     * يتعامل مع انقطاع اتصال Discord WebSocket
     * التوقع 3, 7, 12
     */
    async handleWebSocketError(guildId, error) {
        console.error(chalk.red(`❌ [${guildId}] WebSocket error: ${error.message}`));

        const player = this.client.players?.get(guildId);
        if (!player) return;

        // تحقق إذا كان الخطأ متعلق بـ IP discovery (مشكلة صوتية شائعة)
        if (error.message && error.message.includes('IP discovery')) {
            console.log(chalk.yellow(`⚠️ [${guildId}] IP discovery failed — cleaning up voice connections`));
            try {
                player.cleanup();
                this.client.players.delete(guildId);
                this.clearTimers(guildId);
            } catch (e) {
                console.error('Cleanup failed:', e);
            }
            return;
        }

        // أخطاء rate limiting
        if (error.code === 4006 || error.code === 4014) {
            console.log(chalk.yellow(`⚠️ [${guildId}] Voice connection closed (${error.code})`));
            await this.attemptVoiceReconnect(guildId);
        }
    }

    /**
     * يحاول إعادة الاتصال الصوتي تلقائياً
     * التوقع 10: voice connection تُقطع فجأة
     */
    async attemptVoiceReconnect(guildId) {
        const maxAttempts = config.resilience.maxReconnectAttempts;
        const currentAttempts = this.reconnectAttempts.get(guildId) || 0;

        if (currentAttempts >= maxAttempts) {
            console.log(chalk.red(`❌ [${guildId}] Max reconnect attempts reached (${maxAttempts})`));
            await this.notifyGuildOwner(guildId, '⚠️ تعذّر إعادة الاتصال بالقناة الصوتية بعد عدة محاولات. ستحتاج لتشغيل الأغنية يدوياً.');
            const player = this.client.players.get(guildId);
            if (player) {
                player.cleanup();
                this.client.players.delete(guildId);
            }
            this.clearTimers(guildId);
            this.reconnectAttempts.delete(guildId);
            return;
        }

        this.reconnectAttempts.set(guildId, currentAttempts + 1);
        console.log(chalk.cyan(`🔄 [${guildId}] Reconnect attempt ${currentAttempts + 1}/${maxAttempts}`));

        const player = this.client.players.get(guildId);
        if (!player) return;

        const voiceChannel = player.voiceChannel;
        const textChannel = player.textChannel;
        const currentTrack = player.currentTrack;
        const queuePosition = player.currentTrack ? player.queue.indexOf(currentTrack) : 0;

        try {
            // انتظر قليلاً قبل المحاولة
            await new Promise(resolve => setTimeout(resolve, config.resilience.reconnectTimeout));

            // أعد الاتصال
            if (voiceChannel && textChannel) {
                const newPlayer = new (require('./MusicPlayer'))(player.guild, textChannel, voiceChannel);
                this.client.players.set(guildId, newPlayer);

                // ✅ [FIX تسريب موارد] أوقف مؤقتات المشغل القديم (فحص الصوت كل 30ث + مزامنة الحالة)
                // كانت تبقى تعمل للأبد بعد استبداله، وتسبب محاولات استعادة وهمية (تضارب)
                try {
                    player.stopConnectionRecovery?.();
                    if (player.connectionHealthCheck) {
                        clearInterval(player.connectionHealthCheck);
                        player.connectionHealthCheck = null;
                    }
                    player.stopStateSync?.();
                    player.disconnect?.();
                } catch (e) { /* تجاهل */ }

                // استئناف الأغنية نفسها من نفس النقطة (إذا كان مفعّلاً)
                if (config.resilience.autoResumeAfterReconnect && currentTrack) {
                    console.log(chalk.cyan(`🔄 [${guildId}] Resuming playback: ${currentTrack.title}`));
                    // ✅ [FIX] الكود القديم كان يمرر الأغنية كـ trackIndex بالخطأ (الصحيح null)
                    // ويقرأ player.currentTime (خاصية غير موجودة — الصحيح getCurrentTime())
                    // فكان الاستئناف يفشل بصمت وتُفقد القائمة القديمة بالكامل
                    newPlayer.currentTrack = currentTrack;
                    if (player.queue && player.queue.length > 0) {
                        newPlayer.queue.push(...player.queue);
                    }
                    newPlayer.volume = (typeof player.volume === 'number') ? player.volume : newPlayer.volume;
                    newPlayer.loop = player.loop ?? newPlayer.loop;
                    const resumeMs = (typeof player.getCurrentTime === 'function')
                        ? Math.max(0, Math.floor(player.getCurrentTime()))
                        : 0;
                    await newPlayer.play(null, resumeMs);
                }

                this.reconnectAttempts.delete(guildId);
                console.log(chalk.green(`✅ [${guildId}] Reconnected successfully`));
            }
        } catch (error) {
            console.error(chalk.red(`❌ [${guildId}] Reconnect failed: ${error.message}`));
            // حاول مرة أخرى
            setTimeout(() => this.attemptVoiceReconnect(guildId), config.resilience.reconnectTimeout);
        }
    }

    /**
     * ✅ إعادة اتصال خاصة بوضع 24/7
     * تُحاول إعادة البوت لقناته الأصلية بعد قطع قسري.
     * تختلف عن attemptVoiceReconnect في:
     *   - عدد محاولات أعلى (5 بدل 3)
     *   - تأخير أطول بين المحاولات (10 ثواني)
     *   - إشعار الـ guild owner عند الفشل النهائي
     */
    async attemptVoiceReconnect247(guildId, channelId, oldPlayer) {
        const maxAttempts = 5;
        const delayMs = 10000;
        let attempt = oldPlayer.reconnectAttempts || 0;

        console.log(chalk.cyan(`🔁 [24/7] Reconnect attempt ${attempt + 1}/${maxAttempts} for guild ${guildId} → channel ${channelId}`));

        if (attempt >= maxAttempts) {
            console.error(chalk.red(`❌ [24/7] Max reconnect attempts reached for guild ${guildId}`));
            // نظّف الموارد ونظّر الـ owner
            try { oldPlayer.cleanup(); } catch (e) {}
            this.client.players.delete(guildId);
            this.clearTimers(guildId);
            oldPlayer.reconnectAttempts = 0;
            await this.notifyGuildOwner(guildId, '⚠️ تعذّر إعادة البوت لقناتك الصوتية بعد 5 محاولات (وضع 24/7). شغّل `/play` يدوياً لاستئناف التشغيل.');
            return;
        }

        oldPlayer.reconnectAttempts = attempt + 1;

        try {
            // انتظر قبل المحاولة
            await new Promise(resolve => setTimeout(resolve, delayMs));

            // احصل على القناة من Guild
            const guild = oldPlayer.guild;
            if (!guild) throw new Error('Guild not available');
            // cache may need refresh
            await guild.channels.fetch(channelId).catch(() => null);
            const voiceChannel = guild.channels.cache.get(channelId);
            if (!voiceChannel || !voiceChannel.isVoiceBased?.()) {
                throw new Error(`Voice channel ${channelId} not found or not voice-based`);
            }
            // تحقق من الصلاحيات
            const perms = voiceChannel.permissionsFor(guild.members.me);
            if (!perms?.has('Connect') || !perms?.has('Speak')) {
                throw new Error('Missing Connect/Speak permissions in target channel');
            }

            // أنشئ player جديد بنفس الـ textChannel والأغاني
            const textChannel = oldPlayer.textChannel;
            const MusicPlayer = require('./MusicPlayer');
            const newPlayer = new MusicPlayer(guild, textChannel, voiceChannel);
            // انقل stayInChannel حتى يستمر وضع 24/7
            newPlayer.stayInChannel = true;
            newPlayer.lastVoiceChannelId = channelId;
            newPlayer.reconnectAttempts = 0;
            // انقل القائمة الحالية (إن وجدت)
            if (oldPlayer.currentTrack) newPlayer.queue.unshift(oldPlayer.currentTrack);
            if (oldPlayer.queue?.length) newPlayer.queue.push(...oldPlayer.queue);
            newPlayer.volume = oldPlayer.volume || 100;
            newPlayer.loop = oldPlayer.loop || 'off';
            newPlayer.shuffle = !!oldPlayer.shuffle;
            newPlayer.autoplay = !!oldPlayer.autoplay;

            this.client.players.set(guildId, newPlayer);

            // ✅ [FIX تسريب موارد] أوقف مؤقتات المشغل القديم بعد استبداله
            try {
                oldPlayer.stopConnectionRecovery?.();
                if (oldPlayer.connectionHealthCheck) {
                    clearInterval(oldPlayer.connectionHealthCheck);
                    oldPlayer.connectionHealthCheck = null;
                }
                oldPlayer.stopStateSync?.();
            } catch (e) { /* تجاهل */ }

            // ابدأ التشغيل فوراً (الأغنية الأولى في queue هي currentTrack السابقة)
            if (newPlayer.queue.length > 0) {
                const firstTrack = newPlayer.queue.shift();
                newPlayer.currentTrack = firstTrack;
                if (!newPlayer.connection) await newPlayer.connect();
                const playResult = await newPlayer.play();

                // ✅ [FIX] لا تُنشئ كارتاً إذا أُبطل التشغيل (طلب أحدث استحوذ)
                if (!playResult?.stale) {
                    // أنشئ NowPlaying card جديدة
                    const embedManager = this.client.musicEmbedManager || global.clients?.musicEmbedManager;
                    if (embedManager) {
                        const member = newPlayer.guild.members.me;
                        await embedManager.createNewMusicEmbed(newPlayer, firstTrack, member, null);
                    }
                }
            }

            console.log(chalk.green(`✅ [24/7] Reconnected to channel ${channelId} in guild ${guildId}`));
        } catch (err) {
            console.error(chalk.red(`❌ [24/7] Reconnect attempt ${attempt + 1} failed: ${err.message}`));
            // حاول مرة أخرى بعد تأخير
            setTimeout(() => this.attemptVoiceReconnect247(guildId, channelId, oldPlayer), delayMs);
        }
    }

    /**
     * يحفظ حالة الـ player للاسترداد لاحقاً (بعد restart)
     * التوقع: البوت أعيد تشغيله، نريد استرداد الجلسة
     */
    saveStateForRecovery(guildId, player) {
        try {
            if (!player || !player.currentTrack) return;

            const state = {
                guildId,
                voiceChannelId: player.voiceChannel?.id,
                textChannelId: player.textChannel?.id,
                currentTrack: player.currentTrack,
                queue: player.queue || [],
                currentTime: player.currentTime || 0,
                timestamp: Date.now(),
            };

            this.lastKnownStates.set(guildId, state);
            console.log(chalk.gray(`💾 [${guildId}] State saved for recovery`));
        } catch (error) {
            console.error('Failed to save state for recovery:', error);
        }
    }

    /**
     * يسترد آخر حالة معروفة (بعد restart)
     */
    getSavedState(guildId) {
        const state = this.lastKnownStates.get(guildId);
        if (!state) return null;

        // انتهت صلاحية الحالة بعد ساعة
        if (Date.now() - state.timestamp > 60 * 60 * 1000) {
            this.lastKnownStates.delete(guildId);
            return null;
        }

        return state;
    }

    /**
     * ينظف كل التايمرات النشطة للـ guild
     */
    clearTimers(guildId) {
        const timers = this.activeTimers.get(guildId);
        if (timers && Array.isArray(timers)) {
            timers.forEach(timer => {
                clearTimeout(timer);
                clearInterval(timer);
            });
        }
        this.activeTimers.delete(guildId);
        this.reconnectAttempts.delete(guildId);
    }

    /**
     * يضيف تايمر للقائمة النشطة
     */
    addTimer(guildId, timer) {
        if (!this.activeTimers.has(guildId)) {
            this.activeTimers.set(guildId, []);
        }
        this.activeTimers.get(guildId).push(timer);
    }

    /**
     * يرسل إشعار لـ owner السيرفر (للأخطاء الحرجة)
     */
    async notifyGuildOwner(guildId, message) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const owner = await guild.fetchOwner().catch(() => null);
            if (!owner) return;

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('⚠️ إشعار من البوت')
                .setDescription(message)
                .setFooter({ text: `Server: ${guild.name}` })
                .setTimestamp();

            await owner.send({ embeds: [embed] }).catch(() => {
                // العضو قد يكون أغلق DMs — تجاهل
            });
        } catch (error) {
            console.error('Failed to notify guild owner:', error);
        }
    }

    /**
     * يتعامل مع خطأ ffmpeg أثناء البث
     * التوقع 8: ffmpeg فشل في معالجة الصوت
     */
    async handleFfmpegError(guildId, error, player) {
        console.error(chalk.red(`❌ [${guildId}] ffmpeg error: ${error.message}`));

        if (!player) return;

        try {
            // حاول التوقف بأمان ثم إعادة التشغيل
            player.stop();
            console.log(chalk.yellow(`⚠️ [${guildId}] Playback stopped due to ffmpeg error`));

            // إشعار المستخدم
            const textChannel = player.textChannel;
            if (textChannel) {
                const embed = new EmbedBuilder()
                    .setColor(config.bot.embedColor)
                    .setTitle('⚠️ خطأ في البث')
                    .setDescription('حدث خطأ أثناء معالجة الصوت. جاري محاولة استئناف التشغيل...')
                    .setTimestamp();

                const msg = await textChannel.send({ embeds: [embed] }).catch(() => null);

                // حاول استئناف الأغنية بعد 2 ثانية
                setTimeout(async () => {
                    try {
                        if (player.currentTrack) {
                            // ✅ [FIX] الكود القديم كان يمرر الأغنية كـ trackIndex (خطأ — تجاهل داخلي).
                            // الصحيح: play(null, 0) لإعادة تشغيل الأغنية الحالية من البداية
                            const resumeResult = await player.play(null, 0);
                            if (msg) {
                                if (resumeResult?.stale) {
                                    await msg.edit({
                                        embeds: [embed.setDescription('ℹ️ عملية تشغيل أحدث جارية — تم التخطي.')],
                                    });
                                } else {
                                    await msg.edit({
                                        embeds: [embed.setDescription('✅ تم استئناف التشغيل بنجاح!')],
                                    });
                                }
                            }
                        }
                    } catch (resumeError) {
                        console.error('Resume failed:', resumeError);
                        if (msg) {
                            await msg.edit({
                                embeds: [embed.setDescription('❌ تعذّر استئناف التشغيل. استخدم `/play` مرة أخرى.')],
                            });
                        }
                    }
                }, 2000);
            }
        } catch (cleanupError) {
            console.error('Cleanup after ffmpeg error failed:', cleanupError);
        }
    }

    /**
     * يتعامل مع خطأ yt-dlp أثناء جلب stream URL
     * التوقع 9: yt-dlp فشل
     */
    async handleYtDlpError(guildId, error, player) {
        console.error(chalk.red(`❌ [${guildId}] yt-dlp error: ${error.message}`));

        const textChannel = player?.textChannel;
        if (!textChannel) return;

        let errorMessage = '❌ تعذّر جلب الصوت من YouTube.';

        if (error.message && error.message.includes('Sign in to confirm')) {
            errorMessage = '🤖 YouTube طلب التحقق من أنك لست روبوتاً. جاري تجديد الكوكيز وإعادة المحاولة...';
        } else if (error.message && error.message.includes('Private video')) {
            errorMessage = '🔒 هذا الفيديو خاص — لا يمكن تشغيله.';
        } else if (error.message && error.message.includes('Video unavailable')) {
            errorMessage = '❌ الفيديو غير متاح.';
        }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⚠️ خطأ في جلب الصوت')
            .setDescription(errorMessage)
            .setTimestamp();

        await textChannel.send({ embeds: [embed] }).catch(() => {});
    }

    /**
     * تنظيف موارد الـ guild عند الطرد أو حذف السيرفر
     * التوقع 5, 6, 14
     */
    cleanupGuild(guildId) {
        const player = this.client.players?.get(guildId);
        if (player) {
            try {
                player.cleanup();
            } catch (e) {
                console.error('Player cleanup failed:', e);
            }
            this.client.players.delete(guildId);
        }
        this.clearTimers(guildId);
        this.lastKnownStates.delete(guildId);
        console.log(chalk.gray(`🧹 [${guildId}] All resources cleaned up`));
    }

    /**
     * إحصائيات للـ debugging
     */
    getStats() {
        return {
            activePlayers: this.client.players?.size || 0,
            reconnectAttempts: Array.from(this.reconnectAttempts.entries()),
            activeTimers: this.activeTimers.size,
            savedStates: this.lastKnownStates.size,
            uptime: Date.now() - config.env.startTime,
            environment: config.env,
        };
    }
}

module.exports = ResilienceManager;
