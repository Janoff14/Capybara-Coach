import type { ReaderGuideView } from "@/lib/document-reader";

export type RecallPrompt = {
  id: string;
  label: string;
  prompt: string;
};

export function buildRecallPrompts(
  documentTitle: string,
  guide: ReaderGuideView,
): RecallPrompt[] {
  const prompts: RecallPrompt[] = [];
  const safeTitle = documentTitle.trim() || "this document";
  const leadSentence = guide.importantSentences[0];
  const firstSection = guide.sections[0];
  const secondSection = guide.sections[1];
  const firstKeyTerm = guide.keyTerms[0];
  const secondKeyTerm = guide.keyTerms[1];

  prompts.push({
    id: "summary",
    label: "Warm-up",
    prompt: leadSentence
      ? `Open with the main idea behind ${safeTitle}, then say it back in your own words instead of repeating this sentence: "${leadSentence}"`
      : `Open by summarizing ${safeTitle} in one clean sentence before you add detail.`,
  });

  if (firstSection) {
    prompts.push({
      id: "structure",
      label: "Structure",
      prompt: secondSection
        ? `Walk through the document from "${firstSection.title}" to "${secondSection.title}" and explain how the ideas connect.`
        : `Explain why the section "${firstSection.title}" matters and what the reader should understand from it.`,
    });
  }

  if (firstKeyTerm) {
    prompts.push({
      id: "definition",
      label: "Precision",
      prompt: secondKeyTerm
        ? `Define "${firstKeyTerm.term}" clearly, then connect it to "${secondKeyTerm.term}" without looking back at the source.`
        : `Define "${firstKeyTerm.term}" clearly, then explain why it matters in the larger argument.`,
    });
  }

  prompts.push({
    id: "close",
    label: "Close",
    prompt:
      "Finish by naming the two or three points someone must remember after hearing your explanation.",
  });

  return prompts.slice(0, 4);
}

export function buildRecallChecklist(guide: ReaderGuideView) {
  const checklist = [
    "Speak from memory first. If you stumble, keep going instead of restarting immediately.",
    "Cover the core idea, then move through the major sections in a logical order.",
  ];

  if (guide.keyTerms.length > 0) {
    checklist.push(
      `Make sure you can define at least ${Math.min(2, guide.keyTerms.length)} important term${guide.keyTerms.length > 1 ? "s" : ""} precisely.`,
    );
  }

  checklist.push("End with the takeaway, not with filler.");
  return checklist;
}
