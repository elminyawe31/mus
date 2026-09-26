// ═══════════════════════════════════════════════════════════════════════════
//  commands/Utility/userinfo.js — معلومات العضو
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, formatEmoji } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Display info about a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to inspect').setRequired(false)),

    aliases: ['ui', 'whois', 'مستخدم'],

    async execute(interaction, client) {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`👤 ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
                { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        if (member) {
            const roles = member.roles.cache.size > 1
                ? member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => r.toString()).join(', ') || 'None'
                : 'None';

            const keyPerms = member.permissions.toArray()
                .filter(p => ['Administrator', 'ManageGuild', 'ManageChannels', 'KickMembers', 'BanMembers', 'ManageMessages', 'MentionEveryone'].includes(p));

            embed.addFields(
                { name: '📅 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🎭 Roles', value: `[${member.roles.cache.size - 1}] ${roles.substring(0, 1000)}${roles.length > 1000 ? '...' : ''}`, inline: false },
                { name: '⚡ Key Permissions', value: keyPerms.length > 0 ? keyPerms.map(p => `\`${p}\``).join(', ') : 'None', inline: false }
            );

            if (member.premiumSinceTimestamp) {
                embed.addFields({ name: '💎 Boosting Since', value: `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`, inline: true });
            }
        }

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const user = message.mentions.users.first() || message.author;
        const member = await message.guild.members.fetch(user.id).catch(() => null);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`👤 ${user.tag}`)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
                { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        if (member) {
            embed.addFields(
                { name: '📅 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🎭 Roles', value: `[${member.roles.cache.size - 1}]`, inline: true }
            );
        }

        await message.reply({ embeds: [embed] });
    },
};
