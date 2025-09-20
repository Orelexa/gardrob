import React, { useState, useEffect, useRef } from "react";

type SmartImageProps = {
  /** Az alap (fallback) kép URL-je (lehet remote is) */
  src: string;
  /** AVIF és WebP alternatívák (opcionális, ha van ilyen URL-ed) */
  srcAvif?: string;
  srcWebp?: string;
  /** Kötelező alt a hozzáférhetőség miatt */
  alt: string;
  /** Szélességi töréspontok a srcsethez (px) – kisebb képernyő, kisebb fájl */
  widths?: number[];
  /** sizes attribútum – mondd meg, kb. mekkora helyen jelenik meg */
  sizes?: string;
  /** Fix méretek a layout shift elkerülésére (erősen ajánlott) */
  width?: number;
  height?: number;
  /** Kerekítés, illesztés stb. – továbbadjuk a className-t */
  className?: string;
  /** LQIP / blur placeholder (data URL vagy kis kép URL-je) */
  placeholderSrc?: string;
  /** Ha true, csak akkor töltjük a „nagy” képet, ha tényleg látszik */
  lazy?: boolean;
};

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

  // Egyszerű IntersectionObserver – csak akkor kezdünk tölteni, ha látszik
  useEffect(() => {
    if (!lazy || inView) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { rootMargin: "200px" } // előtöltés kicsivel korábban
    );
    io.observe(el);
    return () => io.disconnect();
  }, [lazy, inView]);

  // Készítsünk egyszerű srcsetet ugyanazzal az alappal, ha az URL végén méretfüggetlen fájl van.
  // Ha CDN-ed tud méretezni (pl. query paramokkal), itt állítsd össze a megfelelő URL-eket.
  function buildSrcset(u: string) {
    // Alapeset: ugyanazt az URL-t adja vissza, mert nincs szerver oldali méretezés.
    // Ha van méretező szolgáltatásod, IDE illeszd be (pl. u + `?w=${w}`)
    return widths.map((w) => `${u} ${w}w`).join(", ");
  }

  const img = (
    <img
      src={src}
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
      {/* Placeholder (elmosott kis kép) – amíg a nagy nem jön le */}
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

      {/* Modern formátumok <picture>-rel (ha megadtad az URL-t) */}
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
        // Ha még nem látszik és lazy, foglaljuk a helyet (layout shift elkerülése)
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
