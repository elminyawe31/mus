// ═══════════════════════════════════════════════════════════════════════════
//  commands/Tracker/invites.js — عرض عدد دعوات المستخدم
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invites')
        .setDescription('Show how many invites you or another user has')
        .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)),

    aliases: ['inv', 'invitecount', 'دعوات'],

    async execute(interaction, client) {
        const user = interaction.options.getUser('user') || interaction.user;

        await interaction.deferReply();

        try {
            // اجلب كل دعوات السيرفر
            const invites = await interaction.guild.invites.fetch();
            const userInvites = invites.filter(inv => inv.inviter?.id === user.id);

            const totalInvites = userInvites.reduce((acc, inv) => acc + inv.uses, 0);
            const regular = userInvites.filter(inv => !inv.temporary).reduce((acc, inv) => acc + inv.uses, 0);
            const temporary = totalInvites - regular;

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle(`🎯 ${user.username}'s Invites`)
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    { name: '📊 Total Invites', value: `\`${totalInvites}\``, inline: true },
                    { name: '✅ Regular', value: `\`${regular}\``, inline: true },
                    { name: '⏳ Temporary', value: `\`${temporary}\``, inline: true }
                )
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            await interaction.editReply(`❌ فشل جلب الدعوات: ${err.message}`);
        }
    },

    async executePrefix(message, args, client) {
        const user = message.mentions.users.first() || message.author;
        try {
            const invites = await message.guild.invites.fetch();
            const userInvites = invites.filter(inv => inv.inviter?.id === user.id);
            const total = userInvites.reduce((acc, inv) => acc + inv.uses, 0);
            await message.reply(`🎯 ${user.tag} لديه **${total}** دعوة.`);
        } catch (err) {
            await message.reply(`❌ فشل: ${err.message}`);
        }
    },
};
