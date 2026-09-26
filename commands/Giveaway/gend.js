// ═══════════════════════════════════════════════════════════════════════════
//  commands/Giveaway/gend.js — إنهاء سحبة مبكراً
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gend')
        .setDescription('End a giveaway by message ID')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['giveawayend', 'ge'],

    async execute(interaction, client) {
        const messageId = interaction.options.getString('message_id');
        if (!global.giveaways || !global.giveaways.has(messageId)) {
            return interaction.reply({ content: '❌ لم أجد سحبة بهذا الـ ID.', ephemeral: true });
        }
        await interaction.deferReply();
        const ok = await global.endGiveaway(client, messageId);
        if (ok) {
            await interaction.editReply('✅ تم إنهاء السحبة.');
        } else {
            await interaction.editReply('❌ فشل إنهاء السحبة.');
        }
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ ليس لديك صلاحية.');
        }
        const messageId = args[0];
        if (!messageId) return message.reply('❌ استخدم: `!gend <message_id>`');
        if (!global.giveaways || !global.giveaways.has(messageId)) {
            return message.reply('❌ لم أجد سحبة بهذا الـ ID.');
        }
        const ok = await global.endGiveaway(client, messageId);
        await message.reply(ok ? '✅ تم إنهاء السحبة.' : '❌ فشل.');
    },
};
