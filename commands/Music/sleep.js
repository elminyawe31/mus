// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/sleep.js — مؤقت نوم (يوقف التشغيل بعد X دقيقة)
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sleep')
        .setDescription('Set a sleep timer — bot will stop after X minutes')
        .addIntegerOption(opt =>
            opt.setName('minutes')
                .setDescription('Minutes until sleep (1-1440)')
                .setMinValue(1)
                .setMaxValue(1440)
                .setRequired(true)
        ),

    aliases: ['sleeptimer', 'night', 'نوم'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }

        const minutes = interaction.options.getInteger('minutes');

        // أوقف أي timer سابق
        if (player.sleepTimer) {
            clearTimeout(player.sleepTimer);
        }

        const endTime = Date.now() + minutes * 60 * 1000;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('😴 Sleep Timer Set')
            .setDescription(`البوت سيتوقف بعد **${minutes}** دقيقة.\n⏰ Ends: <t:${Math.floor(endTime / 1000)}:R>`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // ابدأ الـ timer — مع تنظيف كامل مثل أمر stop (كان يترك مشغّلاً ميتاً في الذاكرة)
        const guildId = interaction.guild.id;
        const textChannel = player.textChannel;
        player.sleepTimer = setTimeout(() => {
            try {
                if (player.currentTrack) {
                    player.stop();
                    player.queue = [];
                    player.cleanup?.();
                    client.players.delete(guildId);
                    if (textChannel) {
                        const stopEmbed = new EmbedBuilder()
                            .setColor('#5865F2')
                            .setTitle('😴 Sleep Timer')
                            .setDescription('انتهى المؤقت — تم إيقاف التشغيل. تصبح على خير! 🌙')
                            .setFooter({ text: config.bot.signature })
                            .setTimestamp();
                        textChannel.send({ embeds: [stopEmbed] }).catch(() => {});
                    }
                }
                player.sleepTimer = null;
            } catch (e) {}
        }, minutes * 60 * 1000);
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) return message.reply('❌ لا يوجد شيء قيد التشغيل.');
        const minutes = parseInt(args[0]);
        // ✅ v26.4: نفس حدود slash (1-1440) — القيم الضخمة كانت تفيض في
        // setTimeout فتوقف التشغيل فوراً بدلاً من الانتظار (تضارب قيم صريح)
        if (!minutes || minutes < 1 || minutes > 1440) {
            return message.reply('❌ استخدم: `!sleep <1-1440>` — القيمة بالدقائق (حتى 24 ساعة).');
        }

        if (player.sleepTimer) clearTimeout(player.sleepTimer);

        // ✅ v26.4: تنظيف كامل مثل أمر stop + نفس سلوك slash
        const guildId = message.guild.id;
        const textChannel = message.channel;
        player.sleepTimer = setTimeout(() => {
            try {
                if (player.currentTrack) {
                    player.stop();
                    player.queue = [];
                    player.cleanup?.();
                    client.players.delete(guildId);
                    textChannel.send('😴 انتهى المؤقت — تم إيقاف التشغيل. تصبح على خير! 🌙').catch(() => {});
                }
                player.sleepTimer = null;
            } catch (e) {}
        }, minutes * 60 * 1000);

        await message.reply(`😴 البوت سيتوقف بعد **${minutes}** دقيقة.`);
    },
};
