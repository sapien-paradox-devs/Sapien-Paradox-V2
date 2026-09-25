"""
Sapien Paradox V2 — Django settings.

One file, env-driven (D5). A fresh clone runs with zero credentials: every external system
falls back to a console/no-op backend, and the database falls back to SQLite. Nothing here
reaches the network at import time.
"""

import os
import sys
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent          # apps/api
REPO_ROOT = BASE_DIR.parent.parent                          # repo root

load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def env_list(name, default=None):
    raw = os.getenv(name)
    if not raw:
        return list(default or [])
    return [item.strip() for item in raw.split(",") if item.strip()]


# ─────────────────────────────────────────────────────────────────────────────
# Core
# ─────────────────────────────────────────────────────────────────────────────

DEBUG = env_bool("DJANGO_DEBUG", True)

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is off.")
    SECRET_KEY = "dev-only-insecure-key-do-not-use-in-production"

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1", "[::1]"])

# Render sets RENDER_EXTERNAL_HOSTNAME to the service's own <name>.onrender.com address, and
# health-check requests arrive with it as the Host header. Without this the very first deploy
# returns 400 (DisallowedHost) and stays red until someone types the hostname into the
# dashboard — a deploy failing on configuration nobody could know before the service existed.
# Appended rather than assigned, so an explicit DJANGO_ALLOWED_HOSTS naming api.<domain> keeps
# working alongside it.
_render_hostname = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
if _render_hostname and _render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_render_hostname)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

AUTH_USER_MODEL = "core.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─────────────────────────────────────────────────────────────────────────────
# Database — DATABASE_URL from the first commit (D5)
# ─────────────────────────────────────────────────────────────────────────────

# An *empty* DATABASE_URL is treated as absent. `.env` files habitually carry blank keys
# as placeholders, and dj_database_url parses "" into a config with no ENGINE rather than
# falling back — which fails at first query with a misleading error.
_database_url = os.getenv("DATABASE_URL", "").strip() or f"sqlite:///{BASE_DIR / 'db.sqlite3'}"

DATABASES = {
    "default": dj_database_url.parse(
        _database_url,
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=env_bool("DATABASE_SSL_REQUIRE", False),
    )
}

# ─────────────────────────────────────────────────────────────────────────────
# Storage — private bucket, proxied bytes only (D19, D23)
#
# DEPLOY CHECKLIST: the bucket must be PRIVATE. Nothing in this codebase generates a
# storage URL; PDFs are streamed through the API. A public bucket bypasses grant tokens,
# expiry, and the whole temporal-security design at the infrastructure layer while the
# application code still looks correct.
# ─────────────────────────────────────────────────────────────────────────────

AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "")

# Tests must never touch the network or the real bucket (mandate 3). Without this, a
# fixture that saves a FileField uploads to R2 — slow, and it litters production storage
# with test objects.
TESTING = "test" in sys.argv

if TESTING:
    _default_storage = {"BACKEND": "django.core.files.storage.InMemoryStorage"}
elif AWS_STORAGE_BUCKET_NAME:
    _default_storage = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": AWS_STORAGE_BUCKET_NAME,
            "access_key": os.getenv("AWS_ACCESS_KEY_ID", ""),
            "secret_key": os.getenv("AWS_SECRET_ACCESS_KEY", ""),
            "endpoint_url": os.getenv("AWS_S3_ENDPOINT_URL", ""),  # R2 endpoint
            "region_name": os.getenv("AWS_S3_REGION_NAME", "auto"),
            "default_acl": None,      # private
            "querystring_auth": True,
            "file_overwrite": False,
        },
    }
else:
    _default_storage = {"BACKEND": "django.core.files.storage.FileSystemStorage"}

STORAGES = {
    "default": _default_storage,
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media/"      # local dev only; never used to serve chapter PDFs

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ─────────────────────────────────────────────────────────────────────────────
# Cross-origin — SPA and API are sibling subdomains (D6)
#
# Locally the SPA is http://localhost:5173 and the API http://localhost:8000: same site,
# different port, so no cookie domain is needed. In production both sit under one parent
# domain and SESSION_COOKIE_DOMAIN=.<domain> makes the session cookie first-party.
# ─────────────────────────────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", ["http://localhost:5173"])
CORS_ALLOW_CREDENTIALS = True
# The CSRF token travels in this header too, because on the split origin the SPA
# cannot read the API's cookie (#176). Without exposing it, the browser hides it.
CORS_EXPOSE_HEADERS = ["X-CSRFToken"]

CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", ["http://localhost:5173"])

_cookie_domain = os.getenv("COOKIE_DOMAIN", "")     # e.g. ".sapienparadox.com"
SESSION_COOKIE_DOMAIN = _cookie_domain or None
CSRF_COOKIE_DOMAIN = _cookie_domain or None

# TEMPORARY (#92). "Lax" is correct once the SPA and API are siblings under one
# parent domain, which is D6's actual answer. Until then they are unrelated hosts
# -- vercel.app and onrender.com -- so the session cookie is third-party and the
# browser refuses to send it cross-site: login succeeds and every call after it
# is anonymous.
#
# "None" makes it cross-site-capable. It requires Secure, which is already on
# whenever DEBUG is off. The ambient-authority risk this widens is the one CSRF
# defends against, and CSRF stays enforced on every session endpoint (D30).
#
# **Set this back to Lax when the real domain is pointed** and COOKIE_DOMAIN is
# set -- at that point the cookie is first-party and None would be a needless
# relaxation.
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = os.getenv("CSRF_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False                        # the SPA reads it to send X-CSRFToken

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# Browsers silently REJECT a SameSite=None cookie that is not also Secure, so the
# combination below fails by doing nothing at all -- login appears to work and
# every later request is anonymous, which is the exact symptom #92 was opened for.
# Fail loudly at startup instead.
if SESSION_COOKIE_SAMESITE == "None" and not SESSION_COOKIE_SECURE:
    raise RuntimeError(
        "SESSION_COOKIE_SAMESITE=None requires SESSION_COOKIE_SECURE, which is off "
        "because DJANGO_DEBUG is on. Browsers drop the cookie without it."
    )

# Django checks the X-CSRFToken header against the `csrftoken` COOKIE. When the
# session cookie has to travel cross-site, so does this one, or every unsafe
# request fails CSRF while login appears to work (#176). Fail at startup instead.
if SESSION_COOKIE_SAMESITE == "None" and CSRF_COOKIE_SAMESITE != "None":
    raise RuntimeError(
        "SESSION_COOKIE_SAMESITE=None needs CSRF_COOKIE_SAMESITE=None as well: the "
        "CSRF cookie must reach the API from the app's site for the check to pass."
    )

if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# ─────────────────────────────────────────────────────────────────────────────
# Logging — structured JSON to stdout, no vendor (D22)
#
# HARD RULE: never log a grant token, a reset token, or a full /r/:token URL.
# Log the grant's id. Logs are less protected than the database.
# ─────────────────────────────────────────────────────────────────────────────

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "config.logging.JsonFormatter"},
        "plain": {"format": "{levelname} {name} {message}", "style": "{"},
    },
    "handlers": {
        "stdout": {
            "class": "logging.StreamHandler",
            "formatter": "plain" if DEBUG else "json",
        },
    },
    "root": {"handlers": ["stdout"], "level": os.getenv("LOG_LEVEL", "INFO")},
    "loggers": {
        "django.request": {"handlers": ["stdout"], "level": "WARNING", "propagate": False},
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# Application settings — the values the services read
# ─────────────────────────────────────────────────────────────────────────────

# Public URL of the SPA. Used to build the links that go into WhatsApp messages.
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5173").rstrip("/")

GRANT_TTL_DAYS = int(os.getenv("GRANT_TTL_DAYS", "7"))                  # D8
RESET_TOKEN_TTL_MINUTES = int(os.getenv("RESET_TOKEN_TTL_MINUTES", "60"))  # D21

# Video (D76, D77). A signed URL must outlive the whole video, because the player keeps
# making Range requests against it; two hours covers any chapter video.
VIDEO_URL_TTL_SECONDS = int(os.getenv("VIDEO_URL_TTL_SECONDS", "7200"))
VIDEO_MAX_MB = int(os.getenv("VIDEO_MAX_MB", "500"))
# Uploads from the in-app admin (D85). A signed upload URL lives this long; a
# large video on a slow connection needs the time. Files above the threshold go
# up in parts, so a dropped connection retries one part, not the whole file.
PDF_MAX_MB = int(os.getenv("PDF_MAX_MB", "100"))
COVER_MAX_MB = int(os.getenv("COVER_MAX_MB", "10"))
UPLOAD_URL_TTL_SECONDS = int(os.getenv("UPLOAD_URL_TTL_SECONDS", "21600"))
UPLOAD_MULTIPART_THRESHOLD_MB = int(os.getenv("UPLOAD_MULTIPART_THRESHOLD_MB", "50"))
UPLOAD_PART_MB = int(os.getenv("UPLOAD_PART_MB", "16"))  # R2's minimum is 5
# Where this API is reached from a browser. Only used when storage is local (no R2), to
# turn a `/media/...` path into a URL the SPA, on another origin, can play.
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")

# Rate limits, all derived from table rows — there is no Redis (D17).
REISSUE_COOLDOWN_MINUTES = int(os.getenv("REISSUE_COOLDOWN_MINUTES", "60"))     # D9
CHAPTER_SEND_COOLDOWN_MINUTES = int(os.getenv("CHAPTER_SEND_COOLDOWN_MINUTES", "60"))  # D11
RESET_REQUEST_COOLDOWN_MINUTES = int(os.getenv("RESET_REQUEST_COOLDOWN_MINUTES", "15"))  # D21

# Cadence delays in days, per pace key. Config, never a table (D19).
PACE_DELAY_DAYS = {
    "slow": int(os.getenv("PACE_DELAY_DAYS_SLOW", "7")),
    "medium": int(os.getenv("PACE_DELAY_DAYS_MEDIUM", "3")),
    "fast": int(os.getenv("PACE_DELAY_DAYS_FAST", "1")),
}

# WhatsApp (D12, D17). Without credentials the backend prints to console.
# Under test this is ALWAYS console, whatever the environment says. Without the guard,
# adding real credentials to a local .env silently turns the whole suite into a live
# sender — it attempts delivery to fixture phone numbers, spends quota, and passes,
# because the provider returns a queued id before the send actually fails. Mandate 3.
if TESTING:
    WHATSAPP_BACKEND = "console"
else:
    WHATSAPP_BACKEND = os.getenv("WHATSAPP_BACKEND", "") or (
        "twilio" if os.getenv("TWILIO_AUTH_TOKEN") else "console"
    )
# TEMPORARY, FOR TESTING ONLY — revert before real readers.
# D26 refuses a signup whose phone belongs to another account: a changed number
# and a typo'd number are identical to the code, and guessing wrong sends a
# stranger someone's chapters. That refusal makes the flow impossible to exercise
# with a single phone number, which is the situation during Phase 0 testing.
# When on, a known phone with an unknown email resolves to the EXISTING reader
# rather than refusing. It never creates a second account on one number —
# `User.phone` is unique (D19) and that is not relaxed here.
ONBOARDING_ALLOW_PHONE_REUSE = os.getenv("ONBOARDING_ALLOW_PHONE_REUSE", "").lower() in ("1", "true", "yes")

# Applied to a phone number typed without a country code. India-first (D28's
# Razorpay INR, D35's Singapore region); change it before selling elsewhere.
DEFAULT_COUNTRY_CODE = os.getenv("DEFAULT_COUNTRY_CODE", "+91")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "")
WHATSAPP_MAX_ATTEMPTS = int(os.getenv("WHATSAPP_MAX_ATTEMPTS", "3"))

# Payments -- Razorpay (D28, D47). Unset means checkout is closed and says so;
# there is deliberately no console fallback, because a silent fake payment would
# leave a reader believing they had bought something.
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

# The companion (D13, D24). Budget against $3/$15 — the intro rate ends 2026-08-31.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
# D46: Gemini during the testing phase, behind the same seam.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
COMPANION_MODEL = os.getenv("COMPANION_MODEL", "claude-sonnet-5")
COMPANION_CACHE_TTL = os.getenv("COMPANION_CACHE_TTL", "1h")   # not the 5m default — D24
COMPANION_MAX_INPUT_CHARS = int(os.getenv("COMPANION_MAX_INPUT_CHARS", "2000"))
COMPANION_DAILY_MESSAGES_PER_GRANT = int(os.getenv("COMPANION_DAILY_MESSAGES_PER_GRANT", "40"))
COMPANION_DAILY_MESSAGES_GLOBAL = int(os.getenv("COMPANION_DAILY_MESSAGES_GLOBAL", "500"))
