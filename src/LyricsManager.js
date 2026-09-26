// ═══════════════════════════════════════════════════════════════════════════
//  src/LyricsManager.js — جلب كلمات الأغاني
//  ─────────────────────────────────────────────────────────────────────────
//  MUS Bot v26.7 — Dev: ELMINYAWE 👨‍💻
//
//  ✅ v26.7 — سلسلة 3 مزودين مجانيين بالكامل (بدون أي API keys):
//     1. LRCLIB (lrclib.net) — API مجاني رسمي، JSON موثوق، يدعم البحث الدقيق
//        بالمُدّة + بحث عام مع تقييم النتائج (كان الثاني — أصبح الأول)
//     2. lyrics.ovh — API مجاني بدون مفتاح (مزود جديد)
//     3. Genius (scraping) — الملاذ الأخير (يُحظر كثيراً من Cloudflare على
//        IPs مراكز البيانات — لهذا تم تنزيله لآخر القائمة)
//
//  ✅ v26.7 — تنظيف عناوين محسّن للأغاني العربية:
//     - فصل "الفنان - الأغنية" و "| الجزء الثاني" (عناوين يوتيوب المزدوجة)
//     - إزالة كلمات مثل: الكليب الرسمي، فيديو كليب، كلمات، حصرياً...
//     - إزالة English junk: Official Video, MV, Audio, Remastered...
//
//  ✅ v26.7 — كاش محدود الحجم (300 مدخل) + cooldown للمزودين الفاشلين
//     (يمنع تضخم الذاكرة عبر أسابيع التشغيل ويمنع إهدار الوقت على مزود معطّل)
// ═══════════════════════════════════════════════════════════════════════════
const axios = require('axios');
const Genius = require('genius-lyrics');
const config = require('../config');

const CACHE_MAX_ENTRIES = 300;             // ✅ v26.7: حد أقصى للكاش (كان بلا حدود)
const PROVIDER_COOLDOWN_MS = 30 * 60 * 1000; // تخطَّ مزوداً فشل 3 مرات متتالية لنصف ساعة
const PROVIDER_TIMEOUT = 8000;

class LyricsManager {
    constructor() {
        this.cache = new Map(); // Cache lyrics by track key
        this.cacheTimers = new Map(); // Track cache expiration timers

        // ✅ v26.7: حالة المزودين (فشل متتالٍ + cooldown حتى وقت معين)
        this.providerState = new Map(); // name -> { fails, cooldownUntil }

        // Initialize Genius client (works without token via web scraping)
        const geniusApiKey = config.genius?.clientId || process.env.GENIUS_CLIENT_ID;
        if (geniusApiKey) {
            this.geniusClient = new Genius.Client(geniusApiKey);
        } else {
            this.geniusClient = new Genius.Client();
        }
    }

    // ── ✅ v26.7: أدوات حالة المزودين ──────────────────────────────────────

    _providerAllowed(name) {
        const st = this.providerState.get(name);
        if (!st) return true;
        if (st.cooldownUntil && Date.now() < st.cooldownUntil) return false;
        return true;
    }

    _providerFailed(name) {
        const st = this.providerState.get(name) || { fails: 0, cooldownUntil: 0 };
        st.fails++;
        if (st.fails >= 3) {
            st.cooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
            st.fails = 0;
            console.warn(`⚠️ [Lyrics] Provider "${name}" failed 3x — cooling down 30min`);
        }
        this.providerState.set(name, st);
    }

    _providerSucceeded(name) {
        this.providerState.delete(name);
    }

    // ── الكاش ──────────────────────────────────────────────────────────────

    getCacheKey(track) {
        if (!track) return 'unknown';
        const title = (track.title || '').toLowerCase();
        const artist = (track.artist || track.uploader || '').toLowerCase();
        return `${title}-${artist}` || title || 'unknown';
    }

    storeInCache(cacheKey, data, ttlMs = null) {
        if (!cacheKey) return;

        this.cache.set(cacheKey, data);

        if (this.cacheTimers.has(cacheKey)) {
            clearTimeout(this.cacheTimers.get(cacheKey));
        }

        const effectiveTtl = typeof ttlMs === 'number' ? ttlMs : (data ? 3600000 : 600000);

        const timer = setTimeout(() => {
            this.cache.delete(cacheKey);
            this.cacheTimers.delete(cacheKey);
        }, effectiveTtl);

        if (typeof timer.unref === 'function') {
            timer.unref();
        }

        this.cacheTimers.set(cacheKey, timer);

        // ✅ v26.7: حد أقصى للكاش — احذف الأقدم إدراجاً (FIFO)
        if (this.cache.size > CACHE_MAX_ENTRIES) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey && oldestKey !== cacheKey) {
                this.cache.delete(oldestKey);
                const t = this.cacheTimers.get(oldestKey);
                if (t) { clearTimeout(t); this.cacheTimers.delete(oldestKey); }
            }
        }
    }

    // ── تنظيف العناوين ─────────────────────────────────────────────────────

    cleanTrackTitle(title = '') {
        let t = String(title);
        // ✅ v26.7: عناوين يوتيوب المزدوجة "English title | العنوان العربي"
        // → خذ الجزء الأول فقط
        const pipeParts = t.split(/\s+[|｜]\s+/);
        if (pipeParts.length > 1 && pipeParts[0].trim().length >= 2) {
            t = pipeParts[0];
        }
        return t
            // أزل المحتوى داخل أقواس/أقواس مربعة (Official Video) [4K] ...
            .replace(/\((.*?)\)/g, ' ')
            .replace(/\[(.*?)\]/g, ' ')
            // ✅ v26.7: كلمات عربية شائعة في عناوين الأغاني
            .replace(/الكليب الرسمي|الكليب الرسمى|كليب رسمي|كليب رسمى/g, '')
            .replace(/فيديو كليب|فيديوclip|فيدبو كليب/g, '')
            .replace(/\bكلمات\b|\bبكلمات\b/g, '')
            .replace(/حصريا|حصرياً|حصرى|حصري\b/g, '')
            .replace(/النسخة الأصلية|النسخه الاصليه|نسخة أصلية/g, '')
            .replace(/أغنية|اغنية|أغنيه|اغنيه/g, '')
            .replace(/طريقة|جديدة|حديثة\b/g, '')
            .replace(/الكاملة|الكامله|كاملة\b/g, '')
            .replace(/بجودة عالية|جودة عالية/g, '')
            .replace(/من فيلم|مسلسل\b/g, '')
            // ✅ English junk
            .replace(/official (music )?video/gi, '')
            .replace(/official (lyric|lyrics) (video|audio)/gi, '')
            .replace(/official audio/gi, '')
            .replace(/lyric video/gi, '')
            .replace(/\blyrics?\b/gi, '')
            .replace(/\bvisualizer\b/gi, '')
            .replace(/\bremaster(ed)?\b/gi, '')
            .replace(/\b(audio|video|mv|m\/v)\b/gi, '')
            .replace(/\b4k\b|\bhd\b|\bhq\b|\bsd\b/gi, '')
            .replace(/\bprod\.?( by)?\b/gi, '')
            // إشارات مشتركين
            .replace(/ft\.?|feat\.?|featuring/gi, '')
            // شرطات زائدة بعد التنظيف
            .replace(/\s*-\s*$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * ✅ v26.7: فصل "الفنان - الأغنية" إذا لم يكن هناك فنان
     * "Ahmed Kamel - 2ooly" → artist="Ahmed Kamel", title="2ooly"
     */
    splitArtistTitle(title, artist) {
        if (artist && artist.trim()) return { artist: artist.trim(), title: String(title || '').trim() };
        const t = String(title || '').trim();
        const m = t.match(/^(.{2,60}?)\s+[-–—]\s+(.{2,80})$/);
        if (m) return { artist: m[1].trim(), title: m[2].trim() };
        return { artist: '', title: t };
    }

    /**
     * ✅ v26.7: تطبيع نص للمقارنة (للتقييم بين نتائج البحث)
     */
    _norm(s) {
        return String(s || '')
            .toLowerCase()
            .replace(/[\u0623\u0625\u0622]/g, '\u0627') // أإآ → ا
            .replace(/\u0649/g, '\u064A')               // ى → ي
            .replace(/\u0629/g, '\u0647')               // ة → ه
            .replace(/[^\p{L}\p{N}\s]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * ✅ v26.7: درجة تشابه بسيطة (0..1) بين نصين
     */
    _similarity(a, b) {
        const na = this._norm(a), nb = this._norm(b);
        if (!na || !nb) return 0;
        if (na === nb) return 1;
        if (na.includes(nb) || nb.includes(na)) return 0.8;
        // تقاطع الكلمات
        const wa = new Set(na.split(' '));
        const wb = new Set(nb.split(' '));
        let inter = 0;
        for (const w of wa) if (wb.has(w) && w.length > 1) inter++;
        return inter / Math.max(wa.size, wb.size);
    }

    buildLyricsData(track, data = {}) {
        return {
            plain: data.plain ?? null,
            source: data.source ?? null,
            artist: data.artist ?? track?.artist ?? track?.uploader ?? null,
            title: data.title ?? track?.title ?? null,
            album: data.album ?? null
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  المزوّد 1: LRCLIB — مجاني، بدون مفتاح، JSON موثوق
    //  (أصبح الأول لأن Genius يُحظر بـ Cloudflare على IPs مراكز البيانات)
    // ═══════════════════════════════════════════════════════════════════════
    async fetchFromLrclib(track) {
        try {
            const rawArtist = track.artist || track.uploader || '';
            const split = this.splitArtistTitle(track.title, rawArtist);
            const cleanTitle = this.cleanTrackTitle(split.title);
            const artist = this.cleanTrackTitle(split.artist) || this.cleanTrackTitle(rawArtist);

            const headers = {
                'Accept': 'application/json',
                'User-Agent': `MUS-Bot/${config.version || '26.7'} (Discord music bot; +https://github.com/elminyawe31/mus)`,
            };

            // 1) البحث الدقيق مع المُدة (أفضل دقة إذا توفرت)
            if (cleanTitle && track.duration) {
                try {
                    const resp = await axios.get('https://lrclib.net/api/get', {
                        params: {
                            track_name: cleanTitle,
                            artist_name: artist || '',
                            duration: Math.round(track.duration),
                        },
                        timeout: PROVIDER_TIMEOUT,
                        headers,
                        responseType: 'json',
                        validateStatus: (s) => s === 200 || s === 404,
                    });
                    if (resp.status === 200 && resp.data && resp.data.plainLyrics) {
                        return this.buildLyricsData(track, {
                            plain: resp.data.plainLyrics,
                            source: 'LRCLIB',
                        });
                    }
                } catch (e) { /* انتقل للبحث العام */ }
            }

            // 2) البحث العام مع تقييم النتائج (بدل أخذ أول نتيجة عمياءً)
            const attempts = [];
            if (cleanTitle && artist) attempts.push({ track_name: cleanTitle, artist_name: artist });
            if (cleanTitle) attempts.push({ track_name: cleanTitle });
            if (artist) attempts.push({ q: `${artist} ${cleanTitle}`.trim() });

            for (const params of attempts) {
                if (!params.track_name && !params.q) continue;
                try {
                    const resp = await axios.get('https://lrclib.net/api/search', {
                        params,
                        timeout: PROVIDER_TIMEOUT,
                        headers,
                        responseType: 'json',
                    });

                    if (!Array.isArray(resp.data) || resp.data.length === 0) continue;
                    const results = resp.data;

                    // ✅ v26.7: اختر أفضل نتيجة بالتقييم (ليس [0] عمياءً)
                    let best = null, bestScore = 0;
                    for (const r of results.slice(0, 8)) {
                        if (!r || !r.plainLyrics) continue;
                        let score = this._similarity(r.trackName || '', cleanTitle) * 0.7
                                  + this._similarity(r.artistName || '', artist) * 0.3;
                        // مكافأة تطابق المُدة
                        if (track.duration && r.duration && Math.abs(r.duration - track.duration) <= 3) {
                            score += 0.25;
                        }
                        if (score > bestScore) { bestScore = score; best = r; }
                    }
                    if (best && bestScore >= 0.35) {
                        return this.buildLyricsData(track, {
                            plain: best.plainLyrics,
                            source: 'LRCLIB',
                        });
                    }
                } catch (error) {
                    // جرّب المحاولة التالية
                }
            }

            return null;
        } catch (error) {
            console.error('❌ [Lyrics] LRCLIB error:', error.message);
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  المزوّد 2: lyrics.ovh — مجاني تماماً، بدون مفتاح
    //  GET https://api.lyrics.ovh/v1/{artist}/{title}
    // ═══════════════════════════════════════════════════════════════════════
    async fetchFromLyricsOvh(track) {
        try {
            const rawArtist = track.artist || track.uploader || '';
            const split = this.splitArtistTitle(track.title, rawArtist);
            const cleanTitle = this.cleanTrackTitle(split.title);
            const artist = this.cleanTrackTitle(split.artist) || this.cleanTrackTitle(rawArtist);

            if (!cleanTitle || !artist) return null; // lyrics.ovh يحتاج الفنان

            const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(cleanTitle)}`;
            const resp = await axios.get(url, {
                timeout: PROVIDER_TIMEOUT,
                headers: { 'Accept': 'application/json' },
                responseType: 'json',
                validateStatus: (s) => s === 200 || s === 404 || s === 503,
            });

            if (resp.status !== 200) return null;
            let text = resp.data && resp.data.lyrics;
            if (!text || typeof text !== 'string') return null;
            text = text.trim();
            if (text.length < 30) return null;
            if (this.isHtmlResponse(text)) return null;

            return this.buildLyricsData(track, {
                plain: text,
                source: 'lyrics.ovh',
            });
        } catch (error) {
            return null; // 503/504 شائع — تجاهل بصمت
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  المزوّد 3: Genius (scraping) — الملاذ الأخير
    // ═══════════════════════════════════════════════════════════════════════
    async fetchFromGenius(track) {
        try {
            const rawArtist = track.artist || track.uploader || '';
            const split = this.splitArtistTitle(track.title, rawArtist);
            const title = this.cleanTrackTitle(split.title);
            const artist = this.cleanTrackTitle(split.artist) || this.cleanTrackTitle(rawArtist);

            if (!title) return null;

            const query = artist ? `${artist} ${title}` : title;
            const searches = await this.geniusClient.songs.search(query);

            if (!searches || searches.length === 0) return null;

            const firstSong = searches[0];
            const lyrics = await firstSong.lyrics();

            if (!lyrics) return null;

            if (this.isHtmlResponse(lyrics)) {
                console.warn('⚠️ Genius returned HTML instead of lyrics — skipping');
                return null;
            }

            const cleanedLyrics = this.cleanGeniusLyrics(lyrics);
            if (!cleanedLyrics) return null;

            const textOnly = cleanedLyrics.replace(/<[^>]*>/g, '').trim();
            if (textOnly.length < 30) {
                console.warn('⚠️ Genius cleaned lyrics too short — likely HTML, skipping');
                return null;
            }

            return this.buildLyricsData(track, {
                plain: cleanedLyrics,
                source: 'Genius'
            });
        } catch (error) {
            const msg = error.message || '';
            if (msg.includes('is not valid JSON') || msg.includes('Unexpected token')) {
                console.warn('⚠️ Genius returned HTML/invalid response — skipping (not a lyrics page)');
                return null;
            }
            return null;
        }
    }

    /**
     * جلب الكلمات — سلسلة 3 مزودين مجانية بالكامل:
     * LRCLIB → lyrics.ovh → Genius
     * @param {Object} track - { title, artist, uploader, url, duration }
     * @returns {Promise<Object|null>} Lyrics object or null
     */
    async fetchLyrics(track) {
        if (!track || !track.title) return null;

        const cacheKey = this.getCacheKey(track);

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // ✅ v26.7: السلسلة الجديدة — LRCLIB أولاً (API حقيقي موثوق)
        const providers = [
            { name: 'lrclib', fn: (t) => this.fetchFromLrclib(t) },
            { name: 'lyricsovah', fn: (t) => this.fetchFromLyricsOvh(t) },
            { name: 'genius', fn: (t) => this.fetchFromGenius(t) },
        ];

        for (const p of providers) {
            if (!this._providerAllowed(p.name)) continue;
            try {
                const result = await p.fn(track);
                if (result && result.plain) {
                    this._providerSucceeded(p.name);
                    this.storeInCache(cacheKey, result);
                    return result;
                }
                this._providerFailed(p.name); // نتيجة فارغة = فشل بسيط
            } catch (e) {
                this._providerFailed(p.name);
            }
        }

        // Cache null result (10 دقائق) لتجنب البحث المتكرر عن نفس الأغنية الفاشلة
        this.storeInCache(cacheKey, null, 600000);
        return null;
    }

    /**
     * ✅ يكتشف إذا كانت الاستجابة HTML بدلاً من كلمات أغنية حقيقية
     */
    isHtmlResponse(text) {
        if (!text || typeof text !== 'string') return false;
        if (text.includes('<!DOCTYPE') || text.includes('<!doctype')) return true;
        if (text.includes('<html') || text.includes('<head>') || text.includes('<body')) return true;
        if (text.includes('cf-browser-verification') || text.includes('Just a moment')) return true;
        const firstLines = text.split('\n').slice(0, 10).filter(l => l.trim());
        if (firstLines.length > 0) {
            const htmlLines = firstLines.filter(l => l.trim().startsWith('<')).length;
            if (htmlLines / firstLines.length > 0.5) return true;
        }
        return false;
    }

    cleanGeniusLyrics(lyrics) {
        if (!lyrics) return null;

        let cleaned = lyrics;

        cleaned = cleaned.replace(/^\d+\s+Contributors.*?Lyrics(<[^>]+>)*\s*/is, '');
        cleaned = cleaned.replace(/<[^>]*>/g, '');
        cleaned = cleaned.replace(/^[^\[]+?\.{3}\s*Read More\s*/im, '');
        cleaned = cleaned.replace(/\[[""][^\]]{50,}\]/g, '');
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        cleaned = cleaned.trim();

        return cleaned || null;
    }

    /**
     * Format full lyrics for display (with pagination support)
     * @param {Object} lyricsData - Lyrics data
     * @param {number} maxLength - Max character length per page
     * @returns {Array<string>} Array of lyric pages
     */
    formatFullLyrics(lyricsData, maxLength = 4000) {
        if (!lyricsData) return [];

        const text = lyricsData.plain || lyricsData.synced?.replace(/\[\d+:\d+\.\d+\]/g, '') || '';
        if (!text) return [];

        const pages = [];
        const lines = text.split('\n').filter(line => line.trim());

        let currentPage = '';
        for (const line of lines) {
            if ((currentPage + line + '\n').length > maxLength) {
                if (currentPage) pages.push(currentPage.trim());
                currentPage = line + '\n';
            } else {
                currentPage += line + '\n';
            }
        }

        if (currentPage) pages.push(currentPage.trim());

        return pages;
    }

    /**
     * ✅ v26.7: قص الكاش يدوياً (تُستخدم من StabilityManager لتحرير الذاكرة)
     */
    trimCache(maxEntries = 100) {
        let removed = 0;
        while (this.cache.size > maxEntries) {
            const oldestKey = this.cache.keys().next().value;
            if (!oldestKey) break;
            this.cache.delete(oldestKey);
            const t = this.cacheTimers.get(oldestKey);
            if (t) { clearTimeout(t); this.cacheTimers.delete(oldestKey); }
            removed++;
        }
        return removed;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        for (const timer of this.cacheTimers.values()) {
            clearTimeout(timer);
        }
        this.cacheTimers.clear();
    }
}

module.exports = new LyricsManager();
