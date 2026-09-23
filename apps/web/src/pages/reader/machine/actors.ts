import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { ChapterMeta } from "./types";

/** Validates the token, returns chapter meta, and stamps `opened_at` server-side. */
export const fetchGrant = fromPromise<ChapterMeta, { token: string }>(({ input }) =>
  mappedFetcher.get<ChapterMeta>(`/api/grants/${input.token}`),
);

/** One tap from a dead link to a live one (D9). Mints a new grant. */
export const reissueGrant = fromPromise<void, { token: string }>(({ input }) =>
  mappedFetcher.post<void>(`/api/grants/${input.token}/reissue`),
);

/** The reader marks the chapter complete — the only way to 100% (D70). */
export const completeChapter = fromPromise<void, { token: string }>(({ input }) =>
  mappedFetcher.post<void>(`/api/grants/${input.token}/complete`),
);
