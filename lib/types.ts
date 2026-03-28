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
  page_count: number;
  created_at: string;
  updated_at: string;
};

export type NoteRead = {
  id: string;
  title: string;
  summary: string;
  content: string;
  note_json: NoteJson | null;
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
  accuracy: number;
  coverage: number;
  clarity: number;
  examples: number;
  feedback: string;
  strengths: string[];
  gaps: string[];
} & Record<string, unknown>;

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
