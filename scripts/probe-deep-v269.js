#!/usr/bin/env node
/**
 * probe-deep-v269.js — تحليل عميق للمواقع الشقيقة الجديدة
 * الهدف: استخراج endpointsها الفعلية ومعرفة هل backends مختلفة عن gamma/epsilon
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function deepCheck(base) {
    console.log(`\n═════════ ${base} ═════════`);
    try {
        const r = await fetch(`${base}/`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
        const html = await r.text();

        // كل ملفات JS المشار إليها
        const jsFiles = [...new Set([...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map(m => m[1]))].slice(0, 8);
        console.log(`  JS files: ${jsFiles.join(' | ')}`);

        // ابحث عن بصمات API مباشرة في HTML
        const keyM = html.match(/apiKey\s*=\s*['"]([a-f0-9]{32})['"]/);
        if (keyM) console.log(`  apiKey: ${keyM[1]}`);
        const inlineEp = html.match(/(?:endpoint|apiBase|apiUrl|api_base)\s*[:=]\s*['"]([^'"]+)['"]/i);
        if (inlineEp) console.log(`  inline endpoint: ${inlineEp[1]}`);
        const atobInline = [...html.matchAll(/atob\(["']([A-Za-z0-9+/=]{8,80})["']\)/g)].map(m => {
            try { return Buffer.from(m[1], 'base64').toString('utf8'); } catch { return null; }
        }).filter(Boolean);
        if (atobInline.length) console.log(`  inline atob: ${atobInline.join(' | ')}`);

        // فحص أهم 3 ملفات JS
        for (const jf of jsFiles.slice(0, 3)) {
            const url = jf.startsWith('http') ? jf : `${base}${jf}`;
            try {
                const jr = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
                const js = await jr.text();
                const hits = [];
                // بصمات متعددة
                const epM = js.match(/endpoint\s*=\s*atob\(["']([^"']+)["']\)/);
                if (epM) hits.push(`endpoint=${Buffer.from(epM[1], 'base64').toString('utf8')}`);
                const keyM2 = js.match(/apiKey\s*=\s*['"]([a-f0-9]{32})['"]/);
                if (keyM2) hits.push(`apiKey=${keyM2[1]}`);
                for (const pat of [
                    /["'](https?:\/\/[a-z0-9-]+\.[a-z]+\.(?:net|org|com|xyz|io))\/api\/v1\/(?:auth|convert)["']/i,
                    /["'](https?:\/\/[a-z0-9-]+\.cloud[a-z]*\.[a-z]+)["']/i,
                ]) {
                    const m = js.match(pat);
                    if (m) hits.push(`apiBase=${m[1]}`);
                }
                const atobAll = [...js.matchAll(/atob\(["']([^"']{8,80})["']\)/g)].map(m => {
                    try { return Buffer.from(m[1], 'base64').toString('utf8'); } catch { return null; }
                }).filter(v => v && v.includes('.'));
                if (atobAll.length) hits.push(`atob=[${atobAll.join(', ')}]`);
                if (hits.length) console.log(`  └─ ${jf}: ${hits.join('  ')}`);
            } catch (e) { console.log(`  └─ ${jf}: ERR ${e.message.substring(0, 50)}`); }
        }
    } catch (e) {
        console.log(`  ERROR: ${e.message}`);
    }
}

(async () => {
    for (const site of ['https://ytmp3.cc', 'https://ytmp3.nu', 'https://ytmp3.space', 'https://ytmp3.world', 'https://ytconvert.org', 'https://ytmp3.fun']) {
        await deepCheck(site);
    }
})();
