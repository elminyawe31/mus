// ═══════════════════════════════════════════════════════════════════════════
//  commands/Config/setprefix.js — تغيير prefix الأوامر
//  MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻
//  ✅ يستخدم client.guildPrefixes (نفسه الذي يفحصه index.js) بدل global.
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const SettingsStore = require('../../src/SettingsStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setprefix')
        .setDescription('Set a custom prefix for this server')
        .addStringOption(opt =>
            opt.setName('prefix')
                .setDescription('New prefix (1-5 chars)')
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(5)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['prefix', 'setp'],

    async execute(interaction, client) {
        const newPrefix = interaction.options.getString('prefix');
        // ✅ v26.4: منع المسافات (تكسر تحليل الأوامر) + الحفظ الدائم
        if (/\s/.test(newPrefix)) {
            return interaction.reply({ content: '❌ الـ prefix لا يمكن أن يحتوي مسافات.', ephemeral: true });
        }
        // ✅ استخدم client.guildPrefixes (نفسه الذي يفحصه index.js)
        if (!client.guildPrefixes) client.guildPrefixes = new Map();
        client.guildPrefixes.set(interaction.guild.id, newPrefix);
        SettingsStore.persistGuildPrefixes(client.guildPrefixes);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle('✏️ Prefix Changed')
            .setDescription(`الـ prefix الجديد لهذا السيرفر: \`${newPrefix}\`\nمثال: \`${newPrefix}play\``)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ ليس لديك صلاحية `Manage Server`.');
        }
        const newPrefix = args[0];
        if (!newPrefix || newPrefix.length > 5) {
            return message.reply('❌ الـ prefix يجب أن يكون 1-5 أحرف.');
        }
        if (/\s/.test(newPrefix)) {
            return message.reply('❌ الـ prefix لا يمكن أن يحتوي مسافات.');
        }
        // ✅ استخدم client.guildPrefixes (نفسه الذي يفحصه index.js)
        if (!client.guildPrefixes) client.guildPrefixes = new Map();
        client.guildPrefixes.set(message.guild.id, newPrefix);
        SettingsStore.persistGuildPrefixes(client.guildPrefixes);
        await message.reply(`✅ تم تغيير الـ prefix إلى: \`${newPrefix}\``);
    },
};
