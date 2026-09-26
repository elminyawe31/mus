// ═══════════════════════════════════════════════════════════════════════════
//  commands/Giveaway/greroll.js — إعادة سحب فائز من سحبة منتهية
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const GiveawaysManager = require('../../src/GiveawaysManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('greroll')
        .setDescription('Reroll a giveaway winner by message ID')
        .addStringOption(opt => opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['gr', 'giveawayreroll'],

    async execute(interaction, client) {
        const messageId = interaction.options.getString('message_id');
        await interaction.deferReply();

        try {
            const msg = await interaction.channel.messages.fetch(messageId).catch(() => null);
            if (!msg) return interaction.editReply('❌ لم أجد الرسالة.');

            // اقرأ الـ reactions (button)
            // في حالتنا، الـ giveaway يخزّن الـ participants في global.giveaways
            // ✅ v26.4: وإذا كانت السحبة منتهية، اقرأ المشاركين من الأرشيف المحفوظ
            let participants = null;
            let prize = null;
            if (global.giveaways && global.giveaways.has(messageId)) {
                const giveaway = global.giveaways.get(messageId);
                participants = Array.from(giveaway.participants);
                prize = giveaway.prize;
            } else {
                const archived = GiveawaysManager.getArchived(messageId);
                if (archived && Array.isArray(archived.participants) && archived.participants.length > 0) {
                    participants = archived.participants;
                    prize = archived.prize;
                }
            }
            if (!participants) {
                return interaction.editReply('❌ لم أجد هذه السحبة — لا هي جارية ولا مؤرشفة (الأرشيف يحفظ آخر 50 سحبة).');
            }
            if (participants.length === 0) {
                return interaction.editReply('❌ لا يوجد مشاركين.');
            }

            const newWinner = participants[Math.floor(Math.random() * participants.length)];
            await interaction.channel.send(`🎉 New winner: <@${newWinner}>! Congratulations on **${prize || 'the prize'}**!`);
            await interaction.editReply('✅ تمت إعادة السحب.');
        } catch (err) {
            await interaction.editReply(`❌ فشل: ${err.message}`);
        }
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ ليس لديك صلاحية.');
        }
        const messageId = args[0];
        if (!messageId) return message.reply('❌ استخدم: `!greroll <message_id>`');

        if (!global.giveaways || !global.giveaways.has(messageId)) {
            // ✅ v26.4: اقرأ من الأرشيف — إعادة السحب تعمل الآن بعد نهاية السحبة
            const archived = GiveawaysManager.getArchived(messageId);
            if (!archived || !Array.isArray(archived.participants) || archived.participants.length === 0) {
                return message.reply('❌ لم أجد هذه السحبة — لا هي جارية ولا مؤرشفة.');
            }
            const newWinner = archived.participants[Math.floor(Math.random() * archived.participants.length)];
            return message.channel.send(`🎉 New winner: <@${newWinner}>! Congratulations on **${archived.prize || 'the prize'}**!`);
        }
        const giveaway = global.giveaways.get(messageId);
        const participants = Array.from(giveaway.participants);
        if (participants.length === 0) return message.reply('❌ لا يوجد مشاركين.');
        const newWinner = participants[Math.floor(Math.random() * participants.length)];
        await message.channel.send(`🎉 New winner: <@${newWinner}>! Congratulations on **${giveaway.prize}**!`);
    },
};
