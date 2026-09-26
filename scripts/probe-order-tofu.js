// فحص حاسم: هل العربية النقية تُرسم بنفس الترتيب الصحيح كما في السياق المختلط؟
// + كاشف tofu المحصّن: حروف مختلفة يجب أن تنتج أشكالاً مختلفة
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

const FONTS_DIR = path.join(__dirname, '..', 'src', 'base', 'fonts');
for (const w of ['Regular', 'Medium', 'Black']) {
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, `Tajawal-${w}.ttf`), `Tajawal${w}`);
}
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'DejaVu');
GlobalFonts.registerFromPath(path.join(__dirname, '..', 'src', 'base', 'Kalam-Regular.ttf'), 'Kalam');

const OUT = path.join(__dirname, 'probe-out');

function renderText(text, family, px = 34, W = 500, H = 80) {
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000000';
    ctx.font = `${px}px ${family}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 10, H / 2);
    return ctx.getImageData(0, 0, W, H).data;
}

function cropsEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - b[i]) > 12) diff++;
    }
    return diff;
}

// ═══ A) ترتيب العربية النقية ═══
console.log('═══ A) PURE ARABIC ORDER TEST ═══');
const px = 34;
const c1 = createCanvas(500, 80); const x1 = c1.getContext('2d');
x1.fillStyle = '#FFF'; x1.fillRect(0, 0, 500, 80);
x1.fillStyle = '#000'; x1.font = `${px}px TajawalRegular`; x1.textBaseline = 'middle';
x1.fillText('أقول كلام', 10, 40);

const c2 = createCanvas(500, 80); const x2 = c2.getContext('2d');
x2.fillStyle = '#FFF'; x2.fillRect(0, 0, 500, 80);
x2.fillStyle = '#000'; x2.font = `${px}px TajawalRegular`; x2.textBaseline = 'middle';
x2.fillText('A - أقول كلام', 10, 40);

// عرض "A - " في نفس الخط:
const m = x2.measureText('A - ').width;
console.log(`  width("A - ") = ${m.toFixed(1)}px`);

// قص منطقة العربية من c2 (تبدأ بعد A - ) وقارن مع c1 من x=10
const d1 = x1.getImageData(10, 0, 380, 80).data;
const d2 = x2.getImageData(Math.round(10 + m), 0, 380, 80).data;
const diffPixels = cropsEqual(d1, d2);
console.log(`  differing pixels: ${diffPixels} ${diffPixels < 60 ? '✅ IDENTICAL — pure Arabic order = correct in-context order' : '❌ DIFFERENT — order might be wrong, needs RLM'}`);

// اختبار إضافي: نفس النص مع RLM prefix
const c3 = createCanvas(500, 80); const x3 = c3.getContext('2d');
x3.fillStyle = '#FFF'; x3.fillRect(0, 0, 500, 80);
x3.fillStyle = '#000'; x3.font = `${px}px TajawalRegular`; x3.textBaseline = 'middle';
x3.fillText('\u200Fأقول كلام', 10, 40);
const d3 = x3.getImageData(10, 0, 380, 80).data;
const diff13 = cropsEqual(d1, d3);
console.log(`  pure vs RLM-prefixed: ${diff13} differing pixels ${diff13 < 60 ? '(same → no marker needed)' : '(different → RLM changes rendering!)'}`);

fs.writeFileSync(path.join(OUT, 'order-pure.png'), c1.toBuffer('image/png'));
fs.writeFileSync(path.join(OUT, 'order-mixed.png'), c2.toBuffer('image/png'));

// ═══ B) كاشف tofu المحصّن ═══
console.log('\n═══ B) BULLETPROOF TOFU DETECTOR ═══');
function renderCharData(ch, family, px = 40) {
    const c = createCanvas(60, 70);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFF'; ctx.fillRect(0, 0, 60, 70);
    ctx.fillStyle = '#000';
    ctx.font = `${px}px ${family}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 8, 35);
    return ctx.getImageData(0, 0, 60, 70).data;
}
function countDiffPixels(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 12) d++;
    return d;
}
function hasScript(family, chars) {
    // حروف مختلفة من نفس اللغة يجب أن تنتج رسومات مختلفة
    // tofu = كل الحروف مربعات متطابقة
    const renders = chars.map(ch => renderCharData(ch, family));
    const diffs = [];
    for (let i = 1; i < renders.length; i++) diffs.push(countDiffPixels(renders[0], renders[i]));
    const minDiff = Math.min(...diffs);
    return { ok: minDiff > 40, minDiff, diffs }; // >40 بكسل فرق = أشكال مختلفة = حقيقية
}

const arTest = hasScript('Kalam', ['ب', 'ت', 'ث', 'س']);
console.log(`  Kalam  Arabic: minDiff=${arTest.minDiff} ${arTest.ok ? '✅ real' : '❌ TOFU (boxes identical)'}`);
const arTaj = hasScript('TajawalRegular', ['ب', 'ت', 'ث', 'س']);
console.log(`  Tajawal Arabic: minDiff=${arTaj.minDiff} ${arTaj.ok ? '✅ real' : '❌ TOFU'}`);
const arDeja = hasScript('DejaVu', ['ب', 'ت', 'ث', 'س']);
console.log(`  DejaVu  Arabic: minDiff=${arDeja.minDiff} ${arDeja.ok ? '✅ real' : '❌ TOFU'}`);

const cjkTest = hasScript('DejaVu', ['晴', '天', '音']);
console.log(`  DejaVu  CJK: minDiff=${cjkTest.minDiff} ${cjkTest.ok ? '✅ real' : '❌ TOFU (expected — DejaVu has no CJK)'}`);

// ═══ C) DejaVu Arabic joining ( هل الحروف تتصل؟ ) ═══
console.log('\n═══ C) DEJAVU JOINING CHECK (visual) ═══');
const c4 = createCanvas(400, 80); const x4 = c4.getContext('2d');
x4.fillStyle = '#FFF'; x4.fillRect(0, 0, 400, 80);
x4.fillStyle = '#000'; x4.font = '34px DejaVu'; x4.textBaseline = 'middle';
x4.fillText('أقول كلام', 10, 40);
fs.writeFileSync(path.join(OUT, 'dejavu-joining.png'), c4.toBuffer('image/png'));
console.log('  saved dejavu-joining.png for visual check');
