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
    // The hero — the idea before the product (#149).
    eyebrow: "A slower way to read",
    headline: "Read a book one chapter at a time, and think between them.",
    subhead:
      "A chapter arrives on WhatsApp when it is time. You read it here, with nothing else on " +
      "the page, and talk it through with a companion that asks you questions. Then you wait " +
      "for the next one. The waiting is part of it.",
    begin: "Begin a book",
    howLink: "How it works",
    illustration: "An open book with a ribbon marking the page.",

    idea: {
      title: "The idea",
      items: [
        {
          title: "One chapter, then a pause",
          body:
            "Most books are read too fast to be remembered. Here each chapter arrives on its own, " +
            "and the days between are for thinking about it, not for catching up.",
        },
        {
          title: "It comes to you",
          body:
            "No app to install and no library to remember to open. When a chapter unlocks, a " +
            "link arrives on WhatsApp. Tap it and you are reading.",
        },
        {
          title: "A companion that asks",
          body:
            "Every chapter has a companion that has read the same pages. It does not summarise " +
            "or quiz you. It asks what you noticed, and follows where you go.",
        },
      ],
    },

    how: {
      title: "How it works",
      steps: [
        {
          title: "Choose a book and a pace",
          body: "One chapter a week, every three days, or every day.",
        },
        {
          title: "A chapter arrives",
          body: "On WhatsApp, as a link that opens straight into it. The link stays open for seven days.",
        },
        {
          title: "Read it here",
          body: "A quiet page and nothing else. A thin line shows how far you are.",
        },
        {
          title: "Talk it through",
          body: "Open the companion when you want to, never before. It begins with a question.",
        },
      ],
      stripTitle: "When your chapters would arrive",
      chapter: "Chapter",
      today: "Today",
    },

    sample: {
      title: "What a conversation feels like",
      lede: "An example, after a chapter about how clocks changed the way people felt time.",
      companion: "Companion",
      reader: "You",
      exchange: [
        {
          from: "companion",
          text:
            "The chapter argues that people did not feel slow before clocks, only after. Did " +
            "that match anything in your own week?",
        },
        { from: "reader", text: "Maybe. I only notice I am late when I look at my phone." },
        {
          from: "companion",
          text:
            "So the measuring comes first, and the feeling follows it. What would you have to " +
            "stop measuring to find out?",
        },
      ],
    },

    beginTitle: "Begin",
    beginLede: "Choose how quickly the chapters come. The first one is sent as soon as you have paid.",

    faq: {
      title: "Questions",
      items: [
        {
          q: "Do I need to install anything?",
          a: "No. Chapters arrive as WhatsApp links and open in your browser, on any phone or computer.",
        },
        {
          q: "What if I open a link late?",
          a: "Links stay open for seven days. After that the page offers to send you a fresh one, in one tap.",
        },
        {
          q: "Can I read faster?",
          a: "Choose \u201cquickly\u201d for a chapter a day. The pace is the point, so there is no way to unlock the whole book at once.",
        },
        {
          q: "Can I go back to a chapter?",
          a: "Yes. Sign in and every chapter you have received is in your library.",
        },
        {
          q: "How do I pay?",
          a: "Once, for the whole book, through Razorpay. We never see your card.",
        },
      ],
    },

    // The form (unchanged from before #149).
    chapters: "chapters",
    name: "Your name",
    email: "Email",
    phone: "WhatsApp number",
    phoneHint: "Chapters are delivered here, so it must be the number you use.",
    pace: "How quickly",
    buy: "Begin reading \u2014",
    sending: "Opening checkout\u2026",
    refused: "That did not go through. Nothing was charged \u2014 try again.",
    fineprint: "You will be taken to Razorpay to pay. We never see your card.",
    loading: "Opening\u2026",
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
  /** The pace names alone, for the landing page's pace switch. */
  paceShort: {
    slow: "Slowly",
    medium: "Steadily",
    fast: "Quickly",
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
