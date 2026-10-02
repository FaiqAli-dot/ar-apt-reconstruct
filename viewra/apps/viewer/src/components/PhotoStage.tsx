import { useEffect, useState } from "react";
import { EmptyPhoto } from "./EmptyPhoto";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

type PhotoStageProps = {
  url: string | null;
  alt: string;
  emptyLabel?: string;
};

export function PhotoStage({ url, alt, emptyLabel }: PhotoStageProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [activeUrl, setActiveUrl] = useState<string | null>(url);
  const [outgoingUrl, setOutgoingUrl] = useState<string | null>(null);
  const [outgoingVisible, setOutgoingVisible] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);

    if (!url) {
      setActiveUrl(null);
      setOutgoingUrl(null);
      setOutgoingVisible(false);
      return;
    }

    if (url === activeUrl) return;

    if (reducedMotion || !activeUrl) {
      setActiveUrl(url);
      setOutgoingUrl(null);
      setOutgoingVisible(false);
      return;
    }

    setOutgoingUrl(activeUrl);
    setOutgoingVisible(true);
    setActiveUrl(url);
  }, [url, activeUrl, reducedMotion]);

  useEffect(() => {
    if (!outgoingUrl || !outgoingVisible) return;
    const fadeMs = reducedMotion ? 0 : 480;
    const hideId = window.setTimeout(() => setOutgoingVisible(false), 30);
    const clearId = window.setTimeout(() => setOutgoingUrl(null), fadeMs + 30);
    return () => {
      window.clearTimeout(hideId);
      window.clearTimeout(clearId);
    };
  }, [outgoingUrl, outgoingVisible, reducedMotion]);

  if (!url || broken || !activeUrl) {
    return <EmptyPhoto label={emptyLabel} />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-ink-950" data-testid="photo-stage">
      <img
        key={`active-${activeUrl}`}
        src={activeUrl}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
        onError={() => setBroken(true)}
      />

      {outgoingUrl ? (
        <img
          key={`outgoing-${outgoingUrl}`}
          src={outgoingUrl}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-crossfade ease-out ${
            outgoingVisible ? "opacity-100" : "opacity-0"
          }`}
          draggable={false}
        />
      ) : null}

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/55 via-transparent to-ink-950/25"
        aria-hidden
      />
    </div>
  );
}
