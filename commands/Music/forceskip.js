// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/forceskip.js — تخطّي إجباري (للأدمن فقط)
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('forceskip')
        .setDescription('Force skip the current song (admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['fs', 'fskip', 'تخطي_اجباري'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }

        const skipped = player.currentTrack.title;
        const skippedUrl = player.currentTrack.url || '';
        player.skipRequested = true;
        player.skip();

        const embed = new EmbedBuilder()
            .setColor('#FF8800')
            .setTitle('⏩ Force Skipped')
            // ✅ v26.3: إصلاح الرابط الفارغ — كان [title]() يظهر كرابط مكسور
            .setDescription(`**[${skipped}](${skippedUrl})** تم تخطّيه إجبارياً.\n🛡️ By ${interaction.user}`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ ليس لديك صلاحية.');
        }
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) return message.reply('❌ لا يوجد شيء قيد التشغيل.');
        player.skip();
        await message.reply('⏩ تم التخطّي الإجباري.');
    },
};
