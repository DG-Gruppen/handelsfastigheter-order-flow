import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns the canonical app base URL for use in outgoing emails etc. */
export function getAppBaseUrl(): string {
  return "https://intra.handelsfastigheter.se";
}
