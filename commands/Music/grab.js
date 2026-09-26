// ═══════════════════════════════════════════════════════════════════════════
//  commands/grab.js — إرسال معلومات الأغنية الحالية في DM
//  MUS Bot v19.0 — Dev: ELMINYAWE 👨‍💻
//  مستوحى من Groove-Music
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grab')
        .setDescription('Sends the currently playing song to your DMs'),

    aliases: ['save', 'dm', 'حفظ'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }

        const track = player.currentTrack;
        await interaction.reply({ content: '📩 تم إرسال الأغنية إلى رسائلك الخاصة!', ephemeral: true });

        try {
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('🎵 Saved Song')
                .setDescription(`**[${track.title}](${track.url})**`)
                .addFields(
                    { name: '👤 Artist', value: track.artist || 'Unknown', inline: true },
                    { name: '⏱️ Duration', value: formatDuration(track.duration), inline: true },
                    { name: '🎵 Platform', value: track.platform || 'Unknown', inline: true },
                    { name: '🏠 Server', value: interaction.guild.name, inline: true },
                )
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            if (track.thumbnail) {
                embed.setThumbnail(track.thumbnail);
            }

            await interaction.user.send({ embeds: [embed] });
        } catch (err) {
            // فشل إرسال DM — المستخدم قد أغلقها
            await interaction.followUp({ content: '❌ تعذّر إرسال الرسالة. تأكد أن DMs مفتوحة.', ephemeral: true });
        }
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) {
            return message.reply('❌ لا يوجد شيء قيد التشغيل.');
        }

        const track = player.currentTrack;
        await message.reply('📩 تم إرسال الأغنية إلى رسائلك الخاصة!');

        try {
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('🎵 Saved Song')
                .setDescription(`**[${track.title}](${track.url})**`)
                .addFields(
                    { name: '👤 Artist', value: track.artist || 'Unknown', inline: true },
                    { name: '⏱️ Duration', value: formatDuration(track.duration), inline: true },
                    { name: '🎵 Platform', value: track.platform || 'Unknown', inline: true },
                )
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            if (track.thumbnail) embed.setThumbnail(track.thumbnail);

            await message.author.send({ embeds: [embed] });
        } catch (err) {
            await message.reply('❌ تعذّر إرسال الرسالة. تأكد أن DMs مفتوحة.');
        }
    },
};

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
