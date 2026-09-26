// ═══════════════════════════════════════════════════════════════════════════
//  src/LanguageManager.js — نظام لغات mus
//  MUS Bot v26.10 — Dev: ELMINYAWE 👨‍💻
//  ─────────────────────────────────────────────────────────────────────────
//  ✅ v26.10 — إعادة بناء جذرية لطبقة الحفظ:
//     المشكلة الأصلية: node-json-db ^2.3.1 ثبتت فعلياً v2.6.0 التي أزالت
//     المُنشئ القديم new JsonDB('file', true, true, '/') — فصار config نصاً
//     بلا adapter → كل عمليات القاعدة ترمي "Can't Load Database" →
//     اللغة لا تُحفظ أبداً وتظهر "❌ اللغة ar غير متاحة".
//     الحل: مخزن ملفات مدمج (بلا تبعيات خارجية):
//       1. نفس ملف database/languages.json ونفس المخطط {"servers":{}} (توافق خلفي)
//       2. كتابة ذرّية (tmp + rename) — لا فساد عند الانقطاع
//       3. تحمّل الفساد: نسخة احتياطية .bak + بدء نظيف بدل الانهيار
//       4. قراءة-قبل-الكتابة (merge) — أمان مع الشاردات متعددة العمليات
//       5. كاش في الذاكرة + تحقق من صحة كود اللغة قبل الحفظ
//       6. normalizeLanguageCode: يقبل 'عربي'/'العربية'/'Arabic' → 'ar'
//  ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'database', 'languages.json');
const SAVE_DEBOUNCE_MS = 800;

/**
 * Language utility functions for the Discord bot
 */
class LanguageManager {
    constructor() {
        this.languagesPath = path.join(__dirname, '..', 'languages');
        this.defaultLanguage = 'en';
        this.loadedLanguages = new Map();          // code → langData
        this.serverLanguageCache = new Map();      // guildId → code
        this._saveTimer = null;
        this._writing = false;
        this._data = { servers: {} };              // نفس مخطط node-json-db القديم

        this._loadLanguages();
        this._buildAliasTable();
        this._loadDb();
    }

    // ═══════════════ ملفات اللغات ═════════════════════════════════════════

    _loadLanguages() {
        try {
            const languageFiles = fs.readdirSync(this.languagesPath).filter(file => file.endsWith('.json'));
            for (const file of languageFiles) {
                const langCode = file.replace('.json', '');
                try {
                    const langData = JSON.parse(fs.readFileSync(path.join(this.languagesPath, file), 'utf8'));
                    this.loadedLanguages.set(langCode, langData);
                } catch (e) {
                    console.error(`❌ [LanguageManager] ملف لغة تالف تجاهلناه: ${file} (${e.message})`);
                }
            }
            console.log(`✅ Loaded ${this.loadedLanguages.size} language files`);
        } catch (error) {
            console.error('❌ Error loading language files:', error.message);
        }
    }

    /** جدول الأسماء البديلة: الاسم الأصلي والإنجليزي وأسماء شائعة → الكود */
    _buildAliasTable() {
        this._aliases = new Map();
        const add = (names, code) => {
            for (const n of names) {
                const k = String(n).toLowerCase().trim();
                if (k && !this._aliases.has(k)) this._aliases.set(k, code);
            }
        };
        const extras = {
            'ar': ['عربي', 'العربية', 'عرب', 'arabic', 'arabe'],
            'en': ['انجليزي', 'إنجليزي', 'الانجليزية', 'الإنجليزية', 'english', 'eng'],
            'fr': ['فرنسي', 'الفرنسية', 'french', 'francais', 'français'],
            'de': ['الماني', 'ألماني', 'الالمانية', 'الألمانية', 'german', 'deutsch'],
            'es': ['اسباني', 'إسباني', 'الاسبانية', 'الإسبانية', 'spanish', 'espanol', 'español'],
            'tr': ['تركي', 'التركية', 'turkish', 'turkce', 'türkçe'],
            'ru': ['روسي', 'الروسية', 'russian'],
            'it': ['ايطالي', 'إيطالي', 'الايطالية', 'الإيطالية', 'italian', 'italiano'],
            'pt': ['برتغالي', 'البرتغالية', 'portuguese', 'portugues', 'português'],
            'hi': ['هندي', 'الهندية', 'hindi'],
            'ja': ['ياباني', 'اليابانية', 'japanese', 'nihongo'],
            'ko': ['كوري', 'الكورية', 'korean'],
            'zh_CN': ['صيني', 'الصينية', 'chinese', '中文'],
            'zh_TW': ['تقليدي', 'الصينية التقليدية'],
            'id': ['اندونيسي', 'الاندونيسية', 'indonesian'],
            'nl': ['هولندي', 'الهولندية', 'dutch', 'nederlands'],
            'pl': ['بولندي', 'البولندية', 'polish', 'polski'],
            'sv': ['سويدي', 'السويدية', 'swedish', 'svenska'],
            'no': ['نرويجي', 'النرويجية', 'norwegian', 'norsk'],
            'da': ['دانماركي', 'الدنماركية', 'danish', 'dansk'],
            'fi': ['فنلندي', 'الفنلندية', 'finnish', 'suomi'],
            'cs': ['تشيكي', 'التشيكية', 'czech', 'cesky', 'česky'],
            'th': ['تايلاندي', 'التايلاندية', 'thai'],
        };
        for (const [code, data] of this.loadedLanguages) {
            const names = [code, code.toLowerCase()];
            if (data?.language?.name) names.push(data.language.name);
            if (data?.language?.englishName) names.push(data.language.englishName);
            if (extras[code]) names.push(...extras[code]);
            add(names, code);
        }
        // أسماء إنجليزية عامة لأي لغة غير موجودة في extras
        for (const [code, data] of this.loadedLanguages) {
            if (data?.language?.name && !/[\u0600-\u06FF]/.test(data.language.name)) {
                add([data.language.name], code);
            }
        }
    }

    // ═══════════════ طبقة الحفظ (بديل node-json-db) ════════════════════════

    _loadDb() {
        try {
            const dir = path.dirname(DB_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            if (!fs.existsSync(DB_FILE)) {
                fs.writeFileSync(DB_FILE, JSON.stringify({ servers: {} }, null, 2), 'utf8');
                return;
            }
            const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
            this._data = {
                servers: (raw && typeof raw.servers === 'object' && raw.servers) ? raw.servers : {},
            };
            // استرجاع الكاش من القرص
            for (const [gid, entry] of Object.entries(this._data.servers)) {
                const code = entry && typeof entry === 'object' ? entry.language : entry;
                if (typeof code === 'string' && this.loadedLanguages.has(code)) {
                    this.serverLanguageCache.set(gid, code);
                } else if (typeof code === 'string') {
                    // كود قديم غير مدعوم (مثل "عربي" حُفظ بالخطأ سابقاً) — أصلحه
                    const fixed = this.normalizeLanguageCode(code);
                    if (fixed) this.serverLanguageCache.set(gid, fixed);
                    else this.serverLanguageCache.set(gid, this.defaultLanguage);
                }
            }
        } catch (e) {
            // ملف تالف — انسخه احتياطياً وابدأ نظيفاً (لا ننهار أبداً)
            try {
                if (fs.existsSync(DB_FILE)) {
                    fs.copyFileSync(DB_FILE, DB_FILE + '.bak');
                    console.warn(`⚠️ [LanguageManager] ملف اللغات تالف — حفظنا نسخة في languages.json.bak وبدأنا نظيفاً`);
                }
            } catch (e2) { /* ignore */ }
            this._data = { servers: {} };
            try { fs.writeFileSync(DB_FILE, JSON.stringify({ servers: {} }, null, 2), 'utf8'); } catch (e3) { /* ignore */ }
        }
    }

    _writeDbNow() {
        if (this._writing) return;
        this._writing = true;
        try {
            // merge من القرص: لا نمحو لغات سيرفرات كتبتها شاردات أخرى
            try {
                const disk = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                if (disk && typeof disk.servers === 'object') {
                    for (const [gid, entry] of Object.entries(disk.servers)) {
                        if (this._data.servers[gid] === undefined) this._data.servers[gid] = entry;
                    }
                }
            } catch (e) { /* قرص فارغ/تالف — تجاهل */ }
            const tmp = DB_FILE + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify({ servers: this._data.servers }, null, 2), 'utf8');
            fs.renameSync(tmp, DB_FILE);
        } catch (e) {
            console.error('❌ [LanguageManager] فشل حفظ ملف اللغات:', e.message);
        } finally {
            this._writing = false;
        }
    }

    _scheduleSave() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this._writeDbNow();
        }, SAVE_DEBOUNCE_MS);
    }

    /** حفظ فوري عند الإيقاف */
    persistNow() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        this._writeDbNow();
    }

    // ═══════════════ الواجهة العامة (نفس أسماء الدوال القديمة) ═════════════

    /**
     * الحصول على لغة السيرفر (مع كاش)
     * @param {string} guildId
     * @returns {Promise<string>}
     */
    async getServerLanguage(guildId) {
        return this.getServerLanguageSync(guildId);
    }

    /**
     * الحصول على لغة السيرفر — متزامن (كان معطلاً بـ node-json-db: getObjectDefault صارت async)
     * @param {string} guildId
     * @returns {string}
     */
    getServerLanguageSync(guildId) {
        const cached = this.serverLanguageCache.get(guildId);
        if (cached) return cached;
        const entry = this._data.servers[guildId];
        const code = entry && typeof entry === 'object' ? entry.language : entry;
        if (typeof code === 'string' && this.loadedLanguages.has(code)) {
            this.serverLanguageCache.set(guildId, code);
            return code;
        }
        this.serverLanguageCache.set(guildId, this.defaultLanguage);
        return this.defaultLanguage;
    }

    /**
     * تحويل أي إدخال إلى كود لغة مدعوم — 'عربي'/'Arabic'/'AR' → 'ar'
     * @param {string} input
     * @returns {string|null} كود اللغة أو null
     */
    normalizeLanguageCode(input) {
        if (typeof input !== 'string') return null;
        const k = input.toLowerCase().trim();
        if (!k) return null;
        // مطابقة مباشرة أو بالاسم
        const direct = this._aliases.get(k);
        if (direct) return direct;
        // جرّب مطابقة تقريبية (مسافات/شرطات تُحذف)
        const squashed = k.replace(/[\s\-_]/g, '');
        const squashedHit = this._aliases.get(squashed);
        if (squashedHit) return squashedHit;
        // جرّب تطبيع zh-cn → zh_CN
        const norm = k.replace(/-/g, '_');
        if (this.loadedLanguages.has(norm)) return norm;
        const upper = norm.toUpperCase();
        for (const code of this.loadedLanguages.keys()) {
            if (code.toUpperCase() === upper) return code;
        }
        return null;
    }

    /**
     * تعيين لغة السيرفر — مع تحقق من الصحة (لا يقبل أكواداً غير مدعومة)
     * @param {string} guildId
     * @param {string} langCode كود أو اسم اللغة ('ar' أو 'عربي')
     * @returns {Promise<boolean>}
     */
    async setServerLanguage(guildId, langCode) {
        try {
            const code = this.normalizeLanguageCode(langCode);
            if (!code || !this.loadedLanguages.has(code)) return false;
            this._data.servers[guildId] = { language: code };
            this.serverLanguageCache.set(guildId, code);
            this._scheduleSave();
            return true;
        } catch (error) {
            console.error('❌ [LanguageManager] setServerLanguage error:', error.message);
            return false;
        }
    }

    /**
     * ترجمة مفتاح
     * @param {string} guildId
     * @param {string} key مثل 'commands.play.description'
     * @param {object} variables
     * @returns {Promise<string>}
     */
    async getTranslation(guildId, key, variables = {}) {
        const langCode = this.getServerLanguageSync(guildId);
        return this.getTranslationSync(langCode, key, variables);
    }

    /**
     * ترجمة متزامنة — مع fallback للإنجليزية ثم للمفتاح نفسه
     * @param {string} langCode
     * @param {string} key
     * @param {object} variables
     * @returns {string}
     */
    getTranslationSync(langCode, key, variables = {}) {
        try {
            const langData = this.loadedLanguages.get(langCode) || this.loadedLanguages.get(this.defaultLanguage);
            if (!langData) return key;

            const keys = key.split('.');
            let translation = langData;
            for (const k of keys) {
                if (translation[k] === undefined) {
                    // fallback للإنجليزية
                    const defaultLangData = this.loadedLanguages.get(this.defaultLanguage);
                    if (defaultLangData) {
                        let t = defaultLangData;
                        for (const fk of keys) {
                            if (t[fk] === undefined) return key;
                            t = t[fk];
                        }
                        translation = t;
                        break;
                    }
                    return key;
                }
                translation = translation[k];
            }

            if (typeof translation === 'string' && Object.keys(variables).length > 0) {
                for (const [variable, value] of Object.entries(variables)) {
                    translation = translation.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
                }
            }

            return (typeof translation === 'string' && translation) ? translation : key;
        } catch (error) {
            return key;
        }
    }

    /**
     * كل اللغات المتاحة
     * @returns {Array<{code,name,flag}>}
     */
    getAvailableLanguages() {
        const languages = [];
        for (const [code, data] of this.loadedLanguages) {
            languages.push({
                code: data.language.code,
                name: data.language.name,
                flag: data.language.flag,
            });
        }
        return languages;
    }

    /**
     * هل الكود مدعوم؟ (يقبل الأسماء أيضاً — 'عربي' مدعوم)
     */
    isLanguageSupported(langCode) {
        if (this.loadedLanguages.has(langCode)) return true;
        return this.normalizeLanguageCode(langCode) !== null;
    }

    /**
     * بيانات لغة معينة
     */
    getLanguageData(langCode) {
        return this.loadedLanguages.get(langCode) || this.loadedLanguages.get(this.normalizeLanguageCode(langCode)) || null;
    }

    /** الكود الفعلي بعد التطبيع (للاستخدام بعد isLanguageSupported) */
    resolveCode(langCode) {
        if (this.loadedLanguages.has(langCode)) return langCode;
        return this.normalizeLanguageCode(langCode);
    }

    clearServerLanguageCache(guildId) {
        this.serverLanguageCache.delete(guildId);
    }

    clearAllLanguageCache() {
        this.serverLanguageCache.clear();
    }

    async refreshServerLanguage(guildId) {
        this.clearServerLanguageCache(guildId);
        return this.getServerLanguageSync(guildId);
    }

    reloadLanguages() {
        this.loadedLanguages.clear();
        this.serverLanguageCache.clear();
        this._loadLanguages();
        this._buildAliasTable();
    }

    /** معلومات تشخيصية */
    getDiagnostics() {
        return {
            languagesLoaded: this.loadedLanguages.size,
            aliases: this._aliases.size,
            serversOnDisk: Object.keys(this._data.servers).length,
            cachedServers: this.serverLanguageCache.size,
            dbFile: DB_FILE,
        };
    }
}

// Create singleton instance
const languageManager = new LanguageManager();

module.exports = languageManager;
