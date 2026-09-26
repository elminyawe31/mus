// ═══════════════════════════════════════════════════════════════════════════
//  test-v26.10-card.js — اختبار بطاقة v26.10
//  1. الشريط المائل على يسار الألبوم (السبب الجذري: زوايا squircle معكوسة)
//  2. بصمة المطور ELMINYAWE واضحة في الثيمين
//  3. ثيم لكل سيرفر (setGuildTheme) — فاتح/داكن
//  4. قصّ أشرطة letterbox السوداء من الغلاف
//  5. انحدار سيناريوهات v26.8 (عربي/إنجليزي/CJK/بلا غلاف/LIVE)
//  استخدم: node scripts/test-v26.10-card.js
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const http = require('http');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const MusicCard = require('../src/MusicCard');
const OUT = path.join(__dirname, 'card-out-v2610');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
function ok(cond, label, extra = '') {
    if (cond) { pass++; console.log(`  ✅ ${label}${extra ? ' — ' + extra : ''}`); }
    else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
}

async function analyzeBuffer(buf) {
    const img = await loadImage(buf);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return {
        w: img.width, h: img.height,
        data: ctx.getImageData(0, 0, img.width, img.height).data,
        at(x, y) {
            const i = (y * img.width + x) * 4;
            return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
        },
    };
}

// ── خادم صور محلي: غلاف أحمر صافٍ + غلاف بأشرطة سوداء ───────────────────────
function startImageServer() {
    return new Promise((resolve) => {
        const srv = http.createServer((req, res) => {
            const send = (buf) => { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(buf); };
            if (req.url.startsWith('/red')) {
                // أحمر نقي 1600x1600 — أي بكسل أسود/داكن داخل الألبوم = خلل رسم
                const c = createCanvas(1600, 1600);
                const x = c.getContext('2d');
                x.fillStyle = '#E02020'; x.fillRect(0, 0, 1600, 1600);
                // علامة: مربع أبيض في المركز (للتحقق من وسط الغلاف)
                x.fillStyle = '#FFFFFF'; x.fillRect(700, 700, 200, 200);
                send(c.toBuffer('image/png'));
            } else if (req.url.startsWith('/letterbox')) {
                // صورة زرقاء 480x360 بأشرطة سوداء أعلى/أسفل (نمط hqdefault)
                const c = createCanvas(480, 360);
                const x = c.getContext('2d');
                x.fillStyle = '#000000'; x.fillRect(0, 0, 480, 360);
                x.fillStyle = '#2060E0'; x.fillRect(0, 45, 480, 270);
                send(c.toBuffer('image/png'));
            } else {
                res.writeHead(404); res.end();
            }
        });
        srv.listen(0, '127.0.0.1', () => resolve(srv));
    });
}

(async () => {
    const srv = await startImageServer();
    const port = srv.address().port;
    const redUrl = `http://127.0.0.1:${port}/red.png`;
    const lbUrl = `http://127.0.0.1:${port}/letterbox.png`;

    console.log('════════ 1) الشريط المائل يسار الألبوم — السبب الجذري ════════');
    // غلاف أحمر صافٍ: كل بكسل داخل قصّ الألبوم يجب أن يكون أحمر/أبيض
    const GID = '999000111';
    MusicCard.setGuildTheme(GID, 'ease'); // ثيم فاتح صريح
    const bufRed = await MusicCard.generateMusicCard(
        { title: 'Test Song', artist: 'Test Artist', thumbnail: redUrl, duration: 200 },
        { volume: 80, guild: { id: GID } }, 50 * 1000,
        { requesterName: 'Tester', developer: 'ELMINYAWE', guildId: GID }
    );
    ok(!!bufRed, 'توليد بطاقة بغلاف أحمر محلي');
    fs.writeFileSync(path.join(OUT, 'diagonal-check.png'), bufRed);
    const aRed = await analyzeBuffer(bufRed);

    // منطقة الألبوم: ART_X=28, ART_Y=28, 292×292, r=110 (superellipse n=4.4)
    // فحص كل بكسل داخل مربع الألبوم: إن كان داخل قصّ السوبرإليبس فيجب أن يكون أحمر/أبيض.
    // إن كان أسود (لون الخلفية/الشريط) داخل القصّ → الشريط المائل عاد!
    const AX = 28, AY = 28, AS = 292, AR = 110;
    const insideSuper = (px, py) => {
        // سوبرإليبس: |x/r|^n + |y/r|^n <= 1 حيث r=110 والنصفان (AS/2)
        const n = 2 / 4.4; // معادلة squirclePath: u = r*(1 - sin^(2/n)) — نستخدم فحصاً تقريبياً متحفظاً
        const cx = AX + AS / 2, cy = AY + AS / 2;
        const dx = Math.abs(px - cx) / (AS / 2), dy = Math.abs(py - cy) / (AS / 2);
        // نقطة داخل مربع القص المضمون: dx^2.2 + dy^2.2 <= 1 تقريباً
        return Math.pow(dx, 2.2) + Math.pow(dy, 2.2) <= 0.92; // 0.92 = هامش أمان داخل الحد
    };
    let darkInside = 0, samples = 0, darkList = [];
    for (let y = AY + 3; y < AY + AS - 3; y += 2) {
        for (let x = AX + 3; x < AX + AS - 3; x += 2) {
            if (!insideSuper(x, y)) continue;
            samples++;
            const [r, g, b] = aRed.at(x, y);
            if ((r + g + b) / 3 < 80) { darkInside++; if (darkList.length < 5) darkList.push(`(${x},${y})=#${r},${g},${b}`); }
        }
    }
    ok(samples > 5000, `عدد عينات داخل قصّ الألبوم = ${samples}`);
    ok(darkInside === 0, `صفر بكسلات داكنة داخل الغلاف الأحمر (الشريط المائل اختفى!)`, `dark=${darkInside} ${darkList.join(' ')}`);

    // فحص إضافي: الزاوية العلوية اليسرى تحديداً (منطقة الشريط القديم)
    // الشريط القديم كان قطرياً من الزاوية — نفحص مثلث أعلى-يسار داخل القصّ
    let darkTL = 0;
    for (let y = AY + 4; y < AY + 120; y++) {
        for (let x = AX + 4; x < AX + 120; x++) {
            if (x - AX + y - AY > 200) continue; // منطقة المثلث القريبة من الزاوية
            if (!insideSuper(x, y)) continue;
            const [r, g, b] = aRed.at(x, y);
            if ((r + g + b) / 3 < 80) darkTL++;
        }
    }
    ok(darkTL === 0, `مثلث الزاوية العلوية اليسرى نظيف تماماً (darkTL=${darkTL})`);

    console.log('\n════════ 2) بصمة المطور ELMINYAWE ════════');
    // الموضع: يمين أسفل — textAlign=right عند (W-32, H-14)، 24px ثقيل
    // النص "Dev: ELMINYAWE" ~200px عرضاً → منطقة x∈[1130,1385], y∈[300,342]
    function inkInRegion(a, x0, y0, x1, y1, dark) {
        let n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const [r, g, b] = a.at(x, y);
            if (dark ? (r + g + b) / 3 < 110 : (r + g + b) / 3 > 145) n++;
        }
        return n;
    }
    const devInkLight = inkInRegion(aRed, 1100, 296, 1390, 344, true);
    ok(devInkLight > 1200, `بصمة Dev: ELMINYAWE ظاهرة بوضوح في الثيم الفاتح`, `ink=${devInkLight}px (عتبة 1200)`);

    // الثيم الداكن
    MusicCard.setGuildTheme(GID, 'ease-dark');
    const bufDark = await MusicCard.generateMusicCard(
        { title: 'Test Song', artist: 'Test Artist', thumbnail: redUrl, duration: 200 },
        { volume: 80, guild: { id: GID } }, 50 * 1000,
        { requesterName: 'Tester', developer: 'ELMINYAWE', guildId: GID }
    );
    fs.writeFileSync(path.join(OUT, 'dark-theme.png'), bufDark);
    const aDark = await analyzeBuffer(bufDark);
    const devInkDark = inkInRegion(aDark, 1100, 296, 1390, 344, false);
    ok(devInkDark > 1200, `بصمة Dev: ELMINYAWE ظاهرة بوضوح في الثيم الداكن`, `ink=${devInkDark}px`);
    // خلفية الثيم الداكن فعلًا داكنة
    const [bgR, bgG, bgB] = aDark.at(700, 60);
    ok((bgR + bgG + bgB) / 3 < 90, `خلفية الثيم الداكن داكنة (${bgR},${bgG},${bgB})`);

    console.log('\n════════ 3) ثيم لكل سيرفر — العزل والاستعادة ════════');
    const G2 = '888222333';
    ok(MusicCard.resolveTheme(GID) === 'ease-dark', 'السيرفر الأول = ease-dark');
    ok(MusicCard.resolveTheme(G2) === MusicCard.getDefaultTheme(), `السيرفر الثاني = الافتراضي (${MusicCard.getDefaultTheme()}) — عزل تام`);
    MusicCard.clearGuildTheme(GID);
    ok(MusicCard.resolveTheme(GID) === MusicCard.getDefaultTheme(), 'clearGuildTheme يعيد للافتراضي');
    // setGuildTheme يرفض قيم غير صالحة (يحوّلها لفاتح)
    MusicCard.setGuildTheme(G2, 'hacker-green'); // غير صالح
    ok(MusicCard.resolveTheme(G2) === 'ease', 'ثيم غير صالح يسقط إلى ease (أمان)');

    console.log('\n════════ 4) قصّ أشرطة letterbox من الغلاف ════════');
    const bufLB = await MusicCard.generateMusicCard(
        { title: 'Letterbox Song', artist: 'LB Artist', thumbnail: lbUrl, duration: 180 },
        { volume: 90, guild: { id: G2 } }, 30 * 1000,
        { requesterName: 'Tester', developer: 'ELMINYAWE', guildId: G2 }
    );
    fs.writeFileSync(path.join(OUT, 'letterbox.png'), bufLB);
    const aLB = await analyzeBuffer(bufLB);
    // بعد القصّ: وسط الغلاف أزرق، وأي صف أسود كامل العرض داخل منتصف الألبوم = فشل القصّ
    let blackMidRows = 0;
    const midX = AX + Math.floor(AS / 2);
    for (let y = AY + 40; y < AY + AS - 40; y++) {
        const [r, g, b] = aLB.at(midX, y);
        if ((r + g + b) / 3 < 60) blackMidRows++;
    }
    ok(blackMidRows === 0, `لا صفوف سوداء في منتصف الألبوم بعد قصّ letterbox (blackMidRows=${blackMidRows})`);
    const [midR, midG, midB] = aLB.at(midX, AY + Math.floor(AS / 2));
    ok(midB > midR && (midR + midG + midB) / 3 > 60, `وسط الألبوم أزرق (الغلاف المقصوص) = rgb(${midR},${midG},${midB})`);

    console.log('\n════════ 5) انحدار سيناريوهات v26.8 ════════');
    const scenarios = [
        { name: 'arabic', track: { title: 'قلبي محتار - وكأنك غايب', artist: 'وغز', thumbnail: redUrl, duration: 247 }, pos: 61 * 1000, vol: 70 },
        { name: 'english', track: { title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: redUrl, duration: 200 }, pos: 70 * 1000, vol: 100 },
        { name: 'cjk', track: { title: '晴天 周杰伦', artist: '周杰伦', thumbnail: redUrl, duration: 269 }, pos: 15 * 1000, vol: 50 },
        { name: 'no-thumb', track: { title: 'No Thumbnail', artist: 'Unknown', duration: 100 }, pos: 10 * 1000, vol: 80 },
        { name: 'live', track: { title: 'Live Stream', artist: 'Streamer', thumbnail: redUrl, duration: 0 }, pos: 5 * 1000, vol: 100 },
        { name: 'long-title', track: { title: 'أطول عنوان أغنية في العالم كله لن يتجاوز حدود البطاقة أبداً مهما حاول - الجزء الثاني والتتمة', artist: 'فنان لديه اسم طويل جداً أيضاً', thumbnail: redUrl, duration: 300 }, pos: 100 * 1000, vol: 60 },
        { name: 'zero-pos', track: { title: 'Start Zero', artist: 'Artist', thumbnail: redUrl, duration: 200 }, pos: 0, vol: 100 },
    ];
    for (const sc of scenarios) {
        const buf = await MusicCard.generateMusicCard(sc.track, { volume: sc.vol, guild: { id: G2 } }, sc.pos,
            { requesterName: 'مينيّاوي', developer: 'ELMINYAWE', guildId: G2 });
        ok(!!buf && buf.length > 20000, `سيناريو ${sc.name} تولّد بنجاح (${buf ? Math.round(buf.length / 1024) + 'KB' : 'null'})`);
        fs.writeFileSync(path.join(OUT, `card-${sc.name}.png`), buf);
    }

    // توليدات متتالية (استقرار الكاش)
    let stable = true;
    for (let i = 0; i < 5; i++) {
        const b = await MusicCard.generateMusicCard(scenarios[0].track, { volume: 70 }, 61 * 1000, { requesterName: 'T', developer: 'ELMINYAWE' });
        if (!b) stable = false;
    }
    ok(stable, '5 توليدات متتالية من الكاش كلها ناجحة');

    srv.close();
    console.log(`\n════════ النتيجة: ${pass} ✅ / ${fail} ❌ ════════`);
    process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
