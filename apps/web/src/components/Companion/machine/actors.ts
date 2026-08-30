import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";

type Ask = { token: string; question: string };

/** Chapter-scoped, and capped in the service rather than here (D33). */
export const askCompanion = fromPromise<{ answer: string }, Ask>(({ input }) =>
  mappedFetcher.post<{ answer: string }>("/api/chat", {
    token: input.token,
    question: input.question,
  }),
);
