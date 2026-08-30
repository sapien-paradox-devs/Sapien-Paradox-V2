import type { AnyEventObject } from "xstate";

import { ApiError } from "../../../lib/fetcher";

/**
 * The reader has reached the chapter's limit. A boundary, not a failure — the
 * caps live in the service, and the panel renders what it is told (D33, D45).
 */
export const isCapped = ({ event }: { event: AnyEventObject }) =>
  "error" in event && event.error instanceof ApiError && event.error.status === 429;
