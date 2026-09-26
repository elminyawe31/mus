# 🎵 MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻

بوت ديسكورد موسيقي كامل مع أوامر هجينة (slash + prefix) ونظام توقعات شامل، جاهز للنشر على Railway.

## ✨ المميزات

### 🎯 المميزات الأساسية
- ✅ **يدعم YouTube بدون API key** — يستخدم yt-dlp + bgutil + WARP
- ✅ **أوامر هجينة**: slash commands (`/play`) + prefix commands (`!play` أو `!p`)
- ✅ **يدعم Spotify** (مع API keys اختيارية)
- ✅ **يدعم SoundCloud + Direct Links**
- ✅ **21 لغة** بما فيها العربية
- ✅ **21 فلتر صوتي** (bassboost, nightcore, vaporwave, 8D, etc.)
- ✅ **autoplay ذكي** + lyrics + queue management

### 🛡️ نظام التوقعات (Resilience)
يحوّل 14 حالة حافة إلى استجابات آمنة:
1. لاعب يخرج من القناة الصوتية أثناء البث
2. البوت يتعرض لـ disconnect أثناء البث
3. انقطاع اتصال Discord WebSocket
4. القناة الصوتية تصبح فارغة
5. البوت يُطرد من السيرفر
6. السيرفر يُحذف
7. انقطاع الإنترنت
8. ffmpeg فشل
9. yt-dlp فشل
10. voice connection تُقطع فجأة
11. القناة الصوتية تُحذف أثناء البث
12. كتم/إلغاء كتم البوت
13. الـ token ينتهي
14. العضو يُطرد أثناء البث

### 🌐 بيئات التشغيل المدعومة
- **Railway** مع Outbound IPv6 (لا يحتاج WARP)
- **VPS عادي** بدون IPv6 (يستخدم WARP تلقائياً)
- **Docker** على أي منصة

## 🚀 النشر على Railway (الطريقة الموصى بها)

### الخطوة 1: ارفع المشروع لـ GitHub

```bash
git init
git add .
git commit -m "Initial commit: MUS Bot v26.2 — Dev: ELMINYAWE 👨‍💻"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```

### الخطوة 2: أنشئ خدمة على Railway

1. اذهب إلى https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. اختر الـ repo الذي رفعته
4. Railway سيكتشف `Dockerfile` تلقائياً

### الخطوة 3: اضبط المتغيرات في Railway

في Railway → **Variables**، أضف:

| المتغير | القيمة | مطلوب؟ |
|---------|--------|--------|
| `DISCORD_TOKEN` | توكن البوت من Discord Developer Portal | ✅ إجباري |
| `CLIENT_ID` | Application ID من نفس البوابة | ✅ إجباري |
| `SPOTIFY_CLIENT_ID` | من Spotify Developer Dashboard | 🔵 اختياري |
| `SPOTIFY_CLIENT_SECRET` | من Spotify Developer Dashboard | 🔵 اختياري |
| `GENIUS_CLIENT_ID` | من Genius API (لكلمات الأغاني) | 🔵 اختياري |
| `YT_CONNECTION_MODE` | `auto` (افتراضي) | 🔵 اختياري |

### الخطوة 4: فعّل Outbound IPv6

في Railway → **Settings** → **Networking** → **Outbound IPv6: ENABLED**

هذا يحل معظم مشاكل YouTube bot detection بدون الحاجة لـ WARP.

### الخطوة 5: Deploy!

Railway سيبني الصورة تلقائياً ويشغّلها. سترى logs مثل:

```
✅ [SHARD 0] Music 🎶#7358 is online!
🎵 [SHARD 0] Serving X servers
🌐 Environment: Railway | IPv6: ✓ | Mode: auto
📝 Commands: slash ✓ | prefix "!" ✓
```

## 🎯 دعوة البوت لسيرفرك

بعد النشر، استخدم هذا الـ URL (استبدل `CLIENT_ID`):

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=36718592&scope=bot%20applications.commands
```

ثم في أي قناة نصية، اكتب:
- `/play query:ياه تامر عاشور` (slash command)
- أو `!play ياه تامر عاشور` (prefix command)
- أو `!p ياه تامر عاشور` (alias مختصر)

## 🧪 نتائج الاختبار

تم اختبار البوت بنجاح في 9 جولات (3×3):

| الجولة | Test 1 (بحث+بث) | Test 2 (prefix) | Test 3 (edge case) |
|-------|-----------------|----------------|-------------------|
| 1 | ✅ | ✅ | ✅ |
| 2 | ✅ | ✅ | ✅ |
| 3 | ✅ | ✅ | ✅ |
| 4 | ✅ | ✅ | ✅ |
| 5 | ✅ | ✅ | ✅ |
| 6 | ✅ | ✅ | ✅ |
| 7 | ✅ | ✅ | ✅ |
| 8 | ✅ | ✅ | ✅ |
| 9 | ✅ | ✅ | ✅ |

**التغطية:**
- ✅ بحث عن أغنية "ياه تامر عاشور" (1.5 ثانية في المتوسط)
- ✅ انضمام لقناة صوتية حقيقية
- ✅ بث فعلي لمدة 17-24 ثانية في كل اختبار
- ✅ playbackDuration يتزايد بمعدل 1 ثانية لكل ثانية (دليل على الصوت يتدفق)
- ✅ slash commands تعمل
- ✅ prefix commands تعمل (!play, !p)
- ✅ البوت يستعيد تشغيل الأغنية من نفس النقطة بعد disconnect

## 📋 المتغيرات الكاملة

| المتغير | الافتراضي | الوصف |
|---------|----------|-------|
| `DISCORD_TOKEN` | — | **إجباري** |
| `CLIENT_ID` | — | **إجباري** |
| `GUILD_ID` | فارغ | لتسجيل slash commands في سيرفر واحد (أسرع) |
| `SPOTIFY_CLIENT_ID` | فارغ | لتفعيل Spotify |
| `SPOTIFY_CLIENT_SECRET` | فارغ | لتفعيل Spotify |
| `SPOTIFY_MARKET` | `US` | كود الدولة لـ Spotify search |
| `GENIUS_CLIENT_ID` | فارغ | لكلمات الأغاني |
| `PREFIX` | `!` | الـ prefix للأوامر النصية |
| `ENABLE_PREFIX` | `true` | تفعيل prefix commands |
| `ENABLE_SLASH` | `true` | تفعيل slash commands |
| `PREFIX_ADMIN_ONLY` | `false` | قصر prefix commands على الأدمن |
| `YT_CONNECTION_MODE` | `auto` | `auto`/`ipv6`/`warp` |
| `YT_PLAYER_CLIENTS` | `android_music,web_safari,web,ios` | عملاء YouTube |
| `EMPTY_VOICE_TIMEOUT_MS` | `300000` | مهلة بقاء البوت في قناة فارغة (5 دقائق) |
| `MAX_RECONNECT_ATTEMPTS` | `3` | محاولات إعادة الاتصال |
| `AUTO_RESUME` | `true` | استئناف التشغيل بعد reconnect |

## 📁 بنية المشروع

```
mus-bot/
├── Dockerfile              # صورة Docker متعددة المراحل لـ Railway
├── railway.json            # تكوين Railway
├── docker-compose.yml      # للتشغيل المحلي بـ Docker Compose
├── entrypoint.sh           # تهيئة عند بدء الحاوية
├── supervisord.conf        # إدارة العمليات المتعددة
├── warp-setup.sh           # تسجيل WARP تلقائياً
├── yt_cookies.py           # نظام الكوكيز الذكي
├── package.json
├── config.js               # تكوين شامل مع 3 أوضاع اتصال
├── index.js                # نقطة الدخول + prefix command handler
├── shard.js                # sharding manager
├── commands/               # slash + prefix commands
│   ├── play.js             # /play أو !play
│   ├── search.js           # /search أو !s
│   ├── nowplaying.js       # /nowplaying أو !np
│   ├── language.js         # تغيير اللغة
│   └── help.js             # مساعدة
├── events/                 # معالجات الأحداث
├── src/
│   ├── YouTube.js          # يوتيوب بروفايدر مع حلول elminyawe
│   ├── Spotify.js          # سبوتيفاي بروفايدر
│   ├── SoundCloud.js
│   ├── MusicPlayer.js      # مشغل الصوت مع resilience
│   ├── MusicEmbedManager.js
│   ├── ResilienceManager.js # نظام التوقعات (14 حالة)
│   ├── PlayerStateManager.js
│   ├── LanguageManager.js   # 23 لغة
│   ├── LyricsManager.js    # كلمات الأغاني (Genius + LRCLIB)
│   └── ErrorHandler.js
├── languages/              # 23 ملف ترجمة (ar, en, fr, de, tr, ...)
├── database/              # حالة البوت المحفوظة
├── scripts/
│   └── update-ytdlp.js   # تحديث yt-dlp تلقائياً
└── bin/
    └── yt-dlp-wrapper.sh # Python yt-dlp wrapper
```

## 🐛 استكشاف الأخطاء

### البوت لا يستجيب لـ `/play`

1. انتظر حتى ساعة لتسجيل global commands (أو استخدم `GUILD_ID` لتسجيل أسرع)
2. تأكد أن البوت دُعي بالـ scope: `bot applications.commands`
3. راجع الـ logs في Railway

### YouTube يعطي "Sign in to confirm you're not a bot"

1. تحقق أن Outbound IPv6 مفعّل في Railway
2. راجع logs bgutil: `docker logs CONTAINER | grep bgutil`
3. راجع ملف الكوكيز: `docker exec CONTAINER ls /app/cookies/`
4. جدّد الكوكيز يدوياً: `docker exec CONTAINER python3 /opt/scripts/yt_cookies.py --once`

### البوت يدخل القناة لكن لا يصدر صوتاً

1. تأكد أن البوت ليس مكتوم (serverMute/serverDeaf)
2. تأكد أن `ffmpeg` مثبت (مدمج في Dockerfile)
3. راجع logs المشغل للبحث عن أخطاء ffmpeg

## 🙏 شكر خاص

- **umutxyp** — البوت الأساسي: https://github.com/umutxyp/MusicBot
- **elminyawe31** — حلول WARP + Cookies + PO Token: https://github.com/elminyawe31/mu
- **Brainicism** — bgutil PO Token provider: https://github.com/Brainicism/bgutil-ytdlp-pot-provider
- **yt-dlp team** — المحرك الأساسي: https://github.com/yt-dlp/yt-dlp

## 📝 الترخيص

MIT License — استخدم بحرية.
