// ═══════════════════════════════════════════════════════════════════════════
//  commands/queue.js — عرض قائمة الانتظار
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current queue'),

    aliases: ['q', 'list', 'قائمة'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ لا يوجد قائمة انتظار.', ephemeral: true });
        }

        const queue = player.queue || [];
        const current = player.currentTrack;

        if (!current && queue.length === 0) {
            return interaction.reply({ content: '📭 القائمة فارغة.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('📋 Queue')
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        if (current) {
            embed.setDescription(`**🎵 Now Playing:**\n> [${current.title}](${current.url}) | \`${formatDuration(current.duration)}\`\n\n**Up Next:**`);
        }

        if (queue.length === 0) {
            embed.addFields({ name: '\u200b', value: '📭 لا توجد أغانٍ تالية في القائمة.' });
        } else {
            const maxDisplay = 15;
            const displayQueue = queue.slice(0, maxDisplay);
            let queueText = '';

            displayQueue.forEach((track, i) => {
                const title = track.title.length > 50 ? track.title.substring(0, 47) + '...' : track.title;
                queueText += `\`${(i + 1).toString().padStart(2, '0')}.\` [${title}](${track.url}) | \`${formatDuration(track.duration)}\`\n`;
            });

            if (queue.length > maxDisplay) {
                queueText += `\n*... و ${queue.length - maxDisplay} أغنية أخرى في القائمة*`;
            }

            embed.addFields({ name: '\u200b', value: queueText });
            embed.addFields({
                name: '📊 Stats',
                value: `**Total tracks:** ${queue.length + (current ? 1 : 0)}\n**Total duration:** \`${formatDuration(calculateTotalDuration(queue, current))}\``,
                inline: false,
            });
        }

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) {
            return message.reply('❌ لا يوجد قائمة انتظار.');
        }

        const queue = player.queue || [];
        const current = player.currentTrack;

        if (!current && queue.length === 0) {
            return message.reply('📭 القائمة فارغة.');
        }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('📋 Queue')
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        if (current) {
            embed.setDescription(`**🎵 Now Playing:**\n> [${current.title}](${current.url}) | \`${formatDuration(current.duration)}\`\n\n**Up Next:**`);
        }

        if (queue.length === 0) {
            embed.addFields({ name: '\u200b', value: '📭 لا توجد أغانٍ تالية في القائمة.' });
        } else {
            const maxDisplay = 15;
            const displayQueue = queue.slice(0, maxDisplay);
            let queueText = '';

            displayQueue.forEach((track, i) => {
                const title = track.title.length > 50 ? track.title.substring(0, 47) + '...' : track.title;
                queueText += `\`${(i + 1).toString().padStart(2, '0')}.\` [${title}](${track.url}) | \`${formatDuration(track.duration)}\`\n`;
            });

            if (queue.length > maxDisplay) {
                queueText += `\n*... و ${queue.length - maxDisplay} أغنية أخرى في القائمة*`;
            }

            embed.addFields({ name: '\u200b', value: queueText });
        }

        await message.reply({ embeds: [embed] });
    },
};

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function calculateTotalDuration(queue, current) {
    let total = current?.duration || 0;
    queue.forEach(t => { total += t.duration || 0; });
    return total;
}
