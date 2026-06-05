import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  className?: string;
}

export function SectionHeader({ title, description, badge, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-2", className)}>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="scientific-section-title">{title}</h2>
          {badge && <span className="scientific-badge">{badge}</span>}
        </div>
        {description && (
          <p className="mt-1 scientific-section-desc">{description}</p>
        )}
      </div>
    </div>
  );
}
