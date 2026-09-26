// ═══════════════════════════════════════════════════════════════════════════
//  commands/stop.js — إيقاف التشغيل ومسح القائمة بالكامل
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback, clear the queue, and disconnect the bot'),

    aliases: ['st', 'stop-now', 'اقف'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ البوت ليس في قناة صوتية.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        const queueSize = player.queue.length;
        player.stop();
        player.queue = [];
        player.cleanup();
        client.players.delete(interaction.guild.id);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏹️ Stopped')
            .setDescription(`**تم إيقاف التشغيل ومسح ${queueSize} أغنية من القائمة.**\nالبوت سيغادر القناة الصوتية.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) {
            return message.reply('❌ البوت ليس في قناة صوتية.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        const queueSize = player.queue.length;
        player.stop();
        player.queue = [];
        player.cleanup();
        client.players.delete(message.guild.id);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('⏹️ Stopped')
            .setDescription(`**تم إيقاف التشغيل ومسح ${queueSize} أغنية من القائمة.**\nالبوت سيغادر القناة الصوتية.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
