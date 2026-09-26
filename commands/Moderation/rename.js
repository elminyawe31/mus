// ═══════════════════════════════════════════════════════════════════════════
//  commands/Moderation/rename.js — إعادة تسمية قناة
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Rename the current channel')
        .addStringOption(opt => opt.setName('name').setDescription('New channel name').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    aliases: ['rn', 'renamechannel'],

    async execute(interaction, client) {
        const newName = interaction.options.getString('name');
        const oldName = interaction.channel.name;
        try {
            await interaction.channel.setName(newName);
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('✏️ Channel Renamed')
                .setDescription(`**${oldName}** → **${newName}**`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({ content: `❌ فشل: ${err.message}`, ephemeral: true });
        }
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply('❌ لا تملك الصلاحية.');
        const newName = args.join(' ');
        if (!newName) return message.reply('❌ استخدم: `!rename <new name>`');
        const oldName = message.channel.name;
        try {
            await message.channel.setName(newName);
            await message.reply(`✏️ **${oldName}** → **${newName}**`);
        } catch (err) {
            await message.reply(`❌ فشل: ${err.message}`);
        }
    },
};
