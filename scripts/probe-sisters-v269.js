#!/usr/bin/env node
/**
 * probe-sisters-v269.js — فحص مواقع محولات مرشحة بحثاً عن نفس الـ backend الأبيض
 * البصمة: HTML فيه apiKey='hex32' + JS فيه endpoint=atob("...")
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const CANDIDATES = [
    'https://ytmp3.gl', 'https://convertytmp3.org',
    'https://cnvmp3.com', 'https://ezmp3.cc', 'https://ytmp3.to',
    'https://ytmp3.cc', 'https://ytmp3.im', 'https://ytmp3.buzz',
    'https://ytmp3.space', 'https://ytmp3.nu', 'https://ytmp3.eu',
    'https://ytmp3.world', 'https://yt2mp3.org', 'https://onlymp3.to',
    'https://ytmp3.mobi', 'https://ytconvert.org', 'https://mp3youtube.cc',
    'https://320ytmp3.com', 'https://ytmp3converter.com', 'https://ytmp3x.com',
    'https://ytmp3.live', 'https://ytmp3.is', 'https://yt.mp3', 'https://ytmp3.fun',
];

async function checkSite(base) {
    const host = base.replace(/^https?:\/\//, '');
    try {
        const r = await fetch(`${base}/`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000), redirect: 'follow' });
        const html = await r.text();
        const res = { host, status: r.status, len: html.length, family: null, apiKey: null, endpoint: null, notes: [] };

        const keyM = html.match(/apiKey\s*=\s*['"]([a-f0-9]{32})['"]/);
        if (keyM) { res.family = 'ytmp3-white-label'; res.apiKey = keyM[1]; }

        // أي ملف JS يبدو مخصصاً؟
        const jsM = html.match(/src="(\/js\/[^"]+\.js)"/);
        if (jsM && !res.family) res.notes.push(`js:${jsM[1]}`);
        if (res.family && jsM) {
            try {
                const jr = await fetch(`${base}${jsM[1]}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
                const js = await jr.text();
                const epM = js.match(/endpoint\s*=\s*atob\("([^"]+)"\)/);
                if (epM) res.endpoint = Buffer.from(epM[1], 'base64').toString('utf8');
            } catch {}
        }
        // بصمات backends أخرى معروفة
        if (/cnvmp3|ezmp3/i.test(html) && !res.family) res.notes.push('custom-api');
        if (html.includes('y2mate')) res.notes.push('y2mate-family');
        return res;
    } catch (e) {
        return { host, error: e.message.substring(0, 60) };
    }
}

(async () => {
    const results = await Promise.all(CANDIDATES.map(checkSite));
    for (const r of results) {
        if (r.error) { console.log(`💀 ${r.host.padEnd(28)} ${r.error}`); continue; }
        if (r.family) console.log(`🎯 ${r.host.padEnd(28)} SAME-FAMILY key=${r.apiKey} endpoint=${r.endpoint}`);
        else console.log(`·  ${r.host.padEnd(28)} HTTP ${r.status} len=${r.len} ${r.notes.join(',')}`);
    }
})();
