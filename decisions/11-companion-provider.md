# Companion provider

D46

---

## D46 — Gemini for testing, behind the existing seam

**Locked** 2026-09-09 · **scoped to the testing phase** · amends the model choice in D24, not its architecture

The companion runs against **Google Gemini** while the feature is being built and tuned. Anthropic
remains the intended production provider (D24).

### Why this is cheap to do

D24 anticipated exactly this. Its four vendor-neutrality rules mean a provider swap is one function
body, not a migration:

1. no vendor types cross the `services/companion.py` boundary
2. provider and model come from env, never hardcoded
3. the prompt lives in its own file
4. `ChatUsage` stores plain token counts, so cost comparison survives the swap

D24 rejected a generic provider interface on the grounds that there is one call site and an
abstraction over one call site is a plugin architecture for a single plugin. That still holds: this
adds a second implementation of one function selected by env, not an interface hierarchy.

### What this does NOT prove, and must be re-checked before production

- **Caching.** D24's central cost claim — that prompt caching is a bigger lever than dropping two
  model tiers, taking a 20-message conversation from roughly $0.69 to $0.19 — rests on Anthropic's
  explicit `cache_control` breakpoints and the 1-hour retention. Gemini's context caching is a
  separate API with its own minimum sizes and semantics. **Numbers measured here do not transfer.**
- **The prompt.** D24 already records that the real lock-in is the prompt, not the SDK. A Socratic
  prompt tuned against Gemini will need re-tuning against Claude; the SDK swap is an afternoon and
  the companion feeling right again is a week.
- **Behaviour under the D13 boundary.** "Exploratory, not evaluative" is a property of the model
  plus the prompt. Whether it holds is a per-model finding.

### Accepted trade

**Free-tier terms.** Free tiers generally reserve the right to train on submitted data. D18 refuses
to store companion conversations at all, on the grounds that a product selling quiet, unmonitored
reading should not retain them — and routing those same conversations through a free tier weakens
that from a different direction.

**Accepted deliberately and only for the testing phase**, on the basis that the conversations during
it are the owner's own, about a public textbook. **This becomes a real problem the moment a reader
who is not the owner uses the companion**, which is the same trigger D16 and D22 already use for
revisiting error tracking and logging. Add it to that list.

### Pricing correction to D24

D24 says to budget against $3/$15 per million tokens for Sonnet 5 because the intro rate ended
2026-08-31. **Verified 2026-09-09: Sonnet 5 is $2/$10.** The lower rate is the standing rate. Haiku
4.5 is $1/$5 and Opus 5 is $5/$25. D24's cost table is therefore pessimistic by about a third — the
cached 20-message conversation is nearer $0.13 than $0.19.

That makes the case for Anthropic in production slightly stronger than D24 argued, and the case for
a free tier in testing correspondingly weaker. Recorded because the decision was taken with the
older number in view.

---

## The provider config file

**Which vendor is live is a config-file setting, not a code change and not primarily an env var.**

This amends D24's rule 2 — "provider and model come from env, never hardcoded". Env was the right
instinct (never hardcoded) but the wrong home: a provider choice is *configuration a person edits
deliberately*, like the message templates and the companion prompt. It belongs beside them.

```
core/content/providers.py     ← the config file. One line selects the vendor.
core/content/templates.py     ← WhatsApp copy (D12)
core/content/companion_prompt.md ← the system prompt (D14)
```

`content/` is already defined as "editable copy, no logic". A provider table fits that exactly: it
is a set of values a person changes on purpose, reviewed in a diff, with the reasoning in version
control.

### Shape

```python
ACTIVE = "gemini"          # ← the only line you change to swap vendors

PROVIDERS = {
    "anthropic": Provider(
        model                 = "claude-sonnet-5",
        api_key_env           = "ANTHROPIC_API_KEY",
        caching               = "explicit_breakpoints",
        cache_ttl             = "1h",      # NOT the 5-minute default (D24)
        min_cacheable_tokens  = 1024,
    ),
    "gemini": Provider(
        model                 = "<set at build time; verify against current docs>",
        api_key_env           = "GEMINI_API_KEY",
        caching               = "separate_context_api",
        cache_ttl             = None,
        min_cacheable_tokens  = None,      # verify — Gemini's floor differs
    ),
}
```

### Three rules that keep this from becoming an abstraction layer

D24 rejected a generic provider interface because there is **one call site**, and an abstraction
over one call site is a plugin architecture for a single plugin. That objection still stands, and
this design does not violate it:

1. **The config file holds values, never behaviour.** No conditionals, no classes with methods, no
   strategy objects. A dict of settings and a name.
2. **Each vendor is one function body** in `services/companion.py` — `_ask_anthropic(...)` and
   `_ask_gemini(...)` — selected by name. Not a base class, not a registry of plugins.
3. **The boundary type does not change.** `discuss(chapter_text, history, question) -> Answer`
   takes and returns our own types whichever provider is live. No vendor object crosses it.

If a third vendor ever needs a fourth concept the others do not have, that is the signal to
reconsider — not before.

### Precedence, and where the keys live

```
COMPANION_PROVIDER env var   →  wins if set
providers.ACTIVE             →  otherwise
```

The env override exists so a deployed environment can differ from the checked-in default without a
commit — production on Anthropic while the file says Gemini, for instance. **The file is the
default and the documented answer; env is the deployment escape hatch.**

**API keys never go in the config file.** It is version-controlled; keys are read from the
environment variable each provider entry *names*. The file says which env var to read, never what
is in it.

### What this buys

Swapping vendors is a one-line diff with a reviewer, a date, and a reason attached — rather than an
env var someone changed on a dashboard six weeks ago that nobody can now explain. Given that D46
already expects this to be swapped back before production, the swap itself should leave a trail.

---

### Revisit when

The companion's interaction design and prompt are settled (D14 defers both to their own session) and
it is time to tune quality rather than plumbing. At that point switch `COMPANION_PROVIDER` and
re-measure — the numbers, the prompt, and the boundary behaviour all need re-establishing.
