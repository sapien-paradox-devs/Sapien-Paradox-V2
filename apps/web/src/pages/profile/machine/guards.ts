import type { AnyEventObject } from "xstate";

function errorStatus(event: AnyEventObject): number {
  return typeof event === "object" && event !== null && "error" in event &&
    typeof event.error === "object" && event.error !== null && "status" in event.error
    ? (event.error as { status: number }).status
    : 0;
}

export const isEmailTaken = ({ event }: { event: AnyEventObject }) =>
  errorStatus(event) === 409;

export const isWrongPassword = ({ event }: { event: AnyEventObject }) =>
  errorStatus(event) === 403;

export const isTooShort = ({ event }: { event: AnyEventObject }) =>
  errorStatus(event) === 400;
