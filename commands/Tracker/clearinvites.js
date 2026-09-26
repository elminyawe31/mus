// ═══════════════════════════════════════════════════════════════════════════
//  commands/Tracker/clearinvites.js — تصفير دعوات مستخدم
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearinvites')
        .setDescription('Clear all invites for a user (admin only)')
        .addUserOption(opt => opt.setName('user').setDescription('User to clear invites for').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['ci2', 'resetinvites'],

    async execute(interaction, client) {
        const user = interaction.options.getUser('user');
        const invites = await interaction.guild.invites.fetch();
        const userInvites = invites.filter(inv => inv.inviter?.id === user.id);
        let deleted = 0;
        for (const [code] of userInvites) {
            try { await interaction.guild.invites.delete(code); deleted++; } catch (e) {}
        }
        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🗑️ Invites Cleared')
            .setDescription(`تم حذف **${deleted}** كود دعوة من ${user}.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return message.reply('❌ لا تملك الصلاحية.');
        const user = message.mentions.users.first();
        if (!user) return message.reply('❌ استخدم: `!clearinvites @user`');
        const invites = await message.guild.invites.fetch();
        const userInvites = invites.filter(inv => inv.inviter?.id === user.id);
        let deleted = 0;
        for (const [code] of userInvites) {
            try { await message.guild.invites.delete(code); deleted++; } catch (e) {}
        }
        await message.reply(`🗑️ تم حذف **${deleted}** كود دعوة.`);
    },
};
