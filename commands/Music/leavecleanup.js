// ═══════════════════════════════════════════════════════════════════════════
//  commands/Music/leavecleanup.js — تنظيف القائمة عند مغادرة عضو
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leavecleanup')
        .setDescription('Remove songs from queue that were added by users who left the voice channel'),

    aliases: ['lc', 'cleanqueue', 'cleanup'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: '❌ لا يوجد مشغّل نشط.', ephemeral: true });
        }

        const voiceChannel = player.voiceChannel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ البوت ليس في قناة صوتية.', ephemeral: true });
        }

        const membersInVoice = new Set(voiceChannel.members.map(m => m.id));
        const before = player.queue.length;

        // احتفظ فقط بالأغانٍ التي أضافها أعضاء ما زالوا في القناة
        player.queue = player.queue.filter(track => {
            if (!track.requesterId) return true; // احتفظ بالأغاني بدون requester
            return membersInVoice.has(track.requesterId);
        });

        const removed = before - player.queue.length;

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🧹 Leave Cleanup')
            .setDescription(`تمت إزالة **${removed}** أغنية من المستخدمين الذين غادروا القناة.\nالقائمة المتبقية: **${player.queue.length}** أغنية.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player) return message.reply('❌ لا يوجد مشغّل نشط.');

        const voiceChannel = player.voiceChannel;
        if (!voiceChannel) return message.reply('❌ البوت ليس في قناة صوتية.');

        const membersInVoice = new Set(voiceChannel.members.map(m => m.id));
        const before = player.queue.length;
        player.queue = player.queue.filter(track => !track.requesterId || membersInVoice.has(track.requesterId));
        const removed = before - player.queue.length;

        await message.reply(`🧹 تمت إزالة **${removed}** أغنية. القائمة المتبقية: **${player.queue.length}**.`);
    },
};
