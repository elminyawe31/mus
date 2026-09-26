// ═══════════════════════════════════════════════════════════════════════════
//  config.js — إعدادات MUS Bot v26.0
//  ─────────────────────────────────────────────────────────────────────────
//  يدعم: Railway (IPv6 native) + WARP fallback + Spotify + yt-dlp + bgutil
// ═══════════════════════════════════════════════════════════════════════════
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// ── كشف البيئة: هل نحن على Railway؟ ────────────────────────────────────────
const isRailway = !!process.env.RAILWAY_PROJECT_ID || !!process.env.RAILWAY_SERVICE_ID;

// ── كشف IPv6 outbound: نحاول الوصول لـ Google عبر IPv6 ────────────────────
// Railway مع "Outbound IPv6" مفعّل يدعم الاتصال المباشر بـ YouTube بدون WARP
let ipv6Available = false;
try {
    // cached check — sync at startup
    const { execSync } = require('child_process');
    execSync('curl -6 -s --max-time 3 https://api64.ipify.org', { stdio: 'pipe' });
    ipv6Available = true;
} catch (e) {
    ipv6Available = false;
}

// ── تحديد وضع التشغيل ─────────────────────────────────────────────────────
// 3 أوضاع:
//   1. "ipv6"  — اتصال مباشر عبر IPv6 (الأفضل على Railway)
//   2. "warp"  — نفق Cloudflare WARP (عند فشل IPv6)
//   3. "auto"  — يحاول IPv6 أولاً، ثم WARP (الافتراضي)
const connectionMode = process.env.YT_CONNECTION_MODE || 'auto';

// ── تحديد proxy الفعلي بناءً على الوضع ─────────────────────────────────────
function resolveProxy() {
    const mode = connectionMode.toLowerCase();
    if (mode === 'ipv6') return null; // لا proxy — اتصال مباشر
    if (mode === 'warp') return process.env.YT_PROXY || 'socks5://127.0.0.1:1080';
    // auto: استخدم WARP فقط إذا IPv6 غير متاح
    if (mode === 'auto') {
        if (ipv6Available) return null;
        return process.env.YT_PROXY || 'socks5://127.0.0.1:1080';
    }
    return null;
}

const resolvedProxy = resolveProxy();


// ── معلومات البوت والبصمة ─────────────────────────────────────────────────
const BOT_INFO = {
    name: 'MUS',
    version: '26.10.0',
    developer: 'ELMINYAWE',
    developerEmoji: '👨‍💻',
    developerId: process.env.DEVELOPER_ID || '1003378222400020510',
    signature: 'Dev: ELMINYAWE 👨‍💻',
    description: 'MUS — All-in-One Discord Bot (Music • Moderation • AutoMod • Giveaways • Profiles)',
    github: 'https://github.com/elminyawe31/mus',
    support: 'https://discord.gg/2yJ7Uh5EtS',
};

module.exports = {
    // ── إعدادات Discord ──────────────────────────────────────────────────────
    discord: {
        token: process.env.DISCORD_TOKEN || 'YOUR_DISCORD_BOT_TOKEN_HERE',
        clientId: process.env.CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
        guildId: process.env.GUILD_ID || null,
    },

    // ── إعدادات Spotify API (مدمجة افتراضياً من elminyawe) ─────────────────
    // هذه المفاتيح عامة ومجانية من Spotify for Developers
    // تم تضمينها هنا لتسهيل النشر بدون إعداد إضافي
    // إذا أردت استخدام مفاتيحك الخاصة، مررها كـ env variables
    spotify: {
        clientId: process.env.SPOTIFY_CLIENT_ID || 'b9a4b5775f1847a2b072573589b530f7',
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '682ef411fa5942d28bfe6c409e90f202',
        // Market code for Spotify search (e.g., 'US', 'EG', 'SA')
        market: process.env.SPOTIFY_MARKET || 'US',
    },

    // ── إعدادات Genius API (لكلمات الأغاني — اختياري) ──────────────────────
    genius: {
        clientId: process.env.GENIUS_CLIENT_ID || '',
        clientSecret: process.env.GENIUS_CLIENT_SECRET || '',
    },

    // ── إعدادات البوت ────────────────────────────────────────────────────────
    bot: {
        name: 'MUS',
        version: '26.10.0',
        developer: 'ELMINYAWE',
        developerId: process.env.DEVELOPER_ID || '1003378222400020510',
        signature: 'Dev: ELMINYAWE 👨‍💻',
        defaultVolume: parseInt(process.env.DEFAULT_VOLUME) || 100,
        maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE) || 100,
        maxPlaylistSize: parseInt(process.env.MAX_PLAYLIST_SIZE) || 50,
        // 🔒 FORCED: status is always "Dev : ELMINYAWE" regardless of env var.
        // Railway may pass STATUS="Beatra / play" from old deploys — we ignore it.
        // Use a defensive filter: if env var contains "beatra", discard it.
        status: (process.env.STATUS && !/beatra/i.test(process.env.STATUS)) ? process.env.STATUS : 'Dev : ELMINYAWE',
        forcedPresence: 'Dev : ELMINYAWE',
        forcedStatus: 'idle',
        embedColor: process.env.EMBED_COLOR || '#FF6B6B',
        supportServer: process.env.SUPPORT_SERVER || 'https://discord.gg/2yJ7Uh5EtS',
        website: process.env.WEBSITE || 'https://github.com/elminyawe31/mus',
        github: 'https://github.com/elminyawe31/mus',
        invite: 'https://discord.com/oauth2/authorize?client_id=' + (process.env.CLIENT_ID || '') + '&permissions=36718592&scope=bot%20applications.commands',
    },

    // ── إعدادات الصوت ────────────────────────────────────────────────────────
    audio: {
        quality: 'highestaudio',
        format: 'mp3',
        bitrate: 320,
        filters: {
            bassboost: 'bass=g=20',
            nightcore: 'aresample=48000,asetrate=48000*1.25',
            vaporwave: 'aresample=48000,asetrate=48000*0.8',
            _8d: 'apulsator=hz=0.09',
        },
    },

    // ── إعدادات yt-dlp / YouTube ─────────────────────────────────────────────
    ytdl: {
        requestOptions: {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
            },
        },
        // الصيغة المفضلة: opus عالي الجودة (يلائم Discord voice)
        format: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio/best',
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        // ── المصادقة ──
        cookiesFromBrowser: process.env.COOKIES_FROM_BROWSER || null,
        cookiesFile: process.env.COOKIES_FILE || null,
        poToken: process.env.YOUTUBE_PO_TOKEN || null,
        // ── ملف الكوكيز التلقائي (يُجلب بواسطة yt_cookies.py) ──
        autoCookiesFile: process.env.YT_AUTO_COOKIES_FILE || './cookies/cookies.txt',
        // ── قائمة عملاء YouTube (mweb/web_safari: android_music أصبح يتطلب PO Token) ──
        // تم اختباره فعلياً مع أغنية "ياه - تامر عاشور" ونجح في التنزيل والبث
        playerClients: process.env.YT_PLAYER_CLIENTS || 'mweb,web_safari',
        // ── JS runtime (deno لمعالجة تحديات YouTube الحديثة) ──
        jsRuntimes: process.env.YT_JS_RUNTIMES || 'deno',
        // ── proxy المستخدم (يُحدد تلقائياً من وضع التشغيل) ──
        proxy: resolvedProxy,
        // ── IPv6 forced لـ YouTube (أفضل على Railway) ──
        forceIpv6: ipv6Available,
    },

    // ── إعدادات الأوامر الهجينة (prefix + slash) ────────────────────────────
    commands: {
        // الـ prefix للأوامر النصية (!play, !skip, etc.)
        prefix: process.env.PREFIX || '!',
        // تفعيل أوامر prefix
        enablePrefix: process.env.ENABLE_PREFIX !== 'false',
        // تفعيل slash commands
        enableSlash: process.env.ENABLE_SLASH !== 'false',
        // السماح فقط للأدمن بإستخدام prefix (للحماية)
        prefixAdminOnly: process.env.PREFIX_ADMIN_ONLY === 'true',
    },

    // ── إعدادات Resilience (نظام التوقعات) ───────────────────────────────────
    resilience: {
        // مهلة بقاء البوت في القناة الصوتية فارغة (بالملي ثانية)
        // افتراضي: 5 دقائق = 300000 ms
        emptyVoiceTimeout: parseInt(process.env.EMPTY_VOICE_TIMEOUT_MS) || 300000,
        // مهلة محاولة إعادة الاتصال بعد قطع مفاجئ (بالملي ثانية)
        reconnectTimeout: parseInt(process.env.RECONNECT_TIMEOUT_MS) || 10000,
        // عدد محاولات إعادة الاتصال الصوتي قبل التسليم
        maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 3,
        // تأخير قبل تنظيف الموارد بعد انقطاع
        cleanupDelay: parseInt(process.env.CLEANUP_DELAY_MS) || 2000,
        // تفعيل استئناف التشغيل تلقائياً بعد إعادة الاتصال
        autoResumeAfterReconnect: process.env.AUTO_RESUME !== 'false',
        // حفظ حالة المشغل لإستئنافها بعد إعادة التشغيل
        persistPlayerState: process.env.PERSIST_PLAYER_STATE !== 'false',
        // مهلة الانتظار قبل حفظ الحالة بعد كل تغيير (debounce)
        statePersistDelay: parseInt(process.env.STATE_PERSIST_DELAY_MS) || 3000,
        // ✅ الحصة القصوى لمجلد كاش الصوت بالميجابايت — يحمي القرص من الامتلاء
        // بسبب الـ preload، مع تحرير ذكي للملفات الأقدم (افتراضي: 1500 MB)
        maxCacheSizeMB: parseInt(process.env.MAX_CACHE_SIZE_MB) || 1500,
    },

    // ── إعدادات Sharding ─────────────────────────────────────────────────────
    sharding: {
        totalShards: process.env.TOTAL_SHARDS || 'auto',
        shardList: process.env.SHARD_LIST || 'auto',
        mode: process.env.SHARD_MODE || 'process',
        respawn: process.env.SHARD_RESPAWN !== 'false',
        spawnDelay: parseInt(process.env.SHARD_SPAWN_DELAY) || 5500,
        spawnTimeout: parseInt(process.env.SHARD_SPAWN_TIMEOUT) || 30000,
    },

    // ── إعدادات elminyawe المدمجة (Cookies + PO Token + WARP) ───────────────
    elminyawe: {
        // تفعيل الحلول المدمجة
        enabled: process.env.ELMINYAWE_ENABLED !== 'false',
        // منفذ bgutil PO Token server
        bgutilPort: parseInt(process.env.BGUTIL_PORT) || 4416,
        // منفذ WARP SOCKS5
        warpSocksPort: parseInt(process.env.WARP_SOCKS_PORT) || 1080,
        // فاصل تجديد الكوكيز (افتراضي: 6 ساعات)
        cookiesRefreshInterval: parseInt(process.env.YT_COOKIES_INTERVAL_SEC) || 21600,
    },

    // ── معلومات البيئة (للـ debugging) ──────────────────────────────────────
    // ── معلومات البوت الأساسية (للاستخدام في commands) ─────────────────
    info: BOT_INFO,

    env: {
        isRailway,
        ipv6Available,
        connectionMode: connectionMode.toLowerCase(),
        resolvedProxy,
        nodeVersion: process.version,
        platform: process.platform,
        startTime: Date.now(),
    },
};
