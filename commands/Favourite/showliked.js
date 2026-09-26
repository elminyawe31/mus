// ═══════════════════════════════════════════════════════════════════════════
//  commands/Favourite/showliked.js — عرض الأغاني المفضلة
//  MUS Bot v26.3 — Dev: ELMINYAWE 👨‍💻
//  ✅ v26.3: ترقيم موحد مع unlike (1 = الأحدث) + صفحات + نفس سلوك
//    slash و prefix (كان slash يعرض 15 و prefix يعرض 10 — تضارب)
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { PAGE_SIZE } = require('../../src/LikedSongsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('showliked')
        .setDescription('Show your liked songs')
        .addIntegerOption(opt =>
            opt.setName('page')
                .setDescription('Page number (10 songs per page)')
                .setMinValue(1)
                .setRequired(false)),

    aliases: ['liked', 'favorites', 'المفضلة'],

    // ── بناء قائمة عرض لصفحة معينة (ترقيم عالمي مستمر: 1 = الأحدث) ──
    _buildList(liked, page) {
        const totalPages = Math.max(1, Math.ceil(liked.length / PAGE_SIZE));
        const safePage = Math.min(Math.max(1, page), totalPages);
        // الأحدث أولاً (نفس سلوك العرض السابق)
        const reversed = [...liked].reverse();
        const start = (safePage - 1) * PAGE_SIZE;
        const slice = reversed.slice(start, start + PAGE_SIZE);

        let listText = '';
        slice.forEach((track, i) => {
            const globalPos = start + i + 1; // ✅ رقم يطابق unlike مباشرة
            const title = track.title.length > 45 ? track.title.substring(0, 42) + '...' : track.title;
            listText += `\`${String(globalPos).padStart(2, '0')}.\` [${title}](${track.url}) | \`${formatDuration(track.duration)}\`\n`;
        });

        return { listText, page: safePage, totalPages };
    },

    async execute(interaction, client) {
        const userId = interaction.user.id;
        const liked = require('../../src/LikedSongsManager').get(userId);

        if (liked.length === 0) {
            return interaction.reply({ content: '📭 مفضلتك فارغة. استخدم `/like` لإضافة الأغنية الحالية.', ephemeral: true });
        }

        const page = interaction.options.getInteger('page') || 1;
        const { listText, page: safePage, totalPages } = this._buildList(liked, page);

        const embed = new EmbedBuilder()
            .setColor('#FF1493')
            .setTitle(`💖 ${interaction.user.username}'s Liked Songs`)
            .setDescription(listText)
            .addFields({ name: '📊 Total', value: `\`${liked.length}\` song(s) • الصفحة ${safePage}/${totalPages}`, inline: false })
            .setFooter({ text: `${config.bot.signature} • 💡 لإزالة أغنية: /unlike رقمها` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const liked = require('../../src/LikedSongsManager').get(message.author.id);
        if (liked.length === 0) return message.reply('📭 مفضلتك فارغة. استخدم `!like` لإضافة الأغنية الحالية.');

        const page = parseInt(args?.[0]) || 1;
        const { listText, page: safePage, totalPages } = this._buildList(liked, page);

        const embed = new EmbedBuilder()
            .setColor('#FF1493')
            .setTitle('💖 Liked Songs')
            .setDescription(listText)
            .addFields({ name: '📊 Total', value: `\`${liked.length}\` song(s) • الصفحة ${safePage}/${totalPages}`, inline: false })
            .setFooter({ text: `${config.bot.signature} • 💡 لإزالة أغنية: !unlike رقمها` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
