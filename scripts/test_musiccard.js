// scripts/test_musiccard.js — يختبر توليد NowPlaying card و يحفظها كملف PNG
// استخدم: node scripts/test_musiccard.js
const path = require('path');
const fs = require('fs');

// تأكد أن @napi-rs/canvas متاح (محلياً قد لا يكون — سنحاول)
let MusicCard;
try {
    MusicCard = require('../src/MusicCard');
} catch (e) {
    console.error('❌ Cannot load MusicCard:', e.message);
    process.exit(1);
}

async function main() {
    console.log('🎨 MusicCard ready?', MusicCard.isReady());
    if (!MusicCard.isReady()) {
        console.error('❌ Canvas not ready');
        process.exit(1);
    }

    // محاكاة track
    const track = {
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/maxresdefault.jpg',
        duration: 200, // seconds
        platform: 'youtube',
        url: 'https://youtube.com/watch?v=4NRXx6U8ABQ',
    };

    // محاكاة player
    const player = {
        paused: false,
        loop: 'track',
        volume: 70,
    };

    const position = 70 * 1000; // 1:10

    console.log('🎨 Generating card...');
    try {
        const buf = await MusicCard.generateMusicCard(track, player, position, {
            requesterName: 'ELMINYAWE',
            developer: 'ELMINYAWE',
        });

        if (!buf || buf.length === 0) {
            console.error('❌ Generated buffer is empty');
            process.exit(1);
        }

        const outPath = path.join(__dirname, '..', 'test_card.png');
        fs.writeFileSync(outPath, buf);
        console.log(`✅ Card generated: ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
    } catch (e) {
        console.error('❌ Generation failed:', e.message);
        process.exit(1);
    }
}

main();
