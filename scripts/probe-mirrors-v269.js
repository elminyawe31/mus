#!/usr/bin/env node
/**
 * probe-mirrors-v269.js — قراءة كاملة لملفات JS للمرايا ومقارنتها بالأصل
 * هل ytmp3.cc / ytmp3.nu يستخدمان backends مختلفة؟
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const FILES = [
    { label: 'ytmp3.gl (gamma الأصل)',       url: 'https://ytmp3.gl/js/1790440776/ytmp3.js' },
    { label: 'ytmp3.nu (مرآة gamma)',         url: 'https://ytmp3.nu/js/1790440776/ytmp3.js' },
    { label: 'convertytmp3.org (epsilon الأصل)', url: 'https://convertytmp3.org/js/1790421862/ytmp3.js' },
    { label: 'ytmp3.cc (مرآة epsilon)',       url: 'https://ytmp3.cc/js/1790421862/ytmp3.js' },
];

(async () => {
    const contents = {};
    for (const f of FILES) {
        try {
            const r = await fetch(f.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
            const js = await r.text();
            contents[f.label] = js;
            console.log(`\n═══ ${f.label} — HTTP ${r.status}، ${js.length} بايت ═══`);

            // كل atob المشفرة
            const atobs = [...js.matchAll(/atob\(["']([^"']+)["']\)/g)].map(m => {
                try { return { enc: m[1], dec: Buffer.from(m[1], 'base64').toString('utf8') }; } catch { return null; }
            }).filter(Boolean);
            atobs.forEach(a => console.log(`  atob: ${a.enc} → ${a.dec}`));

            // كل النطاقات المذكورة
            const domains = [...new Set([...js.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map(m => m[1]))];
            console.log(`  domains: ${domains.join(', ')}`);

            // أي مفاتيح
            const keys = [...js.matchAll(/apiKey\s*=\s*['"]([a-f0-9]{32})['"]/g)].map(m => m[1]);
            console.log(`  apiKey: ${keys.join(', ')}`);
        } catch (e) {
            console.log(`\n═══ ${f.label} — ERROR: ${e.message} ═══`);
        }
    }

    // مقارنة
    const labels = Object.keys(contents);
    if (labels.length >= 2) {
        console.log(`\n═══ مقارنات ═══`);
        for (let i = 0; i < labels.length; i++) {
            for (let j = i + 1; j < labels.length; j++) {
                const same = contents[labels[i]] === contents[labels[j]];
                console.log(`  ${labels[i]} vs ${labels[j]}: ${same ? '🟩 متطابقان حرفياً' : '🟥 مختلفان'}`);
            }
        }
    }
})();
