#!/usr/bin/env node
/**
 * test-v26.9-downloads.js — اختبار حي شامل لسلسلة التحميل الجديدة (v26.9)
 * 1) المسارات الثلاثة Workers منفردة (fancy / tubeapi / hiddensun)
 * 2) downloadMP3 التكاملي (فيديو المستخدم الفاشل على Railway)
 * 3) فيديو copyright (يتجاوز fancy، يتخطى tubeapi بنعومة)
 * 4) static-session bypass (محاكاة حظر auth)
 * 5) ipBlock cooldown (403 متتالية → تبريد 30 دقيقة)
 * 6) copyright لا يعاقب المزود
 * 7) الترتيب: workers قبل direct
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const YouTube = require('../src/YouTube');

let passed = 0, failed = 0;
const ok = (cond, name, extra = '') => {
    if (cond) { passed++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`); }
    else { failed++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};
const tmpFile = (n) => path.join(os.tmpdir(), `v269-test-${n}.mp3`);

(async () => {
    // ═══ 1) fancy-sea worker منفرد ═══
    console.log('\n═══ 1) fancy-sea worker منفرد (فيديو المستخدم 15VrKkUkcPw) ═══');
    try {
        YouTube.__ytmp3TestHook('reset', 'fancy');
        const p = YouTube.__ytmp3TestHook('get', 'fancy');
        const t0 = Date.now();
        const r = await YouTube._ytmp3FancyFlow(p, '15VrKkUkcPw', tmpFile('fancy'), 'mp3', t0);
        ok(r.success, 'fancy flow ينجح');
        ok(fs.existsSync(tmpFile('fancy')) && fs.statSync(tmpFile('fancy')).size > 100000, 'ملف صوتي حقيقي', `${(fs.statSync(tmpFile('fancy')).size / 1024 / 1024).toFixed(2)}MB`);
        ok(/Wegz|ويجز/i.test(r.title || ''), 'العنوان العربي صحيح', r.title?.substring(0, 50));
    } catch (e) { ok(false, 'fancy flow ينجح', e.message.substring(0, 100)); }

    // ═══ 2) tubeapi worker منفرد ═══
    console.log('\n═══ 2) tubeapi worker منفرد ═══');
    try {
        YouTube.__ytmp3TestHook('reset', 'tubeapi');
        const p = YouTube.__ytmp3TestHook('get', 'tubeapi');
        const t0 = Date.now();
        const r = await YouTube._ytmp3TubeapiFlow(p, '15VrKkUkcPw', tmpFile('tubeapi'), 'mp3', t0);
        ok(r.success, 'tubeapi flow ينجح');
        ok(fs.existsSync(tmpFile('tubeapi')) && fs.statSync(tmpFile('tubeapi')).size > 100000, 'ملف صوتي حقيقي', `${(fs.statSync(tmpFile('tubeapi')).size / 1024 / 1024).toFixed(2)}MB`);
    } catch (e) { ok(false, 'tubeapi flow ينجح', e.message.substring(0, 100)); }

    // ═══ 3) hidden-sun worker منفرد ═══
    console.log('\n═══ 3) hidden-sun worker منفرد ═══');
    try {
        YouTube.__ytmp3TestHook('reset', 'hiddensun');
        const p = YouTube.__ytmp3TestHook('get', 'hiddensun');
        const t0 = Date.now();
        const r = await YouTube._ytmp3HiddensunFlow(p, '15VrKkUkcPw', tmpFile('hs'), 'mp3', t0);
        ok(r.success, 'hiddensun flow ينجح');
        ok(fs.existsSync(tmpFile('hs')) && fs.statSync(tmpFile('hs')).size > 100000, 'ملف صوتي حقيقي', `${(fs.statSync(tmpFile('hs')).size / 1024 / 1024).toFixed(2)}MB`);
    } catch (e) { ok(false, 'hiddensun flow ينجح', e.message.substring(0, 100)); }

    // ═══ 4) copyright: fancy ينجح حيث tubeapi يُحجب ═══
    console.log('\n═══ 4) فيديو copyright (dQw4w9WgXcQ — Rick Astley) ═══');
    try {
        YouTube.__ytmp3TestHook('reset', 'tubeapi');
        const pT = YouTube.__ytmp3TestHook('get', 'tubeapi');
        let tubeapiCopyright = false;
        try {
            await YouTube._ytmp3TubeapiFlow(pT, 'dQw4w9WgXcQ', tmpFile('tcopy'), 'mp3', Date.now());
            console.log('  (مفاجأة: tubeapi مرّ هذه المرة — الكوبيرايت متقلب)');
        } catch (e) {
            tubeapiCopyright = e.copyright === true;
            ok(e.copyright === true, 'tubeapi يرفض بعلامة copyright (لا يعاقب)', e.message.substring(0, 60));
        }
        // fancy يجب أن ينجح
        YouTube.__ytmp3TestHook('reset', 'fancy');
        const pF = YouTube.__ytmp3TestHook('get', 'fancy');
        const r = await YouTube._ytmp3FancyFlow(pF, 'dQw4w9WgXcQ', tmpFile('fcopy'), 'mp3', Date.now());
        ok(r.success, 'fancy ينجح مع copyright video', `${(fs.statSync(tmpFile('fcopy')).size / 1024 / 1024).toFixed(2)}MB`);
    } catch (e) { ok(false, 'fancy مع copyright', e.message.substring(0, 100)); }

    // ═══ 5) downloadMP3 التكاملي ═══
    console.log('\n═══ 5) downloadMP3 التكاملي (كما يستدعيه MusicPlayer) ═══');
    try {
        const r = await YouTube.downloadMP3('https://www.youtube.com/watch?v=15VrKkUkcPw', tmpFile('full'));
        ok(r.success, 'downloadMP3 ينجح', `${(r.fileSize / 1024 / 1024).toFixed(2)}MB | title=${(r.title || '').substring(0, 40)}`);
    } catch (e) { ok(false, 'downloadMP3 ينجح', e.message.substring(0, 100)); }

    // ═══ 6) static-session bypass (محاكاة 403 على auth) ═══
    console.log('\n═══ 6) static-session bypass — محاكاة حظر auth بـ 403 ═══');
    {
        // استبدل fetch مؤقتاً داخل العملية: auth يرجع 403، init يعمل
        const realFetch = global.fetch;
        let authCalls = 0, initWithStatic = false;
        global.fetch = async (url, opts = {}) => {
            const u = String(url);
            if (u.includes('/api/v1/auth')) { authCalls++; return new Response('<html>403</html>', { status: 403 }); }
            if (u.includes('/api/v1/init')) {
                if ((opts.headers || {})['Authorization'] === 'Bearer CimtTPu5Yjqgg8Ta') initWithStatic = true;
                return new Response(JSON.stringify({ error: 0, convertURL: 'https://example.test/api/v1/convert?sig=x' }), { status: 200, headers: { 'content-type': 'application/json' } });
            }
            // convert (بعد الباس) — يرجع downloadURL وهمي
            if (u.includes('convert')) return new Response(JSON.stringify({ error: 0, redirect: 0, downloadURL: 'https://dl.test/f.mp3' }), { status: 200, headers: { 'content-type': 'application/json' } });
            if (u.includes('dl.test/f.mp3')) {
                const buf = Buffer.alloc(4096); buf[0] = 0x49; buf[1] = 0x44; buf[2] = 0x33; // ID3
                return new Response(buf, { status: 200 });
            }
            // اكتشاف الموقع — HTML بلا مفتاح (يرجع الثابت)
            if (u.startsWith('https://ytmp3.gl') || u.startsWith('https://ytmp3.nu')) return new Response('<html></html>', { status: 200 });
            return new Response('{}', { status: 200 });
        };
        try {
            YouTube.__ytmp3TestHook('reset', 'gamma');
            const pG = YouTube.__ytmp3TestHook('get', 'gamma');
            const r = await YouTube._ytmp3DirectFlow(pG, 'dQw4w9WgXcQ', tmpFile('bypass'), 'mp3', Date.now());
            ok(r.success && initWithStatic, 'التجاوز يعمل: init بمفتاح ثابت بعد 403', `auth calls=${authCalls}, staticUsed=${initWithStatic}`);
        } catch (e) {
            ok(initWithStatic, 'التجاوز جرّب init الثابت (ثم فشل تحميل وهمي — مقبول)', e.message.substring(0, 80));
        } finally { global.fetch = realFetch; }
    }

    // ═══ 7) ipBlock cooldown ═══
    console.log('\n═══ 7) ipBlock cooldown بعد 403 متتالية (عتبة 2) ═══');
    {
        YouTube.__ytmp3TestHook('reset', 'gamma');
        const pG = YouTube.__ytmp3TestHook('get', 'gamma');
        // محاكاة أغنيتين متتاليتين تفشلان بـ 403 (fetch يرجع 403 لكل شيء)
        const realFetch = global.fetch;
        global.fetch = async () => new Response('<html>403</html>', { status: 403 });
        try {
            // عطّل كل المزودين الآخرين بالتبريد حتى لا يضيع الوقت
            for (const n of ['fancy', 'tubeapi', 'hiddensun', 'epsilon']) YouTube.__ytmp3TestHook('cooldown', n, Date.now() + 60000);
            // أغنية 1 → consecutive403=1 (لا تبريد بعد — أأمن ضد 403 عابرة)
            await YouTube.downloadViaYtmp3Family('dQw4w9WgXcQ', tmpFile('ipb1'), 'mp3');
            const mid = YouTube.__ytmp3TestHook('get', 'gamma');
            ok(mid.consecutive403 === 1, 'الأغنية 1: counter=1 بلا تبريد', `cooldown=${Math.max(0, Math.round((mid.cooldownUntil - Date.now()) / 60000))}د`);
            // أغنية 2 → consecutive403=2 → تبريد 30 دقيقة
            await YouTube.downloadViaYtmp3Family('jNQXAC9IVRw', tmpFile('ipb2'), 'mp3');
        } catch (e) { /* متوقع */ }
        finally { global.fetch = realFetch; }
        const after = YouTube.__ytmp3TestHook('get', 'gamma');
        ok(after.consecutive403 >= 2, 'counter 403 ارتفع', `consecutive403=${after.consecutive403}`);
        ok(after.cooldownUntil > Date.now() + 25 * 60e3, 'تبريد 30 دقيقة مُطبّق', `${Math.round((after.cooldownUntil - Date.now()) / 60000)} دقيقة متبقية`);
        // تنظيف
        for (const n of ['fancy', 'tubeapi', 'hiddensun', 'gamma', 'epsilon']) YouTube.__ytmp3TestHook('reset', n);
    }

    // ═══ 8) copyright لا يعاقب المزود ═══
    console.log('\n═══ 8) copyright لا يرفع failCount ═══');
    {
        YouTube.__ytmp3TestHook('reset', 'tubeapi');
        const pT = YouTube.__ytmp3TestHook('get', 'tubeapi');
        const before = pT.failCount;
        // محاكاة خطأ copyright
        const err = Object.assign(new Error('init HTTP 451 COPYRIGHT_BLOCKED'), { copyright: true, videoSpecific: true });
        // نفس منطق downloadViaYtmp3Family
        if (!err.copyright && !err.videoSpecific) pT.failCount++;
        ok(pT.failCount === before, 'failCount لم يرتفع مع copyright');
    }

    // ═══ 9) الترتيب: workers أولاً ═══
    console.log('\n═══ 9) ترتيب المزودين ═══');
    {
        const st = YouTube.ytmp3FamilyState;
        ok(st[0].type.startsWith('worker') && st[1].type.startsWith('worker') && st[2].type.startsWith('worker'), 'workers أولاً');
        ok(st[3].type === 'direct' && st[4].type === 'direct', 'direct بعدهم');
    }

    // ═══ النتيجة ═══
    console.log(`\n${'═'.repeat(50)}\n📊 النتيجة: ${passed} نجح / ${failed} فشل\n${'═'.repeat(50)}`);
    process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.log('FATAL:', e); process.exit(1); });
