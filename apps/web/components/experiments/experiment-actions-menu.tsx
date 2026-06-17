"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Copy, Eye, MoreHorizontal, Pencil, Play, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import { experimentService } from "@/services/experimentService";
import type { ExperimentBrowseItem } from "@shared/types";

interface ExperimentActionsMenuProps {
  experiment: ExperimentBrowseItem;
  onChanged: () => void;
}

export function ExperimentActionsMenu({ experiment, onChanged }: ExperimentActionsMenuProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
  const [title, setTitle] = useState(experiment.title);
  const [busy, setBusy] = useState(false);

  const runAction = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast(success, "success");
      onChanged();
      setOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Xato", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="relative inline-block text-left">
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-label="Amallar">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
        {open && (
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border bg-background p-1 shadow-lg">
            <Link
              href={`/experiments/${experiment.id}`}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Eye className="h-3.5 w-3.5" /> Tafsilotlar
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
              onClick={() => {
                setRenameOpen(true);
                setOpen(false);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> Qayta nomlash
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
              onClick={() => void runAction(() => experimentService.clone(experiment.id), "Nusxa yaratildi")}
            >
              <Copy className="h-3.5 w-3.5" /> Nusxalash
            </button>
            {experiment.status === "completed" && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => void runAction(() => experimentService.rerun(experiment.id), "Qayta ishga tushirildi")}
              >
                <Play className="h-3.5 w-3.5" /> Qayta ishga tushirish
              </button>
            )}
            {(experiment.status === "running" || experiment.status === "queued") && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => void runAction(() => experimentService.cancel(experiment.id), "Bekor qilindi")}
              >
                <XCircle className="h-3.5 w-3.5" /> Bekor qilish
              </button>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
              onClick={() => void runAction(() => experimentService.archive(experiment.id), "Arxivlandi")}
            >
              <Archive className="h-3.5 w-3.5" /> Arxivlash
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              onClick={() => {
                setDeleteOpen(true);
                setOpen(false);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Yumshoq o&apos;chirish
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              onClick={() => {
                setHardDeleteOpen(true);
                setOpen(false);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Butunlay o&apos;chirish
            </button>
          </div>
        )}
      </div>

      {renameOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-6">
            <h3 className="font-semibold">Tajribani qayta nomlash</h3>
            <Input className="mt-3" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRenameOpen(false)}>
                Bekor
              </Button>
              <Button
                disabled={busy || !title.trim()}
                onClick={() =>
                  void runAction(
                    () => experimentService.update(experiment.id, { title: title.trim() }),
                    "Nom yangilandi",
                  ).then(() => setRenameOpen(false))
                }
              >
                Saqlash
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Tajribani arxivlash?"
        description="Tajriba arxivga ko'chiriladi. Keyinroq tiklash mumkin."
        confirmLabel="Arxivlash"
        destructive
        loading={busy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() =>
          void runAction(() => experimentService.delete(experiment.id), "Arxivlandi").then(() =>
            setDeleteOpen(false),
          )
        }
      />

      <ConfirmDialog
        open={hardDeleteOpen}
        title="Butunlay o'chirish?"
        description="Barcha natijalar, metrikalar va storage fayllari o'chiriladi. Bu qaytarib bo'lmaydi."
        confirmLabel="Butunlay o'chirish"
        destructive
        loading={busy}
        onCancel={() => setHardDeleteOpen(false)}
        onConfirm={() =>
          void runAction(
            () => experimentService.delete(experiment.id, true),
            "Butunlay o'chirildi",
          ).then(() => setHardDeleteOpen(false))
        }
      />
    </>
  );
}
