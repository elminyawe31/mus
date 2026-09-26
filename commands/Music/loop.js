// ═══════════════════════════════════════════════════════════════════════════
//  commands/loop.js — تبديل وضع التكرار (track / queue / off)
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Set loop mode: off, track, or queue')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Loop mode')
                .setRequired(false)
                .addChoices(
                    { name: 'off', value: 'off' },
                    { name: 'track (repeat current song)', value: 'track' },
                    { name: 'queue (repeat entire queue)', value: 'queue' },
                )
        ),

    aliases: ['l', 'repeat', 'rp', 'تكرار'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ البوت لا يعمل حالياً.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        let mode = interaction.options.getString('mode');

        if (!mode) {
            // تبديل تلقائي: off → track → queue → off
            if (player.loop === 'off' || !player.loop) {
                mode = 'track';
            } else if (player.loop === 'track') {
                mode = 'queue';
            } else {
                mode = 'off';
            }
        }

        // ✅ استخدم setLoop (يحفظ state تلقائياً للـ restore-after-restart)
        // حدّث القيمة إلى false بدل 'off' للاتساق مع constructor
        if (typeof player.setLoop === 'function') {
            player.setLoop(mode === 'off' ? false : mode);
        } else {
            player.loop = mode === 'off' ? false : mode;
        }

        const modeEmojis = { off: '➡️', track: '🔂', queue: '🔁' };
        const modeDescriptions = {
            off: 'تم إيقاف التكرار.',
            track: `تكرار الأغنية الحالية: **[${player.currentTrack?.title || 'N/A'}]**`,
            queue: `تكرار القائمة بالكامل (**${player.queue.length + 1}** أغنية).`,
        };

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`${modeEmojis[mode]} Loop: ${mode.toUpperCase()}`)
            .setDescription(modeDescriptions[mode])
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) {
            return message.reply('❌ البوت لا يعمل حالياً.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        let mode = args[0]?.toLowerCase();

        if (!mode || !['off', 'track', 'queue'].includes(mode)) {
            // تبديل تلقائي
            if (player.loop === 'off' || !player.loop) {
                mode = 'track';
            } else if (player.loop === 'track') {
                mode = 'queue';
            } else {
                mode = 'off';
            }
        }

        // ✅ استخدم setLoop
        if (typeof player.setLoop === 'function') {
            player.setLoop(mode === 'off' ? false : mode);
        } else {
            player.loop = mode === 'off' ? false : mode;
        }

        const modeEmojis = { off: '➡️', track: '🔂', queue: '🔁' };
        const modeDescriptions = {
            off: 'تم إيقاف التكرار.',
            track: `تكرار الأغنية الحالية: **[${player.currentTrack?.title || 'N/A'}]**`,
            queue: `تكرار القائمة بالكامل (**${player.queue.length + 1}** أغنية).`,
        };

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`${modeEmojis[mode]} Loop: ${mode.toUpperCase()}`)
            .setDescription(modeDescriptions[mode])
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
