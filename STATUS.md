# Status

> Four blocks, nothing else (D49). The plan itself is the
> [GitHub milestones](https://github.com/sapien-paradox-devs/Sapien-Paradox-V2/milestones);
> this file mirrors it. A plan change edits this file in the same PR.
>
> **Last updated:** 2026-09-22

## Deployed

| | Where | State |
|---|---|---|
| API | Render free tier · `sapien-api.onrender.com` | live · sleeps after 15 min (D35, until ~2026-10-17) |
| SPA | Vercel · `sapien-paradox-v2.vercel.app` | live |
| WhatsApp | Twilio **sandbox**, not a WABA | first real send 2026-09-21; 24-hour window only |
| Payments | Razorpay **test mode**, Payment Links | signup → pay → fulfil on redirect proven end to end |
| Storage | Cloudflare R2, private | live |

Built: login, home, read, `/r/:token` chamber + sanctuary + reissue, WhatsApp delivery, password
reset, public signup + checkout + resend, companion. **Not built:** cadence (`unlock_at` is always
null — every chapter unlocks at once), reminders, refunds, sign-out, any visual polish.

## Current milestone

**None locked yet.** The next grilling session picks it. Candidates, in the order recommended:
safe for a real reader → cadence → the site looks like a product.

Two issues stay open outside any milestone: #1 (the PRD) and #3 (external accounts — domain,
Twilio WABA, template review, Razorpay KYC). #3 is calendar time and should start now.

## Temporary hacks — revert before a real reader

| Hack | Where | Revert to |
|---|---|---|
| `CHAPTER_SEND_COOLDOWN_MINUTES=0`, `RESET_REQUEST_COOLDOWN_MINUTES=0` | Render env | 60 and 15 |
| `ONBOARDING_ALLOW_PHONE_REUSE=1` | Render env + `_resolve_identity` branch | unset, delete the branch (D26) |
| `RAZORPAY_WEBHOOK_SECRET` unset — fulfilment relies on the redirect only (D48) | Render env + Razorpay dashboard | set it, register the webhook |
| `recently_sent` counts console-backend rows as sends | `services/whatsapp.py` | exclude `provider_message_id == "console"` |
| One duplicate purchase to refund: `plink_TelJefBJhzI5sY` | Razorpay dashboard | refund |

## Next obvious issue

Lock the first milestone. Then, whichever it is, the first issue inside it is almost certainly
**revert the hacks above and set the webhook secret** — it is a prerequisite of every candidate.
