// ═══════════════════════════════════════════════════════════════════════════
//  commands/Favourite/unlike.js — إزالة أغنية من المفضلة
//  MUS Bot v26.3 — Dev: ELMINYAWE 👨‍💻
//  ✅ v26.3: إصلاح تضارب القيم — الآن يدعم:
//     • unlike 2        → يزيل الأغنية رقم 2 كما تظهر في /showliked (1 = الأحدث)
//     • unlike <url>    → يزيل بالرابط
//     • unlike          → يزيل الأغنية الحالية
//  ✅ الترقيم مطابق 100% لما يعرضه showliked
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const likedSongsManager = require('../../src/LikedSongsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlike')
        .setDescription('Remove a song from your liked songs')
        .addStringOption(opt =>
            opt.setName('song')
                .setDescription('Song number from /showliked (e.g. 2) or song URL — empty = current song')
                .setRequired(false)),

    aliases: ['unfav', 'removefav', 'unfavorite'],

    // ── تحليل المدخل: رقم (1 = الأحدث) أو URL أو null (الأغنية الحالية) ──
    _resolveTarget(input, player, liked) {
        // لا مدخل → الأغنية الحالية
        if (input === null || input === undefined || String(input).trim() === '') {
            if (!player || !player.currentTrack) return { error: '❌ مرّر رقم الأغنية أو رابطها، أو شغّل أغنية لإزالتها.' };
            return { url: player.currentTrack.url };
        }

        const raw = String(input).trim();

        // رقم → موقع كما في showliked (1 = الأحدث إعجاباً)
        if (/^\d+$/.test(raw)) {
            const position = parseInt(raw, 10);
            if (position < 1) return { error: '❌ الرقم يجب أن يكون 1 أو أكبر. الموقع `1` = الأحدث في مفضلتك.' };
            if (position > liked.length) {
                return { error: `❌ لا توجد أغنية في الموقع **${position}** — مفضلتك تحتوي على **${liked.length}** أغنية فقط.\nاستخدم \`/showliked\` لرؤية الأرقام.` };
            }
            return { position };
        }

        // URL
        if (/^https?:\/\//i.test(raw)) return { url: raw };

        // نص عادي → ابحث في العناوين (تسامحاً مع المستخدمين)
        const q = raw.toLowerCase();
        const found = liked.find(t => (t.title || '').toLowerCase().includes(q));
        if (found) return { url: found.url };

        return { error: `❌ صيغة غير مفهومة: \`${raw}\`.\nاستخدم رقم الأغنية (مثل \`2\`) أو رابطها — أو اتركه فارغاً للأغنية الحالية.` };
    },

    async execute(interaction, client) {
        const userId = interaction.user.id;
        const liked = likedSongsManager.get(userId);

        if (liked.length === 0) {
            return interaction.reply({ content: '📭 مفضلتك فارغة. استخدم `/like` لإضافة الأغنية الحالية.', ephemeral: true });
        }

        const player = client.players.get(interaction.guild.id);
        const input = interaction.options.getString('song');
        const target = this._resolveTarget(input, player, liked);
        if (target.error) {
            return interaction.reply({ content: target.error, ephemeral: true });
        }

        const result = target.position !== undefined
            ? likedSongsManager.removeByPosition(userId, target.position)
            : likedSongsManager.removeByUrl(userId, target.url);

        if (!result.removed) {
            if (result.reason === 'out_of_range') {
                return interaction.reply({ content: `❌ لا توجد أغنية في هذا الموقع — مفضلتك تحتوي على **${result.total}** أغنية.`, ephemeral: true });
            }
            return interaction.reply({ content: '❌ هذه الأغنية ليست في مفضلتك. استخدم `/showliked` لرؤية أرقام أغانيك.', ephemeral: true });
        }

        const removed = result.removed;
        const embed = new EmbedBuilder()
            .setColor('#888888')
            .setTitle('💔 Unliked')
            .setDescription(`تمت إزالة:\n**[${removed.title}](${removed.url})**\nمن مفضلتك.`)
            .addFields({ name: '📊 Total Liked', value: `\`${result.total}\` song(s)`, inline: true })
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const liked = likedSongsManager.get(message.author.id);
        if (liked.length === 0) return message.reply('📭 مفضلتك فارغة. استخدم `!like` لإضافة الأغنية الحالية.');

        const player = client.players.get(message.guild.id);
        const input = args && args.length > 0 ? args[0] : null;
        const target = this._resolveTarget(input, player, liked);
        if (target.error) return message.reply(target.error);

        const result = target.position !== undefined
            ? likedSongsManager.removeByPosition(message.author.id, target.position)
            : likedSongsManager.removeByUrl(message.author.id, target.url);

        if (!result.removed) {
            if (result.reason === 'out_of_range') {
                return message.reply(`❌ لا توجد أغنية في هذا الموقع — مفضلتك تحتوي على **${result.total}** أغنية.`);
            }
            return message.reply('❌ هذه الأغنية ليست في مفضلتك. استخدم `!showliked` لرؤية الأرقام.');
        }

        await message.reply(`💔 تمت إزالة **${result.removed.title}** من مفضلتك. (المتبقي: ${result.total})`);
    },
};
