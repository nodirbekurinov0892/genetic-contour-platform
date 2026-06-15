"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as Tabs from "@radix-ui/react-tabs";
import { Loader2, Pencil, Shield, UserCircle } from "lucide-react";
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
  getUserDisplayName,
  getUserInitials,
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

function getRoleBadgeVariant(role: string): "default" | "success" | "secondary" {
  if (role === "admin") return "default";
  if (role === "researcher") return "success";
  return "secondary";
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
  value,
  editing,
  onChange,
  readOnly,
  type = "text",
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  readOnly?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing && !readOnly ? (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9"
        />
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

  const handleSavePersonal = async () => {
    setSaving(true);
    try {
      await updateProfile({
        profile: {
          ...normalizeProfile(user?.profile_data),
          first_name: personalForm.first_name?.trim() || null,
          last_name: personalForm.last_name?.trim() || null,
          middle_name: personalForm.middle_name?.trim() || null,
          phone: personalForm.phone?.trim() || null,
          position: personalForm.position?.trim() || null,
          organization: personalForm.organization?.trim() || null,
          degree: personalForm.degree?.trim() || null,
          specialty: personalForm.specialty?.trim() || null,
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
          orcid: scienceForm.orcid?.trim() || null,
          google_scholar: scienceForm.google_scholar?.trim() || null,
          researchgate: scienceForm.researchgate?.trim() || null,
          affiliation: scienceForm.affiliation?.trim() || null,
          research_direction: scienceForm.research_direction?.trim() || null,
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

  const profile = normalizeProfile(user.profile_data);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionHeader
        title="Profil"
        description="Shaxsiy ma'lumotlar, rol va xavfsizlik sozlamalari"
      />

      <div className="scientific-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/12 text-lg font-semibold text-primary">
          {getUserInitials(user.name, profile, user.email)}
        </span>
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
            <ProfileField
              label="Ism"
              value={personalForm.first_name ?? ""}
              editing={editingPersonal}
              onChange={(v) => setPersonalForm((p) => ({ ...p, first_name: v }))}
            />
            <ProfileField
              label="Familiya"
              value={personalForm.last_name ?? ""}
              editing={editingPersonal}
              onChange={(v) => setPersonalForm((p) => ({ ...p, last_name: v }))}
            />
            <ProfileField
              label="Otasining ismi"
              value={personalForm.middle_name ?? ""}
              editing={editingPersonal}
              onChange={(v) => setPersonalForm((p) => ({ ...p, middle_name: v }))}
            />
            <ProfileField
              label="Email"
              value={user.email}
              editing={editingPersonal}
              onChange={() => undefined}
              readOnly
            />
            <ProfileField
              label="Telefon raqam"
              value={personalForm.phone ?? ""}
              editing={editingPersonal}
              onChange={(v) => setPersonalForm((p) => ({ ...p, phone: v }))}
            />
            <ProfileField
              label="Lavozim"
              value={personalForm.position ?? ""}
              editing={editingPersonal}
              onChange={(v) => setPersonalForm((p) => ({ ...p, position: v }))}
            />
            <ProfileField
              label="Tashkilot / universitet"
              value={personalForm.organization ?? ""}
              editing={editingPersonal}
              onChange={(v) => setPersonalForm((p) => ({ ...p, organization: v }))}
            />
            <ProfileField
              label="Ilmiy daraja"
              value={personalForm.degree ?? ""}
              editing={editingPersonal}
              onChange={(v) => setPersonalForm((p) => ({ ...p, degree: v }))}
            />
            <ProfileField
              label="Mutaxassislik"
              value={personalForm.specialty ?? ""}
              editing={editingPersonal}
              onChange={(v) => setPersonalForm((p) => ({ ...p, specialty: v }))}
            />
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
            <ProfileField
              label="ORCID"
              value={scienceForm.orcid ?? ""}
              editing={editingScience}
              onChange={(v) => setScienceForm((p) => ({ ...p, orcid: v }))}
            />
            <ProfileField
              label="Google Scholar"
              value={scienceForm.google_scholar ?? ""}
              editing={editingScience}
              onChange={(v) => setScienceForm((p) => ({ ...p, google_scholar: v }))}
            />
            <ProfileField
              label="ResearchGate"
              value={scienceForm.researchgate ?? ""}
              editing={editingScience}
              onChange={(v) => setScienceForm((p) => ({ ...p, researchgate: v }))}
            />
            <ProfileField
              label="Affiliation"
              value={scienceForm.affiliation ?? ""}
              editing={editingScience}
              onChange={(v) => setScienceForm((p) => ({ ...p, affiliation: v }))}
            />
            <div className="sm:col-span-2">
              <ProfileField
                label="Tadqiqot yo'nalishi"
                value={scienceForm.research_direction ?? ""}
                editing={editingScience}
                onChange={(v) => setScienceForm((p) => ({ ...p, research_direction: v }))}
              />
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
