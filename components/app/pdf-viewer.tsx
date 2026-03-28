"use client";

import { useEffect, useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PdfViewer({
  blob,
  isLoading,
  error,
  title,
}: {
  blob: Blob | null;
  isLoading: boolean;
  error: string | null;
  title: string;
}) {
  const blobUrl = useMemo(() => {
    if (!blob) {
      return null;
    }

    return URL.createObjectURL(blob);
  }, [blob]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Read the source directly in the browser, then finish reading when you are ready to explain it back.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-[70vh] items-center justify-center rounded-2xl border border-dashed border-[rgba(194,200,190,0.5)] bg-[var(--panel-soft)] text-[var(--muted-foreground)]">
            Preparing your PDF preview...
          </div>
        ) : error ? (
          <div className="flex h-[70vh] items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-500/10 px-6 text-center text-sm text-rose-100">
            {error}
          </div>
        ) : blobUrl ? (
          <iframe
            title={title}
            src={blobUrl}
            className="h-[70vh] w-full rounded-2xl border border-[var(--border-soft)] bg-white"
          />
        ) : (
          <div className="flex h-[70vh] items-center justify-center rounded-2xl border border-dashed border-[rgba(194,200,190,0.5)] bg-[var(--panel-soft)] text-[var(--muted-foreground)]">
            No PDF preview is available for this document.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
