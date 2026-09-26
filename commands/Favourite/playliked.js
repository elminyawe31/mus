// ═══════════════════════════════════════════════════════════════════════════
//  commands/Favourite/playliked.js — تشغيل كل الأغاني المفضلة
//  MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻
//  ✅ يمر عبر MusicEmbedManager.handleMusicData لإنشاء NowPlaying card
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const MusicPlayer = require('../../src/MusicPlayer');
const MusicEmbedManager = require('../../src/MusicEmbedManager');
const config = require('../../config');
const likedSongsManager = require('../../src/LikedSongsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playliked')
        .setDescription('Play all your liked songs (shuffled)'),

    aliases: ['pl', 'playall', 'تشغيل_المفضلة'],

    async execute(interaction, client) {
        // ✅ v26.3: يقرأ من LikedSongsManager (يستعيد المفضلة المحفوظة بعد إعادة التشغيل)
        const liked = likedSongsManager.get(interaction.user.id);

        if (liked.length === 0) {
            return interaction.reply({ content: '📭 مفضلتك فارغة. استخدم `/like` لإضافة أغانٍ.', ephemeral: true });
        }

        if (!interaction.member.voice.channel) {
            return interaction.reply({ content: '❌ يجب أن تكون في قناة صوتية.', ephemeral: true });
        }

        // تحقق من صلاحيات البوت في القناة الصوتية
        const voicePerms = interaction.member.voice.channel.permissionsFor(interaction.guild.members.me);
        if (!voicePerms?.has(PermissionFlagsBits.Connect) || !voicePerms?.has(PermissionFlagsBits.Speak)) {
            return interaction.reply({ content: '❌ أحتاج صلاحيات `Connect` و `Speak` في قناتك الصوتية.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            // خلط الأغانيات
            const shuffled = [...liked].sort(() => Math.random() - 0.5);

            // إنشاء/الحصول على player
            let player = client.players.get(interaction.guild.id);
            if (!player) {
                player = new MusicPlayer(interaction.guild, interaction.channel, interaction.member.voice.channel);
                client.players.set(interaction.guild.id, player);
            }
            player.voiceChannel = interaction.member.voice.channel;
            player.textChannel = interaction.channel;

            // ✅ تأكد أن MusicEmbedManager متاح
            if (!client.musicEmbedManager) {
                client.musicEmbedManager = new MusicEmbedManager(client);
            }

            // ✅ مرر عبر handleMusicData لإنشاء NowPlaying card للأغنية الأولى
            // والباقي يُضاف للقائمة تلقائياً
            const trackData = {
                tracks: shuffled,
                isPlaylist: true, // يعامل كـ playlist: يضيف الكل + يشغل الأولى + يصنع card
            };

            const result = await client.musicEmbedManager.handleMusicData(
                interaction.guild.id,
                trackData,
                interaction.member,
                interaction,
            );

            if (!result.success) {
                // لو فشل handleMusicData، fallback للطريقة القديمة (بدون card)
                console.warn('⚠️ playliked: handleMusicData failed, falling back to direct play');
                shuffled.forEach(track => player.queue.push(track));
                // ✅ v26.4: حفظ الحالة لو كانت هناك أغنية تعمل بالفعل
                if (player.currentTrack) player.scheduleStatePersist?.('cmd-playliked', 200);
                if (!player.currentTrack && !player._playInFlight) {
                    await player.play();
                }
                const fallbackEmbed = new EmbedBuilder()
                    .setColor('#FF1493')
                    .setTitle('💖 Playing Your Liked Songs')
                    .setDescription(`تمت إضافة **${shuffled.length}** أغنية من مفضلتك للقائمة.`)
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();
                return await interaction.editReply({ embeds: [fallbackEmbed] });
            }

            // نجح — handleMusicData أنشأت الـ card وأرسلتها عبر interaction.editReply
            // لا حاجة لإرسال reply آخر (سيظهر "Interaction has already been acknowledged")
        } catch (error) {
            console.error('❌ playliked error:', error.message);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('❌ خطأ في تشغيل المفضلة')
                .setDescription('حدث خطأ أثناء تشغيل أغانيك المفضلة: ' + error.message)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            try {
                await interaction.editReply({ embeds: [errorEmbed] });
            } catch (e) { /* ignore */ }
        }
    },

    async executePrefix(message, args, client) {
        const liked = likedSongsManager.get(message.author.id);
        if (liked.length === 0) return message.reply('📭 مفضلتك فارغة. استخدم `/like` لإضافة أغانٍ.');
        if (!message.member.voice.channel) return message.reply('❌ يجب أن تكون في قناة صوتية.');

        const voicePerms = message.member.voice.channel.permissionsFor(message.guild.members.me);
        if (!voicePerms?.has(PermissionFlagsBits.Connect) || !voicePerms?.has(PermissionFlagsBits.Speak)) {
            return message.reply('❌ أحتاج صلاحيات `Connect` و `Speak` في قناتك الصوتية.');
        }

        try {
            const shuffled = [...liked].sort(() => Math.random() - 0.5);

            let player = client.players.get(message.guild.id);
            if (!player) {
                player = new MusicPlayer(message.guild, message.channel, message.member.voice.channel);
                client.players.set(message.guild.id, player);
            }
            player.voiceChannel = message.member.voice.channel;
            player.textChannel = message.channel;

            if (!client.musicEmbedManager) {
                client.musicEmbedManager = new MusicEmbedManager(client);
            }

            // أرسل رسالة مؤقتة ستُعدَّل لاحقاً من handleMusicData
            const statusMsg = await message.reply(`🔍 جاري تشغيل **${shuffled.length}** أغنية من مفضلتك...`);

            // محاكاة interaction لـ handleMusicData (لأنها تتوقع interaction أو null)
            const fakeInteraction = {
                deferred: true,
                replied: false,
                editReply: async (opts) => {
                    if (typeof opts === 'string') return await statusMsg.edit(opts);
                    return await statusMsg.edit(opts);
                },
                followUp: async (opts) => await message.channel.send(opts),
                reply: async (opts) => await statusMsg.edit(opts),
                user: message.author,
                member: message.member,
                guild: message.guild,
                channel: message.channel,
                guildId: message.guild.id,
            };

            const trackData = {
                tracks: shuffled,
                isPlaylist: true,
            };

            const result = await client.musicEmbedManager.handleMusicData(
                message.guild.id,
                trackData,
                message.member,
                fakeInteraction,
            );

            if (!result.success) {
                // fallback
                shuffled.forEach(track => player.queue.push(track));
                // ✅ v26.4: حفظ الحالة لو كانت هناك أغنية تعمل بالفعل
                if (player.currentTrack) player.scheduleStatePersist?.('cmd-playliked', 200);
                if (!player.currentTrack && !player._playInFlight) await player.play();
                return await statusMsg.edit(`💖 يتم تشغيل **${shuffled.length}** أغنية من مفضلتك!`);
            }

            // نجح — handleMusicData عدّلت statusMsg (وأصبحت الآن NowPlaying card)
        } catch (error) {
            console.error('❌ playliked prefix error:', error.message);
            await message.reply('❌ خطأ في تشغيل المفضلة: ' + error.message).catch(() => {});
        }
    },
};
