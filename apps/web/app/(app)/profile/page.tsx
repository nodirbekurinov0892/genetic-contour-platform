import { Suspense } from "react";
import ProfilePage from "./profile-content";
import { LoadingState } from "@/components/ui/state-panel";

export default function ProfileRoutePage() {
  return (
    <Suspense fallback={<LoadingState message="Profil yuklanmoqda..." />}>
      <ProfilePage />
    </Suspense>
  );
}
