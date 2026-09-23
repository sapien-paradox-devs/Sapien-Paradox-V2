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
  nav: {
    label: "Site",
    library: "Your library",
    signIn: "Sign in",
    signOut: "Sign out",
  },
  theme: {
    system: "Theme: follows your device. Tap for light.",
    light: "Theme: light. Tap for dark.",
    dark: "Theme: dark. Tap to follow your device.",
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
    /*
     * One state per outcome. The old copy asserted "your chapter is on its way"
     * before anything had been created — which is what a reader saw while a
     * rejected webhook meant nothing had been, or ever would be.
     */
    confirming: "Confirming your payment\u2026",

    headline: "Thank you.",
    body: "Your first chapter is on its way to your WhatsApp.",
    password: "It arrives with a link to set your password, so you can come back here any time.",

    sentButUndelivered: "Paid \u2014 but WhatsApp could not reach your number yet.",
    sandboxNote:
      "That is a messaging restriction, not a problem with your purchase. Your chapter is waiting, and it will arrive as soon as the channel opens.",

    pendingTitle: "Payment received.",
    pendingBody:
      "We are still confirming it with the payment provider. Your chapter will arrive on WhatsApp shortly \u2014 you do not need to pay again.",

    refusedTitle: "Something needs a look.",
    refusedBody:
      "Your payment went through, but we could not set up your reading. Please contact us and quote this page \u2014 nothing further is needed from you.",
    ownedTitle: "You already have this one.",
    alreadyOwned:
      "This book is already on your account, so nothing was charged twice. Send the links again below, or sign in \u2014 it is waiting in your library.",

    failedTitle: "We could not confirm that just now.",
    failedBody:
      "Your payment is safe. If your chapter does not arrive on WhatsApp shortly, contact us.",

    resend: "Send it again",
    resending: "Sending\u2026",
    resentBoth: "Sent. Your chapter and your set-a-password link are on their way.",
    resentChapter: "Sent. Your chapter is on its way.",
    resentThrottled: "Already sent a moment ago \u2014 check WhatsApp before trying again.",
    resentFailed: "That still could not be delivered. Your purchase is safe; contact us and we will sort it out.",

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
    completed: "Completed",
    // Follows a number: "42% read" (D70).
    percentRead: "% read",
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
    // The chamber's bar and drawer (#150, D70–D71).
    sections: "Sections",
    sectionsTitle: "In this chapter",
    page: "Page",
    close: "Close",
    progress: "How far through the chapter you are",
    noPrint: "Chapters can\u2019t be printed. They are here to read whenever you like.",
    // The end of the chapter.
    completeHint: "When you are done, mark it complete. You can always come back to it.",
    complete: "Mark chapter complete",
    completing: "Saving\u2026",
    completeFailed: "That did not save. Try again \u2014 your place is kept.",
    threshold: {
      chapter: "Chapter",
      begin: "Tap anywhere to begin",
      skip: "Open the chapter",
    },
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
    noPassword: "Never set a password?",
    sendLink: "Send me a sign-in link",
    linkTitle: "Send a sign-in link",
    linkLead:
      "Enter the WhatsApp number you signed up with and we will send a link to set your password.",
    linkPhone: "WhatsApp number",
    linkSubmit: "Send the link",
    linkSending: "Sending\u2026",
    linkDone:
      "If that number is on an account, a link is on its way to it on WhatsApp. It works once, and only for an hour.",
    linkBack: "Back to sign in",
    linkErrorGeneric: "We could not send that. Try again in a moment.",
  },
} as const;

export type Labels = typeof labels;
