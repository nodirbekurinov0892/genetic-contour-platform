import Link from "next/link";
import { PLATFORM_NAME } from "@shared/constants";

export function AuthFooter() {
  return (
    <footer className="relative z-10 border-t border-border/60 px-6 py-4 text-center text-xs text-muted-foreground">
      <p>{PLATFORM_NAME} © {new Date().getFullYear()}</p>
      <div className="mt-2 flex justify-center gap-4">
        <Link href="/legal/privacy" className="hover:text-primary">
          Maxfiylik
        </Link>
        <Link href="/legal/terms" className="hover:text-primary">
          Shartlar
        </Link>
        <Link href="/help" className="hover:text-primary">
          Yordam
        </Link>
      </div>
    </footer>
  );
}
