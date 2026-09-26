// ═══════════════════════════════════════════════════════════════════════════
//  commands/Information/bio.js — تعيين/عرض bio المستخدم
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

if (!global.userProfiles) global.userProfiles = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bio')
        .setDescription('Set or view your bio')
        .addStringOption(opt =>
            opt.setName('text')
                .setDescription('Your bio text (leave empty to view)')
                .setRequired(false)
                .setMaxLength(200)
        ),

    aliases: ['aboutme', 'about', 'نبذة'],

    async execute(interaction, client) {
        const text = interaction.options.getString('text');
        const userId = interaction.user.id;

        if (!global.userProfiles.has(userId)) {
            global.userProfiles.set(userId, { bio: '', badges: [], friends: [] });
        }

        if (text) {
            global.userProfiles.get(userId).bio = text;
            const embed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle('✅ Bio Updated')
                .setDescription(`تم تحديث الـ bio:\n> ${text}`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        } else {
            const profile = global.userProfiles.get(userId);
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle(`📝 ${interaction.user.username}'s Bio`)
                .setDescription(profile?.bio || '*لم يتم تعيين bio بعد. استخدم `/bio <text>`*')
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        }
    },

    async executePrefix(message, args, client) {
        const userId = message.author.id;
        if (!global.userProfiles.has(userId)) global.userProfiles.set(userId, { bio: '', badges: [], friends: [] });
        const text = args.join(' ');
        if (text) {
            global.userProfiles.get(userId).bio = text;
            await message.reply(`✅ تم تحديث الـ bio.`);
        } else {
            const profile = global.userProfiles.get(userId);
            await message.reply(`📝 **${message.author.username}'s Bio:**\n${profile?.bio || '*لم يتم تعيين بعد*'}`);
        }
    },
};
