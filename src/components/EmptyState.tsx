export default function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
      <p className="text-sm text-muted">{label} hasn&apos;t been uploaded yet.</p>
    </div>
  );
}
