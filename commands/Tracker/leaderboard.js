// ═══════════════════════════════════════════════════════════════════════════
//  commands/Tracker/leaderboard.js — ترتيب أفضل الداعين
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show the top inviters in this server'),

    aliases: ['lb', 'top', 'ترتيب'],

    async execute(interaction, client) {
        await interaction.deferReply();

        try {
            const invites = await interaction.guild.invites.fetch();

            // اجمع الدعوات حسب المستخدم
            const inviterStats = new Map();
            for (const [code, inv] of invites) {
                if (!inv.inviter) continue;
                const inviterId = inv.inviter.id;
                if (!inviterStats.has(inviterId)) {
                    inviterStats.set(inviterId, {
                        username: inv.inviter.username,
                        uses: 0,
                        codes: 0,
                    });
                }
                const stats = inviterStats.get(inviterId);
                stats.uses += inv.uses;
                stats.codes++;
            }

            if (inviterStats.size === 0) {
                return interaction.editReply('📭 لا توجد دعوات في هذا السيرفر بعد.');
            }

            // رتّب حسب العدد
            const sorted = Array.from(inviterStats.entries())
                .sort((a, b) => b[1].uses - a[1].uses)
                .slice(0, 10);

            let listText = '';
            const medals = ['🥇', '🥈', '🥉'];

            sorted.forEach(([id, stats], i) => {
                const medal = medals[i] || `\`${i + 1}.\``;
                listText += `${medal} **${stats.username}** — \`${stats.uses}\` دعوة\n`;
            });

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('🏆 Invite Leaderboard')
                .setDescription(listText)
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
            const inviterStats = new Map();
            for (const [code, inv] of invites) {
                if (!inv.inviter) continue;
                const id = inv.inviter.id;
                if (!inviterStats.has(id)) inviterStats.set(id, { username: inv.inviter.username, uses: 0 });
                inviterStats.get(id).uses += inv.uses;
            }
            const sorted = Array.from(inviterStats.entries()).sort((a, b) => b[1].uses - a[1].uses).slice(0, 10);
            let listText = sorted.map(([id, s], i) => `\`${i + 1}.\` ${s.username} — ${s.uses}`).join('\n');
            await message.reply(`🏆 **Invite Leaderboard:**\n${listText}`);
        } catch (err) {
            await message.reply(`❌ فشل: ${err.message}`);
        }
    },
};
