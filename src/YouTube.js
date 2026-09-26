// ═══════════════════════════════════════════════════════════════════════════
//  src/YouTube.js — يوتيوب بروفايدر متعدد المصادر (v26.9)
//  ─────────────────────────────────────────────────────────────────────────
//  استراتيجية Multi-Provider Fallback Chain:
//    1. PRIMARY: 3× Cloudflare Workers (fancy-sea + royal-forest/tubeapi + hidden-sun)
//       • تعمل من أي IP (بما فيها Railway/AWS المحظور من OVH) — الحل الجذري لـ 403
//       • نفس بنية الـ fallback الرسمية التي تستخدمها مواقع العائلة نفسها في JS
//    2. SECONDARY: ytmp3 API family المباشرة (gamma + epsilon)
//       • تعمل من الـ IPs النظيفة فقط + static-session bypass عند حظر auth
//    3. FALLBACK: yt-dlp مع سلسلة player clients بديلة
//
//  المميزات:
//    • يعمل على Railway بدون Cloudflare Worker خاص بنا
//    • سرعة عالية (متوسط 8 ثواني للأغنية عبر Workers)
//    • مجاني 100% — لا API keys مدفوعة
//    • متانة عالية: لو فشل provider، يجرب التالي تلقائياً
// ═══════════════════════════════════════════════════════════════════════════
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const config = require('../config');
const LanguageManager = require('./LanguageManager');

// ── ytmp3 Provider Family (v26.9) ────────────────────────────────────────
// 3 Cloudflare Workers (تعمل من أي IP — تتجاوز حظر OVH لـ IP الداتاسنتر)
// + 2 مزودات مباشرة على OVH (gamma + epsilon — تعمل من الـ IPs النظيفة فقط).
//
// الاكتشاف (سبتمبر 2026): مواقع العائلة (ytmp3.gl/convertytmp3.org) حظرت
// نطاقات IP الداتاسنتر (Railway/AWS) على API الرئيسية gamma.gammacloud.net
// و epsilon.epsiloncloud.org بـ 403 — لكن نفس المُشغّل يملك Workers على
// Cloudflare edge كطبقة fallback رسمية (موجودة في JS مواقعه نفسها!):
//   • fancy-sea   (?m=i)      — يعمل حتى للفيديوهات المحمية (اختُبر 3/3)
//   • royal-forest (tubeapi)  — API مستقلة بمفتاحها الخاص
//   • hidden-sun  (?e=i)      — مسار قديم يلفّ backend 123tokyo.xyz
// الـ Workers على شبكة Cloudflare → لا يمر أي طلب على OVH المحظور أصلاً.
const YTMP3_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// fancy-sea يرفض الطلبات بدون browser headers (error:12) — هذه البصمة الإلزامية
const YTMP3_BROWSER_HEADERS = {
    'User-Agent': YTMP3_UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
};

// مفتاح tubeapi.org (الواجهة الرسمية للـ royal-forest/hidden-sun workers)
const TUBEAPI_KEY = '66d0abdc85f3b52ac9df11d95ebce90a';

// مفتاح الجلسة الثابت لعائلة ytmp3 المباشرة — auth يرجعه دائماً ثابتاً
// (مُثبت بالاختبار 3 مرات متتالية) — يُستخدم كتجاوز عند حظر auth فقط
const YTMP3_STATIC_SESSION = 'CimtTPu5Yjqgg8Ta';

const YTMP3_FAMILY = [
    // ── الطبقة 1: Cloudflare Workers (تعمل من Railway) ─────────────────
    {
        name: 'fancy',
        type: 'worker-fancy',
        worker: 'https://fancy-sea-5d3d.holy-breeze-fec5.workers.dev',
        referer: 'ytmp3.gl',
        discovery: null, session: null,
        cooldownUntil: 0, failCount: 0, consecutive403: 0,
    },
    {
        name: 'tubeapi',
        type: 'worker-tubeapi',
        worker: 'https://royal-forest-deb8.holy-breeze-fec5.workers.dev',
        apiKey: TUBEAPI_KEY,
        referer: 'ytmp3.gl',
        discovery: null, session: null,
        cooldownUntil: 0, failCount: 0, consecutive403: 0,
    },
    {
        name: 'hiddensun',
        type: 'worker-hiddensun',
        worker: 'https://hidden-sun-3c87.holy-breeze-fec5.workers.dev',
        apiKey: TUBEAPI_KEY,
        referer: 'ytmp3.gl',
        discovery: null, session: null,
        cooldownUntil: 0, failCount: 0, consecutive403: 0,
    },
    // ── الطبقة 2: API المباشرة على OVH (تُحظر من IPs الداتاسنتر) ────────
    {
        name: 'gamma',
        type: 'direct',
        site: 'https://ytmp3.gl',
        mirrorSite: 'https://ytmp3.nu',      // مرآة بنفس المفتاح — للاكتشاف الاحتياطي
        sub: 'gamma',
        domain: 'gammacloud.net',
        apiKey: 'b69e9ac84c9c5f8a9f265c337a9005f3',
        discovery: null,   // { apiKey, apiBase, at }
        session: null,     // { sessionKey, convertURL, at }
        cooldownUntil: 0,
        failCount: 0, consecutive403: 0,
    },
    {
        name: 'epsilon',
        type: 'direct',
        site: 'https://convertytmp3.org',
        mirrorSite: 'https://ytmp3.cc',      // مرآة بنفس المفتاح
        sub: 'epsilon',
        domain: 'epsiloncloud.org',
        apiKey: 'ea4d4d5ce613226d632d118c74bb85ae',
        discovery: null,
        session: null,
        cooldownUntil: 0,
        failCount: 0, consecutive403: 0,
    },
];
const YTMP3_SESSION_TTL = 10 * 60e3;    // إعادة استخدام الجلسة 10 دقائق
const YTMP3_DISCOVERY_TTL = 60 * 60e3;  // اكتشاف المفتاح كل ساعة
const YTMP3_429_COOLDOWN = 60e3;        // تبريد المزود عند 429
const YTMP3_IPBLOCK_COOLDOWN = 30 * 60e3; // تبريد 30 دقيقة بعد 403 متتالية (حظر IP لا يزول بسرعة)
const YTMP3_IPBLOCK_THRESHOLD = 2;        // عدد 403 المتتالية قبل التبريد الطويل

/**
 * فحص أن البافر ملف صوتي حقيقي (ID3 tag أو MPEG frame sync)
 * يمنع اعتبار صفحة HTML/JSON خطأً ملفاً صوتياً
 */
function _isAudioBuffer(buf) {
    if (!buf || buf.length < 16) return false;
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true; // ID3
    if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return true;          // MPEG sync
    return false;
}

function _ytmp3Headers(p) {
    return {
        'User-Agent': YTMP3_UA,
        'Referer': `${p.site}/`,
        'Origin': p.site,
    };
}

/**
 * اكتشاف تلقائي لمفتاح و endpoint مزود من صفحة موقعه (مع مرآة احتياطية)
 * (apiKey مدمجة في HTML — endpoint + subdomain مشفران base64 في ملف JS)
 */
async function _ytmp3Discover(p, force = false) {
    const now = Date.now();
    if (!force && p.discovery && (now - p.discovery.at) < YTMP3_DISCOVERY_TTL) {
        return p.discovery;
    }
    let apiKey = p.apiKey;
    let apiBase = `https://${p.sub}.${p.domain}`;
    // جرّب الموقع الأساسي ثم المرآة (نفس المفتاح — مسار اكتشاف إضافي)
    const sites = [p.site];
    if (p.mirrorSite) sites.push(p.mirrorSite);
    for (const site of sites) {
        try {
            const pageResp = await fetch(`${site}/`, {
                headers: { 'User-Agent': YTMP3_UA },
                signal: AbortSignal.timeout(15000),
            });
            if (!pageResp.ok) continue;
            const html = await pageResp.text();
            const keyMatch = html.match(/apiKey\s*=\s*['"]([a-f0-9]{32})['"]/);
            if (keyMatch) apiKey = keyMatch[1];
            const jsMatch = html.match(/src="(\/js\/\d+\/ytmp3\.js)"/);
            if (jsMatch) {
                const jsResp = await fetch(`${site}${jsMatch[1]}`, {
                    headers: { 'User-Agent': YTMP3_UA },
                    signal: AbortSignal.timeout(15000),
                });
                if (jsResp.ok) {
                    const js = await jsResp.text();
                    const epMatch = js.match(/endpoint\s*=\s*atob\("([^"]+)"\)/);
                    if (epMatch) {
                        const decoded = Buffer.from(epMatch[1], 'base64').toString('utf8');
                        if (decoded.includes('.')) {
                            const subMatch = js.match(/"https:\/\/([a-z0-9-]+)\."\s*\n?\s*\+\s*endpoint/) || js.match(/"https:\/\/([a-z0-9-]+)\."\s*\+\s*endpoint/);
                            const sub = subMatch ? subMatch[1] : p.sub;
                            apiBase = `https://${sub}.${decoded}`;
                            break; // اكتشاف ناجح — لا حاجة للمرآة
                        }
                    }
                }
            }
        } catch (e) {
            console.log(`  [ytmp3:${p.name}] discovery via ${site} failed (${e.message})`);
        }
    }
    p.discovery = { apiKey, apiBase, at: now };
    return p.discovery;
}

/**
 * الحصول على جلسة (auth+init) مع إعادة الاستخدام بين الأغاني
 * @throws {Error & {rateLimited:true}} عند 429 — يستدعي تبريد المزود
 * @throws {Error & {ipBlocked:true}}  عند 403 مستمر — حظر IP (بعد محاولة التجاوز)
 */
async function _ytmp3AcquireSession(p, force = false) {
    const now = Date.now();
    if (!force && p.session && (now - p.session.at) < YTMP3_SESSION_TTL) {
        return p.session;
    }
    let cfg = await _ytmp3Discover(p);
    const headers = _ytmp3Headers(p);

    // auth (مع إعادة اكتشاف واحدة لو 403/429 — المفتاح ربما تدوّر)
    let authResp = await fetch(`${cfg.apiBase}/api/v1/auth?api_key=${cfg.apiKey}&_=${Date.now()}`, { headers });
    if (authResp.status === 403 || authResp.status === 429) {
        cfg = await _ytmp3Discover(p, true);
        authResp = await fetch(`${cfg.apiBase}/api/v1/auth?api_key=${cfg.apiKey}&_=${Date.now()}`, { headers });
    }
    if (authResp.status === 429) {
        p.cooldownUntil = Date.now() + YTMP3_429_COOLDOWN;
        throw Object.assign(new Error('auth 429 (rate limited)'), { rateLimited: true });
    }
    if (authResp.status === 403) {
        // 🚀 تجاوز حظر auth: init مباشر بمفتاح الجلسة الثابت (auth مجرد شكلية —
        // المفتاح ثابت عالمياً ومُثبت بالاختبار). لو كان الحظر على auth فقط
        // وليس على init — الجلسة تُبنى عاديًا وكل شيء يعمل.
        try {
            const initResp2 = await fetch(`${cfg.apiBase}/api/v1/init?_=${Date.now()}`, {
                headers: { ...headers, 'Authorization': `Bearer ${YTMP3_STATIC_SESSION}` },
                signal: AbortSignal.timeout(15000),
            });
            if (initResp2.ok) {
                const d2 = await initResp2.json();
                if (Number(d2.error) === 0 && d2.convertURL) {
                    p.session = { sessionKey: YTMP3_STATIC_SESSION, convertURL: d2.convertURL, at: now };
                    return p.session;
                }
            }
        } catch (e) { /* التجاوز فشل — اكمل كحظر IP عادي */ }
        throw Object.assign(new Error(`auth HTTP 403 (IP blocked, static-session bypass failed)`), { ipBlocked: true });
    }
    if (!authResp.ok) throw new Error(`auth HTTP ${authResp.status}`);
    const authData = await authResp.json();
    if (Number(authData.err) !== 0 && Number(authData.error) !== 0) {
        throw new Error(`auth err ${JSON.stringify(authData).substring(0, 100)}`);
    }

    // init
    const initResp = await fetch(`${cfg.apiBase}/api/v1/init?_=${Date.now()}`, {
        headers: { ...headers, 'Authorization': `Bearer ${authData.key}` },
    });
    if (initResp.status === 429) {
        p.cooldownUntil = Date.now() + YTMP3_429_COOLDOWN;
        throw Object.assign(new Error('init 429 (rate limited)'), { rateLimited: true });
    }
    if (!initResp.ok) throw new Error(`init HTTP ${initResp.status}`);
    const initData = await initResp.json();
    if (Number(initData.error) !== 0) throw new Error(`init err ${JSON.stringify(initData).substring(0, 100)}`);

    p.session = { sessionKey: authData.key, convertURL: initData.convertURL, at: now };
    return p.session;
}

// ── ytmp3.ge API (FALLBACK for metadata) ──────────────────────────────────
const YTMP3GE_BASE = 'https://ytmp3.ge';

// ── SOCKS5 proxy (اختياري — معطل افتراضياً) ──────────────────────────────
// البروكسيات المجانية القديمة ماتت جميعاً وكانت تعطل كل أغنية دقائق.
// للتفعيل: SOCKS5_PROXIES=socks5://user:pass@host:port,socks5://host2:port
let _socksProxyAgent = null;
let _socksProxyIndex = 0;
const SOCKS5_PROXIES = (() => {
    const envList = (process.env.SOCKS5_PROXIES || '').split(',').map(s => s.trim()).filter(Boolean);
    return envList;
})();

/**
 * يحاول تحميل SocksProxyAgent (lazy load)
 */
function getSocksProxyAgent() {
    if (_socksProxyAgent) return _socksProxyAgent;
    try {
        const { SocksProxyAgent } = require('socks-proxy-agent');
        const proxy = SOCKS5_PROXIES[_socksProxyIndex % SOCKS5_PROXIES.length];
        _socksProxyAgent = new SocksProxyAgent(proxy);
        console.log(`  🔄 Using SOCKS5 proxy: ${proxy}`);
        return _socksProxyAgent;
    } catch (e) {
        console.log(`  ⚠️ socks-proxy-agent not installed: ${e.message}`);
        return null;
    }
}

/**
 * ينتقل للـ proxy التالي (عند فشل الحالي)
 */
function rotateSocksProxy() {
    _socksProxyIndex++;
    const oldAgent = _socksProxyAgent;
    _socksProxyAgent = null; // إعادة إنشاء مع proxy جديد
    console.log(`  🔄 Rotated to proxy index ${_socksProxyIndex % SOCKS5_PROXIES.length}`);
    return getSocksProxyAgent();
}

/**
 * ✅ smartFetch — fetch مع دعم SOCKS5 proxy fallback
 *
 * الاستراتيجية:
 *   1. حاول direct fetch أولاً (الأسرع لو الـ IP غير محظور)
 *   2. لو 403/429، حاول عبر SOCKS5 proxy
 *   3. لو فشل الـ proxy، انتقل للـ proxy التالي (rotation)
 *
 * @param {string} url - URL للطلب
 * @param {Object} options - خيارات fetch (headers, method, body)
 * @param {boolean} forceProxy - true لتخطي direct واستخدام proxy مباشرةً
 * @returns {Promise<Response>} - fetch-like response object
 */
async function smartFetch(url, options = {}, forceProxy = false) {
    // المحاولة الأولى: اتصال مباشر (إذا لم يُطلب proxy إجباري)
    if (!forceProxy) {
        try {
            const resp = await fetch(url, {
                ...options,
                signal: options.signal || AbortSignal.timeout(15000),
            });
            if (resp.ok || (resp.status !== 403 && resp.status !== 429)) {
                return resp; // نجاح أو خطأ غير IP-related
            }
            console.log(`  ⚠️ Direct fetch returned HTTP ${resp.status}, trying SOCKS5 proxy...`);
        } catch (e) {
            console.log(`  ⚠️ Direct fetch failed: ${e.message}, trying SOCKS5 proxy...`);
        }
    }

    // المحاولة الثانية: عبر SOCKS5 proxy (اختياري — فقط لو مُعد عبر env)
    if (SOCKS5_PROXIES.length === 0) {
        // لا بروكسيات مُعدة — أعد نتيجة الاتصال المباشر كما هي (فشل سريع)
        return fetch(url, options);
    }
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        const agent = getSocksProxyAgent();
        if (!agent) {
            // لو socks-proxy-agent غير مثبت، ارجع للمحاولة المباشرة
            return fetch(url, options);
        }

        try {
            // استخدم http/https module مع SOCKS5 agent
            const result = await new Promise((resolve, reject) => {
                const parsedUrl = new URL(url);
                const lib = parsedUrl.protocol === 'https:' ? https : http;
                const req = lib.request(url, {
                    method: options.method || 'GET',
                    headers: options.headers || {},
                    agent: agent,
                }, (res) => {
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => {
                        const body = Buffer.concat(chunks);
                        const bodyStr = body.toString('utf8');
                        const fakeResp = {
                            ok: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            statusText: res.statusMessage || '',
                            headers: new Map(Object.entries(res.headers)),
                            text: () => Promise.resolve(bodyStr),
                            json: () => Promise.resolve(JSON.parse(bodyStr)),
                            arrayBuffer: () => Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)),
                        };
                        resolve(fakeResp);
                    });
                });
                req.on('error', reject);
                req.setTimeout(30000, () => {
                    req.destroy();
                    reject(new Error('SOCKS5 proxy timeout'));
                });
                if (options.body) req.write(options.body);
                req.end();
            });
            return result;
        } catch (e) {
            console.log(`  ⚠️ SOCKS5 proxy attempt ${attempt + 1}/3 failed: ${e.message}`);
            lastError = e;
            rotateSocksProxy();
        }
    }

    // كل المحاولات فشلت — ارجع للـ direct fetch كحل أخير
    console.log(`  ⚠️ All proxy attempts failed, falling back to direct fetch`);
    return fetch(url, options);
}

class YouTube {
    /**
     * يبني خيارات yt-dlp المشتركة (للبحث فقط — لا للتنزيل)
     */
    static getYtDlpOptions(extraOptions = {}) {
        const baseOptions = {
            noCheckCertificates: true,
            noWarnings: true,
            retries: 3,
            fragmentRetries: 3,
            jsRuntimes: config.ytdl.jsRuntimes || 'deno',
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'accept-language:en-US,en;q=0.9,ar;q=0.8',
            ],
            ...extraOptions,
        };

        if (config.ytdl.proxy) {
            baseOptions.proxy = config.ytdl.proxy;
        }
        if (config.ytdl.forceIpv6) {
            baseOptions.forceIpv6 = true;
        }

        let cookiesFile = config.ytdl.cookiesFile;
        if (!cookiesFile && config.elminyawe && config.elminyawe.enabled !== false) {
            const autoCookies = config.ytdl.autoCookiesFile;
            if (autoCookies) {
                const resolvedPath = path.isAbsolute(autoCookies)
                    ? autoCookies
                    : path.resolve(process.cwd(), autoCookies);
                if (fs.existsSync(resolvedPath)) {
                    cookiesFile = resolvedPath;
                    console.log(`🍪 [YouTube] Using cookies: ${resolvedPath}`);
                }
            }
        }

        if (config.ytdl.poToken) {
            baseOptions.extractorArgs = `youtube:po_token=web+${config.ytdl.poToken};player_client=${config.ytdl.playerClients}`;
        } else if (config.ytdl.cookiesFromBrowser) {
            baseOptions.cookiesFromBrowser = config.ytdl.cookiesFromBrowser;
            baseOptions.extractorArgs = `youtube:player_client=${config.ytdl.playerClients}`;
        } else if (cookiesFile) {
            baseOptions.cookies = cookiesFile;
            baseOptions.extractorArgs = `youtube:player_client=${config.ytdl.playerClients}`;
        } else {
            baseOptions.extractorArgs = `youtube:player_client=${config.ytdl.playerClients}`;
        }

        return baseOptions;
    }

    /**
     * يستخرج video ID من YouTube URL
     */
    static extractVideoId(url) {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PROVIDER 0: ytmp3 API family (gamma + epsilon) مع rotation تلقائي
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * تنزيل MP3 عبر عائلة ytmp3 (gamma.gammacloud.net + epsilon.epsiloncloud.org)
     *
     * Flow لكل مزود (مطابق لسلوك مواقع العائلة نفسها — مُختبر فعلياً):
     *   session(auth→init) ← مُعاد استخدامها 10 دقائق لعدة أغانٍ
     *   → convert (مع تتبع redirect) → progress polling → download + تحقق صوتي
     *
     * التحمل للأعطال:
     *   • 429 → تبريد المزود 60 ثانية + انتقال فوري للمزود الآخر
     *   • جولة ثانية بعد 4 ثوان لو كل المزودين اشتعلوا 429
     *   • جلسة انتهت (sig منتهي) → جلسة جديدة ومحاولة ثانية بنفس المزود
     *   • اكتشاف تلقائي للمفاتيح — يصمد أمام تدويرها
     */
    static async downloadViaYtmp3Family(videoId, outputFile, format = 'mp3') {
        const t0 = Date.now();
        const errors = [];

        for (let round = 1; round <= 2; round++) {
            // الأقل فشلاً وتبريداً أولاً
            const providers = [...YTMP3_FAMILY].sort((a, b) => {
                const rank = (x) => x.cooldownUntil > Date.now() ? 1e12 + x.cooldownUntil : x.failCount;
                return rank(a) - rank(b);
            });

            for (const p of providers) {
                if (p.cooldownUntil > Date.now() && round === 1) {
                    errors.push(`${p.name}: cooling down`);
                    continue;
                }
                try {
                    console.log(`[YouTube] Downloading ${videoId} via ytmp3 (${p.name})...`);
                    const result = await this._ytmp3ConvertAndDownload(p, videoId, outputFile, format, t0);
                    p.failCount = 0;
                    return result;
                } catch (err) {
                    p.failCount++;
                    errors.push(`${p.name}: ${err.message}`);
                    console.log(`  [ytmp3:${p.name}] failed: ${err.message}`);
                }
            }

            if (round === 1) {
                const anyRateLimited = errors.some(e => e.includes('429'));
                if (anyRateLimited) {
                    console.log(`  [ytmp3] all providers rate-limited — retrying after 4s...`);
                    await new Promise(r => setTimeout(r, 4000));
                } else {
                    break; // فشل غير مرتبط بالمعدل — الجولة الثانية بلا فائدة
                }
            }
        }

        return { success: false, error: errors.join(' | ') || 'all ytmp3 providers failed' };
    }

    /** للاختبار والتشخيص فقط — يعرض حالة عائلة ytmp3 الحالية */
    static get ytmp3FamilyState() {
        return YTMP3_FAMILY.map(p => ({
            name: p.name,
            hasSession: !!p.session,
            cooldownRemaining: Math.max(0, p.cooldownUntil - Date.now()),
            failCount: p.failCount,
        }));
    }

    /** للاختبار والتشخيص فقط — الوصول المباشر لحالة العائلة (تبريد/تصفير) */
    static __ytmp3TestHook(action, providerName, value) {
        const p = YTMP3_FAMILY.find(x => x.name === providerName);
        if (!p) return null;
        if (action === 'cooldown') { p.cooldownUntil = value; return true; }
        if (action === 'reset') { p.cooldownUntil = 0; p.failCount = 0; p.session = null; return true; }
        if (action === 'get') { return p; }
        return null;
    }

    /**
     * تنزيل MP3 عبر عائلة ytmp3 الكاملة (v26.9):
     *   fancy-sea worker → tubeapi worker → hidden-sun worker → gamma → epsilon
     *
     * الـ Workers على Cloudflare edge — تعمل من أي IP (بما فيها Railway المحظور
     * من OVH). المباشرة على OVH تعمل من الـ IPs النظيفة فقط (مع static-session
     * bypass عند حظر auth).
     *
     * التحمل للأعطال:
     *   • 429 → تبريد 60 ثانية + انتقال فوري للمزود التالي
     *   • 403 متتالية (حظر IP) → تبريد المزود 30 دقيقة كي لا يُهدر وقت كل أغنية
     *   • copyright (خطأ خاص بالفيديو) → لا يُحسب فشلاً على المزود
     *   • جولة ثانية بعد 4 ثوان لو كل المزودين اشتعلوا 429
     *   • اكتشاف تلقائي للمفاتيح — يصمد أمام تدويرها
     */
    static async downloadViaYtmp3Family(videoId, outputFile, format = 'mp3') {
        const t0 = Date.now();
        const errors = [];

        for (let round = 1; round <= 2; round++) {
            // الأقل فشلاً وتبريداً أولاً
            const providers = [...YTMP3_FAMILY].sort((a, b) => {
                const rank = (x) => x.cooldownUntil > Date.now() ? 1e12 + x.cooldownUntil : x.failCount;
                return rank(a) - rank(b);
            });

            for (const p of providers) {
                if (p.cooldownUntil > Date.now() && round === 1) {
                    errors.push(`${p.name}: cooling down`);
                    continue;
                }
                try {
                    console.log(`[YouTube] Downloading ${videoId} via ytmp3 (${p.name}${p.type !== 'direct' ? ' worker' : ''})...`);
                    const handler = p.type === 'worker-fancy' ? this._ytmp3FancyFlow
                        : p.type === 'worker-tubeapi' ? this._ytmp3TubeapiFlow
                        : p.type === 'worker-hiddensun' ? this._ytmp3HiddensunFlow
                        : this._ytmp3DirectFlow.bind(this);
                    const result = await handler.call(this, p, videoId, outputFile, format, t0);
                    p.failCount = 0;
                    p.consecutive403 = 0;
                    return result;
                } catch (err) {
                    // copyright/geo = خاص بالفيديو وليس عطلاً بالمزود — لا يعاقب
                    if (!err.copyright && !err.videoSpecific) p.failCount++;
                    if (err.ipBlocked) {
                        p.consecutive403 = (p.consecutive403 || 0) + 1;
                        if (p.consecutive403 >= YTMP3_IPBLOCK_THRESHOLD) {
                            p.cooldownUntil = Date.now() + YTMP3_IPBLOCK_COOLDOWN;
                            console.log(`  [ytmp3:${p.name}] IP block suspected — cooldown 30min (توفير وقت لكل أغنية)`);
                        }
                    }
                    errors.push(`${p.name}: ${err.message}`);
                    console.log(`  [ytmp3:${p.name}] failed: ${err.message}`);
                }
            }

            if (round === 1) {
                const anyRateLimited = errors.some(e => e.includes('429'));
                if (anyRateLimited) {
                    console.log(`  [ytmp3] providers rate-limited — retrying after 4s...`);
                    await new Promise(r => setTimeout(r, 4000));
                } else {
                    break; // فشل غير مرتبط بالمعدل — الجولة الثانية بلا فائدة
                }
            }
        }

        return { success: false, error: errors.join(' | ') || 'all ytmp3 providers failed' };
    }

    /** للاختبار والتشخيص فقط — يعرض حالة عائلة ytmp3 الحالية */
    static get ytmp3FamilyState() {
        return YTMP3_FAMILY.map(p => ({
            name: p.name,
            type: p.type,
            hasSession: !!p.session,
            cooldownRemaining: Math.max(0, p.cooldownUntil - Date.now()),
            failCount: p.failCount,
        }));
    }

    /** للاختبار والتشخيص فقط — الوصول المباشر لحالة العائلة (تبريد/تصفير) */
    static __ytmp3TestHook(action, providerName, value) {
        const p = YTMP3_FAMILY.find(x => x.name === providerName);
        if (!p) return null;
        if (action === 'cooldown') { p.cooldownUntil = value; return true; }
        if (action === 'reset') { p.cooldownUntil = 0; p.failCount = 0; p.consecutive403 = 0; p.session = null; p.discovery = null; return true; }
        if (action === 'get') { return p; }
        return null;
    }

    /** كتابة البافر + تحقق صوتي — مشترك بين كل المسارات */
    static _ytmp3WriteAudio(p, buf, videoId, title, t0, outputFile) {
        if (!_isAudioBuffer(buf)) {
            throw new Error(`not an audio file (${buf.length} bytes, head: ${buf.subarray(0, 4).toString('hex')})`);
        }
        fs.writeFileSync(outputFile, buf);
        console.log(`  [ytmp3:${p.name}] downloaded ${(buf.length / 1024 / 1024).toFixed(2)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        return {
            success: true,
            title: title || `YouTube_${videoId}`,
            fileSize: buf.length,
            format: 'mp3',
            videoId,
        };
    }

    /**
     * مسار 1: fancy-sea worker (fallback مواقع العائلة الرسمي — Cloudflare edge)
     * يتطلب browser headers كاملة وإلا رجع error:12 (مُثبت بالاختبار)
     * يدعم حتى الفيديوهات المحمية (اختُبر Rick Astley بنجاح!)
     */
    static async _ytmp3FancyFlow(p, videoId, outputFile, format, t0) {
        const H = {
            ...YTMP3_BROWSER_HEADERS,
            'Referer': `https://${p.referer}/`,
            'Origin': `https://${p.referer}`,
        };

        // init — طلب واحد يبدأ التحويل كله
        let resp = await fetch(`${p.worker}/?m=i&v=${videoId}&f=${format}&_=${Date.now()}`, {
            headers: H, signal: AbortSignal.timeout(60000),
        });
        if (resp.status === 429) {
            p.cooldownUntil = Date.now() + YTMP3_429_COOLDOWN;
            throw Object.assign(new Error('init 429'), { rateLimited: true });
        }
        if (!resp.ok) throw new Error(`init HTTP ${resp.status}`);
        let data = await resp.json();
        if (Number(data.error) > 0) {
            // 215/643/644/648 = أخطاء المحتوى (كوبيرايت/منطقة) — خاصة بالفيديو
            const vidSpecific = [215, 403, 643, 644, 648].includes(Number(data.error));
            throw Object.assign(new Error(`api error ${data.error}`), { copyright: vidSpecific });
        }

        let title = data.title || '';
        let downloadURL = data.downloadURL || data.downloadUrl;

        // progress polling (لو الفيديو غير مخزّن بعد)
        if (!downloadURL && data.status === 'progress' && data.progressURL) {
            const deadline = Date.now() + 120e3;
            let lastP = -1;
            while (Date.now() < deadline) {
                try {
                    const pr = await fetch(`${data.progressURL}&_=${Date.now()}`, { headers: H, signal: AbortSignal.timeout(30000) });
                    if (pr.status === 429) {
                        p.cooldownUntil = Date.now() + YTMP3_429_COOLDOWN;
                        throw Object.assign(new Error('progress 429'), { rateLimited: true });
                    }
                    if (pr.ok) {
                        const pd = await pr.json();
                        if (Number(pd.error) > 0) throw new Error(`progress err ${pd.error}`);
                        if (pd.title) title = pd.title;
                        if (Number(pd.progress) >= 3) { downloadURL = pd.downloadURL || pd.downloadUrl; break; }
                        if (Number(pd.progress) !== lastP) {
                            lastP = Number(pd.progress);
                            console.log(`  [ytmp3:${p.name}] progress ${pd.progress}/3 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
                        }
                    }
                } catch (e) { if (e.rateLimited) throw e; /* استمر بالاستطلاع */ }
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        if (!downloadURL) throw new Error('no downloadURL');

        // download — عبر الـ Worker نفسه (Cloudflare edge)
        const dlResp = await fetch(`${downloadURL}${downloadURL.includes('?') ? '&' : '?'}v=${videoId}&f=${format}&r=${p.referer}&_=${Date.now()}`, {
            headers: H, signal: AbortSignal.timeout(180000),
        });
        if (dlResp.status === 429) {
            p.cooldownUntil = Date.now() + YTMP3_429_COOLDOWN;
            throw Object.assign(new Error('download 429'), { rateLimited: true });
        }
        if (!dlResp.ok) throw new Error(`download HTTP ${dlResp.status}`);
        const buf = Buffer.from(await dlResp.arrayBuffer());
        return this._ytmp3WriteAudio(p, buf, videoId, title, t0, outputFile);
    }

    /**
     * مسار 2: royal-forest worker (tubeapi.org API — Cloudflare edge)
     * e=i (init) → e=p (poll) → e=d (download proxy)
     * ملاحظة: بعض الفيديوهات المشهورة تُرجع 451 COPYRIGHT_BLOCKED — خاص بالفيديو
     */
    static async _ytmp3TubeapiFlow(p, videoId, outputFile, format, t0) {
        const H = {
            'User-Agent': YTMP3_UA,
            'Referer': 'https://tubeapi.org/',
            'Accept': 'application/json, text/plain, */*',
        };

        // init
        let resp = await fetch(`${p.worker}/?v=${videoId}&f=${format}&e=i&api_key=${p.apiKey}&_=${Date.now()}`, {
            headers: H, signal: AbortSignal.timeout(60000),
        });
        if (resp.status === 429) {
            p.cooldownUntil = Date.now() + YTMP3_429_COOLDOWN;
            throw Object.assign(new Error('init 429'), { rateLimited: true });
        }
        if (resp.status === 451 || resp.status === 403) {
            const body = await resp.text().catch(() => '');
            const copyright = /COPYRIGHT|copyright/i.test(body);
            throw Object.assign(new Error(`init HTTP ${resp.status} ${body.substring(0, 60)}`), { copyright, videoSpecific: copyright });
        }
        if (!resp.ok) throw new Error(`init HTTP ${resp.status}`);
        let data = await resp.json();
        let title = data.title || '';
        const statusUrl = data.statusUrl || data.status_url;
        if (!statusUrl) throw new Error('no statusUrl');

        // progress polling (كل 4 ثوان — مطابق لـ JS الموقع)
        let downloadUrl = null;
        const deadline = Date.now() + 150e3;
        while (Date.now() < deadline) {
            const pr = await fetch(`${p.worker}/?u=${Buffer.from(statusUrl).toString('base64')}&e=p&api_key=${p.apiKey}&_=${Date.now()}`, {
                headers: H, signal: AbortSignal.timeout(60000),
            });
            if (pr.status === 429) {
                p.cooldownUntil = Date.now() + YTMP3_429_COOLDOWN;
                throw Object.assign(new Error('poll 429'), { rateLimited: true });
            }
            if (pr.ok) {
                const pd = await pr.json();
                if (pd.title) title = pd.title;
                if (pd.status === 'completed') { downloadUrl = pd.downloadUrl || pd.downloadURL; break; }
                if (pd.status === 'fail') throw Object.assign(new Error('convert failed'), { videoSpecific: true });
            }
            await new Promise(r => setTimeout(r, 4000));
        }
        if (!downloadUrl) throw new Error('conversion timeout (150s)');

        // download عبر الـ Worker proxy (e=d) — أفضل من VPS المباشر لـ Railway
        const dlResp = await fetch(`${p.worker}/?u=${Buffer.from(downloadUrl).toString('base64')}&e=d&r=${p.referer}&api_key=${p.apiKey}&_=${Date.now()}`, {
            headers: H, signal: AbortSignal.timeout(180000),
        });
        if (!dlResp.ok) throw new Error(`download HTTP ${dlResp.status}`);
        const buf = Buffer.from(await dlResp.arrayBuffer());
        return this._ytmp3WriteAudio(p, buf, videoId, title, t0, outputFile);
    }

    /**
     * مسار 3: hidden-sun worker (مسار api() القديم — يلف backend 123tokyo.xyz)
     * e=i (init/poll) → e=d (download proxy)
     */
    static async _ytmp3HiddensunFlow(p, videoId, outputFile, format, t0) {
        const H = {
            ...YTMP3_BROWSER_HEADERS,
            'Referer': 'https://tubeapi.org/',
        };
        const initUrl = () => `${p.worker}/?e=i&v=${videoId}&api_key=${p.apiKey}&_=${Date.now()}`;

        // init (قد يرجع النتيجة فوراً من الكاش، أو processing)
        let resp = await fetch(initUrl(), { headers: H, signal: AbortSignal.timeout(60000) });
        if (resp.status === 429) {
            p.cooldownUntil = Date.now() + YTMP3_429_COOLDOWN;
            throw Object.assign(new Error('init 429'), { rateLimited: true });
        }
        if (!resp.ok) throw new Error(`init HTTP ${resp.status}`);
        let data = await resp.json();
        let title = data.title || '';
        let link = data.link;

        // polling لو processing (كل 6 ثوان — مطابق لـ JS الموقع الأصلي)
        let polls = 0;
        while (!link && polls < 25) {
            if (data.status === 'fail' || data.msg === 'fail') {
                throw Object.assign(new Error('convert failed'), { videoSpecific: true });
            }
            await new Promise(r => setTimeout(r, 6000));
            const pr = await fetch(initUrl(), { headers: H, signal: AbortSignal.timeout(30000) });
            if (!pr.ok) throw new Error(`poll HTTP ${pr.status}`);
            data = await pr.json();
            if (data.title) title = data.title;
            if (data.status === 'ok' || data.link) link = data.link;
            polls++;
        }
        if (!link) throw new Error('conversion timeout (150s)');

        // download عبر الـ Worker proxy (e=d + btoa(link))
        const dlResp = await fetch(`${p.worker}/?e=d&u=${Buffer.from(link).toString('base64')}&r=${p.referer}&api_key=${p.apiKey}&_=${Date.now()}`, {
            headers: H, signal: AbortSignal.timeout(180000),
        });
        if (!dlResp.ok) throw new Error(`download HTTP ${dlResp.status}`);
        const buf = Buffer.from(await dlResp.arrayBuffer());
        return this._ytmp3WriteAudio(p, buf, videoId, title, t0, outputFile);
    }

    /** convert + progress + download بمزود مباشر (جلسة مُعاد استخدامها + محاولة ثانية بجلسة جديدة) */
    static async _ytmp3DirectFlow(p, videoId, outputFile, format, t0) {
        const headers = _ytmp3Headers(p);
        let lastErr = null;

        for (let attempt = 0; attempt < 2; attempt++) {
            const session = await _ytmp3AcquireSession(p, attempt > 0);
            try {
                // ── convert + تتبع redirect (حتى 3) ─────────────────────
                let resp = await fetch(`${session.convertURL}&v=${videoId}&f=${format}&_=${Date.now()}`, { headers });
                if (resp.status === 429) {
                    p.cooldownUntil = Date.now() + YTMP3_429_COOLDOWN;
                    throw Object.assign(new Error('convert 429'), { rateLimited: true });
                }
                if (resp.status === 403) {
                    throw Object.assign(new Error(`convert HTTP 403 (IP blocked)`), { ipBlocked: true });
                }
                if (!resp.ok) throw new Error(`convert HTTP ${resp.status}`);
                let data = await resp.json();
                let redirects = 0;
                while (Number(data.error) === 0 && Number(data.redirect) === 1 && data.redirectURL && redirects < 3) {
                    let u = data.redirectURL;
                    const vi = u.indexOf('&v=');
                    if (vi > -1) u = u.substring(0, vi); // نفس منطق JS الموقع الأصلي
                    resp = await fetch(`${u}&v=${videoId}&f=${format}&_=${Date.now()}`, { headers });
                    if (resp.status === 429) {
                        p.cooldownUntil = Date.now() + YTMP3_429_COOLDOWN;
                        throw Object.assign(new Error('redirect 429'), { rateLimited: true });
                    }
                    if (!resp.ok) throw new Error(`redirect HTTP ${resp.status}`);
                    data = await resp.json();
                    redirects++;
                }
                if (Number(data.error) !== 0) throw new Error(`convert err ${JSON.stringify(data).substring(0, 120)}`);
                if (!data.downloadURL) throw new Error('no downloadURL in response');
                let title = data.title || '';

                // ── progress polling (إن وُجد progressURL) ──────────────
                if (data.progressURL) {
                    const deadline = Date.now() + 90e3;
                    let lastProgress = -1;
                    while (Date.now() < deadline) {
                        try {
                            const pr = await fetch(`${data.progressURL}&_=${Date.now()}`, { headers });
                            if (pr.ok) {
                                const pd = await pr.json();
                                if (Number(pd.error) !== 0) break; // جرب التحميل مباشرة
                                if (pd.title && !title) title = pd.title;
                                if (Number(pd.progress) >= 3) break;
                                if (Number(pd.progress) !== lastProgress) {
                                    lastProgress = Number(pd.progress);
                                    console.log(`  [ytmp3:${p.name}] progress ${pd.progress}/3 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
                                }
                            }
                        } catch (e) { /* استمر بالاستطلاع */ }
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
                console.log(`  [ytmp3:${p.name}] convert ready (${((Date.now() - t0) / 1000).toFixed(1)}s)${title ? ' | ' + title.substring(0, 60) : ''}`);

                // ── download + تحقق بايتات صوتية ────────────────────────
                const rParam = p.site.replace('https://', '');
                const dlResp = await fetch(`${data.downloadURL}&v=${videoId}&f=${format}&r=${rParam}`, { headers });
                if (!dlResp.ok) throw new Error(`download HTTP ${dlResp.status}`);
                const buf = Buffer.from(await dlResp.arrayBuffer());
                if (!_isAudioBuffer(buf)) {
                    throw new Error(`not an audio file (${buf.length} bytes, head: ${buf.subarray(0, 4).toString('hex')})`);
                }
                fs.writeFileSync(outputFile, buf);
                console.log(`  [ytmp3:${p.name}] downloaded ${(buf.length / 1024 / 1024).toFixed(2)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

                return {
                    success: true,
                    title: title || `YouTube_${videoId}`,
                    fileSize: buf.length,
                    format: 'mp3',
                    videoId,
                };
            } catch (err) {
                lastErr = err;
                if (err.rateLimited) throw err; // 429 لا يُعالج بجلسة جديدة — دوّر المزود
                // جلسة ربما انتهت (sig منتهي) — امسحها وحاول بجلسة جديدة
                p.session = null;
            }
        }
        throw lastErr || new Error('convert failed');
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  MASTER DOWNLOAD FUNCTION — يجرب كل الـ providers بالترتيب
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * ⭐ تنزيل MP3 — Master function مع multi-provider fallback
     *
     * الترتيب:
     *   1. OLD ytmp3 API (مع SOCKS5 proxy fallback تلقائياً)
     *   2. yt-dlp مع cookies (للـ search/info فقط — لا يُستخدم للتنزيل عادةً)
     *
     * @param {string} videoUrl - YouTube URL أو video ID
     * @param {string} outputFile - مسار الملف الناتج
     * @param {Object} options - خيارات إضافية
     */
    static async downloadMP3(videoUrl, outputFile, options = {}) {
        const videoId = this.extractVideoId(videoUrl) || videoUrl;
        const format = options.format || 'mp3';

        console.log(`\n[YouTube] Starting MP3 download for ${videoId}`);

        // ── Provider 1: ytmp3 family (3 Cloudflare Workers + gamma + epsilon) ──
        console.log(`\nProvider 1: ytmp3 family (fancy/tubeapi/hiddensun workers + gamma + epsilon)`);
        const familyResult = await this.downloadViaYtmp3Family(videoId, outputFile, format);
        if (familyResult.success) {
            return familyResult;
        }
        console.log(`\nProvider 1 failed (${familyResult.error}), trying yt-dlp...`);

        // ── Provider 3: yt-dlp بسلسلة player clients بديلة ─────────────
        // android_music أصبح يتطلب PO Token ("Requested format is not available")
        // لذا نجرب سلسلة: المُعد في config ثم بدائل معروفة بعملها مع cookies
        const clientLadder = [
            config.ytdl.playerClients || 'mweb,web_safari',
            'tv',
            'android_vr',
            'android_music', // يتطلب PO Token غالباً — محاولة أخيرة فقط
        ];
        const seen = new Set();
        let lastYtdlError = null;
        for (const clients of clientLadder) {
            const key = clients.replace(/\s+/g, '');
            if (seen.has(key)) continue;
            seen.add(key);
            console.log(`\nProvider 3: yt-dlp (player_client=${clients})`);
            try {
                const ytdlOpts = this.getYtDlpOptions({
                    output: outputFile,
                    format: 'bestaudio[ext=m4a]/bestaudio/best',
                    extractAudio: true,
                    audioFormat: 'mp3',
                    audioQuality: 0,
                    postprocessorArgs: {
                        'ffmpeg': ['-c:a', 'libmp3lame', '-b:a', '192k'],
                    },
                });
                // override سلسلة العملاء لهذه المحاولة
                ytdlOpts.extractorArgs = `youtube:player_client=${key}`;

                await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, ytdlOpts);

                if (fs.existsSync(outputFile)) {
                    const stats = fs.statSync(outputFile);
                    if (stats.size > 0) {
                        console.log(`  Downloaded ${(stats.size / 1024 / 1024).toFixed(2)} MB via yt-dlp (${clients})`);
                        return {
                            success: true,
                            title: `YouTube_${videoId}`,
                            fileSize: stats.size,
                            format: 'mp3',
                            videoId,
                        };
                    }
                }
                lastYtdlError = new Error('yt-dlp produced no file');
            } catch (ytdlErr) {
                lastYtdlError = ytdlErr;
                console.log(`  yt-dlp (${clients}) failed: ${ytdlErr.message.substring(0, 140)}`);
            }
        }

        // ── كل المزودين فشلوا ───────────────────────────────────────────
        return {
            success: false,
            error: `All download providers failed. ytmp3-family: ${familyResult.error} | yt-dlp: ${lastYtdlError ? lastYtdlError.message : 'unknown'}`,
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Search & Info functions (yt-dlp based)
    // ═══════════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════════
    //  SEARCH: YouTube Innertube API (most reliable — no auth needed)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * يبحث في YouTube باستخدام Innertube API (YouTube's internal API)
     * لا يحتاج auth، لا يحتاج cookies، يعمل من أي IP (حتى Railway)
     *
     * @param {string} query - نص البحث
     * @param {number} limit - عدد النتائج (افتراضي 5)
     * @returns {Promise<Array>} قائمة الأغاني
     */
    static async searchViaInnertube(query, limit = 5) {
        try {
            const searchUrl = 'https://www.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
            const body = JSON.stringify({
                context: {
                    client: {
                        clientName: 'WEB',
                        clientVersion: '2.20240101.00.00',
                        hl: 'ar',
                    },
                },
                query: query,
                params: 'EgIQAQ%3D%3D', // video filter
            });

            const resp = await smartFetch(searchUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Origin': 'https://www.youtube.com',
                    'Referer': 'https://www.youtube.com/',
                    'Accept': 'application/json',
                },
                body,
            });

            if (!resp.ok) {
                throw new Error(`Innertube search HTTP ${resp.status}`);
            }

            const data = await resp.json();
            const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

            const tracks = [];
            for (const section of contents) {
                const items = section?.itemSectionRenderer?.contents || [];
                for (const item of items) {
                    if (tracks.length >= limit) break;
                    const v = item.videoRenderer;
                    if (!v || !v.videoId) continue;

                    // Extract title
                    const titleRuns = v.title?.runs || [];
                    const title = titleRuns.map(r => r.text || '').join('') || 'Unknown';

                    // Extract duration
                    const durationText = v.lengthText?.simpleText || v.lengthText?.accessibility?.accessibilityData?.label || '';
                    let durationSec = 0;
                    const match = durationText.match(/(?:(\d+):)?(\d+):(\d+)/);
                    if (match) {
                        const h = parseInt(match[1] || '0');
                        const m = parseInt(match[2]);
                        const s = parseInt(match[3]);
                        durationSec = h * 3600 + m * 60 + s;
                    }

                    // Extract channel name (artist)
                    const channelRuns = v.ownerText?.runs || [];
                    const artist = channelRuns.map(r => r.text || '').join('') || v.shortBylineText?.runs?.[0]?.text || 'Unknown';

                    // Extract thumbnail
                    const thumbnails = v.thumbnail?.thumbnails || [];
                    const thumbnail = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : null;

                    // Extract view count
                    let views = 0;
                    const viewText = v.viewCountText?.simpleText || '';
                    const viewMatch = viewText.match(/(\d[\d,]*)/);
                    if (viewMatch) {
                        views = parseInt(viewMatch[1].replace(/,/g, ''));
                    }

                    tracks.push({
                        title,
                        artist,
                        url: `https://www.youtube.com/watch?v=${v.videoId}`,
                        id: v.videoId,
                        thumbnail,
                        duration: durationSec,
                        platform: 'youtube',
                        views,
                    });
                }
                if (tracks.length >= limit) break;
            }

            console.log(`  ✅ Innertube: found ${tracks.length} results for "${query}"`);
            return tracks;
        } catch (err) {
            console.error(`  ⚠️ Innertube search failed: ${err.message}`);
            return [];
        }
    }

    /**
     * يبحث في YouTube عن أغنية
     * الترتيب: Innertube API (primary) → yt-dlp (fallback)
     */
    static async search(query, limit = 5, guildId = null) {
        console.log(`🔍 [YouTube] Searching for "${query}" (limit: ${limit})`);

        // ── Provider 1: Innertube API (primary — works on Railway) ──────
        const innertubeResults = await this.searchViaInnertube(query, limit);
        if (innertubeResults.length > 0) {
            return innertubeResults.slice(0, limit);
        }

        // ── Provider 2: yt-dlp (fallback — may fail on Railway) ─────────
        console.log(`  ⚠️ Innertube returned no results, falling back to yt-dlp...`);
        try {
            const searchQuery = `ytsearch${limit}:${query}`;
            const results = await youtubedl(searchQuery, this.getYtDlpOptions({
                dumpSingleJson: true,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                preferFreeFormats: true,
                youtubeSkipDashManifest: true,
            }));

            const searchResults = Array.isArray(results) ? results : [results];
            const tracks = searchResults.filter(r => r && r.id).map(r => ({
                title: r.title || 'Unknown Title',
                artist: r.uploader || r.channel || 'Unknown Artist',
                url: r.webpage_url || r.original_url || `https://www.youtube.com/watch?v=${r.id}`,
                id: r.id,
                thumbnail: r.thumbnail || (r.thumbnails && r.thumbnails.length > 0 ? r.thumbnails[r.thumbnails.length - 1].url : null),
                duration: r.duration || 0,
                platform: 'youtube',
                views: r.view_count || 0,
            }));

            return tracks;
        } catch (err) {
            console.error(`❌ [YouTube] yt-dlp search failed: ${err.message}`);
            return [];
        }
    }

    /**
     * يحصل على معلومات الأغنية من URL
     * يستخدم Innertube API للحصول على metadata سريع
     */
    static async getInfo(url) {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            // fallback to yt-dlp
            return this.getInfoViaYtdl(url);
        }

        // استخدم Innertube API
        try {
            const nextUrl = 'https://www.youtube.com/youtubei/v1/next?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
            const body = JSON.stringify({
                context: {
                    client: {
                        clientName: 'WEB',
                        clientVersion: '2.20240101.00.00',
                        hl: 'ar',
                    },
                },
                videoId,
            });

            const resp = await smartFetch(nextUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Origin': 'https://www.youtube.com',
                    'Referer': 'https://www.youtube.com/',
                },
                body,
            });

            if (resp.ok) {
                const data = await resp.json();
                // Extract video info from the response
                const contents = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
                let title = '', artist = '', duration = 0, views = 0, thumbnail = null;

                for (const c of contents) {
                    if (c.videoPrimaryInfoRenderer) {
                        const titleRuns = c.videoPrimaryInfoRenderer.title?.runs || [];
                        title = titleRuns.map(r => r.text).join('');
                        const viewText = c.videoPrimaryInfoRenderer.viewCount?.videoViewCountRenderer?.viewCount?.simpleText || '';
                        const viewMatch = viewText.match(/(\d[\d,]*)/);
                        if (viewMatch) views = parseInt(viewMatch[1].replace(/,/g, ''));
                    }
                    if (c.videoSecondaryInfoRenderer) {
                        const ownerRuns = c.videoSecondaryInfoRenderer.owner?.videoOwnerRenderer?.title?.runs || [];
                        artist = ownerRuns.map(r => r.text).join('') || 'Unknown';
                    }
                }

                if (title) {
                    thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
                    return {
                        title,
                        artist,
                        url: `https://www.youtube.com/watch?v=${videoId}`,
                        id: videoId,
                        thumbnail,
                        duration,
                        platform: 'youtube',
                        views,
                    };
                }
            }
        } catch (e) {
            console.log(`  ⚠️ Innertube getInfo failed: ${e.message}`);
        }

        // Fallback to yt-dlp
        return this.getInfoViaYtdl(url);
    }

    /**
     * Fallback: getInfo via yt-dlp
     */
    static async getInfoViaYtdl(url) {
        try {
            const info = await youtubedl(url, this.getYtDlpOptions({
                dumpSingleJson: true,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                preferFreeFormats: true,
                youtubeSkipDashManifest: true,
            }));

            return {
                title: info.title || 'Unknown Title',
                artist: info.uploader || info.channel || 'Unknown Artist',
                url: info.webpage_url || info.original_url || url,
                id: info.id,
                thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails.length > 0 ? info.thumbnails[info.thumbnails.length - 1].url : null),
                duration: info.duration || 0,
                platform: 'youtube',
                views: info.view_count || 0,
            };
        } catch (err) {
            console.error(`❌ [YouTube] getInfo failed: ${err.message}`);
            return null;
        }
    }

    /**
     * يحصل على معلومات قائمة تشغيل YouTube
     */
    static async getPlaylistInfo(url) {
        try {
            const info = await youtubedl(url, this.getYtDlpOptions({
                dumpSingleJson: true,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                preferFreeFormats: true,
                youtubeSkipDashManifest: true,
                yesPlaylist: true,
                flatPlaylist: true,
            }));

            if (!info.entries || info.entries.length === 0) return null;

            const tracks = info.entries.map(entry => ({
                title: entry.title || 'Unknown Title',
                artist: entry.uploader || entry.channel || 'Unknown Artist',
                url: entry.url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : null),
                id: entry.id,
                thumbnail: entry.thumbnails && entry.thumbnails.length > 0 ? entry.thumbnails[entry.thumbnails.length - 1].url : null,
                duration: entry.duration || 0,
                platform: 'youtube',
            })).filter(t => t.url && t.id);

            return {
                title: info.title || 'Unknown Playlist',
                tracks,
                url: info.webpage_url || url,
            };
        } catch (err) {
            console.error(`❌ [YouTube] getPlaylistInfo failed: ${err.message}`);
            return null;
        }
    }
}

module.exports = YouTube;
