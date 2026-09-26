// ═══════════════════════════════════════════════════════════════════════════
//  commands/shuffle.js — خلط ترتيب قائمة الانتظار
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffle the queue randomly'),

    aliases: ['sh', 'mix', 'خلط'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || player.queue.length === 0) {
            return interaction.reply({ content: '❌ القائمة فارغة، لا شيء لخلطه.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        // ✅ استخدم shuffleQueue method (يحفظ state تلقائياً)
        if (typeof player.shuffleQueue === 'function') {
            player.shuffleQueue();
        } else {
            const queue = player.queue;
            for (let i = queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue[i], queue[j]] = [queue[j], queue[i]];
            }
        }
        player.shuffle = !player.shuffle;
        // ✅ احفظ state
        if (typeof player.scheduleStatePersist === 'function') {
            player.scheduleStatePersist('shuffle', 200);
        }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🔀 Shuffled')
            .setDescription(`تم خلط **${player.queue.length}** أغنية في القائمة.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || player.queue.length === 0) {
            return message.reply('❌ القائمة فارغة، لا شيء لخلطه.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        // ✅ استخدم shuffleQueue method
        if (typeof player.shuffleQueue === 'function') {
            player.shuffleQueue();
        } else {
            const queue = player.queue;
            for (let i = queue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queue[i], queue[j]] = [queue[j], queue[i]];
            }
        }
        player.shuffle = !player.shuffle;
        if (typeof player.scheduleStatePersist === 'function') {
            player.scheduleStatePersist('shuffle', 200);
        }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🔀 Shuffled')
            .setDescription(`تم خلط **${player.queue.length}** أغنية في القائمة.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
