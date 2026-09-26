// ═══════════════════════════════════════════════════════════════════════════
//  commands/remove.js — إزالة أغنية من القائمة برقمها
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from the queue by its position number')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('Position in queue (1, 2, 3, ...)')
                .setMinValue(1)
                .setRequired(true)
        ),

    aliases: ['rm', 'delete', 'حذف'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ لا يوجد قائمة انتظار.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        const position = interaction.options.getInteger('position');

        if (position > player.queue.length) {
            return interaction.reply({ content: `❌ لا توجد أغنية في الموقع ${position}. القائمة تحتوي على ${player.queue.length} أغنية فقط.`, ephemeral: true });
        }

        const removedTrack = player.queue.splice(position - 1, 1)[0];
        // ✅ v26.4: حفظ الحالة — بدون هذا تعود الأغنية المحذوفة بعد إعادة التشغيل
        player.scheduleStatePersist?.('cmd-remove', 200);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🗑️ Removed')
            .setDescription(`تم إزالة:\n**[${removedTrack.title}](${removedTrack.url})**\nمن الموقع **#${position}**`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) {
            return message.reply('❌ لا يوجد قائمة انتظار.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        const position = parseInt(args[0]);
        if (isNaN(position) || position < 1) {
            return message.reply('❌ استخدم: `!remove <رقم>` — مثال: `!remove 2`');
        }

        if (position > player.queue.length) {
            return message.reply(`❌ لا توجد أغنية في الموقع ${position}. القائمة تحتوي على ${player.queue.length} أغنية فقط.`);
        }

        const removedTrack = player.queue.splice(position - 1, 1)[0];
        // ✅ v26.4: حفظ الحالة (نفس إصلاح وضع slash)
        player.scheduleStatePersist?.('cmd-remove', 200);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🗑️ Removed')
            .setDescription(`تم إزالة:\n**[${removedTrack.title}](${removedTrack.url})**\nمن الموقع **#${position}**`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
