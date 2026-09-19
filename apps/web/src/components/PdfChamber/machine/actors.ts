import { fromPromise } from "xstate";

import { API_BASE } from "../../../lib/env";

/**
 * Fetches the proxied bytes and hands back a blob URL.
 *
 * The PDF is never a storage URL — always `/api/grants/{token}/pdf` (D29), which
 * is what keeps object storage swappable and the file unreachable without a
 * live grant.
 */
export const loadPdf = fromPromise<string, { token: string }>(async ({ input }) => {
  const response = await fetch(`${API_BASE}/api/grants/${input.token}/pdf`, {
    credentials: "include",
  });

  if (!response.ok) throw new Error(`pdf ${response.status}`);

  return URL.createObjectURL(await response.blob());
});
