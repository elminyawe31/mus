// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/role.js — إضافة/إزالة رتبة من عضو
//  MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

/**
 * ✅ تحقق من الترتيب الهرمي للرتب:
 *   - رتبة البوت يجب أن تكون أعلى من رتبة الهدف
 *   - رتبة البوت يجب أن تكون أعلى من الرتبة المُراد إضافتها/إزالتها
 *   - رتبة المنفّذ يجب أن تكون أعلى من رتبة الهدف
 * @returns {string|null} رسالة خطأ بالعربية أو null إذا كان كل شيء OK
 */
function checkHierarchy(executor, target, role, botMember) {
    if (botMember.roles.highest.position <= target.roles.highest.position) {
        return `❌ لا أستطيع إدارة رتب ${target.user.tag} — رتبته أعلى من أو تساوي رتبتي.\n💡 ارفع رتبتي فوق رتبته في إعدادات السيرفر.`;
    }
    if (botMember.roles.highest.position <= role.position) {
        return `❌ لا أستطيع إدارة الرتبة ${role.name} — هي أعلى من أو تساوي رتبتي.\n💡 ارفع رتبتي فوقها في إعدادات السيرفر.`;
    }
    if (executor.roles.highest.position <= target.roles.highest.position) {
        return `❌ لا يمكنك إدارة رتب ${target.user.tag} — رتبته أعلى من أو تساوي رتبتك.`;
    }
    if (executor.roles.highest.position <= role.position) {
        return `❌ لا يمكنك إدارة الرتبة ${role.name} — هي أعلى من أو تساوي رتبتك.`;
    }
    if (role.managed) {
        return `❌ الرتبة ${role.name} مُدارة بواسطة تطبيق/بوت آخر — لا يمكن إضافتها/إزالتها يدوياً.`;
    }
    return null;
}

/**
 * ✅ ترجمة أخطاء Discord إلى رسائل عربية ودودة
 */
function translateDiscordError(error) {
    const code = error?.code;
    const msg = error?.message || '';
    if (code === 50013 || /Missing Permissions/i.test(msg)) {
        return '❌ **صلاحيات غير كافية.** تأكد أن:\n• رتبة البوت أعلى من رتبة العضو\n• رتبة البوت أعلى من الرتبة المُراد إضافتها\n• البوت يملك صلاحية `Manage Roles`';
    }
    if (code === 50001 || /Missing Access/i.test(msg)) {
        return '❌ لا أملك وصولاً لهذا المورد.';
    }
    if (code === 10011 || /Unknown Role/i.test(msg)) {
        return '❌ الرتبة غير موجودة.';
    }
    if (code === 10007 || /Unknown Member/i.test(msg)) {
        return '❌ العضو غير موجود في هذا السيرفر.';
    }
    return '❌ حدث خطأ غير متوقع: ' + msg;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Add or remove a role from a member')
        .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to add/remove').setRequired(true))
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('Add or remove?')
                .setRequired(false)
                .addChoices(
                    { name: 'add', value: 'add' },
                    { name: 'remove', value: 'remove' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    aliases: ['role-m', 'rolemanage'],

    async execute(interaction, client) {
        const member = interaction.options.getMember('user');
        const role = interaction.options.getRole('role');
        let action = interaction.options.getString('action');

        if (!member) return interaction.reply({ content: '❌ لم أجد العضو.', ephemeral: true });
        if (!role) return interaction.reply({ content: '❌ لم أجد الرتبة.', ephemeral: true });

        // ✅ فحص الترتيب الهرمي قبل أي محاولة تعديل
        const botMember = interaction.guild.members.me;
        const hierarchyError = checkHierarchy(interaction.member, member, role, botMember);
        if (hierarchyError) {
            return interaction.reply({ content: hierarchyError, ephemeral: true });
        }

        if (!action) {
            // auto-detect: إذا عنده الرتبة → remove, غير ذلك → add
            action = member.roles.cache.has(role.id) ? 'remove' : 'add';
        }

        try {
            if (action === 'add') {
                if (member.roles.cache.has(role.id)) {
                    return interaction.reply({ content: '⚠️ العضو لديه هذه الرتبة بالفعل.', ephemeral: true });
                }
                await member.roles.add(role, `By: ${interaction.user.tag}`);
                const embed = new EmbedBuilder()
                    .setColor('#43B581')
                    .setTitle('➕ Role Added')
                    .setDescription(`أُضيفت الرتبة ${role} إلى ${member}.\n🛡️ By ${interaction.user}`)
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
            } else {
                if (!member.roles.cache.has(role.id)) {
                    return interaction.reply({ content: '⚠️ العضو لا يملك هذه الرتبة.', ephemeral: true });
                }
                await member.roles.remove(role, `By: ${interaction.user.tag}`);
                const embed = new EmbedBuilder()
                    .setColor('#FF8800')
                    .setTitle('➖ Role Removed')
                    .setDescription(`أُزيلت الرتبة ${role} من ${member}.\n🛡️ By ${interaction.user}`)
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error('❌ Role command error:', error.message);
            const friendly = translateDiscordError(error);
            const reply = { content: friendly, ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply).catch(() => {});
            } else {
                await interaction.reply(reply).catch(() => {});
            }
        }
    },

    async executePrefix(message, args, client) {
        // ✅ فحص صلاحية المنفّذ
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply('❌ ليس لديك صلاحية `Manage Roles`.');
        }
        const target = message.mentions.members.first();
        const role = message.mentions.roles.first();
        if (!target || !role) return message.reply('❌ استخدم: `!role @user @role`');

        // ✅ فحص الترتيب الهرمي قبل أي محاولة تعديل
        const botMember = message.guild.members.me;
        const hierarchyError = checkHierarchy(message.member, target, role, botMember);
        if (hierarchyError) {
            return message.reply(hierarchyError);
        }

        try {
            if (target.roles.cache.has(role.id)) {
                await target.roles.remove(role, `By: ${message.author.tag}`);
                await message.reply(`➖ أزلت ${role} من ${target.user.tag}.`);
            } else {
                await target.roles.add(role, `By: ${message.author.tag}`);
                await message.reply(`➕ أضفت ${role} إلى ${target.user.tag}.`);
            }
        } catch (error) {
            console.error('❌ Role prefix command error:', error.message);
            await message.reply(translateDiscordError(error)).catch(() => {});
        }
    },
};
