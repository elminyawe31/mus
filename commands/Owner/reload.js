// ═══════════════════════════════════════════════════════════════════════════
//  commands/Owner/reload.js — إعادة تحميل أمر (owner only)
//  MUS Bot v21.0 — Dev: ELMINYAWE 👨‍💻
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reload a command (owner only)')
        .addStringOption(opt => opt.setName('command').setDescription('Command name to reload').setRequired(true)),

    aliases: ['rl', 'rld'],

    async execute(interaction, client) {
        if (interaction.user.id !== config.info.developerId) {
            return interaction.reply({ content: '❌ هذا الأمر للمطور فقط.', ephemeral: true });
        }

        const commandName = interaction.options.getString('command').toLowerCase();
        const command = client.commands.get(commandName);

        if (!command) {
            return interaction.reply({ content: `❌ الأمر \`${commandName}\` غير موجود.`, ephemeral: true });
        }

        // ابحث عن الملف
        const commandsPath = path.join(__dirname, '..');
        let foundFile = null;
        function searchDir(dir) {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory()) {
                    searchDir(path.join(dir, item.name));
                } else if (item.name === `${commandName}.js`) {
                    foundFile = path.join(dir, item.name);
                }
            }
        }
        searchDir(commandsPath);

        if (!foundFile) {
            return interaction.reply({ content: `❌ لم أجد ملف الأمر.`, ephemeral: true });
        }

        // امسح الكاش
        delete require.cache[require.resolve(foundFile)];

        try {
            const newCommand = require(foundFile);
            client.commands.set(newCommand.data.name, newCommand);
            if (newCommand.aliases) {
                newCommand.aliases.forEach(a => client.aliases.set(a, newCommand.data.name));
            }

            const embed = new EmbedBuilder()
                .setColor('#43B581')
                .setTitle('✅ Command Reloaded')
                .setDescription(`تمت إعادة تحميل: \`${newCommand.data.name}\``)
                .setFooter({ text: config.bot.signature })
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({ content: `❌ فشل: ${err.message}`, ephemeral: true });
        }
    },

    async executePrefix(message, args, client) {
        if (message.author.id !== config.info.developerId) return message.reply('❌ للمطور فقط.');
        const commandName = args[0]?.toLowerCase();
        if (!commandName) return message.reply('❌ استخدم: `!reload <command>`');
        const command = client.commands.get(commandName);
        if (!command) return message.reply('❌ الأمر غير موجود.');

        // ✅ ابحث عن الملف بنفس طريقة slash version
        const commandsPath = path.join(__dirname, '..');
        let foundFile = null;
        function searchDir(dir) {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory()) {
                    searchDir(path.join(dir, item.name));
                } else if (item.name === `${commandName}.js`) {
                    foundFile = path.join(dir, item.name);
                }
            }
        }
        searchDir(commandsPath);

        if (!foundFile) return message.reply('❌ لم أجد ملف الأمر.');

        // امسح الكاش
        delete require.cache[require.resolve(foundFile)];

        try {
            const newCommand = require(foundFile);
            client.commands.set(newCommand.data.name, newCommand);
            // ✅ امسح الـ aliases القديمة ثم أضف الجديدة
            // (مهم: لو غيّر الأمر aliases بين الإصدارات، القديمة تبقى معلقة)
            if (command.aliases && Array.isArray(command.aliases)) {
                command.aliases.forEach(a => client.aliases.delete(a));
            }
            if (newCommand.aliases) {
                newCommand.aliases.forEach(a => client.aliases.set(a, newCommand.data.name));
            }

            await message.reply(`✅ تمت إعادة تحميل \`${newCommand.data.name}\` بنجاح.`);
        } catch (err) {
            await message.reply(`❌ فشل: ${err.message}`);
        }
    },
};
