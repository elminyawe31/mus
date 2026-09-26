#!/usr/bin/env node
/**
 * probe-subdomains-v269.js — هل auth يعمل على الـ subdomains البديلة؟
 * gamma.gammacloud.net محظور من Railway — لكن ربما oocccc/ooccco غير محظورة!
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const TESTS = [
    // gamma family — جرّب auth على كل الـ subdomains المعروفة
    { label: 'gamma-auth-main',    url: 'https://gamma.gammacloud.net/api/v1/auth?api_key=b69e9ac84c9c5f8a9f265c337a9005f3' },
    { label: 'gamma-auth-ooccco',  url: 'https://ooccco.gammacloud.net/api/v1/auth?api_key=b69e9ac84c9c5f8a9f265c337a9005f3' },
    { label: 'gamma-auth-www',     url: 'https://www.gammacloud.net/api/v1/auth?api_key=b69e9ac84c9c5f8a9f265c337a9005f3' },
    { label: 'gamma-auth-api',     url: 'https://api.gammacloud.net/api/v1/auth?api_key=b69e9ac84c9c5f8a9f265c337a9005f3' },
    // epsilon family
    { label: 'epsilon-auth-main',  url: 'https://epsilon.epsiloncloud.org/api/v1/auth?api_key=ea4d4d5ce613226d632d118c74bb85ae' },
    { label: 'epsilon-auth-cocooc',url: 'https://cocooc.epsiloncloud.org/api/v1/auth?api_key=ea4d4d5ce613226d632d118c74bb85ae' },
    { label: 'epsilon-auth-www',   url: 'https://www.epsiloncloud.org/api/v1/auth?api_key=ea4d4d5ce613226d632d118c74bb85ae' },
    // جرّب أيضاً: مفاتيح متبادلة (مفتاح gamma على epsilon والعكس — هل المفاتيح عالمية؟)
    { label: 'cross-key-eps-on-gamma', url: 'https://gamma.gammacloud.net/api/v1/auth?api_key=ea4d4d5ce613226d632d118c74bb85ae' },
    { label: 'cross-key-gamma-on-eps', url: 'https://epsilon.epsiloncloud.org/api/v1/auth?api_key=b69e9ac84c9c5f8a9f265c337a9005f3' },
];

(async () => {
    for (const t of TESTS) {
        const t0 = Date.now();
        try {
            const r = await fetch(`${t.url}&_=${Date.now()}`, {
                headers: { 'User-Agent': UA, 'Referer': 'https://ytmp3.gl/', 'Origin': 'https://ytmp3.gl' },
                signal: AbortSignal.timeout(12000),
            });
            const body = await r.text();
            const ok = r.status === 200 && body.includes('"err":0');
            console.log(`${ok ? '✅' : '❌'} ${t.label.padEnd(26)} HTTP ${r.status} ${Date.now() - t0}ms | ${body.substring(0, 70).replace(/\n/g, '')}`);
        } catch (e) {
            console.log(`💀 ${t.label.padEnd(26)} ${Date.now() - t0}ms ${e.message.substring(0, 60)}`);
        }
    }
})();
