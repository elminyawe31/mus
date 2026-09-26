// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/unban.js — رفع الحظر عن مستخدم
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user by ID')
        .addStringOption(opt => opt.setName('user_id').setDescription('User ID to unban').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    aliases: ['ub', 'فك_الحظر'],

    async execute(interaction, client) {
        const userId = interaction.options.getString('user_id');
        const bans = await interaction.guild.bans.fetch();
        if (!bans.has(userId)) {
            return interaction.reply({ content: '❌ هذا المستخدم غير محظور.', ephemeral: true });
        }
        await interaction.guild.members.unban(userId, `By: ${interaction.user.tag}`);

        const embed = new EmbedBuilder()
            .setColor('#43B581')
            .setTitle('🔓 User Unbanned')
            .setDescription(`تم رفع الحظر عن: \`${userId}\`\n🛡️ By ${interaction.user}`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ ليس لديك صلاحية `Ban Members`.');
        }
        const userId = args[0];
        if (!userId) return message.reply('❌ استخدم: `!unban <user_id>`');
        try {
            await message.guild.members.unban(userId);
            await message.reply(`🔓 تم رفع الحظر عن \`${userId}\`.`);
        } catch (err) {
            await message.reply(`❌ فشل: ${err.message}`);
        }
    },
};
