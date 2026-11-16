"use client";

import type { User } from "firebase/auth";

function norm(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

const allowedUid = process.env.NEXT_PUBLIC_ALLOWED_USER_UID?.trim() ?? "";
const allowedEmail = norm(process.env.NEXT_PUBLIC_ALLOWED_EMAIL);

export function isAllowedUser(user: User | null): boolean {
  if (!user) return false;
  if (allowedUid && user.uid === allowedUid) return true;
  if (allowedEmail && norm(user.email ?? undefined) === allowedEmail) return true;
  return false;
}

export function hasAllowlistConfig(): boolean {
  return Boolean(allowedUid || allowedEmail);
}
