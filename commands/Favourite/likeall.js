// ═══════════════════════════════════════════════════════════════════════════
//  commands/Favourite/likeall.js — إضافة كل القائمة للمفضلة
//  MUS Bot v26.3 — Dev: ELMINYAWE 👨‍💻
//  ✅ v26.3: يُحفظ تلقائياً على القرص عبر LikedSongsManager
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const likedSongsManager = require('../../src/LikedSongsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('likeall')
        .setDescription('Add all songs in the queue to your liked songs'),

    aliases: ['favall', 'like-all'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || (!player.currentTrack && player.queue.length === 0)) {
            return interaction.reply({ content: '❌ لا يوجد أغانٍ لإضافتها.', ephemeral: true });
        }

        const userId = interaction.user.id;
        const allTracks = [player.currentTrack, ...player.queue].filter(Boolean);

        let added = 0;
        for (const track of allTracks) {
            const result = likedSongsManager.add(userId, track);
            if (result.added) added++;
        }

        const total = likedSongsManager.get(userId).length;

        const embed = new EmbedBuilder()
            .setColor('#FF1493')
            .setTitle('💖 Liked All')
            .setDescription(`تمت إضافة **${added}** أغنية جديدة لمفضلتك.\n📊 الإجمالي: **${total}** أغنية.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || (!player.currentTrack && player.queue.length === 0)) {
            return message.reply('❌ لا يوجد أغانٍ لإضافتها.');
        }

        const userId = message.author.id;
        const allTracks = [player.currentTrack, ...player.queue].filter(Boolean);

        let added = 0;
        for (const track of allTracks) {
            const result = likedSongsManager.add(userId, track);
            if (result.added) added++;
        }

        const total = likedSongsManager.get(userId).length;
        await message.reply(`💖 تمت إضافة **${added}** أغنية لمفضلتك. (الإجمالي: ${total})`);
    },
};
