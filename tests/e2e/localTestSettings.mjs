import { readFileSync } from "node:fs";

const settings = JSON.parse(readFileSync(new URL("../../config/local-test-settings.json", import.meta.url), "utf8"));

export const localTestSettings = settings;
export const localUsers = settings.authUsers;

export function localUser(role) {
  const user = localUsers[role];
  if (!user) throw new Error(`Missing local test user: ${role}`);
  return {
    createdAt: "2024-01-01T00:00:00",
    disabled: false,
    ...user,
  };
}

export function localSession(role = "funnifin", overrides = {}) {
  const user = localUser(role);
  const token = overrides.token || `local-${role}-${Date.now()}`;
  return {
    userId: user.id,
    token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    effectiveRole: user.actualRole,
    user,
    ...overrides,
  };
}
