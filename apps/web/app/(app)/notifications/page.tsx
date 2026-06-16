"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state-panel";
import { notificationService, type Notification } from "@/services/notificationService";
import { formatDate } from "@/lib/utils";

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await notificationService.list({ limit: 50 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    setBusy(id);
    try {
      await notificationService.markRead(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(null);
    }
  };

  const markAllRead = async () => {
    setBusy("all");
    try {
      await notificationService.markAllRead();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingState message="Bildirishnomalar yuklanmoqda..." />;
  if (error && items.length === 0) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  const unread = items.filter((n) => !n.read_at);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Bildirishnomalar"
        description="Tajriba, benchmark va tizim xabarlari"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null || unread.length === 0}
          onClick={() => void markAllRead()}
          className="gap-2"
        >
          <CheckCheck className="h-4 w-4" />
          Barchasini o&apos;qilgan deb belgilash
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {items.length === 0 ? (
        <EmptyState
          title="Bildirishnomalar yo&apos;q"
          description="Yangi xabarlar shu yerda ko&apos;rinadi."
        />
      ) : (
        <div className="space-y-3">
          {items.map((note) => (
            <div
              key={note.id}
              className={`scientific-card p-4 ${!note.read_at ? "border-primary/40 bg-primary/5" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-sky-500/10 p-2">
                    <Bell className="h-4 w-4 text-sky-600" />
                  </div>
                  <div>
                    <p className="font-semibold">{note.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{note.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(note.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!note.read_at ? (
                    <>
                      <Badge variant="secondary">Yangi</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === note.id}
                        onClick={() => void markRead(note.id)}
                      >
                        O&apos;qildi
                      </Button>
                    </>
                  ) : (
                    <Badge variant="outline">O&apos;qilgan</Badge>
                  )}
                </div>
              </div>
              {note.payload_json?.experiment_id != null && (
                <Link
                  href={`/experiments/${String(note.payload_json.experiment_id)}`}
                  className="mt-2 inline-block text-xs text-primary underline"
                >
                  Tajribaga o&apos;tish
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
