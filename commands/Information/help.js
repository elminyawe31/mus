// ═══════════════════════════════════════════════════════════════════════════
//  commands/Information/help.js — Help Menu مطابق لـ Groove-Music
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
//  المميزات: select menu + autocomplete + categories + command details
// ═══════════════════════════════════════════════════════════════════════════
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} = require('discord.js');
const config = require('../../config');
const fs = require('fs');
const path = require('path');

const categoryInfo = {
    'Information': { emoji: 'ℹ️', grooveKey: 'info', description: 'Shows information commands' },
    'Music': { emoji: '🎵', grooveKey: 'youtube', description: 'Shows music commands' },
    'Favourite': { emoji: '💖', grooveKey: 'like', description: 'Shows favourite commands' },
    'Config': { emoji: '⚙️', grooveKey: 'manager', description: 'Shows configuration commands' },
    'Utility': { emoji: '🛠️', grooveKey: 'admin', description: 'Shows utility commands' },
    'Giveaway': { emoji: '🎉', grooveKey: 'gwy', description: 'Shows giveaway commands' },
    'Filters': { emoji: '🎚️', grooveKey: 'add', description: 'Shows filter commands' },
    'Tracker': { emoji: '📊', grooveKey: 'hastag', description: 'Shows invite tracking commands' },
    'Moderation': { emoji: '🛡️', grooveKey: 'manager', description: 'Shows moderation commands' },
    'Automod': { emoji: '🤖', grooveKey: 'developer', description: 'Shows automod commands' },
    'Voice': { emoji: '🔊', grooveKey: 'voldown', description: 'Shows voice commands' },
};

const categoryOrder = ['Information', 'Music', 'Favourite', 'Config', 'Moderation', 'Automod', 'Voice', 'Utility', 'Giveaway', 'Filters', 'Tracker'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all commands with categories')
        .addStringOption(opt =>
            opt.setName('command')
                .setDescription('Shows about a specific command')
                .setRequired(false)
                .setAutocomplete(true)
        ),

    aliases: ['h', 'مساعدة', 'اوامر'],

    async autocomplete(interaction, client) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const commandsPath = path.join(__dirname, '..', '..');
        const allCommands = [];

        const categories = fs.readdirSync(commandsPath)
            .filter(file => fs.statSync(path.join(commandsPath, file)).isDirectory())
            .filter(folder => folder.toLowerCase() !== 'owner');

        for (const category of categories) {
            const categoryPath = path.join(commandsPath, category);
            if (!fs.statSync(categoryPath).isDirectory()) continue;
            const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                try {
                    const command = require(path.join(categoryPath, file));
                    if (command.data?.name) {
                        allCommands.push({ name: command.data.name, category });
                    }
                } catch (e) {}
            }
        }

        const filtered = allCommands
            .filter(cmd => cmd.name.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map(cmd => ({ name: cmd.name, value: cmd.name }));

        await interaction.respond(filtered).catch(() => {});
    },

    async execute(interaction, client) {
        const commandName = interaction.options.getString('command');
        const E = client.emoji || {};

        // ── إذا حدد أمر معين، أظهر تفاصيله ──────────────────────────────────
        if (commandName) {
            return this.showCommandDetails(interaction, client, commandName);
        }

        // ── أظهر الـ help menu الرئيسي ────────────────────────────────────────
        const categories = this.getCategories();
        const categoryData = this.getCategoryData(categories);

        const botName = client.user.username;
        const totalCommands = Object.values(categoryData).reduce((acc, cmds) => acc + cmds.length, 0);

        // اختر إيموجي Groove للعنوان (youtube) أو fallback لـ 🎵
        const musicEmoji = E.youtube || '🎵';
        const devEmoji = E.developer || '👨‍💻';

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`${musicEmoji} ${config.bot.name} — Help Menu`)
            .setDescription(
                `**${botName}** هو بوتك المتكامل للموسيقى والإدارة.\n` +
                `يقدم موسيقى عالية الجودة من YouTube و Spotify و SoundCloud، ` +
                `إدارة شاملة للسيرفر، AutoMod، سحبات، بروفايلات، وأكثر.\n\n` +
                `**📊 Total Commands:** \`${totalCommands}\`\n` +
                `**📦 Categories:** \`${categories.length}\`\n` +
                `**${devEmoji} Developer:** ${config.info.developer}\n\n` +
                `اختر فئة من القائمة لعرض أوامرها.`
            )
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        // بناء الـ select menu
        const sortedCategories = categories.sort((a, b) => {
            const indexA = categoryOrder.indexOf(a);
            const indexB = categoryOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        const categoryOptions = sortedCategories.map(cat => {
            const info = categoryInfo[cat] || { emoji: '📁', grooveKey: null };
            const count = categoryData[cat]?.length || 0;
            // استخدم إيموجي Groove من الخادم عند توفره، وإلا استخدم الـ Unicode الافتراضي
            const finalEmoji = (info.grooveKey && E[info.grooveKey]) ? E[info.grooveKey] : info.emoji;
            return {
                label: `${cat} (${count})`,
                value: cat,
                description: info.description,
                emoji: finalEmoji,
            };
        });

        categoryOptions.unshift({
            label: '🏠 Home',
            value: 'home',
            description: 'Back to main menu',
            emoji: E.blank || '🏠',
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('📋 Select a category...')
            .addOptions(categoryOptions);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const sentMessage = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true,
        });

        // ابدأ collector للاستماع للاختيارات
        const collector = sentMessage.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 120000,
        });

        collector.on('collect', async (i) => {
            try {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ لا يمكنك استخدام هذه القائمة.', ephemeral: true });
                }

                const selectedValue = i.values[0];

                if (selectedValue === 'home') {
                    await i.update({ embeds: [embed], components: [row] });
                    return;
                }

                // اعرض أوامر الفئة المحددة
                const selectedCategory = selectedValue;
                const commandsList = categoryData[selectedCategory] || [];
                const info = categoryInfo[selectedCategory] || { emoji: '📁', grooveKey: null };
                const E = client.emoji || {};
                const finalEmoji = (info.grooveKey && E[info.grooveKey]) ? E[info.grooveKey] : info.emoji;

                const catEmbed = new EmbedBuilder()
                    .setColor(config.bot.embedColor)
                    .setTitle(`${finalEmoji} ${selectedCategory} Commands [${commandsList.length}]`)
                    .setDescription(
                        commandsList.length > 0
                            ? commandsList.map(cmd => `\`${cmd.name}\` — ${cmd.description}`).join('\n')
                            : 'لا توجد أوامر في هذه الفئة.'
                    )
                    .setFooter({ text: `${config.bot.signature} • Use /help <command> for details` })
                    .setTimestamp();

                await i.update({ embeds: [catEmbed], components: [row] });
            } catch (err) {
                // "Interaction has already been acknowledged" — تجاهل فقط
                if (!err.message.includes('already been acknowledged') && !err.message.includes('Unknown interaction')) {
                    console.error('Help collector error:', err.message);
                }
            }
        });

        collector.on('end', () => {
            try {
                selectMenu.setDisabled(true);
                selectMenu.setPlaceholder('Help Menu timed out');
                sentMessage.edit({ components: [row] }).catch(() => {});
            } catch (e) { /* ignore */ }
        });
    },

    async showCommandDetails(interaction, client, commandName) {
        const E = client.emoji || {};
        const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
        if (!command) {
            return interaction.reply({ content: `${E.cross || '❌'} الأمر \`${commandName}\` غير موجود.`, ephemeral: true });
        }

        const aliases = command.aliases && command.aliases.length > 0
            ? command.aliases.map(a => `\`${a}\``).join(', ')
            : 'None';

        let category = 'Unknown';
        const commandsPath = path.join(__dirname, '..');
        for (const dir of fs.readdirSync(commandsPath)) {
            const dirPath = path.join(commandsPath, dir);
            if (fs.statSync(dirPath).isDirectory()) {
                if (fs.existsSync(path.join(dirPath, `${command.data.name}.js`))) {
                    category = dir;
                    break;
                }
            }
        }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`${E.hastag || '📋'} /${command.data.name}`)
            .setDescription(command.data.description || 'No description')
            .addFields(
                { name: '📂 Category', value: category, inline: true },
                { name: '🏷️ Aliases', value: aliases, inline: true },
                { name: '📝 Usage', value: `/${command.data.name}`, inline: true },
                { name: '💡 Example', value: `/${command.data.name} ${command.data.options?.length ? '<' + command.data.options[0].name + '>' : ''}`, inline: false }
            )
            .setFooter({ text: config.bot.signature })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    getCategories() {
        const commandsPath = path.join(__dirname, '..');
        return fs.readdirSync(commandsPath)
            .filter(file => fs.statSync(path.join(commandsPath, file)).isDirectory())
            .filter(folder => folder.toLowerCase() !== 'owner');
    },

    getCategoryData(categories) {
        const commandsPath = path.join(__dirname, '..');
        const categoryData = {};
        for (const category of categories) {
            const categoryPath = path.join(commandsPath, category);
            const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
            categoryData[category] = [];
            for (const file of commandFiles) {
                try {
                    const command = require(path.join(categoryPath, file));
                    if (command.data?.name) {
                        categoryData[category].push({
                            name: command.data.name,
                            description: command.data.description || 'No description',
                        });
                    }
                } catch (e) {}
            }
        }
        return categoryData;
    },

    async executePrefix(message, args, client) {
        const commandName = args[0]?.toLowerCase();
        const E = client.emoji || {};

        if (commandName) {
            const command = client.commands.get(commandName) || client.commands.get(client.aliases.get(commandName));
            if (!command) {
                return message.reply(`❌ الأمر \`${commandName}\` غير موجود.`);
            }
            const aliases = command.aliases && command.aliases.length > 0
                ? command.aliases.map(a => `\`${a}\``).join(', ')
                : 'None';

            const embed = new EmbedBuilder()
                .setColor(config.bot.embedColor)
                .setTitle(`${E.hastag || '📋'} ${command.data.name}`)
                .setDescription(command.data.description || 'No description')
                .addFields(
                    { name: '🏷️ Aliases', value: aliases, inline: true },
                    { name: '📝 Usage', value: `!${command.data.name}`, inline: true }
                )
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        // اعرض القائمة الكاملة
        const categories = this.getCategories();
        const categoryData = this.getCategoryData(categories);
        const totalCommands = Object.values(categoryData).reduce((acc, cmds) => acc + cmds.length, 0);

        let description = `**${config.bot.name}** — ${totalCommands} command\n\n`;
        for (const cat of categoryOrder.filter(c => categoryData[c])) {
            const info = categoryInfo[cat] || { emoji: '📁', grooveKey: null };
            const cmds = categoryData[cat];
            if (cmds.length === 0) continue;
            const finalEmoji = (info.grooveKey && E[info.grooveKey]) ? E[info.grooveKey] : info.emoji;
            description += `${finalEmoji} **${cat}** [${cmds.length}]\n${cmds.map(c => `\`${c.name}\``).join(' • ')}\n\n`;
        }

        const embed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`${E.youtube || '🎵'} ${config.bot.name} — Help`)
            .setDescription(description)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `${config.bot.signature} • Use /help <command> for details` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
