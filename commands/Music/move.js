// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/move.js — نقل أغنية من موقع لآخر في القائمة
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Move a song from one position to another in the queue')
        .addIntegerOption(opt =>
            opt.setName('from')
                .setDescription('Current position (1, 2, ...)')
                .setMinValue(1)
                .setRequired(true)
        )
        .addIntegerOption(opt =>
            opt.setName('to')
                .setDescription('New position (1, 2, ...)')
                .setMinValue(1)
                .setRequired(true)
        ),

    aliases: ['mv', 'm'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || player.queue.length === 0) {
            return interaction.reply({ content: '❌ القائمة فارغة.', ephemeral: true });
        }

        const from = interaction.options.getInteger('from');
        const to = interaction.options.getInteger('to');

        if (from > player.queue.length || to > player.queue.length) {
            return interaction.reply({ content: `❌ الموقع خارج النطاق. القائمة تحتوي على ${player.queue.length} أغنية.`, ephemeral: true });
        }
        if (from === to) {
            return interaction.reply({ content: '⚠️ الموقعان متطابقان.', ephemeral: true });
        }

        // اخرج الأغنية من الموقع from
        const [moved] = player.queue.splice(from - 1, 1);
        // أدخلها في الموقع to
        player.queue.splice(to - 1, 0, moved);
        // ✅ v26.4: حفظ الحالة — بدون هذا يعود النقل لحالته بعد إعادة التشغيل
        player.scheduleStatePersist?.('cmd-move', 200);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🔄 Moved')
            .setDescription(`تم نقل:\n**[${moved.title}](${moved.url})**\nمن **#${from}** إلى **#${to}**`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || player.queue.length === 0) return message.reply('❌ القائمة فارغة.');
        const from = parseInt(args[0]);
        const to = parseInt(args[1]);
        if (!from || !to) return message.reply('❌ استخدم: `!move <from> <to>`');
        if (from < 1 || to < 1 || from > player.queue.length || to > player.queue.length) return message.reply(`❌ موقع خارج النطاق — القائمة تحتوي على ${player.queue.length} أغنية.`);
        // ✅ v26.4: نفس فحص slash (كان مفقوداً — النقل لنفس الموقع كان يُنفّذ)
        if (from === to) return message.reply('⚠️ الموقعان متطابقان.');
        const [moved] = player.queue.splice(from - 1, 1);
        player.queue.splice(to - 1, 0, moved);
        // ✅ v26.4: حفظ الحالة
        player.scheduleStatePersist?.('cmd-move', 200);
        await message.reply(`🔄 تم نقل **${moved.title}** من #${from} إلى #${to}.`);
    },
};
