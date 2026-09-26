// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/ban.js — حظر عضو من السيرفر
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
//  مستوحى من Groove-Music
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server')
        .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    aliases: ['b', 'حظر'],

    async execute(interaction, client) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: '❌ لم أجد هذا العضو في السيرفر.', ephemeral: true });
        }
        if (!member.bannable) {
            return interaction.reply({ content: '❌ لا يمكنني حظر هذا العضو (role hierarchy).', ephemeral: true });
        }
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: '❌ لا يمكنك حظر عضو برتبة أعلى أو مساوية لك.', ephemeral: true });
        }

        await member.ban({ reason: `${reason} | By: ${interaction.user.tag}` });

        const embed = new EmbedBuilder()
            .setColor('#FF4444')
            .setTitle('🔨 Member Banned')
            .addFields(
                { name: '👤 User', value: `${user.tag} (\`${user.id}\`)`, inline: true },
                { name: '🛡️ Moderator', value: `${interaction.user.tag}`, inline: true },
                { name: '📝 Reason', value: reason, inline: false }
            )
            .setThumbnail(user.displayAvatarURL())
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ ليس لديك صلاحية `Ban Members`.');
        }
        const target = message.mentions.members.first();
        if (!target) {
            return message.reply('❌ استخدم: `!ban @user [reason]`');
        }
        if (!target.bannable) {
            return message.reply('❌ لا يمكنني حظر هذا العضو.');
        }
        const reason = args.slice(1).join(' ') || 'No reason provided';
        await target.ban({ reason: `${reason} | By: ${message.author.tag}` });

        const embed = new EmbedBuilder()
            .setColor('#FF4444')
            .setTitle('🔨 Banned')
            .setDescription(`**${target.user.tag}** تم حظره.\n📝 **Reason:** ${reason}`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    },
};
