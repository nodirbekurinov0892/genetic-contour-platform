import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AppHeader } from "@/components/layout/app-header";
import { AppFooter } from "@/components/layout/app-footer";
import { SystemStatusProvider } from "@/components/providers/system-status-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SystemStatusProvider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-x-hidden overflow-y-auto pb-20 md:pb-0">
            <div className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</div>
          </main>
          <AppFooter />
        </div>
        <MobileNav />
      </div>
    </SystemStatusProvider>
  );
}
