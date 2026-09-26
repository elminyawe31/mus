// ═══════════════════════════════════════════════════════════════════════════
//  probe-canvas-v26.8.js — فحص قدرات @napi-rs/canvas قبل بناء الكارت الجديدة
//  يجيب عن: SVG loading؟ auto-fallback؟ Kalam tofu؟ Tajawal عربية سليمة؟ bidi؟
// ═══════════════════════════════════════════════════════════════════════════
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'probe-out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const FONTS_DIR = path.join(__dirname, '..', 'src', 'base', 'fonts');
const KALAM = path.join(__dirname, '..', 'src', 'base', 'Kalam-Regular.ttf');
const DEJAVU = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

// ── helpers ─────────────────────────────────────────────────────────────────
function register(p, alias) {
    try { GlobalFonts.registerFromPath(p, alias); return true; } catch (e) { console.log(`  register(${alias}) FAILED: ${e.message}`); return false; }
}

/** عدّ البكسلات المضيئة لنص مرسوم — يرجع {count, sum} */
function renderStats(family, text, px = 40) {
    const c = createCanvas(340, 70);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 340, 70);
    ctx.fillStyle = '#000000';
    ctx.font = `${px}px ${family}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 8, 35);
    const d = ctx.getImageData(0, 0, 340, 70).data;
    let dark = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
        // على خلفية بيضاء: النص أسود — نعد البكسلات الداكنة
        const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (lum < 128) { dark++; sum += (255 - lum); }
    }
    return { dark, sum };
}

function measure(family, text, px = 40) {
    const c = createCanvas(10, 10);
    const ctx = c.getContext('2d');
    ctx.font = `${px}px ${family}`;
    return ctx.measureText(text).width;
}

// ── 1) تسجيل الخطوط ────────────────────────────────────────────────────────
console.log('═══ 1) FONT REGISTRATION ═══');
register(DEJAVU, 'DejaVu');
register(KALAM, 'Kalam');
const tajawal = {};
for (const w of ['Regular', 'Medium', 'Bold', 'ExtraBold', 'Black']) {
    const p = path.join(FONTS_DIR, `Tajawal-${w}.ttf`);
    if (fs.existsSync(p)) register(p, `Tajawal${w}`);
    else console.log(`  MISSING: ${p}`);
}

// ── 2) Arabic rendering comparison ──────────────────────────────────────────
console.log('\n═══ 2) ARABIC RENDER: DejaVu vs Kalam vs Tajawal ═══');
const AR_SAMPLE = 'السلام عليكم أغنية عربية';
const statsDeja = renderStats('DejaVu', AR_SAMPLE);
const statsKalam = renderStats('Kalam', AR_SAMPLE);
const statsTaj = renderStats('TajawalRegular', AR_SAMPLE);
console.log(`  DejaVu  (لا عربية): dark=${statsDeja.dark} sum=${statsDeja.sum}`);
console.log(`  Kalam   (هندي):     dark=${statsKalam.dark} sum=${statsKalam.sum}`);
console.log(`  Tajawal (عربي):     dark=${statsTaj.dark} sum=${statsTaj.sum}`);

// نسبة الاختلاف Tajawal مقابل DejaVu (tofu reference)
const diffPct = Math.abs(statsTaj.dark - statsDeja.dark) / Math.max(statsTaj.dark, statsDeja.dark, 1) * 100;
console.log(`  → Tajawal vs DejaVu(tofu-ref) pixel diff: ${diffPct.toFixed(1)}% ${diffPct > 15 ? '✅ REAL ARABIC GLYPHS' : '❌ TOFU (same as reference)'}`);
const diffKalam = Math.abs(statsKalam.dark - statsDeja.dark) / Math.max(statsKalam.dark, statsDeja.dark, 1) * 100;
console.log(`  → Kalam vs DejaVu(tofu-ref) pixel diff: ${diffKalam.toFixed(1)}% ${diffKalam > 15 ? '✅ real glyphs' : '❌ TOFU (reproduces the Railway bug!)'}`);

// ── 3) لام-ألف: هل تتصل كحرف واحد؟ ─────────────────────────────────────────
console.log('\n═══ 3) LAM-ALEF LIGATURE TEST ═══');
const wLA = measure('TajawalRegular', 'لا');
const wL = measure('TajawalRegular', 'ل');
const wA = measure('TajawalRegular', 'ا');
console.log(`  width(لا)=${wLA.toFixed(1)}  width(ل)=${wL.toFixed(1)}  width(ا)=${wA.toFixed(1)}  sum=${(wL + wA).toFixed(1)}`);
console.log(`  → ligature ratio: ${(wLA / (wL + wA) * 100).toFixed(0)}% ${wLA < (wL + wA) * 0.85 ? '✅ connected shaping works' : '❌ no ligature (broken shaping)'}`);

// ── 4) bidi: نص مختلط ───────────────────────────────────────────────────────
console.log('\n═══ 4) BIDI MIXED TEXT ═══');
const c4 = createCanvas(700, 80);
const x4 = c4.getContext('2d');
x4.fillStyle = '#FFFFFF'; x4.fillRect(0, 0, 700, 80);
x4.fillStyle = '#000000';
x4.font = '34px TajawalRegular';
x4.textBaseline = 'middle';
x4.fillText('Ahmed Kamel - أقول كلام', 10, 40);
fs.writeFileSync(path.join(OUT, 'bidi-mixed.png'), c4.toBuffer('image/png'));
console.log(`  saved bidi-mixed.png (width=${measure('TajawalRegular', 'Ahmed Kamel - أقول كلام', 34).toFixed(0)}px)`);

// ── 5) عينات بصرية للتحقق اليدوي/VLM ───────────────────────────────────────
console.log('\n═══ 5) VISUAL SAMPLES ═══');
const samples = [
    ['ar-title', 'أحمد كامل - قولي', 'TajawalBlack', 45],
    ['ar-artist', 'أحمد كامل', 'TajawalMedium', 30],
    ['en-title', 'Blinding Lights', 'TajawalBlack', 45],
    ['kalam-arabic', 'أحمد كامل - قولي', 'Kalam', 45],
    ['dejavu-arabic', 'أحمد كامل - قولي', 'DejaVu', 45],
];
for (const [name, text, family, px] of samples) {
    const c = createCanvas(900, 90);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 900, 90);
    ctx.fillStyle = '#000000';
    ctx.font = `${px}px ${family}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 15, 45);
    fs.writeFileSync(path.join(OUT, `sample-${name}.png`), c.toBuffer('image/png'));
    console.log(`  saved sample-${name}.png [${family} ${px}px]`);
}

// ── 6) SVG data URL loading (بنية musicard) ────────────────────────────────
console.log('\n═══ 6) SVG DATA URL LOADING ═══');
(async () => {
try {
    const svg = `<svg width="200" height="60" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="180" height="20" rx="10" fill="#000" fill-opacity="0.14"/><rect x="10" y="20" width="90" height="20" rx="10" fill="#000"/></svg>`;
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const img = await loadImage(dataUrl);
    const c = createCanvas(200, 60);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    fs.writeFileSync(path.join(OUT, 'svg-test.png'), c.toBuffer('image/png'));
    console.log(`  ✅ SVG loads: ${img.width}x${img.height}`);
} catch (e) {
    console.log(`  ❌ SVG FAILED: ${e.message}`);
}
mainDone();
})();

function mainDone() {

// ── 7) blur filter ──────────────────────────────────────────────────────────
console.log('\n═══ 7) BLUR FILTER ═══');
try {
    const c = createCanvas(200, 100);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FF0000'; ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = '#0000FF'; ctx.fillRect(100, 0, 100, 100);
    ctx.filter = 'blur(20px) opacity(0.6)';
    ctx.drawImage(c, (-20), (-20), 240, 140); // self-draw blurred
    ctx.filter = 'none';
    fs.writeFileSync(path.join(OUT, 'blur-test.png'), c.toBuffer('image/png'));
    console.log('  ✅ blur(20px) opacity(0.6) accepted');
} catch (e) {
    console.log(`  ❌ blur FAILED: ${e.message}`);
}

// ── 8) superellipse path (squircle) ─────────────────────────────────────────
console.log('\n═══ 8) GLOBAL FONTS LIST (عينات عربية متاحة في النظام) ═══');
try {
    const fams = GlobalFonts.families.map(f => f.family);
    console.log(`  total families: ${fams.length}`);
    const arabicCandidates = fams.filter(f => /free|arab|naskh|kufi|amiri|cairo|tajawal|noto.*sans\b/i.test(f));
    console.log('  possible Arabic-capable system fonts:', arabicCandidates.slice(0, 10).join(', ') || '(none)');
} catch (e) {
    console.log('  families listing failed:', e.message);
}

} // end mainDone

console.log('\n✅ PROBE DONE — check probe-out/ PNGs');
