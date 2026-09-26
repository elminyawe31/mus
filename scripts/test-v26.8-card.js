// ═══════════════════════════════════════════════════════════════════════════
//  test-v26.8-card.js — اختبار بطاقة musicard Ease الجديدة (v26.8)
//  يشمل: الخطوط + الكاشف المحصّن + سيناريوهات لغات + فحوصات بكسل + ثيم داكن
//  استخدم: node scripts/test-v26.8-card.js
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { execSync } = require('child_process');

const MusicCard = require('../src/MusicCard');
const OUT = path.join(__dirname, 'card-out-v268');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
function ok(cond, label) {
    if (cond) { pass++; console.log(`  ✅ ${label}`); }
    else { fail++; console.log(`  ❌ ${label}`); }
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

// عدّ البكسلات "الحبر" (ليست خلفية فاتحة) في منطقة — للثيم الفاتح: الحبر داكن
function countInk(a, x0, y0, x1, y1, maxLum = 120) {
    let n = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const [r, g, b] = a.at(x, y);
            if ((r + g + b) / 3 < maxLum) n++;
        }
    }
    return n;
}

(async () => {
    console.log('════════ 1) FONT REGISTRATION + BULLETPROOF DETECTOR ════════');
    const stats = MusicCard.getStats();
    console.log('  fonts:', JSON.stringify(stats.fonts, null, 1));
    ok(stats.ready, 'canvas ready');
    ok(MusicCard.__testHooks.fontFor('أغنية', 'heavy') !== 'sans-serif', 'Arabic font chain resolved');
    ok(/Tajawal/.test(String(stats.fonts.arabic)), `Arabic source = Tajawal bundled (${stats.fonts.arabic})`);
    ok(/Tajawal/.test(String(stats.fonts.latin)), `Latin source = Tajawal (${stats.fonts.latin})`);

    // الكاشف المحصّن على Kalam (يجب أن يرفضه — سبب مشكلة v26.7)
    const { _fontSupportsScript } = MusicCard.__testHooks;
    const { GlobalFonts } = require('@napi-rs/canvas');
    try {
        GlobalFonts.registerFromPath(path.join(__dirname, '..', 'src', 'base', 'Kalam-Regular.ttf'), 'KalamTest');
        ok(!_fontSupportsScript('KalamTest', ['ب', 'ت', 'ث', 'س']), 'detector REJECTS Kalam (no Arabic) — root cause of v26.7 tofu');
    } catch (e) { console.log('  (Kalam test skipped:', e.message + ')'); }
    ok(_fontSupportsScript('MusTajBlack', ['ب', 'ت', 'ث', 'س']), 'detector ACCEPTS Tajawal Black for Arabic');
    ok(_fontSupportsScript('MusTajMedium', ['ب', 'ت', 'ث', 'س']), 'detector ACCEPTS Tajawal Medium for Arabic');

    console.log('\n════════ 2) CARD SCENARIOS ════════');
    const thumb = 'https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg';

    const scenarios = [
        {
            name: 'arabic',
            track: { title: 'قولي - أحمد كامل', artist: 'أحمد كامل', thumbnail: thumb, duration: 244, platform: 'youtube' },
            player: { volume: 70 }, position: 61 * 1000,
            opts: { requesterName: 'مينيّاوي', developer: 'ELMINYAWE' },
        },
        {
            name: 'english',
            track: { title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: thumb, duration: 200, platform: 'youtube' },
            player: { volume: 100 }, position: 70 * 1000,
            opts: { requesterName: 'ELMINYAWE', developer: 'ELMINYAWE' },
        },
        {
            name: 'mixed-bidi',
            track: { title: 'Ahmed Kamel - أقول كلام (Official Lyrics Video)', artist: 'أحمد كامل', thumbnail: thumb, duration: 244, platform: 'youtube' },
            player: { volume: 55 }, position: 120 * 1000,
            opts: { requesterName: 'User_تست', developer: 'ELMINYAWE' },
        },
        {
            name: 'long-arabic',
            track: { title: 'أجمل ما غنى محمد منير في حفلاته الكاملة القديمة والجديدة ريمكس 2024 النسخة الأصلية', artist: 'محمد منير وأحمد منير ومحمد سلطان مع فرقة النيل', thumbnail: thumb, duration: 372, platform: 'youtube' },
            player: { volume: 30 }, position: 10 * 1000,
            opts: { requesterName: 'ELMINYAWE', developer: 'ELMINYAWE' },
        },
        {
            name: 'long-english',
            track: { title: 'The Longest Song Title Ever Written In The History Of Modern Music Production', artist: 'Some Very Long Artist Name That Goes On And On', thumbnail: thumb, duration: 372, platform: 'youtube' },
            player: { volume: 85 }, position: 300 * 1000,
            opts: { requesterName: 'ELMINYAWE', developer: 'ELMINYAWE' },
        },
        {
            name: 'cjk',
            track: { title: '晴天 - 周杰伦', artist: '周杰伦', thumbnail: thumb, duration: 269, platform: 'youtube' },
            player: { volume: 40 }, position: 100 * 1000,
            opts: { requesterName: 'ELMINYAWE', developer: 'ELMINYAWE' },
        },
        {
            name: 'no-thumbnail',
            track: { title: 'No Art Song', artist: 'Unknown Artist', duration: 180, platform: 'direct' },
            player: { volume: 60 }, position: 30 * 1000,
            opts: { requesterName: 'ELMINYAWE', developer: 'ELMINYAWE' },
        },
        {
            name: 'live-stream',
            track: { title: 'بث مباشر - قرآن كريم', artist: 'قناة مباشرة', thumbnail: thumb, duration: 0, platform: 'youtube' },
            player: { volume: 90 }, position: 45 * 60 * 1000,
            opts: { requesterName: 'ELMINYAWE', developer: 'ELMINYAWE' },
        },
        {
            name: 'start-zero',
            track: { title: 'Just Started', artist: 'Artist', thumbnail: thumb, duration: 200, platform: 'youtube' },
            player: { volume: 0 }, position: 0,
            opts: { developer: 'ELMINYAWE' },
        },
    ];

    const results = {};
    for (const sc of scenarios) {
        const t0 = Date.now();
        const buf = await MusicCard.generateMusicCard(sc.track, sc.player, sc.position, sc.opts);
        const ms = Date.now() - t0;
        results[sc.name] = buf;
        fs.writeFileSync(path.join(OUT, `card-${sc.name}.png`), buf);
        console.log(`  [${sc.name}] ${buf ? buf.length : 0} bytes in ${ms}ms`);
        ok(!!buf && buf.length > 10000, `${sc.name}: buffer generated`);
    }

    console.log('\n════════ 3) PIXEL ASSERTIONS ════════');
    // العربية
    const a = await analyzeBuffer(results.arabic);
    ok(a.w === 1415 && a.h === 348, `dimensions 1415×348 (got ${a.w}×${a.h})`);
    ok(a.at(3, 3)[3] === 0 && a.at(1411, 345)[3] === 0, 'corners transparent (squircle clip)');
    const titleInk = countInk(a, 377, 85, 1200, 140);
    ok(titleInk > 400, `Arabic title has ink (${titleInk}px) — not blank, not tofu-only`);
    const artistInk = countInk(a, 377, 160, 900, 200);
    ok(artistInk > 150, `Arabic artist has ink (${artistInk}px)`);
    // شريط التقدم عند 61s/244s = 25%: تعبئة حتى x≈377+79=456
    const fillMid = countInk(a, 380, 246, 450, 265);   // داخل التعبئة
    const afterFill = countInk(a, 480, 246, 690, 265); // بعد نهاية التعبئة (المسار فقط 14% = فاتح)
    ok(fillMid > 300, `progress bar filled region dark (${fillMid}px)`);
    ok(afterFill < 100, `progress bar beyond fill is light track (${afterFill}px)`);
    // شريط الصوت 70%: حتى x≈966+112=1078
    const volFill = countInk(a, 970, 245, 1070, 264);
    const volAfter = countInk(a, 1090, 245, 1120, 264);
    ok(volFill > 250, `volume bar filled (${volFill}px)`);
    ok(volAfter < 80, `volume bar beyond fill light (${volAfter}px)`);
    // requester + dev
    ok(countInk(a, 1200, 18, 1400, 45, 190) > 20, 'requested-by visible top-right');
    ok(countInk(a, 1250, 305, 1400, 330, 190) > 20, 'dev signature visible bottom-right');

    // الإنجليزية
    const e = await analyzeBuffer(results.english);
    ok(countInk(e, 377, 85, 900, 140) > 300, 'English title has ink');
    ok(countInk(e, 377, 160, 700, 200) > 100, 'English artist has ink');

    // الطويلة — يجب أن تنتهي بـ "…" وألا تلمس حافة البطاقة
    const la = await analyzeBuffer(results['long-arabic']);
    const longInk = countInk(la, 377, 85, 1380, 145);
    ok(longInk > 400, `long Arabic title fitted with ink (${longInk}px)`);
    const edgeInk = countInk(la, 1385, 60, 1414, 150);
    ok(edgeInk < 15, `long title stays inside card edge (${edgeInk}px at edge)`);

    // بدون thumbnail — placeholder يعمل
    const nt = await analyzeBuffer(results['no-thumbnail']);
    const ph = countInk(nt, 100, 100, 250, 220, 235);
    ok(ph > 100, `placeholder art drawn (${ph}px)`);

    // بث مباشر
    const lv = await analyzeBuffer(results['live-stream']);
    ok(countInk(lv, 710, 240, 850, 270) > 50, 'LIVE time text drawn');

    // كاش الصور يعمل (thumbnail نفسها → لا طلب شبكة ثانٍ)
    const before = MusicCard.getStats().cachedImages;
    await MusicCard.generateMusicCard(scenarios[1].track, scenarios[1].player, 80 * 1000, scenarios[1].opts);
    ok(MusicCard.getStats().cachedImages === before, `image cache reused (${before} cached)`);

    console.log('\n════════ 4) DARK THEME (child process) ════════');
    try {
        execSync(`MUSIC_CARD_THEME=ease-dark node -e "
            const MC = require('../src/MusicCard');
            const fs = require('fs');
            MC.generateMusicCard(
                { title: 'قولي - أحمد كامل', artist: 'أحمد كامل', thumbnail: '${thumb}', duration: 244 },
                { volume: 70 }, 61000, { requesterName: 'تست', developer: 'ELMINYAWE' }
            ).then(b => { fs.writeFileSync('${OUT}/card-dark.png', b); console.log('dark:', b.length); });
        "`, { cwd: __dirname, stdio: 'inherit', timeout: 60000 });
        const dk = fs.existsSync(path.join(OUT, 'card-dark.png'));
        ok(dk, 'dark theme card generated');
        if (dk) {
            const ad = await analyzeBuffer(fs.readFileSync(path.join(OUT, 'card-dark.png')));
            ok(ad.at(3, 3)[3] === 0, 'dark card corners transparent');
            // في الداكن: الحبر فاتح على داكن — عدّ البكسلات الفاتحة في العنوان
            let bright = 0;
            for (let y = 85; y < 140; y++) for (let x = 377; x < 1200; x++) {
                const [r, g, b] = ad.at(x, y);
                if ((r + g + b) / 3 > 150) bright++;
            }
            ok(bright > 400, `dark theme title bright ink (${bright}px)`);
        }
    } catch (e) {
        ok(false, `dark theme child process: ${e.message.slice(0, 80)}`);
    }

    console.log('\n════════ 5) STABILITY ════════');
    // 20 توليدة متتالية — لا تسريب ولا فشل (محاكاة تحديث كل 5 ثوان لفترة طويلة)
    let allOk = true;
    for (let i = 0; i < 20; i++) {
        const b = await MusicCard.generateMusicCard(
            scenarios[0].track, { volume: 70 }, (i * 10) * 1000, scenarios[0].opts);
        if (!b || b.length < 10000) { allOk = false; break; }
    }
    ok(allOk, '20 consecutive regenerations stable (uptime simulation)');
    ok(MusicCard.getStats().consecutiveFailures === 0, 'zero consecutive failures');

    console.log(`\n${'═'.repeat(50)}\n  RESULT: ${pass} passed, ${fail} failed\n${'═'.repeat(50)}`);
    process.exit(fail > 0 ? 1 : 0);
})().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
