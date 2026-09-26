// ═══════════════════════════════════════════════════════════════════════════
//  commands/replay.js — إعادة تشغيل الأغنية من البداية
//  MUS Bot v19.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('replay')
        .setDescription('Replay the current song from the beginning'),

    aliases: ['restart', 'restart-song', 'اعادة'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        // أعد تشغيل نفس الأغنية من البداية (seek=0)
        await player.play(null, 0);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🔄 Replay')
            .setDescription(`إعادة تشغيل:\n**[${player.currentTrack.title}](${player.currentTrack.url})**`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) {
            return message.reply('❌ لا يوجد شيء قيد التشغيل.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        await player.play(null, 0);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🔄 Replay')
            .setDescription(`إعادة تشغيل:\n**[${player.currentTrack.title}](${player.currentTrack.url})**`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
