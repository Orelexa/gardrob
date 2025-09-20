// lib/useImageQueue.ts
import { useEffect, useRef, useState } from "react";

/**
 * Egyszerű képletöltő sor: max N párhuzamos kérés, cache-eli a sikereseket.
 */
const CACHE = new Map<string, string>(); // url -> url (vagy dataURL, ha úgy töltenél)
const PENDING = new Set<string>();

export function useImageQueue(concurrency = 6) {
  const queueRef = useRef<Array<() => Promise<void>>>([]);
  const activeRef = useRef(0);
  const [, force] = useState(0);

  function schedule(task: () => Promise<void>) {
    queueRef.current.push(task);
    pump();
  }

  function pump() {
    while (activeRef.current < concurrency && queueRef.current.length) {
      const job = queueRef.current.shift()!;
      activeRef.current++;
      job().finally(() => {
        activeRef.current--;
        force((x) => x + 1); // enyhe „tick”, hogy induljon a következő
        pump();
      });
    }
  }

  useEffect(() => {
    return () => {
      queueRef.current = [];
      activeRef.current = 0;
      PENDING.clear();
    };
  }, []);

  async function load(src: string): Promise<string> {
    if (CACHE.has(src)) return CACHE.get(src)!;
    if (PENDING.has(src)) {
      // már folyamatban – várjunk, amíg a cache-be kerül
      return new Promise<string>((resolve) => {
        const iv = setInterval(() => {
          if (CACHE.has(src)) {
            clearInterval(iv);
            resolve(CACHE.get(src)!);
          }
        }, 30);
      });
    }
    PENDING.add(src);
    return new Promise<string>((resolve, reject) => {
      schedule(async () => {
        try {
          await new Promise<void>((ok, bad) => {
            const img = new Image();
            img.onload = () => ok();
            img.onerror = () => bad(new Error("Image load error"));
            img.decoding = "async";
            img.src = src;
          });
          CACHE.set(src, src);
          resolve(src);
        } catch (e) {
          reject(e);
        } finally {
          PENDING.delete(src);
        }
      });
    });
  }

  return { load };
}
