#!/usr/bin/env node
/**
 * probe-altbackends-v269.js — فحص بنى خلفية بديلة مستقلة كلياً عن gammacloud/epsiloncloud
 * 1) Invidious instances: /latest_version?id=X&itag=140&local=true (proxy صوت عبر السيرفر)
 * 2) Piped instances: /streams/{id} → proxied audio
 * 3) cobalt community instances
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const VIDEO_ID = '15VrKkUkcPw'; // Wegz - LAQTTA (نفس فيديو المستخدم)

const INVIDIOUS = [
    'https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yewtu.be',
    'https://invidious.f5.si', 'https://invidious.jing.rocks', 'https://iv.melmac.space',
    'https://invidious.privacyredirect.com', 'https://inv.tux.pizza', 'https://invidious.materialio.us',
    'https://id.420129.xyz', 'https://invidious.reallyaweso.me', 'https://invidious.einfachzocken.eu',
];
const PIPED = [
    'https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://api.piped.private.coffee',
    'https://pipedapi.darkness.services', 'https://pipedapi.drgns.space', 'https://api.piped.yt',
];

function isAudio(buf) {
    if (!buf || buf.length < 16) return false;
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
    if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return true;
    // m4a: ftyp box
    if (buf.subarray(4, 8).toString('ascii') === 'ftyp') return true;
    return false;
}

(async () => {
    console.log('═══ 1) Invidious (itag=140 m4a عبر local=true) ═══');
    for (const inst of INVIDIOUS) {
        const url = `${inst}/latest_version?id=${VIDEO_ID}&itag=140&local=true`;
        try {
            const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000), redirect: 'follow' });
            if (r.status === 200) {
                const buf = Buffer.from(await r.arrayBuffer());
                console.log(`  ${r.status === 200 && isAudio(buf) ? '✅' : '❓'} ${inst.padEnd(45)} HTTP ${r.status} ${(buf.length / 1024).toFixed(0)}KB audio=${isAudio(buf)} final=${new URL(r.url).host}`);
            } else {
                const body = (await r.text()).substring(0, 50).replace(/\n/g, ' ');
                console.log(`  ❌ ${inst.padEnd(45)} HTTP ${r.status} ${body}`);
            }
        } catch (e) { console.log(`  💀 ${inst.padEnd(45)} ${e.message.substring(0, 50)}`); }
    }

    console.log('═══ 2) Piped (/streams/{id}) ═══');
    for (const inst of PIPED) {
        try {
            const r = await fetch(`${inst}/streams/${VIDEO_ID}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
            if (r.ok) {
                const d = await r.json();
                const audio = (d.audioStreams || []).filter(a => /m4a|mp3/.test(a.mimeType || a.mime || ''));
                const proxied = audio.filter(a => (a.url || '').includes(inst.replace('https://', '')) || a.audioStreams);
                console.log(`  ✅ ${inst.padEnd(42)} title="${(d.title || '').substring(0, 35)}" audioStreams=${audio.length} first=${audio[0] ? new URL(audio[0].url).host.substring(0, 40) : 'none'}`);
            } else {
                console.log(`  ❌ ${inst.padEnd(42)} HTTP ${r.status}`);
            }
        } catch (e) { console.log(`  💀 ${inst.padEnd(42)} ${e.message.substring(0, 50)}`); }
    }
})();
