import type {
  AuthUser,
  DocumentRead,
  LoginInput,
  NoteRead,
  RecallHintRead,
  RegisterInput,
  StudySessionRead,
  TokenResponse,
  UploadDocumentInput,
} from "@/lib/types";

const DEFAULT_API_BASE_URL = "https://capybara-coach-production.up.railway.app";
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

type RequestOptions = {
  method?: string;
  token?: string;
  body?: BodyInit | null;
  json?: unknown;
  headers?: HeadersInit;
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
    const payload = (await response.json()) as ErrorPayload;
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
    try {
      const fallbackText = await response.text();
      if (fallbackText.trim()) {
        message = fallbackText.trim();
      }
    } catch {
      message = response.statusText || message;
    }
  }

  return new ApiError(message, response.status);
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const { body, headers, json, method = "GET", token } = options;
  const nextHeaders = buildHeaders(token, headers);

  let nextBody = body ?? null;

  if (json !== undefined) {
    nextHeaders.set("Content-Type", "application/json");
    nextBody = JSON.stringify(json);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: nextHeaders,
    body: nextBody,
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestBlob(path: string, options: RequestOptions = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: buildHeaders(options.token, options.headers),
    body: options.body ?? null,
  });

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

  uploadSessionAudio(token: string, sessionId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    return request<StudySessionRead>(`/sessions/${sessionId}/audio`, {
      method: "POST",
      token,
      body: formData,
    });
  },

  getRecallHint(token: string, sessionId: string, file: File, strictness = 50) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("strictness", String(strictness));

    return request<RecallHintRead>(`/sessions/${sessionId}/recall-hint`, {
      method: "POST",
      token,
      body: formData,
    });
  },

  transcribeSession(token: string, sessionId: string) {
    return request<StudySessionRead>(`/sessions/${sessionId}/transcribe`, {
      method: "POST",
      token,
    });
  },

  assessSession(token: string, sessionId: string) {
    return request<StudySessionRead>(`/sessions/${sessionId}/assess`, {
      method: "POST",
      token,
    });
  },

  generateNotes(token: string, sessionId: string) {
    return request<StudySessionRead>(`/sessions/${sessionId}/notes`, {
      method: "POST",
      token,
    });
  },

  getNotes(token: string) {
    return request<NoteRead[]>("/notes", { token });
  },

  getNote(noteId: string, token: string) {
    return request<NoteRead>(`/notes/${noteId}`, { token });
  },
};
