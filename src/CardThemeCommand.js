// ═══════════════════════════════════════════════════════════════════════════
//  src/CardThemeCommand.js — منطق مشترك لأمرين /lite و /dark (v26.10)
//  MUS Bot v26.10 — Dev: ELMINYAWE 👨‍💻
//  ─────────────────────────────────────────────────────────────────────────
//  ✅ يغيّر ثيم كارت الأغنية لكل سيرفر (فاتح/داكن) ويحفظه دائماً
//  ✅ يعمل بثلاث طرق: slash (/lite أو /dark) + prefix (!lite) + noprefix (lite)
//  ✅ يرسل معاينة حقيقية للكارت بالثيم الجديد (الأغنية الحالية أو ديمو)
// ═══════════════════════════════════════════════════════════════════════════
const { EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const SettingsStore = require('./SettingsStore');

let MusicCard = null;
function getMusicCard() {
    if (!MusicCard) MusicCard = require('./MusicCard');
    return MusicCard;
}

const THEME_META = {
    'ease': { name: 'Lite', emoji: '☀️', desc: 'Light mode', other: { cmd: 'dark', name: 'Dark' } },
    'ease-dark': { name: 'Dark', emoji: '🌙', desc: 'Dark mode', other: { cmd: 'lite', name: 'Lite' } },
};

/** توليد معاينة الكارت بالثيم الجديد — الأغنية الحالية إن وجدت، وإلا ديمو */
async function buildPreview(client, guildId, themeName) {
    try {
        const Music = getMusicCard();
        const player = client.players?.get(guildId);
        let track = player?.currentTrack || null;
        let position = 0;
        let requesterName = '—';
        if (player && track) {
            position = player.getCurrentTime ? player.getCurrentTime() : (player.currentTime || 0);
            requesterName = track.requester?.username || track.requester?.displayName || '—';
        } else {
            // ديمو — غلاف بديل داعم للثيمين (بلا شبكة)
            track = {
                title: client.user?.username || 'MUS Bot',
                artist: THEME_META[themeName].name + ' Theme Preview',
                duration: 120,
                thumbnail: null, // بلا غلاف → placeholder أنيق مرسوم محلياً
            };
        }
        const buf = await Music.generateMusicCard(track, { volume: player?.volume ?? 100, guild: { id: guildId } }, position, {
            requesterName,
            developer: config.info.developer,
            guildId,
        });
        return buf;
    } catch (e) {
        return null;
    }
}

/** تنفيذ موحّد — يستدعيه slash وprefix لكلا الأمرين */
async function applyTheme(themeName, { guild, user, client, reply }) {
    const meta = THEME_META[themeName];
    const Music = getMusicCard();

    // 1) طبّق في الذاكرة (فوراً — الكارت القادم سيستخدمه)
    Music.setGuildTheme(guild.id, themeName);

    // 2) احفظ دائماً على القرص (يُستعاد بعد إعادة التشغيل)
    const persisted = SettingsStore.setCardTheme(guild.id, themeName);

    // 3) معاينة حية
    const preview = await buildPreview(client, guild.id, themeName);

    const embed = new EmbedBuilder()
        .setColor(themeName === 'ease' ? '#F9F7F2' : '#0B0B10')
        .setTitle(`${meta.emoji} Card Theme: ${meta.name}`)
        .setDescription(
            `تم تفعيل ثيم **${meta.name}** لكارت الأغنية في هذا السيرفر.\n` +
            `سيُطبَّق على الأغنية التالية فوراً (والحالية عند تحديثها).\n\n` +
            `للتبديل: \`/${meta.other.cmd}\` أو \`!${meta.other.cmd}\``
        )
        .setFooter({ text: config.bot.signature + (persisted ? ' — محفوظ دائماً' : '') })
        .setTimestamp();

    if (preview) {
        const attachment = new AttachmentBuilder(preview, { name: `theme-${meta.name.toLowerCase()}.png` });
        embed.setImage(`attachment://theme-${meta.name.toLowerCase()}.png`);
        return reply({ embeds: [embed], files: [attachment] });
    }
    return reply({ embeds: [embed] });
}

/** فحص صلاحية ManageGuild موحّد */
function hasPermission(member) {
    try {
        return member.permissions.has(PermissionFlagsBits.ManageGuild);
    } catch (e) {
        return false;
    }
}

const NO_PERM_TEXT = '❌ تحتاج صلاحية **Manage Server** لتغيير ثيم الكارت.';

module.exports = { applyTheme, hasPermission, NO_PERM_TEXT, THEME_META };
