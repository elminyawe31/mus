// ═══════════════════════════════════════════════════════════════════════════
//  src/GiveawaysManager.js — سحبات محفوظة على القرص + أرشيف + إعادة جدولة
//  MUS Bot v26.4 — Dev: ELMINYAWE 👨‍💻
//  ─────────────────────────────────────────────────────────────────────────
//  ✅ يحل مشاكل السحبات:
//    1. كانت في global.giveaways (ذاكرة فقط) — أي إعادة تشغيل تجعل كل
//       السحبات الجارية "يتيمة": الأزرار موجودة لكنها تقول "منتهية".
//       الآن: تُحفظ في database/giveaways.json وتُستعاد وتُعاد جدولتها.
//    2. greroll كان عديم الفائدة عملياً: بعد نهاية السحبة تُحذف البيانات
//       فوراً. الآن: السحبات المنتهية تُؤرشف (آخر 50) وgreroll يقرأ الأرشيف.
//    3. انتهت السحبة أثناء البوت مطفأ؟ تُنهى تلقائياً عند الإقلاع.
//  ✅ global.giveaways يبقى نفس الـ Map (توافق 100% مع الكود القديم).
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');

const ACTIVE_FILE = path.join(__dirname, '..', 'database', 'giveaways.json');
const ARCHIVE_FILE = path.join(__dirname, '..', 'database', 'giveawaysArchive.json');
const SAVE_DEBOUNCE_MS = 2000;
const MAX_ARCHIVED = 50;           // آخر 50 سحبة منتهية فقط
const MAX_ACTIVE = 100;            // حد أقصى للسحبات الجارية

class GiveawaysManager {
    constructor() {
        this._saveTimer = null;
        this._writing = false;
        this._endTimers = new Map();  // messageId → setTimeout

        // ✅ نفس الـ Map الذي يستخدمه الكود القديم (gstart/gend/greroll/index.js)
        if (!global.giveaways) global.giveaways = new Map();

        this._ensureFiles();
    }

    _ensureFiles() {
        try {
            const dir = path.dirname(ACTIVE_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(ACTIVE_FILE)) {
                fs.writeFileSync(ACTIVE_FILE, JSON.stringify({ giveaways: {}, updatedAt: 0 }, null, 2), 'utf8');
            }
            if (!fs.existsSync(ARCHIVE_FILE)) {
                fs.writeFileSync(ARCHIVE_FILE, JSON.stringify({ archived: {}, updatedAt: 0 }, null, 2), 'utf8');
            }
        } catch (e) {
            console.error('❌ GiveawaysManager: فشل تهيئة الملفات:', e.message);
        }
    }

    _readJson(file, key) {
        try {
            const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
            return (raw && raw[key] && typeof raw[key] === 'object') ? raw[key] : {};
        } catch (e) {
            return {};
        }
    }

    _atomicWrite(file, data) {
        try {
            const tmp = file + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
            fs.renameSync(tmp, file);
        } catch (e) {
            console.error('❌ GiveawaysManager: فشل الحفظ:', e.message);
        }
    }

    // ── تسجيل سحبة جديدة (يستدعيه gstart بعد إرسال الرسالة) ─────────────
    register(giveawayData) {
        global.giveaways.set(giveawayData.messageId, giveawayData);
        this._persistActive();
    }

    // ── جدولة النهاية (تحل محل setTimeout المباشر في gstart) ─────────────
    scheduleEnd(client, messageId, endTime, endGiveawayFn) {
        // ألغِ أي مؤقت سابق لنفس السحبة (إعادة جدولة آمنة)
        const prev = this._endTimers.get(messageId);
        if (prev) clearTimeout(prev);

        const delay = Math.max(0, endTime - Date.now());
        // حماية من فيض setTimeout (أقصى 2^31-1 ms ≈ 24.8 يوم)
        const safeDelay = Math.min(delay, 2147483000);
        const timer = setTimeout(async () => {
            this._endTimers.delete(messageId);
            try {
                await endGiveawayFn(client, messageId);
            } catch (e) { /* تجاهل */ }
        }, safeDelay);
        timer.unref?.(); // لا يمنع إيقاف العملية عند الـ shutdown
        this._endTimers.set(messageId, timer);
    }

    // ── استدعاء عند انتهاء سحبة: أرشفة + إزالة من الجارية ───────────────
    onEnded(messageId) {
        const giveaway = global.giveaways.get(messageId);
        if (giveaway) {
            // أرشِف مع المشاركين حتى يعمل greroll بعد النهاية
            try {
                const archived = this._readJson(ARCHIVE_FILE, 'archived');
                archived[messageId] = {
                    messageId,
                    channelId: giveaway.channelId,
                    guildId: giveaway.guildId,
                    prize: giveaway.prize,
                    winnersCount: giveaway.winnersCount,
                    endTime: giveaway.endTime,
                    hostId: giveaway.hostId,
                    participants: Array.from(giveaway.participants || []),
                    endedAt: Date.now(),
                };
                // احتفظ بآخر MAX_ARCHIVED فقط
                const entries = Object.values(archived).sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
                const trimmed = {};
                entries.slice(0, MAX_ARCHIVED).forEach(e => { trimmed[e.messageId] = e; });
                this._atomicWrite(ARCHIVE_FILE, { archived: trimmed, updatedAt: Date.now() });
            } catch (e) { /* ignore */ }
        }

        const timer = this._endTimers.get(messageId);
        if (timer) { clearTimeout(timer); this._endTimers.delete(messageId); }

        global.giveaways.delete(messageId);
        this._persistActive();
    }

    // ── قراءة سحبة منتهية من الأرشيف (لاستخدام greroll) ──────────────────
    getArchived(messageId) {
        const archived = this._readJson(ARCHIVE_FILE, 'archived');
        return archived[messageId] || null;
    }

    _persistActive() {
        if (this._writing) return;
        this._writing = true;
        try {
            const giveaways = {};
            let count = 0;
            for (const [id, g] of global.giveaways) {
                if (count >= MAX_ACTIVE) break;
                giveaways[id] = {
                    messageId: g.messageId,
                    channelId: g.channelId,
                    guildId: g.guildId,
                    prize: g.prize,
                    winnersCount: g.winnersCount,
                    endTime: g.endTime,
                    hostId: g.hostId,
                    participants: Array.from(g.participants || []),
                };
                count++;
            }
            this._atomicWrite(ACTIVE_FILE, { giveaways, updatedAt: Date.now() });
        } finally {
            this._writing = false;
        }
    }

    // ── استعادة السحبات الجارية عند الإقلاع + إعادة جدولتها ──────────────
    //    يُستدعى بعد جاهزية البوت (clientReady). السحبة التي انتهت أثناء
    //    الإطفاء تُنهى فوراً (يعلن الفائزين كما لو انتهت في وقتها).
    restore(client, endGiveawayFn) {
        try {
            const saved = this._readJson(ACTIVE_FILE, 'giveaways');
            let restored = 0, endedNow = 0;

            for (const [id, g] of Object.entries(saved)) {
                if (!g || !g.messageId || !g.channelId) continue;

                const giveawayData = {
                    messageId: g.messageId,
                    channelId: g.channelId,
                    guildId: g.guildId,
                    prize: g.prize || 'Prize',
                    winnersCount: Math.max(1, Number(g.winnersCount) || 1),
                    endTime: Number(g.endTime) || 0,
                    hostId: g.hostId,
                    participants: new Set(Array.isArray(g.participants) ? g.participants : []),
                };
                global.giveaways.set(id, giveawayData);

                if (giveawayData.endTime > Date.now()) {
                    this.scheduleEnd(client, id, giveawayData.endTime, endGiveawayFn);
                    restored++;
                } else {
                    // انتهت أثناء الإطفاء — أنهِها الآن
                    this.scheduleEnd(client, id, Date.now(), endGiveawayFn);
                    endedNow++;
                }
            }

            if (restored + endedNow > 0) {
                console.log(`🎉 GiveawaysManager: استعادة ${restored} سحبة جارية + إنهاء ${endedNow} سحبة انتهت أثناء التوقف`);
            }
            this._persistActive();
        } catch (e) {
            console.error('❌ GiveawaysManager: فشل الاستعادة:', e.message);
        }
    }

    // ── حفظ فوري عند إيقاف التشغيل ──────────────────────────────────────
    persistNow() {
        if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
        for (const [, timer] of this._endTimers) clearTimeout(timer);
        this._endTimers.clear();
        this._persistActive();
    }
}

// Singleton
module.exports = new GiveawaysManager();
