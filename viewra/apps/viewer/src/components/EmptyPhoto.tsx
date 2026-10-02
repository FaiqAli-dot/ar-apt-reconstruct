type EmptyPhotoProps = {
  label?: string;
};

export function EmptyPhoto({ label }: EmptyPhotoProps) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center bg-ink-900 px-6 text-center"
      data-testid="empty-photo"
    >
      <div
        className="mb-6 h-24 w-36 rounded-sm border border-mist-400/20 bg-gradient-to-br from-ink-800 to-ink-950"
        aria-hidden
      />
      <p className="font-display text-2xl text-mist-200">No photo</p>
      <p className="mt-2 max-w-xs text-sm font-light text-mist-400">
        {label
          ? `A center view is not available for ${label} yet.`
          : "A center view is not available for this stop yet."}
      </p>
    </div>
  );
}
