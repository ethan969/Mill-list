export default function EmptyState({
  label,
  message,
}: {
  label: string;
  /** Full override of the shown text; defaults to "{label} hasn't been uploaded yet." */
  message?: string;
}) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
      <p className="text-sm text-muted">
        {message ?? `${label} hasn't been uploaded yet.`}
      </p>
    </div>
  );
}
