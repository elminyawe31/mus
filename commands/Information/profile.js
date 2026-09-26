// ═══════════════════════════════════════════════════════════════════════════
//  commands/Information/profile.js — عرض بروفايل المستخدم
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

if (!global.userProfiles) global.userProfiles = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your or another user\'s profile')
        .addUserOption(opt => opt.setName('user').setDescription('User to view').setRequired(false))
        .addStringOption(opt =>
            opt.setName('edit_bio')
                .setDescription('Set your bio (max 200 chars)')
                .setRequired(false)
                .setMaxLength(200)
        ),

    aliases: ['me', 'prof', 'بروفايل'],

    async execute(interaction, client) {
        const user = interaction.options.getUser('user') || interaction.user;
        const newBio = interaction.options.getString('edit_bio');

        if (newBio && user.id === interaction.user.id) {
            if (!global.userProfiles.has(user.id)) {
                global.userProfiles.set(user.id, { bio: '', badges: [], friends: [] });
            }
            global.userProfiles.get(user.id).bio = newBio;
            await interaction.reply({ content: '✅ تم تحديث الـ bio.', ephemeral: true });
            return;
        }

        const profile = global.userProfiles.get(user.id) || { bio: '*لم يُعيين بعد*', badges: [], friends: [] };
        const likedCount = global.likedSongs?.get(user.id)?.length || 0;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`👤 ${user.username}'s Profile`)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: '📝 Bio', value: profile.bio || '*لم يُعيين بعد*', inline: false },
                { name: '💖 Liked Songs', value: `\`${likedCount}\``, inline: true },
                { name: '👥 Friends', value: `\`${profile.friends?.length || 0}\``, inline: true },
                { name: '🎖️ Badges', value: profile.badges?.length > 0 ? profile.badges.join(' ') : 'لا توجد', inline: true }
            );

        if (member) {
            embed.addFields(
                { name: '📅 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
                { name: '🎭 Roles', value: `\`${member.roles.cache.size - 1}\``, inline: true },
            );
        }
        embed.addFields({ name: '📅 Discord Account', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true });
        embed.setFooter({ text: config.bot.signature }).setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async executePrefix(message, args, client) {
        // ✅ لو action=set، الملف يجب أن يُحفظ على message.author دائماً (ليس المُشار إليه)
        if (args[0]?.toLowerCase() === 'set' && args.length > 1) {
            const author = message.author;
            if (!global.userProfiles.has(author.id)) global.userProfiles.set(author.id, { bio: '', badges: [], friends: [] });
            global.userProfiles.get(author.id).bio = args.slice(1).join(' ');
            return message.reply('✅ تم تحديث الـ bio.');
        }
        // عرض البروفايل: المُشار إليه أو الكاتب
        const user = message.mentions.users.first() || message.author;
        const profile = global.userProfiles?.get(user.id) || { bio: '*لم يُعيين بعد*' };
        const likedCount = global.likedSongs?.get(user.id)?.length || 0;

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`👤 ${user.username}'s Profile`)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: '📝 Bio', value: profile.bio, inline: false },
                { name: '💖 Liked', value: `\`${likedCount}\``, inline: true },
                { name: '📅 Account', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
