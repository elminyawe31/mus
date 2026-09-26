#!/usr/bin/env node
/**
 * test-tubeapi-worker-v269.js — اختبار كامل لتدفق tubeapi عبر Cloudflare Workers
 * هذا هو الأمل الأكبر لتجاوز حظر Railway — Workers على edge كلودفلير
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const API_KEY = '66d0abdc85f3b52ac9df11d95ebce90a';
const W_INIT = 'https://royal-forest-deb8.holy-breeze-fec5.workers.dev';
const W_DL = 'https://hidden-sun-3c87.holy-breeze-fec5.workers.dev';
const VIDEO_ID = '15VrKkUkcPw'; // Wegz - LAQTTA (فيديو المستخدم الفاشل)
const REFERER = 'ytmp3.gl';

(async () => {
    // 1) init
    console.log('── 1) init (e=i) ──');
    const initUrl = `${W_INIT}/?v=${VIDEO_ID}&f=mp3&e=i&api_key=${API_KEY}&_=${Date.now()}`;
    let resp = await fetch(initUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://tubeapi.org/' }, signal: AbortSignal.timeout(60000) });
    let body = await resp.text();
    console.log(`  HTTP ${resp.status} | ${body.substring(0, 300)}`);
    if (!resp.ok) return;
    let data;
    try { data = JSON.parse(body); } catch { console.log('  ✋ ليس JSON'); return; }

    let statusUrl = data.statusUrl || data.status_url;
    let title = data.title || '';
    let downloadUrl = null;

    // 2) progress polling (e=p)
    if (statusUrl) {
        console.log('── 2) progress polling (e=p) ──');
        const deadline = Date.now() + 150e3;
        while (Date.now() < deadline) {
            const pUrl = `${W_INIT}/?u=${Buffer.from(statusUrl).toString('base64')}&e=p&api_key=${API_KEY}&_=${Date.now()}`;
            const pr = await fetch(pUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://tubeapi.org/' }, signal: AbortSignal.timeout(60000) });
            if (pr.ok) {
                const pd = await pr.json();
                if (pd.title) title = pd.title;
                if (pd.status === 'completed') { downloadUrl = pd.downloadUrl || pd.download_url; break; }
                if (pd.status === 'fail') { console.log('  ❌ fail'); break; }
                console.log(`  ${pd.status} ${pd.progress || 0}%`);
            } else {
                console.log(`  progress HTTP ${pr.status}`);
            }
            await new Promise(r => setTimeout(r, 4000));
        }
    } else if (data.downloadUrl || data.link) {
        downloadUrl = data.downloadUrl || data.link;
    }

    if (!downloadUrl) { console.log('  ✋ لا downloadUrl'); return; }
    console.log(`  title: ${title}`);
    console.log(`  downloadUrl: ${downloadUrl.substring(0, 100)}`);

    // 3) download عبر الـ Worker proxy (e=d)
    console.log('── 3) download عبر worker proxy (e=d) ──');
    const dlUrl = `${W_DL}/?e=d&u=${Buffer.from(downloadUrl).toString('base64')}&r=${REFERER}&api_key=${API_KEY}&_=${Date.now()}`;
    const t0 = Date.now();
    const dl = await fetch(dlUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://tubeapi.org/' }, signal: AbortSignal.timeout(120000) });
    const buf = Buffer.from(await dl.arrayBuffer());
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const isMp3 = buf.length > 100 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33;
    const isMpeg = buf.length > 100 && buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0;
    console.log(`  HTTP ${dl.status} ${secs}s ${(buf.length / 1024 / 1024).toFixed(2)}MB mp3=${isMp3} mpeg=${isMpeg}`);
    console.log(`  ${isMp3 || isMpeg ? '🎉 نجح كامل عبر Cloudflare Workers!' : '❌ ليس ملفاً صوتياً: ' + buf.subarray(0, 64).toString('utf8').replace(/\n/g, ' ')}`);

    // 4) اختبار إضافي: هل الـ API يشتغل من دون Referer؟ (البوت سيرسل Referer المزيف)
    console.log('── 4) init بدون Referer ──');
    const r4 = await fetch(`${W_INIT}/?v=dQw4w9WgXcQ&f=mp3&e=i&api_key=${API_KEY}&_=${Date.now()}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    console.log(`  HTTP ${r4.status} | ${(await r4.text()).substring(0, 150)}`);
})().catch(e => console.log('FATAL:', e.message));
