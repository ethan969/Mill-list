import { themeStyleVars, resolveFontId } from "@/lib/themes";
import { DISPLAY_FONT_VARIABLES } from "@/lib/loaded-fonts";

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
  // Apply only the one font variable this project actually needs, rather
  // than relying on all six being globally available — see
  // src/lib/loaded-fonts.ts.
  const resolvedFontId = resolveFontId(themeId, fontId);
  const fontVariableClass = DISPLAY_FONT_VARIABLES[resolvedFontId] ?? "";

  return (
    <div
      className={`${fontVariableClass} bg-background text-foreground ${className ?? ""}`}
      style={themeStyleVars(themeId, accentColor, fontId) as React.CSSProperties}
    >
      {children}
    </div>
  );
}
