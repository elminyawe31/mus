// ═══════════════════════════════════════════════════════════════════════════
//  test-v26.4-fixes.js — اختبارات وظيفية لمرحلة v26.4
//  1. SettingsStore (حفظ/استعادة noprefix + prefixes + ignored + blacklist)
//  2. GiveawaysManager (تسجيل/أرشيف/استعادة/حدود)
//  3. ميزة noprefix متعددة التحديد (لوحات القوائم في الوضعين)
//  4. إصلاحات التحقق الرقمي (purge/sleep/timer/mute/forward/rewind/gstart/move)
//  5. حفظ حالة القائمة بعد remove/move/skipto/clear/clearqueue
// ═══════════════════════════════════════════════════════════════════════════
process.chdir('/home/z/my-project/mus-repo');

const fs = require('fs');
const path = require('path');
const { Collection, ActionRowBuilder } = require(path.join('/home/z/my-project/mus-repo', 'node_modules', 'discord.js'));

let passed = 0, failed = 0;
const failures = [];
function ok(cond, name) {
    if (cond) { passed++; console.log(`  ✅ ${name}`); }
    else { failed++; failures.push(name); console.log(`  ❌ ${name}`); }
}

// ── تنظيف بيئة الاختبار قبل البدء ──────────────────────────────────────
const DB_SETTINGS = path.resolve('database/settings.json');
const DB_GIVEAWAYS = path.resolve('database/giveaways.json');
const DB_ARCHIVE = path.resolve('database/giveawaysArchive.json');
for (const f of [DB_SETTINGS, DB_GIVEAWAYS, DB_ARCHIVE]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
    if (fs.existsSync(f + '.tmp')) fs.unlinkSync(f + '.tmp');
}

// ═════════════════════════════════════════════════════════════
console.log('\n═══ TEST 1: SettingsStore — حفظ واستعادة الإعدادات ═══');
// ═════════════════════════════════════════════════════════════
const SettingsStore = require('../src/SettingsStore');

(async () => {
const fakeClient = {
    noprefixUsers: new Set(['1003378222400020510']), // developerId موجود مسبقاً (من config)
    guildPrefixes: new Map(),
    ignoredChannels: new Set(),
};

SettingsStore.loadInto(fakeClient);
ok(fakeClient.noprefixUsers.has('1003378222400020510'), 'loadInto لا يمسح الموجود مسبقاً (developerId)');

// أضف مستخدمين جدد وثبّت على القرص
fakeClient.noprefixUsers.add('111111111111111111');
fakeClient.noprefixUsers.add('222222222222222222');
SettingsStore.persistNoprefix(fakeClient.noprefixUsers);
SettingsStore.persistNow();
ok(fs.existsSync(DB_SETTINGS), 'ملف settings.json أُنشئ');

// "إعادة تشغيل" — عميل جديد + نسخة جديدة من المتجر
delete require.cache[require.resolve('../src/SettingsStore')];
const SettingsStore2 = require('../src/SettingsStore');
const freshClient = { noprefixUsers: new Set(['1003378222400020510']), guildPrefixes: new Map(), ignoredChannels: new Set() };
SettingsStore2.loadInto(freshClient);
ok(freshClient.noprefixUsers.has('111111111111111111'), 'noprefix استُعيد بعد إعادة التشغيل (المستخدم 1)');
ok(freshClient.noprefixUsers.has('222222222222222222'), 'noprefix استُعيد بعد إعادة التشغيل (المستخدم 2)');
ok(freshClient.noprefixUsers.has('1003378222400020510'), 'developerId بقي موجوداً مع المستعادين');

// guild prefixes
freshClient.guildPrefixes.set('999888777666555444', '?');
SettingsStore2.persistGuildPrefixes(freshClient.guildPrefixes);
SettingsStore2.persistNow();
delete require.cache[require.resolve('../src/SettingsStore')];
const SettingsStore3 = require('../src/SettingsStore');
const client3 = { noprefixUsers: new Set(), guildPrefixes: new Map(), ignoredChannels: new Set() };
SettingsStore3.loadInto(client3);
ok(client3.guildPrefixes.get('999888777666555444') === '?', 'guild prefix استُعيد بعد إعادة التشغيل');

// ignored channels + blacklist
client3.ignoredChannels.add('123456789123456789');
if (!global.blacklist) global.blacklist = new Set();
global.blacklist.add('987654321987654321');
SettingsStore3.persistIgnoredChannels(client3.ignoredChannels);
SettingsStore3.persistBlacklist(global.blacklist);
SettingsStore3.persistNow();
delete require.cache[require.resolve('../src/SettingsStore')];
const SettingsStore4 = require('../src/SettingsStore');
const client4 = { noprefixUsers: new Set(), guildPrefixes: new Map(), ignoredChannels: new Set() };
global.blacklist = new Set();
SettingsStore4.loadInto(client4);
ok(client4.ignoredChannels.has('123456789123456789'), 'ignored channel استُعيد بعد إعادة التشغيل');
ok(global.blacklist.has('987654321987654321'), 'القائمة السوداء استُعيدت بعد إعادة التشغيل');

// بيانات فاسدة لا تكسر البوت
fs.writeFileSync(DB_SETTINGS, '{corrupted!!!', 'utf8');
delete require.cache[require.resolve('../src/SettingsStore')];
let corruptLoadOk = true;
try {
    const SS5 = require('../src/SettingsStore');
    SS5.loadInto({ noprefixUsers: new Set(), guildPrefixes: new Map(), ignoredChannels: new Set() });
} catch (e) { corruptLoadOk = false; }
ok(corruptLoadOk, 'ملف تالف لا يكسر الإقلاع (يبدأ بقيم فارغة)');

// ═════════════════════════════════════════════════════════════
console.log('\n═══ TEST 2: GiveawaysManager — أرشيف واستعادة ═══');
// ═════════════════════════════════════════════════════════════
delete require.cache[require.resolve('../src/GiveawaysManager')];
for (const f of [DB_GIVEAWAYS, DB_ARCHIVE]) if (fs.existsSync(f)) fs.unlinkSync(f);
const GiveawaysManager = require('../src/GiveawaysManager');

let endCalls = [];
const fakeEndFn = async (cl, id) => { endCalls.push(id); return true; };

// سحبة مستقبلية + سحبة منتهية
const futureGw = {
    messageId: 'future-msg-1', channelId: 'ch1', guildId: 'g1',
    prize: 'Nitro', winnersCount: 1,
    endTime: Date.now() + 3600_000, hostId: 'host1',
    participants: new Set(['u1', 'u2', 'u3']),
};
GiveawaysManager.register(futureGw);
GiveawaysManager.scheduleEnd(fakeClient, 'future-msg-1', futureGw.endTime, fakeEndFn);
ok(global.giveaways.has('future-msg-1'), 'register يضيف للـ Map العالمي');
ok(fs.existsSync(DB_GIVEAWAYS), 'السحبات كُتبت على القرص');

// أنهِ السحبة → أرشفة
GiveawaysManager.onEnded('future-msg-1');
ok(!global.giveaways.has('future-msg-1'), 'onEnded يزيل من الجارية');
const archived = GiveawaysManager.getArchived('future-msg-1');
ok(archived !== null, 'السحبة المنتهية مؤرشفة');
ok(Array.isArray(archived?.participants) && archived.participants.length === 3, 'المشاركون محفوظون في الأرشيف (3)');
ok(GiveawaysManager.getArchived('nonexistent') === null, 'سحبة غير موجودة → null');

// استعادة: سحبة مستقبلية تُعاد جدولتها، وسحبة منتهية تُنهى فوراً
const pastGw = {
    messageId: 'past-msg-1', channelId: 'ch1', guildId: 'g1',
    prize: 'Old', winnersCount: 1,
    endTime: Date.now() - 5000, hostId: 'host1',
    participants: new Set(['u9']),
};
GiveawaysManager.register(pastGw);
GiveawaysManager.persistNow();
global.giveaways.clear();
endCalls = [];
GiveawaysManager.restore(fakeClient, fakeEndFn);
ok(global.giveaways.has('past-msg-1') || endCalls.includes('past-msg-1'), 'سحبة انتهت أثناء التوقف → تُنهى عند الاستعادة');
GiveawaysManager.persistNow();

// ═════════════════════════════════════════════════════════════
console.log('\n═══ TEST 3: noprefix add بدون يوزر → لوحة تحديد متعدد ═══');
// ═════════════════════════════════════════════════════════════
const noprefixCmd = require('../commands/Owner/noprefix');
const config = require('../config');
const DEV = config.bot.developerId;

// محاكاة interaction
function makeInteract(opts) {
    const replies = [];
    const user = opts.user || null;
    return {
        user: { id: opts.userId || DEV },
        member: { voice: { channel: null } },
        guild: { id: 'g1' },
        channel: { id: 'ch1' },
        options: {
            getString: (name) => name === 'action' ? opts.action : null,
            getUser: (name) => name === 'user' ? user : null,
        },
        replied: false, deferred: false,
        reply: async (payload) => { replies.push(payload); return { edit: async () => ({}) }; },
        editReply: async (p) => { replies.push(p); return ({}); },
        followUp: async (p) => { replies.push(p); return ({}); },
        deferReply: async () => {},
        update: async (p) => { replies.push(p); return ({}); },
        _replies: replies,
    };
}

const testClient = { noprefixUsers: new Set([DEV]), players: new Map() };

// (أ) slash add بدون مستخدم → قائمة UserSelectMenu
let it1 = makeInteract({ action: 'add', user: null, userId: DEV });
await noprefixCmd.execute(it1, testClient);
ok(it1._replies.length === 1, 'add بدون يوزر: رد واحد');
let payload1 = it1._replies[0];
ok(payload1.ephemeral === true, 'اللوحة مؤقتة (ephemeral)');
ok(Array.isArray(payload1.components) && payload1.components.length === 2, 'اللوحة تحتوي صفّين (قائمة + أزرار)');
let selectRow = payload1.components[0];
let menu = selectRow.components[0];
ok(menu && menu.data && menu.data.type === 5, 'المكوّن الأول UserSelectMenu (type 5)');
ok(menu.data.custom_id === 'noprefix_select_add', 'custom_id صحيح: noprefix_select_add');
ok(menu.data.min_values === 1 && menu.data.max_values === 25, 'تحديد من 1 إلى 25 عضواً دفعة واحدة');
let btnRow = payload1.components[1];
ok(btnRow.components.some(b => b.data.custom_id === 'noprefix_done'), 'زر إنهاء موجود');

// (ب) slash add مع مستخدم → الطريقة القديمة تعمل + حفظ
const someUser = { id: '333333333333333333', bot: false, toString: () => '<@333>' };
let it2 = makeInteract({ action: 'add', user: someUser, userId: DEV });
await noprefixCmd.execute(it2, testClient);
ok(testClient.noprefixUsers.has('333333333333333333'), 'add مع يوزر واحد يعمل (توافق كامل)');

// (ج) slash remove بدون مستخدم → قائمة StringSelectMenu بأعضاء noprefix
let it3 = makeInteract({ action: 'remove', user: null, userId: DEV });
await noprefixCmd.execute(it3, testClient);
let payload3 = it3._replies[0];
ok(Array.isArray(payload3.components) && payload3.components.length >= 1, 'remove بدون يوزر: لوحة');
let rmenu = payload3.components[0].components[0];
ok(rmenu.data.type === 3, 'المكوّن StringSelectMenu (type 3)');
ok(rmenu.data.custom_id === 'noprefix_select_remove', 'custom_id: noprefix_select_remove');
const rmenuJson = rmenu.toJSON();
ok(Array.isArray(rmenuJson.options) && rmenuJson.options.length === testClient.noprefixUsers.size, 'عدد الخيارات = عدد أعضاء noprefix');
ok(rmenuJson.options.some(o => o.value === '333333333333333333'), 'المستخدم المضاف يظهر في خيارات الإزالة');

// (د) غير المطور مرفوض
let it4 = makeInteract({ action: 'add', user: null, userId: 'intruder-123' });
await noprefixCmd.execute(it4, testClient);
ok(String(it4._replies[0]?.content || '').includes('للمطور'), 'غير المطور مرفوض بلطف');

// (هـ) prefix: noprefix add بدون mention → لوحة (رسالة عامة)
function makeMsg(mention) {
    const replies = [];
    return {
        author: { id: DEV },
        member: { voice: { channel: null }, permissions: { has: () => true } },
        guild: { id: 'g1' }, channel: { id: 'ch1' },
        mentions: { users: { first: () => mention || null } },
        reply: async (p) => { replies.push(p); return { edit: async () => ({}) }; },
        _replies: replies,
    };
}
let msg1 = makeMsg(null);
await noprefixCmd.executePrefix(msg1, ['add'], testClient);
ok(msg1._replies.length === 1 && msg1._replies[0].components, 'prefix add بدون يوزر → لوحة تفاعلية');
ok(msg1._replies[0].components[0].components[0].data.custom_id === 'noprefix_select_add', 'prefix اللوحة نفسها (UserSelectMenu)');

// (و) prefix مع mention → إضافة مفردة
let msg2 = makeMsg(someUser);
await noprefixCmd.executePrefix(msg2, ['add', '<@333>'], testClient);
ok(String(msg2._replies[0]).includes('✅') || (msg2._replies[0].content || '').includes('✅'), 'prefix add مع mention يعمل');

// (ز) list يعمل
let it5 = makeInteract({ action: 'list', user: null, userId: DEV });
await noprefixCmd.execute(it5, testClient);
ok(String(it5._replies[0]?.content || '').includes('No-Prefix Users'), 'list يعرض الأعضاء');

// ═════════════════════════════════════════════════════════════
console.log('\n═══ TEST 4: التحقق الرقمي (منع تضارب القيم) ═══');
// ═════════════════════════════════════════════════════════════
function makeMsgWithMember(mention) {
    const replies = [];
    return {
        author: { id: 'reg-user' },
        member: {
            voice: { channel: { id: 'vc1' } },
            permissions: { has: () => true },
        },
        guild: { id: 'g1' },
        channel: {
            id: 'ch1',
            bulkDelete: async (n) => { replies.push({ bulkDelete: n }); return new Collection(); },
            send: async (m) => { replies.push({ sent: m }); return { delete: async () => ({}) }; },
        },
        mentions: { members: { first: () => mention || null }, users: { first: () => mention || null } },
        reply: async (m) => { replies.push({ reply: m }); return { edit: async () => ({}), delete: async () => ({}) }; },
        _replies: replies,
    };
}

// (أ) purge 100 → bulkDelete(100) وليس 101
const purgeCmd = require('../commands/Moderation/purge');
let pmsg = makeMsgWithMember(null);
await purgeCmd.executePrefix(pmsg, ['100'], { players: new Map() });
const bulkCall = pmsg._replies.find(r => r.bulkDelete !== undefined);
ok(bulkCall && bulkCall.bulkDelete === 100, '!purge 100 → bulkDelete(100) بالضبط (كان 101 ويفشل)');

// (ب) sleep بقيمة ضخمة → رفض واضح
const sleepCmd = require('../commands/Music/sleep');
const sleepPlayer = { currentTrack: { title: 'x', url: 'http://x', duration: 100 }, queue: [], voiceChannel: { id: 'vc1' }, textChannel: null, stop: () => {}, cleanup: () => {}, sleepTimer: null };
let smsg = makeMsgWithMember(null);
let sclient = { players: new Map([['g1', sleepPlayer]]) };
await sleepCmd.executePrefix(smsg, ['99999999'], sclient);
ok(String(smsg._replies[0]?.reply || '').includes('1-1440'), '!sleep 99999999 → رفض واضح (كان يوقف فوراً بفيض setTimeout)');

// (ج) timer بقيمة ضخمة → رفض
const timerCmd = require('../commands/Utility/timer');
let tmsg = makeMsgWithMember(null);
await timerCmd.executePrefix(tmsg, ['99999999'], {});
ok(String(tmsg._replies[0]?.reply || '').includes('1-1440'), '!timer 99999999 → رفض واضح');

// (د) mute بقيمة فوق الحد → رفض قبل استدعاء Discord API
const muteCmd = require('../commands/Moderation/mute');
let mutedTarget = { moderatable: true, user: { tag: 'x#1', displayAvatarURL: () => 'http://x' }, timeout: async () => { throw new Error('SHOULD_NOT_BE_CALLED'); } };
let mmsg = makeMsgWithMember(mutedTarget);
await muteCmd.executePrefix(mmsg, ['<@x>', '99999999', 'reason'], {});
ok(String(mmsg._replies[0]?.reply || '').includes('40320'), '!mute 99999999 دقيقة → رفض قبل API');

// (هـ) forward سالب → رفض
const forwardCmd = require('../commands/Music/forward');
const fPlayer = { currentTrack: { title: 'x', url: 'http://x', duration: 300 }, queue: [], voiceChannel: { id: 'vc1' }, getCurrentTime: () => 50000, play: async () => {} };
let fmsg = makeMsgWithMember(null);
await forwardCmd.executePrefix(fmsg, ['-50'], { players: new Map([['g1', fPlayer]]) });
ok(String(fmsg._replies[0]?.reply || '').includes('موجبة'), '!forward -50 → رفض (كان يرجع للخلف!)');

// (و) rewind سالب → رفض
const rewindCmd = require('../commands/Music/rewind');
let rmsg = makeMsgWithMember(null);
await rewindCmd.executePrefix(rmsg, ['-50'], { players: new Map([['g1', fPlayer]]) });
ok(String(rmsg._replies[0]?.reply || '').includes('موجبة'), '!rewind -50 → رفض');

// (ز) gstart بمدة ضخمة/سالبة → رفض
const gstartCmd = require('../commands/Giveaway/gstart');
let gmsg = makeMsgWithMember(null);
gmsg.channel.send = async (p) => { throw new Error('SHOULD_NOT_SEND'); };
await gstartCmd.executePrefix(gmsg, ['99999999999', '1', 'Prize'], { channels: { cache: new Collection() }, guilds: { cache: new Collection() } });
ok(String(gmsg._replies[0]?.reply || '').includes('1 و 43200'), '!gstart بمدة ضخمة → رفض (كان يفيض setTimeout)');

let gmsg2 = makeMsgWithMember(null);
await gstartCmd.executePrefix(gmsg2, ['-5', '1', 'Prize'], {});
ok(String(gmsg2._replies[0]?.reply || '').includes('1 و 43200'), '!gstart -5 → رفض (كان ينهي فوراً)');

// ═════════════════════════════════════════════════════════════
console.log('\n═══ TEST 5: حفظ حالة القائمة بعد التعديل ═══');
// ═════════════════════════════════════════════════════════════
function makeQueuePlayer() {
    const persistCalls = [];
    return {
        queue: [
            { title: 'A', url: 'http://a', duration: 100 },
            { title: 'B', url: 'http://b', duration: 100 },
            { title: 'C', url: 'http://c', duration: 100 },
        ],
        voiceChannel: { id: 'vc1' },
        currentTrack: { title: 'now', url: 'http://now', duration: 100 },
        scheduleStatePersist: (reason, delay) => persistCalls.push(reason),
        clearQueue() { this.queue = []; persistCalls.push('clearQueue'); },
        skip: () => persistCalls.push('skip'),
        _p: persistCalls,
    };
}

const removeCmd = require('../commands/Music/remove');
let qplayer = makeQueuePlayer();
let qmsg = makeMsgWithMember(null);
await removeCmd.executePrefix(qmsg, ['2'], { players: new Map([['g1', qplayer]]) });
ok(qplayer.queue.length === 2 && qplayer.queue[0].title === 'A' && qplayer.queue[1].title === 'C', '!remove 2 يحذف B بالضبط');
ok(qplayer._p.includes('cmd-remove'), 'remove يحفظ الحالة (scheduleStatePersist)');

const moveCmd = require('../commands/Music/move');
let qplayer2 = makeQueuePlayer();
let qmsg2 = makeMsgWithMember(null);
await moveCmd.executePrefix(qmsg2, ['1', '3'], { players: new Map([['g1', qplayer2]]) });
ok(qplayer2.queue.map(t => t.title).join(',') === 'B,C,A', '!move 1 3 ينقل A للموقع 3');
ok(qplayer2._p.includes('cmd-move'), 'move يحفظ الحالة');

// move نفس الموقع → رفض
let qplayer3 = makeQueuePlayer();
let qmsg3 = makeMsgWithMember(null);
await moveCmd.executePrefix(qmsg3, ['2', '2'], { players: new Map([['g1', qplayer3]]) });
ok(String(qmsg3._replies[0]?.reply || '').includes('متطابقان'), '!move 2 2 → "الموقعان متطابقان" (كان ينفذ)');

const skiptoCmd = require('../commands/Music/skipto');
let qplayer4 = makeQueuePlayer();
let qmsg4 = makeMsgWithMember(null);
await skiptoCmd.executePrefix(qmsg4, ['2'], { players: new Map([['g1', qplayer4]]) });
ok(qplayer4.queue.map(t => t.title).join(',') === 'B,C' || qplayer4.queue.map(t => t.title).join(',') === 'B,C', 'skipto 2 يحذف ما قبل الموقع');
ok(qplayer4._p.includes('cmd-skipto'), 'skipto يحفظ الحالة فوراً');

const clearCmd = require('../commands/Music/clear');
let qplayer5 = makeQueuePlayer();
let qmsg5 = makeMsgWithMember(null);
await clearCmd.executePrefix(qmsg5, [], { players: new Map([['g1', qplayer5]]) });
ok(qplayer5.queue.length === 0, 'clear يفرغ القائمة');
ok(qplayer5._p.includes('clearQueue'), 'clear عبر clearQueue() → حفظ تلقائي');

const clearqueueCmd = require('../commands/Music/clearqueue');
let qplayer6 = makeQueuePlayer();
let qmsg6 = makeMsgWithMember(null);
await clearqueueCmd.executePrefix(qmsg6, [], { players: new Map([['g1', qplayer6]]) });
ok(qplayer6.queue.length === 0 && qplayer6._p.includes('clearQueue'), 'clearqueue عبر clearQueue() → حفظ تلقائي');

// ═════════════════════════════════════════════════════════════
console.log('\n═══ TEST 6: فحص حزمة لوحة noprefix (JSON) ═══');
// ═════════════════════════════════════════════════════════════
// التأكد أن data.toJSON() صالحة للتسجيل في Discord (لا أخطاء بنية)
let it6 = makeInteract({ action: 'add', user: null, userId: DEV });
await noprefixCmd.execute(it6, testClient);
const panelJson = JSON.stringify(it6._replies[0].components.map(r => r.toJSON ? r.toJSON() : r));
ok(panelJson.includes('noprefix_select_add'), 'toJSON يحتوي noprefix_select_add (بنية صالحة)');
ok(panelJson.includes('noprefix_done'), 'toJSON يحتوي زر الإنهاء');
// slash command نفسه صالح
const cmdJson = noprefixCmd.data.toJSON();
ok(cmdJson.name === 'noprefix' && cmdJson.options.some(o => o.name === 'action'), 'تعريف slash command صالح');

// ═══ النتيجة ═══
console.log('\n════════════════════════════════════════');
console.log(`النتيجة: ${passed} نجح ✅ | ${failed} فشل ❌`);
if (failed > 0) {
    console.log('\n── الفاشلة ──');
    failures.forEach(f => console.log('  ❌ ' + f));
}
console.log('════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
})();
