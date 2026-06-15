export type UserProfileData = {
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  phone?: string | null;
  position?: string | null;
  organization?: string | null;
  degree?: string | null;
  specialty?: string | null;
  orcid?: string | null;
  google_scholar?: string | null;
  researchgate?: string | null;
  affiliation?: string | null;
  research_direction?: string | null;
};

export const EMPTY_PROFILE: UserProfileData = {
  first_name: "",
  last_name: "",
  middle_name: "",
  phone: "",
  position: "",
  organization: "",
  degree: "",
  specialty: "",
  orcid: "",
  google_scholar: "",
  researchgate: "",
  affiliation: "",
  research_direction: "",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  user: "Foydalanuvchi",
  researcher: "Tadqiqotchi",
};

export function formatUserRole(role: string | null | undefined): string {
  if (!role) return ROLE_LABELS.user;
  return ROLE_LABELS[role] ?? "Foydalanuvchi";
}

export function getUserDisplayName(
  name: string | null | undefined,
  profile?: UserProfileData | null,
): string {
  const parts = [profile?.first_name, profile?.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (name?.trim()) return name.trim();
  return "Foydalanuvchi";
}

export function getUserInitials(
  name: string | null | undefined,
  profile?: UserProfileData | null,
  email?: string,
): string {
  const display = getUserDisplayName(name, profile);
  const chunks = display.split(/\s+/).filter(Boolean);
  if (chunks.length >= 2) {
    return `${chunks[0][0] ?? ""}${chunks[1][0] ?? ""}`.toUpperCase();
  }
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return (email?.slice(0, 2) ?? "U").toUpperCase();
}

export function getAccountStatusLabel(isActive: boolean): string {
  return isActive ? "Faol" : "Nofaol";
}

export function getEmailVerificationLabel(verified?: boolean): string {
  return verified ? "Tasdiqlangan" : "Tasdiqlanmagan";
}
