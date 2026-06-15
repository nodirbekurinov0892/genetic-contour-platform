"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as Tabs from "@radix-ui/react-tabs";
import { Loader2, Pencil, Shield, UserCircle } from "lucide-react";
import { AvatarManager } from "@/components/profile/avatar-manager";
import { UserAvatar } from "@/components/profile/user-avatar";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/ui/section-header";
import { LoadingState } from "@/components/ui/state-panel";
import {
  EMPTY_PROFILE,
  formatUserRole,
  getAccountStatusLabel,
  getEmailVerificationLabel,
  getRoleBadgeVariant,
  getUserDisplayName,
  type UserProfileData,
} from "@/lib/user-profile";
import { cn } from "@/lib/utils";

type ProfileTab = "personal" | "role" | "security" | "science";

const TAB_ITEMS: { value: ProfileTab; label: string }[] = [
  { value: "personal", label: "Shaxsiy ma'lumotlar" },
  { value: "role", label: "Platformadagi roli" },
  { value: "security", label: "Xavfsizlik" },
  { value: "science", label: "Ilmiy profil" },
];

function normalizeProfile(data?: UserProfileData | null): UserProfileData {
  return { ...EMPTY_PROFILE, ...(data ?? {}) };
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("uz-UZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ProfileField({
  label,
  fieldId,
  value,
  editing,
  onChange,
  readOnly,
  type = "text",
  multiline = false,
}: {
  label: string;
  fieldId: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  readOnly?: boolean;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {editing && !readOnly ? (
        multiline ? (
          <textarea
            id={fieldId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <Input
            id={fieldId}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9"
          />
        )
      ) : (
        <p className="min-h-9 rounded-md border border-transparent px-3 py-2 text-sm">
          {value.trim() || "—"}
        </p>
      )}
    </div>
  );
}

export default function ProfilePageContent() {
  const searchParams = useSearchParams();
  const { user, loading, updateProfile, changePassword } = useAuth();
  const { toast } = useToast();

  const initialTab = (searchParams.get("tab") as ProfileTab | null) ?? "personal";
  const [activeTab, setActiveTab] = useState<ProfileTab>(
    TAB_ITEMS.some((t) => t.value === initialTab) ? initialTab : "personal",
  );
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingScience, setEditingScience] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personalForm, setPersonalForm] = useState<UserProfileData>(EMPTY_PROFILE);
  const [scienceForm, setScienceForm] = useState<UserProfileData>(EMPTY_PROFILE);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab") as ProfileTab | null;
    if (tab && TAB_ITEMS.some((t) => t.value === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    const profile = normalizeProfile(user.profile_data);
    setPersonalForm(profile);
    setScienceForm(profile);
  }, [user]);

  const displayName = useMemo(
    () => getUserDisplayName(user?.name, user?.profile_data),
    [user],
  );

  const resetPersonalForm = useCallback(() => {
    setPersonalForm(normalizeProfile(user?.profile_data));
    setEditingPersonal(false);
  }, [user]);

  const resetScienceForm = useCallback(() => {
    setScienceForm(normalizeProfile(user?.profile_data));
    setEditingScience(false);
  }, [user]);

  const trimOrNull = (value?: string | null) => value?.trim() || null;

  const handleSavePersonal = async () => {
    setSaving(true);
    try {
      await updateProfile({
        profile: {
          ...normalizeProfile(user?.profile_data),
          first_name: trimOrNull(personalForm.first_name),
          last_name: trimOrNull(personalForm.last_name),
          middle_name: trimOrNull(personalForm.middle_name),
          phone: trimOrNull(personalForm.phone),
          position: trimOrNull(personalForm.position),
          organization: trimOrNull(personalForm.organization),
          degree: trimOrNull(personalForm.degree),
          specialty: trimOrNull(personalForm.specialty),
          birth_date: trimOrNull(personalForm.birth_date),
          gender: trimOrNull(personalForm.gender),
          country: trimOrNull(personalForm.country),
          region: trimOrNull(personalForm.region),
          city: trimOrNull(personalForm.city),
          bio: trimOrNull(personalForm.bio),
          telegram: trimOrNull(personalForm.telegram),
          linkedin: trimOrNull(personalForm.linkedin),
          github: trimOrNull(personalForm.github),
          website: trimOrNull(personalForm.website),
        },
      });
      setEditingPersonal(false);
      toast("Shaxsiy ma'lumotlar saqlandi", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Saqlash muvaffaqiyatsiz", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveScience = async () => {
    setSaving(true);
    try {
      await updateProfile({
        profile: {
          ...normalizeProfile(user?.profile_data),
          orcid: trimOrNull(scienceForm.orcid),
          google_scholar: trimOrNull(scienceForm.google_scholar),
          researchgate: trimOrNull(scienceForm.researchgate),
          scopus_id: trimOrNull(scienceForm.scopus_id),
          wos_id: trimOrNull(scienceForm.wos_id),
          affiliation: trimOrNull(scienceForm.affiliation),
          research_direction: trimOrNull(scienceForm.research_direction),
        },
      });
      setEditingScience(false);
      toast("Ilmiy profil saqlandi", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Saqlash muvaffaqiyatsiz", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.next.length < 8) {
      toast("Yangi parol kamida 8 belgidan iborat bo'lishi kerak", "error");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast("Yangi parollar mos kelmadi", "error");
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(passwordForm.current, passwordForm.next);
      setPasswordForm({ current: "", next: "", confirm: "" });
      toast("Parol muvaffaqiyatli yangilandi", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Parolni almashtirish muvaffaqiyatsiz", "error");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Profil yuklanmoqda..." />;
  }

  if (!user) {
    return <LoadingState message="Profil topilmadi" />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionHeader
        title="Profil"
        description="Shaxsiy ma'lumotlar, rol va xavfsizlik sozlamalari"
      />

      <AvatarManager />

      <div className="scientific-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <UserAvatar user={user} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">{displayName}</h2>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <Badge variant={getRoleBadgeVariant(user.role)} className="mt-2">
            {formatUserRole(user.role)}
          </Badge>
        </div>
      </div>

      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)}>
        <Tabs.List className="flex flex-wrap gap-1 rounded-lg border border-border/80 bg-muted/40 p-1">
          {TAB_ITEMS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "text-muted-foreground hover:text-foreground",
                "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
              )}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="personal" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Shaxsiy ma&apos;lumotlar</h3>
            </div>
            {!editingPersonal ? (
              <Button variant="outline" size="sm" onClick={() => setEditingPersonal(true)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Tahrirlash
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetPersonalForm} disabled={saving}>
                  Bekor qilish
                </Button>
                <Button size="sm" onClick={() => void handleSavePersonal()} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Saqlash
                </Button>
              </div>
            )}
          </div>
          <div className="scientific-card grid gap-4 p-5 sm:grid-cols-2">
            <ProfileField fieldId="first_name" label="Ism" value={personalForm.first_name ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, first_name: v }))} />
            <ProfileField fieldId="last_name" label="Familiya" value={personalForm.last_name ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, last_name: v }))} />
            <ProfileField fieldId="middle_name" label="Otasining ismi" value={personalForm.middle_name ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, middle_name: v }))} />
            <ProfileField fieldId="email" label="Email" value={user.email} editing={editingPersonal} onChange={() => undefined} readOnly />
            <ProfileField fieldId="phone" label="Telefon raqam" value={personalForm.phone ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, phone: v }))} />
            <ProfileField fieldId="birth_date" label="Tug'ilgan sana" value={personalForm.birth_date ?? ""} editing={editingPersonal} type="date" onChange={(v) => setPersonalForm((p) => ({ ...p, birth_date: v }))} />
            <ProfileField fieldId="gender" label="Jins" value={personalForm.gender ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, gender: v }))} />
            <ProfileField fieldId="position" label="Lavozim" value={personalForm.position ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, position: v }))} />
            <ProfileField fieldId="organization" label="Tashkilot / universitet" value={personalForm.organization ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, organization: v }))} />
            <ProfileField fieldId="degree" label="Ilmiy daraja" value={personalForm.degree ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, degree: v }))} />
            <ProfileField fieldId="specialty" label="Mutaxassislik" value={personalForm.specialty ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, specialty: v }))} />
            <ProfileField fieldId="country" label="Mamlakat" value={personalForm.country ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, country: v }))} />
            <ProfileField fieldId="region" label="Viloyat" value={personalForm.region ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, region: v }))} />
            <ProfileField fieldId="city" label="Shahar" value={personalForm.city ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, city: v }))} />
            <ProfileField fieldId="telegram" label="Telegram" value={personalForm.telegram ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, telegram: v }))} />
            <ProfileField fieldId="linkedin" label="LinkedIn" value={personalForm.linkedin ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, linkedin: v }))} />
            <ProfileField fieldId="github" label="GitHub" value={personalForm.github ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, github: v }))} />
            <ProfileField fieldId="website" label="Veb-sayt" value={personalForm.website ?? ""} editing={editingPersonal} onChange={(v) => setPersonalForm((p) => ({ ...p, website: v }))} />
            <div className="sm:col-span-2">
              <ProfileField fieldId="bio" label="Bio" value={personalForm.bio ?? ""} editing={editingPersonal} multiline onChange={(v) => setPersonalForm((p) => ({ ...p, bio: v }))} />
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="role" className="mt-5 space-y-4">
          <div className="scientific-card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Platformadagi roli</p>
                <Badge variant={getRoleBadgeVariant(user.role)} className="mt-2">
                  {formatUserRole(user.role)}
                </Badge>
              </div>
              <Shield className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Hisob holati</p>
                <p className="mt-1 text-sm font-medium">{getAccountStatusLabel(user.is_active)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email tasdiqlash</p>
                <p className="mt-1 text-sm font-medium">
                  {getEmailVerificationLabel(user.email_verified)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ro&apos;yxatdan o&apos;tgan</p>
                <p className="mt-1 text-sm font-medium">{formatDateTime(user.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Oxirgi yangilanish</p>
                <p className="mt-1 text-sm font-medium">{formatDateTime(user.updated_at)}</p>
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="security" className="mt-5 space-y-4">
          <div className="scientific-card space-y-4 p-5">
            <h3 className="font-semibold">Parolni almashtirish</h3>
            <div className="grid gap-4 sm:max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Joriy parol</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Yangi parol</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.next}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Yangi parolni tasdiqlash</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                />
              </div>
              <Button
                onClick={() => void handleChangePassword()}
                disabled={passwordSaving || !passwordForm.current || !passwordForm.next}
              >
                {passwordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Parolni yangilash
              </Button>
            </div>
          </div>

          <div className="scientific-card space-y-3 p-5">
            <h3 className="font-semibold">Sessiyalar</h3>
            <p className="text-sm text-muted-foreground">
              Joriy brauzer sessiyasi faol. Boshqa qurilmalardagi sessiyalar alohida endpoint orqali
              boshqariladi.
            </p>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
              <p className="text-xs text-muted-foreground">Oxirgi kirish vaqti</p>
              <p className="mt-1 font-medium">{formatDateTime(user.last_login_at)}</p>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="science" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Ilmiy profil</h3>
            {!editingScience ? (
              <Button variant="outline" size="sm" onClick={() => setEditingScience(true)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Tahrirlash
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetScienceForm} disabled={saving}>
                  Bekor qilish
                </Button>
                <Button size="sm" onClick={() => void handleSaveScience()} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Saqlash
                </Button>
              </div>
            )}
          </div>
          <div className="scientific-card grid gap-4 p-5 sm:grid-cols-2">
            <ProfileField fieldId="orcid" label="ORCID" value={scienceForm.orcid ?? ""} editing={editingScience} onChange={(v) => setScienceForm((p) => ({ ...p, orcid: v }))} />
            <ProfileField fieldId="google_scholar" label="Google Scholar" value={scienceForm.google_scholar ?? ""} editing={editingScience} onChange={(v) => setScienceForm((p) => ({ ...p, google_scholar: v }))} />
            <ProfileField fieldId="researchgate" label="ResearchGate" value={scienceForm.researchgate ?? ""} editing={editingScience} onChange={(v) => setScienceForm((p) => ({ ...p, researchgate: v }))} />
            <ProfileField fieldId="scopus_id" label="Scopus ID" value={scienceForm.scopus_id ?? ""} editing={editingScience} onChange={(v) => setScienceForm((p) => ({ ...p, scopus_id: v }))} />
            <ProfileField fieldId="wos_id" label="Web of Science ID" value={scienceForm.wos_id ?? ""} editing={editingScience} onChange={(v) => setScienceForm((p) => ({ ...p, wos_id: v }))} />
            <ProfileField fieldId="affiliation" label="Affiliation" value={scienceForm.affiliation ?? ""} editing={editingScience} onChange={(v) => setScienceForm((p) => ({ ...p, affiliation: v }))} />
            <div className="sm:col-span-2">
              <ProfileField fieldId="research_direction" label="Tadqiqot yo'nalishi" value={scienceForm.research_direction ?? ""} editing={editingScience} onChange={(v) => setScienceForm((p) => ({ ...p, research_direction: v }))} />
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
