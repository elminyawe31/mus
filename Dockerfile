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
    YT_CONNECTION_MODE="warp" \
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


# Render ttyd: public HTTP endpoint, password below is a requested insecure default.
# Override TTYD_PASSWORD in Render Environment for safety.
ENV TTYD_USER="root" TTYD_PASSWORD="ELMINYAWE"

RUN arch="$(dpkg --print-architecture)" && \
    case "$arch" in amd64) t=x86_64;; arm64) t=aarch64;; *) exit 1;; esac && \
    curl -fsSL "https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.${t}" \
      -o /usr/local/bin/ttyd && chmod 755 /usr/local/bin/ttyd

# Apply the WARP and automatic direct-connection fixes to the repo files.
RUN python3 <<'PY'
from pathlib import Path
import os
root = Path(os.environ.get('MUS_ROOT', '/'))

def update(path, transforms):
    p = root / path.lstrip('/')
    s = p.read_text()
    for old, new in transforms:
        if old not in s:
            raise RuntimeError(f'Expected text not found in {path}: {old[:80]}')
        s = s.replace(old, new, 1)
    p.write_text(s)

p = root / 'opt/scripts/warp-setup.sh'
s = p.read_text()
old = "cut -d'=' -f2 | xargs"
if s.count(old) != 6:
    raise RuntimeError('Unexpected warp-setup.sh version')
s = s.replace(old, "cut -d'=' -f2- | xargs")
s = s.replace('log "❌ فشل التسجيل في WARP — سأحاول بدون WARP"\n        exit 0', 'log "❌ فشل التسجيل في WARP — سأحاول بدون WARP"\n        exit 1')
a = s.index('if /opt/warp/bin/wireproxy -n -c')
s = s[:a] + '''if /opt/warp/bin/wireproxy -n -c "${WIREPROXY_CONF}" >/dev/null 2>&1; then
    log "✅ إعداد WARP صالح (الاتصال الفعلي غير مضمون)"
else
    log "❌ إعداد WARP غير صالح؛ سيتم الاتصال مباشرة"
    exit 1
fi
exit 0
'''
p.write_text(s)

p = root / 'opt/scripts/entrypoint.sh'
s = p.read_text()
old = "sed -i 's/^autostart=false \\(# wireproxy\\)/autostart=true # wireproxy/'"
new = "sed -i '/^\\[program:wireproxy\\]/,/^\\[program:/ s/^autostart=false$/autostart=true/'"
if old not in s: raise RuntimeError('Unexpected entrypoint.sh version (enable)')
s = s.replace(old, new)
old = "sed -i 's/^autostart=true \\(# wireproxy\\)/autostart=false # wireproxy/'"
new = "sed -i '/^\\[program:wireproxy\\]/,/^\\[program:/ s/^autostart=true$/autostart=false/'"
if old not in s: raise RuntimeError('Unexpected entrypoint.sh version (disable)')
s = s.replace(old, new)
s = s.replace('log "✅ WARP جاهز"', 'log "✅ إعداد WARP صالح؛ لم يتم تأكيد الاتصال بعد"')
s = s.replace('log "⚠️ فشل WARP — البوت سيعمل بدون proxy"', 'log "⚠️ فشل إعداد WARP — اتصال مباشر"\n        NEED_WARP="false"\n        CONNECTION_MODE="direct"')
s = s.replace('log "   ├─ Discord: ✅"', 'log "   ├─ Discord: جارٍ بدء البوت"')
s = s.replace('WARP: ${NEED_WARP}', 'WARP مطلوب: ${NEED_WARP}، الاتصال غير مؤكد')
# dotenv does not override existing env vars: export the actual selected mode.
s = s.replace('log "📝 توليد /app/.env..."', 'export YT_CONNECTION_MODE="${CONNECTION_MODE}"\nlog "📝 توليد /app/.env..."', 1)
p.write_text(s)

update('/app/config.js', [
    ("if (mode === 'ipv6') return null;", "if (mode === 'direct') return null;\n    if (mode === 'ipv6') return null;"),
])
# The same fallback applies to search, info and audio yt-dlp calls. Do not alter
# the working third-party provider chain. Never log proxy credentials.
update('/app/src/YouTube.js', [
    ("const youtubedl = require('youtube-dl-exec');", '''const youtubedlRaw = require('youtube-dl-exec');
const youtubedl = async (url, options = {}) => {
    try {
        return await youtubedlRaw(url, options);
    } catch (error) {
        if (!options.proxy) throw error;
        console.warn('[YouTube] Proxy request failed; retrying direct.');
        const direct = { ...options };
        delete direct.proxy;
        delete direct.forceIpv6;
        return await youtubedlRaw(url, direct);
    }
};'''),
])
PY

RUN <<'SH'
cat > /opt/scripts/start-ttyd.sh <<'EOF'
#!/bin/sh
set -eu
PORT="${PORT:-10000}"
: "${TTYD_USER:?missing TTYD_USER}"
: "${TTYD_PASSWORD:?missing TTYD_PASSWORD}"
# Do not pass the bot's environment into a web shell or log the credential.
exec env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/root USER=root LOGNAME=root TERM=xterm-256color \
    /usr/local/bin/ttyd --debug 3 --port "$PORT" \
    --credential "$TTYD_USER:$TTYD_PASSWORD" --writable --check-origin \
    --max-clients 2 --cwd /app /bin/bash -l
EOF
chmod 755 /opt/scripts/start-ttyd.sh
cat >> /etc/supervisor/conf.d/supervisord.conf <<'EOF'

[program:ttyd]
command=/opt/scripts/start-ttyd.sh
directory=/app
priority=5
autostart=true
autorestart=true
startsecs=2
startretries=5
stopwaitsecs=5
killasgroup=true
stopasgroup=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF
SH

# Validate syntax at image build time.
RUN bash -n /opt/scripts/entrypoint.sh && bash -n /opt/scripts/warp-setup.sh && \
    sh -n /opt/scripts/start-ttyd.sh && \
    node --check /app/src/YouTube.js && node --check /app/config.js

# ── Railway: PORT variable (إذا أراد Railway تخصيص منفذ) ───────────────────
# ملاحظة: Railway لا يدعم VOLUME في Dockerfile — إنشاء Volume من Railway Dashboard
# وربطه بمسار مثل /app/data عند الحاجة لاستمرارية البيانات
EXPOSE 10000 4416

# ── Health check ──────────────────────────────────────────────────────────
HEALTHCHECK --interval=60s --timeout=15s --start-period=120s --retries=3 \
    CMD curl -sf http://127.0.0.1:4416/ping > /dev/null || exit 1

# ── EntryPoint ────────────────────────────────────────────────────────────
ENTRYPOINT ["/opt/scripts/entrypoint.sh"]
CMD ["supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
