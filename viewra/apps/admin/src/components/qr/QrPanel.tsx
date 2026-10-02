import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { tourUrl } from "@/lib/utils";

type Props = {
  publicId: string;
  title?: string;
};

export function QrPanel({ publicId, title }: Props) {
  const url = tourUrl(publicId);
  const [dataUrl, setDataUrl] = useState("");
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function generate() {
      const [png, svgMarkup] = await Promise.all([
        QRCode.toDataURL(url, {
          width: 360,
          margin: 2,
          color: { dark: "#0F1419", light: "#FBF7F0" },
        }),
        QRCode.toString(url, {
          type: "svg",
          margin: 2,
          color: { dark: "#0F1419", light: "#FBF7F0" },
        }),
      ]);
      if (!cancelled) {
        setDataUrl(png);
        setSvg(svgMarkup);
      }
    }
    void generate();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const download = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
  };

  const downloadSvg = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    download(href, `viewra-${publicId}.svg`);
    URL.revokeObjectURL(href);
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="panel max-w-xl p-6">
      <h3 className="font-display text-2xl">Tour QR</h3>
      <p className="mt-1 text-sm text-ink-muted">
        {title ? `${title} · ` : ""}
        Scan to open the public walkthrough.
      </p>

      <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="rounded-2xl border border-line bg-cream-soft p-4 shadow-soft">
          {dataUrl ? (
            <img src={dataUrl} alt="Tour QR code" className="h-56 w-56" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-sm text-ink-muted">
              Generating…
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="label">Public URL</p>
            <code className="block break-all rounded-lg border border-line bg-white/60 px-3 py-2 text-xs">
              {url}
            </code>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={copyUrl}>
              {copied ? "Copied" : "Copy URL"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!dataUrl}
              onClick={() => download(dataUrl, `viewra-${publicId}.png`)}
            >
              Download PNG
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!svg}
              onClick={downloadSvg}
            >
              Download SVG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
