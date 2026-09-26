// ═══════════════════════════════════════════════════════════════════════════
//  index.js — MUS Bot v26.2 (Hybrid Commands + Resilience)
//  ─────────────────────────────────────────────────────────────────────────
//  المميزات:
//    • أوامر هجينة: slash commands (/play) + prefix commands (!play)
//    • نظام توقعات شامل (ResilienceManager)
//    • يدعم Railway (IPv6 native) + VPS (WARP fallback)
//    • Spotify + YouTube + SoundCloud + Direct Links
//    • 21 لغة بما فيها العربية
//    • Sharding تلقائي للسيرفرات الـ 1000+
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// 🔒 DEFENSE LAYER 1: Force presence at the very first line of execution.
//    Railway may pass STATUS env var with old "Beatra / play" value.
//    We ignore that and force "Dev : ELMINYAWE".
// ───────────────────────────────────────────────────────────────────────────
const FORCED_PRESENCE_NAME = 'Dev : ELMINYAWE';
const FORCED_PRESENCE_STATUS = 'idle'; // yellow (idle) circle
process.env.STATUS = FORCED_PRESENCE_NAME;
// Detect if STATUS contains "beatra" and override it (defensive)
if (process.env.STATUS && /beatra/i.test(process.env.STATUS)) {
    process.env.STATUS = FORCED_PRESENCE_NAME;
}

const { Client, GatewayIntentBits, Collection, Events, ActivityType, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const config = require('./config');
const PlayerStateManager = require('./src/PlayerStateManager');
const MusicPlayer = require('./src/MusicPlayer');
const ResilienceManager = require('./src/ResilienceManager');
// ✅ v26.3: مدير الأغاني المفضلة — يستعيد المفضلة المحفوظة عند الإقلاع
const LikedSongsManager = require('./src/LikedSongsManager');
// ✅ v26.4: حفظ دائم للإعدادات (noprefix/prefixes/ignored/blacklist) + السحبات
const SettingsStore = require('./src/SettingsStore');
const GiveawaysManager = require('./src/GiveawaysManager');
const chalk = require('chalk');


// ── تنظيف مجلد الـ cache عند الإقلاع ─────────────────────────────────────
async function cleanupAudioCache() {
    const cacheDir = path.join(__dirname, 'audio_cache');
    try {
        if (fs.existsSync(cacheDir)) {
            const files = await fsPromises.readdir(cacheDir);
            const protectedFiles = PlayerStateManager.getProtectedCacheFiles();
            let deletedCount = 0;
            let skippedCount = 0;
            for (const file of files) {
                const absolutePath = path.join(cacheDir, file);
                if (protectedFiles.has(path.resolve(absolutePath))) {
                    skippedCount++;
                    continue;
                }
                try {
                    await fsPromises.unlink(absolutePath);
                    deletedCount++;
                } catch (err) {
                    console.error(chalk.red(`❌ Failed to delete ${file}:`), err.message);
                }
            }
        } else {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
    } catch (error) {
        console.error(chalk.red('❌ Failed to cleanup audio cache:'), error.message);
    }
}

// ── استعادة جلسات البوت المحفوظة بعد restart ─────────────────────────────
async function restoreSavedPlayers(client) {
    const savedStates = PlayerStateManager.getAllStates();
    const entries = Object.entries(savedStates || {});
    if (entries.length === 0) return;

    console.log(chalk.cyan(`🔄 Found ${entries.length} saved session(s) to restore...`));

    for (const [guildId, state] of entries) {
        try {
            let guild = client.guilds.cache.get(guildId);
            if (!guild) {
                let retries = 3;
                while (!guild && retries > 0) {
                    try {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        guild = await client.guilds.fetch(guildId).catch(() => null);
                        if (guild) break;
                    } catch (error) {
                        retries--;
                    }
                }
            }

            if (!guild) {
                console.log(chalk.yellow(`⚠️ Guild ${guildId} not found, removing state...`));
                await PlayerStateManager.removeState(guildId);
                continue;
            }

            const voiceChannelId = state.voiceChannelId;
            const textChannelId = state.textChannelId;
            if (!voiceChannelId || !textChannelId) {
                await PlayerStateManager.removeState(guildId);
                continue;
            }

            let voiceChannel = guild.channels.cache.get(voiceChannelId) || await guild.channels.fetch(voiceChannelId).catch(() => null);
            let textChannel = guild.channels.cache.get(textChannelId) || await guild.channels.fetch(textChannelId).catch(() => null);

            const isVoiceValid = voiceChannel && typeof voiceChannel.isVoiceBased === 'function' && voiceChannel.isVoiceBased();
            const isTextValid = textChannel && typeof textChannel.isTextBased === 'function' && textChannel.isTextBased();
            if (!isVoiceValid || !isTextValid) {
                await PlayerStateManager.removeState(guildId);
                continue;
            }

            const player = new MusicPlayer(guild, textChannel, voiceChannel);
            client.players.set(guildId, player);

            try {
                await player.restoreFromState(state);
                console.log(chalk.green(`✅ Restored session for ${guild.name}`));
            } catch (error) {
                console.error(chalk.red(`❌ Failed to restore session for ${guild.name}:`), error.message);
                client.players.delete(guildId);
                player.cleanup();
                await PlayerStateManager.removeState(guildId);
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error during session restoration for ${guildId}:`), error.message);
            await PlayerStateManager.removeState(guildId);
        }
    }
}

// ── تأخير 5 ثوان لضمان تحميل كل الـ modules ──────────────────────────────
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,  // مطلوب للأوامر prefix
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMembers,
        ],
        partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
    });

    // ── Collections ──────────────────────────────────────────────────────
    client.commands = new Collection();
    client.players = new Collection();
    client.aliases = new Collection(); // للأوامر المختصرة (!p بدل !play)
    
    // ── Groove compatibility: emoji, custom classes, noprefix ─────────────
    try { client.emoji = require('./src/emojis.js'); } catch(e) { client.emoji = {}; }
    try { client.button = require('./src/custom/button.js'); } catch(e) {}
    try { client.embed = require('./src/custom/embed.js')(config.bot.embedColor || '#FF6B6B'); } catch(e) {}
    try { require('./src/custom/numformat')(client); } catch(e) {}
    try { client.logger = require('./src/utils/logger.js'); } catch(e) { client.logger = { log: (m) => console.log(m) }; }
    
    // NoPrefix system
    client.noprefixUsers = new Set();
    if (config.bot.developerId) client.noprefixUsers.add(config.bot.developerId);
    if (process.env.NOPREFIX_USERS) {
        process.env.NOPREFIX_USERS.split(',').forEach(id => client.noprefixUsers.add(id.trim()));
    }
    
    // Guild prefix system
    client.guildPrefixes = new Map();
    
    // Blacklist
    client.blacklistedUsers = new Set();
    
    // Ignored channels
    client.ignoredChannels = new Set();

    // ✅ v26.4: استعادة الإعدادات المحفوظة (noprefix/prefixes/ignored/blacklist)
    // كان كل شيء يضيع عند إعادة التشغيل — الآن يُستعاد من database/settings.json
    SettingsStore.loadInto(client);

    // ✅ v26.10: استعادة ثيم كارت الأغنية لكل سيرفر (من /lite و /dark)
    try {
        const themes = SettingsStore.getCardThemes();
        const MusicCardMod = require('./src/MusicCard');
        let restoredThemes = 0;
        for (const [gid, theme] of Object.entries(themes)) {
            MusicCardMod.setGuildTheme(gid, theme);
            restoredThemes++;
        }
        if (restoredThemes > 0) {
            console.log(`🎨 [CardTheme] استعادة ثيم ${restoredThemes} سيرفر (افتراضي: ${MusicCardMod.getDefaultTheme()})`);
        }
    } catch (e) { /* غير حرج */ }

    // ── Music Embed Manager ──────────────────────────────────────────────
    const MusicEmbedManager = require('./src/MusicEmbedManager');
    client.musicEmbedManager = new MusicEmbedManager(client);

    if (!global.clients) global.clients = {};
    global.clients.musicEmbedManager = client.musicEmbedManager;

    // ── Resilience Manager (نظام التوقعات) ──────────────────────────────
    client.resilience = new ResilienceManager(client);

    // ── ✅ v26.7: Stability Manager (التشغيل الدائم) ─────────────────────
    // مراقب ذاكرة + watchdog صوتي 24/7 + تنظيف intervals + نظافة كاش
    // يعمل تلقائياً بعد جاهزية البوت (لا يحتاج أي تكوين)
    require('./src/StabilityManager').init(client);
    
    // Make client.manager work like client.players (Groove compatibility)
    client.manager = {
        players: client.players,
        shoukaku: { setFilters: async () => {} },
    };

    // ── تحميل slash commands ────────────────────────────────────────────
    const loadCommands = () => {
        const commandsPath = path.join(__dirname, 'commands');
        if (!fs.existsSync(commandsPath)) {
            fs.mkdirSync(commandsPath, { recursive: true });
            return;
        }
        try {
            // Recursive command loader — supports nested directories
            const loadCommandsRecursive = (dir) => {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory()) {
                        loadCommandsRecursive(fullPath);
                    } else if (item.isFile() && item.name.endsWith('.js')) {
                        try {
                            const command = require(fullPath);
                            if ('data' in command && 'execute' in command) {
                                client.commands.set(command.data.name, command);
                                if (command.aliases && Array.isArray(command.aliases)) {
                                    command.aliases.forEach(alias => {
                                        client.aliases.set(alias, command.data.name);
                                    });
                                }
                                console.log(chalk.green(`✓ Loaded command: ${command.data.name}`));
                            }
                        } catch (loadErr) {
                            console.error(chalk.red(`❌ Failed to load ${item.name}: ${loadErr.message}`));
                        }
                    }
                }
            };
            loadCommandsRecursive(commandsPath);
        } catch (error) {
            console.log(chalk.yellow('⚠ No commands directory found, skipping.'));
        }
    };

    // ── تحميل event handlers ─────────────────────────────────────────────
    const loadEvents = () => {
        const eventsPath = path.join(__dirname, 'events');
        if (!fs.existsSync(eventsPath)) {
            fs.mkdirSync(eventsPath, { recursive: true });
            return;
        }
        try {
            const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
            for (const file of eventFiles) {
                try {
                    const event = require(path.join(eventsPath, file));
                    if (event.once) {
                        client.once(event.name, (...args) => event.execute(...args, client));
                    } else {
                        client.on(event.name, (...args) => event.execute(...args, client));
                    }
                    console.log(chalk.green(`✓ Loaded event: ${event.name}`));
                } catch (loadErr) {
                    console.error(chalk.red(`❌ Failed to load event ${file}: ${loadErr.message}`));
                }
            }
        } catch (error) {
            console.log(chalk.yellow('⚠ No events directory found.'));
        }
    };

    // ── Client Ready ──────────────────────────────────────────────────────
    const { REST, Routes } = require('discord.js');
    
    client.once(Events.ClientReady, async () => {
        console.log(chalk.green(`✅ [SHARD ${client.shard?.ids[0] ?? 0}] ${client.user.tag} is online!`));
        // ── 🔒 DEFENSE LAYER 2: Force presence immediately on ready ──────────
        // بصمة المطور "Dev : ELMINYAWE" + idle (دائرة صفراء)
        const applyForcedPresence = () => {
            try {
                client.user.setPresence({
                    status: FORCED_PRESENCE_STATUS,
                    activities: [{
                        name: FORCED_PRESENCE_NAME,
                        type: ActivityType.Listening,
                    }],
                });
            } catch (e) { /* ignore */ }
        };
        applyForcedPresence();
        console.log(chalk.cyan(`👨‍💻 [SHARD ${client.shard?.ids[0] ?? 0}] Presence FORCED: idle • Listening to "${FORCED_PRESENCE_NAME}"`));
        console.log(chalk.cyan(`🎵 [SHARD ${client.shard?.ids[0] ?? 0}] Serving ${client.guilds.cache.size} servers`));

        // Register slash commands via REST
        // ✅ v26.10: تسجيل ذكي يحترم حد ديسكورد (100 أمر CHAT_INPUT عام لكل تطبيق)
        // المشكلة: مع إضافة /lite و /dark صار العدد 101 > 100 → فشل التسجيل بالكامل!
        // الحل: lite و dark يُسجلان لكل سيرفر (guild commands) — ميزة إضافية:
        // يظهران فوراً بعد النشر بلا انتظار ساعة انتشار الأوامر العامة.
        try {
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || config.discord.token);
            const appId = process.env.CLIENT_ID || config.discord.clientId;
            const commands = [];
            for (const [, cmd] of client.commands) {
                if (cmd.data) commands.push(cmd.data.toJSON());
            }

            // الأوامر ذات النطاق السيرفري (فوق الحد العام أو تُفضَّل محلياً)
            const GUILD_SCOPED = new Set(['lite', 'dark']);
            const globalCmds = commands.filter(c => !GUILD_SCOPED.has(c.name));
            const guildCmds = commands.filter(c => GUILD_SCOPED.has(c.name));

            // 1) الأوامر العامة — من الشارد صفر فقط (الباقي تكرار بلا فائدة)
            const isPrimary = !client.shard || (client.shard.ids && client.shard.ids[0] === 0);
            if (isPrimary) {
                console.log(chalk.cyan(`🚀 Deploying ${globalCmds.length} global slash commands...`));
                await rest.put(Routes.applicationCommands(appId), { body: globalCmds });
                console.log(chalk.green(`✅ Successfully registered ${globalCmds.length} global slash commands.`));
            }

            // 2) أوامر lite/dark لكل سيرفر يملكه هذا الشارد (تحديث فوري)
            if (guildCmds.length > 0) {
                let guildOk = 0, guildFail = 0;
                for (const [, guild] of client.guilds.cache) {
                    try {
                        await rest.put(Routes.applicationGuildCommands(appId, guild.id), { body: guildCmds });
                        guildOk++;
                    } catch (e) { guildFail++; }
                }
                console.log(chalk.green(`🎨 Card theme commands (/${[...GUILD_SCOPED].join(' /')}) registered per-guild: ${guildOk} ok${guildFail ? `, ${guildFail} failed` : ''}`));
            }
        } catch (err) {
            console.error(chalk.red('❌ Failed to register slash commands:'), err.message);
        }
        console.log(chalk.magenta(`🌐 Environment: ${config.env.isRailway ? 'Railway' : 'VPS'} | IPv6: ${config.env.ipv6Available ? '✓' : '✗'} | Mode: ${config.env.connectionMode}`));
        console.log(chalk.blue(`📝 Commands: ${config.commands.enableSlash ? 'slash ✓' : 'slash ✗'} | ${config.commands.enablePrefix ? `prefix "${config.commands.prefix}" ✓` : 'prefix ✗'}`));

        // ✅ v26.4: استعادة السحبات الجارية + إعادة جدولتها
        // (السحبات التي انتهت أثناء التوقف تُنهى الآن وتُعلن نتائجها)
        try {
            GiveawaysManager.restore(client, async (cl, messageId) => {
                if (typeof global.endGiveaway === 'function') {
                    return await global.endGiveaway(cl, messageId);
                }
                return false;
            });
        } catch (e) {
            console.error(chalk.yellow('⚠️ Giveaways restore failed:'), e.message);
        }

        if (client.shard) {
            setTimeout(() => {
                client.shard.fetchClientValues('guilds.cache.size')
                    .then(results => {
                        const totalGuilds = results.reduce((acc, c) => acc + c, 0);
                        console.log(chalk.magenta(`🌐 Total servers across all shards: ${totalGuilds}`));
                    })
                    .catch(() => {});
            }, 10000);
        }

        // ── 🔒 DEFENSE LAYER 3: Presence Guard Monitor ───────────────────────
        //    كل 15 ثانية نفحص الـ presence الحالية. إذا كانت تحتوي "beatra"
        //    أو لم تكن "Dev : ELMINYAWE"، نعيد ضبطها فوراً.
        //    هذا يحمي من أي code path نسي تغيير الحالة.
        setInterval(() => {
            try {
                const current = client.user.presence;
                let needsReset = false;
                const activityName = current?.activities?.[0]?.name;
                if (!activityName) needsReset = true;
                else if (/beatra/i.test(activityName)) needsReset = true;
                else if (activityName !== FORCED_PRESENCE_NAME) needsReset = true;
                if (current?.status !== FORCED_PRESENCE_STATUS) needsReset = true;

                if (needsReset) {
                    client.user.setPresence({
                        status: FORCED_PRESENCE_STATUS,
                        activities: [{
                            name: FORCED_PRESENCE_NAME,
                            type: ActivityType.Listening,
                        }],
                    });
                    console.log(chalk.yellow(`🔒 [Presence Guard] Detected wrong presence (${activityName || 'none'}), reset to "${FORCED_PRESENCE_NAME}"`));
                }
            } catch (e) { /* ignore presence errors */ }
        }, 15000);

        // استعادة الجلسات (في وضع non-sharded)
        if (!client.shard) {
            console.log(chalk.cyan('⏳ Waiting for guilds to be cached...'));
            await new Promise(resolve => setTimeout(resolve, 5000));
            await client.restoreSessions();
        }
    });

    client.restoreSessions = async function() {
        console.log(chalk.cyan(`[SHARD ${client.shard?.ids?.[0] ?? 'N/A'}] 🔄 Starting session restore...`));
        await restoreSavedPlayers(client);
        await cleanupAudioCache();
        console.log(chalk.green(`[SHARD ${client.shard?.ids?.[0] ?? 'N/A'}] ✅ Session restore complete`));
    };

    // ── معالجة interactions (slash + autocomplete + buttons + menus) ──────
    client.on(Events.InteractionCreate, async interaction => {
        // ✅ v26.4: فحص القائمة السوداء للسيرفرات — كان global.blacklist
        // يُعبأ من أمر blacklist لكن لا أحد يفحصه أبداً (الحظر كان شكلياً!)
        if (interaction.inGuild() && global.blacklist?.has(interaction.guild.id)) {
            try {
                if (interaction.isRepliable() && !interaction.isAutocomplete()) {
                    await interaction.reply({ content: '⛔ هذا السيرفر محظور من استخدام البوت.', ephemeral: true }).catch(() => {});
                }
            } catch (e) { /* ignore */ }
            return;
        }

        // ── Autocomplete ──────────────────────────────────────────────────
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command && typeof command.autocomplete === 'function') {
                try { await command.autocomplete(interaction, client); }
                catch (e) { /* ignore autocomplete errors */ }
            }
            return;
        }

        // ── Slash commands ────────────────────────────────────────────────
        if (interaction.isChatInputCommand()) {
            if (!config.commands.enableSlash) return;
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(chalk.red(`❌ No command matching ${interaction.commandName}`));
                return;
            }
            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(chalk.red(`❌ Error executing ${interaction.commandName}:`), error.message);
                const errorMessage = '❌ حدث خطأ: ' + error.message;
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: errorMessage, ephemeral: true });
                    } else {
                        await interaction.reply({ content: errorMessage, ephemeral: true });
                    }
                } catch (e) { /* ignore */ }
            }
            return;
        }

        // ── Button interactions ──────────────────────────────────────────
        if (interaction.isButton()) {
            const customId = interaction.customId;
            const E = client.emoji || {};

            // Giveaway buttons
            if (customId === 'giveaway_join') {
                if (!global.giveaways || !global.giveaways.has(interaction.message.id)) {
                    return interaction.reply({ content: `${E.cross || '❌'} هذه السحبة منتهية.`, ephemeral: true });
                }
                const giveaway = global.giveaways.get(interaction.message.id);
                if (giveaway.participants.has(interaction.user.id)) {
                    giveaway.participants.delete(interaction.user.id);
                    GiveawaysManager._persistActive(); // ✅ v26.4: مزامنة القرص
                    return interaction.reply({ content: `${E.warn || '❌'} تم إلغاء دخولك.`, ephemeral: true });
                }
                giveaway.participants.add(interaction.user.id);
                // ✅ v26.4: احفظ المشاركين على القرص حتى لا تضيع السحبة عند إعادة التشغيل
                GiveawaysManager._persistActive();
                return interaction.reply({ content: `${E.check || '✅'} شاركت! (${giveaway.participants.size})`, ephemeral: true });
            }

            // ═══ NoPrefix panel buttons (v26.4 — تحديد متعدد) ═══════════
            if (customId === 'noprefix_done' || customId === 'noprefix_showlist') {
                const DEV_ID = config.bot.developerId || config.info.developerId;
                if (interaction.user.id !== DEV_ID) {
                    return interaction.reply({ content: '❌ هذه اللوحة للمطور فقط.', ephemeral: true }).catch(() => {});
                }
                if (!client.noprefixUsers) client.noprefixUsers = new Set();

                if (customId === 'noprefix_done') {
                    const doneEmbed = new EmbedBuilder()
                        .setColor('#43B581')
                        .setTitle('✔️ تم إغلاق لوحة No-Prefix')
                        .setDescription(`**إجمالي أعضاء noprefix الحاليين:** \`${client.noprefixUsers.size}\`\nالقائمة محفوظة على القرص ولن تضيع عند إعادة التشغيل.`)
                        .setFooter({ text: config.bot.signature })
                        .setTimestamp();
                    return interaction.update({ embeds: [doneEmbed], components: [] }).catch(() => {});
                }

                // noprefix_showlist — اعرض القائمة الحالية مؤقتاً
                if (client.noprefixUsers.size === 0) {
                    return interaction.reply({ content: '📋 لا يوجد مستخدمون في قائمة noprefix.', ephemeral: true });
                }
                const userList = Array.from(client.noprefixUsers).map(id => `<@${id}>`).join(', ');
                return interaction.reply({
                    content: `📋 **No-Prefix Users (${client.noprefixUsers.size}):**\n${userList}`,
                    ephemeral: true,
                }).catch(() => {});
            }

            // Search result buttons
            if (customId.startsWith('search_')) {
                if (customId === 'search_cancel') {
                    await interaction.update({ content: `${E.cross || '❌'} تم إلغاء البحث.`, embeds: [], components: [] }).catch(() => {});
                    return;
                }
                if (customId.startsWith('search_select_')) {
                    const index = parseInt(customId.replace('search_select_', ''));
                    // Get results from global.searchResults (stored by search command)
                    const searchData = global.searchResults?.get(interaction.user.id);
                    if (!searchData || !searchData.results || !searchData.results[index]) {
                        return interaction.update({ content: `${E.cross || '❌'} النتيجة غير متاحة أو انتهت صلاحيتها.`, embeds: [], components: [] }).catch(() => {});
                    }
                    const track = searchData.results[index];
                    const player = client.players.get(interaction.guild.id);
                    if (!player) {
                        return interaction.update({ content: `${E.cross || '❌'} لا يوجد مشغّل نشط.`, embeds: [], components: [] }).catch(() => {});
                    }
                    player.queue.push(track);
                    // ✅ حفظ الحالة بعد الإضافة حتى لا تُفقد الأغنية عند إعادة التشغيل
                    player.scheduleStatePersist?.('search-add', 200);
                    await interaction.update({ content: `${E.check || '✅'} تمت إضافة: **${track.title}** للقائمة`, embeds: [], components: [] }).catch(() => {});
                    // ✅ [FIX التضارب] لا تستدعِ play() إذا كانت هناك عملية تشغيل جارية (تنزيل حالي)
                    if (!player.currentTrack && !player._playInFlight) { await player.play(); }
                    // Clean up search results after use
                    global.searchResults?.delete(interaction.user.id);
                    return;
                }
            }

            // Music control buttons — customId format: music_ACTION:requesterId:sessionId
            if (customId.startsWith('music_')) {
                const E = client.emoji || {};
                const player = client.players.get(interaction.guild.id);
                if (!player) {
                    return interaction.reply({ content: `${E.cross || '❌'} لا يوجد مشغّل نشط.`, ephemeral: true });
                }
                if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
                    return interaction.reply({ content: `${E.warn || '⚠️'} يجب أن تكون في نفس القناة.`, ephemeral: true });
                }
                // Extract action from customId: music_pause:xxx:yyy → pause
                const parts = customId.split(':');
                const action = parts[0].replace('music_', '');

                // ✅ [FIX التضارب] التحقق من sessionId — الأزرار من رسائل قديمة (أغانٍ سابقة)
                // لا يجب أن تتحكم بالمشغل الحالي. الكود القديم كان يتجاهل الجلسة تماماً،
                // فكان ضغط زر من رسالة قديمة يسبب تخطياً/إيقافاً عشوائياً أثناء الانتقالات
                const buttonSessionId = parts.length > 2 ? parts[parts.length - 1] : null;
                if (buttonSessionId && player.sessionId && buttonSessionId !== player.sessionId) {
                    return interaction.reply({
                        content: `${E.warn || '⚠️'} هذه الرسالة قديمة — استخدم أزرار رسالة الأغنية الحالية.`,
                        ephemeral: true
                    }).catch(() => {});
                }
                try {
                    switch (action) {
                        case 'pause':
                            if (player.paused) { player.resume(); await interaction.reply({ content: `${E.play || '▶️'} استئناف`, ephemeral: true }); }
                            else { player.pause(); await interaction.reply({ content: `${E.pause || '⏸️'} إيقاف مؤقت`, ephemeral: true }); }
                            break;
                        case 'skip':
                            if (player.queue.length > 0 || player.loop === 'track') { player.skip(); await interaction.reply({ content: `${E.skip || '⏭️'} تخطّي`, ephemeral: true }); }
                            else { await interaction.reply({ content: `${E.cross || '❌'} لا يوجد أغانٍ تالية.`, ephemeral: true }); }
                            break;
                        case 'stop':
                            player.stop(); player.queue = []; player.cleanup?.(); client.players.delete(interaction.guild.id);
                            await interaction.reply({ content: `${E.stop || '⏹️'} إيقاف`, ephemeral: true });
                            break;
                        case 'queue':
                            if (player.queue.length === 0) { await interaction.reply({ content: `${E.blank || '📭'} القائمة فارغة.`, ephemeral: true }); }
                            else {
                                const list = player.queue.slice(0, 10).map((t, i) => `\`${i+1}.\` ${t.title}`).join('\n');
                                await interaction.reply({ content: `${E.hastag || '📋'} **Queue (${player.queue.length}):**\n${list}`, ephemeral: true });
                            }
                            break;
                        case 'shuffle':
                            for (let i = player.queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [player.queue[i], player.queue[j]] = [player.queue[j], player.queue[i]]; }
                            player.shuffle = !player.shuffle;
                            await interaction.reply({ content: `${E.shuffle || '🔀'} ${player.shuffle ? 'تفعيل' : 'إلغاء'} الخلط`, ephemeral: true });
                            break;
                        case 'volume':
                            await interaction.reply({ content: `${E.voldown || '🔊'} الصوت: ${player.volume}%`, ephemeral: true });
                            break;
                        case 'loop':
                            if (player.loop === 'track') { player.loop = 'queue'; await interaction.reply({ content: `${E.loop || '🔁'} Loop: Queue`, ephemeral: true }); }
                            else if (player.loop === 'queue') { player.loop = 'off'; await interaction.reply({ content: `${E.loop || '➡️'} Loop: Off`, ephemeral: true }); }
                            else { player.loop = 'track'; await interaction.reply({ content: `${E.loop || '🔂'} Loop: Track`, ephemeral: true }); }
                            break;
                        case 'autoplay':
                            player.autoplay = !player.autoplay;
                            await interaction.reply({ content: `${E.dance || '🎲'} Autoplay: ${player.autoplay ? 'ON' : 'OFF'}`, ephemeral: true });
                            break;
                        case 'lyrics':
                            if (player.currentTrack) { await interaction.reply({ content: `${E.youtube || '🎤'} استخدم /lyrics لـ ${player.currentTrack.title}`, ephemeral: true }); }
                            else { await interaction.reply({ content: `${E.cross || '❌'} لا يوجد شيء قيد التشغيل.`, ephemeral: true }); }
                            break;
                        default:
                            // For any unknown music_ button, just defer update to prevent "interaction failed"
                            await interaction.deferUpdate().catch(() => {});
                    }
                } catch (err) {
                    if (!interaction.replied) await interaction.reply({ content: `${E.cross || '❌'} خطأ: ` + err.message, ephemeral: true }).catch(() => {});
                }
                return;
            }

            // Unknown button — just acknowledge to prevent "interaction failed"
            // ✅ استثنِ أزرار تغيير اللغة (language_*) — لها handler خاص
            if (customId.startsWith('language_')) {
                const LanguageManager = require('./src/LanguageManager');
                try {
                    if (!interaction.member.permissions.has('ManageGuild')) {
                        const cur0 = LanguageManager.getServerLanguageSync(interaction.guild.id);
                        return interaction.reply({
                            content: LanguageManager.getTranslationSync(cur0, 'commands.language.permission_required_button'),
                            ephemeral: true,
                        });
                    }
                    const selectedLang = customId.replace('language_', '');
                    const code = LanguageManager.resolveCode(selectedLang);
                    if (!code) {
                        return interaction.reply({ content: `❌ \`${selectedLang}\` — unsupported language.`, ephemeral: true });
                    }
                    const success = await LanguageManager.setServerLanguage(interaction.guild.id, code);
                    if (!success) {
                        const curE = LanguageManager.getServerLanguageSync(interaction.guild.id);
                        return interaction.reply({
                            content: LanguageManager.getTranslationSync(curE, 'commands.language.error'),
                            ephemeral: true,
                        });
                    }
                    // ✅ v26.10: الرد بلغة السيرفر الجديدة نفسها (مترجم)
                    const newData = LanguageManager.getLanguageData(code) || {};
                    const t = (k) => LanguageManager.getTranslationSync(code, k);
                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle(t('commands.language.changed'))
                        .setDescription(
                            t('commands.language.changed_desc')
                                .replace('{language}', `${newData?.language?.flag || '🌐'} **${newData?.language?.name || code}**`)
                        )
                        .setFooter({ text: config.bot.signature })
                        .setTimestamp();
                    await interaction.update({ embeds: [embed], components: [] });
                } catch (err) {
                    console.error('Language button error:', err.message);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: '❌ ' + err.message, ephemeral: true }).catch(() => {});
                    }
                }
                return;
            }
            if (!interaction.replied) {
                await interaction.deferUpdate().catch(() => {});
            }
            return;
        }

        // ── Select menu interactions ──────────────────────────────────────
        // ملاحظة: help_menu له collector خاص في help.js — لا نتعامل معه هنا
        // لتجنب race condition بين collector والـ global handler.
        if (interaction.isStringSelectMenu()) {
            const E = client.emoji || {};

            // ═══ NoPrefix إزالة متعددة (v26.4) ═══════════════════════════
            if (interaction.customId === 'noprefix_select_remove') {
                const DEV_ID = config.bot.developerId || config.info.developerId;
                if (interaction.user.id !== DEV_ID) {
                    return interaction.reply({ content: '❌ هذه اللوحة للمطور فقط.', ephemeral: true }).catch(() => {});
                }
                if (!client.noprefixUsers) client.noprefixUsers = new Set();

                const selected = interaction.values || [];
                const removedMentions = [];
                for (const id of selected) {
                    if (client.noprefixUsers.delete(id)) removedMentions.push(`<@${id}>`);
                }
                SettingsStore.persistNoprefix(client.noprefixUsers);

                // أعد بناء اللوحة إن بقيت أعضاء، أو أغلقها إن فرغت
                const remaining = Array.from(client.noprefixUsers);
                if (remaining.length === 0) {
                    const doneEmbed = new EmbedBuilder()
                        .setColor('#43B581')
                        .setTitle('✔️ تمت إزالة جميع أعضاء No-Prefix')
                        .setDescription(`أُزيل ${removedMentions.length} عضواً. القائمة فارغة الآن.`)
                        .setFooter({ text: config.bot.signature })
                        .setTimestamp();
                    return interaction.update({ embeds: [doneEmbed], components: [] }).catch(() => {});
                }

                const options = remaining.slice(0, 25).map(id => ({
                    label: `معرّف: ${id}`,
                    value: id,
                    description: 'عضو noprefix — اضغط للإزالة',
                }));
                const select = new StringSelectMenuBuilder()
                    .setCustomId('noprefix_select_remove')
                    .setPlaceholder('👤 اختر الأعضاء الذين ستُزال صلاحيتهم…')
                    .setMinValues(1)
                    .setMaxValues(options.length)
                    .addOptions(options);
                const doneBtn = new ButtonBuilder()
                    .setCustomId('noprefix_done')
                    .setLabel('✔️ إنهاء')
                    .setStyle(ButtonStyle.Success);

                const embed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('👥 No-Prefix — إزالة متعددة')
                    .setDescription(
                        `✅ **أُزيل:** ${removedMentions.join(', ') || 'لا شيء'}\n\n` +
                        '**حدّد المزيد لإزالتهم، أو اضغط ✔️ إنهاء.**'
                    )
                    .addFields({ name: '📊 المتبقي', value: `\`${remaining.length}\``, inline: true })
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();

                return interaction.update({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder().addComponents(select),
                        new ActionRowBuilder().addComponents(doneBtn),
                    ],
                }).catch(() => {});
            }

            // help_menu محجوز لـ help.js collector — لا نتدخل فيه إطلاقاً.
            // فقط إذا لم يكن هناك collector نشط (help.js timeout) نرد بحيث
            // لا يظهر "Interaction Failed" للمستخدم.
            if (interaction.customId === 'help_menu') {
                // The help.js collector handles this. If we got here, the collector timed out.
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: `${E.warn || '⚠️'} انتهت صلاحية القائمة. استخدم \`/help\` مرة أخرى.`,
                        ephemeral: true,
                    }).catch(() => {});
                }
                return;
            }

            if (interaction.customId === 'mood_select') {
                // Handle mood selection
                await interaction.deferUpdate().catch(() => {});
                return;
            }

            // Unknown select menu
            if (!interaction.replied) {
                await interaction.deferUpdate().catch(() => {});
            }
            return;
        }

        // ── User select menu interactions (v26.4 — NoPrefix إضافة متعددة) ──
        if (interaction.isUserSelectMenu()) {
            const E = client.emoji || {};

            if (interaction.customId === 'noprefix_select_add') {
                const DEV_ID = config.bot.developerId || config.info.developerId;
                if (interaction.user.id !== DEV_ID) {
                    return interaction.reply({ content: '❌ هذه اللوحة للمطور فقط.', ephemeral: true }).catch(() => {});
                }
                if (!client.noprefixUsers) client.noprefixUsers = new Set();

                // ✅ interaction.users = المعضوون المحددون فعلياً (Collection<User>)
                const selectedUsers = Array.from((interaction.users || new Map()).values());
                if (selectedUsers.length === 0) {
                    return interaction.reply({ content: `${E.warn || '⚠️'} لم تحدد أحداً.`, ephemeral: true }).catch(() => {});
                }

                const addedMentions = [];
                const skippedMentions = [];
                for (const user of selectedUsers) {
                    if (user?.bot) { skippedMentions.push(`<@${user.id}> (بوت)`); continue; }
                    if (client.noprefixUsers.has(user.id)) { skippedMentions.push(`<@${user.id}> (موجود)`); continue; }
                    client.noprefixUsers.add(user.id);
                    addedMentions.push(`<@${user.id}>`);
                }
                SettingsStore.persistNoprefix(client.noprefixUsers);

                // أعد بناء اللوحة حتى يضيف دفعات أخرى + ملخص النتيجة
                const select = new UserSelectMenuBuilder()
                    .setCustomId('noprefix_select_add')
                    .setPlaceholder('👤 اختر المزيد من الأعضاء…')
                    .setMinValues(1)
                    .setMaxValues(25);
                const doneBtn = new ButtonBuilder()
                    .setCustomId('noprefix_done')
                    .setLabel('✔️ إنهاء')
                    .setStyle(ButtonStyle.Success);
                const listBtn = new ButtonBuilder()
                    .setCustomId('noprefix_showlist')
                    .setLabel('📋 القائمة الحالية')
                    .setStyle(ButtonStyle.Secondary);

                const summaryParts = [];
                if (addedMentions.length > 0) summaryParts.push(`✅ **أُضيف (${addedMentions.length}):** ${addedMentions.join(', ')}`);
                if (skippedMentions.length > 0) summaryParts.push(`⚠️ **تم تخطي (${skippedMentions.length}):** ${skippedMentions.join(', ')}`);

                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('👥 No-Prefix — إضافة متعددة')
                    .setDescription(
                        `${summaryParts.join('\n')}\n\n` +
                        '**حدّد المزيد من القائمة أدناه (حتى 25 دفعة)، أو اضغط ✔️ إنهاء.**'
                    )
                    .addFields({ name: '📊 إجمالي أعضاء noprefix', value: `\`${client.noprefixUsers.size}\``, inline: true })
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();

                return interaction.update({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder().addComponents(select),
                        new ActionRowBuilder().addComponents(doneBtn, listBtn),
                    ],
                }).catch(() => {});
            }

            // Unknown user select menu — احتراماً لعدم ظهور "Interaction Failed"
            if (!interaction.replied) {
                await interaction.deferUpdate().catch(() => {});
            }
            return;
        }
    });

    // ── معالجة prefix commands (noprefix + guild prefix + blacklist) ──────
    client.on(Events.MessageCreate, async message => {
        if (!config.commands.enablePrefix) return;
        if (message.author.bot) return;
        if (message.channel.type === 'DM') return;

        // Blacklist check
        if (client.blacklistedUsers?.has(message.author.id)) return;

        // ✅ v26.4: فحص القائمة السوداء للسيرفرات في الأوامر النصية أيضاً
        if (global.blacklist?.has(message.guild.id)) return;
        
        // Ignored channels check
        if (client.ignoredChannels?.has(message.channel.id)) return;

        // Get prefix (guild-specific or default)
        let prefix = config.commands.prefix;
        const guildPrefix = client.guildPrefixes?.get(message.guild.id);
        if (guildPrefix) prefix = guildPrefix;

        // Mention = show help
        const mentionPattern = new RegExp(`^<@!?${client.user.id}>( |)$`);
        if (message.content.match(mentionPattern)) {
            const E = client.emoji || {};
            return message.reply(`${E.youtube || '🎵'} **${config.bot.name}** | Prefix: \`${prefix}\` | Commands: \`${client.commands.size}\` | Dev: ELMINYAWE 👨‍💻`).catch(() => {});
        }

        // NoPrefix check
        const hasNoPrefix = client.noprefixUsers?.has(message.author.id) || message.author.id === config.bot.developerId;

        let usedPrefix = '';
        if (message.content.startsWith(prefix)) {
            usedPrefix = prefix;
        } else if (message.content.match(new RegExp(`^<@!?${client.user.id}>`))) {
            usedPrefix = message.content.match(new RegExp(`^<@!?${client.user.id}>`))[0];
        } else if (!hasNoPrefix) {
            return;
        }

        const args = message.content.slice(usedPrefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();
        if (!commandName) return;

        const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
        if (!command) return;

        if (config.commands.prefixAdminOnly && !hasNoPrefix) {
            if (!message.member || !message.member.permissions.has('Administrator')) {
                return message.reply('⚠️ الأوامر النصية مخصصة للمشرفين فقط.').catch(() => {});
            }
        }

        if (typeof command.executePrefix === 'function') {
            try {
                await command.executePrefix(message, args, client);
            } catch (error) {
                console.error(chalk.red(`❌ Error executing prefix ${commandName}:`), error.message);
                message.reply('❌ حدث خطأ أثناء تنفيذ الأمر!').catch(() => {});
            }
        } else {
            message.reply(`ℹ️ استخدم: \`/${command.data.name}\``).catch(() => {});
        }
    });

    // ── معالجة VoiceStateUpdate (التوقعات) ──────────────────────────────
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        try {
            await client.resilience.handleVoiceStateUpdate(oldState, newState);
        } catch (error) {
            console.error(chalk.red('❌ VoiceStateUpdate error:'), error);
        }
    });

    // ── معالجة طرد البوت من السيرفر ──────────────────────────────────────
    client.on(Events.GuildDelete, async guild => {
        console.log(chalk.yellow(`👋 Removed from guild: ${guild.name} (${guild.id})`));
        client.resilience.cleanupGuild(guild.id);
        await PlayerStateManager.removeState(guild.id).catch(() => {});
        // 🔒 DEFENSE LAYER 4: Re-assert presence on guild changes
        try {
            client.user.setPresence({
                status: FORCED_PRESENCE_STATUS,
                activities: [{ name: FORCED_PRESENCE_NAME, type: ActivityType.Listening }],
            });
        } catch (e) { /* ignore */ }
    });

    // ── عند الانضمام لسيرفر جديد ──────────────────────────────────────────
    client.on(Events.GuildCreate, async guild => {
        console.log(chalk.green(`🎉 Joined guild: ${guild.name} (${guild.id})`));
        // ✅ v26.10: سجّل أوامر الثيم (lite/dark) للسيرفر الجديد فوراً
        // (هي أوامر guild-scoped بسبب حد ديسكورد 100 أمر عام)
        try {
            const { REST, Routes } = require('discord.js');
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || config.discord.token);
            const appId = process.env.CLIENT_ID || config.discord.clientId;
            const themeCmds = [];
            for (const name of ['lite', 'dark']) {
                const cmd = client.commands.get(name);
                if (cmd?.data) themeCmds.push(cmd.data.toJSON());
            }
            if (themeCmds.length > 0) {
                await rest.put(Routes.applicationGuildCommands(appId, guild.id), { body: themeCmds });
                console.log(chalk.green(`🎨 [CardTheme] ${themeCmds.length} theme commands registered for new guild ${guild.id}`));
            }
        } catch (e) { /* غير حرج */ }
        // 🔒 Re-assert presence on guild join (some libraries reset it)
        try {
            client.user.setPresence({
                status: FORCED_PRESENCE_STATUS,
                activities: [{ name: FORCED_PRESENCE_NAME, type: ActivityType.Listening }],
            });
        } catch (e) { /* ignore */ }
    });

    // ── معالجة الإنهاء التدريجي ────────────────────────────────────────────
    const gracefulShutdown = async (signal) => {
        console.log(chalk.yellow(`\n🛑 ${signal} received — graceful shutdown...`));

        const savePromises = [];
        for (const [guildId, player] of client.players) {
            if (player && typeof player.persistState === 'function') {
                savePromises.push(player.persistState('shutdown', true).catch(err => {
                    console.error(chalk.red(`Failed to save state for guild ${guildId}:`), err);
                }));
            }
        }
        await Promise.all(savePromises);

        // ✅ v26.3: حفظ الأغاني المفضلة قبل الخروج
        try { LikedSongsManager.persistNow(); } catch (e) { /* ignore */ }

        // ✅ v26.10: حفظ لغات السيرفرات قبل الخروج (كانت تضيع قبل إعادة بناء المدير)
        try { require('./src/LanguageManager').persistNow(); } catch (e) { /* ignore */ }

        // ✅ v26.4: حفظ الإعدادات والسحبات قبل الخروج
        try { SettingsStore.persistNow(); } catch (e) { /* ignore */ }
        try { GiveawaysManager.persistNow(); } catch (e) { /* ignore */ }

        await new Promise(resolve => setTimeout(resolve, 1000));

        // اقطع كل اتصالات الصوت
        client.players.forEach((player, guildId) => {
            try {
                player.stop();
                const connection = getVoiceConnection(guildId);
                if (connection) connection.destroy();
            } catch (e) { /* ignore */ }
        });

        client.destroy();
        process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // ── معالجة الأخطاء غير الملتقطة ────────────────────────────────────────
    process.on('unhandledRejection', (reason) => {
        console.error(chalk.red('❌ Unhandled Rejection:'), reason);
        if (reason && reason.code) {
            switch (reason.code) {
                case 10062:
                    console.log(chalk.yellow('ℹ️ Interaction expired, ignoring...'));
                    return;
                case 40060:
                    console.log(chalk.yellow('ℹ️ Interaction already acknowledged, ignoring...'));
                    return;
                case 50013:
                    console.error(chalk.red('❌ Missing permissions'));
                    return;
            }
        }
        if (reason && reason.message && reason.message.includes('IP discovery')) {
            client.players.forEach(player => player?.cleanup?.());
            client.players.clear();
            return;
        }
    });

    process.on('uncaughtException', (error) => {
        console.error(chalk.red('❌ Uncaught Exception:'), error);
        if (error.code === 10062 || error.code === 40060) {
            console.log(chalk.yellow('ℹ️ Discord interaction error, continuing...'));
            return;
        }
        if (error.message && (error.message.includes('terminated') ||
            error.message.includes('ECONNRESET') ||
            error.message.includes('ETIMEDOUT'))) {
            console.log(chalk.yellow('⚠️ Network error, continuing...'));
            return;
        }
        console.log(chalk.red('🛑 Critical error, shutting down...'));
        client.players.forEach(player => player?.cleanup?.());
        client.players.clear();
        process.exit(1);
    });

    // ── تهيئة البوت ────────────────────────────────────────────────────────
    (async () => {
        try {
            console.log(chalk.blue('🤖 Starting MUS Bot v26.2...'));
            console.log(chalk.gray(`   Node: ${process.version} | Platform: ${process.platform}`));
            console.log(chalk.gray(`   Mode: ${config.env.connectionMode} | IPv6: ${config.env.ipv6Available ? 'yes' : 'no'} | Proxy: ${config.env.resolvedProxy || 'direct'}`));

            loadCommands();
            loadEvents();

            await client.login(config.discord.token);
        } catch (error) {
            console.error(chalk.red('❌ Failed to start bot:'), error);
            process.exit(1);
        }
    })();

    
