// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/purge.js — حذف رسائل متعددة
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
//  مستوحى من Groove-Music
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk delete messages in the channel')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    aliases: ['pg', 'purge-now', 'تنظيف'],

    async execute(interaction, client) {
        const amount = interaction.options.getInteger('amount');

        await interaction.deferReply({ ephemeral: true });

        try {
            const deleted = await interaction.channel.bulkDelete(amount, true);
            const embed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle('🧹 Purge Complete')
                .setDescription(`تم حذف **${deleted.size}** رسالة.`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply(`❌ فشل: ${err.message}`);
        }
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ ليس لديك صلاحية `Manage Messages`.');
        }
        const amount = parseInt(args[0]);
        if (!amount || amount < 1 || amount > 100) {
            return message.reply('❌ استخدم: `!purge <1-100>`');
        }
        try {
            // ✅ v26.4: احذف رسالة الأمر نفسها + العدد المطلوب مع احترام حد
            // Discord البالغ 100 — `!purge 100` كان يستدعي bulkDelete(101) ويفشل!
            const deleted = await message.channel.bulkDelete(Math.min(amount + 1, 100), true);
            const reply = await message.channel.send(`🧹 تم حذف **${Math.max(deleted.size - 1, 0)}** رسالة.`);
            setTimeout(() => reply.delete().catch(() => {}), 5000);
        } catch (err) {
            message.reply(`❌ فشل: ${err.message}`);
        }
    },
};
