"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { Page } from "react-pdf";

type LazyPdfPageProps = {
  eager?: boolean;
  pageNumber: number;
  renderInteractiveLayers?: boolean;
  scrollRoot: RefObject<HTMLElement | null>;
  width: number;
};

export function LazyPdfPage({
  eager = false,
  pageNumber,
  renderInteractiveLayers = true,
  scrollRoot,
  width,
}: LazyPdfPageProps) {
  const markerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(eager);
  const [hasRendered, setHasRendered] = useState(false);

  useEffect(() => {
    if (shouldRender) return;

    const marker = markerRef.current;
    const root = scrollRoot.current;
    if (!marker || !root || typeof IntersectionObserver === "undefined") {
      const frameId = window.requestAnimationFrame(() => setShouldRender(true));
      return () => window.cancelAnimationFrame(frameId);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      {
        root,
        rootMargin: "320px 0px",
        threshold: 0.01,
      },
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [scrollRoot, shouldRender]);

  const estimatedHeight = Math.round(width * 1.414);

  return (
    <div
      ref={markerRef}
      className="lazy-pdf-page"
      style={hasRendered ? undefined : { minHeight: estimatedHeight }}
    >
      {shouldRender ? (
        <Page
          pageNumber={pageNumber}
          width={width}
          renderAnnotationLayer={renderInteractiveLayers}
          renderTextLayer={renderInteractiveLayers}
          onRenderSuccess={() => setHasRendered(true)}
          loading={<div className="lazy-pdf-page-placeholder">Rendering page {pageNumber}…</div>}
        />
      ) : (
        <div className="lazy-pdf-page-placeholder" aria-hidden="true">
          Page {pageNumber}
        </div>
      )}
    </div>
  );
}
