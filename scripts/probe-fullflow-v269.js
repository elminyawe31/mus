#!/usr/bin/env node
/**
 * probe-fullflow-v269.js — التدفق الكامل على gamma (يعمل من هنا)
 * أسئلة يجب الإجابة عليها:
 * 1. هل مفتاح الجلسة من auth ثابت عالمياً؟
 * 2. هل init يعمل بمفتاح "ثابت" بدون auth حقيقي؟
 * 3. على أي host يقع downloadURL النهائي؟ (مختلف عن API host؟)
 * 4. هل التحميل النهائي يعمل بدون Referer/Origin؟ (اختبار قيود anti-hotlink)
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const KEY = 'b69e9ac84c9c5f8a9f265c337a9005f3';
const BASE = 'https://gamma.gammacloud.net';
const SITE = 'https://ytmp3.gl';
const VIDEO_ID = '15VrKkUkcPw'; // نفس فيديو المستخدم الفاشل — Wegz - LAQTTA

(async () => {
    const H = { 'User-Agent': UA, 'Referer': `${SITE}/`, 'Origin': SITE };

    // 1) auth ثلاث مرات — هل المفتاح ثابت؟
    console.log('── 1) auth ×3 (فحص ثبات مفتاح الجلسة) ──');
    const keys = [];
    for (let i = 0; i < 3; i++) {
        const r = await fetch(`${BASE}/api/v1/auth?api_key=${KEY}&_=${Date.now()}`, { headers: H, signal: AbortSignal.timeout(12000) });
        const d = await r.json();
        keys.push(d.key);
        console.log(`  auth#${i + 1}: HTTP ${r.status} key=${d.key} geo=${d.geo} err=${d.err}`);
        await new Promise(r => setTimeout(r, 500));
    }
    console.log(`  → ${new Set(keys).size === 1 ? '🔴 المفتاح ثابت!' : '🟢 المفتاح ديناميكي'} (${[...new Set(keys)].join(', ')})`);

    // 2) init بالمفتاح — ثم خريطة التدفق
    console.log('── 2) init ──');
    const initResp = await fetch(`${BASE}/api/v1/init?_=${Date.now()}`, {
        headers: { ...H, 'Authorization': `Bearer ${keys[0]}` }, signal: AbortSignal.timeout(12000),
    });
    const initData = await initResp.json();
    console.log(`  init: HTTP ${initResp.status} convertURL=${initData.convertURL ? initData.convertURL.substring(0, 80) + '...' : 'NONE'} err=${initData.error}`);
    if (!initData.convertURL) { console.log('  ✋ لا convertURL — توقف'); return; }
    const convertHost = new URL(initData.convertURL).host;
    console.log(`  convert host = ${convertHost}`);

    // 3) convert
    console.log('── 3) convert ──');
    let u = initData.convertURL;
    let resp = await fetch(`${u}&v=${VIDEO_ID}&f=mp3&_=${Date.now()}`, { headers: H, signal: AbortSignal.timeout(30000) });
    let data = await resp.json();
    console.log(`  convert: HTTP ${resp.status} redirect=${data.redirect} err=${data.error}`);
    let redirects = 0;
    while (Number(data.error) === 0 && Number(data.redirect) === 1 && data.redirectURL && redirects < 3) {
        let ru = data.redirectURL;
        const vi = ru.indexOf('&v=');
        if (vi > -1) ru = ru.substring(0, vi);
        console.log(`  redirect#${redirects + 1} → ${new URL(ru).host}`);
        resp = await fetch(`${ru}&v=${VIDEO_ID}&f=mp3&_=${Date.now()}`, { headers: H, signal: AbortSignal.timeout(30000) });
        data = await resp.json();
        console.log(`    HTTP ${resp.status} redirect=${data.redirect} err=${data.error} progress=${data.progress || '-'} downloadURL=${data.downloadURL ? new URL(data.downloadURL).host : 'none'}`);
        redirects++;
    }

    // 4) progress polling حتى الجاهزية
    if (data.progressURL && !data.downloadURL) {
        console.log('── 4) progress polling ──');
        const deadline = Date.now() + 120e3;
        while (Date.now() < deadline) {
            const pr = await fetch(`${data.progressURL}&_=${Date.now()}`, { headers: H, signal: AbortSignal.timeout(12000) });
            if (pr.ok) {
                const pd = await pr.json();
                if (Number(pd.progress) !== (data._last || -1)) console.log(`  progress: ${pd.progress}/3 | ${pd.downloadURL ? 'dl=' + new URL(pd.downloadURL).host : ''}`);
                data._last = Number(pd.progress);
                if (Number(pd.progress) >= 3) { data.downloadURL = pd.downloadURL; data.title = pd.title; break; }
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (!data.downloadURL) { console.log('  ✋ لا downloadURL'); return; }
    const dlHost = new URL(data.downloadURL).host;
    console.log(`── 5) download: ${dlHost} (API host كان ${new URL(BASE).host}) ──`);
    console.log(`  ${dlHost === new URL(BASE).host ? '⚠️ نفس الـ host — الحظر سيشمل التحميل' : '🟢 host مختلف! ربما التحميل غير محظور من Railway'}`);

    // 6) حمّل أول 64KB بدون Referer (اختبار anti-hotlink)
    const dlResp = await fetch(`${data.downloadURL}&_=${Date.now()}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    const buf = Buffer.from(await dlResp.arrayBuffer());
    console.log(`  download: HTTP ${dlResp.status} size=${(buf.length / 1024).toFixed(0)}KB first16=${buf.subarray(0, 16).toString('hex')}`);
    const isMp3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33;
    console.log(`  ${isMp3 ? '✅ MP3 حقيقي (ID3)' : '❌ ليس MP3'} | بدون Referer: ${dlResp.status === 200 ? 'يعمل!' : 'محظور'}`);
    console.log(`  title: ${data.title || 'none'}`);
})().catch(e => console.log('FATAL:', e.message));
