"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/providers/toast-provider";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function cropImageToSquare(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))), "image/jpeg", 0.9);
  });
}

export function AvatarManager() {
  const { user, uploadAvatar, deleteAvatar } = useAuth();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const resetPicker = () => {
    setPreview(null);
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Faqat rasm fayllari qabul qilinadi", "error");
      return;
    }
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  }, [toast]);

  const handleUpload = async () => {
    if (!pendingFile) return;
    setBusy(true);
    try {
      const cropped = await cropImageToSquare(pendingFile);
      const croppedFile = new File([cropped], "avatar.jpg", { type: "image/jpeg" });
      await uploadAvatar(croppedFile);
      toast("Avatar yangilandi", "success");
      resetPicker();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Avatar yuklash muvaffaqiyatsiz", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteAvatar();
      toast("Avatar o'chirildi", "success");
      resetPicker();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Avatar o'chirish muvaffaqiyatsiz", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="scientific-card space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-4">
        {preview ? (
          <span className="relative h-24 w-24 overflow-hidden rounded-full ring-2 ring-sky-300/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Avatar preview" className="h-full w-full object-cover" />
          </span>
        ) : (
          <UserAvatar user={user} size="xl" />
        )}
        <div className="space-y-2">
          <p className="text-sm font-medium">Profil rasmi</p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG yoki WebP · maksimal 2MB · markaziy kvadrat crop qo&apos;llanadi
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-3.5 w-3.5" />
              Yuklash
            </Button>
            {pendingFile && (
              <Button type="button" size="sm" onClick={() => void handleUpload()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Camera className="mr-2 h-3.5 w-3.5" />}
                Saqlash
              </Button>
            )}
            {user.profile_data?.avatar_url && (
              <Button type="button" variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={busy}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                O&apos;chirish
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="avatar-file" className="sr-only">
          Avatar fayli
        </Label>
        <Input
          id="avatar-file"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
