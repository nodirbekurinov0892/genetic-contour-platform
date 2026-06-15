import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden overflow-y-auto pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
