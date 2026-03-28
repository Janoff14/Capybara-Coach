import type {
  ReaderGuideJson,
  ReaderGuideSection,
  ReaderHighlight,
  ReaderHighlightType,
  ReaderKeyTerm,
} from "@/lib/types";

export type ReaderSection = {
  id: string;
  label: string;
  title: string;
  preview: string;
  paragraphs: string[];
  summaryBullets: string[];
  highlights: ReaderHighlight[];
};

export type ReaderGuideView = {
  sections: ReaderSection[];
  keyTerms: ReaderKeyTerm[];
  importantSentences: string[];
};

type NormalizedGuideSection = {
  heading: string;
  summaryBullets: string[];
  highlights: ReaderHighlight[];
};

const SENTENCE_END_RE = /(?<=[.!?])\s+/;

export function buildReaderGuide(
  text: string,
  readerJson: ReaderGuideJson | null | undefined,
): ReaderGuideView {
  const baseSections = buildBaseSections(text);
  const guideSections = normalizeGuideSections(readerJson?.sections);

  const sections = baseSections.map((section, index) => {
    const guideSection = guideSections[index];
    return {
      ...section,
      title: guideSection?.heading || section.title,
      preview: guideSection?.summaryBullets?.[0] || section.preview,
      summaryBullets:
        guideSection?.summaryBullets?.length
          ? guideSection.summaryBullets
          : buildFallbackSummary(section.paragraphs),
      highlights: guideSection?.highlights ?? buildFallbackHighlights(section.paragraphs),
    };
  });

  return {
    sections,
    keyTerms: normalizeKeyTerms(readerJson?.key_terms),
    importantSentences: normalizeStringArray(readerJson?.important_sentences),
  };
}

export function estimateReadingMinutes(text: string) {
  const wordCount = text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  if (wordCount === 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(wordCount / 220));
}

export function splitParagraphIntoSentences(paragraph: string) {
  return paragraph
    .split(SENTENCE_END_RE)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function resolveSentenceHighlight(
  sentence: string,
  highlights: ReaderHighlight[],
): ReaderHighlightType | null {
  const normalizedSentence = normalizeText(sentence);
  for (const highlight of highlights) {
    const normalizedHighlight = normalizeText(highlight.text);
    if (
      normalizedHighlight &&
      normalizedSentence &&
      (normalizedSentence.includes(normalizedHighlight) ||
        normalizedHighlight.includes(normalizedSentence))
    ) {
      return highlight.type;
    }
  }

  return null;
}

function buildBaseSections(text: string): ReaderSection[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n+/g, " ").trim())
    .filter(Boolean);

  const sections: ReaderSection[] = [];
  let currentTitle = "Opening ideas";
  let currentParagraphs: string[] = [];
  let sectionIndex = 1;

  const flushSection = () => {
    if (currentParagraphs.length === 0) {
      return;
    }

    sections.push({
      id: `reader-section-${sectionIndex}`,
      label: `Section ${sectionIndex}`,
      title: currentTitle,
      preview: buildPreview(currentParagraphs),
      paragraphs: currentParagraphs,
      summaryBullets: buildFallbackSummary(currentParagraphs),
      highlights: buildFallbackHighlights(currentParagraphs),
    });

    sectionIndex += 1;
    currentParagraphs = [];
  };

  for (const block of blocks) {
    if (looksLikeHeading(block)) {
      flushSection();
      currentTitle = normalizeHeading(block);
      continue;
    }

    currentParagraphs.push(block);

    if (currentParagraphs.length >= 4 && block.length > 420) {
      flushSection();
      currentTitle = `Key idea ${sectionIndex}`;
    }
  }

  flushSection();

  if (sections.length <= 1 && blocks.length >= 5) {
    return chunkDenseContent(blocks);
  }

  return sections;
}

function normalizeGuideSections(value: ReaderGuideSection[] | undefined): NormalizedGuideSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section) => ({
      heading: String(section.heading || "").trim(),
      summaryBullets: normalizeStringArray(section.summary_bullets).slice(0, 4),
      highlights: normalizeHighlights(section.highlights),
    }))
    .filter(
      (section) =>
        section.heading || section.summaryBullets.length > 0 || section.highlights.length > 0,
    );
}

function normalizeKeyTerms(value: ReaderGuideJson["key_terms"]): ReaderKeyTerm[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      term: String(item.term || "").trim(),
      definition: String(item.definition || "").trim(),
    }))
    .filter((item) => item.term && item.definition)
    .slice(0, 8);
}

function normalizeHighlights(value: ReaderGuideSection["highlights"]): ReaderHighlight[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      type: item.type,
      text: String(item.text || "").trim(),
    }))
    .filter((item) => item.text)
    .slice(0, 6);
}

function normalizeStringArray(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function looksLikeHeading(block: string) {
  const trimmed = block.trim();
  if (!trimmed || trimmed.length > 80) {
    return false;
  }

  if (/[.!?]$/.test(trimmed)) {
    return false;
  }

  const words = trimmed.split(/\s+/);
  if (words.length > 9) {
    return false;
  }

  const lowerWords = words.filter((word) => /^[a-z]/.test(word));
  return lowerWords.length <= 1;
}

function normalizeHeading(block: string) {
  return block
    .replace(/^[\d.\-)\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPreview(paragraphs: string[]) {
  const firstSentence = paragraphs
    .join(" ")
    .split(SENTENCE_END_RE)
    .find((sentence) => sentence.trim().length > 0);

  const preview = (firstSentence ?? paragraphs[0] ?? "").trim();
  if (preview.length <= 148) {
    return preview;
  }

  return `${preview.slice(0, 145).trimEnd()}...`;
}

function chunkDenseContent(blocks: string[]): ReaderSection[] {
  const sections: ReaderSection[] = [];

  for (let index = 0; index < blocks.length; index += 3) {
    const paragraphs = blocks.slice(index, index + 3);
    const sectionNumber = Math.floor(index / 3) + 1;
    sections.push({
      id: `reader-section-${sectionNumber}`,
      label: `Section ${sectionNumber}`,
      title: sectionNumber === 1 ? "Opening ideas" : `Core ideas ${sectionNumber}`,
      preview: buildPreview(paragraphs),
      paragraphs,
      summaryBullets: buildFallbackSummary(paragraphs),
      highlights: buildFallbackHighlights(paragraphs),
    });
  }

  return sections;
}

function buildFallbackSummary(paragraphs: string[]) {
  return paragraphs
    .flatMap((paragraph) => splitParagraphIntoSentences(paragraph))
    .filter((sentence) => sentence.split(/\s+/).length >= 6)
    .slice(0, 3);
}

function buildFallbackHighlights(paragraphs: string[]): ReaderHighlight[] {
  const sentences = paragraphs
    .flatMap((paragraph) => splitParagraphIntoSentences(paragraph))
    .filter((sentence) => sentence.split(/\s+/).length >= 6)
    .slice(0, 4);

  return sentences.map((sentence) => ({
    type: inferHighlightType(sentence),
    text: sentence,
  }));
}

function inferHighlightType(sentence: string): ReaderHighlightType {
  const lowered = sentence.toLowerCase();
  if (
    lowered.includes(" is ") ||
    lowered.includes(" refers to ") ||
    lowered.includes(" means ") ||
    lowered.includes(" defined as ")
  ) {
    return "definition";
  }

  if (
    lowered.includes("for example") ||
    lowered.includes("for instance") ||
    lowered.includes("such as") ||
    lowered.includes("e.g.")
  ) {
    return "example";
  }

  return "key_idea";
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}
