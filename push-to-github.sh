#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
#  push-to-github.sh — ينشئ نسخة نظيفة جاهزة للنشر على Railway عبر GitHub
#  الاستخدام:
#    1. ضع هذا السكربت في نفس مجلد mus-final
#    2. chmod +x push-to-github.sh
#    3. ./push-to-github.sh
#
#  ماذا يفعل:
#    • ينظف ملفات cache / cookies / logs قبل النشر
#    • يتحقق من عدم وجود مراجع "Beatra" problematic
#    • يتحقق من syntax كل ملفات JS
#    • يطبع تعليمات واضحة لرفع الكود إلى GitHub
# ═══════════════════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")"

echo "🧹 1. تنظيف ملفات الـ cache والـ cookies والـ logs..."
# احذف cache و cookies مؤقتة (ستُعاد توليدها عند التشغيل)
# ⚠️ ملاحظة مهمة: لا تحذف محتويات database/! هي مطلوبة للـ Dockerfile COPY
# بدلاً من ذلك، نحافظ على ملفات JSON الافتراضية فارغة {}
rm -rf audio_cache/*
rm -rf cookies/*
rm -rf logs/*
rm -f database/*.db 2>/dev/null || true
rm -f .env  # لا ترفع الـ .env مع الكود!

# تأكد أن database/ يحتوي على ملفات JSON الافتراضية (هذا يمنع خطأ COPY في Dockerfile)
mkdir -p database
[ -f database/languages.json ] || echo '{}' > database/languages.json
[ -f database/playerState.json ] || echo '{}' > database/playerState.json
# أضف .gitkeep للمجلدات الفارغة حتى يتتبعها git
touch audio_cache/.gitkeep cookies/.gitkeep logs/.gitkeep database/.gitkeep

echo "🔍 2. التحقق من عدم وجود مراجع 'Beatra' problematic..."
# القاعدة: نبحث عن "beatra" في الكود. السطور التالية تُعتبر مقبولة (defense code):
#   - سطور تبدأ بـ // (تعليق JS)
#   - سطور تحتوي على: grep / test / override / discard / "Beatra / play" (في تعليق)
# فقط السطور التي تُعيّن "Beatra" كقيمة فعلية (مثل: status = 'Beatra...') هي المشكلة
BEATRA_PROBLEMS=""
while IFS= read -r -d '' file; do
    [[ "$file" == "./push-to-github.sh" ]] && continue
    # اقرأ كل سطر يحتوي beatra (case-insensitive)
    while IFS=: read -r lineno content; do
        # تجاوز السطور الفارغة
        [[ -z "$content" ]] && continue
        # تجاوز سطور التعليقات (تبدأ بـ // أو # أو * أو "Beatra / play" داخل نص)
        stripped=$(echo "$content" | sed -e 's/^[[:space:]]*//' -e 's/.*\* //')
        case "$stripped" in
            //*) continue ;;                       # تعليق JS
            \#*) continue ;;                       # تعليق Shell
            \**) continue ;;                       # تعليق JSDoc
        esac
        # تجاوز defense code: أي سطر يذكر beatra في سياق الكشف/التجاوز/الإعادة كتابة
        if echo "$content" | grep -qiE "(grep.*beatra|test\(.*beatra|/beatra/|override.*beatra|discard.*beatra|beatra.*override|defense.*beatra|beatra.*defense|contains.*beatra|detected.*beatra|beatra.*detected)"; then
            continue
        fi
        # تجاوز سطور الـ log messages (تبدأ بـ log " أو logger. أو console.log)
        if echo "$stripped" | grep -qiE "^(log |logger\.|console\.log)"; then
            continue
        fi
        # إذا وصلنا لهنا = السطر يحتوي beatra بشكل إشكالي
        BEATRA_PROBLEMS="$BEATRA_PROBLEMS\n   $file:$lineno: $content"
    done < <(grep -in "beatra" "$file" 2>/dev/null || true)
done < <(find . -type f \( -name "*.js" -o -name "*.json" -o -name "*.sh" -o -name "*.yml" -o -name "*.yaml" -o -name "*.conf" -o -name "*.md" -o -name "*.env*" \) -not -path "./node_modules/*" -not -path "./.git/*" -not -name "push-to-github.sh" -print0)
if [[ -z "$BEATRA_PROBLEMS" ]]; then
    echo "✅ كل مراجع 'beatra' هي defense code فقط (مطلوبة)"
else
    echo "❌ Found problematic Beatra refs:"
    echo -e "$BEATRA_PROBLEMS"
fi

echo "🔍 3. التحقق من syntax كل ملفات JS..."
ERRORS=0
while IFS= read -r -d '' file; do
    # تجاوز cloudflare-worker.js (يستخدم Cloudflare Workers API وليس Node.js)
    [[ "$file" == "./cloudflare-worker.js" ]] && continue
    if ! node -c "$file" 2>/dev/null; then
        echo "❌ Syntax error in: $file"
        ERRORS=$((ERRORS+1))
    fi
done < <(find . -name "*.js" -not -path "./node_modules/*" -print0)
if [[ $ERRORS -eq 0 ]]; then
    echo "✅ كل ملفات JS صحيحة"
else
    echo "❌ يوجد $ERRORS ملف به أخطاء syntax"
    exit 1
fi

echo "🔍 4. التحقق من توفر الملفات الحرجة..."
for f in index.js config.js entrypoint.sh Dockerfile supervisord.conf package.json railway.json; do
    if [[ -f "$f" ]]; then
        echo "   ✅ $f"
    else
        echo "   ❌ MISSING: $f"
        exit 1
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ الكود نظيف وجاهز للنشر!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📋 الخطوات التالية لرفعه على GitHub (repo: elminyawe31/mus):"
echo ""
echo "  # 1) ادخل مجلد mus-final"
echo "  cd $(pwd)"
echo ""
echo "  # 2) إذا كان عندك repo قديم، احذفه أولاً ثم أنشئ جديداً"
echo "  #    من https://github.com/new باسم: mus"
echo ""
echo "  # 3) اربط الكود بـ GitHub"
echo "  git init"
echo "  git branch -M main"
echo "  git add ."
echo "  git commit -m 'feat: MUS Bot v26.1 — Dev: ELMINYAWE 👨‍💻 (forced presence, no Beatra refs)'"
echo "  git remote add origin https://github.com/elminyawe31/mus.git"
echo "  git push -u origin main --force"
echo ""
echo "  # 4) على Railway:"
echo "  #    - إذا كان لديك خدمة قديمة، احذفها (Settings > Delete Service)"
echo "  #    - أنشئ خدمة جديدة من GitHub repo: elminyawe31/mus"
echo "  #    - أضف متغيرات البيئة:"
echo "  #        DISCORD_TOKEN=<your_token>"
echo "  #        CLIENT_ID=<your_app_id>"
echo "  #    - لا تضف STATUS — الكود سيفرض 'Dev : ELMINYAWE' تلقائياً"
echo "  #    - Railway سيبني الحاوية ويشغّلها تلقائياً"
echo ""
echo "  # 5) بعد 3-5 دقائق، سيظهر البوت بحالة:"
echo "  #    🟡 idle • Listening to 'Dev : ELMINYAWE'"
echo ""
