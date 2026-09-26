// ═══════════════════════════════════════════════════════════════════════════
//  commands/Voice/voice.js — معلومات القناة الصوتية الحالية
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Show info about your current voice channel'),

    aliases: ['vc', 'voiceinfo', 'قناة'],

    async execute(interaction, client) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ لست في قناة صوتية.', ephemeral: true });
        }

        const members = voiceChannel.members;
        const humans = members.filter(m => !m.user.bot).size;
        const bots = members.filter(m => m.user.bot).size;

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`🔊 ${voiceChannel.name}`)
            .addFields(
                { name: '🆔 ID', value: `\`${voiceChannel.id}\``, inline: true },
                { name: '👥 Total', value: `\`${members.size}\``, inline: true },
                { name: '🧑 Humans', value: `\`${humans}\``, inline: true },
                { name: '🤖 Bots', value: `\`${bots}\``, inline: true },
                { name: '📊 User Limit', value: `\`${voiceChannel.userLimit || '∞'}\``, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(voiceChannel.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        const player = client.players.get(interaction.guild.id);
        if (player && player.voiceChannel?.id === voiceChannel.id) {
            embed.addFields({ name: '🎵 Playing', value: player.currentTrack ? `[${player.currentTrack.title}](${player.currentTrack.url})` : 'Idle', inline: false });
        }

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const vc = message.member.voice.channel;
        if (!vc) return message.reply('❌ لست في قناة صوتية.');
        await message.reply(`🔊 **${vc.name}** — ${vc.members.size} members (humans: ${vc.members.filter(m => !m.user.bot).size})`);
    },
};
