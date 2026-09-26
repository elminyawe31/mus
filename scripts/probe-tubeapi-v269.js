#!/usr/bin/env node
/**
 * probe-tubeapi-v269.js — فحص tubeapi.org (الـ API الخفي الثالث من JS الموقع)
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const VIDEO_ID = '15VrKkUkcPw';

(async () => {
    const H = { 'User-Agent': UA, 'Referer': 'https://ytmp3.gl/', 'Origin': 'https://ytmp3.gl' };

    // 1) الصفحة الرئيسية
    console.log('── 1) الصفحة الرئيسية ──');
    try {
        const r = await fetch('https://tubeapi.org/', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
        const body = await r.text();
        console.log(`  HTTP ${r.status} len=${body.length} | ${body.substring(0, 200).replace(/\n/g, ' ')}`);
    } catch (e) { console.log(`  ERROR: ${e.message}`); }

    // 2) auth بكل المفاتيح المعروفة
    console.log('── 2) auth بالمفاتيح المعروفة ──');
    const keys = [
        { label: 'gamma-key',   key: 'b69e9ac84c9c5f8a9f265c337a9005f3' },
        { label: 'epsilon-key', key: 'ea4d4d5ce613226d632d118c74bb85ae' },
    ];
    for (const k of keys) {
        try {
            const r = await fetch(`https://tubeapi.org/api/v1/auth?api_key=${k.key}&_=${Date.now()}`, { headers: H, signal: AbortSignal.timeout(10000) });
            const body = await r.text();
            console.log(`  ${k.label}: HTTP ${r.status} | ${body.substring(0, 120).replace(/\n/g, ' ')}`);
        } catch (e) { console.log(`  ${k.label}: ERROR ${e.message.substring(0, 60)}`); }
    }

    // 3) init بالمفتاح الثابت
    console.log('── 3) init بالمفتاح الثابت ──');
    try {
        const r = await fetch(`https://tubeapi.org/api/v1/init?_=${Date.now()}`, {
            headers: { ...H, 'Authorization': 'Bearer CimtTPu5Yjqgg8Ta' }, signal: AbortSignal.timeout(10000),
        });
        const body = await r.text();
        console.log(`  HTTP ${r.status} | ${body.substring(0, 200).replace(/\n/g, ' ')}`);
        if (r.ok) {
            const d = JSON.parse(body);
            if (d.convertURL) {
                // 4) convert مباشر!
                console.log('── 4) convert ──');
                let resp = await fetch(`${d.convertURL}&v=${VIDEO_ID}&f=mp3&_=${Date.now()}`, { headers: H, signal: AbortSignal.timeout(30000) });
                let data = await resp.json();
                console.log(`  HTTP ${resp.status} redirect=${data.redirect} err=${data.error} dl=${data.downloadURL ? new URL(data.downloadURL).host : 'none'}`);
                let redirects = 0;
                while (Number(data.error) === 0 && Number(data.redirect) === 1 && data.redirectURL && redirects < 3) {
                    let ru = data.redirectURL;
                    const vi = ru.indexOf('&v=');
                    if (vi > -1) ru = ru.substring(0, vi);
                    resp = await fetch(`${ru}&v=${VIDEO_ID}&f=mp3&_=${Date.now()}`, { headers: H, signal: AbortSignal.timeout(30000) });
                    data = await resp.json();
                    console.log(`  redirect: HTTP ${resp.status} → ${new URL(ru).host} | err=${data.error} dl=${data.downloadURL ? new URL(data.downloadURL).host : 'none'}`);
                    redirects++;
                }
                // 5) progress
                if (data.progressURL) {
                    const deadline = Date.now() + 90e3;
                    while (Date.now() < deadline) {
                        const pr = await fetch(`${data.progressURL}&_=${Date.now()}`, { headers: H, signal: AbortSignal.timeout(10000) });
                        if (pr.ok) {
                            const pd = await pr.json();
                            if (Number(pd.progress) >= 3) { data.downloadURL = pd.downloadURL || data.downloadURL; data.title = pd.title || data.title; break; }
                        }
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
                if (data.downloadURL) {
                    console.log('── 5) download ──');
                    const dl = await fetch(`${data.downloadURL}&_=${Date.now()}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
                    const buf = Buffer.from(await dl.arrayBuffer());
                    const isMp3 = buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33;
                    console.log(`  HTTP ${dl.status} ${(buf.length / 1024).toFixed(0)}KB mp3=${isMp3} host=${new URL(data.downloadURL).host} title=${data.title || 'none'}`);
                }
            }
        }
    } catch (e) { console.log(`  ERROR: ${e.message}`); }

    // 6) DNS — هل tubeapi.org على نفس سيرفرات gamma/epsilon؟
    console.log('── 6) DNS ──');
    const dns = await (async () => {
        try {
            const { Resolver } = require('dns').promises;
            const r = new Resolver();
            return await r.resolve4('tubeapi.org').catch(() => 'no-A');
        } catch { return 'dns-err'; }
    })();
    console.log(`  tubeapi.org A: ${JSON.stringify(dns)} (gamma=51.83.116.205, epsilon=51.83.116.215)`);
})();
