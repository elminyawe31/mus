// ═══════════════════════════════════════════════════════════════════════════
//  src/SettingsStore.js — حفظ دائم لإعدادات المالك/السيرفرات على القرص
//  MUS Bot v26.4 — Dev: ELMINYAWE 👨‍💻
//  ─────────────────────────────────────────────────────────────────────────
//  ✅ يحل عائلة "القيم التي تضيع عند إعادة التشغيل":
//    1. client.noprefixUsers  — كانت في الذاكرة فقط → تُحفظ وتُستعاد
//    2. client.guildPrefixes  — كانت في الذاكرة فقط → تُحفظ وتُستعاد
//    3. client.ignoredChannels— كانت في الذاكرة فقط → تُحفظ وتُستعاد
//    4. global.blacklist      — كانت في الذاكرة فقط → تُحفظ وتُستعاد
//    5. guildCardThemes       — ✅ v26.10: ثيم كارت الأغنية لكل سيرفر (/lite و /dark)
//  ✅ كتابة ذرّية (tmp + rename) + حفظ مؤجل (debounce) حتى لا يُكتب القرص
//    مع كل ضغطة زر — وعمل persistNow() فوري عند إيقاف التشغيل.
//  ✅ متوافق مع الشاردات: كل شارد يقرأ/يكتب نفس الملف بأمان (merge قبل الكتابة).
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');

const DB_FILE_PATH = path.join(__dirname, '..', 'database', 'settings.json');
const SAVE_DEBOUNCE_MS = 1500;   // حفظ مؤجل بعد آخر تغيير
const MAX_NOPREFIX_USERS = 200;  // حد أقصى منطقي لمستخدمي noprefix
const MAX_BLACKLIST = 2000;      // حد أقصى للسيرفرات المحظورة

class SettingsStore {
    constructor() {
        this.filePath = DB_FILE_PATH;
        this._saveTimer = null;
        this._writing = false;

        // الشكل الافتراضي على القرص
        this._data = {
            noprefixUsers: [],
            guildPrefixes: {},
            ignoredChannels: [],
            blacklist: [],
            guildCardThemes: {},   // ✅ v26.10: guildId → 'ease' | 'ease-dark'
            updatedAt: 0,
        };

        this._ensureFileExists();
        this._readFile();
    }

    // ── تهيئة الملف ─────────────────────────────────────────────────────
    _ensureFileExists() {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(this.filePath)) {
                fs.writeFileSync(this.filePath, JSON.stringify(this._data, null, 2), 'utf8');
            }
        } catch (e) {
            console.error('❌ SettingsStore: فشل تهيئة الملف:', e.message);
        }
    }

    // ── قراءة الملف (مع تسامح مع الفساد) ────────────────────────────────
    _readFile() {
        try {
            const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            this._data = {
                noprefixUsers: Array.isArray(raw?.noprefixUsers) ? raw.noprefixUsers.filter(id => typeof id === 'string' && /^\d{5,25}$/.test(id)) : [],
                guildPrefixes: (raw?.guildPrefixes && typeof raw.guildPrefixes === 'object') ? raw.guildPrefixes : {},
                ignoredChannels: Array.isArray(raw?.ignoredChannels) ? raw.ignoredChannels.filter(id => typeof id === 'string' && /^\d{5,25}$/.test(id)) : [],
                blacklist: Array.isArray(raw?.blacklist) ? raw.blacklist.filter(id => typeof id === 'string' && /^\d{5,25}$/.test(id)) : [],
                guildCardThemes: (raw?.guildCardThemes && typeof raw.guildCardThemes === 'object')
                    ? Object.fromEntries(Object.entries(raw.guildCardThemes).filter(([gid, t]) => /^\d{5,25}$/.test(gid) && (t === 'ease' || t === 'ease-dark')))
                    : {},
                updatedAt: Number(raw?.updatedAt) || 0,
            };
        } catch (e) {
            console.error('❌ SettingsStore: فشل قراءة الملف (بدء بقيم فارغة):', e.message);
        }
    }

    // ── دمج آمن مع الشاردات: خذ الأحدث من القرص قبل الكتابة ─────────────
    _mergeFromDisk() {
        try {
            const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            const diskNoprefix = Array.isArray(raw?.noprefixUsers) ? raw.noprefixUsers : [];
            const diskBlacklist = Array.isArray(raw?.blacklist) ? raw.blacklist : [];
            const diskIgnored = Array.isArray(raw?.ignoredChannels) ? raw.ignoredChannels : [];
            const diskPrefixes = (raw?.guildPrefixes && typeof raw.guildPrefixes === 'object') ? raw.guildPrefixes : {};
            const diskThemes = (raw?.guildCardThemes && typeof raw.guildCardThemes === 'object') ? raw.guildCardThemes : {};

            // اتحاد (union) — لا شارد يستطيع محو قيم شارد آخر
            this._data.noprefixUsers = Array.from(new Set([...this._data.noprefixUsers, ...diskNoprefix])).slice(0, MAX_NOPREFIX_USERS);
            this._data.blacklist = Array.from(new Set([...this._data.blacklist, ...diskBlacklist])).slice(0, MAX_BLACKLIST);
            this._data.ignoredChannels = Array.from(new Set([...this._data.ignoredChannels, ...diskIgnored]));
            this._data.guildPrefixes = { ...diskPrefixes, ...this._data.guildPrefixes };
            this._data.guildCardThemes = { ...diskThemes, ...this._data.guildCardThemes };
        } catch (e) { /* ملف غير موجود/تالف — تجاهل */ }
    }

    // ── كتابة ذرّية ─────────────────────────────────────────────────────
    _writeFileNow() {
        if (this._writing) return;
        this._writing = true;
        try {
            this._mergeFromDisk();
            this._data.updatedAt = Date.now();
            const tmp = this.filePath + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify(this._data, null, 2), 'utf8');
            fs.renameSync(tmp, this.filePath);
        } catch (e) {
            console.error('❌ SettingsStore: فشل الحفظ:', e.message);
        } finally {
            this._writing = false;
        }
    }

    _scheduleSave() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this._writeFileNow();
        }, SAVE_DEBOUNCE_MS);
    }

    // ── تحميل القيم إلى الذاكرة عند الإقلاع ─────────────────────────────
    //    (يضيف فوق ما تمت تهيئته من config/env — لا يمسحه أبداً)
    loadInto(client) {
        try {
            this._readFile();

            // noprefix: أضف فوق developerId و NOPREFIX_USERS من env
            if (!client.noprefixUsers) client.noprefixUsers = new Set();
            for (const id of this._data.noprefixUsers) client.noprefixUsers.add(id);

            // guild prefixes
            if (!client.guildPrefixes) client.guildPrefixes = new Map();
            for (const [guildId, prefix] of Object.entries(this._data.guildPrefixes)) {
                if (typeof prefix === 'string' && prefix.length >= 1 && prefix.length <= 5) {
                    client.guildPrefixes.set(guildId, prefix);
                }
            }

            // ignored channels
            if (!client.ignoredChannels) client.ignoredChannels = new Set();
            for (const id of this._data.ignoredChannels) client.ignoredChannels.add(id);

            // blacklist (global.blacklist — نفس المرجع الذي يفحصه index.js)
            if (!global.blacklist) global.blacklist = new Set();
            for (const id of this._data.blacklist) global.blacklist.add(id);

            const counts = {
                noprefix: this._data.noprefixUsers.length,
                prefixes: Object.keys(this._data.guildPrefixes).length,
                ignored: this._data.ignoredChannels.length,
                blacklist: this._data.blacklist.length,
            };
            const total = counts.noprefix + counts.prefixes + counts.ignored + counts.blacklist;
            if (total > 0) {
                console.log(`💾 SettingsStore: استعادة الإعدادات — noprefix: ${counts.noprefix} | prefixes: ${counts.prefixes} | ignored: ${counts.ignored} | blacklist: ${counts.blacklist}`);
            }
            return counts;
        } catch (e) {
            console.error('❌ SettingsStore: فشل loadInto:', e.message);
            return null;
        }
    }

    // ── مزامنة مجموعة كاملة مع القرص (يُستدعى بعد أي تغيير) ─────────────
    persistNoprefix(usersIterable) {
        try {
            const arr = Array.from(usersIterable || []).filter(id => typeof id === 'string');
            this._data.noprefixUsers = arr.slice(0, MAX_NOPREFIX_USERS);
            this._scheduleSave();
        } catch (e) { /* ignore */ }
    }

    persistGuildPrefixes(prefixesMap) {
        try {
            const obj = {};
            if (prefixesMap && typeof prefixesMap.forEach === 'function') {
                prefixesMap.forEach((prefix, guildId) => {
                    if (typeof prefix === 'string' && prefix.length >= 1 && prefix.length <= 5) obj[guildId] = prefix;
                });
            }
            this._data.guildPrefixes = obj;
            this._scheduleSave();
        } catch (e) { /* ignore */ }
    }

    persistIgnoredChannels(channelsIterable) {
        try {
            this._data.ignoredChannels = Array.from(channelsIterable || []);
            this._scheduleSave();
        } catch (e) { /* ignore */ }
    }

    persistBlacklist(guildsIterable) {
        try {
            this._data.blacklist = Array.from(guildsIterable || []).slice(0, MAX_BLACKLIST);
            this._scheduleSave();
        } catch (e) { /* ignore */ }
    }

    // ── ✅ v26.10: ثيم كارت الأغنية لكل سيرفر ──────────────────────────
    /** حفظ ثيم سيرفر واحد (يُستدعى من /lite و /dark) */
    setCardTheme(guildId, theme) {
        try {
            if (!/^\d{5,25}$/.test(String(guildId))) return false;
            if (theme !== 'ease' && theme !== 'ease-dark') return false;
            this._data.guildCardThemes = this._data.guildCardThemes || {};
            this._data.guildCardThemes[String(guildId)] = theme;
            this._scheduleSave();
            return true;
        } catch (e) { return false; }
    }

    /** حذف ثيم سيرفر (العودة للافتراضي) */
    removeCardTheme(guildId) {
        try {
            if (this._data.guildCardThemes) delete this._data.guildCardThemes[String(guildId)];
            this._scheduleSave();
            return true;
        } catch (e) { return false; }
    }

    /** قراءة كل الثيمات (للاستعادة عند الإقلاع) */
    getCardThemes() {
        return { ...(this._data.guildCardThemes || {}) };
    }

    // ── حفظ فوري (يُستدعى عند إيقاف التشغيل) ────────────────────────────
    persistNow() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        this._writeFileNow();
    }
}

// Singleton — نفس النمط المستخدم في LikedSongsManager
module.exports = new SettingsStore();
