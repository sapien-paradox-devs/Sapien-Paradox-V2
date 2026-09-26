/**
 * Profile — level 1. Three parallel regions (D42).
 *
 *   data      loading → ready · error
 *   saving    idle → saving → saved · failed
 *   password  idle → submitting → done · failed
 */

import type { Context, Event } from "./types";

const initialContext: Context = { profile: null, saveError: null, passwordError: null };

export const profileConfig = {
  id: "profile",
  type: "parallel",
  context: initialContext,

  states: {
    data: {
      initial: "loading",
      states: {
        loading: {
          invoke: {
            src: "fetchProfile",
            onDone: { target: "ready", actions: "assignProfile" },
            onError: { target: "error" },
          },
        },
        ready: {},
        error: { on: { RETRY: { target: "loading" } } },
      },
    },

    saving: {
      initial: "idle",
      states: {
        idle: {
          on: { SAVE: { target: "saving" } },
        },
        saving: {
          invoke: {
            src: "saveProfile",
            input: ({ event }: { event: Event }) => ({
              fullName: event.type === "SAVE" ? event.fullName : undefined,
              email: event.type === "SAVE" ? event.email : undefined,
              avatarSeed: event.type === "SAVE" ? event.avatarSeed : undefined,
            }),
            onDone: { target: "saved", actions: "assignProfile" },
            onError: [
              { guard: "isEmailTaken", target: "failed", actions: "assignEmailTakenError" },
              { target: "failed", actions: "assignSaveError" },
            ],
          },
        },
        saved: {
          after: { 2000: { target: "idle" } },
          on: { SAVE: { target: "saving" }, SAVE_DISMISS: { target: "idle" } },
        },
        failed: {
          on: { SAVE: { target: "saving" }, SAVE_DISMISS: { target: "idle", actions: "clearSaveError" } },
        },
      },
    },

    password: {
      initial: "idle",
      states: {
        idle: {
          on: { CHANGE_PASSWORD: { target: "submitting" } },
        },
        submitting: {
          invoke: {
            src: "changePassword",
            input: ({ event }: { event: Event }) => ({
              currentPassword: event.type === "CHANGE_PASSWORD" ? event.currentPassword : undefined,
              newPassword: event.type === "CHANGE_PASSWORD" ? event.newPassword : "",
            }),
            onDone: { target: "done" },
            onError: [
              { guard: "isWrongPassword", target: "failed", actions: "assignWrongPasswordError" },
              { guard: "isTooShort", target: "failed", actions: "assignTooShortError" },
              { target: "failed", actions: "assignPasswordError" },
            ],
          },
        },
        done: {
          after: { 3000: { target: "idle" } },
          on: { PASSWORD_DISMISS: { target: "idle" } },
        },
        failed: {
          on: {
            CHANGE_PASSWORD: { target: "submitting" },
            PASSWORD_DISMISS: { target: "idle", actions: "clearPasswordError" },
          },
        },
      },
    },
  },
} as const;
