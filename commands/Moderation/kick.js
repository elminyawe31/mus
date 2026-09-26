// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/kick.js — طرد عضو من السيرفر
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    aliases: ['k', 'طرد'],

    async execute(interaction, client) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ لم أجد هذا العضو.', ephemeral: true });
        if (!member.kickable) return interaction.reply({ content: '❌ لا يمكنني طرد هذا العضو.', ephemeral: true });
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: '❌ لا يمكنك طرد عضو برتبة أعلى.', ephemeral: true });
        }

        await member.kick(`${reason} | By: ${interaction.user.tag}`);

        const embed = new EmbedBuilder()
            .setColor('#FF8800')
            .setTitle('👢 Member Kicked')
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
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('❌ ليس لديك صلاحية `Kick Members`.');
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('❌ استخدم: `!kick @user [reason]`');
        if (!target.kickable) return message.reply('❌ لا يمكنني طرد هذا العضو.');
        const reason = args.slice(1).join(' ') || 'No reason provided';
        await target.kick(`${reason} | By: ${message.author.tag}`);

        const embed = new EmbedBuilder()
            .setColor('#FF8800')
            .setTitle('👢 Kicked')
            .setDescription(`**${target.user.tag}** تم طرده.\n📝 **Reason:** ${reason}`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    },
};
