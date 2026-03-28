export type ReaderSection = {
  id: string;
  label: string;
  title: string;
  preview: string;
  paragraphs: string[];
};

const SENTENCE_END_RE = /(?<=[.!?])\s+/;

export function buildReaderSections(text: string): ReaderSection[] {
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
    });
  }

  return sections;
}
