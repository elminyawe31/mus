// ═══════════════════════════════════════════════════════════════════════════
//  src/LikedSongsManager.js — إدارة الأغاني المفضلة (محفوظة على القرص)
//  MUS Bot v26.3 — Dev: ELMINYAWE 👨‍💻
//  ─────────────────────────────────────────────────────────────────────────
//  ✅ يحل مشاكل التضارب في القيم:
//    1. المفضلة كانت في الذاكرة فقط (global.likedSongs) وتضيع عند إعادة
//       التشغيل — الآن تُحفظ في database/likedSongs.json وتُستعاد تلقائياً.
//    2. الترقيم موحّد في كل الأوامر (showliked / unlike / playliked):
//       الموقع #1 = الأحدث إعجاباً (نفس ترتيب العرض في showliked).
//    3. الكتابة على القرص ذرّية (tmp + rename) وآمنة مع الشاردات
//       (دمج بأحدث نسخة لكل مستخدم قبل الحفظ).
//  ✅ متوافق 100% مع الكود القديم: global.likedSongs يبقى نفس الـ Map
//    (profile.js وأي كود آخر يقرأ منه مباشرة يعمل بدون تغيير).
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');

const DB_FILE_PATH = path.join(__dirname, '..', 'database', 'likedSongs.json');
const MAX_LIKES_PER_USER = 500;   // حد أقصى لكل مستخدم (يمنع تضخم الملف)
const MAX_USERS = 50000;          // حد أقصى لعدد المستخدمين المحفوظين
const SAVE_DEBOUNCE_MS = 3000;    // حفظ مؤجل 3 ثوانٍ بعد آخر تغيير
const PAGE_SIZE = 10;             // عدد الأغاني في صفحة showliked

class LikedSongsManager {
    constructor() {
        this.filePath = DB_FILE_PATH;
        this._saveTimer = null;
        this._saving = false;

        // ✅ global.likedSongs يبقى المصدر الوحيد للحقيقة (نفس Map القديم)
        if (!global.likedSongs) global.likedSongs = new Map();

        this._ensureFileExists();
        this.load();
    }

    // ── تهيئة ملف قاعدة البيانات ─────────────────────────────────────
    _ensureFileExists() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(this.filePath)) {
                fs.writeFileSync(this.filePath, JSON.stringify({ users: {}, updatedAt: 0 }, null, 2), 'utf8');
            }
        } catch (e) {
            console.error('❌ LikedSongsManager: فشل تهيئة الملف:', e.message);
        }
    }

    // ── تحميل المفضلة من القرص إلى الذاكرة ───────────────────────────
    load() {
        try {
            const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            const users = raw?.users || {};
            let count = 0;
            for (const [userId, tracks] of Object.entries(users)) {
                if (!Array.isArray(tracks)) continue;
                // تخطَّ أي مدخلات فاسدة
                const clean = tracks.filter(t => t && t.url);
                if (clean.length > 0) {
                    global.likedSongs.set(userId, clean);
                    count += clean.length;
                }
            }
            if (count > 0) {
                console.log(`💾 LikedSongsManager: تم استعادة ${count} أغنية مفضلة لـ ${global.likedSongs.size} مستخدم`);
            }
        } catch (e) {
            // ملف تالف أو غير موجود — ابدأ نظيفاً بدون إنهار البوت
            console.error('❌ LikedSongsManager: فشل التحميل (بدء بذاكرة فارغة):', e.message);
        }
    }

    // ── قراءة قائمة مستخدم (دائماً مصفوفة) ───────────────────────────
    get(userId) {
        return global.likedSongs.get(userId) || [];
    }

    // ✅ الترقيم الموحد: الموقع #1 = الأحدث إعجاباً (يطابق showliked)
    //    liked مخزنة من الأقدم إلى الأحدث، لذا الموقع n = liked[len - n]
    getByPosition(userId, position) {
        const liked = this.get(userId);
        if (!Number.isInteger(position) || position < 1 || position > liked.length) return null;
        return liked[liked.length - position];
    }

    // ── إضافة أغنية (مع منع التكرار والحد الأقصى) ────────────────────
    add(userId, track) {
        if (!userId || !track || !track.url) return { added: false, reason: 'invalid' };

        let liked = global.likedSongs.get(userId);
        if (!liked) {
            liked = [];
            global.likedSongs.set(userId, liked);
        }

        // منع التكرار بنفس الـ URL
        if (liked.some(t => t.url === track.url)) {
            return { added: false, reason: 'duplicate', total: liked.length };
        }

        liked.push({
            title: track.title || 'Unknown',
            artist: track.artist || '',
            url: track.url,
            duration: track.duration || 0,
            platform: track.platform || 'unknown',
            thumbnail: track.thumbnail || null,
            likedAt: Date.now(),
        });

        // حد أقصى — احذف الأقدم
        if (liked.length > MAX_LIKES_PER_USER) {
            liked.splice(0, liked.length - MAX_LIKES_PER_USER);
        }

        this.scheduleSave();
        return { added: true, total: liked.length };
    }

    // ── إزالة بالرقم (نفس ترقيم showliked: 1 = الأحدث) ───────────────
    removeByPosition(userId, position) {
        const liked = global.likedSongs.get(userId);
        if (!liked || liked.length === 0) return { removed: null, reason: 'empty' };

        if (!Number.isInteger(position) || position < 1 || position > liked.length) {
            return { removed: null, reason: 'out_of_range', total: liked.length };
        }

        const removed = liked.splice(liked.length - position, 1)[0];
        this.scheduleSave();
        return { removed, total: liked.length };
    }

    // ── إزالة بالـ URL ────────────────────────────────────────────────
    removeByUrl(userId, url) {
        const liked = global.likedSongs.get(userId);
        if (!liked || liked.length === 0) return { removed: null, reason: 'empty' };

        const idx = liked.findIndex(t => t.url === url);
        if (idx === -1) return { removed: null, reason: 'not_found', total: liked.length };

        const removed = liked.splice(idx, 1)[0];
        this.scheduleSave();
        return { removed, total: liked.length };
    }

    // ── عدد الصفحات لعرض showliked ───────────────────────────────────
    get totalPages() {
        return Math.max(1, Math.ceil(global.likedSongs.size > 0 ? this._maxUserLikes() / PAGE_SIZE : 1));
    }

    _maxUserLikes() {
        let max = 0;
        for (const [, list] of global.likedSongs) max = Math.max(max, list.length);
        return max;
    }

    // ── حفظ مؤجل (debounce) ───────────────────────────────────────────
    scheduleSave() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this.persistNow();
        }, SAVE_DEBOUNCE_MS);
    }

    // ── حفظ فوري ذرّي آمن مع الشاردات ────────────────────────────────
    persistNow() {
        if (this._saving) return; // منع حفظ متزامن
        this._saving = true;
        try {
            // 1) اقرأ ما على القرص (قد يكون شاردة أخرى كتبت مستخدمين آخرين)
            let onDisk = { users: {} };
            try {
                onDisk = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) || { users: {} };
                if (!onDisk.users) onDisk.users = {};
            } catch (e) { /* ملف تالف → نبدأ من جديد */ }

            // 2) ادمج: لكل مستخدم، الكتلة الأحدث تفوز (بمقارنة آخر likedAt)
            const merged = onDisk.users;
            for (const [userId, liked] of global.likedSongs) {
                if (!Array.isArray(liked) || liked.length === 0) {
                    delete merged[userId]; // مستخدم حذف كل مفضلاته → احذفه من القرص
                    continue;
                }
                const diskList = merged[userId];
                const memNewest = liked.length ? (liked[liked.length - 1].likedAt || 0) : 0;
                const diskNewest = Array.isArray(diskList) && diskList.length
                    ? Math.max(...diskList.map(t => t.likedAt || 0)) : 0;
                // النسخة الأحدث في الذاكرة تفوز فقط إذا هذا الشارد هو صاحب أحدث تعديل
                if (memNewest >= diskNewest) merged[userId] = liked;
            }

            // 3) احترام حد المستخدمين
            const userIds = Object.keys(merged);
            if (userIds.length > MAX_USERS) {
                // احذف الأقدم نشاطاً
                userIds.sort((a, b) => {
                    const na = merged[a]?.length ? Math.max(...merged[a].map(t => t.likedAt || 0)) : 0;
                    const nb = merged[b]?.length ? Math.max(...merged[b].map(t => t.likedAt || 0)) : 0;
                    return na - nb;
                });
                for (const id of userIds.slice(0, userIds.length - MAX_USERS)) delete merged[id];
            }

            // 4) كتابة ذرّية: اكتب في ملف مؤقت ثم rename
            const payload = JSON.stringify({ users: merged, updatedAt: Date.now() }, null, 2);
            const tmpPath = this.filePath + '.tmp';
            fs.writeFileSync(tmpPath, payload, 'utf8');
            fs.renameSync(tmpPath, this.filePath);
        } catch (e) {
            console.error('❌ LikedSongsManager: فشل الحفظ:', e.message);
        } finally {
            this._saving = false;
        }
    }
}

// ✅ مصدر وحيد جاهز (singleton) — يتضمن التحميل الفوري عند الـ require
module.exports = new LikedSongsManager();
module.exports.LikedSongsManager = LikedSongsManager;
module.exports.PAGE_SIZE = PAGE_SIZE;
