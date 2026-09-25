import type { Context } from "./types";

export const hasBook = ({ context }: { context: Context }) => context.book !== null;

export const hasStagedPdfs = ({ context }: { context: Context }) =>
  (context.stagedPdfs?.chapters.length ?? 0) > 0;
