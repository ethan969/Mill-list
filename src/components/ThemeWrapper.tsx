import { themeStyleVars } from "@/lib/themes";

export default function ThemeWrapper({
  themeId,
  accentColor,
  className,
  children,
}: {
  themeId: string | null | undefined;
  accentColor?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-background text-foreground ${className ?? ""}`}
      style={themeStyleVars(themeId, accentColor) as React.CSSProperties}
    >
      {children}
    </div>
  );
}
