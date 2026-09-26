// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/leave.js — يجعل البوت يغادر القناة الصوتية
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make the bot leave the voice channel'),

    aliases: ['lv', 'dc', 'مغادرة'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ البوت ليس في قناة صوتية.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة.', ephemeral: true });
        }

        const channelName = player.voiceChannel?.name || 'Unknown';
        player.queue = [];
        player.currentTrack = null;
        player.stop();
        player.cleanup();
        client.players.delete(interaction.guild.id);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('👋 Left')
            .setDescription(`البوت غادر **${channelName}**.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) return message.reply('❌ البوت ليس في قناة صوتية.');
        // ✅ فحص القناة الصوتية (مثل slash version) لمنع مستخدم خارج القناة من طرد البوت
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }
        const channelName = player.voiceChannel?.name || 'Unknown';
        player.queue = [];
        player.currentTrack = null;
        player.stop();
        player.cleanup();
        client.players.delete(message.guild.id);
        await message.reply(`👋 غادرت **${channelName}**.`);
    },
};
