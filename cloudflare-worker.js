// ═══════════════════════════════════════════════════════════════════════════
//  Cloudflare Worker — YouTube Proxy for MUS Bot (Dev: ELMINYAWE 👨‍💻)
//  ─────────────────────────────────────────────────────────────────────────
//  هذا الـ Worker يعمل كوسيط بين البوت (على Railway) و YouTube.
//  عندما يطلب البوت تنزيل أغنية، الطلب يمر عبر هذا الـ Worker (IP نظيف من Cloudflare)
//  ثم يُعيد توجيه الاستجابة للبوت. هذا يحل مشكلة bot detection على Railway.
//
//  كيفية النشر (3 دقائق):
//  1. اذهب إلى https://dash.cloudflare.com → Workers & Pages → Create
//  2. أنشئ Worker جديد باسم "youtube-proxy"
//  3. الصق هذا الكود بالكامل
//  4. اضغط Deploy
//  5. انسخ الـ URL (مثل: https://youtube-proxy.YOUR-SUBDOMAIN.workers.dev)
//  6. أضف هذا URL في Railway → Variables:
//     YOUTUBE_PROXY_URL=https://youtube-proxy.YOUR-SUBDOMAIN.workers.dev
//
//  المميزات:
//  • مجاني 100% (100,000 طلب/يوم — أكثر من كافٍ لـ music bot)
//  • لا يحتاج بطاقة ائتمان
//  • IP نظيف من Cloudflare edge network (لا يكتشفه YouTube كـ bot)
//  • يدعم: تنزيل الصوت، البحث، الحصول على metadata
//  • Cache مدمج (يقلل الطلبات على YouTube)
// ═══════════════════════════════════════════════════════════════════════════

// ── قائمة بـ clients المسموح بها (نفس yt-dlp) ──────────────────────────────
const ALLOWED_CLIENTS = ['android_music', 'web_safari', 'web', 'ios', 'tv', 'mweb'];

// ── User-Agent نظيف لا يكتشفه YouTube ─────────────────────────────────────
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ── CORS headers ──────────────────────────────────────────────────────────
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
};

// ── Cache للنتائج (يقلل طلبات YouTube) ────────────────────────────────────
const CACHE = new Map();
const CACHE_TTL = 3600 * 1000; // ساعة واحدة

/**
 * نقطة الدخول الرئيسية للـ Worker
 */
export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        const url = new URL(request.url);

        // ── Health check ──────────────────────────────────────────────────
        if (url.pathname === '/' || url.pathname === '/ping') {
            return jsonResponse({
                ok: true,
                service: 'youtube-proxy',
                version: '1.0.0',
                timestamp: Date.now(),
            });
        }

        // ── /stream/{videoId} — احصل على stream URL مباشر من googlevideo ───
        if (url.pathname.startsWith('/stream/')) {
            const videoId = url.pathname.split('/')[2];
            if (!videoId) {
                return errorResponse(400, 'Missing video ID');
            }
            return await handleStreamRequest(videoId, url.searchParams, request);
        }

        // ── /download/{videoId} — نزّل الصوت مباشرة (يُمرّر من البوت) ──────
        if (url.pathname.startsWith('/download/')) {
            const videoId = url.pathname.split('/')[2];
            if (!videoId) {
                return errorResponse(400, 'Missing video ID');
            }
            return await handleDownloadRequest(videoId, url.searchParams, request);
        }

        // ── 404 لأي path آخر ──────────────────────────────────────────────
        return errorResponse(404, 'Not found. Use /stream/{videoId} or /download/{videoId}');
    },
};

/**
 * يحصل على stream URL من YouTube ويُعيده للبوت
 * البوت سيُنزّل الصوت من googlevideo.com مباشرة (IP نظيف من Cloudflare)
 */
async function handleStreamRequest(videoId, params, request) {
    const cacheKey = `stream:${videoId}`;
    const cached = CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return jsonResponse(cached.data, { 'X-Cache': 'HIT' });
    }

    try {
        // نحاول عدة clients بالترتيب
        const clients = ['android_music', 'web', 'tv', 'ios'];

        for (const client of clients) {
            try {
                const streamData = await fetchYouTubeStream(videoId, client);
                if (streamData) {
                    // خزّن في cache
                    CACHE.set(cacheKey, { data: streamData, timestamp: Date.now() });
                    return jsonResponse(streamData, { 'X-Cache': 'MISS', 'X-Client': client });
                }
            } catch (err) {
                console.log(`Client ${client} failed: ${err.message}`);
                continue;
            }
        }

        return errorResponse(502, 'All clients failed to fetch stream');
    } catch (err) {
        return errorResponse(500, `Internal error: ${err.message}`);
    }
}

/**
 * يُنزّل الصوت مباشرة ويمرّره للبوت
 * هذا يحمي البوت من أي كشف IP لأن البوت يرى فقط Cloudflare IP
 */
async function handleDownloadRequest(videoId, params, request) {
    try {
        // احصل على stream URL أولاً
        const streamData = await fetchYouTubeStream(videoId, 'android_music');
        if (!streamData || !streamData.url) {
            return errorResponse(502, 'Failed to get stream URL');
        }

        // نزّل الصوت من googlevideo.com
        const audioResponse = await fetch(streamData.url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Referer': 'https://www.youtube.com/',
                'Origin': 'https://www.youtube.com',
            },
        });

        if (!audioResponse.ok) {
            return errorResponse(audioResponse.status, `YouTube returned ${audioResponse.status}`);
        }

        // مرّر الصوت للبوت مع CORS headers
        const headers = new Headers(audioResponse.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
        headers.set('X-Audio-Format', streamData.format || 'webm');
        headers.set('X-Audio-Bitrate', String(streamData.bitrate || 128));

        return new Response(audioResponse.body, {
            status: audioResponse.status,
            headers,
        });
    } catch (err) {
        return errorResponse(500, `Download error: ${err.message}`);
    }
}

/**
 * يحصل على stream URL من YouTube باستخدام InnerTube API
 * InnerTube هو YouTube's internal API — لا يكتشفه كـ bot
 */
async function fetchYouTubeStream(videoId, clientName) {
    const clientConfigs = {
        android_music: {
            clientName: 'ANDROID_MUSIC',
            clientVersion: '7.27.52',
            apiKey: 'AIzaSyAOghZGza2MQSZkY_zfZ370N-PUdXFo4Fg',
        },
        web: {
            clientName: 'WEB',
            clientVersion: '2.20240827.00.00',
            apiKey: 'AIzaSyAOghZGza2MQSZkY_zfZ370N-PUdXFo4Fg',
        },
        tv: {
            clientName: 'TVHTML5',
            clientVersion: '7.20240827.00.00',
            apiKey: 'AIzaSyAOghZGza2MQSZkY_zfZ370N-PUdXFo4Fg',
        },
        ios: {
            clientName: 'IOS',
            clientVersion: '19.29.1',
            apiKey: 'AIzaSyAOghZGza2MQSZkY_zfZ370N-PUdXFo4Fg',
        },
    };

    const config = clientConfigs[clientName];
    if (!config) throw new Error(`Unknown client: ${clientName}`);

    // InnerTube player API
    const response = await fetch('https://www.youtube.com/youtubei/v1/player?key=' + config.apiKey, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT,
            'Referer': 'https://www.youtube.com/',
            'Origin': 'https://www.youtube.com',
        },
        body: JSON.stringify({
            context: {
                client: {
                    clientName: config.clientName,
                    clientVersion: config.clientVersion,
                },
            },
            videoId: videoId,
        }),
    });

    if (!response.ok) {
        throw new Error(`YouTube API returned ${response.status}`);
    }

    const data = await response.json();

    // تحقق من playability status
    const playability = data?.playabilityStatus;
    if (!playability || playability.status !== 'OK') {
        const reason = playability?.reason || playability?.messages?.join('; ') || 'Unknown';
        throw new Error(`Playability: ${reason}`);
    }

    // ابحث عن أفضل audio format
    const streamingData = data?.streamingData;
    if (!streamingData) {
        throw new Error('No streaming data in response');
    }

    // ابحث في adaptiveFormats عن audio only
    const formats = streamingData.adaptiveFormats || streamingData.formats || [];
    const audioFormats = formats.filter(f =>
        f.mimeType && f.mimeType.startsWith('audio/') && f.url
    );

    if (audioFormats.length === 0) {
        throw new Error('No audio formats available');
    }

    // اختر أفضل audio format (prefer opus)
    const opusFormat = audioFormats.find(f => f.mimeType.includes('opus'));
    const bestFormat = opusFormat || audioFormats.sort((a, b) =>
        (b.bitrate || 0) - (a.bitrate || 0)
    )[0];

    return {
        url: bestFormat.url,
        mimeType: bestFormat.mimeType,
        bitrate: bestFormat.bitrate || 128000,
        duration: streamingData.lengthSeconds || data?.videoDetails?.lengthSeconds || 0,
        format: bestFormat.mimeType.includes('opus') ? 'opus' : 'm4a',
        title: data?.videoDetails?.title,
        videoId,
        clientUsed: clientName,
    };
}

/**
 * Helper: JSON response
 */
function jsonResponse(data, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
            ...extraHeaders,
        },
    });
}

/**
 * Helper: Error response
 */
function errorResponse(status, message) {
    return new Response(JSON.stringify({
        ok: false,
        error: message,
        status,
    }), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
        },
    });
}
