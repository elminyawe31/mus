// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/unmute.js — إلغاء كتم عضو
//  MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻
//  ✅ مع try/catch + ترجمة عربية للأخطاء
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

function translateDiscordError(error) {
    const code = error?.code;
    const msg = error?.message || '';
    if (code === 50013 || /Missing Permissions/i.test(msg)) {
        return '❌ **صلاحيات غير كافية.** تأكد أن البوت يملك صلاحية `Moderate Members` ورتبته أعلى من رتبة العضو.';
    }
    return '❌ حدث خطأ غير متوقع: ' + msg;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove timeout from a member')
        .addUserOption(opt => opt.setName('user').setDescription('User to unmute').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    aliases: ['untimeout', 'um', 'فك_الكتم'],

    async execute(interaction, client) {
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ لم أجد هذا العضو.', ephemeral: true });
        if (!member.isCommunicationDisabled()) {
            return interaction.reply({ content: '⚠️ هذا العضو ليس مكتوماً.', ephemeral: true });
        }
        if (!member.moderatable) {
            return interaction.reply({ content: '❌ لا يمكنني إلغاء كتم هذا العضو — رتبته أعلى من رتبتي.', ephemeral: true });
        }

        try {
            await member.timeout(null, `Unmuted by ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle('🔊 Member Unmuted')
                .addFields(
                    { name: '👤 User', value: `${user.tag} (\`${user.id}\`)`, inline: true },
                    { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true }
                )
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Unmute command error:', error.message);
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
        if (!target) return message.reply('❌ استخدم: `!unmute @user`');
        if (!target.isCommunicationDisabled()) return message.reply('⚠️ هذا العضو ليس مكتوماً.');
        if (!target.moderatable) return message.reply('❌ لا يمكنني إلغاء كتم هذا العضو — رتبته أعلى من رتبتي.');

        try {
            await target.timeout(null, `Unmuted by ${message.author.tag}`);

            const embed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle('🔊 Unmuted')
                .setDescription(`**${target.user.tag}** تم إلغاء كتمه.`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Unmute prefix command error:', error.message);
            await message.reply(translateDiscordError(error)).catch(() => {});
        }
    },
};
