// ═══════════════════════════════════════════════════════════════════════════
//  commands/Tracker/invitecodes.js — عرض كل أكواد الدعوة النشطة
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invitecodes')
        .setDescription('Show all active invite codes in this server'),

    aliases: ['codes', 'ic'],

    async execute(interaction, client) {
        await interaction.deferReply();

        try {
            const invites = await interaction.guild.invites.fetch();

            if (invites.size === 0) {
                return interaction.editReply('📭 لا توجد دعوات نشطة في هذا السيرفر.');
            }

            let listText = '';
            let counter = 1;
            const maxDisplay = 15;

            for (const [code, inv] of invites) {
                if (counter > maxDisplay) break;
                const inviter = inv.inviter?.username || 'Unknown';
                listText += `\`${counter++}.\` **discord.gg/${code}** • uses: \`${inv.uses}\` • by: ${inviter}\n`;
            }

            if (invites.size > maxDisplay) {
                listText += `\n*... و ${invites.size - maxDisplay} كود آخر*`;
            }

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('🎟️ Active Invite Codes')
                .setDescription(listText)
                .addFields({ name: '📊 Total Active Codes', value: `\`${invites.size}\``, inline: true })
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply(`❌ فشل: ${err.message}`);
        }
    },

    async executePrefix(message, args, client) {
        try {
            const invites = await message.guild.invites.fetch();
            let listText = '';
            let i = 1;
            for (const [code, inv] of invites) {
                if (i > 15) break;
                listText += `\`${i++}.\` discord.gg/${code} - ${inv.uses} uses\n`;
            }
            await message.reply(`🎟️ **Invite Codes:**\n${listText}`);
        } catch (err) {
            await message.reply(`❌ فشل: ${err.message}`);
        }
    },
};
