/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import { ceremonyBeat } from "../../../lib/motion";
import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { readerConfig } from "./machine";
import type { Context, Event } from "./types";

export const readerMachine = setup({
  types: {} as { context: Context; events: Event; input: { token: string } },
  actions: {
    assignChapter: assign(actions.chapterFrom),
    assignLatest: assign(actions.latestFrom),
    assignSent: assign(actions.sentFrom),
    assignFlushed: assign(actions.flushed),
    assignCompleted: assign(actions.completedNow),
    sendOnExit: actions.sendOnExit,
  },
  actors: {
    fetchGrant: actors.fetchGrant,
    reissueGrant: actors.reissueGrant,
    completeChapter: actors.completeChapter,
    saveProgress: actors.saveProgress,
  },
  // One beat of the threshold ceremony, read from the `--dur-ceremony` CSS
  // token so reduced motion shortens it in the one place it is defined.
  delays: {
    beat: ceremonyBeat,
    sendDelay: ({ context }: { context: Context }) =>
      actions.nextSendDelay(Date.now(), context.lastSentAt),
  },
  guards: {
    isFirstOpen: guards.isFirstOpen,
    isCompleted: guards.isCompleted,
    isFurther: guards.isFurther,
    movedEnough: guards.movedEnough,
    hasUnsent: guards.hasUnsent,
    moreToSend: guards.moreToSend,
    isExpired: guards.isExpired,
    isForbidden: guards.isForbidden,
    isRateLimited: guards.isRateLimited,
  },
}).createMachine({
  ...readerConfig,
  context: ({ input }: { input: { token: string } }) => ({
    token: input.token,
    chapter: null,
    latest: 0,
    sent: 0,
    lastSentAt: 0,
    completed: false,
  }),
});

export type { ChapterMeta, Context, Event } from "./types";
