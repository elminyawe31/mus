// ═══════════════════════════════════════════════════════════════════════════
//  commands/Owner/restart.js — إعادة تشغيل البوت (owner only)
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Restart the bot (owner only)'),

    aliases: ['reboot', 'rs'],

    async execute(interaction, client) {
        if (interaction.user.id !== config.info.developerId) {
            return interaction.reply({ content: '❌ هذا الأمر للمطور فقط.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#FF8800')
            .setTitle('🔄 Restarting...')
            .setDescription('البوت سيعيد التشغيل خلال 3 ثوانٍ.')
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        console.log('🔄 Restart requested by', interaction.user.tag);

        // أغلق الـ client بأمان ثم اخرج
        setTimeout(async () => {
            try {
                // احفظ حالة كل الـ players
                for (const [guildId, player] of client.players) {
                    if (player.persistState) {
                        await player.persistState('restart', true).catch(() => {});
                    }
                }
                await client.destroy();
            } catch (e) {}
            process.exit(0);
        }, 3000);
    },

    async executePrefix(message, args, client) {
        if (message.author.id !== config.info.developerId) {
            return message.reply('❌ هذا الأمر للمطور فقط.');
        }
        await message.reply('🔄 إعادة تشغيل بعد 3 ثوانٍ...');
        // ✅ احفظ حالة كل الـ players قبل التدمير (مثل slash version)
        setTimeout(async () => {
            try {
                for (const [guildId, player] of client.players) {
                    if (player.persistState) {
                        await player.persistState('restart', true).catch(() => {});
                    }
                }
                await client.destroy();
            } catch (e) {
                console.error('Restart error:', e.message);
            }
            process.exit(0);
        }, 3000);
    },
};
