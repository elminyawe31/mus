// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/skipto.js — تخطّي لرقم معين في القائمة
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skipto')
        .setDescription('Skip to a specific track in the queue by position')
        .addIntegerOption(opt =>
            opt.setName('position')
                .setDescription('Position in queue (1, 2, 3, ...)')
                .setMinValue(1)
                .setRequired(true)
        ),

    aliases: ['stt', 'jumpto', 'skipto'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ لا يوجد مشغّل نشط.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة.', ephemeral: true });
        }

        const position = interaction.options.getInteger('position');
        if (position > player.queue.length) {
            return interaction.reply({ content: `❌ لا توجد أغنية في الموقع ${position}. القائمة تحتوي على ${player.queue.length} أغنية فقط.`, ephemeral: true });
        }

        // احذف كل الأغانيات قبل الموقع المطلوب
        const removedCount = position - 1;
        player.queue.splice(0, removedCount);
        // ✅ v26.4: حفظ الحالة فوراً — لو فشل skip لأي سبب تبقى القائمة متطابقة مع القرص
        player.scheduleStatePersist?.('cmd-skipto', 200);
        player.skip();

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏭️ Skipped To')
            .setDescription(`تم التخطّي للأغنية رقم **${position}**.\nالقائمة التالية ستبدأ بها.`)
            .addFields({ name: '📊 Removed', value: `\`${removedCount}\` song(s)`, inline: true })
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) return message.reply('❌ لا يوجد مشغّل نشط.');
        const position = parseInt(args[0]);
        if (!position || position < 1) return message.reply('❌ استخدم: `!skipto <position>`');
        if (position > player.queue.length) return message.reply(`❌ لا توجد أغنية في الموقع ${position}.`);
        // ✅ v26.4: فحص القناة الصوتية (كان موجوداً في slash فقط — عدم اتساق)
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة.');
        }
        player.queue.splice(0, position - 1);
        // ✅ v26.4: حفظ الحالة فوراً
        player.scheduleStatePersist?.('cmd-skipto', 200);
        player.skip();
        await message.reply(`⏭️ تم التخطّي للأغنية رقم **${position}**.`);
    },
};
