export type BookProgress = {
  title: string;
  chaptersUnlocked: number;
  chaptersTotal: number;
  progress: number;
};

export type Profile = {
  fullName: string;
  email: string;
  phone: string | null;
  hasPassword: boolean;
  avatarSeed: string | null;
  books: BookProgress[];
};

export type Context = {
  profile: Profile | null;
  saveError: string | null;
  passwordError: string | null;
};

export type Event =
  | { type: "RETRY" }
  | { type: "SAVE"; fullName?: string; email?: string; avatarSeed?: string }
  | { type: "SAVE_DISMISS" }
  | { type: "CHANGE_PASSWORD"; currentPassword?: string; newPassword: string }
  | { type: "PASSWORD_DISMISS" };
