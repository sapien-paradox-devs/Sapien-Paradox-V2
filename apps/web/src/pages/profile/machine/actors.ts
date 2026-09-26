import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { Profile } from "./types";

export type SaveInput = { fullName?: string; email?: string; avatarSeed?: string };
export type PasswordInput = { currentPassword?: string; newPassword: string };

export const fetchProfile = fromPromise<Profile>(() =>
  mappedFetcher.get<Profile>("/api/profile"),
);

export const saveProfile = fromPromise<Profile, SaveInput>(({ input }) => {
  const body: Record<string, string> = {};
  if (input.fullName !== undefined) body.fullName = input.fullName;
  if (input.email !== undefined) body.email = input.email;
  if (input.avatarSeed !== undefined) body.avatarSeed = input.avatarSeed;
  return mappedFetcher.patch<Profile>("/api/profile", body);
});

export const changePassword = fromPromise<void, PasswordInput>(({ input }) => {
  const body: Record<string, string> = { newPassword: input.newPassword };
  if (input.currentPassword) body.currentPassword = input.currentPassword;
  return mappedFetcher.post<void>("/api/auth/password", body);
});
