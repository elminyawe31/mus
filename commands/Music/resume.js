// ═══════════════════════════════════════════════════════════════════════════
//  commands/resume.js — استئناف التشغيل بعد الإيقاف المؤقت
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused song'),

    aliases: ['r', 're', 'استئناف', 'continue'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        if (!player.paused) {
            return interaction.reply({ content: '▶️ التشغيل يعمل بالفعل.', ephemeral: true });
        }

        player.resume();

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('▶️ Resumed')
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

        if (!player.paused) {
            return message.reply('▶️ التشغيل يعمل بالفعل.');
        }

        player.resume();

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('▶️ Resumed')
            .setDescription(`**[${player.currentTrack.title}](${player.currentTrack.url})**`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
