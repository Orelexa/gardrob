// components/CdnRewriter.tsx
import { useEffect } from "react";

function isEligible(url: string) {
  if (!url) return false;
  if (url.startsWith("data:")) return false;
  if (url.startsWith("blob:")) return false;
  return true; // bármi más mehet CDN-re (majd normalizáljuk)
}

function normalizeUrl(u: string) {
  try {
    // Relatív útból (pl. "img.png" vagy "assets/x.png") teljes URL lesz
    if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("/")) return u;
    return new URL(u, window.location.origin).toString();
  } catch {
    return u;
  }
}

function toCdn(url: string, widthHint?: number) {
  const params = new URLSearchParams();
  params.set("url", url); // Netlify belül kódolja
  if (widthHint && Number.isFinite(widthHint)) params.set("w", String(widthHint));
  params.set("fit", "cover");
  params.set("q", "75");
  return `/.netlify/images?${params.toString()}`;
}

/**
 * Production módban végigmegy az összes <img>-en:
 * - ha még nem CDN-es és a forrás alkalmas (nem data:/blob:), átírja CDN-re
 * - relatív utat abszolútra normalizál, hogy a CDN tudja kezelni
 * - dinamikusan bekerülő képeket is figyeli (MutationObserver)
 */
export default function CdnRewriter() {
  useEffect(() => {
    if (import.meta.env.DEV) return; // csak élesben dolgozzon

    const rewriteOne = (img: HTMLImageElement) => {
      try {
        if (!img) return;
        const currentRaw = img.getAttribute("src") || "";
        if (!currentRaw) return;
        if (!isEligible(currentRaw)) return;

        const current = normalizeUrl(currentRaw);
        if (current.startsWith("/.netlify/images")) return;

        // eredeti megőrzése (egyszer kell)
        if (!img.getAttribute("data-original-src")) {
          img.setAttribute("data-original-src", current);
        }
        const widthHint = img.width || img.naturalWidth || undefined;
        const cdnUrl = toCdn(current, widthHint);
        img.setAttribute("src", cdnUrl);

        // Egyszerű srcset a gyakori szélességekre
        if (!img.getAttribute("srcset")) {
          const widths = [320, 480, 640, 960, 1280];
          const ss = widths.map((w) => `${toCdn(current, w)} ${w}w`).join(", ");
          img.setAttribute("srcset", ss);
          img.setAttribute("sizes", "(max-width: 640px) 100vw, 50vw");
        }
      } catch {
        /* csendben továbblépünk */
      }
    };

    // induláskor
    Array.from(document.images).forEach(rewriteOne);

    // figyeljük a DOM-ot (dinamikus képek)
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => {
            if (n instanceof HTMLImageElement) rewriteOne(n);
            if (n instanceof HTMLElement) {
              n.querySelectorAll("img").forEach((img) => rewriteOne(img as HTMLImageElement));
            }
          });
        }
        if (m.type === "attributes" && m.target instanceof HTMLImageElement && m.attributeName === "src") {
          rewriteOne(m.target);
        }
      }
    });

    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["src"],
    });

    return () => mo.disconnect();
  }, []);

  return null;
}
