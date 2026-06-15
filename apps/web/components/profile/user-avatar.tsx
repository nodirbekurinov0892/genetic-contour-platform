"use client";

import Image from "next/image";
import type { AuthUser } from "@/services/authService";
import { getUserAvatarUrl, getUserDisplayName, getUserInitials } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

interface UserAvatarProps {
  user: Pick<AuthUser, "name" | "email" | "profile_data">;
  size?: keyof typeof sizeMap;
  className?: string;
}

export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const profile = user.profile_data ?? null;
  const avatarUrl = getUserAvatarUrl(profile);
  const initials = getUserInitials(user.name, profile, user.email);
  const alt = getUserDisplayName(user.name, profile);

  if (avatarUrl) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-full ring-2 ring-sky-200/80 dark:ring-sky-500/30",
          sizeMap[size],
          className,
        )}
      >
        <Image src={avatarUrl} alt={alt} fill className="object-cover" unoptimized />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-sky-500/15 font-semibold text-sky-700 ring-2 ring-sky-200/80 dark:text-sky-300 dark:ring-sky-500/30",
        sizeMap[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
