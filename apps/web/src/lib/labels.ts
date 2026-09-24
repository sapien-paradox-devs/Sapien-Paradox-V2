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

    beginTitle: "Ready to begin?",
    beginLede: "Choose a pace, and your first chapter arrives on WhatsApp as soon as you have paid.",

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

    // The strip's pace switch.
    pace: "How quickly",
  },
  // `/begin` — buying a book, on its own page (#160).
  begin: {
    title: "Begin a book",
    lede: "Choose how quickly the chapters come. The first one is sent as soon as you have paid.",
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
    // The chapter's companion video (D76).
    video: {
      watch: "Watch the video for this chapter",
      loading: "Opening the video…",
      close: "Close the video",
      error: "The video did not load. Your link is fine.",
      retry: "Try again",
    },
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
  // The in-app admin (D82).
  admin: {
    login: {
      title: "Admin sign in",
      lead: "For the people who run Sapien Paradox.",
      notStaff: "This account is not an admin. Readers sign in on the main sign-in page.",
      toReaderLogin: "Go to the reader sign-in",
    },
    nav: {
      label: "Admin",
      readers: "Readers",
      books: "Books",
      library: "Back to the library",
    },
    checking: "Checking your account\u2026",
    readers: {
      title: "Readers",
      add: "Add a reader",
      search: "Search by name, email or phone",
      status: { all: "Everyone", active: "Active", inactive: "Removed" },
      columns: { name: "Name", contact: "Contact", books: "Books", joined: "Joined" },
      empty: "No readers match that.",
      loadError: "We could not load the readers.",
      retry: "Try again",
      badge: { staff: "Admin", removed: "Removed", erased: "Erased" },
    },
    form: {
      newTitle: "Add a reader",
      newLead:
        "A reader always starts with a book. They get chapter 1 on WhatsApp, and a link to set their password.",
      fullName: "Full name",
      email: "Email",
      phone: "WhatsApp number",
      phoneHint: "With the country code, e.g. +91 98765 43210",
      book: "Book",
      bookLoading: "Loading books\u2026",
      pace: "Pace",
      submit: "Add reader",
      saving: "Adding\u2026",
      cancel: "Cancel",
      added: "Reader added.",
      notDelivered:
        "Reader added, but chapter 1 did not reach their WhatsApp. Check the number, then resend from their page.",
      error: "That did not save. Try again in a moment.",
    },
    reader: {
      back: "All readers",
      loadError: "We could not load this reader.",
      details: "Details",
      edit: "Edit",
      save: "Save changes",
      saving: "Saving\u2026",
      cancel: "Cancel",
      saved: "Saved.",
      books: "Books",
      noBooks: "No books yet.",
      since: "since",
      status: "Status",
      active: "Active: can sign in and read.",
      inactive: "Removed: cannot sign in, and their links do not open.",
      erased: "Personal data erased. Their orders are kept, anonymised.",
      deactivate: "Remove reader",
      deactivateConfirm:
        "Remove this reader? They will not be able to sign in, and their links stop working. You can restore them later.",
      reactivate: "Restore reader",
      erase: "Erase personal data",
      eraseConfirm:
        "Erase this reader\u2019s name, email and phone for good? This cannot be undone. Their orders stay, anonymised, for accounting.",
      eraseConfirmAgain: "Yes, erase for good",
      confirm: "Yes, remove",
      keep: "Keep",
      working: "Working\u2026",
      actionError: "That did not go through. Try again.",
      self: "You cannot remove or erase your own account.",
    },
    books: {
      title: "Books",
      add: "New book",
      empty: "No books yet. Start one and add its chapters.",
      loadError: "We could not load the books.",
      draft: "Draft",
      published: "On sale",
      chapters: "chapters",
      ready: "ready",
      readers: "readers",
      noCover: "No cover",
    },
    newBook: {
      title: "New book",
      lead: "Start with the details. The book is a draft until you publish it; chapters and videos come next.",
      bookTitle: "Title",
      author: "Author",
      description: "Description",
      price: "Price (\u20b9)",
      priceHint: "Leave at 0 for a free book.",
      submit: "Create the book",
      saving: "Creating\u2026",
      cancel: "Cancel",
      error: "That did not save. Try again in a moment.",
    },
    book: {
      back: "All books",
      loadError: "We could not load this book.",
      sections: { details: "Details", chapters: "Chapters", videos: "Videos", publish: "Publish" },
      // Details
      save: "Save details",
      saving: "Saving\u2026",
      cover: "Cover",
      coverHint: "JPG, PNG or WebP. A tall image, like a book jacket, looks best.",
      addCover: "Add a cover",
      replace: "Replace",
      remove: "Remove",
      // Chapters (D84, D86)
      dropPdfs: "Drop a folder of PDFs here",
      dropPdfsHint: "Or pick them. Chapters are ordered by the number in each file name, and you can fix everything before anything uploads.",
      chooseFolder: "Choose a folder",
      addPdfs: "Add PDFs",
      noChapters: "No chapters yet.",
      pages: "pages",
      statusReady: "Ready",
      statusFailed: "The pages did not render",
      retryRender: "Try again",
      replacePdf: "Replace PDF",
      rename: "Rename",
      saveTitle: "Save",
      cancel: "Cancel",
      delete: "Delete",
      deleteConfirm: "Delete this chapter? Its PDF and video go with it.",
      hasReaders: "Readers have this chapter, so it stays.",
      dragToReorder: "Drag to reorder",
      orderFixed: "The book is on sale, so its chapter order is fixed.",
      staged: {
        title: "Check the chapters before they upload",
        lead: "Order and titles come from the file names. Drag to reorder and edit any title.",
        skipped: "Not PDFs, so skipped:",
        confirm: "Upload {n} chapters",
        cancel: "Cancel",
        remove: "Leave out",
      },
      // Uploads (D85)
      queued: "Waiting",
      sending: "Uploading",
      finishing: "Rendering pages\u2026",
      finishingVideo: "Finishing\u2026",
      uploaded: "Done",
      uploadFailed: "The upload did not finish.",
      retryUpload: "Retry",
      clearDone: "Clear finished",
      uploads: "Uploads",
      // Videos (D83, D86)
      dropVideos: "Drop videos here",
      dropVideosHint: "MP4. They are matched to chapters by number or name; anything unmatched waits in the tray. sample.mp4 becomes the sample.",
      chooseVideos: "Choose videos",
      bookVideo: "Book video",
      bookVideoHint: "For readers who own the book: an introduction or an overview.",
      sample: "Sample",
      sampleHint: "Public: anyone can watch it before buying.",
      chapterVideo: "Chapter {n}",
      noVideo: "No video",
      hasVideo: "Video added",
      addVideo: "Add video",
      stagedVideos: {
        title: "Check where each video goes",
        lead: "Drag a video onto a different slot, or into the tray to leave it out.",
        tray: "Tray: not uploaded",
        trayEmpty: "Nothing in the tray.",
        dropHere: "Drop a video here",
        confirm: "Upload {n} videos",
        cancel: "Cancel",
      },
      // Publish (D84)
      checklist: {
        hasChapters: "At least one chapter",
        allReady: "Every chapter's pages rendered",
        hasCover: "A cover",
      },
      publish: "Publish",
      publishing: "Publishing\u2026",
      publishLead: "Publishing puts the book on sale. Once readers own it, its chapter order is fixed.",
      unpublish: "Take off sale",
      unpublishLead: "On sale. Taking it off sale stops new purchases; readers who own it keep reading.",
    },
    // Refusals from the API, keyed by their code (D38).
    refusals: {
      already_owns_book: "This reader already has that book.",
      unknown_book: "That book is not on sale.",
      book_has_no_chapters: "That book has no chapters yet.",
      identity_belongs_to_two_readers:
        "That email and that phone number belong to two different readers.",
      partial_identity_match:
        "That email or phone number is already on another reader\u2019s account, with different details.",
      email_taken: "Another reader already uses that email.",
      phone_taken: "Another reader already uses that number.",
      erased: "This reader\u2019s data was erased. It cannot be changed.",
      refused: "That was refused.",
      failed: "That did not save. Try again in a moment.",
      title_required: "A title is needed.",
      price_negative: "The price cannot be negative.",
      checklist_incomplete: "The checklist is not complete yet.",
      published_order_fixed: "The book is on sale, so its chapter order is fixed.",
      published_chapter_fixed: "The book is on sale, so its chapters cannot be deleted.",
      chapter_has_readers: "Readers have this chapter, so it cannot be deleted.",
      published_needs_cover: "A book on sale needs a cover. Replace it instead.",
      order_mismatch: "The chapter list changed. Reload and try again.",
    },
  },
} as const;

export type Labels = typeof labels;
