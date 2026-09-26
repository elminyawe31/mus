// ═══════════════════════════════════════════════════════════════════════════
//  commands/Utility/roleinfo.js — معلومات الرتبة
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleinfo')
        .setDescription('Display info about a role')
        .addRoleOption(opt => opt.setName('role').setDescription('Role to inspect').setRequired(true)),

    aliases: ['ri', 'رتبة'],

    async execute(interaction, client) {
        const role = interaction.options.getRole('role');

        const embed = new EmbedBuilder()
            .setColor(role.color || config.bot.embedColor)
            .setTitle(`🎭 ${role.name}`)
            .addFields(
                { name: '🆔 ID', value: `\`${role.id}\``, inline: true },
                { name: '👥 Members', value: `\`${role.members.size}\``, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🎨 Color', value: role.color ? `\`#${role.color.toString(16).padStart(6, '0')}\`` : 'Default', inline: true },
                { name: '📌 Position', value: `\`${role.position}\``, inline: true },
                { name: '💎 Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
                { name: '🔐 Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
                { name: '🤖 Managed', value: role.managed ? 'Yes' : 'No', inline: true },
                { name: '🔑 Permissions', value: role.permissions.toArray().length > 0 ? role.permissions.toArray().map(p => `\`${p}\``).join(', ').substring(0, 1000) : 'None', inline: false }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const role = message.mentions.roles.first();
        if (!role) return message.reply('❌ استخدم: `!roleinfo @role`');

        const embed = new EmbedBuilder()
            .setColor(role.color || config.bot.embedColor)
            .setTitle(`🎭 ${role.name}`)
            .addFields(
                { name: '🆔 ID', value: `\`${role.id}\``, inline: true },
                { name: '👥 Members', value: `\`${role.members.size}\``, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await message.reply({ embeds: [embed] });
    },
};
