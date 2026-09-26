// ═══════════════════════════════════════════════════════════════════════════
//  commands/Utility/membercount.js — عرض عدد أعضاء السيرفر
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('membercount')
        .setDescription('Show the current member count of this server'),

    aliases: ['mc', 'members', 'اعضاء'],

    async execute(interaction, client) {
        const guild = interaction.guild;
        await guild.members.fetch();

        const total = guild.memberCount;
        const humans = guild.members.cache.filter(m => !m.user.bot).size;
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        const online = guild.members.cache.filter(m => m.presence?.status === 'online').size;

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`👥 Member Count — ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: '📊 Total', value: `\`${total.toLocaleString()}\``, inline: true },
                { name: '🧑 Humans', value: `\`${humans.toLocaleString()}\``, inline: true },
                { name: '🤖 Bots', value: `\`${bots.toLocaleString()}\``, inline: true },
                { name: '🟢 Online', value: `\`${online.toLocaleString()}\``, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        const guild = message.guild;
        await guild.members.fetch();
        const total = guild.memberCount;
        const humans = guild.members.cache.filter(m => !m.user.bot).size;
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        await message.reply(`👥 **${guild.name}** • Total: ${total} • Humans: ${humans} • Bots: ${bots}`);
    },
};
