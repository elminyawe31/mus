// ═══════════════════════════════════════════════════════════════════════════
//  src/StabilityManager.js — مدير الاستقرار للتشغيل الدائم (Uptime طويل)
//  ─────────────────────────────────────────────────────────────────────────
//  MUS Bot v26.7 — Dev: ELMINYAWE 👨‍💻
//
//  صُمم خصيصاً لتشغيل البوت لأيام/أسابيع/شهور متواصلة بدون تدخل:
//
//  1. 🧠 مراقب الذاكرة (كل 15 دقيقة):
//     - تسجيل استهلاك RSS/Heap دورياً في السجلات
//     - عند تجاوز MEM_WARN_MB: تنظيف كل الكاشات (صور الكارت، كلمات الأغاني)
//     - عند تجاوز MEM_CRITICAL_MB: إعادة تشغيل رشيقة (supervisord يعيد
//       الإقلاع خلال ~15 ثانية + session restore يعيد كل الجلسات تلقائياً)
//       — أفضل من بوت متجمد/ميت يستمر بالعمل شكلياً
//
//  2. 🎤 مراقب الصوت 24/7 (كل دقيقتين):
//     - لأي سيرفر مفعّل فيه stayInChannel (وضع 247) مع اتصال صوتي ميت
//       beyond محاولات الاسترداد الأصلية → يعيد الانضمام والاسترداد
//
//  3. 🖼️ منظّف intervals الكارت (كل 10 دقائق):
//     - يوقف أي card update interval لسيرفر لم يعد له player
//       (يمنع تسرب CPU/ذاكرة تراكمي عبر الأسابيع)
//
//  4. 🧹 نظافة ملفات الكاش الصوتي (كل ساعة):
//     - يحذف ملفات audio_cache الأقدم من 24 ساعة (شبكة أمان فوق
//       نظام الحصة الموجود في MusicPlayer)
//
//  5. ⏰ إعادة تشغيل مجدولة اختيارية (AUTO_RESTART_HOURS):
//     - افتراضياً معطلة (0). عند ضبطها (مثلاً 168 = أسبوع) يعيد
//       تشغيل البوت رشيقاً في وقت التشغيل المحدد مع تحذير مسبق
//
//  6. 📊 تقرير حالة دوري (كل 6 ساعات): uptime، سيرفرات، players، ذاكرة
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs').promises;
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'audio_cache');

class StabilityManager {
    constructor() {
        this.initialized = false;
        this.client = null;
        this.timers = [];
        this.startTime = Date.now();
        this.restarting = false;

        // إعدادات من environment (مع قيم افتراضية آمنة)
        this.memWarnMB = parseInt(process.env.MEM_WARN_MB || '600', 10);
        this.memCriticalMB = parseInt(process.env.MEM_CRITICAL_MB || '1200', 10);
        this.autoRestartOnOOM = (process.env.AUTO_RESTART_ON_OOM || '1') === '1';
        this.autoRestartHours = parseFloat(process.env.AUTO_RESTART_HOURS || '0');
        this.audioCacheMaxAgeH = parseFloat(process.env.AUDIO_CACHE_MAX_AGE_H || '24');
    }

    /**
     * تهيئة المدير — تُستدعى مرة واحدة بعد جاهزية البوت
     */
    init(client) {
        if (this.initialized) return;
        this.initialized = true;
        this.client = client;

        console.log('🛡️ [Stability] Manager initialized:');
        console.log(`   • Memory watchdog: warn>${this.memWarnMB}MB critical>${this.memCriticalMB}MB (restart-on-OOM: ${this.autoRestartOnOOM ? 'ON' : 'OFF'})`);
        console.log(`   • Voice 24/7 watchdog: every 2min`);
        console.log(`   • Card interval cleanup: every 10min`);
        console.log(`   • Audio cache hygiene: hourly (max age ${this.audioCacheMaxAgeH}h)`);
        if (this.autoRestartHours > 0) {
            console.log(`   • Scheduled restart: every ${this.autoRestartHours}h`);
        }

        this._startMemoryWatchdog();
        this._startVoiceWatchdog();
        this._startCardIntervalCleanup();
        this._startCacheHygiene();
        this._startStatusReport();

        if (this.autoRestartHours > 0) {
            this._startScheduledRestart();
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    //  1. مراقب الذاكرة — كل 15 دقيقة
    // ═════════════════════════════════════════════════════════════════════
    _startMemoryWatchdog() {
        const t = setInterval(() => {
            try {
                this._checkMemory();
            } catch (e) {
                console.error('[Stability] Memory watchdog error:', e.message);
            }
        }, 15 * 60 * 1000);
        if (t.unref) t.unref();
        this.timers.push(t);
    }

    _checkMemory() {
        const mem = process.memoryUsage();
        const rssMB = Math.round(mem.rss / 1024 / 1024);
        const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
        const uptimeH = ((Date.now() - this.startTime) / 3600000).toFixed(1);

        if (rssMB >= this.memCriticalMB) {
            console.error(`🚨 [Stability] CRITICAL memory: RSS=${rssMB}MB heap=${heapMB}/${heapTotalMB}MB uptime=${uptimeH}h`);
            if (this.autoRestartOnOOM && !this.restarting) {
                console.error('🚨 [Stability] Memory critical — performing graceful restart (supervisord will revive in ~15s)');
                this.gracefulRestart('memory-critical');
            }
            return;
        }

        if (rssMB >= this.memWarnMB) {
            console.warn(`⚠️ [Stability] High memory: RSS=${rssMB}MB heap=${heapMB}/${heapTotalMB}MB uptime=${uptimeH}h — purging caches`);
            this.purgeAllCaches();
        } else {
            // تسجيل دوري هادئ (مرة كل 15 دقيقة — لا يزعج السجلات)
            console.log(`🧠 [Stability] Memory OK: RSS=${rssMB}MB heap=${heapMB}MB | uptime=${uptimeH}h | players=${this.client?.players?.size || 0}`);
        }

        // GC يدوي إذا كان متاحاً (--expose-gc)
        try {
            if (typeof global.gc === 'function') global.gc();
        } catch (e) { /* غير متاح — تجاهل */ }
    }

    /**
     * تنظيف كل الكاشات القابلة للتنظيف (يُستدعى أيضاً عند ضغط الذاكرة)
     */
    purgeAllCaches() {
        let purged = [];
        try {
            // 1) كاش صور كارت NowPlaying
            const MusicCard = require('./MusicCard');
            if (MusicCard.purgeCaches) {
                MusicCard.purgeCaches();
                purged.push('card-images');
            }
        } catch (e) { /* تجاهل */ }

        try {
            // 2) كاش كلمات الأغاني (قص إلى 50 مدخلاً فقط)
            const LyricsManager = require('./LyricsManager');
            if (LyricsManager.trimCache) {
                const removed = LyricsManager.trimCache(50);
                purged.push(`lyrics(-${removed})`);
            }
        } catch (e) { /* تجاهل */ }

        try {
            // 3) طوابير preload الزائدة في كل player (تحرير ملفات مؤقتة)
            const players = this.client?.players;
            if (players) {
                for (const [, player] of players) {
                    try {
                        if (player.preloadedStreams && player.preloadedStreams.size > 3) {
                            const urls = [...player.preloadedStreams.keys()];
                            for (let i = 0; i < urls.length - 3; i++) {
                                try { player.preloadedStreams.delete(urls[i]); } catch (e) {}
                            }
                        }
                    } catch (e) { /* تجاهل player فردي */ }
                }
                purged.push('player-preloads');
            }
        } catch (e) { /* تجاهل */ }

        console.log(`🧹 [Stability] Purged caches: ${purged.join(', ') || 'none'}`);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  2. مراقب الصوت 24/7 — كل دقيقتين
    // ═════════════════════════════════════════════════════════════════════
    _startVoiceWatchdog() {
        const t = setInterval(() => {
            try {
                this._checkVoiceConnections();
            } catch (e) { /* تجاهل */ }
        }, 2 * 60 * 1000);
        if (t.unref) t.unref();
        this.timers.push(t);
    }

    _checkVoiceConnections() {
        const players = this.client?.players;
        if (!players || players.size === 0) return;

        for (const [guildId, player] of players) {
            try {
                // فقط لوضع 247 أو أثناء تشغيل فعلي
                const shouldStay = player.stayInChannel || player.currentTrack;
                if (!shouldStay) continue;

                // إذا كان نظام الاسترداد الداخلي يعمل — لا تتدخل
                if (player.isRecovering) continue;

                const conn = player.connection;
                const status = conn?.state?.status;
                const dead = !conn || status === 'destroyed' || status === 'disconnected' || status === 'signalling';

                if (dead && player.voiceChannel) {
                    console.warn(`🎤 [Stability] Voice connection dead for ${guildId} (status=${status || 'none'}) — attempting recovery`);
                    // استخدم نظام الاسترداد المدمج في MusicPlayer
                    if (typeof player.startConnectionRecovery === 'function') {
                        player.startConnectionRecovery();
                    }
                }
            } catch (e) { /* تجاهل player فردي */ }
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    //  3. منظّف intervals الكارت — كل 10 دقائق
    // ═════════════════════════════════════════════════════════════════════
    _startCardIntervalCleanup() {
        const t = setInterval(() => {
            try {
                const mgr = this.client?.musicEmbedManager || global.clients?.musicEmbedManager;
                if (!mgr || !mgr.cardIntervals) return;

                const players = this.client?.players;
                let stopped = 0;
                for (const guildId of mgr.cardIntervals.keys()) {
                    if (!players || !players.has(guildId)) {
                        mgr.stopCardUpdateInterval(guildId);
                        stopped++;
                    }
                }
                if (stopped > 0) {
                    console.log(`🖼️ [Stability] Stopped ${stopped} orphaned card interval(s)`);
                }
            } catch (e) { /* تجاهل */ }
        }, 10 * 60 * 1000);
        if (t.unref) t.unref();
        this.timers.push(t);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  4. نظافة ملفات الكاش الصوتي — كل ساعة
    // ═════════════════════════════════════════════════════════════════════
    _startCacheHygiene() {
        const t = setInterval(() => {
            this._cleanOldAudioFiles().catch(() => {});
        }, 60 * 60 * 1000);
        if (t.unref) t.unref();
        this.timers.push(t);
    }

    async _cleanOldAudioFiles() {
        try {
            const files = await fs.readdir(CACHE_DIR).catch(() => []);
            const maxAgeMs = this.audioCacheMaxAgeH * 3600 * 1000;
            const now = Date.now();
            let deleted = 0, freedBytes = 0;

            // لا تحذف ملف الأغنية الجارية في أي سيرفر
            const protectedFiles = new Set();
            const players = this.client?.players;
            if (players) {
                for (const [, player] of players) {
                    try {
                        if (player.currentDownloadedFile) {
                            protectedFiles.add(path.basename(player.currentDownloadedFile));
                        }
                    } catch (e) {}
                }
            }

            for (const file of files) {
                if (protectedFiles.has(file)) continue;
                const fullPath = path.join(CACHE_DIR, file);
                try {
                    const st = await fs.stat(fullPath);
                    if (st.isFile() && (now - st.mtimeMs) > maxAgeMs) {
                        await fs.unlink(fullPath);
                        deleted++;
                        freedBytes += st.size;
                    }
                } catch (e) { /* تجاهل ملف فردي */ }
            }

            if (deleted > 0) {
                console.log(`🧹 [Stability] Audio cache hygiene: deleted ${deleted} file(s), freed ${(freedBytes / 1024 / 1024).toFixed(1)}MB`);
            }
        } catch (e) { /* تجاهل */ }
    }

    // ═════════════════════════════════════════════════════════════════════
    //  5. إعادة تشغيل مجدولة اختيارية
    // ═════════════════════════════════════════════════════════════════════
    _startScheduledRestart() {
        const restartMs = this.autoRestartHours * 3600 * 1000;

        // تحذير قبل 10 دقائق
        const warnT = setTimeout(() => {
            console.log(`⏰ [Stability] Scheduled restart in 10 minutes (uptime ${this.autoRestartHours}h reached)`);
        }, Math.max(restartMs - 10 * 60 * 1000, 1000));
        if (warnT.unref) warnT.unref();

        const restartT = setTimeout(() => {
            this.gracefulRestart('scheduled');
        }, restartMs);
        if (restartT.unref) restartT.unref();
    }

    // ═════════════════════════════════════════════════════════════════════
    //  6. تقرير الحالة الدوري — كل 6 ساعات
    // ═════════════════════════════════════════════════════════════════════
    _startStatusReport() {
        const t = setInterval(() => {
            try {
                const mem = process.memoryUsage();
                const rssMB = Math.round(mem.rss / 1024 / 1024);
                const uptimeH = ((Date.now() - this.startTime) / 3600000).toFixed(1);
                const players = this.client?.players?.size || 0;
                const guilds = this.client?.guilds?.cache?.size || 0;

                let cardStats = '';
                try {
                    const MusicCard = require('./MusicCard');
                    const s = MusicCard.getStats ? MusicCard.getStats() : null;
                    if (s) cardStats = ` | cardImgs=${s.cachedImages} cjk=${s.hasCJKFont ? 'Y' : 'N'}`;
                } catch (e) {}

                console.log(`📊 [Stability] STATUS: uptime=${uptimeH}h | guilds=${guilds} | players=${players} | RSS=${rssMB}MB${cardStats}`);
            } catch (e) { /* تجاهل */ }
        }, 6 * 3600 * 1000);
        if (t.unref) t.unref();
        this.timers.push(t);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  إعادة التشغيل الرشيقة
    // ═════════════════════════════════════════════════════════════════════
    gracefulRestart(reason) {
        if (this.restarting) return;
        this.restarting = true;

        console.log(`🔄 [Stability] Graceful restart triggered: ${reason}`);
        console.log('🔄 [Stability] Saving state & destroying players...');

        try {
            const players = this.client?.players;
            if (players) {
                for (const [guildId, player] of players) {
                    try {
                        // حفظ موضع التشغيل للاسترداد بعد الإقلاع
                        if (typeof player.savePlaybackPosition === 'function') {
                            player.savePlaybackPosition();
                        }
                        if (typeof player.cleanup === 'function') {
                            player.cleanup();
                        }
                    } catch (e) { /* تجاهل player فردي */ }
                }
            }
        } catch (e) { /* تجاهل */ }

        // أعط الوقت للعمليات غير المتزامنة ثم اخرج — supervisord يعيد الإقلاع
        setTimeout(() => {
            try { this.client?.destroy?.(); } catch (e) {}
            process.exit(1); // exit(1) ليتفعل autorestart في supervisord فوراً
        }, 1500);
        // احتياط: لو فشل كل شيء أعلاه — اخرج قسراً بعد 5 ثوان
        const failSafe = setTimeout(() => process.exit(1), 5000);
        if (failSafe.unref) failSafe.unref();
    }

    /**
     * معلومات الحالة الحالية (لأوامر التشخيص مستقبلاً)
     */
    getStatus() {
        const mem = process.memoryUsage();
        return {
            initialized: this.initialized,
            uptimeHours: ((Date.now() - this.startTime) / 3600000).toFixed(1),
            rssMB: Math.round(mem.rss / 1024 / 1024),
            heapMB: Math.round(mem.heapUsed / 1024 / 1024),
            players: this.client?.players?.size || 0,
            scheduledRestartHours: this.autoRestartHours,
        };
    }
}

module.exports = new StabilityManager();
