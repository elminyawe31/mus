// ═══════════════════════════════════════════════════════════════════════════
//  commands/Owner/noprefix.js — إدارة الوصول بدون prefix
//  MUS Bot v26.4 — Dev: ELMINYAWE 👨‍💻
//  ✅ يستخدم client.noprefixUsers (نفسه الذي يفحصه index.js) بدل global.
//  ✅ v26.4 — تحديد متعدد دفعة واحدة:
//     • noprefix add (بدون مستخدم) → قائمة UserSelectMenu تفاعلية تحدد
//       منها عدة أعضاء دفعة واحدة (حتى 25 في المرة) وتكرر حتى تنتهي.
//     • noprefix remove (بدون مستخدم) → قائمة بأعضاء noprefix الحاليين
//       تحدد منها عدة أعضاء وتُزال دفعة واحدة.
//     • القائمة تُحفظ على القرص (SettingsStore) ولا تضيع عند إعادة التشغيل.
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, UserSelectMenuBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const SettingsStore = require('../../src/SettingsStore');

const MAX_SELECT = 25;          // حد Discord لخيارات القائمة الواحدة
const DEV_ID = config.bot.developerId || config.info.developerId;

function isDeveloper(userId) {
    return userId === DEV_ID;
}

// ── بناء لوحة الإضافة التفاعلية (UserSelectMenu) ─────────────────────────
function buildAddPanel(currentCount) {
    const select = new UserSelectMenuBuilder()
        .setCustomId('noprefix_select_add')
        .setPlaceholder('👤 اختر الأعضاء الذين سيحصلون على noprefix…')
        .setMinValues(1)
        .setMaxValues(MAX_SELECT);

    const doneBtn = new ButtonBuilder()
        .setCustomId('noprefix_done')
        .setLabel('✔️ إنهاء')
        .setStyle(ButtonStyle.Success);

    const listBtn = new ButtonBuilder()
        .setCustomId('noprefix_showlist')
        .setLabel('📋 القائمة الحالية')
        .setStyle(ButtonStyle.Secondary);

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('👥 No-Prefix — إضافة متعددة')
        .setDescription(
            '**حدّد الأعضاء من القائمة أدناه (حتى 25 دفعة واحدة).**\n' +
            '> يمكنك تكرار التحديد لإضافة دفعات أخرى.\n' +
            '> اضغط ✔️ إنهاء عند الانتهاء.'
        )
        .addFields({ name: '📊 الأعضاء الحاليون', value: `\`${currentCount}\``, inline: true })
        .setFooter({ text: config.bot.signature })
        .setTimestamp();

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(select),
            new ActionRowBuilder().addComponents(doneBtn, listBtn),
        ],
    };
}

// ── بناء لوحة الإزالة التفاعلية (قائمة بأعضاء noprefix الحاليين) ───────────
function buildRemovePanel(client) {
    if (!client.noprefixUsers) client.noprefixUsers = new Set();
    const ids = Array.from(client.noprefixUsers);

    if (ids.length === 0) {
        return null; // لا يوجد شيء للإزالة
    }

    const options = ids.slice(0, MAX_SELECT).map(id => ({
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
            `**حدّد الأعضاء لإزالتهم من noprefix (حتى ${options.length} دفعة واحدة).**\n` +
            '> يمكنك تكرار التحديد لإزالة المزيد.\n' +
            '> اضغط ✔️ إنهاء عند الانتهاء.'
        )
        .addFields(
            { name: '📊 إجمالي الأعضاء', value: `\`${ids.length}\``, inline: true },
            ...(ids.length > MAX_SELECT ? [{ name: '⚠️ تنبيه', value: `تُعرض أول \`${MAX_SELECT}\` فقط — أزل ثم أعد فتح اللوحة للبقية.`, inline: false }] : [])
        )
        .setFooter({ text: config.bot.signature })
        .setTimestamp();

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(select),
            new ActionRowBuilder().addComponents(doneBtn),
        ],
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('noprefix')
        .setDescription('Add/remove users from no-prefix access (owner only)')
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('Add, remove, or list')
                .setRequired(true)
                .addChoices(
                    { name: 'add', value: 'add' },
                    { name: 'remove', value: 'remove' },
                    { name: 'list', value: 'list' }
                )
        )
        .addUserOption(opt => opt.setName('user').setDescription('User (leave empty to open a multi-select menu)').setRequired(false)),

    aliases: ['nop', 'nopfx'],

    async execute(interaction, client) {
        if (!isDeveloper(interaction.user.id)) {
            return interaction.reply({ content: '❌ هذا الأمر للمطور فقط.', ephemeral: true });
        }

        const action = interaction.options.getString('action');
        const user = interaction.options.getUser('user');

        if (!client.noprefixUsers) client.noprefixUsers = new Set();

        // ── list ────────────────────────────────────────────────────────
        if (action === 'list') {
            if (client.noprefixUsers.size === 0) {
                return interaction.reply({ content: '📋 لا يوجد مستخدمون في قائمة noprefix.', ephemeral: true });
            }
            const userList = Array.from(client.noprefixUsers).map(id => `<@${id}>`).join(', ');
            return interaction.reply({
                content: `📋 **No-Prefix Users (${client.noprefixUsers.size}):**\n${userList}`,
                ephemeral: true,
            });
        }

        // ── add ─────────────────────────────────────────────────────────
        if (action === 'add') {
            if (user) {
                // الطريقة القديمة: مستخدم واحد مباشرة
                client.noprefixUsers.add(user.id);
                SettingsStore.persistNoprefix(client.noprefixUsers);
                const embed = new EmbedBuilder()
                    .setColor('#43B581')
                    .setTitle('✅ No-Prefix Access Granted')
                    .setDescription(`${user} يمكنه الآن استخدام البوت بدون prefix.`)
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            // ✅ الطريقة الجديدة: قائمة تحديد متعدد دفعة واحدة
            return interaction.reply({ ...buildAddPanel(client.noprefixUsers.size), ephemeral: true });
        }

        // ── remove ──────────────────────────────────────────────────────
        if (action === 'remove') {
            if (user) {
                if (!client.noprefixUsers.has(user.id)) {
                    return interaction.reply({ content: '⚠️ هذا المستخدم ليس في قائمة noprefix.', ephemeral: true });
                }
                client.noprefixUsers.delete(user.id);
                SettingsStore.persistNoprefix(client.noprefixUsers);
                const embed = new EmbedBuilder()
                    .setColor('#FF4444')
                    .setTitle('❌ No-Prefix Access Removed')
                    .setDescription(`تم إزالة ${user} من قائمة noprefix.`)
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            // ✅ قائمة إزالة متعددة من الأعضاء الحاليين
            const panel = buildRemovePanel(client);
            if (!panel) {
                return interaction.reply({ content: '📋 لا يوجد مستخدمون في قائمة noprefix.', ephemeral: true });
            }
            return interaction.reply({ ...panel, ephemeral: true });
        }
    },

    async executePrefix(message, args, client) {
        if (!isDeveloper(message.author.id)) {
            return message.reply('❌ هذا الأمر للمطور فقط.');
        }
        if (!client.noprefixUsers) client.noprefixUsers = new Set();

        const action = args[0]?.toLowerCase();
        const target = message.mentions.users.first();

        if (action === 'list') {
            if (client.noprefixUsers.size === 0) return message.reply('📋 لا يوجد مستخدمون في قائمة noprefix.');
            const list = Array.from(client.noprefixUsers).map(id => `<@${id}>`).join(', ');
            return message.reply(`📋 **No-Prefix Users (${client.noprefixUsers.size}):**\n${list}`);
        }

        if (action === 'add') {
            if (target) {
                client.noprefixUsers.add(target.id);
                SettingsStore.persistNoprefix(client.noprefixUsers);
                return message.reply(`✅ ${target} يمكنه الآن استخدام البوت بدون prefix.`);
            }
            // ✅ بدون يوزر → افتح لوحة التحديد المتعدد
            const panel = buildAddPanel(client.noprefixUsers.size);
            return message.reply({ ...panel });
        }

        if (action === 'remove') {
            if (target) {
                if (!client.noprefixUsers.has(target.id)) {
                    return message.reply('⚠️ هذا المستخدم ليس في قائمة noprefix.');
                }
                client.noprefixUsers.delete(target.id);
                SettingsStore.persistNoprefix(client.noprefixUsers);
                return message.reply(`❌ تم إزالة ${target} من قائمة noprefix.`);
            }
            // ✅ بدون يوزر → لوحة إزالة متعددة
            const panel = buildRemovePanel(client);
            if (!panel) return message.reply('📋 لا يوجد مستخدمون في قائمة noprefix.');
            return message.reply({ ...panel });
        }

        return message.reply('❌ استخدم: `!noprefix <add|remove|list> [@user]`\n💡 `!noprefix add` بدون يوزر تفتح قائمة تحديد متعدد.');
    },
};
