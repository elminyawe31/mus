#!/usr/bin/env node
/**
 * test-fancysea-v269.js — اختبار fancy-sea worker (fallback المُشغّل الرسمي عبر Cloudflare)
 * الطلب الواحد: ?m=i&v=<id>&f=mp3 → status/progressURL/downloadURL
 * ثم التحميل: downloadURL + &v=&f=&r=ytmp3.gl (كما يفعل JS الموقع حرفياً)
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const WORKER = 'https://fancy-sea-5d3d.holy-breeze-fec5.workers.dev';

async function tryVideo(videoId, label) {
    console.log(`\n═══ ${label} (${videoId}) ═══`);
    // 1) بدء التحويل
    const startUrl = `${WORKER}/?m=i&v=${videoId}&f=mp3&_=${Date.now()}`;
    let resp = await fetch(startUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://ytmp3.gl/' }, signal: AbortSignal.timeout(60000) });
    let body = await resp.text();
    console.log(`  init: HTTP ${resp.status} | ${body.substring(0, 250)}`);
    if (!resp.ok) return false;
    let data;
    try { data = JSON.parse(body); } catch { return false; }
    if (data.error > 0) { console.log(`  ❌ error=${data.error}`); return false; }

    let title = data.title || '';
    let downloadURL = null;

    if (data.status === 'download' && data.downloadURL) {
        downloadURL = data.downloadURL;
    } else if (data.status === 'progress' && data.progressURL) {
        // 2) polling
        const deadline = Date.now() + 120e3;
        let lastP = -1;
        while (Date.now() < deadline) {
            const pr = await fetch(`${data.progressURL}&_=${Date.now()}`, { headers: { 'User-Agent': UA, 'Referer': 'https://ytmp3.gl/' }, signal: AbortSignal.timeout(30000) });
            if (pr.status === 200) {
                const pd = await pr.json();
                if (pd.error > 0) { console.log(`  ❌ progress error=${pd.error}`); return false; }
                if (pd.title) title = pd.title;
                if (pd.progress >= 3) { downloadURL = pd.downloadURL || data.downloadURL; break; }
                if (pd.progress !== lastP) { lastP = pd.progress; console.log(`  progress ${pd.progress}/3`); }
            } else { console.log(`  progress HTTP ${pr.status}`); }
            await new Promise(r => setTimeout(r, 3000));
        }
    }
    if (!downloadURL) { console.log('  ✋ لا downloadURL'); return false; }
    console.log(`  title: ${title}`);

    // 3) التحميل — تماماً كما يفعل JS الموقع: downloadURL + &v=&f=&r=
    const dlUrl = `${downloadURL}&v=${videoId}&f=mp3&r=ytmp3.gl`;
    const t0 = Date.now();
    const dl = await fetch(dlUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://ytmp3.gl/' }, signal: AbortSignal.timeout(120000) });
    const buf = Buffer.from(await dl.arrayBuffer());
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const isMp3 = buf.length > 1000 && ((buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0));
    console.log(`  download: HTTP ${dl.status} ${secs}s ${(buf.length / 1024 / 1024).toFixed(2)}MB audio=${isMp3}`);
    if (dl.status === 200 && isMp3) { console.log(`  🎉 fancy-sea worker يعمل كاملاً!`); return true; }
    if (dl.status !== 200) console.log(`  body: ${buf.subarray(0, 120).toString('utf8')}`);
    return false;
}

(async () => {
    // فيديو المستخدم الفاشل (Wegz)
    const r1 = await tryVideo('15VrKkUkcPw', 'Wegz - LAQTTA (فيديو المستخدم)');
    // فيديو مشهور محتمل الحماية (اختبار حدود copyright)
    const r2 = await tryVideo('dQw4w9WgXcQ', 'Rick Astley (copyright test)');
    console.log(`\n═══ النتيجة النهائية: Wegz=${r1 ? '✅' : '❌'} | Copyright=${r2 ? '✅' : '❌'} ═══`);
})().catch(e => console.log('FATAL:', e.message));
