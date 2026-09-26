// ═══════════════════════════════════════════════════════════════════════════
//  src/MusicCard.js — بطاقة NowPlaying بتصميم musicard "Ease" الأصلي
//  ─────────────────────────────────────────────────────────────────────────
//  MUS Bot v26.8 — Dev: ELMINYAWE 👨‍💻
//
//  ✅ v26.8 — إعادة بناء كاملة مطابقة لثيم Ease من github.com/kunalkandepatil/musicard
//     1. الهيكل SVG الأصلي حرفياً من مكتبة musicard (التدرج + مكبّر الصوت + الأشرطة pill)
//        - تدرج أفقي: شفاف يساراً → لون الخلفية يميناً (نفس paint0_linear_61_14)
//        - شريط تقدم 318×25 rx=12.5 + شريط صوت 160×25 rx=12.5 (نفس الإحداثيات بالبكسل)
//        - أيقونة السماعة بنفس الـ SVG path الأصلي
//     2. الثيم الفاتح (ease) كما هو معروض في معاينة الريبو + خيار ease-dark
//        MUSIC_CARD_THEME=ease | ease-dark (متغير بيئة اختياري)
//     3. ✨ إصلاح جذري لمشكلة العربية (مربعات □□□):
//        - خط Tajawal العربي (5 أوزان) مرفق داخل src/base/fonts/ — عربي + لاتيني
//        - كاشف tofu محصّن: حروف مختلفة يجب أن تُرسم بأشكال مختلفة
//          (الكاشف القديم كان يعد البكسلات — والمربعات أيضاً بكسلات! لذلك فشل)
//        - Kalam القديم خط هندي ديفاناغاري بلا عربية — كان سبب المربعات
//     4. زوايا superellipse (منحنيات مستمرة طبيعية) للبطاقة والألبوم
//     5. قص النص بالبكسل + تنقية emoji + كاش صور LRU + تعافي ذاتي + try/catch لكل قسم
// ═══════════════════════════════════════════════════════════════════════════
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const axios = require('axios');
const fsSync = require('fs');

// ── الثيم ───────────────────────────────────────────────────────────────────
// الافتراضي من متغير البيئة — ويمكن تغييره لكل سيرفر عبر أوامر /lite و /dark (v26.10)
const DEFAULT_CARD_THEME = (process.env.MUSIC_CARD_THEME === 'ease-dark') ? 'ease-dark' : 'ease';

// ثيم كل سيرفر على حدة (guildId → 'ease' | 'ease-dark') — يُستعاد من SettingsStore عند الإقلاع
const guildThemeOverrides = new Map();

function resolveTheme(guildId) {
    if (guildId && guildThemeOverrides.has(String(guildId))) return guildThemeOverrides.get(String(guildId));
    return DEFAULT_CARD_THEME;
}

function setGuildTheme(guildId, theme) {
    const t = (theme === 'ease-dark') ? 'ease-dark' : 'ease';
    guildThemeOverrides.set(String(guildId), t);
    return t;
}

function clearGuildTheme(guildId) {
    return guildThemeOverrides.delete(String(guildId));
}

function getGuildTheme(guildId) {
    return resolveTheme(guildId);
}

const THEMES = {
    // الثيم الفاتح — مطابق لمعاينة ease في ريبو musicard
    ease: {
        bg: '#FFFFFF',            // لون الخلفية الصلب (يمين البطاقة)
        fg: '#000000',            // لون النصوص والأشرطة
        fgSoft: 'rgba(0,0,0,0.55)',      // requester
        fgSofter: 'rgba(0,0,0,0.42)',    // نصوص ثانوية
        fgDev: '#000000',                // ✅ v26.10: بصمة المطور صافية سوداء 100%
        artBorder: 'rgba(0,0,0,0.10)',
        artPlaceholder: ['#EBE7EA', '#D9D3D8'],
        artPlaceholderIcon: 'rgba(0,0,0,0.22)',
        cardBorder: 'rgba(0,0,0,0.07)',
    },
    // الثيم الداكن — القيم الافتراضية في كود musicard نفسه
    'ease-dark': {
        bg: '#000000',
        fg: '#FFFFFF',
        fgSoft: 'rgba(255,255,255,0.55)',
        fgSofter: 'rgba(255,255,255,0.45)',
        fgDev: '#FFFFFF',               // ✅ v26.10: بصمة المطور صافية بيضاء 100%
        artBorder: 'rgba(255,255,255,0.12)',
        artPlaceholder: ['#2a2a3a', '#1a1a2a'],
        artPlaceholderIcon: 'rgba(255,255,255,0.22)',
        cardBorder: 'rgba(255,255,255,0.10)',
    },
};
// ⚠️ لا يوجد T ثابت على مستوى الموديول بعد الآن — يُحدد لكل استدعاء حسب ثيم السيرفر (v26.10)

// ── أبعاد ثيم Ease (حرفياً من مكتبة musicard) ───────────────────────────────
const W = 1415, H = 348;
const ART_SIZE = 292;
const ART_X = 28, ART_Y = 28;
const ART_RADIUS = 110;          // زاوية فائقة الاستدارة مثل معاينة ease
const CARD_RADIUS = 140;         // زاوية البطاقة (cropify borderRadius في musicard)
const TEXT_X = 377;              // بداية النصوص (بعد الألبوم) — نفس musicard
const TITLE_Y = 130;             // baseline العنوان
const ARTIST_Y = 187;            // baseline الفنان
const BAR_X = 377, BAR_Y = 243, BAR_W = 318, BAR_H = 25, BAR_RX = 12.5;
const TIME_X = 710, TIME_Y = 255;
const VOLBAR_X = 966, VOLBAR_Y = 242, VOLBAR_W = 160, VOLBAR_H = 25;
const VOLTEXT_X = 1140, VOLTEXT_Y = 255;

// ── State ───────────────────────────────────────────────────────────────────
let _canvasReady = false;
let _canvasError = null;
let _consecutiveFailures = 0;
let _lastFontRefresh = 0;
const FONT_REFRESH_COOLDOWN = 5 * 60 * 1000;
const HEAL_AFTER_FAILURES = 2;

// ── Image LRU cache ─────────────────────────────────────────────────────────
const imageCache = new Map(); // url -> { image, at }
const IMAGE_CACHE_MAX = 48;
const IMAGE_CACHE_TTL = 2 * 60 * 60 * 1000;

// ── سلاسل الخطوط ────────────────────────────────────────────────────────────
// Tajawal: عربي + لاتيني بنفس الوقت (خط جوجل مفتوح المصدر — Boutros International)
const TAJ_DIR = path.join(__dirname, 'base', 'fonts');
const TAJ_WEIGHTS = {
    regular: { file: 'Tajawal-Regular.ttf', alias: 'MusTajRegular' },
    medium: { file: 'Tajawal-Medium.ttf', alias: 'MusTajMedium' },
    bold: { file: 'Tajawal-Bold.ttf', alias: 'MusTajBold' },
    xbold: { file: 'Tajawal-ExtraBold.ttf', alias: 'MusTajXB' },
    black: { file: 'Tajawal-Black.ttf', alias: 'MusTajBlack' },
};

const F = {
    // عربي (سلسلة احتياطية: Tajawal → خطوط نظام عربية → DejaVu)
    ar: { heavy: null, medium: null, regular: null },
    // لاتيني (Tajawal → DejaVu/Liberation)
    latin: { heavy: null, medium: null, regular: null },
    cjk: null,
    cjkReady: false,
};
let _fontReport = { arabic: null, latin: null, cjk: null, source: {} };

// ═══════════════════════════════════════════════════════════════════════════
//  كاشف tofu المحصّن ✨ — الإصلاح الجوهري لمشكلة v26.7
//  المبدأ: حروف مختلفة من نفس اللغة يجب أن تُرسم بأشكال مختلفة.
//  الخط الذي لا يدعم اللغة يرسم كل الحروف مربعات متطابقة → الفرق = صفر.
//  (الكاشف القديم كان يعدّ البكسلات المضيئة — والمربعات بكسلات مضيئة أيضاً!)
// ═══════════════════════════════════════════════════════════════════════════
const AR_PROBE_CHARS = ['ب', 'ت', 'ث', 'س'];   // أشكال مختلفة تماماً
const CJK_PROBE_CHARS = ['晴', '天', '音'];

function _renderGlyphData(ch, family, px = 44) {
    const c = createCanvas(56, 64);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 56, 64);
    ctx.fillStyle = '#000000';
    ctx.font = `${px}px ${family}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 6, 32);
    return ctx.getImageData(0, 0, 56, 64).data;
}

function _countDiffPixels(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) > 12) d++;
    }
    return d;
}

/**
 * هل الخط يرسم هذه اللغة فعلاً (وليس مربعات tofu)؟
 * نرسم حرفين مختلفين على الأقل — إذا تطابقت الرسمتان → مربعات → لا دعم.
 */
function _fontSupportsScript(family, chars) {
    try {
        if (!family) return false;
        const renders = chars.map(ch => _renderGlyphData(ch, family));
        let minDiff = Infinity;
        for (let i = 1; i < renders.length; i++) {
            minDiff = Math.min(minDiff, _countDiffPixels(renders[0], renders[i]));
        }
        return minDiff > 40; // فرق حقيقي بين أشكال الحروف
    } catch (e) {
        return false;
    }
}

function _tryRegister(fontPath, alias) {
    try {
        if (!fsSync.existsSync(fontPath)) return false;
        GlobalFonts.registerFromPath(fontPath, alias);
        return true;
    } catch (e) {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  تسجيل الخطوط واختيار السلاسل — قابل للاستدعاء المتكرر (تعافي ذاتي)
// ═══════════════════════════════════════════════════════════════════════════
function registerAllFonts() {
    // 1) Tajawal المرفق (عربي + لاتيني) — المصدر الأساسي المضمون
    const tajOk = {};
    for (const [slot, cfg] of Object.entries(TAJ_WEIGHTS)) {
        const p = path.join(TAJ_DIR, cfg.file);
        const registered = _tryRegister(p, cfg.alias);
        tajOk[slot] = registered && _fontSupportsScript(cfg.alias, AR_PROBE_CHARS);
    }

    // 2) خطوط النظام الأساسية (لاتيني/سيريلي/يوناني + عربي احتياطي)
    const sysCandidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
        '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
        '/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf',
    ];
    let sysFont = null, sysFontBold = null;
    for (const p of sysCandidates) {
        if (!fsSync.existsSync(p)) continue;
        if (_tryRegister(p, 'CardFont')) {
            sysFont = 'CardFont';
            const boldPath = p.replace(/Regular\./, 'Bold.').replace(/-Regular\./, '-Bold.');
            if (_tryRegister(boldPath, 'CardFontBold')) sysFontBold = 'CardFontBold';
            break;
        }
    }

    // 3) سلسلة العربية: Tajawal → خطوط نظام عربية → DejaVu
    //    (DejaVu Sans يدعم العربية فعلاً — لذلك عملت v26.6 قبل أن تكسرها v26.7 بـ Kalam!)
    let arFallback = null;
    if (!tajOk.black && !tajOk.xbold && !tajOk.regular) {
        const sysFams = (() => {
            try { return GlobalFonts.families.map(f => f.family); } catch (e) { return []; }
        })();
        const arCandidates = sysFams.filter(f =>
            /free\s?serif|free\s?sans|naskh|arab|amiri|kacst|scheherazade/i.test(f));
        for (const fam of arCandidates) {
            if (_fontSupportsScript(fam, AR_PROBE_CHARS)) { arFallback = fam; break; }
        }
        if (!arFallback && sysFont && _fontSupportsScript('CardFont', AR_PROBE_CHARS)) {
            arFallback = 'CardFont'; // DejaVu Sans لديه عربية
        }
    }

    // اختيار الأوزان النهائية للعربية
    F.ar.heavy = tajOk.black ? TAJ_WEIGHTS.black.alias
        : tajOk.xbold ? TAJ_WEIGHTS.xbold.alias
        : tajOk.bold ? TAJ_WEIGHTS.bold.alias
        : arFallback || sysFontBold || sysFont;
    F.ar.medium = tajOk.medium ? TAJ_WEIGHTS.medium.alias
        : tajOk.regular ? TAJ_WEIGHTS.regular.alias
        : arFallback || sysFont;
    F.ar.regular = tajOk.regular ? TAJ_WEIGHTS.regular.alias
        : tajOk.medium ? TAJ_WEIGHTS.medium.alias
        : arFallback || sysFont;

    // اللاتيني: Tajawal (شكل هندسي نظيف مثل GoogleSans في musicard) → DejaVu
    F.latin.heavy = tajOk.xbold ? TAJ_WEIGHTS.xbold.alias
        : tajOk.black ? TAJ_WEIGHTS.black.alias
        : tajOk.bold ? TAJ_WEIGHTS.bold.alias
        : sysFontBold || sysFont;
    F.latin.medium = tajOk.medium ? TAJ_WEIGHTS.medium.alias
        : tajOk.regular ? TAJ_WEIGHTS.regular.alias
        : sysFont;
    F.latin.regular = tajOk.regular ? TAJ_WEIGHTS.regular.alias
        : tajOk.medium ? TAJ_WEIGHTS.medium.alias
        : sysFont;

    // 4) خط صيني/ياباني/كوري — مع الكاشف المحصّن (وليس عدّ البكسلات)
    const cjkDirs = [
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
        '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
        '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf',
        '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf',
        '/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf',
        '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    ];
    F.cjk = null;
    F.cjkReady = false;
    for (const p of cjkDirs) {
        if (!fsSync.existsSync(p)) continue;
        if (_tryRegister(p, 'CardFontCJK') && _fontSupportsScript('CardFontCJK', CJK_PROBE_CHARS)) {
            F.cjk = 'CardFontCJK';
            F.cjkReady = true;
            break;
        }
    }

    _fontReport = {
        theme: DEFAULT_CARD_THEME,
        arabic: F.ar.heavy ? (tajOk.black || tajOk.xbold || tajOk.regular ? 'Tajawal (bundled)' : (F.ar.heavy === 'CardFont' ? 'DejaVu fallback' : `system: ${F.ar.heavy}`)) : 'NONE (tofu risk!)',
        latin: F.latin.heavy ? (tajOk.xbold ? 'Tajawal (bundled)' : F.latin.heavy) : 'NONE',
        cjk: F.cjkReady ? 'CardFontCJK' : 'not available (Latin/Arabic fallback)',
        source: { tajawalBundled: Object.values(tajOk).filter(Boolean).length, arFallback, sysFont, sysFontBold },
    };
    return _fontReport;
}

// التسجيل الأول عند تحميل الموديول
try {
    registerAllFonts();
    _canvasReady = true;
    console.log(`🎨 [MusicCard] defaultTheme=${DEFAULT_CARD_THEME} (per-guild via /lite & /dark) | arabic=${_fontReport.arabic} | latin=${_fontReport.latin} | cjk=${_fontReport.cjk}`);
    if (_fontReport.arabic === 'NONE (tofu risk!)') {
        console.error('⚠️ [MusicCard] لا يوجد خط عربي! تأكد من وجود src/base/fonts/Tajawal-*.ttf');
    }
} catch (err) {
    _canvasError = err;
    console.error('[MusicCard] Canvas init failed:', err.message);
}

// ═══════════════════════════════════════════════════════════════════════════
//  أدوات مساعدة
// ═══════════════════════════════════════════════════════════════════════════

function formatDuration(ms) {
    if (!ms || ms === Infinity || ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
}

const RE_ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const RE_CJK = /[\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\u31F0-\u31FF\uAC00-\uD7AF\uFF66-\uFF9D]/;
const RE_CYR_GRK = /[\u0400-\u04FF\u0370-\u03FF]/;

/** اختيار عائلة الخط حسب لغة النص والوزن المطلوب */
function fontFor(text, slot) {
    const s = String(text || '');
    if (RE_CJK.test(s)) return F.cjk || F.latin[slot] || 'sans-serif';
    if (RE_ARABIC.test(s)) return F.ar[slot] || F.latin[slot] || 'sans-serif';
    if (RE_CYR_GRK.test(s)) return (slot === 'heavy' ? F.latin.heavy : F.latin.regular) || 'sans-serif';
    return F.latin[slot] || 'sans-serif';
}

/** تنقية النص: إزالة emoji ومحارف التحكم وغير المرئي (مع الحفاظ على ♪♫ والتشكيل) */
function canvasSafe(text) {
    return String(text || '')
        .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
        .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        .replace(/[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{2668}\u{266D}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}\u{2900}-\u{297F}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** قص النص بالبكسل مع "..." — أدق من العد بالحروف لكل اللغات */
function fitTextPx(ctx, text, maxWidth) {
    try {
        if (ctx.measureText(text).width <= maxWidth) return text;
        let t = text;
        while (t.length > 1 && ctx.measureText(t + '...').width > maxWidth) {
            t = t.slice(0, -1);
        }
        return t + '...';
    } catch (e) {
        return String(text).substring(0, 40);
    }
}

/**
 * مسار superellipse (منحنى مستمر طبيعي "squircle") — الزوايا الحقيقية الواقعية
 * n=2 دائرة | n>4 منحنى مستمر مثل أيقونات iOS — أجمل وأكثر طبيعية من القوس الدائري
 *
 * ✅ v26.10 إصلاح جذري: زاويتا «أسفل يسار» و«أعلى يسار» كانتا تُرسمان باتجاه
 * معاكس لمسار الرسم، فتُنشئ قطراً وهمياً يقطع صورة الألبوم (الشريط الأسود
 * المائل على يسار الكارت). الآن كل زاوية تُرسم من نقطة وصول المسار إليها
 * بالترتيب: أعلى → يمين أعلى → يمين → يمين أسفل → أسفل → يسار أسفل → يسار → يسار أعلى
 */
function squirclePath(ctx, x, y, w, h, r, n = 4.4, steps = 26) {
    r = Math.min(r, w / 2, h / 2);
    // (u,v) داخل مربع الزاوية [0,r]² — i=0 نقطة بداية القوس، i=steps نقطة نهايته
    const cornerArc = (mapFn) => {
        for (let i = 0; i <= steps; i++) {
            const theta = (Math.PI / 2) * (i / steps);
            const u = r * (1 - Math.pow(Math.sin(theta), 2 / n));
            const v = r * (1 - Math.pow(Math.cos(theta), 2 / n));
            const p = mapFn(u, v);
            ctx.lineTo(p[0], p[1]);
        }
    };
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    cornerArc((u, v) => [x + w - u, y + v]);            // يمين أعلى: (x+w-r,y) → (x+w,y+r)
    ctx.lineTo(x + w, y + h - r);
    cornerArc((u, v) => [x + w - v, y + h - u]);        // يمين أسفل: (x+w,y+h-r) → (x+w-r,y+h)
    ctx.lineTo(x + r, y + h);
    cornerArc((u, v) => [x + u, y + h - v]);            // يسار أسفل: (x+r,y+h) → (x,y+h-r)  ← كان معكوساً!
    ctx.lineTo(x, y + r);
    cornerArc((u, v) => [x + v, y + u]);                // يسار أعلى: (x,y+r) → (x+r,y)      ← كان معكوساً!
    ctx.closePath();
}

/** رسم صورة داخل قصّ superellipse */
function drawRoundedImage(ctx, img, x, y, w, h, r) {
    ctx.save();
    squirclePath(ctx, x, y, w, h, r);
    ctx.clip();
    // cover-fit: تغطية كاملة دون تشويه النسبة
    const scale = Math.max(w / img.width, h / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
    ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
//  ✅ هيكل Ease الأصلي — SVG منقول حرفياً من musicard/Structure/Theme/BaseStructure.ts
//  (التدرج paint0_linear_61_14 + أيقونة السماعة + الأشرطة pill بنفس الإحداثيات)
// ═══════════════════════════════════════════════════════════════════════════
const EASE_SPEAKER_PATH = 'M932.142 244.874C931.695 242.268 928.761 241.203 926.747 242.652L922.395 245.787C922.099 245.999 921.746 246.113 921.385 246.113L917.25 246.113C915.857 246.113 914.522 246.674 913.538 247.674C912.553 248.675 912 250.031 912 251.445V258.555C912 259.97 912.553 261.326 913.538 262.326C914.522 263.326 915.857 263.888 917.25 263.888H921.385C921.747 263.888 922.101 264.002 922.396 264.215L926.747 267.347C928.759 268.798 931.695 267.733 932.142 265.125C932.705 261.837 932.999 258.452 932.999 255C932.999 251.548 932.705 248.166 932.142 244.874ZM946.645 247.714C946.593 247.25 946.364 246.825 946.006 246.531C945.648 246.237 945.191 246.098 944.733 246.145C944.275 246.191 943.853 246.419 943.56 246.778C943.266 247.138 943.123 247.6 943.163 248.066C943.613 252.678 943.613 257.323 943.163 261.935C943.137 262.168 943.157 262.405 943.221 262.631C943.286 262.857 943.395 263.068 943.54 263.251C943.686 263.434 943.866 263.586 944.07 263.698C944.274 263.81 944.498 263.879 944.728 263.903C944.959 263.926 945.192 263.903 945.413 263.834C945.635 263.765 945.841 263.652 946.019 263.502C946.197 263.351 946.345 263.166 946.452 262.958C946.559 262.749 946.625 262.521 946.645 262.286C947.118 257.441 947.118 252.56 946.645 247.714ZM939.776 249.522C939.761 249.287 939.7 249.057 939.596 248.846C939.493 248.635 939.349 248.447 939.173 248.293C938.997 248.139 938.793 248.022 938.572 247.949C938.351 247.876 938.118 247.848 937.887 247.867C937.655 247.887 937.43 247.953 937.224 248.061C937.018 248.17 936.835 248.319 936.686 248.5C936.538 248.681 936.426 248.891 936.358 249.116C936.289 249.342 936.266 249.579 936.289 249.813C936.569 253.266 936.569 256.735 936.289 260.187C936.259 260.653 936.41 261.111 936.71 261.465C937.009 261.818 937.434 262.037 937.891 262.076C938.349 262.114 938.803 261.968 939.156 261.669C939.508 261.37 939.731 260.943 939.776 260.479C940.072 256.833 940.072 253.168 939.776 249.522Z';

function buildEaseStructureSVG(progressPct, volumePct, theme) {
    const clampedProgress = Math.min(Math.max(Number.isFinite(progressPct) ? progressPct : 0, 0), 100);
    const clampedVolume = Math.min(Math.max(Number.isFinite(volumePct) ? volumePct : 0, 0), 100);
    const progressWidth = (clampedProgress / 100) * BAR_W;
    const volumeWidth = (clampedVolume / 100) * VOLBAR_W;
    const fg = theme.fg, bg = theme.bg;
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="eg" x1="0" y1="174" x2="${W}" y2="174" gradientUnits="userSpaceOnUse">
<stop stop-color="${bg}" stop-opacity="0"/>
<stop stop-color="${bg}" offset="0.5" stop-opacity="0.78"/>
<stop stop-color="${bg}" offset="1"/>
</linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#eg)"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="${EASE_SPEAKER_PATH}" fill="${fg}"/>
<rect x="${BAR_X}" y="${BAR_Y}" width="${BAR_W}" height="${BAR_H}" rx="${BAR_RX}" fill="${fg}" fill-opacity="0.14"/>
<rect x="${BAR_X}" y="${BAR_Y}" width="${progressWidth.toFixed(2)}" height="${BAR_H}" rx="${BAR_RX}" fill="${fg}"/>
<rect x="${VOLBAR_X}" y="${VOLBAR_Y}" width="${VOLBAR_W}" height="${VOLBAR_H}" rx="${BAR_RX}" fill="${fg}" fill-opacity="0.14"/>
<rect x="${VOLBAR_X}" y="${VOLBAR_Y}" width="${volumeWidth.toFixed(2)}" height="${VOLBAR_H}" rx="${BAR_RX}" fill="${fg}"/>
</svg>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  كاش الصور LRU — تحميل thumbnail عبر axios بمهلة (يمنع rate-limit img.youtube.com)
// ═══════════════════════════════════════════════════════════════════════════
async function loadCachedImage(url) {
    const now = Date.now();
    const hit = imageCache.get(url);
    if (hit && (now - hit.at) < IMAGE_CACHE_TTL) {
        hit.at = now;
        return hit.image;
    }
    const resp = await axios.get(url, {
        timeout: 6000,
        responseType: 'arraybuffer',
        maxContentLength: 12 * 1024 * 1024,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept': 'image/*,*/*;q=0.8',
        },
    });
    const img = await loadImage(Buffer.from(resp.data));
    imageCache.set(url, { image: img, at: now });
    if (imageCache.size > IMAGE_CACHE_MAX) {
        let oldestKey = null, oldestAt = Infinity;
        for (const [k, v] of imageCache.entries()) {
            if (v.at < oldestAt) { oldestAt = v.at; oldestKey = k; }
        }
        if (oldestKey) imageCache.delete(oldestKey);
    }
    return img;
}

/** التعافي الذاتي — إعادة تسجيل الخطوط ومسح الكاش بعد فشلين متتاليين */
function healCanvas() {
    const now = Date.now();
    if (now - _lastFontRefresh < FONT_REFRESH_COOLDOWN) return;
    _lastFontRefresh = now;
    try {
        imageCache.clear();
        registerAllFonts();
        _consecutiveFailures = 0;
        console.log('🛠️ [MusicCard] Self-heal: fonts re-registered, image cache cleared');
    } catch (e) {
        console.error('[MusicCard] Self-heal failed:', e.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ✅ v26.10: قصّ أشرطة letterbox السوداء من صورة الألبوم
//  مصادر مثل hqdefault (4:3) تضع شريطين سوداء أعلى/أسفل الغلاف، فكانا
//  يظهران كأعمدة سوداء داخل مربع الألبوم 292×292. الكاشف متحفظ جداً:
//  الصف يجب أن يكون أسود شبه كامل (lum ≤ 10) ومتصلاً من الحافة، وبحد أقصى
//  18% من الارتفاع لكل جانب — حتى لا يقص أغلفة داكنة حقيقية.
// ═══════════════════════════════════════════════════════════════════════════
function _trimLetterbox(img) {
    try {
        const W0 = img.width, H0 = img.height;
        if (!W0 || !H0 || H0 < 24) return img;

        // عيّن مصغّراً للفحص السريع (64px ارتفاعاً) — تكفي لكشف الأشرطة
        const probeH = 64;
        const probeW = Math.max(8, Math.round(W0 * (probeH / H0)));
        const c = createCanvas(probeW, probeH);
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0, probeW, probeH);
        const data = cx.getImageData(0, 0, probeW, probeH).data;

        const rowIsBlack = (py) => {
            let dark = 0;
            for (let px2 = 0; px2 < probeW; px2++) {
                const i = (py * probeW + px2) * 4;
                if (data[i] <= 10 && data[i + 1] <= 10 && data[i + 2] <= 10) dark++;
            }
            return dark / probeW >= 0.995;
        };

        const maxBars = Math.floor(probeH * 0.18);
        let top = 0;
        while (top < maxBars && rowIsBlack(top)) top++;
        let bottom = 0;
        while (bottom < maxBars && rowIsBlack(probeH - 1 - bottom)) bottom++;

        // لا قصّ إلا إذا كان هناك شريط فعلي ملموس (> 4% لكل جانب)
        if (top <= Math.floor(probeH * 0.04) && bottom <= Math.floor(probeH * 0.04)) return img;
        if (top + bottom >= probeH - 8) return img; // الحماية: الصورة كلها سوداء؟

        const y0 = Math.round(top * (H0 / probeH));
        const y1 = Math.round(bottom * (H0 / probeH));
        const out = createCanvas(W0, H0 - y0 - y1);
        out.getContext('2d').drawImage(img, 0, y0, W0, H0 - y0 - y1, 0, 0, W0, H0 - y0 - y1);
        return out;
    } catch (e) {
        return img; // أي فشل → الصورة الأصلية كما هي
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  generateMusicCard — بطاقة musicard Ease (1415×348)
//  كل قسم في try/catch مستقل — فشل قسم لا يُسقط البطاقة
// ═══════════════════════════════════════════════════════════════════════════
async function generateMusicCard(track, player, position = 0, options = {}) {
    if (!_canvasReady) {
        try { registerAllFonts(); _canvasReady = true; } catch (e) { return null; }
    }
    if (!track) return null;

    try {
        // ✅ v26.10: ثيم لكل سيرفر — /lite أو /dark أو الافتراضي من البيئة
        const themeName = resolveTheme(options.guildId || player?.guild?.id);
        const T = THEMES[themeName] || THEMES.ease;

        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        // قصّ البطاقة superellipse — خارجها شفاف (يلائم أي ثيم ديسكورد)
        ctx.save();
        squirclePath(ctx, 0, 0, W, H, CARD_RADIUS);
        ctx.clip();

        // ---- 1) الأساس بلون الخلفية ----
        ctx.fillStyle = T.bg;
        ctx.fillRect(0, 0, W, H);

        // ---- 2) خلفية ضبابية من صورة الألبوم (blur 60px + opacity 0.6 مثل musicard) ----
        const artworkUrl = track.thumbnail ||
            (track.id ? `https://img.youtube.com/vi/${track.id}/maxresdefault.jpg` : null);
        let artImage = null;
        if (artworkUrl) {
            try {
                artImage = await loadCachedImage(artworkUrl);
            } catch (e) {
                try {
                    if (track.id && artworkUrl.includes('maxresdefault')) {
                        // ✅ v26.10: mqdefault بدل hqdefault — mq بلا أشرطة سوداء (16:9 حقيقي)
                        artImage = await loadCachedImage(`https://img.youtube.com/vi/${track.id}/mqdefault.jpg`);
                    }
                } catch (e2) { artImage = null; }
            }
        }

        if (artImage) {
            try {
                ctx.save();
                ctx.filter = 'blur(60px) opacity(0.6)';
                // رسم مغطٍّ متجاوز الحواف (مثل drawImage(-100,-100,1615,677) في musicard)
                const scale = Math.max((W + 260) / artImage.width, (H + 260) / artImage.height);
                const sw = artImage.width * scale, sh = artImage.height * scale;
                ctx.drawImage(artImage, (W - sw) / 2, (H - sh) / 2, sw, sh);
                ctx.restore();
                ctx.filter = 'none';
            } catch (e) {
                console.error('[MusicCard] Background blur error:', e.message);
            }
        }

        // ---- 3) هيكل Ease الأصلي (SVG): التدرج + السماعة + الأشرطة ----
        let totalMs = (track.duration || 0) * 1000;
        const isStream = !totalMs || totalMs <= 0;
        let progressPct = 0;
        if (!isStream) progressPct = Math.min(((position || 0) / totalMs) * 100, 100);
        const volumePct = Math.min(Math.max(player?.volume ?? 100, 0), 100);

        try {
            const svg = buildEaseStructureSVG(progressPct, volumePct, T);
            const structureImg = await loadImage(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
            ctx.drawImage(structureImg, 0, 0);
        } catch (e) {
            console.error('[MusicCard] Structure SVG error:', e.message);
        }

        // ---- 4) صورة الألبوم (292×292 superellipse r110) ----
        if (artImage) {
            try {
                // ✅ v26.10: قصّ الأشرطة السوداء (letterbox) قبل الرسم — كانت تظهر
                // كأعمدة سوداء أعلى/أسفل صورة الألبوم مع صور hqdefault وغيرها
                const artImageTrimmed = _trimLetterbox(artImage);
                await drawRoundedImage(ctx, artImageTrimmed, ART_X, ART_Y, ART_SIZE, ART_SIZE, ART_RADIUS);
                ctx.save();
                squirclePath(ctx, ART_X, ART_Y, ART_SIZE, ART_SIZE, ART_RADIUS);
                ctx.strokeStyle = T.artBorder;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            } catch (e) {
                console.error('[MusicCard] Album art draw error:', e.message);
            }
        } else {
            try {
                ctx.save();
                squirclePath(ctx, ART_X, ART_Y, ART_SIZE, ART_SIZE, ART_RADIUS);
                const grad = ctx.createLinearGradient(ART_X, ART_Y, ART_X + ART_SIZE, ART_Y + ART_SIZE);
                grad.addColorStop(0, T.artPlaceholder[0]);
                grad.addColorStop(1, T.artPlaceholder[1]);
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.clip();
                ctx.font = `120px ${F.latin.heavy || 'sans-serif'}`;
                ctx.fillStyle = T.artPlaceholderIcon;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('♫', ART_X + ART_SIZE / 2, ART_Y + ART_SIZE / 2);
                ctx.restore();
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
            } catch (e) { /* placeholder غير حرج */ }
        }

        // ---- 5) النصوص (نفس مواضع musicard بالبكسل) ----
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = T.fg;

        // العنوان — 45px ثقيل عند (377, 130)
        try {
            const rawTitle = track.title || 'Unknown Track';
            let trackName = canvasSafe(rawTitle) || 'Unknown Track';
            const titleFont = fontFor(trackName, 'heavy');
            ctx.font = `45px ${titleFont}`;
            trackName = fitTextPx(ctx, trackName, 980);
            ctx.fillText(trackName, TEXT_X, TITLE_Y);
        } catch (e) {
            try {
                ctx.font = `45px ${F.latin.heavy || 'sans-serif'}`;
                ctx.fillText('Unknown Track', TEXT_X, TITLE_Y);
            } catch (e2) { /* لا شيء أكثر */ }
            console.error('[MusicCard] Title draw error:', e.message);
        }

        // الفنان — 30px متوسط عند (377, 187)
        try {
            const rawArtist = track.artist || track.uploader || 'Unknown Artist';
            let artistName = canvasSafe(rawArtist) || 'Unknown Artist';
            const artistFont = fontFor(artistName, 'medium');
            ctx.font = `30px ${artistFont}`;
            artistName = fitTextPx(ctx, artistName, 860);
            ctx.fillText(artistName, TEXT_X, ARTIST_Y);
        } catch (e) {
            console.error('[MusicCard] Artist draw error:', e.message);
        }

        // الوقت — 25px عند (710, 255) بصيغة cur/total مثل musicard
        try {
            const currentTimeStr = formatDuration(position || 0);
            const totalTimeStr = isStream ? 'LIVE' : formatDuration(totalMs);
            ctx.font = `25px ${F.latin.medium || F.latin.regular || 'sans-serif'}`;
            ctx.textBaseline = 'middle';
            ctx.fillText(`${currentTimeStr}/${totalTimeStr}`, TIME_X, TIME_Y);
            ctx.textBaseline = 'alphabetic';
        } catch (e) { /* الوقت غير حرج */ }

        // نسبة الصوت — 25px عند (1140, 255) بجوار الشريط
        try {
            const volPercent = Math.round(player?.volume ?? 100);
            ctx.font = `25px ${F.latin.medium || F.latin.regular || 'sans-serif'}`;
            ctx.textBaseline = 'middle';
            ctx.fillText(`${volPercent}%`, VOLTEXT_X, VOLTEXT_Y);
            ctx.textBaseline = 'alphabetic';
        } catch (e) { /* غير حرج */ }

        // ---- 6) Requested by — أعلى اليمين (خفيف وأنيق) ----
        if (options.requesterName) {
            try {
                const reqName = canvasSafe(options.requesterName) || 'Unknown';
                const reqFont = fontFor(reqName, 'regular');
                ctx.font = `17px ${reqFont}`;
                ctx.fillStyle = T.fgSoft;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                const full = `Requested by ${reqName}`;
                const fitted = fitTextPx(ctx, full, 430);
                ctx.fillText(fitted, W - 32, 22);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
            } catch (e) { /* غير حرج */ }
        }

        // ---- 7) بصمة المطور — أسفل اليمين (✅ v26.10: كبيرة وواضحة تماماً) ----
        try {
            const developerName = canvasSafe(options.developer) || 'ELMINYAWE';
            const devText = `Dev: ${developerName}`;
            const devFont = fontFor(devText, 'heavy');
            ctx.font = `30px ${devFont}`;
            ctx.fillStyle = T.fgDev;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(fitTextPx(ctx, devText, 560), W - 32, H - 12);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        } catch (e) { /* غير حرج */ }

        // إنهاء القصّ
        ctx.restore();

        // حدّ رفيع حول البطاقة (بلون الثيم المُحلَّل لكل سيرفر)
        try {
            ctx.save();
            squirclePath(ctx, 0, 0, W, H, CARD_RADIUS);
            ctx.strokeStyle = T.cardBorder || (themeName === 'ease' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.10)');
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        } catch (e) { /* غير حرج */ }

        const buffer = canvas.toBuffer('image/png');
        _consecutiveFailures = 0;
        return buffer;
    } catch (fatalErr) {
        _consecutiveFailures++;
        console.error(`[MusicCard] Generation failed (${_consecutiveFailures}):`, fatalErr.message);
        if (_consecutiveFailures >= HEAL_AFTER_FAILURES) {
            healCanvas();
        }
        return null;
    }
}

module.exports = {
    generateMusicCard,
    isReady: () => _canvasReady,
    // ✅ v26.10: إدارة الثيم لكل سيرفر (أوامر /lite و /dark)
    setGuildTheme,
    getGuildTheme,
    clearGuildTheme,
    resolveTheme,
    getDefaultTheme: () => DEFAULT_CARD_THEME,
    getTheme: (guildId) => resolveTheme(guildId),
    purgeCaches: () => {
        imageCache.clear();
        return { imagesPurged: true };
    },
    getStats: () => ({
        ready: _canvasReady,
        theme: DEFAULT_CARD_THEME,
        guildThemeOverrides: guildThemeOverrides.size,
        cachedImages: imageCache.size,
        consecutiveFailures: _consecutiveFailures,
        fonts: _fontReport,
    }),
    // للاختبارات
    __testHooks: {
        fontFor, canvasSafe, fitTextPx, squirclePath, buildEaseStructureSVG,
        fontState: F, fontReport: () => _fontReport,
        _fontSupportsScript, registerAllFonts, _trimLetterbox,
        themeState: () => ({ default: DEFAULT_CARD_THEME, overrides: new Map(guildThemeOverrides) }),
        THEMES,
    },
};
