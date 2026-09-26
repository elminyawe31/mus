// ═══════════════════════════════════════════════════════════════════════════
//  test-v26.10-language-themes.js — اختبارات اللغات + ثيمات الكارت (v26.10)
//  1. LanguageManager الجديد (بديل node-json-db المعطل)
//  2. أمر اللغة: تطبيع 'عربي' + قائمة الأزرار + الردود المترجمة
//  3. أوامر lite/dark: تطبيق + حفظ + استعادة + صلاحيات
//  استخدم: node scripts/test-v26.10-language-themes.js
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const assert = require('assert');

process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'test-token';
process.env.CLIENT_ID = process.env.CLIENT_ID || '123456789012345678';

const LM = require('../src/LanguageManager');
const SettingsStore = require('../src/SettingsStore');
const MusicCard = require('../src/MusicCard');

const DB_FILE = path.join(__dirname, '..', 'database', 'languages.json');
const SETTINGS_FILE = path.join(__dirname, '..', 'database', 'settings.json');

let pass = 0, fail = 0;
function ok(cond, label, extra = '') {
    if (cond) { pass++; console.log(`  ✅ ${label}${extra ? ' — ' + extra : ''}`); }
    else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
}

(async () => {
    console.log('════════ 1) LanguageManager — السبب الجذري الشافي ════════');
    // المحاكاة الحرفية لسيناريو المستخدم: ضغط زر "العربية" → كان يرد "اللغة ar غير متاحة"
    const G = '111222333444555666';
    const setResult = await LM.setServerLanguage(G, 'ar');
    ok(setResult === true, `setServerLanguage(G, 'ar') = true (كان false قبل الإصلاح!)`);
    ok(LM.getServerLanguageSync(G) === 'ar', 'اللغة صارت ar فوراً');
    await new Promise(r => setTimeout(r, 1200)); // انتظر الـ debounce
    const diskRaw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    ok(diskRaw?.servers?.[G]?.language === 'ar', 'كُتبت فعلاً على القرص في مخطط {"servers":{}} المتوافق');
    console.log('    محتوى الملف:', JSON.stringify(diskRaw));

    // محاكاة إعادة تشغيل: مدير جديد يقرأ من القرص
    delete require.cache[require.resolve('../src/LanguageManager')];
    const LM2 = require('../src/LanguageManager');
    ok(LM2.getServerLanguageSync(G) === 'ar', 'بعد "إعادة التشغيل" اللغة ما زالت ar (استعادة)');

    console.log('\n════════ 2) التطبيع — عربي/Arabic/AR/ar كلها تعمل ════════');
    ok(LM2.normalizeLanguageCode('ar') === 'ar', "'ar' → ar");
    ok(LM2.normalizeLanguageCode('AR') === 'ar', "'AR' → ar");
    ok(LM2.normalizeLanguageCode('عربي') === 'ar', "'عربي' → ar");
    ok(LM2.normalizeLanguageCode('العربية') === 'ar', "'العربية' → ar");
    ok(LM2.normalizeLanguageCode('Arabic') === 'ar', "'Arabic' → ar");
    ok(LM2.normalizeLanguageCode('english') === 'en', "'english' → en");
    ok(LM2.normalizeLanguageCode('English') === 'en', "'English' → en");
    ok(LM2.normalizeLanguageCode('zh-CN') === 'zh_CN', "'zh-CN' → zh_CN");
    ok(LM2.normalizeLanguageCode('Deutsch') === 'de', "'Deutsch' → de");
    ok(LM2.normalizeLanguageCode('نونexistent') === null, "لغة غير موجودة → null");
    ok(LM2.resolveCode('عربي') === 'ar', "resolveCode('عربي') = ar");
    ok(await LM2.setServerLanguage(G, 'ليست لغة') === false, 'setServerLanguage يرفض كوداً غير مدعوم (false)');
    ok(LM2.getServerLanguageSync(G) === 'ar', 'اللغة لم تتغير بعد الرفض');

    console.log('\n════════ 3) الترجمات — بلغة السيرفر الحقيقية ════════');
    const errTitle = LM2.getTranslationSync('ar', 'commands.language.errortitle');
    ok(errTitle.includes('خطأ'), `العنوان بالعربية: "${errTitle}"`);
    const changedDesc = LM2.getTranslationSync('ar', 'commands.language.changed_desc');
    ok(changedDesc.includes('{language}'), 'قالب changed_desc موجود');
    const fallbackKey = LM2.getTranslationSync('ar', 'key.that.does.not.exist');
    ok(fallbackKey === 'key.that.does.not.exist', 'مفتاح غير موجود يرجع نفسه (لا انهيار)');
    const enPlay = LM2.getTranslationSync('en', 'commands.play.now_playing');
    ok(typeof enPlay === 'string' && enPlay.length > 0, `ترجمة إنجليزية سليمة: "${enPlay}"`);

    console.log('\n════════ 4) تحمّل الفساد — لا انهيار أبداً ════════');
    fs.writeFileSync(DB_FILE, '{"servers": {"broken": tru', 'utf8'); // JSON مقطوع
    delete require.cache[require.resolve('../src/LanguageManager')];
    const LM3 = require('../src/LanguageManager');
    const okAfterCorrupt = await LM3.setServerLanguage(G, 'fr');
    ok(okAfterCorrupt === true, 'setServerLanguage يعمل فوراً بعد ملف تالف');
    ok(fs.existsSync(DB_FILE + '.bak'), 'نسخة احتياطية .bak أُنشئت');
    ok(LM3.getServerLanguageSync(G) === 'fr', 'اللغة الجديدة fr محفوظة في الذاكرة');
    // استعد الملف النظيف للاختبارات التالية
    await new Promise(r => setTimeout(r, 1100));
    LM3.persistNow();

    console.log('\n════════ 5) أمر اللغة — سيناريو !language عربي ════════');
    const langCmd = require('../commands/Utility/language');
    ok(typeof langCmd.execute === 'function', 'execute (slash) موجود');
    ok(typeof langCmd.executePrefix === 'function', 'executePrefix موجود');
    ok(typeof langCmd.autocomplete === 'function', 'autocomplete موجود (للاختيار الذكي)');

    // محاكاة executePrefix مع رسالة وهمية — !language عربي
    const replies = [];
    const fakeMsg = {
        member: { permissions: { has: () => true } },
        guild: { id: G },
        reply: async (payload) => { replies.push(payload); return { id: 'm1' }; },
    };
    await langCmd.executePrefix(fakeMsg, ['عربي'], {});
    ok(replies.length === 1 && replies[0]?.embeds?.length === 1, '!language عربي رد بـ embed نجاح');
    const succEmbed = replies[0]?.embeds?.[0]?.data;
    ok(succEmbed?.title?.includes('تم تغيير اللغة') || /changed/i.test(String(succEmbed?.title)), `عنوان الرد مترجم: "${succEmbed?.title}"`);
    ok(String(succEmbed?.description || '').includes('العربية'), 'الوصف يذكر "العربية"');
    ok(LM3.getServerLanguageSync(G) === 'ar', 'اللغة فعلاً ar الآن (عبر الاسم العربي!)');

    // لغة غير موجودة
    replies.length = 0;
    await langCmd.executePrefix(fakeMsg, ['klingon'], {});
    ok(replies.length === 1 && typeof replies[0] === 'string' && replies[0].includes('غير متاحة'), '!language klingon → "غير متاحة" مع قائمة المتاح');

    // بلا وسيط → قائمة أزرار
    replies.length = 0;
    await langCmd.executePrefix(fakeMsg, [], {});
    const menuPayload = replies[0];
    ok(menuPayload?.embeds?.length === 1 && menuPayload?.components?.length >= 4, `القائمة: ${menuPayload?.components?.length} صفوف أزرار`);
    const allButtons = (menuPayload?.components || []).flatMap(r => r.components || []);
    ok(allButtons.length === 23, `23 زر لغة (${allButtons.length})`);
    const arBtn = allButtons.find(b => b.data?.custom_id === 'language_ar');
    ok(!!arBtn, 'زر language_ar موجود');
    ok(arBtn?.data?.label === 'العربية' && arBtn?.data?.emoji?.name === '🇸🇦', 'الزر: التسمية العربية + علم SA');

    console.log('\n════════ 6) معالج الزر (محاكاة index.js) ════════');
    // نفس منطق index.js — لكن عبر LM مباشرة (اختبر النتيجة النهائية)
    const btnCode = LM3.resolveCode('ar');
    ok(btnCode === 'ar', "resolveCode('ar') من معرف الزر = ar");
    const btnSet = await LM3.setServerLanguage(G, btnCode);
    ok(btnSet === true, 'الضغط على الزر يحفظ اللغة (true)');

    console.log('\n════════ 7) أوامر lite و dark — الثلاث طرق ════════');
    const liteCmd = require('../commands/Config/lite');
    const darkCmd = require('../commands/Config/dark');
    for (const [name, cmd] of [['lite', liteCmd], ['dark', darkCmd]]) {
        ok(typeof cmd.execute === 'function', `${name}: execute (slash) موجود`);
        ok(typeof cmd.executePrefix === 'function', `${name}: executePrefix (prefix+noprefix) موجود`);
        ok(cmd.data?.name === name, `${name}: اسم الـ slash = ${name}`);
        ok(Array.isArray(cmd.aliases) && cmd.aliases.length > 0, `${name}: aliases موجودة (${cmd.aliases.join(',')})`);
    }

    // محاكاة !dark ثم !lite
    const fakeClient = { players: new Map(), user: { username: 'Mus' } };
    const fakeMsgTheme = {
        member: { permissions: { has: () => true } },
        guild: { id: G },
        author: { id: '42' },
        reply: async (p) => { replies.push(p); return { id: 'm2' }; },
    };

    replies.length = 0;
    await darkCmd.executePrefix(fakeMsgTheme, [], fakeClient);
    ok(MusicCard.resolveTheme(G) === 'ease-dark', '!dark → الثيم صار ease-dark فوراً');
    ok(replies[0]?.embeds?.length === 1, '!dark رد بـ embed');
    ok(!!replies[0]?.files?.[0], '!dark أرفق معاينة PNG للكارت');
    await new Promise(r => setTimeout(r, 1100));
    let themesNow = SettingsStore.getCardThemes();
    ok(themesNow[G] === 'ease-dark', 'الثيم الداكن محفوظ على القرص في settings.json');

    replies.length = 0;
    await liteCmd.executePrefix(fakeMsgTheme, [], fakeClient);
    ok(MusicCard.resolveTheme(G) === 'ease', '!lite → الثيم صار ease فوراً');
    await new Promise(r => setTimeout(r, 1100));
    themesNow = SettingsStore.getCardThemes();
    ok(themesNow[G] === 'ease', 'الثيم الفاتح محفوظ على القرص');

    // صلاحيات: عضو بلا ManageGuild
    const noPermMsg = {
        member: { permissions: { has: () => false } },
        guild: { id: G },
        reply: async (p) => { replies.push(p); return { id: 'm3' }; },
    };
    replies.length = 0;
    await liteCmd.executePrefix(noPermMsg, [], fakeClient);
    ok(typeof replies[0] === 'string' && replies[0].includes('Manage Server'), 'بلا صلاحية → رفض واضح');

    // استعادة بعد "إعادة تشغيل" — محاكاة index.js
    MusicCard.clearGuildTheme(G);
    ok(MusicCard.resolveTheme(G) === MusicCard.getDefaultTheme(), 'قبل الاستعادة: الافتراضي');
    for (const [gid, theme] of Object.entries(SettingsStore.getCardThemes())) {
        MusicCard.setGuildTheme(gid, theme);
    }
    ok(MusicCard.resolveTheme(G) === 'ease', 'بعد الاستعادة (كما في index.js): الثيم رجع من القرص');

    console.log('\n════════ 8) سلامة عامة ════════');
    const diag = LM3.getDiagnostics();
    ok(diag.languagesLoaded === 23, `23 لغة محملة`);
    ok(diag.aliases > 60, `جدول الأسماء البديلة = ${diag.aliases} مدخل`);
    // package.json لم يعد يحتوي node-json-db
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    ok(!pkg.dependencies?.['node-json-db'], 'node-json-db حُذفت من package.json (لا كسر مستقبلي)');

    // نظّف بيانات الاختبار من ملفات قاعدة البيانات (بتحمل الفساد)
    console.log('\n[تنظيف بيانات الاختبار]');
    try {
        const langDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        delete langDb.servers?.[G];
        fs.writeFileSync(DB_FILE, JSON.stringify({ servers: langDb.servers || {} }, null, 2), 'utf8');
    } catch (e) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ servers: {} }, null, 2), 'utf8');
    }
    try {
        const settingsDb = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        if (settingsDb.guildCardThemes) delete settingsDb.guildCardThemes[G];
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settingsDb, null, 2), 'utf8');
    } catch (e) {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
            noprefixUsers: [], guildPrefixes: {}, ignoredChannels: [], blacklist: [], guildCardThemes: {}, updatedAt: 0,
        }, null, 2), 'utf8');
    }
    try { fs.unlinkSync(DB_FILE + '.bak'); } catch (e) {}
    console.log('  نظّفنا');

    console.log(`\n════════ النتيجة: ${pass} ✅ / ${fail} ❌ ════════`);
    process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
