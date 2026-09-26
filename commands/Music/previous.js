// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/previous.js — تشغيل الأغنية السابقة
//  MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻
//  ✅ يستخدم player.previousTracks و player.previous() (الـ API الصحيح)
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('previous')
        .setDescription('Play the previous song from history'),

    aliases: ['prev', 'back', 'السابق'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ البوت لا يعمل حالياً.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        // ✅ استخدم player.previousTracks (الـ property الصحيح) بدل player.history
        if (!player.previousTracks || player.previousTracks.length === 0) {
            return interaction.reply({ content: '📭 لا يوجد سجل للأغانيات السابقة.', ephemeral: true });
        }

        try {
            // ✅ استخدم player.previous() (الـ method الصحيح) بدل player.play(trackObj)
            const success = player.previous();
            if (!success) {
                return interaction.reply({ content: '❌ تعذّر تشغيل الأغنية السابقة.', ephemeral: true });
            }
            const previousTrack = player.currentTrack;
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('⏮️ Previous')
                .setDescription(`تشغيل الأغنية السابقة:\n**[${previousTrack.title}](${previousTrack.url})**`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Previous command error:', error.message);
            await interaction.reply({ content: '❌ حدث خطأ: ' + error.message, ephemeral: true }).catch(() => {});
        }
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) {
            return message.reply('❌ البوت لا يعمل حالياً.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        if (!player.previousTracks || player.previousTracks.length === 0) {
            return message.reply('📭 لا يوجد سجل للأغانيات السابقة.');
        }

        try {
            const success = player.previous();
            if (!success) return message.reply('❌ تعذّر تشغيل الأغنية السابقة.');
            const previousTrack = player.currentTrack;

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('⏮️ Previous')
                .setDescription(`تشغيل الأغنية السابقة:\n**[${previousTrack.title}](${previousTrack.url})**`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Previous prefix command error:', error.message);
            await message.reply('❌ حدث خطأ: ' + error.message).catch(() => {});
        }
    },
};
