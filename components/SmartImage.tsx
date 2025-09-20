// components/SmartImage.tsx
import React, { useState, useEffect, useRef } from "react";

type SmartImageProps = {
  src: string;            // Firebase URL, site-relative, vagy ideiglenesen data:/blob:
  srcAvif?: string;
  srcWebp?: string;
  alt: string;
  widths?: number[];
  sizes?: string;
  width?: number;
  height?: number;
  className?: string;
  placeholderSrc?: string;
  lazy?: boolean;
};

function isCdnEligible(u: string) {
  if (!u) return false;
  if (u.startsWith("data:")) return false;
  if (u.startsWith("blob:")) return false;
  if (u.startsWith("/")) return true; // site-relative
  return u.startsWith("http://") || u.startsWith("https://");
}

function toNetlifyCdnUrl(rawUrl: string, w?: number) {
  const base = "/.netlify/images";
  const p = new URLSearchParams();
  p.set("url", rawUrl);
  if (w && Number.isFinite(w)) p.set("w", String(w));
  p.set("fit", "cover");
  p.set("q", "75");
  return `${base}?${p.toString()}`;
}

/** Prodban CDN-t használunk, de csak CDN-kompatibilis URL-re (http/https vagy /...). */
function useCdnEnabled(src: string) {
  if (!isCdnEligible(src)) return false;
  if (import.meta.env.PROD) return true;
  const flag = import.meta.env?.VITE_USE_NETLIFY_IMAGE_CDN;
  return String(flag).toLowerCase() === "true";
}

export default function SmartImage({
  src,
  srcAvif,
  srcWebp,
  alt,
  widths = [320, 480, 640, 960, 1280],
  sizes = "(max-width: 640px) 100vw, 50vw",
  width,
  height,
  className,
  placeholderSrc,
  lazy = true,
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const ref = useRef<HTMLDivElement | null>(null);
  const cdnOn = useCdnEnabled(src);

  useEffect(() => {
    if (!lazy || inView) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lazy, inView]);

  function buildSrcset(u: string) {
    return widths.map((w) => `${cdnOn ? toNetlifyCdnUrl(u, w) : u} ${w}w`).join(", ");
  }

  const actualSrc = cdnOn ? toNetlifyCdnUrl(src, width) : src;

  // Debug: nézd a böngésző konzolt
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log("[SmartImage]", { cdnOn, src, actualSrc });
    }
  }, [cdnOn, src, actualSrc]);

  const img = (
    <img
      src={actualSrc}
      srcSet={buildSrcset(src)}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={lazy ? "lazy" : "eager"}
      decoding="async"
      onLoad={() => setLoaded(true)}
      style={{
        display: "block",
        width: width ? `${width}px` : "100%",
        height: height ? `${height}px` : "auto",
      }}
      className={className}
    />
  );

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        overflow: "hidden",
        width: width ? `${width}px` : "100%",
        height: height ? `${height}px` : "auto",
      }}
    >
      {placeholderSrc && !loaded && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            filter: "blur(12px)",
            transform: "scale(1.05)",
            objectFit: "cover",
            width: "100%",
            height: "100%",
          }}
        />
      )}

      {inView ? (
        srcAvif || srcWebp ? (
          <picture>
            {srcAvif && <source type="image/avif" srcSet={buildSrcset(srcAvif)} sizes={sizes} />}
            {srcWebp && <source type="image/webp" srcSet={buildSrcset(srcWebp)} sizes={sizes} />}
            {img}
          </picture>
        ) : (
          img
        )
      ) : (
        <div
          style={{
            background: "#f1f1f1",
            width: width ? `${width}px` : "100%",
            height: height ? `${height}px` : "200px",
          }}
        />
      )}
    </div>
  );
}
