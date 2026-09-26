// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/artistradio.js — تشغيل راديو لفنان معين
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const YouTube = require('../../src/YouTube');
const MusicPlayer = require('../../src/MusicPlayer');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('artistradio')
        .setDescription('Start an artist radio — play songs from a specific artist')
        .addStringOption(opt =>
            opt.setName('artist')
                .setDescription('Artist name (e.g., Tamer Ashour, Amr Diab)')
                .setRequired(true)
        ),

    aliases: ['ar', 'radio', 'راديو'],

    async execute(interaction, client) {
        if (!interaction.member.voice.channel) {
            return interaction.reply({ content: '❌ يجب أن تكون في قناة صوتية.', ephemeral: true });
        }

        const artist = interaction.options.getString('artist');
        await interaction.deferReply();

        try {
            const query = `${artist} songs`;
            const results = await YouTube.search(query, 10, interaction.guild.id);

            if (!results || results.length === 0) {
                return interaction.editReply(`❌ لم أجد أغانٍ لـ **${artist}**.`);
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
            // ✅ v26.4: حفظ الحالة لو كانت هناك أغنية تعمل بالفعل
            if (player.currentTrack) player.scheduleStatePersist?.('cmd-artistradio', 200);

            if (!player.currentTrack && !player._playInFlight) {
                await player.play();
            }

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('📻 Artist Radio')
                .setDescription(`تم بدء راديو لـ **${artist}**\nتمت إضافة **${results.length}** أغنية للقائمة.`)
                .addFields(
                    { name: '🎵 First Track', value: `[${results[0].title}](${results[0].url})`, inline: false }
                )
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('❌ artistradio error:', error.message);
            await interaction.editReply(`❌ حدث خطأ أثناء البحث عن أغانٍ: ${error.message}`).catch(() => {});
        }
    },

    async executePrefix(message, args, client) {
        if (!message.member.voice.channel) return message.reply('❌ يجب أن تكون في قناة صوتية.');
        const artist = args.join(' ');
        if (!artist) return message.reply('❌ استخدم: `!artistradio <artist name>`');

        try {
            const results = await YouTube.search(`${artist} songs`, 10, message.guild.id);
            if (!results || results.length === 0) return message.reply(`❌ لم أجد أغانٍ لـ **${artist}**.`);

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
            if (player.currentTrack) player.scheduleStatePersist?.('cmd-artistradio', 200); // ✅ v26.4
            if (!player.currentTrack && !player._playInFlight) await player.play();

            await message.reply(`📻 راديو **${artist}**: تمت إضافة ${results.length} أغنية!`);
        } catch (error) {
            console.error('❌ artistradio prefix error:', error.message);
            await message.reply(`❌ خطأ: ${error.message}`).catch(() => {});
        }
    },
};
