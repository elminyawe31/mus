// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/247.js — تفعيل وضع 24/7 (البوت لا يغادر القناة أبداً)
//  MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻
//  ✅ يحمي البوت من:
//    - الانقطاع بسبب عدم وجود مستخدمين (لا يبدأ inactivity timer)
//    - القطع القسري (يحاول إعادة الاتصال تلقائياً حتى 5 مرات)
//    - إعادة التشغيل (يُسترجع من state persistence — TODO)
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Toggle 24/7 mode — bot stays in voice channel even when empty')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['stay', 'afk', '24/7'],

    async execute(interaction, client) {
        let player = client.players.get(interaction.guild.id);

        // ✅ اسمح بتفعيل 24/7 حتى لو لم يكن البوت في قناة — سيُطبّق على أول player يُنشأ
        if (!player) {
            // أنشئ player مؤقت لو البوت في قناة صوتية
            if (interaction.member.voice?.channel) {
                const MusicPlayer = require('../../src/MusicPlayer');
                player = new MusicPlayer(interaction.guild, interaction.channel, interaction.member.voice.channel);
                player.stayInChannel = false; // سيُبدّل لـ true أسفله
                client.players.set(interaction.guild.id, player);
                // ✅ اتصل بالقناة الصوتية فوراً حتى يبقى البوت فيها
                try {
                    await player.connect();
                } catch (err) {
                    console.error('247: failed to connect to voice:', err.message);
                }
            } else {
                return interaction.reply({
                    content: '❌ البوت ليس في قناة صوتية، ولا أنت في قناة. انضم لقناة صوتية ثم استخدم الأمر.',
                    ephemeral: true,
                });
            }
        }

        // تبديل وضع 24/7
        player.stayInChannel = !player.stayInChannel;
        player.lastVoiceChannelId = player.voiceChannel?.id || player.lastVoiceChannelId;

        const embed = new EmbedBuilder()
            .setColor(player.stayInChannel ? '#43B581' : config.bot.embedColor)
            .setTitle(`🕐 24/7 Mode: ${player.stayInChannel ? 'ON ✅' : 'OFF ❌'}`)
            .setDescription(
                player.stayInChannel
                    ? '**البوت سيبقى في القناة الصوتية دائماً** حتى لو:\n• لم يكن هناك أغانٍ تعمل\n• لم يكن هناك أعضاء\n• تم قطعه قسرياً (سيحاول إعادة الاتصال تلقائياً حتى 5 مرات)\n\nاستخدم `/247` مرة أخرى لإيقاف الوضع.'
                    : '**البوت سيغادر القناة تلقائياً** عند عدم النشاط (5 دقائق افتراضياً).\n\nاستخدم `/247` مرة أخرى لإعادة التفعيل.'
            )
            .addFields(
                { name: '📋 Auto-Disconnect Timeout', value: player.stayInChannel ? 'Disabled (24/7 ON)' : `${Math.round((player.inactivityTimeoutMs || 300000) / 60000)} min`, inline: true },
                { name: '🔁 Auto-Reconnect', value: player.stayInChannel ? 'Up to 5 attempts' : 'N/A', inline: true },
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // إذا تُفعّل، أوقف فيactivity timer مؤقتاً (إن وجد)
        if (player.stayInChannel && typeof player.clearInactivityTimer === 'function') {
            player.clearInactivityTimer(true); // resume = true لاستئناف التشغيل إن كان متوقفاً
        }
    },

    async executePrefix(message, args, client) {
        let player = client.players.get(message.guild.id);
        if (!player) {
            if (message.member.voice?.channel) {
                const MusicPlayer = require('../../src/MusicPlayer');
                player = new MusicPlayer(message.guild, message.channel, message.member.voice.channel);
                player.stayInChannel = false;
                client.players.set(message.guild.id, player);
                // ✅ اتصل بالقناة الصوتية فوراً
                try { await player.connect(); } catch (e) { console.error('247 prefix connect error:', e.message); }
            } else {
                return message.reply('❌ البوت ليس في قناة صوتية ولا أنت. انضم لقناة أولاً.');
            }
        }
        player.stayInChannel = !player.stayInChannel;
        player.lastVoiceChannelId = player.voiceChannel?.id || player.lastVoiceChannelId;

        const embed = new EmbedBuilder()
            .setColor(player.stayInChannel ? '#43B581' : config.bot.embedColor)
            .setTitle(`🕐 24/7 Mode: ${player.stayInChannel ? 'ON ✅' : 'OFF ❌'}`)
            .setDescription(
                player.stayInChannel
                    ? '**البوت سيبقى في القناة الصوتية دائماً** — حتى لو لم يكن هناك أغانٍ أو أعضاء.'
                    : '**البوت سيغادر القناة تلقائياً** عند عدم النشاط.'
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await message.reply({ embeds: [embed] });

        if (player.stayInChannel && typeof player.clearInactivityTimer === 'function') {
            player.clearInactivityTimer(true);
        }
    },
};
