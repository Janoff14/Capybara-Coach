import type { NoteRead } from "@/lib/types";

export type FormattedNoteSection = {
  id: string;
  index?: string;
  title: string;
  paragraphs: string[];
  bullets: string[];
};

export type FormattedNoteBlock =
  | { type: "paragraph"; id: string; text: string }
  | { type: "list"; id: string; items: string[] };

export type FormattedNote = {
  sections: FormattedNoteSection[];
  blocks: FormattedNoteBlock[];
  takeaways: string[];
  reviewQuestions: string[];
};

type RawNoteSection = {
  heading?: unknown;
  title?: unknown;
  body?: unknown;
  content?: unknown;
  bullets?: unknown;
};

const NUMBERED_SECTION_RE = /^(\d+)\.\s+(.+?)(?::\s*(.*))?$/;
const HEADING_RE = /^#{1,3}\s+(.+)$/;
const BULLET_RE = /^[-*]\s+(.+)$/;
const ORDERED_RE = /^\d+\.\s+(.+)$/;

export function formatNote(note: NoteRead): FormattedNote {
  const noteJson = note.note_json ?? {};
  const jsonSections = normalizeSections((noteJson as { sections?: unknown }).sections);
  const takeaways = readStringArray((noteJson as { key_takeaways?: unknown }).key_takeaways);
  const reviewQuestions = readStringArray(
    (noteJson as { review_questions?: unknown }).review_questions,
  );

  if (jsonSections.length > 0) {
    return {
      sections: jsonSections,
      blocks: [],
      takeaways:
        takeaways.length > 0
          ? takeaways
          : jsonSections.map((section) => section.title).slice(0, 4),
      reviewQuestions,
    };
  }

  return parseLegacyContent(note.content, takeaways, reviewQuestions);
}

function normalizeSections(value: unknown): FormattedNoteSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const section = entry as RawNoteSection;
    const title = String(section.heading ?? section.title ?? "").trim();
    const body = String(section.body ?? section.content ?? "").trim();
    const bullets = readStringArray(section.bullets);

    if (!title && !body && bullets.length === 0) {
      return [];
    }

    return [
      {
        id: `json-section-${index}`,
        index: `${index + 1}`,
        title: title || `Section ${index + 1}`,
        paragraphs: body ? splitParagraphs(body) : [],
        bullets,
      },
    ];
  });
}

function parseLegacyContent(
  content: string,
  seededTakeaways: string[],
  reviewQuestions: string[],
): FormattedNote {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return {
      sections: [],
      blocks: [],
      takeaways: seededTakeaways,
      reviewQuestions,
    };
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const sections: FormattedNoteSection[] = [];
  const looseBlocks: FormattedNoteBlock[] = [];
  const derivedTakeaways: string[] = [];

  blocks.forEach((block, index) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return;
    }

    const firstLine = lines[0];
    const numberedMatch = firstLine.match(NUMBERED_SECTION_RE);
    if (numberedMatch) {
      const paragraphs = [
        numberedMatch[3]?.trim() ?? "",
        ...lines.slice(1),
      ].filter(Boolean);

      sections.push({
        id: `numbered-section-${index}`,
        index: numberedMatch[1],
        title: numberedMatch[2].trim(),
        paragraphs,
        bullets: [],
      });
      derivedTakeaways.push(numberedMatch[2].trim());
      return;
    }

    const headingMatch = firstLine.match(HEADING_RE);
    if (headingMatch) {
      const remainingLines = lines.slice(1);
      const bulletItems = extractBulletItems(remainingLines);
      const paragraphs = bulletItems.length > 0 ? [] : remainingLines;

      sections.push({
        id: `heading-section-${index}`,
        title: headingMatch[1].trim(),
        paragraphs,
        bullets: bulletItems,
      });
      derivedTakeaways.push(headingMatch[1].trim());
      return;
    }

    const bulletItems = extractBulletItems(lines);
    if (bulletItems.length === lines.length) {
      looseBlocks.push({
        type: "list",
        id: `list-block-${index}`,
        items: bulletItems,
      });
      derivedTakeaways.push(...bulletItems.slice(0, 2));
      return;
    }

    looseBlocks.push({
      type: "paragraph",
      id: `paragraph-block-${index}`,
      text: lines.join(" "),
    });
  });

  const takeaways =
    seededTakeaways.length > 0
      ? seededTakeaways
      : dedupeStrings(derivedTakeaways).slice(0, 5);

  return {
    sections,
    blocks: looseBlocks,
    takeaways,
    reviewQuestions,
  };
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .filter(Boolean);
}

function extractBulletItems(lines: string[]): string[] {
  return lines
    .map((line) => {
      const bulletMatch = line.match(BULLET_RE) ?? line.match(ORDERED_RE);
      return bulletMatch ? bulletMatch[1].trim() : "";
    })
    .filter(Boolean);
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
