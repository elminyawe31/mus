// ═══════════════════════════════════════════════════════════════════════════
//  commands/Utility/timer.js — مؤقت تنبيه
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timer')
        .setDescription('Set a reminder timer (minutes)')
        .addIntegerOption(opt =>
            opt.setName('minutes')
                .setDescription('Minutes (1-1440)')
                .setMinValue(1)
                .setMaxValue(1440)
                .setRequired(true)
        )
        .addStringOption(opt => opt.setName('message').setDescription('What to remind you about').setRequired(false)),

    aliases: ['remind', 'reminder', 'مؤقت'],

    async execute(interaction, client) {
        const minutes = interaction.options.getInteger('minutes');
        const message = interaction.options.getString('message') || 'Timer finished!';

        const endTime = Date.now() + minutes * 60 * 1000;

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏰ Timer Set')
            .setDescription(`سأذكّرك بعد **${minutes}** دقيقة.`)
            .addFields(
                { name: '⏱️ Ends At', value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true },
                { name: '📝 Reminder', value: message, inline: false }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // ابدأ الـ timeout
        setTimeout(async () => {
            try {
                const reminderEmbed = new EmbedBuilder()
                    .setColor('#FFAA00')
                    .setTitle('⏰ Reminder!')
                    .setDescription(`**${message}**`)
                    .addFields(
                        { name: '⏱️ Set', value: `${minutes} minutes ago`, inline: true },
                        { name: '👤 By', value: `<@${interaction.user.id}>`, inline: true }
                    )
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();
                await interaction.channel.send({ content: `<@${interaction.user.id}>`, embeds: [reminderEmbed] });
            } catch (err) {
                // ربما القناة حُذفت
            }
        }, minutes * 60 * 1000);
    },

    async executePrefix(message, args, client) {
        const minutes = parseInt(args[0]);
        const reminder = args.slice(1).join(' ') || 'Timer finished!';
        // ✅ v26.4: نفس حدود slash (1-1440) — القيم الضخمة كانت تفيض في
        // setTimeout فيصل التذكير فوراً بدلاً من الوقت المطلوب (تضارب قيم)
        if (!minutes || minutes < 1 || minutes > 1440) {
            return message.reply('❌ استخدم: `!timer <1-1440> [message]` — القيمة بالدقائق (حتى 24 ساعة).');
        }
        await message.reply(`⏰ سأذكّرك بعد **${minutes}** دقيقة.`);
        setTimeout(async () => {
            try {
                await message.channel.send(`⏰ <@${message.author.id}> **${reminder}**`);
            } catch (e) {}
        }, minutes * 60 * 1000);
    },
};
