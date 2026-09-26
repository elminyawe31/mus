#!/usr/bin/env node
/**
 * test-fancysea-full-v269.js — التدفق الكامل لـ fancy-sea بـ browser headers كاملة
 * + اختبار فيديو copyright + قياس السرعة
 */
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': 'https://ytmp3.gl/',
    'Origin': 'https://ytmp3.gl',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
};
const WORKER = 'https://fancy-sea-5d3d.holy-breeze-fec5.workers.dev';

async function tryVideo(videoId, label) {
    console.log(`\n═══ ${label} (${videoId}) ═══`);
    const t0 = Date.now();
    const initUrl = `${WORKER}/?m=i&v=${videoId}&f=mp3&_=${Date.now()}`;
    let resp = await fetch(initUrl, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(60000) });
    let body = await resp.text();
    console.log(`  init: HTTP ${resp.status} ${((Date.now() - t0) / 1000).toFixed(1)}s | ${body.substring(0, 200)}`);
    if (!resp.ok) return false;
    let data = JSON.parse(body);
    if (data.error > 0) { console.log(`  ❌ error=${data.error}`); return false; }

    let title = data.title || '';
    let downloadURL = data.downloadURL;

    // progress polling لو لزم
    if (data.status === 'progress' && data.progressURL) {
        const deadline = Date.now() + 150e3;
        let lastP = -1;
        while (Date.now() < deadline) {
            const pr = await fetch(`${data.progressURL}&_=${Date.now()}`, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(30000) });
            if (pr.status === 200) {
                const pd = await pr.json();
                if (pd.error > 0) { console.log(`  ❌ progress error=${pd.error}`); return false; }
                if (pd.title) title = pd.title;
                if (pd.progress >= 3) { downloadURL = pd.downloadURL || downloadURL; break; }
                if (pd.progress !== lastP) { lastP = pd.progress; console.log(`  progress ${pd.progress}/3`); }
            } else { console.log(`  progress HTTP ${pr.status}`); }
            await new Promise(r => setTimeout(r, 3000));
        }
    }
    if (!downloadURL) { console.log('  ✋ لا downloadURL'); return false; }
    console.log(`  title: ${title}`);
    console.log(`  dl host: ${new URL(downloadURL).host}`);

    // التحميل — بـ browser headers (الـ Worker نفسه يتحقق منها)
    const dlT0 = Date.now();
    const dl = await fetch(`${downloadURL}${downloadURL.includes('?') ? '&' : '?'}v=${videoId}&f=mp3&r=ytmp3.gl&_=${Date.now()}`, {
        headers: BROWSER_HEADERS, signal: AbortSignal.timeout(120000),
    });
    const buf = Buffer.from(await dl.arrayBuffer());
    const secs = ((Date.now() - dlT0) / 1000).toFixed(1);
    const isMp3 = buf.length > 1000 && ((buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0));
    console.log(`  download: HTTP ${dl.status} ${secs}s ${(buf.length / 1024 / 1024).toFixed(2)}MB audio=${isMp3}`);
    if (dl.status === 200 && isMp3) { console.log(`  🎉 كامل النجاح عبر fancy-sea (Cloudflare)! | الكل في ${((Date.now() - t0) / 1000).toFixed(1)}s`); return true; }
    if (dl.status !== 200) console.log(`  body: ${buf.subarray(0, 120).toString('utf8')}`);
    return false;
}

(async () => {
    const r1 = await tryVideo('15VrKkUkcPw', 'Wegz - LAQTTA (فيديو المستخدم)');
    const r2 = await tryVideo('dQw4w9WgXcQ', 'Rick Astley (copyright)');
    const r3 = await tryVideo('jNQXAC9IVRw', 'Me at the zoo (أول فيديو يوتيوب)');
    console.log(`\n═══ النتائج: Wegz=${r1 ? '✅' : '❌'} | Rick=${r2 ? '✅' : '❌'} | Zoo=${r3 ? '✅' : '❌'} ═══`);
})().catch(e => console.log('FATAL:', e.message));
