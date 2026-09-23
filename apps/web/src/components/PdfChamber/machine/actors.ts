import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { Layout } from "./types";

/**
 * The chapter's layout: page sizes and sections (D73). The pages themselves are
 * fetched one at a time as they come into view — see `Pages.tsx`.
 *
 * There is no PDF to fetch. The file stays on the server; the browser only
 * ever receives watermarked images of its pages.
 */
export const loadLayout = fromPromise<Layout, { token: string }>(({ input }) =>
  mappedFetcher.get<Layout>(`/api/grants/${input.token}/pages`),
);
