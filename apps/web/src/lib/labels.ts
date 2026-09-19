/**
 * Every string the reader sees. Mandate 1 — zero hardcoded strings in components.
 *
 * Nested by surface, read through `locale.ts` dot-notation. Copy is edited here by
 * someone who is not a developer, so keep it prose and keep the shape flat enough to scan.
 */

export const labels = {
  app: {
    name: "Sapien Paradox",
  },
  health: {
    booting: "Opening the room…",
  },
  landing: {
    headline: "A book, one chapter at a time.",
    subhead:
      "Chapters arrive on WhatsApp as they unlock. You read them here, and talk them " +
      "through with a companion that has read the same pages.",
    how: [
      "Choose a book and how quickly you want it.",
      "Each chapter arrives on WhatsApp when it unlocks.",
      "Tap the link and read — no app, no password.",
    ],
    chapters: "chapters",
    name: "Your name",
    email: "Email",
    phone: "WhatsApp number",
    phoneHint: "Chapters are delivered here, so it must be the number you use.",
    pace: "How quickly",
    buy: "Begin reading —",
    sending: "Opening checkout…",
    refused: "That did not go through. Nothing was charged — try again.",
    fineprint: "You will be taken to Razorpay to pay. We never see your card.",
    loading: "Opening…",
    error: "We could not load what is available.",
    retry: "Try again",
    nothingForSale: "Nothing is on sale just yet.",
    haveAccount: "Already reading with us?",
    signIn: "Sign in",
  },
  welcome: {
    headline: "Thank you.",
    body: "Your first chapter is on its way to your WhatsApp.",
    password: "It arrives with a link to set your password, so you can come back here any time.",
    login: "Go to sign in",
  },
  pace: {
    slow: "Slowly — a chapter a week",
    medium: "Steadily — every three days",
    fast: "Quickly — one a day",
  },
  home: {
    greeting: "Your library",
    empty: "Nothing has arrived yet. The first chapter is on its way.",
    error: "We could not reach your library.",
    retry: "Try again",
    chapter: "Chapter",
    read: "Read",
    logout: "Sign out",
    send: "Send to WhatsApp",
    sending: "Sending…",
    sent: "Sent — check WhatsApp.",
    limited: "Already sent — check WhatsApp.",
    sendFailed: "That did not send. Try again.",
    dismiss: "Dismiss",
  },
  opening: {
    working: "Finding your place…",
    denied: "This book is not on your shelf.",
    error: "We could not open that chapter.",
    retry: "Try again",
  },
  reader: {
    loading: "Opening the chapter…",
    finish: "Finish chapter",
    finished: "That is the end of this chapter.",
    denied: "This chapter is not on your shelf.",
    error: "We could not open this chapter.",
    retry: "Try again",
  },
  sanctuary: {
    title: "This link has rested",
    body: "Links stay open for seven days. We can send you a fresh one.",
    reissue: "Send me a new link",
    sending: "Sending…",
    sent: "On its way — check WhatsApp.",
    limited: "Already sent — check WhatsApp.",
    failed: "That did not send. Try again.",
  },
  pdf: {
    loading: "Loading the pages…",
    error: "The pages did not load. Your link is fine.",
    retry: "Try again",
  },
  companion: {
    open: "Ask about this chapter",
    close: "Close",
    placeholder: "What would you like to ask?",
    send: "Ask",
    thinking: "Thinking…",
    capped: "That is all the conversation this chapter holds.",
    error: "That question did not go through.",
    retry: "Try again",
  },
  reset: {
    title: "Set your password",
    lead: "Choose a password and your library is yours whenever you want it.",
    password: "New password",
    confirm: "Confirm password",
    submit: "Set password",
    submitting: "Setting\u2026",
    hint: "At least 8 characters.",
    tooShort: "Use at least 8 characters.",
    mismatch: "Those two do not match.",
    expired: "This link has already been used, or it has rested. Ask for a fresh one and it will arrive on WhatsApp.",
    errorGeneric: "We could not reach the library. Try again in a moment.",
    doneTitle: "You're all set.",
    doneBody: "Your password is saved. Sign in and your chapters are waiting.",
    toLogin: "Go to sign in",
  },
  login: {
    title: "Welcome back",
    email: "Email",
    password: "Password",
    submit: "Enter",
    submitting: "Opening…",
    errorInvalid: "That email and password do not match. Try again.",
    errorGeneric: "We could not reach the library. Try again in a moment.",
  },
} as const;

export type Labels = typeof labels;
