import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export type Source = {
  filename: string;
  page: number;
  source: string;
  relevance_score: number;
  preview: string;
};

export type AskResponse = {
  answer: string;
  sources: Source[];
  question: string;
  session_id: string;
};

export type UploadDetails = {
  filename: string;
  pages_processed: number;
  chunks_stored: number;
};

export type UploadResponse = {
  success: boolean;
  message: string;
  details: UploadDetails;
};

export type DocumentsResponse = {
  documents: string[];
  count: number;
};

export type DeleteDocumentResponse = {
  success: boolean;
  filename: string;
  deleted_chunks: number;
  message: string;
};

export async function uploadPDF(file: File): Promise<UploadResponse> {
  const form = new FormData();
  // FastAPI expects the field name to be `file` (UploadFile = File(...)).
  form.append("file", file);

  const res = await axios.post(`${API_BASE_URL}/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as UploadResponse;
}

export async function askQuestion(
  question: string,
  sessionId: string
): Promise<AskResponse> {
  const res = await axios.post(`${API_BASE_URL}/ask`, {
    question,
    session_id: sessionId,
  });
  return res.data as AskResponse;
}

export async function getDocuments(): Promise<DocumentsResponse> {
  const res = await axios.get(`${API_BASE_URL}/documents`);
  return res.data as DocumentsResponse;
}

export async function deleteDocument(
  filename: string
): Promise<DeleteDocumentResponse> {
  const res = await axios.post(`${API_BASE_URL}/documents/delete`, {
    filename,
  });
  return res.data as DeleteDocumentResponse;
}
  