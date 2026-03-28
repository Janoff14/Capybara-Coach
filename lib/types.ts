export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type DocumentRead = {
  id: string;
  title: string;
  original_filename: string;
  content_type: string | null;
  source_type: string;
  storage_bucket: string;
  storage_path: string;
  extracted_text: string;
  reader_json: ReaderGuideJson | null;
  page_count: number;
  created_at: string;
  updated_at: string;
};

export type ReaderHighlightType = "key_idea" | "definition" | "example";

export type ReaderHighlight = {
  type: ReaderHighlightType;
  text: string;
};

export type ReaderGuideSection = {
  heading: string;
  summary_bullets?: string[];
  highlights?: ReaderHighlight[];
};

export type ReaderKeyTerm = {
  term: string;
  definition: string;
};

export type ReaderGuideJson = {
  key_terms?: ReaderKeyTerm[];
  important_sentences?: string[];
  sections?: ReaderGuideSection[];
} & Record<string, unknown>;

export type NoteRead = {
  id: string;
  title: string;
  summary: string;
  content: string;
  note_json: NoteJson | null;
  created_at: string;
  updated_at: string;
};

export type FlashcardRead = {
  id: string;
  study_session_id: string;
  note_id: string | null;
  document_id: string;
  document_title: string;
  order_index: number;
  question: string;
  answer: string;
  cue: string | null;
  card_type: string;
  source_focus: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteSection = {
  heading: string;
  body?: string;
  bullets?: string[];
};

export type NoteJson = {
  key_takeaways?: string[];
  review_questions?: string[];
  sections?: NoteSection[];
} & Record<string, unknown>;

export type AssessmentJson = {
  score: number;
  strictness: number;
  verdict: string;
  criteria: {
    coverage: number;
    accuracy: number;
    clarity: number;
    structure: number;
    depth: number;
  };
  covered_well: string[];
  missing: string[];
  weak_areas: string[];
  next_steps: string[];
  accuracy: number;
  coverage: number;
  clarity: number;
  structure: number;
  depth: number;
  examples: number;
  feedback: string;
  strengths: string[];
  gaps: string[];
} & Record<string, unknown>;

export type RecallHintRead = {
  state: "hint" | "encouraging";
  prompt_type: "recall" | "depth" | "connection";
  message: string;
  missing_concepts: string[];
  transcript_excerpt: string;
  transcript_so_far: string;
  source: "ai" | "fallback";
  debug_reason?: string | null;
};

export type StudySessionRead = {
  id: string;
  document_id: string;
  status: string;
  audio_filename: string | null;
  audio_content_type: string | null;
  audio_storage_bucket: string | null;
  audio_storage_path: string | null;
  transcript_text: string | null;
  transcript_provider: string | null;
  assessment_score: number | null;
  assessment_feedback: string | null;
  assessment_json: AssessmentJson | null;
  note: NoteRead | null;
  created_at: string;
  updated_at: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  display_name: string;
  email: string;
  password: string;
};

export type UploadDocumentInput = {
  file: File;
  title?: string;
};
