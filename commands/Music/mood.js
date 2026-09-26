// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/mood.js — تشغيل موسيقى حسب المزاج
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const YouTube = require('../../src/YouTube');
const MusicPlayer = require('../../src/MusicPlayer');
const config = require('../../config');

const MOOD_PLAYLISTS = {
    chill: { name: 'Chill / Lofi', emoji: '🌙', query: 'chill lofi music playlist' },
    party: { name: 'Party / Dance', emoji: '🎉', query: 'party dance music mix' },
    sad: { name: 'Sad / Emotional', emoji: '😢', query: 'sad emotional songs playlist' },
    romance: { name: 'Romance', emoji: '💕', query: 'romantic love songs playlist' },
    workout: { name: 'Workout', emoji: '💪', query: 'workout gym music mix' },
    study: { name: 'Study / Focus', emoji: '📚', query: 'study focus music lofi' },
    sleep: { name: 'Sleep / Relax', emoji: '😴', query: 'sleep relaxation music' },
    arabic: { name: 'Arabic Hits', emoji: '🎶', query: 'arabic songs hits playlist' },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mood')
        .setDescription('Play music based on your mood')
        .addStringOption(opt =>
            opt.setName('mood')
                .setDescription('Choose your mood')
                .setRequired(false)
                .addChoices(...Object.entries(MOOD_PLAYLISTS).map(([key, val]) => ({
                    name: `${val.emoji} ${val.name}`,
                    value: key
                })))
        ),

    aliases: ['vibe', 'genre', 'مزاج'],

    async execute(interaction, client) {
        if (!interaction.member.voice.channel) {
            return interaction.reply({ content: '❌ يجب أن تكون في قناة صوتية.', ephemeral: true });
        }

        let moodKey = interaction.options.getString('mood');

        // إذا لم يُحدد mood، أظهر قائمة اختيار
        if (!moodKey) {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('mood_select')
                .setPlaceholder('اختر مزاجك...')
                .addOptions(...Object.entries(MOOD_PLAYLISTS).map(([key, val]) => ({
                    label: val.name,
                    value: key,
                    description: `استمتع بموسيقى ${val.name}`,
                    emoji: val.emoji,
                })));

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('🎵 Music for Your Mood')
                .setDescription('اختر مزاجك من القائمة لبدء التشغيل!')
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        await playMood(interaction, client, moodKey);
    },

    async executePrefix(message, args, client) {
        if (!message.member.voice.channel) return message.reply('❌ يجب أن تكون في قناة صوتية.');
        const moodKey = args[0]?.toLowerCase();

        if (!moodKey || !MOOD_PLAYLISTS[moodKey]) {
            const moods = Object.entries(MOOD_PLAYLISTS).map(([k, v]) => `${v.emoji} \`${k}\` — ${v.name}`).join('\n');
            return message.reply(`🎵 **اختر مزاجاً:**\n${moods}\n\nاستخدم: \`!mood <mood>\``);
        }

        await playMoodPrefix(message, client, moodKey);
    },
};

async function playMood(interaction, client, moodKey) {
    const mood = MOOD_PLAYLISTS[moodKey];
    await interaction.deferReply();

    const results = await YouTube.search(mood.query, 10, interaction.guild.id);
    if (!results || results.length === 0) {
        return interaction.editReply(`❌ لم أجد موسيقى لـ **${mood.name}**.`);
    }

    let player = client.players.get(interaction.guild.id);
    if (!player) {
        player = new MusicPlayer(interaction.guild, interaction.channel, interaction.member.voice.channel);
        client.players.set(interaction.guild.id, player);
    }
    player.voiceChannel = interaction.member.voice.channel;
    player.textChannel = interaction.channel;

    results.forEach(track => {
        track.requesterId = interaction.user.id;
        player.queue.push(track);
    });
    // ✅ v26.4: حفظ الحالة لو أُضيفت الأغاني وأخرى تعمل بالفعل
    if (player.currentTrack) player.scheduleStatePersist?.('cmd-mood', 200);
    if (!player.currentTrack && !player._playInFlight) await player.play();

    const embed = new EmbedBuilder()
        .setColor(config.bot.embedColor)
        .setTitle(`${mood.emoji} ${mood.name} Radio`)
        .setDescription(`تمت إضافة **${results.length}** أغنية لـ **${mood.name}**.`)
        .setFooter({ text: config.bot.signature })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function playMoodPrefix(message, client, moodKey) {
    const mood = MOOD_PLAYLISTS[moodKey];
    const results = await YouTube.search(mood.query, 10, message.guild.id);
    if (!results || results.length === 0) return message.reply(`❌ لم أجد موسيقى لـ **${mood.name}**.`);

    let player = client.players.get(message.guild.id);
    if (!player) {
        player = new MusicPlayer(message.guild, message.channel, message.member.voice.channel);
        client.players.set(message.guild.id, player);
    }
    player.voiceChannel = message.member.voice.channel;
    player.textChannel = message.channel;

    results.forEach(track => {
        track.requesterId = message.author.id;
        player.queue.push(track);
    });
    if (player.currentTrack) player.scheduleStatePersist?.('cmd-mood', 200); // ✅ v26.4
    if (!player.currentTrack && !player._playInFlight) await player.play();

    await message.reply(`${mood.emoji} **${mood.name}**: تمت إضافة ${results.length} أغنية!`);
}
