// ═══════════════════════════════════════════════════════════════════════════
//  commands/pause.js — إيقاف مؤقت للتشغيل
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the current song'),

    aliases: ['pa', 'pause-now', 'ايقاف'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        if (player.paused) {
            return interaction.reply({ content: '⏸️ التشغيل متوقف مؤقتاً بالفعل.', ephemeral: true });
        }

        player.pause();

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏸️ Paused')
            .setDescription(`**[${player.currentTrack.title}](${player.currentTrack.url})**`)
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

        if (player.paused) {
            return message.reply('⏸️ التشغيل متوقف مؤقتاً بالفعل.');
        }

        player.pause();

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏸️ Paused')
            .setDescription(`**[${player.currentTrack.title}](${player.currentTrack.url})**`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
