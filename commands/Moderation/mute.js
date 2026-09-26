// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/mute.js — كتم عضو (timeout)
//  MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻
//  ✅ مع try/catch + ترجمة عربية للأخطاء + فحص hierarchy
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

function translateDiscordError(error) {
    const code = error?.code;
    const msg = error?.message || '';
    if (code === 50013 || /Missing Permissions/i.test(msg)) {
        return '❌ **صلاحيات غير كافية.** تأكد أن:\n• رتبة البوت أعلى من رتبة العضو\n• البوت يملك صلاحية `Moderate Members`\n• رتبة البوت أعلى من رتبة العضو المستهدف';
    }
    if (code === 50035 || /Invalid Form Body/i.test(msg)) {
        return '❌ مدة غير صالحة. الحد الأقصى للـ timeout هو 28 يوم (40320 دقيقة).';
    }
    return '❌ حدث خطأ غير متوقع: ' + msg;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Timeout a member (mute)')
        .addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true))
        .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setMinValue(1).setMaxValue(40320).setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    aliases: ['timeout', 'mt', 'اكتم'],

    async execute(interaction, client) {
        const user = interaction.options.getUser('user');
        const minutes = interaction.options.getInteger('minutes');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ لم أجد هذا العضو.', ephemeral: true });
        // ✅ member.moderatable يفحص hierarchy تلقائياً
        if (!member.moderatable) {
            return interaction.reply({ content: '❌ لا يمكنني كتم هذا العضو — رتبته أعلى من رتبتي أو لا أملك الصلاحيات.', ephemeral: true });
        }

        try {
            const duration = minutes * 60 * 1000;
            await member.timeout(duration, `${reason} | By: ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor('#FFAA00')
                .setTitle('🔇 Member Muted')
                .addFields(
                    { name: '👤 User', value: `${user.tag} (\`${user.id}\`)`, inline: true },
                    { name: '⏱️ Duration', value: `${minutes} minutes`, inline: true },
                    { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
                    { name: '📝 Reason', value: reason, inline: false }
                )
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Mute command error:', error.message);
            const reply = { content: translateDiscordError(error), ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply).catch(() => {});
            } else {
                await interaction.reply(reply).catch(() => {});
            }
        }
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('❌ ليس لديك صلاحية `Timeout Members`.');
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ استخدم: `!mute @user <minutes> [reason]`');
        const minutes = parseInt(args[1]);
        // ✅ v26.4: نفس حدود slash (1-40320) — القيم الأكبر كانت تصل
        // لخطأ Discord 50035 بعد فشل الطلب بدل رسالة واضحة مسبقاً
        if (!minutes || minutes < 1 || minutes > 40320) {
            return message.reply('❌ عدد الدقائق يجب أن يكون بين 1 و 40320 (حد أقصى 28 يوماً).');
        }
        if (!target.moderatable) {
            return message.reply('❌ لا يمكنني كتم هذا العضو — رتبته أعلى من رتبتي.');
        }
        const reason = args.slice(2).join(' ') || 'No reason provided';

        try {
            await target.timeout(minutes * 60 * 1000, `${reason} | By: ${message.author.tag}`);

            const embed = new EmbedBuilder()
                .setColor('#FFAA00')
                .setTitle('🔇 Muted')
                .setDescription(`**${target.user.tag}** تم كتمه لمدة **${minutes}** دقيقة.\n📝 **Reason:** ${reason}`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Mute prefix command error:', error.message);
            await message.reply(translateDiscordError(error)).catch(() => {});
        }
    },
};
