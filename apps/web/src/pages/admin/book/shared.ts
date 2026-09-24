import type { Event } from "./machine/types";

export type Send = (event: Event) => void;
