// ═══════════════════════════════════════════════════════════════════════════
//  commands/Owner/leaveserver.js — مغادرة سيرفر (owner only)
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaveserver')
        .setDescription('Leave a specific server (owner only)')
        .addStringOption(opt => opt.setName('guild_id').setDescription('Guild ID to leave').setRequired(true)),

    aliases: ['leave', 'ls'],

    async execute(interaction, client) {
        if (interaction.user.id !== config.info.developerId) {
            return interaction.reply({ content: '❌ هذا الأمر للمطور فقط.', ephemeral: true });
        }

        const guildId = interaction.options.getString('guild_id');
        const guild = client.guilds.cache.get(guildId);

        if (!guild) {
            return interaction.reply({ content: `❌ البوت ليس في السيرفر \`${guildId}\`.`, ephemeral: true });
        }

        const guildName = guild.name;
        await guild.leave();

        const embed = new EmbedBuilder()
            .setColor('#FF4444')
            .setTitle('👋 Left Server')
            .setDescription(`البوت غادر السيرفر: **${guildName}** (\`${guildId}\`)`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (message.author.id !== config.info.developerId) {
            return message.reply('❌ هذا الأمر للمطور فقط.');
        }
        const guildId = args[0];
        if (!guildId) return message.reply('❌ استخدم: `!leaveserver <guild_id>`');
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return message.reply('❌ البوت ليس في هذا السيرفر.');
        const name = guild.name;
        await guild.leave();
        await message.reply(`👋 غادرت السيرفر: **${name}**`);
    },
};
