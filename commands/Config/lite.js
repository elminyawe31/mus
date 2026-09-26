// ═══════════════════════════════════════════════════════════════════════════
//  commands/Config/lite.js — ثيم فاتح لكارت الأغنية
//  MUS Bot v26.10 — Dev: ELMINYAWE 👨‍💻
//  يعمل بثلاث طرق: /lite — !lite — lite (noprefix)
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { applyTheme, hasPermission, NO_PERM_TEXT } = require('../../src/CardThemeCommand');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lite')
        .setDescription('Set the music card theme to light mode (Lite)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['light', 'فاتح'],

    async execute(interaction, client) {
        if (!hasPermission(interaction.member)) {
            return interaction.reply({ content: NO_PERM_TEXT, ephemeral: true });
        }
        await applyTheme('ease', {
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
        await applyTheme('ease', {
            guild: message.guild,
            user: message.author,
            client,
            reply: (payload) => message.reply(payload),
        });
    },
};
