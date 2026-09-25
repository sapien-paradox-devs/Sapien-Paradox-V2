import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { Turn } from "./types";

type Answer = { answer: string };

/** The companion speaks first, with a question about the chapter (D13, #202). */
export const openCompanion = fromPromise<Answer, { token: string }>(({ input }) =>
  mappedFetcher.post<Answer>("/api/chat", { token: input.token, opening: true }),
);

/** Chapter-scoped, with the thread so far; capped in the service (D33). */
export const askCompanion = fromPromise<Answer, { token: string; question: string; history: Turn[] }>(
  ({ input }) =>
    mappedFetcher.post<Answer>("/api/chat", {
      token: input.token,
      question: input.question,
      history: input.history,
    }),
);
