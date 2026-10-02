type LoadingScreenProps = {
  brand?: boolean;
};

export function LoadingScreen({ brand = true }: LoadingScreenProps) {
  return (
    <div
      className="flex min-h-full flex-col items-center justify-center px-6"
      role="status"
      aria-live="polite"
      data-testid="loading-screen"
    >
      {brand ? (
        <p className="font-display text-5xl tracking-tight text-mist-100 md:text-6xl">
          Viewra
        </p>
      ) : null}
      <div
        className="mt-8 h-px w-16 origin-left animate-pulse bg-brass-400/70"
        aria-hidden
      />
      <p className="mt-4 text-xs uppercase tracking-[0.28em] text-mist-400">
        Loading tour
      </p>
    </div>
  );
}
