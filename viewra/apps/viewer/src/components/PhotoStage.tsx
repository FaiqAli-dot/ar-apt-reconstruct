import { useEffect, useState } from "react";
import { EmptyPhoto } from "./EmptyPhoto";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export type StagePhotoSources = {
  webpUrl: string;
  avifUrl?: string | null;
};

type PhotoStageProps = {
  sources: StagePhotoSources | null;
  alt: string;
  emptyLabel?: string;
};

export function PhotoStage({ sources, alt, emptyLabel }: PhotoStageProps) {
  const reducedMotion = usePrefersReducedMotion();
  const url = sources?.webpUrl ?? null;
  const avifUrl = sources?.avifUrl ?? null;

  const [activeSources, setActiveSources] = useState<StagePhotoSources | null>(
    sources,
  );
  const [outgoingSources, setOutgoingSources] =
    useState<StagePhotoSources | null>(null);
  const [outgoingVisible, setOutgoingVisible] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);

    if (!sources?.webpUrl) {
      setActiveSources(null);
      setOutgoingSources(null);
      setOutgoingVisible(false);
      return;
    }

    if (
      sources.webpUrl === activeSources?.webpUrl &&
      sources.avifUrl === activeSources?.avifUrl
    ) {
      return;
    }

    if (reducedMotion || !activeSources?.webpUrl) {
      setActiveSources(sources);
      setOutgoingSources(null);
      setOutgoingVisible(false);
      return;
    }

    setOutgoingSources(activeSources);
    setOutgoingVisible(true);
    setActiveSources(sources);
  }, [sources, activeSources, reducedMotion]);

  useEffect(() => {
    if (!outgoingSources?.webpUrl || !outgoingVisible) return;
    const fadeMs = reducedMotion ? 0 : 480;
    const hideId = window.setTimeout(() => setOutgoingVisible(false), 30);
    const clearId = window.setTimeout(() => setOutgoingSources(null), fadeMs + 30);
    return () => {
      window.clearTimeout(hideId);
      window.clearTimeout(clearId);
    };
  }, [outgoingSources, outgoingVisible, reducedMotion]);

  const display = activeSources ?? sources;

  if (!url || broken || !display?.webpUrl) {
    return <EmptyPhoto label={emptyLabel} />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-ink-950" data-testid="photo-stage">
      <picture key={`active-${display.webpUrl}`} className="absolute inset-0 block">
        {display.avifUrl ? (
          <source type="image/avif" srcSet={display.avifUrl} />
        ) : avifUrl ? (
          <source type="image/avif" srcSet={avifUrl} />
        ) : null}
        <source type="image/webp" srcSet={display.webpUrl} />
        <img
          src={display.webpUrl}
          alt={alt}
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setBroken(true)}
        />
      </picture>

      {outgoingSources?.webpUrl ? (
        <picture
          key={`outgoing-${outgoingSources.webpUrl}`}
          className={`absolute inset-0 block transition-opacity duration-crossfade ease-out ${
            outgoingVisible ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        >
          {outgoingSources.avifUrl ? (
            <source type="image/avif" srcSet={outgoingSources.avifUrl} />
          ) : null}
          <source type="image/webp" srcSet={outgoingSources.webpUrl} />
          <img
            src={outgoingSources.webpUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        </picture>
      ) : null}

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/55 via-transparent to-ink-950/25"
        aria-hidden
      />
    </div>
  );
}
