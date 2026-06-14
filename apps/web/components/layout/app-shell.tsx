import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <div className="mx-auto max-w-7xl p-6 lg:p-8">{children}</div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-background md:hidden">
        {[
          { href: "/", label: "Panel" },
          { href: "/library", label: "Kutubxona" },
          { href: "/experiments/new", label: "Yangi" },
          { href: "/comparison", label: "Taqqoslash" },
          { href: "/help", label: "Yordam" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex flex-1 flex-col items-center py-2 text-[10px] text-muted-foreground"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
