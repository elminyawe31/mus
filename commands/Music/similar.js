// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/similar.js — تشغيل أغانٍ مشابهة للأغنية الحالية
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const MusicPlayer = require('../../src/MusicPlayer');
const YouTube = require('../../src/YouTube');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('similar')
        .setDescription('Play similar songs based on the current track'),

    aliases: ['sim', 'alike', 'مشابه'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }
        if (!interaction.member.voice.channel) {
            return interaction.reply({ content: '❌ يجب أن تكون في قناة صوتية.', ephemeral: true });
        }

        await interaction.deferReply();

        const currentTrack = player.currentTrack;
        const query = `${currentTrack.artist} ${currentTrack.title}`;
        const results = await YouTube.search(query, 5, interaction.guild.id);

        if (!results || results.length === 0) {
            return interaction.editReply('❌ لم أجد أغانٍ مشابهة.');
        }

        // أضف الأغانٍ للقائمة
        let added = 0;
        for (const track of results) {
            if (track.url !== currentTrack.url) {
                player.queue.push(track);
                added++;
            }
        }
        // ✅ v26.4: حفظ الحالة — الأغاني المضافة أثناء تشغيل أغنية كانت
        // تضيع عند إعادة التشغيل (لم تُحفظ أبداً خارج addTrack)
        if (added > 0) player.scheduleStatePersist?.('cmd-similar', 200);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🎵 Similar Songs Added')
            .setDescription(`تمت إضافة **${added}** أغنية مشابهة لـ:\n**[${currentTrack.title}](${currentTrack.url})**`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) return message.reply('❌ لا يوجد شيء قيد التشغيل.');

        const currentTrack = player.currentTrack;
        const query = `${currentTrack.artist} ${currentTrack.title}`;
        const results = await YouTube.search(query, 5, message.guild.id);

        if (!results || results.length === 0) return message.reply('❌ لم أجد أغانٍ مشابهة.');

        let added = 0;
        for (const track of results) {
            if (track.url !== currentTrack.url) {
                player.queue.push(track);
                added++;
            }
        }
        if (added > 0) player.scheduleStatePersist?.('cmd-similar', 200); // ✅ v26.4
        await message.reply(`🎵 تمت إضافة **${added}** أغنية مشابهة للقائمة.`);
    },
};
