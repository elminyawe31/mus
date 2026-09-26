#!/usr/bin/env node
/**
 * probe-ytmp3-v269.js — تشخيص عائلة ytmp3 بعد فشل auth 403 المزدوج
 * يفحص: HTML (نمط apiKey)، ملف JS (نمط endpoint)، ثم auth الفعلي بمفتاح جديد
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const SITES = [
    { name: 'gamma',    site: 'https://ytmp3.gl',        sub: 'gamma',   domain: 'gammacloud.net',   constKey: 'b69e9ac84c9c5f8a9f265c337a9005f3' },
    { name: 'epsilon',  site: 'https://convertytmp3.org', sub: 'epsilon', domain: 'epsiloncloud.org', constKey: 'ea4d4d5ce613226d632d118c74bb85ae' },
];

async function probe(p) {
    console.log(`\n═════════ ${p.name.toUpperCase()} (${p.site}) ═════════`);
    const out = { name: p.name };

    // 1) HTML
    try {
        const r = await fetch(`${p.site}/`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
        out.htmlStatus = r.status;
        const html = await r.text();
        out.htmlLen = html.length;

        // كل الاحتمالات لمفتاح API
        const keyPatterns = [
            /apiKey\s*=\s*'([a-f0-9]{32})'/,
            /apiKey\s*=\s*"([a-f0-9]{32})"/,
            /api[_-]?key['"]\s*[:=]\s*['"]([a-f0-9]{32})['"]/i,
            /['"]([a-f0-9]{32})['"]\s*[,;]/,   // أي hex32 عام
        ];
        out.keyMatches = [];
        for (const pat of keyPatterns) {
            const m = html.match(pat);
            if (m) out.keyMatches.push({ pattern: pat.source, value: m[1] });
        }
        out.keyChanged = out.keyMatches.length > 0 && out.keyMatches[0].value !== p.constKey;

        // ملف JS
        const jsMatch = html.match(/src="(\/js\/\d+\/ytmp3\.js)"/) || html.match(/src="(\/js\/[^"]+\.js)"/);
        out.jsFile = jsMatch ? jsMatch[1] : null;
        if (jsMatch) {
            const jsResp = await fetch(`${p.site}${jsMatch[1]}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
            const js = await jsResp.text();
            out.jsLen = js.length;
            const epMatch = js.match(/endpoint\s*=\s*atob\("([^"]+)"\)/);
            if (epMatch) {
                const decoded = Buffer.from(epMatch[1], 'base64').toString('utf8');
                out.endpointDecoded = decoded;
                const subMatch = js.match(/"https:\/\/([a-z0-9-]+)\."\s*\+\s*endpoint/);
                out.subFromJs = subMatch ? subMatch[1] : null;
                out.apiBase = `https://${out.subFromJs || p.sub}.${decoded}`;
            } else {
                // ابحث عن أي atob أو endpoint بصيغ أخرى
                const atobAll = [...js.matchAll(/atob\("([^"]{8,60})"\)/g)].map(m => {
                    try { return Buffer.from(m[1], 'base64').toString('utf8'); } catch { return null; }
                }).filter(Boolean);
                out.atobValues = atobAll.slice(0, 10);
                out.endpointPatternMissing = true;
            }
        }

        // 2) auth بالمفتاح المكتشف (أو الثابت لو الاكتشاف فشل)
        const key = (out.keyMatches[0] && out.keyMatches[0].value) || p.constKey;
        const base = out.apiBase || `https://${p.sub}.${p.domain}`;
        const authUrl = `${base}/api/v1/auth?api_key=${key}&_=${Date.now()}`;
        console.log(`  [probe] apiBase = ${base}`);
        console.log(`  [probe] apiKey = ${key}${out.keyChanged ? ' (جديد!)' : (out.keyMatches.length ? ' (نفس القديم)' : ' (لم يُكتشف — الثابت)')}`);
        try {
            const ar = await fetch(authUrl, {
                headers: { 'User-Agent': UA, 'Referer': `${p.site}/`, 'Origin': p.site },
                signal: AbortSignal.timeout(15000),
            });
            out.authStatus = ar.status;
            const at = await ar.text();
            out.authBody = at.substring(0, 200);
            console.log(`  [probe] auth → HTTP ${ar.status} | ${at.substring(0, 150)}`);

            if (ar.ok) {
                // 3) init كامل + محاولة تحميل فيديو قصير
                const authData = JSON.parse(at);
                const ir = await fetch(`${base}/api/v1/init?_=${Date.now()}`, {
                    headers: { 'User-Agent': UA, 'Referer': `${p.site}/`, 'Origin': p.site, 'Authorization': `Bearer ${authData.key}` },
                    signal: AbortSignal.timeout(15000),
                });
                out.initStatus = ir.status;
                const it = await ir.text();
                out.initBody = it.substring(0, 200);
                console.log(`  [probe] init → HTTP ${ir.status} | ${it.substring(0, 150)}`);
            }
        } catch (e) {
            out.authError = e.message;
            console.log(`  [probe] auth ERROR: ${e.message}`);
        }
    } catch (e) {
        out.htmlError = e.message;
        console.log(`  [probe] HTML ERROR: ${e.message}`);
    }
    return out;
}

(async () => {
    const results = [];
    for (const p of SITES) results.push(await probe(p));

    // 3) جرّب المفتاح الثابت القديم على القاعدة القديمة أيضاً (لتمييز IP block عن key block)
    console.log(`\n═════════ فحص إضافي: القواعد القديمة بمفاتيح ثابتة ═════════`);
    for (const p of SITES) {
        const base = `https://${p.sub}.${p.domain}`;
        try {
            const ar = await fetch(`${base}/api/v1/auth?api_key=${p.constKey}&_=${Date.now()}`, {
                headers: { 'User-Agent': UA, 'Referer': `${p.site}/`, 'Origin': p.site },
                signal: AbortSignal.timeout(15000),
            });
            console.log(`  ${p.name}: const-key on ${base} → HTTP ${ar.status} | ${(await ar.text()).substring(0, 100)}`);
        } catch (e) {
            console.log(`  ${p.name}: const-key on ${base} → ERROR ${e.message}`);
        }
    }

    console.log(`\n═════════ ملخص JSON ═════════`);
    console.log(JSON.stringify(results, null, 2).substring(0, 4000));
})();
