# Surface — how it looks and moves

D54

Plan and order: `docs/PLAN.md` §2.9. Implementation: `apps/web/src/lib/motion.ts` and the motion
tokens in `apps/web/src/styles/global.css`.

---

## D54 — Motion is native-first; no animation library, no WebGL

**Locked** 2026-09-23 · #115

### The decision

Motion comes from the browser, in this order of preference:

1. **CSS** transitions and keyframes, on shared tokens: `--dur-*` durations and the existing
   `--ease-settle` curve (mandate 5).
2. **The View Transitions API** for anything that swaps one screen for another: page navigation
   and theme changes. Started from `lib/motion.ts` alone, where React is flushed inside the
   transition.
3. **Scroll-driven CSS animations** (`animation-timeline`) for reveal-on-scroll, as progressive
   enhancement.

**A JavaScript animation library (`motion`, formerly Framer Motion) is added only when a spring or
a drag genuinely needs physics** — the companion panel is the likely first case. Adding it needs a
line here saying which interaction required it.

**Rules every animation follows:**

- **Animate only `transform` and `opacity`**, so it holds 60 fps on a mid-range Android phone,
  which is where every WhatsApp link opens.
- **Nothing moves while the reader is reading.** The chamber animates in and out, never during.
- **Show dates, never countdowns** (D11).
- **A sequence of steps is states in a machine**, not a chain of timers (mandate 2).
- **Reduced motion keeps fades and drops movement.** Distance tokens go to zero and durations
  shorten. It does not switch everything off, because a crossfade helps people who ask for less
  motion, and a sudden cut is a motion of its own.

### Rejected

- **three.js / WebGL** (page curls, a 3D book, particle backgrounds). Heavy on the phones that
  matter most, battery-hungry, and against the house rule "nothing glows". A reader spends an
  hour here, and the product sells depth, not spectacle.
- **GSAP.** Capable and now free, but it duplicates what CSS and View Transitions already do
  here, and it would be a second animation model beside CSS.
- **Adopting `motion` up front.** `apps/web/CLAUDE.md` listed Framer Motion in the stack, but it
  was never installed. Taking it on for fades that CSS already does costs about 30 KB, and
  it adds a second place where motion lives.
- **Animating Fraunces' variable axes** (SOFT/WONK "settling" on a heading). Beautiful, but it
  re-lays out text on every frame, which breaks the first rule above. The axes are loaded and
  set statically instead.

> **Amended by D74** (2026-09-24): Fraunces is retired for Newsreader; the rule stands: variable
> axes are set statically, never animated.

### Inherited from V1

**V1:** Framer Motion was named in the stack and used ad hoc per component; the reading room's
"threshold" was a `setTimeout` chain.
**V2:** browser-native first, one module that starts transitions, and sequences as machine states.
**Why:** V1's motion had no shared tokens and no single entry point, so every screen moved
differently.
**Revisit if:** an interaction needs spring physics or gestures that CSS cannot express.
**Still following V1?** No.
