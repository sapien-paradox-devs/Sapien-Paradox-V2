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
  account: {
    logout: "Log out",
    loggingOut: "Signing out…",
  },
  home: {
    greeting: "Your library",
    empty: "Nothing has arrived yet. The first chapter is on its way.",
    error: "We could not reach your library.",
    retry: "Try again",
    chapter: "Chapter",
    read: "Read",
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
