# ═══════════════════════════════════════════════════════════════════════════
#   MUS Bot v26.1 — Dev: ELMINYAWE — Dockerfile مُحسّن لـ Railway
#   ─────────────────────────────────────────────────────────────────────────
#   ي detected تلقائياً بواسطة Railway عند push إلى GitHub
#
#   المميزات:
#     • يعمل على Railway مع Outbound IPv6 (لا يحتاج WARP)
#     • يعمل على VPS عادي (مع WARP تلقائياً كـ fallback)
#     • يدعم Spotify API keys
#     • يدعم أوامر هجينة (slash + prefix)
#     • نظام توقعات شامل لحالات الحافة
#
#   متغيرات البيئة المطلوبة (تُمرر من Railway):
#     • DISCORD_TOKEN  (إجباري)
#     • CLIENT_ID      (إجباري)
#     • SPOTIFY_CLIENT_ID     (اختياري)
#     • SPOTIFY_CLIENT_SECRET (اختياري)
#     • YT_CONNECTION_MODE   (auto|ipv6|warp — افتراضي: auto)
#
#   للنشر على Railway:
#     1. ارفع هذا المشروع لـ GitHub repo
#     2. في Railway: New Project > Deploy from GitHub repo > اختر الـ repo
#     3. Railway سيكتشف Dockerfile تلقائياً
#     4. أضف المتغيرات في Railway > Variables
#     5. فعّل "Outbound IPv6" في إعدادات الخدمة
# ═══════════════════════════════════════════════════════════════════════════

# ── المرحلة 1: بناء bgutil PO Token server ─────────────────────────────────
FROM node:22-bookworm-slim AS bgutil-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch 2.0.0 \
        https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git \
        /opt/bgutil \
    && cd /opt/bgutil/server \
    && npm install --no-audit --no-fund --loglevel=error \
    && npx tsc \
    && npm prune --omit=dev \
    && test -f /opt/bgutil/server/build/main.js \
    && npm cache clean --force \
    && rm -rf /root/.npm

# ── المرحلة 2: الصورة النهائية ─────────────────────────────────────────────
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    TZ=UTC

# ── حزم النظام: ffmpeg + Python + supervisor + curl + unzip (مطلوب لـ Deno) ──
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        python3 \
        python3-pip \
        python3-venv \
        ca-certificates \
        curl \
        wget \
        git \
        supervisor \
        unzip \
        fonts-dejavu \
        fonts-liberation \
        fonts-freefont-ttf \
        fonts-noto-cjk \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libpixman-1-0 \
        libcairo2 \
        libjpeg62-turbo \
        libgif7 \
        librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

# ── Deno: JS runtime لمعالجة تحديات YouTube الحديثة ──────────────────────
ENV DENO_INSTALL=/usr/local
RUN curl -fsSL https://deno.land/install.sh | sh -s v2.5.2 \
    && deno --version \
    && rm -rf /tmp/*

# ── Python packages: yt-dlp + bgutil PO Token plugin ──────────────────────
RUN python3 -m pip install --no-cache-dir --break-system-packages \
        "yt-dlp==2026.8.19" \
        "bgutil-ytdlp-pot-provider==2.0.0"

# ── wgcf + wireproxy: WARP userspace tunnel (يُستخدم فقط إذا IPv6 غير متاح) ──
RUN mkdir -p /opt/warp/bin \
    && curl -fL --retry 3 --connect-timeout 30 \
         -o /opt/warp/bin/wgcf \
         "https://github.com/ViRb3/wgcf/releases/download/v2.3.0/wgcf_2.3.0_linux_amd64" \
    && chmod +x /opt/warp/bin/wgcf \
    && curl -fL --retry 3 --connect-timeout 30 \
         -o /tmp/wireproxy.tar.gz \
         "https://github.com/windtf/wireproxy/releases/download/v1.1.3/wireproxy_linux_amd64.tar.gz" \
    && tar -xzf /tmp/wireproxy.tar.gz -C /opt/warp/bin wireproxy \
    && rm -f /tmp/wireproxy.tar.gz \
    && chmod +x /opt/warp/bin/wireproxy \
    && /opt/warp/bin/wireproxy --version | head -1

# ── نسخ bgutil server المبني في المرحلة 1 ──────────────────────────────────
COPY --from=bgutil-builder /opt/bgutil /opt/bgutil

# ── دليل العمل ────────────────────────────────────────────────────────────
WORKDIR /app

# ── نسخ ملفات المشروع ─────────────────────────────────────────────────────
COPY package.json package-lock.json* ./
COPY config.js ./
COPY index.js ./
COPY shard.js ./

COPY commands/ ./commands/
COPY events/ ./events/
COPY src/ ./src/
COPY languages/ ./languages/
# database/ is intentionally NOT copied — it's created at build time below.
# This prevents "directory not found" errors when the build context lacks it.
COPY scripts/ ./scripts/

# ── Create database directory with default empty JSON files ──────────────
# (some deploys don't have database/ in build context due to git not tracking
#  empty directories — so we always create it here)
RUN mkdir -p /app/database \
    && echo '{}' > /app/database/languages.json \
    && echo '{}' > /app/database/playerState.json

# ── تثبيت dependencies ──────────────────────────────────────────────────────
RUN npm install --no-audit --no-fund --omit=dev --loglevel=error \
    && npm cache clean --force

# ── yt_cookies.py + سكريبتات التشغيل ────────────────────────────────────────
COPY yt_cookies.py /opt/scripts/yt_cookies.py
COPY entrypoint.sh /opt/scripts/entrypoint.sh
COPY warp-setup.sh /opt/scripts/warp-setup.sh
RUN chmod +x /opt/scripts/entrypoint.sh /opt/scripts/warp-setup.sh /opt/scripts/yt_cookies.py

# ── Python yt-dlp wrapper (لتحميل bgutil PO Token plugin) ─────────────────
RUN printf '#!/bin/bash\nexec /usr/bin/python3 -m yt_dlp "$@"\n' > /usr/local/bin/yt-dlp-py \
    && chmod +x /usr/local/bin/yt-dlp-py \
    && yt-dlp-py --version

# ── supervisord config ─────────────────────────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ── إنشاء مجلدات ──────────────────────────────────────────────────────────
RUN mkdir -p /app/cookies /app/audio_cache /app/data /var/log/supervisor

# ── متغيرات البيئة الافتراضية ──────────────────────────────────────────────
# ملاحظة: DISCORD_TOKEN و CLIENT_ID و GENIUS_CLIENT_SECRET تُحقن من Railway وقت التشغيل
# لا نضعها هنا كـ ENV لتفادي تحذيرات Docker linter (SecretsUsedInArgOrEnv)
ENV \
    # ── Genius (اختياري — لكلمات الأغاني، يُحقن من Railway) ──
    GENIUS_CLIENT_ID="" \
    # ── إعدادات البوت ──
    EMBED_COLOR="#FF6B6B" \
    STATUS="Dev : ELMINYAWE" \
    DEFAULT_VOLUME="100" \
    MAX_QUEUE_SIZE="100" \
    MAX_PLAYLIST_SIZE="50" \
    # ── الأوامر الهجينة ──
    PREFIX="!" \
    ENABLE_PREFIX="true" \
    ENABLE_SLASH="true" \
    PREFIX_ADMIN_ONLY="false" \
    # ── Sharding ──
    TOTAL_SHARDS="auto" \
    SHARD_MODE="process" \
    SHARD_RESPAWN="true" \
    # ── Resilience (نظام التوقعات) ──
    EMPTY_VOICE_TIMEOUT_MS="300000" \
    RECONNECT_TIMEOUT_MS="10000" \
    MAX_RECONNECT_ATTEMPTS="3" \
    CLEANUP_DELAY_MS="2000" \
    AUTO_RESUME="true" \
    PERSIST_PLAYER_STATE="true" \
    STATE_PERSIST_DELAY_MS="3000" \
    # ── YouTube / yt-dlp ──
    YT_CONNECTION_MODE="auto" \
    YT_PLAYER_CLIENTS="android_music,web_safari,web,ios" \
    YT_JS_RUNTIMES="deno" \
    YT_AUTO_COOKIES_FILE="/app/cookies/cookies.txt" \
    YT_PROXY="socks5://127.0.0.1:1080" \
    YT_COOKIES_INTERVAL_SEC="21600" \
    # ── youtube-dl-exec: استخدم Python yt-dlp wrapper ──
    YOUTUBE_DL_DIR="/usr/local/bin" \
    YOUTUBE_DL_FILENAME="yt-dlp-py" \
    # ── elminyawe ──
    ELMINYAWE_ENABLED="true" \
    BGUTIL_PORT="4416" \
    WARP_SOCKS_PORT="1080"

# ── Railway: PORT variable (إذا أراد Railway تخصيص منفذ) ───────────────────
# ملاحظة: Railway لا يدعم VOLUME في Dockerfile — إنشاء Volume من Railway Dashboard
# وربطه بمسار مثل /app/data عند الحاجة لاستمرارية البيانات
EXPOSE 4416

# ── Health check ──────────────────────────────────────────────────────────
HEALTHCHECK --interval=60s --timeout=15s --start-period=120s --retries=3 \
    CMD curl -sf http://127.0.0.1:4416/ping > /dev/null || exit 1

# ── EntryPoint ────────────────────────────────────────────────────────────
ENTRYPOINT ["/opt/scripts/entrypoint.sh"]
CMD ["supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
