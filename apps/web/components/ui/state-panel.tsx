import { AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "Yuklanmoqda...", className }: LoadingStateProps) {
  return (
    <div className={cn("flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  hint?: string;
  className?: string;
}

export function ErrorState({
  title = "Nimadir noto'g'ri ketdi",
  message,
  onRetry,
  hint,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("rounded-lg border border-destructive/30 bg-destructive/5 p-6", className)}>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-2">
          <p className="font-medium text-destructive">{title}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Qayta urinish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center",
        className,
      )}
    >
      <Inbox className="mb-3 h-10 w-10 text-muted-foreground/50" />
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
