// ═══════════════════════════════════════════════════════════════════════════
//  commands/Config/ignore.js — تجاهل قناة (لا يستجيب البوت لأوامرها)
//  MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻
//  ✅ يستخدم client.ignoredChannels (متاح على Client في index.js) بدل global.
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const SettingsStore = require('../../src/SettingsStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ignore')
        .setDescription('Toggle: ignore commands in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['ignorechannel', 'ig'],

    async execute(interaction, client) {
        const channelId = interaction.channel.id;
        // ✅ استخدم client.ignoredChannels (نفسه الذي يفحصه index.js)
        if (!client.ignoredChannels) client.ignoredChannels = new Set();
        let action;
        if (client.ignoredChannels.has(channelId)) {
            client.ignoredChannels.delete(channelId);
            action = 'unignored ✅';
        } else {
            client.ignoredChannels.add(channelId);
            action = 'ignored ❌';
        }
        SettingsStore.persistIgnoredChannels(client.ignoredChannels); // ✅ v26.4: حفظ دائم

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('🚫 Channel Updated')
            .setDescription(`هذه القناة الآن: **${action}**\n${action.includes('ignored ❌') ? 'البوت لن يستجيب للأوامر هنا.' : 'البوت سيستجيب للأوامر هنا.'}`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ ليس لديك صلاحية `Manage Server`.');
        }
        // ✅ استخدم client.ignoredChannels (نفسه الذي يفحصه index.js)
        if (!client.ignoredChannels) client.ignoredChannels = new Set();
        const channelId = message.channel.id;
        if (client.ignoredChannels.has(channelId)) {
            client.ignoredChannels.delete(channelId);
            SettingsStore.persistIgnoredChannels(client.ignoredChannels); // ✅ v26.4
            await message.reply('✅ القناة لم تعد مُتجاهلة.');
        } else {
            client.ignoredChannels.add(channelId);
            SettingsStore.persistIgnoredChannels(client.ignoredChannels); // ✅ v26.4
            await message.reply('🚫 القناة أصبحت مُتجاهلة. البوت لن يستجيب للأوامر هنا.');
        }
    },
};
