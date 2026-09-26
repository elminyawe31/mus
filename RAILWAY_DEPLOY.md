# 🚀 دليل النشر الكامل على Railway

## 🎯 المشكلة والحل

**المشكلة**: YouTube يكتشف Railway IPs كـ bots حتى مع:
- ✅ Outbound IPv6 مفعّل
- ✅ Cookies تلقائية
- ✅ PO Token (bgutil)
- ✅ android_music client

**الحل النهائي (v26.6)**: عائلة ytmp3 كاملة — **gamma** (ytmp3.gl) + **epsilon** (convertytmp3.org) بمفتاحين مختلفين ومعدلَي طلبات منفصلين مع rotation تلقائي عند 429، ثم yt-dlp بسلسلة player clients بديلة. الجلسة (auth+init) تُعاد استخدامها 10 دقائق لعدة أغانٍ (مُثبت بالاختبار: طلب auth واحد لثلاث أغانٍ) — يخفض الضغط على rate limit بنسبة ~90%.

| الميزة | القيمة |
|------|-------|
| التكلفة | **مجاني 100%** |
| Bot detection | ✅ **مكسور بالكامل** |
| يحتاج Cloudflare Worker | ❌ لا (تبسيط!) |
| يحتاج WARP | ❌ لا (Railway يحظر UDP) |
| صيغة الإخراج | MP3 (128 kbps) |
| سرعة التنزيل | ~4 ثواني للأغنية العادية |

---

## 📋 خطوات النشر (10 دقائق فقط)

### الخطوة 1: ارفع البوت على GitHub (3 دقائق)

```cmd
cd /d G:\mus-bot
git init
git add .
git commit -m "feat: ytmp3 API for YouTube bot detection bypass"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/elminyawe31/mus.git
git push -u origin main --force
```

### الخطوة 2: أنشئ خدمة على Railway (2 دقيقة)

1. https://railway.app → **New Project** → **Deploy from GitHub repo**
2. اختر `elminyawe31/mus`
3. Railway سيكتشف Dockerfile تلقائياً ✅

### الخطوة 3: أضف المتغيرات الإجبارية (1 دقيقة)

في Railway → **Variables**:

| المتغير | القيمة |
|---------|--------|
| `DISCORD_TOKEN` | توكن البوت |
| `CLIENT_ID` | Application ID |

**هذا كل شيء!** لا حاجة لأي إعدادات إضافية. ytmp3 API مدمج في الكود.

### الخطوة 4: فعّل Outbound IPv6 (1 دقيقة) — لتحسين البحث

في Railway → **Settings** → **Networking**:
- ✅ **Outbound IPv6: ENABLED**

### الخطوة 5: Deploy! 🚀

اضغط **Deploy** وانتظر البناء (~3-5 دقائق).

---

## 🎯 دعوة البوت لسيرفرك

استبدل `CLIENT_ID` بقيمتك:

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=36718592&scope=bot%20applications.commands
```

ثم في ديسكورد اكتب:
```
/play query: ياه تامر عاشور
```

أو:
```
!play ياه تامر عاشور
```

---

## 📊 ما يجب أن تراه في الـ logs

### عند بدء التشغيل:
```
[entrypoint] 🎉 MUS Bot v26.1 — Dev: ELMINYAWE 👨‍💻 جاهز!
[entrypoint]    ├─ Discord: ✅
[entrypoint]    ├─ Connection: auto (IPv6: true, WARP: false)
[entrypoint]    ├─ Spotify: ✅ مفعّل (مدمج في الكود)
[entrypoint]    ├─ Prefix commands: true (prefix="!")
[entrypoint]    ├─ Slash commands: true
[entrypoint]    └─ Resilience: مفعّل
✅ [SHARD 0] Music 🎶#7358 is online!
```

### عند تشغيل أغنية:
```
🔍 Searching for ياه تامر عاشور...
🍪 [YouTube] Using cookies: /app/cookies/cookies.txt
✅ Found: Tamer Ashour - Yaah | تامر عاشور - ياه

🌐 [MusicPlayer] Downloading via multi-provider chain...
[YouTube] Downloading 930jCCMazh4 via ytmp3.gl API...
  ✅ Auth: got session key
  ✅ Init: got convertURL
  🔄 Following redirect 1...
  ✅ Convert: got downloadURL (title: Tamer Ashour - Yaah | تامر عاشور - ياه)
  [ytmp3.gl] downloaded 3.88 MB in 8.2s
✅ [MusicPlayer] Download succeeded: Tamer Ashour - Yaah | تامر عاشور - ياه
🎵 Playing from cached file: track_b7ae8ac011a061bcb908107127cbac57.opus
▶️  Playing: Tamer Ashour - Yaah | تامر عاشور - ياه
```

**بدون أي أخطاء bot detection!** ✅

---

## 🛠️ استكشاف الأخطاء

### المشكلة: ytmp3 download failed

- الـ API قد يكون مشغولاً مؤقتاً — البوت يحاول yt-dlp تلقائياً كـ fallback
- إذا فشل الاثنان، تحقق من الـ logs للتأكد من الخطأ

### المشكلة: slash commands لا تظهر

- انتظر حتى 10 دقائق (global commands propagation)
- أو أضف `GUILD_ID` لتسجيل أسرع في سيرفر واحد

### المشكلة: البوت يدخل القناة لكن لا يصدر صوتاً

- تأكد أن البوت ليس مكتوم (serverMute/serverDeaf)
- راجع logs للبحث عن أخطاء ffmpeg

---

## 📁 بنية المشروع

```
mus-bot/
├── Dockerfile              # متعدد المراحل لـ Railway
├── railway.json            # تكوين Railway
├── docker-compose.yml      # للتشغيل المحلي
├── entrypoint.sh           # تهيئة عند الإقلاع
├── supervisord.conf        # إدارة 4 عمليات
├── warp-setup.sh           # WARP fallback (للـ VPS بدون IPv6)
├── yt_cookies.py           # نظام الكوكيز الذكي
├── cloudflare-worker.js    # (اختياري) Cloudflare Worker بديل
├── package.json
├── config.js               # تكوين شامل
├── index.js                # نقطة الدخول + prefix command handler
├── commands/               # slash + prefix commands
├── events/                 # معالجات الأحداث
├── src/
│   ├── YouTube.js          # ⭐ ytmp3 family (gamma+epsilon) + yt-dlp ladder
│   ├── Spotify.js          # سبوتيفاي (مدمج)
│   ├── MusicPlayer.js      # مشغل الصوت
│   ├── ResilienceManager.js # نظام التوقعات (14 حالة)
│   └── ...
├── languages/              # 23 لغة
└── README.md
```

---

## 💰 التكلفة الكلية

| الخدمة | التكلفة |
|-------|--------|
| GitHub | مجاني |
| Railway | $5 credit مجاني شهرياً |
| ytmp3.gl API | مجاني (اكتشاف تلقائي للمفتاح) |
| Spotify API | مجاني |
| Discord API | مجاني |

**المجموع**: $0/شهر للاستخدام الشخصي 🎉

---

## 📞 الدعم

- **ytmp3.gl API**: مدمج في الكود مع اكتشاف تلقائي
- **Railway Docs**: https://docs.railway.com
- **Discord Support**: https://discord.gg/ACJQzJuckW

---

# 🛡️ v26.7 — تحديث الاستقرار الدائم (Permanent Uptime)

## ما الجديد في v26.7؟

### 1. إصلاح مشكلة "اسم الأغنية لا يظهر" في الكارت 🎨
**السبب الجذري (تم تشخيصه بدقة):**
- الخط العربي `Kalam` كان مسجلاً في الكود لكنه **لم يكن مستخدماً أبداً** في الرسم!
- كل النصوص كانت تُرسم بخط `DejaVu` الذي لا يدعم الصينية إطلاقاً وعربه ضعيف
- عناوين الأغاني العربية/الصينية في بعض السيرفرات = نص فارغ على البطاقة

**الحل:**
- كشف نوع الكتابة تلقائياً: عربي → Kalam | صيني/ياباني/كوري → NotoSansCJK | غير ذلك → DejaVu
- تحقق بالرسم الفعلي عند تسجيل الخطوط (وليس مجرد نجاح التسجيل)
- إضافة `fonts-noto-cjk` إلى Dockerfile (خطوط صينية/يابانية/كورية)
- قص العنوان بالبكسل بدل عدد الحروف + تنظيف emoji

### 2. كاش الصور (يمنع rate-limit من يوتيوب) 🖼️
- كانت الصورة المصغرة تُعاد تنزيلها من يوتيوب **كل 5 ثوان لكل سيرفر**
- الآن: كاش LRU (48 صورة / ساعتان) — تنزيل واحد لكل أغنية فقط
- مهلة زمنية 6 ثوان للتنزيل (كان يمكن أن يعلّق البطاقة للأبد)

### 3. التعافي الذاتي 🛠️
- فشلان متتاليان في الرسم → إعادة تسجيل الخطوط + مسح الكاش تلقائياً
- كل قسم في البطاقة داخل try/catch مستقل — فشل قسم لا يُسقط البطاقة
- تخطي إعادة الرسم عند عدم التغير (أثناء الإيقاف المؤقت) — توفير CPU

### 4. Lyrics — سلسلة 3 مزودين مجانيين بالكامل 🎤
| الترتيب | المزود | ملاحظات |
|--------|--------|---------|
| 1 | **LRCLIB** (lrclib.net) | API مجاني رسمي JSON — يدعم البحث بالمُدة + تقييم النتائج |
| 2 | **lyrics.ovh** | API مجاني بدون مفتاح |
| 3 | **Genius** (scraping) | الملاذ الأخير (يُحظر من Cloudflare كثيراً) |

- تنظيف عناوين عربية محسّن: فصل "الفنان - الأغنية" و"|" وإزالة (الكليب الرسمي، كلمات، حصرياً...)
- cooldown ذكي: مزود يفشل 3 مرات يُتخطى نصف ساعة
- كاش محدود 300 مدخل (كان بلا حدود — تسرب ذاكرة)

### 5. StabilityManager — التشغيل الدائم 🛡️ (جديد)
نظام جديد يعمل تلقائياً بدون أي تكوين:

| المراقب | التكرار | الوظيفة |
|---------|---------|---------|
| مراقب الذاكرة | 15 دقيقة | تنظيف الكاشات عند 600MB + إعادة تشغيل رشيقة عند 1200MB |
| مراقب الصوت 24/7 | دقيقتان | إعادة الانضمام لسيرفرات 247 ذات الاتصال الميت |
| منظّف الكارت | 10 دقائق | إيقاف intervals اليتيمة (تسرب CPU) |
| نظافة الكاش الصوتي | ساعة | حذف ملفات أقدم من 24 ساعة |
| تقرير الحالة | 6 ساعات | uptime + ذاكرة + players في السجلات |

### 6. متغيرات environment الجديدة (كلها اختيارية)
```env
MEM_WARN_MB=600            # حد تنظيف الكاشات
MEM_CRITICAL_MB=1200       # حد إعادة التشغيل الرشيقة
AUTO_RESTART_ON_OOM=1      # إعادة تشغيل عند خطر الذاكرة (1=ON)
AUTO_RESTART_HOURS=0       # إعادة تشغيل مجدولة (0=معطل | 168=أسبوعياً — مستحسن)
AUDIO_CACHE_MAX_AGE_H=24   # عمر ملفات الكاش بالساعات
```

> 💡 **نصيحة للـ uptime بالأشهر**: فعّل `AUTO_RESTART_HOURS=168` في Railway —
> إعادة تشغيل رشيقة أسبوعياً (~15 ثانية) مع استعادة تلقائية كاملة للجلسات
> تحافظ على الذاكرة نظيفة وتمنع أي تراكم عبر الأسابيع.

## لماذا إعادة التشغيل الرشيقة آمنة تماماً؟
1. supervisord يعيد إقلاع البوت تلقائياً خلال ثوانٍ (autorestart=true)
2. session restore يعيد كل الجلسات والطوابير تلقائياً
3. الإعدادات محفوظة في database/settings.json (من v26.4)
4. موضع التشغيل يُحفظ قبل الخروج (resume من نفس الثانية)

## الاختبارات (164/164 ✅)
- v26.7 stability: 50/50 (بطاقات عربي/صيني/إيموجي + بكسلات فعلية + مزودو الكلمات)
- v26.4 regression: 55/55
- MusicPlayer: 20/20
- Favourites: 39/39

---

## v26.8 — بطاقة musicard Ease

### ما الجديد
- بطاقة NowPlaying بتصميم **musicard Ease الأصلي** (الثيم الفاتح كما في معاينة الريبو)
- **إصلاح جذري لمشكلة مربعات العربية □□□**: خط Tajawal (عربي+لاتيني، 5 أوزان) مرفق
  داخل `src/base/fonts/` + كاشف tofu محصّن (مربعات = حروف متطابقة = رفض)
- زوايا superellipse طبيعية + أشرطة pill + خلفية ضبابية + زوايا شفافة

### اختيار الثيم (اختياري)
```
MUSIC_CARD_THEME=ease        # الفاتح (الافتراضي — مثل معاينة musicard)
MUSIC_CARD_THEME=ease-dark   # الداكن
```
لا يحتاج أي متغير — الفاتح هو الافتراضي بدون إعدادات.

### ملاحظة الخطوط
الخطوط العربية مرفقة داخل الريبو (`src/base/fonts/Tajawal-*.ttf`) وتُنسخ تلقائياً
مع `COPY src/ ./src/` — لا حاجة لتثبيت أي حزم خطوط عربية في Dockerfile.
