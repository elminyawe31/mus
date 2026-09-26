// ═══════════════════════════════════════════════════════════════════════════
//  commands/filter.js — تطبيق فلاتر صوتية على التشغيل الحالي
//  MUS Bot v18.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

const AVAILABLE_FILTERS = [
    { name: 'bassboost', emoji: '🔊', description: 'رفع الباس' },
    { name: 'nightcore', emoji: '🌙', description: 'صوت أنمي سريع' },
    { name: 'vaporwave', emoji: '🌴', description: 'صوت بطيء هادئ' },
    { name: '8d', emoji: '🎧', description: 'صوت ثلاثي الأبعاد' },
    { name: 'reset', emoji: '🔄', description: 'إزالة كل الفلاتر' },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Apply an audio filter to the current song')
        .addStringOption(option =>
            option.setName('filter')
                .setDescription('Filter to apply')
                .setRequired(true)
                .addChoices(...AVAILABLE_FILTERS.map(f => ({ name: `${f.emoji} ${f.name}`, value: f.name })))
        ),

    aliases: ['f', 'effects', 'فلتر'],

    async execute(interaction, client) {
        const player = client.players.get(interaction.guild.id);
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ لا يوجد شيء قيد التشغيل.', ephemeral: true });
        }
        if (!interaction.member.voice.channel || interaction.member.voice.channel.id !== player.voiceChannel?.id) {
            return interaction.reply({ content: '❌ يجب أن تكون في نفس القناة الصوتية مع البوت.', ephemeral: true });
        }

        const filterName = interaction.options.getString('filter');

        try {
            if (filterName === 'reset') {
                // ✅ استخدم setFilter (موجود الآن على MusicPlayer)
                if (typeof player.setFilter === 'function') {
                    player.setFilter(null);
                } else {
                    player.activeFilter = null;
                }
                const embed = new EmbedBuilder()
                    .setColor(config.bot.embedColor)
                    .setTitle('🔄 Filters Reset')
                    .setDescription('تمت إزالة كل الفلاتر الصوتية.')
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();
                return interaction.reply({ embeds: [embed] });
            }

            const filterArgs = config.audio.filters[filterName === '8d' ? '_8d' : filterName];
            if (!filterArgs) {
                return interaction.reply({ content: `❌ الفلتر \`${filterName}\` غير معروف.`, ephemeral: true });
            }

            // ✅ استخدم setFilter (يعيد تشغيل الأغنية من نفس النقطة مع الفلتر الجديد)
            player.activeFilter = filterName;
            if (typeof player.setFilter === 'function') {
                player.setFilter(filterName);
            } else if (typeof player.applyFilter === 'function') {
                await player.applyFilter(filterArgs);
            } else {
                // fallback: أعد تشغيل الأغنية من نفس النقطة
                const currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;
                await player.play(null, currentTime);
            }

            const filterInfo = AVAILABLE_FILTERS.find(f => f.name === filterName);
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle(`${filterInfo.emoji} Filter Applied`)
                .setDescription(`تم تطبيق فلتر **${filterName}** — ${filterInfo.description}`)
                .addFields(
                    { name: '🎵 Now Playing', value: `[${player.currentTrack.title}](${player.currentTrack.url})`, inline: false }
                )
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Filter error:', error);
            await interaction.reply({ content: `❌ فشل تطبيق الفلتر: ${error.message}`, ephemeral: true });
        }
    },

    async executePrefix(message, args, client) {
        const player = client.players.get(message.guild.id);
        if (!player || !player.currentTrack) {
            return message.reply('❌ لا يوجد شيء قيد التشغيل.');
        }
        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceChannel?.id) {
            return message.reply('❌ يجب أن تكون في نفس القناة الصوتية مع البوت.');
        }

        const filterName = args[0]?.toLowerCase();
        if (!filterName) {
            const filtersList = AVAILABLE_FILTERS.map(f => `\`${f.name}\` ${f.emoji} — ${f.description}`).join('\n');
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle('🎚️ Available Filters')
                .setDescription(filtersList)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        if (!AVAILABLE_FILTERS.find(f => f.name === filterName)) {
            return message.reply(`❌ الفلتر \`${filterName}\` غير معروف. استخدم \`!filter\` لرؤية القائمة.`);
        }

        try {
            if (filterName === 'reset') {
                // ✅ استخدم setFilter الجديد
                if (typeof player.setFilter === 'function') {
                    player.setFilter(null);
                } else {
                    player.activeFilter = null;
                }
                const embed = new EmbedBuilder()
                    .setColor(config.bot.embedColor)
                    .setTitle('🔄 Filters Reset')
                    .setDescription('تمت إزالة كل الفلاتر.')
                    .setFooter({ text: config.bot.signature })
                    .setTimestamp();
                return message.reply({ embeds: [embed] });
            }

            const filterArgs = config.audio.filters[filterName === '8d' ? '_8d' : filterName];
            player.activeFilter = filterName;
            // ✅ استخدم setFilter الجديد
            if (typeof player.setFilter === 'function') {
                player.setFilter(filterName);
            } else if (typeof player.applyFilter === 'function') {
                await player.applyFilter(filterArgs);
            } else {
                const currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;
                await player.play(null, currentTime);
            }

            const filterInfo = AVAILABLE_FILTERS.find(f => f.name === filterName);
            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle(`${filterInfo.emoji} Filter Applied`)
                .setDescription(`تم تطبيق فلتر **${filterName}** — ${filterInfo.description}`)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Filter error:', error);
            await message.reply(`❌ فشل تطبيق الفلتر: ${error.message}`);
        }
    },
};
