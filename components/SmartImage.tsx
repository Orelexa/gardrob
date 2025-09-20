// components/SmartImage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useImageQueue } from "../lib/useImageQueue";

/**
 * SmartImage
 * - Láthatóság alapján lazy-load (IntersectionObserver)
 * - Limitált párhuzamosítás (useImageQueue)
 * - Netlify Image CDN használata akár lokálban is, ha megadod a VITE_NETLIFY_BASE-t
 *   Példa: VITE_NETLIFY_BASE=https://orelexagardrob.netlify.app
 */
type Props = {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  priority?: boolean; // ha true: nem lazy
};

function buildCdnUrl(raw: string, w?: number, h?: number) {
  // csak a Firebasestorage-ot éri meg CDN-re küldeni
  const isFirebase = /firebasestorage\.googleapis\.com/i.test(raw);
  const base = (import.meta as any).env.VITE_NETLIFY_BASE as string | undefined; // pl. https://orelexagardrob.netlify.app
  if (!isFirebase || !base) return raw;

  const params = new URLSearchParams();
  params.set("url", raw);
  if (w) params.set("w", String(w));
  if (h) params.set("h", String(h));
  params.set("fit", "cover");
  params.set("q", "75");
  params.set("fm", "webp");

  return `${base.replace(/\/$/, "")}/.netlify/images?${params.toString()}`;
}

export default function SmartImage({
  src,
  alt = "",
  className,
  style,
  width,
  height,
  fit = "cover",
  priority = false,
}: Props) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [visible, setVisible] = useState<boolean>(priority);
  const [finalSrc, setFinalSrc] = useState<string>("");
  const { load } = useImageQueue(6);

  const targetUrl = useMemo(() => buildCdnUrl(src, width, height), [src, width, height]);

  // Láthatóság figyelés (ha nem priority)
  useEffect(() => {
    if (priority) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [priority]);

  useEffect(() => {
    let aborted = false;
    if (!visible) return;

    load(targetUrl)
      .then((url) => {
        if (!aborted) setFinalSrc(url);
      })
      .catch(() => {
        if (!aborted) setFinalSrc(src); // fallback az eredetire
      });

    return () => {
      aborted = true;
    };
  }, [visible, targetUrl, src, load]);

  return (
    <img
      ref={ref}
      src={finalSrc || undefined}
      alt={alt}
      className={className}
      style={{ objectFit: fit, width, height, ...style }}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? ("high" as any) : ("auto" as any)}
    />
  );
}
