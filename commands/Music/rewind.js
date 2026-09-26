// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/rewind.js — إرجاع التشغيل بعدد ثواني
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rewind')
        .setDescription('Rewind the current song by specified seconds')
        .addIntegerOption(opt =>
            opt.setName('seconds')
                .setDescription('Seconds to rewind (default: 10)')
                .setMinValue(1)
                .setRequired(false)
        ),

    aliases: ['rw', 'إرجاع'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة.', ephemeral: true });
        }

        const seconds = interaction.options.getInteger('seconds') || 10;
        const currentTime = player.getCurrentTime ? player.getCurrentTime() : (player.currentTime || 0);
        const currentSec = Math.floor(currentTime / 1000);
        const targetSec = Math.max(0, currentSec - seconds);

        await player.play(null, targetSec * 1000);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏪ Rewound')
            .setDescription(`تم الإرجاع **${seconds}** ثانية.`)
            .addFields({ name: '⏱️ Position', value: `${formatDuration(targetSec)} / ${formatDuration(player.currentTrack.duration)}`, inline: true })
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) return message.reply('❌ لا يوجد شيء قيد التشغيل.');
        // ✅ v26.4: فحص القناة الصوتية (كان في slash فقط — عدم اتساق)
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة.');
        }
        const seconds = parseInt(args[0]) || 10;
        // ✅ v26.4: رفض القيم السالبة (كانت تجعل rewind يتقدم للأمام!)
        if (seconds < 1) {
            return message.reply('❌ استخدم: `!rewind <seconds>` — قيمة موجبة.');
        }
        const currentTime = player.getCurrentTime ? player.getCurrentTime() : (player.currentTime || 0);
        const targetSec = Math.max(0, Math.floor(currentTime / 1000) - seconds);
        await player.play(null, targetSec * 1000);
        await message.reply(`⏪ تم الإرجاع **${seconds}** ثانية.`);
    },
};

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
