import type { Context } from "./types";

export const hasBook = ({ context }: { context: Context }) => context.book !== null;
