// ═══════════════════════════════════════════════════════════════════════════
//  commands/Giveaway/gstart.js — بدء سحبة (giveaway)
//  MUS Bot v20.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const GiveawaysManager = require('../../src/GiveawaysManager');

// مخزن السحبات الجارية
if (!global.giveaways) global.giveaways = new Map();

// ✅ v26.4: حدود موحدة للمدة (تمنع تضارب setTimeout مع القيم الضخمة/السالبة)
const MAX_DURATION_MIN = 43200; // 30 يوماً
const MAX_WINNERS = 20;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gstart')
        .setDescription('Start a giveaway')
        .addStringOption(opt => opt.setName('prize').setDescription('Prize name').setRequired(true))
        .addIntegerOption(opt => opt.setName('duration_minutes').setDescription('Duration in minutes').setMinValue(1).setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20).setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    aliases: ['giveaway', 'gs', 'سحبة'],

    async execute(interaction, client) {
        const prize = interaction.options.getString('prize');
        const durationMin = Math.min(interaction.options.getInteger('duration_minutes'), MAX_DURATION_MIN);
        const winnersCount = Math.min(interaction.options.getInteger('winners') || 1, MAX_WINNERS);

        const endTime = Date.now() + durationMin * 60 * 1000;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎉 GIVEAWAY')
            .setDescription(`**Prize:** ${prize}\n**Winners:** ${winnersCount}\n**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n\nClick the button below to enter!`)
            .setFooter({ text: `${config.bot.signature} • Hosted by ${interaction.user.tag}` })
            .setTimestamp(endTime);

        const button = new ButtonBuilder()
            .setCustomId('giveaway_join')
            .setLabel('🎉 Join')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Giveaway started in ${msg.url}`, ephemeral: true });

        // سجّل السحبة
        const giveawayData = {
            messageId: msg.id,
            channelId: msg.channel.id,
            guildId: msg.guild.id,
            prize,
            winnersCount,
            endTime,
            hostId: interaction.user.id,
            participants: new Set(),
        };
        global.giveaways.set(msg.id, giveawayData);

        // ✅ v26.4: سجّل على القرص + جدولة عبر المدير (نجاة من إعادة التشغيل)
        GiveawaysManager.register(giveawayData);
        GiveawaysManager.scheduleEnd(client, msg.id, endTime, global.endGiveaway);
    },

    async executePrefix(message, args, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply('❌ ليس لديك صلاحية `Manage Server`.');
        }
        const durationMin = parseInt(args[0]);
        const winnersCount = Math.min(parseInt(args[1]) || 1, MAX_WINNERS);
        const prize = args.slice(2).join(' ');

        // ✅ v26.4: تحقق موحّد من القيم (كان يقبل سالباً/ضخماً فيُنهي فوراً أو يفيض)
        if (!durationMin || durationMin < 1 || durationMin > MAX_DURATION_MIN) {
            return message.reply(`❌ المدة يجب أن تكون بين 1 و ${MAX_DURATION_MIN} دقيقة (30 يوماً).`);
        }
        if (!prize) {
            return message.reply('❌ استخدم: `!gstart <minutes> <winners> <prize>`\nمثال: `!gstart 60 1 Discord Nitro`');
        }

        const endTime = Date.now() + durationMin * 60 * 1000;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎉 GIVEAWAY')
            .setDescription(`**Prize:** ${prize}\n**Winners:** ${winnersCount}\n**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n\nClick the button below to enter!`)
            .setFooter({ text: `${config.bot.signature} • Hosted by ${message.author.tag}` })
            .setTimestamp(endTime);

        const button = new ButtonBuilder()
            .setCustomId('giveaway_join')
            .setLabel('🎉 Join')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        const msg = await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});

        const giveawayData = {
            messageId: msg.id,
            channelId: msg.channel.id,
            guildId: msg.guild.id,
            prize,
            winnersCount,
            endTime,
            hostId: message.author.id,
            participants: new Set(),
        };
        global.giveaways.set(msg.id, giveawayData);

        // ✅ v26.4: سجّل على القرص + جدولة عبر المدير
        GiveawaysManager.register(giveawayData);
        GiveawaysManager.scheduleEnd(client, msg.id, endTime, global.endGiveaway);
    },
};

// دالة إنهاء السحبة (متاحة عالمياً لاستخدامها من gend)
global.endGiveaway = async function (client, messageId) {
    const giveaway = global.giveaways.get(messageId);
    if (!giveaway) return false;

    // ✅ v26.4: أرشفة + إزالة من الجارية (مهما كانت نتيجة الإنهاء)
    const finishManager = () => { try { GiveawaysManager.onEnded(messageId); } catch (e) { /* ignore */ } };

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) { finishManager(); return false; }

    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) { finishManager(); return false; }

    // اختر الفائزين عشوائياً
    const participants = Array.from(giveaway.participants);
    if (participants.length === 0) {
        const endEmbed = new EmbedBuilder()
            .setColor('#888888')
            .setTitle('🎉 Giveaway Ended')
            .setDescription(`**Prize:** ${giveaway.prize}\n❌ No participants joined.`)
            .setFooter({ text: config.bot.signature })
            .setTimestamp();
        await msg.edit({ embeds: [endEmbed], components: [] });
        finishManager();
        return true;
    }

    const winners = [];
    const pool = [...participants];
    for (let i = 0; i < giveaway.winnersCount && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        winners.push(pool[idx]);
        pool.splice(idx, 1);
    }

    const winnersText = winners.map(id => `<@${id}>`).join(', ');

    const endEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🎉 Giveaway Ended')
        .setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${winnersText}\n**Participants:** ${participants.length}`)
        .setFooter({ text: config.bot.signature })
        .setTimestamp();

    await msg.edit({ embeds: [endEmbed], components: [] });
    await channel.send(`🎉 Congratulations ${winnersText}! You won **${giveaway.prize}**!`);

    finishManager();
    return true;
};
