# -*- coding: utf-8 -*-
# ═══════════════════════════════════════════════════════════════════════════
#  yt_cookies.py — نظام الكوكيز الذكي (elminyawe)
#  ─────────────────────────────────────────────────────────────────────────
#  بعد تسجيل الدخول إلى يوتيوب عبر رمز OAuth الثابت، يقوم النظام بنفسه بجلب
#  الكوكيز (Set-Cookie) من يوتيوب ويكتبها في cookies.txt بصيغة Netscape،
#  ثم يجدّدها دورياً — بلا أي تدخل يدوي من المستخدم إطلاقاً.
#  الملف الناتج يستخدمه yt-dlp (محرك الإصلاح والاحتياط) تلقائياً.
# ═══════════════════════════════════════════════════════════════════════════

import json
import os
import time
import urllib.parse
import urllib.request

CLIENT_ID = "861556708454-d6dlm3lh05idd8npek18k6be8ba3oc68.apps.googleusercontent.com"
CLIENT_SECRET = "SboVhoG9s0rNafixCSGGKXAT"
TOKEN_URL = "https://www.youtube.com/o/oauth2/token"

DEFAULT_REFRESH_TOKEN = (
    "1//0eVooXRETOIiuCgYIARAAGA4SNwF-L9Irvn8-fFnEvPQl33FHJroxf7YbO4WmJ2Go52l3IrBkRh7BIPIiuX0FyGmgo7lAeC9krzw"
)
REFRESH_TOKEN = os.getenv("YT_REFRESH_TOKEN", DEFAULT_REFRESH_TOKEN).strip()
COOKIES_PATH = os.getenv("YT_AUTO_COOKIES_FILE", "/opt/bot/cookies.txt").strip()
INTERVAL = int(os.getenv("YT_COOKIES_INTERVAL_SEC", "21600"))  # افتراضياً كل 6 ساعات
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
HARVEST_URLS = [
    "https://www.youtube.com/",
    "https://music.youtube.com/",
    "https://www.youtube.com/feed/library",
]


def log(msg):
    print(f"[yt_cookies] {time.strftime('%Y-%m-%d %H:%M:%S')} {msg}", flush=True)


def refresh_access_token(refresh_token: str) -> str:
    """تسجيل الدخول: رمز التحديث ← رمز وصول جديد."""
    data = urllib.parse.urlencode({
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode())
    return payload["access_token"]


def harvest(access_token: str) -> dict:
    """جلب الكوكيز من يوتيوب مع تمرير رمز الدخول (Authorization: Bearer)."""
    cookies = {}
    for url in HARVEST_URLS:
        try:
            req = urllib.request.Request(url)
            req.add_header("User-Agent", UA)
            req.add_header("Authorization", f"Bearer {access_token}")
            req.add_header("X-Origin", "https://www.youtube.com")
            req.add_header("Accept-Language", "en-US,en;q=0.9,ar;q=0.8")
            with urllib.request.urlopen(req, timeout=30) as resp:
                for sc in resp.headers.get_all("Set-Cookie") or []:
                    name, _, rest = sc.partition("=")
                    value = rest.split(";", 1)[0].strip()
                    name = name.strip()
                    if name and value:
                        cookies[name] = value
        except Exception as exc:
            log(f"تعذّر الحصاد من {url}: {exc!r}")
    return cookies


def write_netscape(cookies: dict) -> int:
    """كتابة الكوكيز بصيغة Netscape — كتابة ذرّية عبر tmp + rename."""
    expiry = int(time.time()) + 31536000  # صلاحية سنة كاملة
    lines = [
        "# Netscape HTTP Cookie File",
        "# Auto-harvested by elminyawe after YouTube OAuth login",
        f"# updated: {time.strftime('%Y-%m-%d %H:%M:%S')}",
    ]
    for name, value in sorted(cookies.items()):
        for domain in (".youtube.com", ".music.youtube.com"):
            lines.append(f"{domain}\tTRUE\t/\tTRUE\t{expiry}\t{name}\t{value}")
    tmp = COOKIES_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    os.chmod(tmp, 0o600)
    os.replace(tmp, COOKIES_PATH)
    return len(cookies)


def harvest_once() -> bool:
    token = refresh_access_token(REFRESH_TOKEN)
    log(f"تم تجديد access token ({len(token)} حرفاً)")
    cookies = harvest(token)
    if not cookies:
        log("لم تُلتقط أي كوكيز — ستُعاد المحاولة في الدورة القادمة")
        return False
    n = write_netscape(cookies)
    log(f"🍪 كُتب {n} نوع كوكيز إلى {COOKIES_PATH}")
    return True


def main():
    import sys
    # ── وضع --once: يشغّل دورة واحدة فقط ثم يخرج (يستخدم في entrypoint.sh) ──
    if "--once" in sys.argv:
        log("وضع التشغيل الواحد (--once) — جلب الكوكيز مرة واحدة ثم الخروج")
        try:
            ok = harvest_once()
            sys.exit(0 if ok else 1)
        except Exception as exc:
            log(f"خطأ: {exc!r}")
            sys.exit(2)

    # ── الوضع الافتراضي: حلقة لا نهائية بفاصل INTERVAL ثواني ──
    log("نظام الكوكيز الذكي انطلق — تسجيل دخول OAuth ثم جلب الكوكيز تلقائياً")
    while True:
        try:
            harvest_once()
        except Exception as exc:
            log(f"خطأ في الدورة: {exc!r}")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
