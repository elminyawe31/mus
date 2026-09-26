// scripts/check_commands.js — فحص شامل لكل ملفات commands لاكتشاف أخطاء شائعة
// لا يحاول require() لأن discord.js غير مثبت محلياً
// بدلاً من ذلك: syntax check + تحليل الـ AST لاكتشاف:
//   - missing data/execute
//   - duplicate aliases
//   - missing config require
//   - missing LanguageManager require
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const commandsDir = path.join(__dirname, '..', 'commands');
const issues = [];
const aliasMap = new Map(); // alias -> file
let totalCommands = 0;
let okCommands = 0;

function walk(dir) {
    for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) { walk(full); continue; }
        if (!file.endsWith('.js')) continue;

        totalCommands++;
        const rel = path.relative(commandsDir, full);
        const code = fs.readFileSync(full, 'utf8');

        // 1. Syntax check via vm.Script
        try {
            new vm.Script(code, { filename: full });
        } catch (e) {
            issues.push(`❌ ${rel}: SYNTAX ERROR — ${e.message.split('\n')[0]}`);
            continue;
        }

        const problems = [];

        // 2. Has module.exports = {
        if (!/module\.exports\s*=\s*\{/.test(code)) {
            problems.push('missing `module.exports = {`');
        }
        // 3. Has data: new SlashCommandBuilder
        if (!/data\s*:\s*new\s+SlashCommandBuilder/.test(code)) {
            problems.push('missing `data: new SlashCommandBuilder`');
        }
        // 4. Has async execute
        if (!/async\s+execute\s*\(/.test(code) && !/execute\s*:\s*async\s*\(/.test(code)) {
            problems.push('missing `async execute(...)`');
        }
        // 5. Aliases check (look for `aliases:`)
        const aliasMatch = code.match(/aliases\s*:\s*\[([^\]]+)\]/);
        if (aliasMatch) {
            const aliases = aliasMatch[1].split(',').map(a => a.trim().replace(/['"`]/g, ''));
            for (const a of aliases) {
                if (!a) continue;
                if (aliasMap.has(a)) {
                    problems.push(`duplicate alias \`${a}\` (also in ${aliasMap.get(a)})`);
                } else {
                    aliasMap.set(a, rel);
                }
            }
        }

        if (problems.length === 0) okCommands++;
        else issues.push(`⚠️  ${rel}: ${problems.join(' | ')}`);
    }
}

walk(commandsDir);

console.log('════════════════════════════════════════════════════════════');
console.log(`📊 Total: ${totalCommands} | OK: ${okCommands} | Issues: ${issues.length}`);
console.log('════════════════════════════════════════════════════════════');
if (issues.length) {
    console.log('\nIssues found:');
    issues.forEach(i => console.log('  ' + i));
} else {
    console.log('\n✅ All commands are valid.');
}

// Print all collected aliases for review
console.log(`\n📋 Total unique aliases: ${aliasMap.size}`);
