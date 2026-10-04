export const API_DEMO_ACCOUNTS = [
  { label: "Sinh viên", identifier: "SV-DEMO-001", password: "demo1234" },
  { label: "Cán bộ", identifier: "OF-DEMO-01", password: "demo1234" },
] as const;

/** Password-login fill helpers. Must match backend DEFAULT_DEV_PASSWORD / CAMPUS_SEED_PASSWORD. */
export const OPERATIONAL_ACCOUNTS = [
  { label: "Sinh viên", identifier: "20210018", password: "Campus247-An18" },
  { label: "Cán bộ", identifier: "ha.tt", password: "Campus247-An18" },
] as const;

export function resolveApiDemoUserId(identifier: string): string | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const upper = trimmed.toUpperCase();

  if (/^SV-DEMO-\d{3}$/.test(upper)) return upper;
  if (/^OF-DEMO-\d{2}$/.test(upper)) return upper;

  if (lower === "sv001" || lower === "sv-demo-001") {
    return "SV-DEMO-001";
  }
  if (lower === "of001" || lower === "of-demo-01") {
    return "OF-DEMO-01";
  }
  return null;
}

export function isOfficerDemoUserId(userId: string): boolean {
  return userId.toUpperCase().startsWith("OF");
}
