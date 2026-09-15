import { themeStyleVars } from "@/lib/themes";

export default function ThemeWrapper({
  themeId,
  accentColor,
  fontId,
  className,
  children,
}: {
  themeId: string | null | undefined;
  accentColor?: string | null;
  fontId?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-background text-foreground ${className ?? ""}`}
      style={themeStyleVars(themeId, accentColor, fontId) as React.CSSProperties}
    >
      {children}
    </div>
  );
}
