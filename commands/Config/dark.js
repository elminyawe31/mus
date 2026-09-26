// ═══════════════════════════════════════════════════════════════════════════
//  commands/Config/dark.js — ثيم داكن لكارت الأغنية
//  MUS Bot v26.10 — Dev: ELMINYAWE 👨‍💻
//  يعمل بثلاث طرق: /dark — !dark — dark (noprefix)
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { applyTheme, hasPermission, NO_PERM_TEXT } = require('../../src/CardThemeCommand');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dark')
        .setDescription('Set the music card theme to dark mode (Dark)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['daek', 'darkmode', 'داكن'],

    async execute(interaction, client) {
        if (!hasPermission(interaction.member)) {
            return interaction.reply({ content: NO_PERM_TEXT, ephemeral: true });
        }
        await applyTheme('ease-dark', {
            guild: interaction.guild,
            user: interaction.user,
            client,
            reply: (payload) => interaction.reply(payload),
        });
    },

    async executePrefix(message, args, client) {
        if (!hasPermission(message.member)) {
            return message.reply(NO_PERM_TEXT);
        }
        await applyTheme('ease-dark', {
            guild: message.guild,
            user: message.author,
            client,
            reply: (payload) => message.reply(payload),
        });
    },
};
