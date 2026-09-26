// ═══════════════════════════════════════════════════════════════════════════
//  commands/Owner/blacklist.js — حظر سيرفر من استخدام البوت
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const SettingsStore = require('../../src/SettingsStore');

// قائمة السيرفرات المحظورة
if (!global.blacklist) global.blacklist = new Set();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Add/remove a guild from blacklist (owner only)')
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('Add or remove')
                .setRequired(true)
                .addChoices(
                    { name: 'add', value: 'add' },
                    { name: 'remove', value: 'remove' }
                )
        )
        .addStringOption(opt => opt.setName('guild_id').setDescription('Guild ID').setRequired(true)),

    aliases: ['bl'],

    async execute(interaction, client) {
        // تحقق أن المستخدم هو المالك
        if (interaction.user.id !== config.info.developerId) {
            return interaction.reply({ content: '❌ هذا الأمر للمطور فقط.', ephemeral: true });
        }

        const action = interaction.options.getString('action');
        const guildId = interaction.options.getString('guild_id');

        if (action === 'add') {
            global.blacklist.add(guildId);
            SettingsStore.persistBlacklist(global.blacklist); // ✅ v26.4: الحظر يبقى بعد إعادة التشغيل
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⛔ Blacklisted')
                .setDescription(`السيرفر \`${guildId}\` تمت إضافته للقائمة السوداء.`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });

            // اترك السيرفر فوراً
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                await guild.leave().catch(() => {});
            }
        } else {
            if (!global.blacklist.has(guildId)) {
                return interaction.reply({ content: '⚠️ هذا السيرفر ليس في القائمة السوداء.', ephemeral: true });
            }
            global.blacklist.delete(guildId);
            SettingsStore.persistBlacklist(global.blacklist); // ✅ v26.4
            await interaction.reply(`✅ تم إزالة السيرفر \`${guildId}\` من القائمة السوداء.`);
        }
    },

    async executePrefix(message, args, client) {
        if (message.author.id !== config.info.developerId) {
            return message.reply('❌ هذا الأمر للمطور فقط.');
        }
        const action = args[0];
        const guildId = args[1];
        if (!action || !guildId) return message.reply('❌ استخدم: `!blacklist <add|remove> <guild_id>`');

        if (action === 'add') {
            global.blacklist.add(guildId);
            SettingsStore.persistBlacklist(global.blacklist); // ✅ v26.4
            const guild = client.guilds.cache.get(guildId);
            if (guild) await guild.leave().catch(() => {});
            await message.reply(`⛔ تم حظر السيرفر \`${guildId}\`.`);
        } else if (action === 'remove') {
            global.blacklist.delete(guildId);
            SettingsStore.persistBlacklist(global.blacklist); // ✅ v26.4
            await message.reply(`✅ تم إزالة الحظر عن \`${guildId}\`.`);
        }
    },
};
