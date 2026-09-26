// ═══════════════════════════════════════════════════════════════════════════
//  commands/Automod/automod.js — إدارة الإشراف التلقائي
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
//  يدعم: anti-link, anti-spam, anti-mention, anti-caps, anti-emoji, anti-NSFW
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../../config');

// مخزن إعدادات Automod لكل سيرفر
if (!global.automodSettings) global.automodSettings = new Map();

const MODULES = {
    antiLink: { name: 'Anti-Link', emoji: '🔗', desc: 'حظر روابط الديسكورد والـ URLs' },
    antiSpam: { name: 'Anti-Spam', emoji: '📨', desc: 'منع تكرار الرسائل (5 رسائل/3 ثواني)' },
    antiMention: { name: 'Anti-Mention', emoji: '@', desc: 'منع @everyone و @here بدون صلاحية' },
    antiCaps: { name: 'Anti-Caps', emoji: '🔠', desc: 'منع الرسائل بأحرف كبيرة (>70%)' },
    antiEmoji: { name: 'Anti-Emoji', emoji: '😀', desc: 'منع الإفراط في الإيموجي (>10)' },
    antiNsfw: { name: 'Anti-NSFW', emoji: '🔞', desc: 'حظر كلمات NSFW' },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Manage automod modules')
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('Action')
                .setRequired(true)
                .addChoices(
                    { name: 'Show current settings', value: 'show' },
                    { name: 'Enable all', value: 'enable_all' },
                    { name: 'Disable all', value: 'disable_all' },
                    { name: 'Toggle anti-link', value: 'toggle_antiLink' },
                    { name: 'Toggle anti-spam', value: 'toggle_antiSpam' },
                    { name: 'Toggle anti-mention', value: 'toggle_antiMention' },
                    { name: 'Toggle anti-caps', value: 'toggle_antiCaps' },
                    { name: 'Toggle anti-emoji', value: 'toggle_antiEmoji' },
                    { name: 'Toggle anti-NSFW', value: 'toggle_antiNsfw' },
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['am', 'auto-mod'],

    async execute(interaction, client) {
        const guildId = interaction.guild.id;
        const action = interaction.options.getString('action');

        // ✅ v26.3: حماية دفاعية — الخيار إلزامي لكن لا تسمح بانهيار البوت أبداً
        if (!action) {
            return interaction.reply({ content: '❌ حدد الإجراء: `show` أو `enable_all` أو `disable_all` أو `toggle_*`.', ephemeral: true });
        }

        if (!global.automodSettings.has(guildId)) {
            global.automodSettings.set(guildId, {
                antiLink: false,
                antiSpam: false,
                antiMention: false,
                antiCaps: false,
                antiEmoji: false,
                antiNsfw: false,
            });
        }
        const settings = global.automodSettings.get(guildId);

        let responseText = '';

        if (action === 'show') {
            let desc = '';
            for (const [key, info] of Object.entries(MODULES)) {
                const status = settings[key] ? '🟢 ON' : '🔴 OFF';
                desc += `${info.emoji} **${info.name}**: ${status} — ${info.desc}\n`;
            }
            responseText = desc;
        } else if (action === 'enable_all') {
            for (const key of Object.keys(MODULES)) settings[key] = true;
            responseText = '✅ **تم تفعيل كل وحدات Automod.**';
        } else if (action === 'disable_all') {
            for (const key of Object.keys(MODULES)) settings[key] = false;
            responseText = '❌ **تم تعطيل كل وحدات Automod.**';
        } else if (action.startsWith('toggle_')) {
            const key = action.replace('toggle_', '');
            settings[key] = !settings[key];
            const info = MODULES[key];
            responseText = `${info.emoji} **${info.name}**: ${settings[key] ? '🟢 ON' : '🔴 OFF'}`;
        }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🛡️ AutoMod Configuration')
            .setDescription(responseText)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ ليس لديك صلاحية `Manage Server`.');
        }
        const guildId = message.guild.id;
        if (!global.automodSettings.has(guildId)) {
            global.automodSettings.set(guildId, {
                antiLink: false, antiSpam: false, antiMention: false,
                antiCaps: false, antiEmoji: false, antiNsfw: false,
            });
        }
        const settings = global.automodSettings.get(guildId);
        const action = args[0]?.toLowerCase();

        if (!action || action === 'show') {
            let desc = '';
            for (const [key, info] of Object.entries(MODULES)) {
                const status = settings[key] ? '🟢 ON' : '🔴 OFF';
                desc += `${info.emoji} **${info.name}**: ${status}\n`;
            }
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('🛡️ AutoMod')
                .setDescription(desc)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }
        if (action === 'enable_all' || action === 'on') {
            for (const key of Object.keys(MODULES)) settings[key] = true;
            return message.reply('✅ تم تفعيل كل وحدات Automod.');
        }
        if (action === 'disable_all' || action === 'off') {
            for (const key of Object.keys(MODULES)) settings[key] = false;
            return message.reply('❌ تم تعطيل كل وحدات Automod.');
        }
        // toggle individual
        if (MODULES[action]) {
            settings[action] = !settings[action];
            return message.reply(`${MODULES[action].emoji} ${MODULES[action].name}: ${settings[action] ? 'ON' : 'OFF'}`);
        }
        message.reply('❌ استخدم: `!automod show|enable_all|disable_all|antiLink|antiSpam|...`');
    },
};
