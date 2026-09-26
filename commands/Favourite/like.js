// ═══════════════════════════════════════════════════════════════════════════
//  commands/Favourite/like.js — إضافة الأغنية الحالية للمفضلة
//  MUS Bot v26.3 — Dev: ELMINYAWE 👨‍💻
//  ✅ v26.3: يُحفظ تلقائياً على القرص عبر LikedSongsManager
//    (لا تضيع المفضلة بعد إعادة التشغيل)
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const likedSongsManager = require('../../src/LikedSongsManager');

// global.likedSongs يُدار الآن عبر LikedSongsManager (نفس الـ Map — متوافق مع الكود القديم)
if (!global.likedSongs) global.likedSongs = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('like')
        .setDescription('Like the currently playing song'),

    aliases: ['fav', 'favorite', 'مفضلة'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }

        const userId = interaction.user.id;
        const userLikes = global.likedSongs.get(userId) || [];
        const track = player.currentTrack;

        // تحقق إن كانت مضافة مسبقاً
        const existing = userLikes.find(t => t.url === track.url);
        if (existing) {
            return interaction.reply({ content: '❌ هذه الأغنية في مفضلتك بالفعل.', ephemeral: true });
        }

        // ✅ عبر المدير → حفظ تلقائي على القرص
        const result = likedSongsManager.add(userId, track);
        const total = result.total || userLikes.length + 1;

        const embed = new EmbedBuilder()
            .setColor('#FF1493')
            .setTitle('💖 Liked!')
            .setDescription(`تمت إضافة:\n**[${track.title}](${track.url})**\nإلى مفضلتك.`)
            .addFields(
                { name: '📊 Total Liked', value: `\`${total}\` song(s)`, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) {
            return message.reply('❌ لا يوجد شيء قيد التشغيل.');
        }
        const userId = message.author.id;
        const userLikes = global.likedSongs.get(userId) || [];
        const track = player.currentTrack;
        if (userLikes.find(t => t.url === track.url)) {
            return message.reply('❌ هذه الأغنية في مفضلتك بالفعل.');
        }
        const result = likedSongsManager.add(userId, track);
        await message.reply(`💖 تمت إضافة **${track.title}** إلى مفضلتك. (الإجمالي: ${result.total || userLikes.length + 1})`);
    },
};
