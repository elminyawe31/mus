// ═══════════════════════════════════════════════════════════════════════════
//  commands/Utility/language.js — تغيير لغة البوت في السيرفر
//  MUS Bot v26.10 — Dev: ELMINYAWE 👨‍💻
//  ✅ v26.10:
//    - طبقة الحفظ أعيد بناؤها (انظر LanguageManager) — كانت معطلة بالكامل
//      بسبب node-json-db v2.6.0 → اللغة لم تكن تُحفظ أبداً
//    - !language عربي / !language Arabic / !language ar — كلها تعمل الآن (تطبيع)
//    - الردود مترجمة بلغة السيرفر نفسها
//    - الأزرار تعمل من الوضعين slash وprefix
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const LanguageManager = require('../../src/LanguageManager');
const config = require('../../config');

/** بناء قائمة اللغات من مجلد languages */
function readLanguagesList() {
    const languagesPath = path.join(__dirname, '..', '..', 'languages');
    if (!fs.existsSync(languagesPath)) return { error: 'missing_folder', languages: [], languagesPath };
    const languageFiles = fs.readdirSync(languagesPath).filter(file => file.endsWith('.json'));
    const languages = [];
    for (const file of languageFiles) {
        try {
            const langData = JSON.parse(fs.readFileSync(path.join(languagesPath, file), 'utf8'));
            if (langData.language) {
                languages.push({
                    code: langData.language.code,
                    name: langData.language.name,
                    flag: langData.language.flag,
                });
            }
        } catch (e) { /* تجاهل الملفات التالفة */ }
    }
    // ترتيب ثابت أبجدي بالاسم
    languages.sort((a, b) => String(a.name).localeCompare(String(b.name), 'en'));
    return { languages, languagesPath };
}

/** رسالة نجاح موحدة — مترجمة بلغة السيرفر الجديدة */
function successEmbed(langCode, langInfo, guildId) {
    const data = LanguageManager.getLanguageData(langCode) || {};
    const title = LanguageManager.getTranslationSync(langCode, 'commands.language.changed');
    const desc = LanguageManager.getTranslationSync(langCode, 'commands.language.changed_desc')
        .replace('{language}', `${langInfo?.flag || data?.language?.flag || '🌐'} **${langInfo?.name || data?.language?.name || langCode}**`);
    return new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(title)
        .setDescription(desc)
        .setFooter({ text: config.bot.signature })
        .setTimestamp();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('language')
        .setDescription('Changes server language')
        .addStringOption(opt =>
            opt.setName('code')
                .setDescription('Language code or name (ar, عربي, english…)')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['lang', 'لغة', 'لغه'],

    async autocomplete(interaction, client) {
        const focused = (interaction.options.getFocused() || '').toLowerCase().trim();
        const { languages } = readLanguagesList();
        const choices = [];
        for (const lang of languages) {
            const hay = `${lang.code} ${lang.name}`.toLowerCase();
            if (!focused || hay.includes(focused) || LanguageManager.normalizeLanguageCode(focused) === lang.code) {
                choices.push({ name: `${lang.flag} ${lang.name} (${lang.code})`, value: lang.code });
            }
        }
        await interaction.respond(choices.slice(0, 25)).catch(() => {});
    },

    async execute(interaction, client) {
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                const noPermissionTitle = await LanguageManager.getTranslation(interaction.guild.id, 'commands.language.errortitle');
                const noPermissionDesc = await LanguageManager.getTranslation(interaction.guild.id, 'commands.language.permission_required');
                const errorEmbed = new EmbedBuilder()
                    .setTitle(noPermissionTitle)
                    .setDescription(noPermissionDesc)
                    .setColor('#ff0000')
                    .setTimestamp();
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const guildId = interaction.guild.id;
            const { languages, error, languagesPath } = readLanguagesList();
            if (error === 'missing_folder' || languages.length === 0) {
                return interaction.reply({ content: '❌ languages/ folder missing or empty.', ephemeral: true });
            }

            // ── وسيط اختياري: غيّر مباشرة ──
            const provided = interaction.options.getString('code');
            if (provided) {
                const code = LanguageManager.resolveCode(provided);
                if (!code) {
                    const cur = LanguageManager.getServerLanguageSync(guildId);
                    const t = (k) => LanguageManager.getTranslationSync(cur, k);
                    const errEmbed = new EmbedBuilder()
                        .setTitle(t('commands.language.errortitle'))
                        .setDescription(`${t('commands.language.error')}\n\`${provided}\``)
                        .setColor('#ff0000')
                        .setTimestamp();
                    return interaction.reply({ embeds: [errEmbed], ephemeral: true });
                }
                const langInfo = languages.find(l => l.code === code);
                await LanguageManager.setServerLanguage(guildId, code);
                return interaction.reply({ embeds: [successEmbed(code, langInfo, guildId)] });
            }

            // ── بلا وسيط: اعرض قائمة الأزرار ──
            await interaction.reply(this._buildMenuPayload(guildId, languages));
        } catch (error) {
            console.error('❌ Language command error:', error.message);
            const cur = LanguageManager.getServerLanguageSync(interaction.guild?.id);
            const errorDes = LanguageManager.getTranslationSync(cur, 'commands.language.error2');
            const errorTitle = LanguageManager.getTranslationSync(cur, 'commands.language.errortitle');
            const errorEmbed = new EmbedBuilder()
                .setTitle(errorTitle)
                .setDescription(`${errorDes}\n\`${error.message}\``)
                .setColor('#ff0000')
                .setTimestamp();
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
            }
        }
    },

    /** بناء قائمة الأزرار — مشترك بين الوضعين */
    _buildMenuPayload(guildId, languages) {
        const currentLang = LanguageManager.getServerLanguageSync(guildId);
        const curFile = LanguageManager.getLanguageData(currentLang) || LanguageManager.getLanguageData('en');
        const currentLangData = languages.find(lang => lang.code === currentLang) || languages[0];

        const embed = new EmbedBuilder()
            .setTitle(curFile?.commands?.language?.title || '🌐 Language Selection')
            .setDescription(curFile?.commands?.language?.select || 'Choose your language:')
            .setColor('#0099ff')
            .setTimestamp()
            .addFields({
                name: curFile?.commands?.language?.current || 'Current',
                value: `${currentLangData.flag} ${currentLangData.name}`,
                inline: true,
            });

        const buttons = [];
        const rows = [];
        for (let i = 0; i < languages.length && rows.length < 5; i++) {
            const lang = languages[i];
            const button = new ButtonBuilder()
                .setCustomId(`language_${lang.code}`)
                .setLabel(lang.name)
                .setEmoji(lang.flag)
                .setStyle(lang.code === currentLang ? ButtonStyle.Primary : ButtonStyle.Secondary);
            buttons.push(button);
            if (buttons.length === 5 || i === languages.length - 1) {
                rows.push(new ActionRowBuilder().addComponents(...buttons));
                buttons.length = 0;
            }
        }
        return { embeds: [embed], components: rows };
    },

    async executePrefix(message, args, client) {
        try {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return message.reply('❌ ليس لديك صلاحية `Manage Server`.');
            }
            const guildId = message.guild.id;
            const { languages, error } = readLanguagesList();
            if (error === 'missing_folder' || languages.length === 0) {
                return message.reply('❌ مجلد اللغات غير موجود أو فارغ.');
            }

            // ── وسيط: غيّر مباشرة (يقبل الكود أو الاسم: عربي / Arabic / ar) ──
            if (args[0]) {
                const raw = args.join(' ').trim();
                const code = LanguageManager.resolveCode(raw);
                if (!code) {
                    const codes = languages.map(l => `${l.flag} \`${l.code}\``).join(' ');
                    return message.reply(`❌ اللغة \`${raw}\` غير متاحة.\n**المتاح:** ${codes}\nمثال: \`!language ar\` أو \`!language عربي\``);
                }
                const langInfo = languages.find(l => l.code === code);
                await LanguageManager.setServerLanguage(guildId, code);
                return message.reply({ embeds: [successEmbed(code, langInfo, guildId)] });
            }

            // ── بلا وسيط: اعرض القائمة بالأزرار ──
            return message.reply(this._buildMenuPayload(guildId, languages));
        } catch (error) {
            console.error('❌ Language prefix command error:', error.message);
            message.reply('❌ حدث خطأ: ' + error.message).catch(() => {});
        }
    },
};
