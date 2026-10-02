type RoomLabelProps = {
  label: string;
};

export function RoomLabel({ label }: RoomLabelProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]"
      data-testid="room-label"
    >
      <p className="bg-ink-950/30 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-mist-200/75 backdrop-blur-[2px]">
        {label}
      </p>
    </div>
  );
}
