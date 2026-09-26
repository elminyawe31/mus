#!/usr/bin/env node
/**
 * test-tubeapi-dl-v269.js — اختبار مساري التحميل الصحيحين لـ tubeapi
 * 1) مباشرة من VPS (vps-xxx.mmnrmnrmnrrm.shop)
 * 2) عبر royal-forest worker e=d (المسار الصحيح حسب JS)
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const API_KEY = '66d0abdc85f3b52ac9df11d95ebce90a';
const W_INIT = 'https://royal-forest-deb8.holy-breeze-fec5.workers.dev';
const VIDEO_ID = '15VrKkUkcPw';

(async () => {
    // init + progress (كما نجح سابقاً)
    const initUrl = `${W_INIT}/?v=${VIDEO_ID}&f=mp3&e=i&api_key=${API_KEY}&_=${Date.now()}`;
    let resp = await fetch(initUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://tubeapi.org/' }, signal: AbortSignal.timeout(60000) });
    let data = await resp.json();
    console.log(`init: HTTP ${resp.status} statusUrl=${data.statusUrl ? 'yes' : 'no'} title=${(data.title || '').substring(0, 40)}`);

    let title = data.title || '';
    let downloadUrl = null;
    const deadline = Date.now() + 150e3;
    while (Date.now() < deadline && !downloadUrl) {
        const pUrl = `${W_INIT}/?u=${Buffer.from(data.statusUrl).toString('base64')}&e=p&api_key=${API_KEY}&_=${Date.now()}`;
        const pr = await fetch(pUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://tubeapi.org/' }, signal: AbortSignal.timeout(60000) });
        if (pr.ok) {
            const pd = await pr.json();
            if (pd.title) title = pd.title;
            if (pd.status === 'completed') { downloadUrl = pd.downloadUrl; break; }
            if (pd.status === 'fail') { console.log('❌ fail'); return; }
            console.log(`  ${pd.status} ${pd.progress || 0}%`);
        }
        await new Promise(r => setTimeout(r, 4000));
    }
    if (!downloadUrl) { console.log('✋ timeout بلا downloadUrl'); return; }
    console.log(`ready! dl=${downloadUrl.substring(0, 80)}...`);
    console.log(`title=${title}`);

    // ── المسار 1: تحميل مباشر من VPS ──
    console.log('\n── مسار 1: مباشر من VPS ──');
    try {
        const t0 = Date.now();
        const dl = await fetch(`${downloadUrl}&_=${Date.now()}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
        const buf = Buffer.from(await dl.arrayBuffer());
        const isMp3 = buf.length > 1000 && (buf[0] === 0x49 || buf[0] === 0xFF);
        console.log(`  HTTP ${dl.status} ${((Date.now() - t0) / 1000).toFixed(1)}s ${(buf.length / 1024 / 1024).toFixed(2)}MB audio=${isMp3}`);
        if (dl.status !== 200) console.log(`  body: ${buf.subarray(0, 100).toString('utf8')}`);
    } catch (e) { console.log(`  ERROR: ${e.message}`); }

    // ── المسار 2: عبر royal-forest worker e=d (كما في JS الأصلي تماماً) ──
    console.log('\n── مسار 2: royal-forest worker (e=d) ──');
    try {
        const wUrl = `${W_INIT}/?u=${Buffer.from(downloadUrl).toString('base64')}&e=d&r=ytmp3.gl&api_key=${API_KEY}&_=${Date.now()}`;
        const t0 = Date.now();
        const dl = await fetch(wUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://tubeapi.org/' }, signal: AbortSignal.timeout(120000) });
        const buf = Buffer.from(await dl.arrayBuffer());
        const isMp3 = buf.length > 1000 && (buf[0] === 0x49 || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0));
        console.log(`  HTTP ${dl.status} ${((Date.now() - t0) / 1000).toFixed(1)}s ${(buf.length / 1024 / 1024).toFixed(2)}MB audio=${isMp3}`);
        if (dl.status !== 200) console.log(`  body: ${buf.subarray(0, 150).toString('utf8')}`);
        else console.log(`  🎉 التحميل عبر Cloudflare Worker يعمل! (audio=${isMp3})`);
    } catch (e) { console.log(`  ERROR: ${e.message}`); }

    // ── مسار 3: hidden-sun worker بالصيغة الصحيحة (e=d مع u=btoa(link)) ──
    console.log('\n── مسار 3: hidden-sun worker (e=d) ──');
    try {
        const wUrl = `${'https://hidden-sun-3c87.holy-breeze-fec5.workers.dev'}/?e=d&u=${Buffer.from(downloadUrl).toString('base64')}&r=ytmp3.gl&api_key=${API_KEY}&_=${Date.now()}`;
        const dl = await fetch(wUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://tubeapi.org/' }, signal: AbortSignal.timeout(120000) });
        const buf = Buffer.from(await dl.arrayBuffer());
        const isMp3 = buf.length > 1000 && (buf[0] === 0x49 || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0));
        console.log(`  HTTP ${dl.status} ${(buf.length / 1024 / 1024).toFixed(2)}MB audio=${isMp3}`);
        if (dl.status !== 200) console.log(`  body: ${buf.subarray(0, 150).toString('utf8')}`);
    } catch (e) { console.log(`  ERROR: ${e.message}`); }
})().catch(e => console.log('FATAL:', e.message));
