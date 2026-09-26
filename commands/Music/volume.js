// ═══════════════════════════════════════════════════════════════════════════
//  commands/volume.js — تغيير مستوى الصوت
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set or check the music volume (0-200)')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-200)')
                .setMinValue(0)
                .setMaxValue(200)
                .setRequired(false)
        ),

    aliases: ['v', 'vol', 'صوت'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ البوت لا يعمل حالياً.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        const level = interaction.options.getInteger('level');

        if (level === null) {
            // عرض الصوت الحالي
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('🔊 Volume')
                .setDescription(`مستوى الصوت الحالي: **${player.volume}%**`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        player.setVolume(level);

        const barLength = 20;
        const filledLength = Math.floor((level / 200) * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🔊 Volume Set')
            .setDescription(`تم تغيير الصوت إلى: **${level}%**\n\`${bar}\``)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) {
            return message.reply('❌ البوت لا يعمل حالياً.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        const level = parseInt(args[0]);

        if (isNaN(level)) {
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('🔊 Volume')
                .setDescription(`مستوى الصوت الحالي: **${player.volume}%**`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        const clampedLevel = Math.max(0, Math.min(200, level));
        player.setVolume(clampedLevel);

        const barLength = 20;
        const filledLength = Math.floor((clampedLevel / 200) * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🔊 Volume Set')
            .setDescription(`تم تغيير الصوت إلى: **${clampedLevel}%**\n\`${bar}\``)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
