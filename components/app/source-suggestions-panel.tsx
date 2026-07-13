"use client";

import { useMemo, useState } from "react";
import { ExternalLink, LibraryBig, LoaderCircle, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { OperationProgress } from "@/components/app/operation-progress";
import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import type { SourceSuggestionRead } from "@/lib/types";

type SourceSuggestionsPanelProps = {
  documentId?: string | null;
  initialTopic?: string;
  mode: "catalog" | "document";
};

export function SourceSuggestionsPanel({
  documentId,
  initialTopic = "",
  mode,
}: SourceSuggestionsPanelProps) {
  const { token } = useAuth();
  const [topic, setTopic] = useState(mode === "document" ? "" : initialTopic);
  const [suggestions, setSuggestions] = useState<SourceSuggestionRead[]>([]);
  const [isPending, setIsPending] = useState(false);
  const trimmedTopic = topic.trim();
  const canSearch = Boolean(token && (documentId || trimmedTopic));
  const title = mode === "document" ? "Find adjacent readings" : "Find reading sources";
  const description = mode === "document"
    ? "Ask the study desk for related papers and open-access sources based on this document."
    : "Search for additional readings before deciding what deserves a place in the catalog.";
  const suggestedLabel = useMemo(
    () => suggestions.length === 1 ? "1 source found" : `${suggestions.length} sources found`,
    [suggestions.length],
  );

  const findSources = async () => {
    if (!token) {
      toast.error("Sign in before finding sources.");
      return;
    }
    if (!documentId && !trimmedTopic) {
      toast.error("Add a topic first.");
      return;
    }

    setIsPending(true);
    try {
      const nextSuggestions = await api.getSourceSuggestions(token, {
        document_id: documentId ?? undefined,
        topic: trimmedTopic || undefined,
        limit: 5,
      });
      setSuggestions(nextSuggestions);
      if (nextSuggestions.length === 0) {
        toast.message("No source matches yet. Try a more specific topic.");
      } else {
        toast.success("Source suggestions ready.");
      }
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error
        ? error.message
        : "Could not find sources.";
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <section className={mode === "document" ? "source-scout is-document" : "source-scout"}>
      <div className="source-scout-intro">
        <span><Sparkles aria-hidden="true" /> On demand</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="source-scout-controls">
        <label htmlFor={`source-topic-${mode}`}>
          {mode === "document" ? "Optional focus" : "Topic"}
        </label>
        <div>
          <Search aria-hidden="true" />
          <input
            id={`source-topic-${mode}`}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder={mode === "document" ? initialTopic || "Narrow this document's topic..." : "e.g. retrieval practice, neural networks"}
          />
          <button type="button" onClick={findSources} disabled={!canSearch || isPending}>
            {isPending ? <LoaderCircle className="reader-spin" aria-hidden="true" /> : <LibraryBig aria-hidden="true" />}
            Find sources
          </button>
        </div>
      </div>

      {isPending ? (
        <OperationProgress
          compact
          label="Finding sources"
          detail="Searching scholarly metadata and checking usable links."
        />
      ) : null}

      {suggestions.length > 0 ? (
        <div className="source-scout-results">
          <header>
            <span>{suggestedLabel}</span>
            <small>Review first. Add-to-library comes next.</small>
          </header>
          <div>
            {suggestions.map((source) => (
              <article key={`${source.id}-${source.url}`} className="source-scout-card">
                <div>
                  <span>{source.source_type.replaceAll("-", " ")}{source.year ? ` / ${source.year}` : ""}</span>
                  <h3>{source.title}</h3>
                  <p>{source.abstract ?? source.reason}</p>
                </div>
                <footer>
                  <span>{source.authors.slice(0, 2).join(", ") || source.source_name || "Source"}</span>
                  <span>{source.is_open_access ? "Open access" : `${source.cited_by_count} citations`}</span>
                  <a href={source.open_access_url ?? source.url} target="_blank" rel="noreferrer">
                    Open <ExternalLink aria-hidden="true" />
                  </a>
                </footer>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
