#!/usr/bin/env node
/**
 * probe-rotate-v269.js — هل الـ subdomains الدوّارة (c/o mix) تخدم auth+init?
 * إن كان أحدها يخدم init بدون حظر → البوت يقدر يتخطى gamma. المحظور كلياً
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const KEY = 'b69e9ac84c9c5f8a9f265c337a9005f3';
const STATIC_SESSION = 'CimtTPu5Yjqgg8Ta';

// كل الـ subdomains المرصودة + تباديل منطقية (c/o mix بطول 6)
const SUBS = [
    'gamma', 'ccoooo', 'ocoooo', 'occooo', 'ooccco', 'cocooc', 'occcco', 'coocco',
    'occoco', 'cococo', 'oooooc', 'ccocoo', 'oococc', 'coococ',
];

async function trySub(sub) {
    const base = `https://${sub}.gammacloud.net`;
    const out = { sub };
    try {
        // 1) auth
        const ar = await fetch(`${base}/api/v1/auth?api_key=${KEY}&_=${Date.now()}`, {
            headers: { 'User-Agent': UA, 'Referer': 'https://ytmp3.gl/', 'Origin': 'https://ytmp3.gl' },
            signal: AbortSignal.timeout(8000),
        });
        out.auth = ar.status;
        // 2) init (بالمفتاح الثابت) — حتى لو auth 404 (الطريق الوحيد المهم)
        const ir = await fetch(`${base}/api/v1/init?_=${Date.now()}`, {
            headers: {
                'User-Agent': UA, 'Referer': 'https://ytmp3.gl/', 'Origin': 'https://ytmp3.gl',
                'Authorization': `Bearer ${STATIC_SESSION}`,
            },
            signal: AbortSignal.timeout(8000),
        });
        out.init = ir.status;
        if (ir.ok) {
            const d = await ir.json();
            out.initErr = d.error;
            out.convertHost = d.convertURL ? new URL(d.convertURL).host : null;
        }
    } catch (e) { out.err = e.message.substring(0, 40); }
    return out;
}

(async () => {
    const results = [];
    // على دفعات لتجنب الـ rate limit
    for (let i = 0; i < SUBS.length; i += 5) {
        const batch = await Promise.all(SUBS.slice(i, i + 5).map(trySub));
        results.push(...batch);
        await new Promise(r => setTimeout(r, 300));
    }
    for (const r of results) {
        const authTag = r.auth === 200 ? 'auth✅' : (r.auth ? `auth:${r.auth}` : 'auth:ERR');
        const initTag = r.init === 200 ? 'init✅' : (r.init ? `init:${r.init}` : 'init:ERR');
        const conv = r.convertHost ? ` → convert=${r.convertHost}` : '';
        console.log(`${r.sub.padEnd(9)} ${authTag.padEnd(9)} ${initTag}${conv}${r.err ? ' err=' + r.err : ''}`);
    }
})();
