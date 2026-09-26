// ═══════════════════════════════════════════════════════════════════════════
//  commands/Owner/serverlist.js — عرض قائمة السيرفرات التي البوت فيها
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverlist')
        .setDescription('List all servers the bot is in (owner only)'),

    aliases: ['sl', 'guilds'],

    async execute(interaction, client) {
        if (interaction.user.id !== config.info.developerId) {
            return interaction.reply({ content: '❌ هذا الأمر للمطور فقط.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const guilds = client.guilds.cache;
        const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);

        let listText = '';
        let counter = 1;
        const maxDisplay = 20;

        for (const [id, guild] of guilds) {
            if (counter > maxDisplay) break;
            listText += `\`${counter++}.\` **${guild.name}** • \`${guild.memberCount}\` members • \`${id}\`\n`;
        }

        if (guilds.size > maxDisplay) {
            listText += `\n*... و ${guilds.size - maxDisplay} سيرفر آخر*`;
        }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('📋 Server List')
            .setDescription(listText || 'No servers')
            .addFields(
                { name: '📊 Total Servers', value: `\`${guilds.size}\``, inline: true },
                { name: '👥 Total Members', value: `\`${totalMembers.toLocaleString()}\``, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (message.author.id !== config.info.developerId) {
            return message.reply('❌ هذا الأمر للمطور فقط.');
        }
        const guilds = client.guilds.cache;
        let listText = '';
        let i = 1;
        for (const [id, guild] of guilds) {
            if (i > 20) break;
            listText += `\`${i++}.\` ${guild.name} (\`${guild.memberCount}\` members) - \`${id}\`\n`;
        }
        if (guilds.size > 20) listText += `\n*... و ${guilds.size - 20} سيرفر آخر*`;
        await message.reply(`📋 **Servers (${guilds.size}):**\n${listText}`);
    },
};
