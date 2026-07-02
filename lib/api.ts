import type {
  AuthUser,
  DocumentRead,
  FlashcardRead,
  LoginInput,
  NoteRead,
  RecallHintRead,
  ReviewScheduleRead,
  RegisterInput,
  StudySessionRead,
  TokenResponse,
  UploadDocumentInput,
  TypedCaptureChunk,
} from "@/lib/types";

const LOCAL_API_BASE_URL = "http://localhost:8000";
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const LONG_REQUEST_TIMEOUT_MS = 120_000;

function resolveApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const candidate =
    configuredUrl ||
    (process.env.NODE_ENV === "development" ? LOCAL_API_BASE_URL : "");

  if (!candidate) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is required for production builds.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidate);
  } catch {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be a valid absolute URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must use http or https.");
  }

  return parsedUrl.toString().replace(/\/+$/, "");
}

const API_BASE_URL = resolveApiBaseUrl();

type RequestOptions = {
  method?: string;
  token?: string;
  body?: BodyInit | null;
  json?: unknown;
  headers?: HeadersInit;
  timeoutMs?: number;
};

type ErrorPayload = {
  detail?: string | { message?: string } | null;
  message?: string | null;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class ApiUnavailableError extends ApiError {
  constructor(message: string, status = 0) {
    super(message, status);
    this.name = "ApiUnavailableError";
  }
}

export function isAuthenticationError(error: unknown) {
  return (
    error instanceof ApiError && (error.status === 401 || error.status === 403)
  );
}

function buildHeaders(token?: string, headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  if (!nextHeaders.has("Accept")) {
    nextHeaders.set("Accept", "application/json");
  }

  return nextHeaders;
}

async function toApiError(response: Response) {
  let message = `Request failed with status ${response.status}.`;

  try {
    const responseText = await response.text();
    const payload = JSON.parse(responseText) as ErrorPayload;
    const detail = payload.detail;

    if (typeof detail === "string" && detail.trim()) {
      message = detail;
    } else if (
      detail &&
      typeof detail === "object" &&
      typeof detail.message === "string" &&
      detail.message.trim()
    ) {
      message = detail.message;
    } else if (typeof payload.message === "string" && payload.message.trim()) {
      message = payload.message;
    }
  } catch {
    message = response.statusText || message;
  }

  if (
    response.status >= 500 ||
    (response.status === 404 && /application not found/i.test(message))
  ) {
    return new ApiUnavailableError(
      "The study service is temporarily unavailable. Please try again shortly.",
      response.status,
    );
  }

  return new ApiError(message, response.status);
}

async function fetchWithTimeout(
  path: string,
  init: RequestInit,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    const message = controller.signal.aborted
      ? "The study service took too long to respond. Please try again."
      : "The study service is unreachable. Check your connection and try again.";

    const unavailableError = new ApiUnavailableError(message);
    unavailableError.cause = error;
    throw unavailableError;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const { body, headers, json, method = "GET", timeoutMs, token } = options;
  const nextHeaders = buildHeaders(token, headers);

  let nextBody = body ?? null;

  if (json !== undefined) {
    nextHeaders.set("Content-Type", "application/json");
    nextBody = JSON.stringify(json);
  }

  const response = await fetchWithTimeout(path, {
    method,
    headers: nextHeaders,
    body: nextBody,
  }, timeoutMs);

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestBlob(path: string, options: RequestOptions = {}) {
  const response = await fetchWithTimeout(path, {
    method: options.method ?? "GET",
    headers: buildHeaders(options.token, options.headers),
    body: options.body ?? null,
  }, options.timeoutMs);

  if (!response.ok) {
    throw await toApiError(response);
  }

  return response.blob();
}

export const api = {
  register(values: RegisterInput) {
    return request<TokenResponse>("/auth/register", {
      method: "POST",
      json: values,
    });
  },

  login(values: LoginInput) {
    return request<TokenResponse>("/auth/login", {
      method: "POST",
      json: values,
    });
  },

  getMe(token: string) {
    return request<AuthUser>("/auth/me", { token });
  },

  getDocuments(token: string) {
    return request<DocumentRead[]>("/documents", { token });
  },

  getDocument(documentId: string, token: string) {
    return request<DocumentRead>(`/documents/${documentId}`, { token });
  },

  getDocumentFile(documentId: string, token: string) {
    return requestBlob(`/documents/${documentId}/file`, { token });
  },

  saveDocumentProgress(token: string, documentId: string, page: number) {
    return request<DocumentRead>(`/documents/${documentId}/progress`, {
      method: "PUT",
      token,
      json: { page },
    });
  },

  uploadDocument(token: string, input: UploadDocumentInput) {
    const formData = new FormData();
    formData.append("file", input.file);

    const trimmedTitle = input.title?.trim();
    if (trimmedTitle) {
      formData.append("title", trimmedTitle);
    }

    return request<DocumentRead>("/documents/upload", {
      method: "POST",
      token,
      body: formData,
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    });
  },

  getSessions(token: string) {
    return request<StudySessionRead[]>("/sessions", { token });
  },

  getSession(sessionId: string, token: string) {
    return request<StudySessionRead>(`/sessions/${sessionId}`, { token });
  },

  createSession(token: string, documentId: string) {
    return request<StudySessionRead>("/sessions", {
      method: "POST",
      token,
      json: { document_id: documentId },
    });
  },

  finishReading(token: string, sessionId: string) {
    return request<StudySessionRead>(`/sessions/${sessionId}/finish-reading`, {
      method: "POST",
      token,
    });
  },

  saveTypedCapture(token: string, sessionId: string, chunks: TypedCaptureChunk[]) {
    return request<StudySessionRead>(`/sessions/${sessionId}/typed-capture`, {
      method: "PUT",
      token,
      json: { chunks },
    });
  },

  processTypedCapture(token: string, sessionId: string) {
    return request<StudySessionRead>(`/sessions/${sessionId}/typed-results`, {
      method: "POST",
      token,
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    });
  },

  uploadSessionAudio(token: string, sessionId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    return request<StudySessionRead>(`/sessions/${sessionId}/audio`, {
      method: "POST",
      token,
      body: formData,
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    });
  },

  getRecallHint(
    token: string,
    sessionId: string,
    file: File,
    cumulativeTranscript = "",
    strictness = 50,
  ) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("cumulative_transcript", cumulativeTranscript);
    formData.append("strictness", String(strictness));

    return request<RecallHintRead>(`/sessions/${sessionId}/recall-hint`, {
      method: "POST",
      token,
      body: formData,
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    });
  },

  transcribeSession(token: string, sessionId: string) {
    return request<StudySessionRead>(`/sessions/${sessionId}/transcribe`, {
      method: "POST",
      token,
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    });
  },

  assessSession(token: string, sessionId: string, strictness = 50) {
    return request<StudySessionRead>(
      `/sessions/${sessionId}/assess?strictness=${encodeURIComponent(String(strictness))}`,
      {
      method: "POST",
      token,
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
      },
    );
  },

  generateNotes(token: string, sessionId: string) {
    return request<StudySessionRead>(`/sessions/${sessionId}/notes`, {
      method: "POST",
      token,
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    });
  },

  getNotes(token: string) {
    return request<NoteRead[]>("/notes", { token });
  },

  getNote(noteId: string, token: string) {
    return request<NoteRead>(`/notes/${noteId}`, { token });
  },

  getFlashcards(token: string, sessionId?: string) {
    const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
    return request<FlashcardRead[]>(`/flashcards${query}`, { token });
  },

  generateFlashcards(token: string, sessionId: string) {
    return request<FlashcardRead[]>(`/sessions/${sessionId}/flashcards`, {
      method: "POST",
      token,
      timeoutMs: LONG_REQUEST_TIMEOUT_MS,
    });
  },

  getReviews(token: string) {
    return request<ReviewScheduleRead[]>("/reviews", { token });
  },

  gradeReview(token: string, sessionId: string, rating: "easy" | "medium" | "hard") {
    return request<ReviewScheduleRead>(`/reviews/${sessionId}/grade`, {
      method: "POST",
      token,
      json: { rating },
    });
  },
};
