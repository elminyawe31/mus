// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/join.js — يجعل البوت ينضم لقناتك الصوتية
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const MusicPlayer = require('../../src/MusicPlayer');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Make the bot join your voice channel'),

    aliases: ['j', 'connect', 'joinme', 'انضم'],

    async execute(interaction, client) {
        if (!interaction.member.voice.channel) {
            return interaction.reply({ content: '❌ يجب أن تكون في قناة صوتية.', ephemeral: true });
        }

        let player = client.players.get(interaction.guild.id);
        if (!player) {
            player = new MusicPlayer(interaction.guild, interaction.channel, interaction.member.voice.channel);
            client.players.set(interaction.guild.id, player);
        }

        player.voiceChannel = interaction.member.voice.channel;
        player.textChannel = interaction.channel;

        // إذا البوت ليس متصلاً، اتصل
        if (!player.connection) {
            try {
                await player.connect();
                const embed = new EmbedBuilder()
                    .setColor(config.bot.embedColor)
                    .setTitle('✅ Joined')
                    .setDescription(`انضممت إلى ${interaction.member.voice.channel} — استخدم \`/play\` لتشغيل الأغاني.`)
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed] });
            } catch (err) {
                await interaction.reply({ content: `❌ فشل الاتصال: ${err.message}`, ephemeral: true });
            }
        } else {
            await interaction.reply({ content: '✅ البوت متصل بالفعل.', ephemeral: true });
        }
    },

    async executePrefix(message, args, client) {
        if (!message.member.voice.channel) return message.reply('❌ يجب أن تكون في قناة صوتية.');
        let player = client.players.get(message.guild.id);
        if (!player) {
            player = new MusicPlayer(message.guild, message.channel, message.member.voice.channel);
            client.players.set(message.guild.id, player);
        }
        player.voiceChannel = message.member.voice.channel;
        player.textChannel = message.channel;
        if (!player.connection) {
            await player.connect();
            await message.reply(`✅ انضممت إلى ${message.member.voice.channel}.`);
        } else {
            await message.reply('✅ البوت متصل بالفعل.');
        }
    },
};
