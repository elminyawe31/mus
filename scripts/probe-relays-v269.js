#!/usr/bin/env node
/**
 * probe-relays-v269.js — اختبار قنوات relay مجانية ضد API عائلة ytmp3
 * الهدف: إيجاد relay يمرر auth/init بنجاح (لأن Railway محظور مباشرة)
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const TARGETS = [
    { name: 'gamma',   url: 'https://gamma.gammacloud.net/api/v1/auth?api_key=b69e9ac84c9c5f8a9f265c337a9005f3' },
    { name: 'epsilon', url: 'https://epsilon.epsiloncloud.org/api/v1/auth?api_key=ea4d4d5ce613226d632d118c74bb85ae' },
];

const RELAYS = [
    { name: 'corsproxy.io',      wrap: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}` },
    { name: 'allorigins-raw',    wrap: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
    { name: 'codetabs',          wrap: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
    { name: 'corsproxy.io (json)', wrap: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}` },
    { name: 'allorigins-get',    wrap: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}` },
    { name: 'whateverorigin',    wrap: (u) => `http://www.whateverorigin.org/get?url=${encodeURIComponent(u)}` },
    { name: 'thingproxy',        wrap: (u) => `https://thingproxy.freeboard.io/fetch/${u}` },
];

(async () => {
    // اختبار relay واحد (corsproxy) ضد gamma فقط للتقييم السريع
    const target = TARGETS[0];

    for (const relay of RELAYS) {
        const url = relay.wrap(target.url);
        const t0 = Date.now();
        try {
            const r = await fetch(url, {
                headers: { 'User-Agent': UA },
                signal: AbortSignal.timeout(20000),
            });
            const body = await r.text();
            const ms = Date.now() - t0;
            const isJson = body.includes('"err"') || body.includes('"key"');
            const looksAuth = body.includes('"err":0') || body.includes('"key"');
            console.log(`${looksAuth ? '✅' : '❌'} ${relay.name.padEnd(24)} HTTP ${r.status} ${ms}ms ${String(r.headers.get('content-type')||'').substring(0,30)} | ${body.substring(0, 90).replace(/\n/g, ' ')}`);
        } catch (e) {
            console.log(`❌ ${relay.name.padEnd(24)} ERROR ${Date.now() - t0}ms: ${e.message.substring(0, 80)}`);
        }
    }

    // الأفضل يعمل؟ اختبر كل الأهداف عبر أفضل relay
    console.log(`\n═══ corsproxy.io على كل الأهداف ═══`);
    for (const t of TARGETS) {
        try {
            const r = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(t.url)}`, {
                headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000),
            });
            console.log(`${t.name}: HTTP ${r.status} | ${(await r.text()).substring(0, 100)}`);
        } catch (e) {
            console.log(`${t.name}: ERROR ${e.message.substring(0, 80)}`);
        }
    }
})();
