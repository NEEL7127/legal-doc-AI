/**
 * ChatDocuments.tsx
 *
 * What this page does:
 * 1. On load → fetch real document list from FastAPI /documents
 * 2. User types a question → POST to FastAPI /ask
 * 3. Each assistant message has a "Sources" panel showing
 *    which PDF + page was used to answer
 * 4. Conversation memory is maintained via session_id
 */

import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import {
  FileText,
  Send,
  Plus,
  MessageCircle,
  Loader,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { askQuestion, deleteDocument, getDocuments } from "@/lib/api";
import type { Source } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Source[];       // Only assistant messages have sources
  sourcesOpen?: boolean;    // Whether the sources panel is expanded
}

// ── Session ID ─────────────────────────────────────────────────────
// We generate one session ID per browser tab.
// This is sent to FastAPI so it can maintain conversation memory.
// Baby explanation: it's like a "room number" — all your messages
// in this tab go to the same "room" on the server.

function generateSessionId(): string {
  return "session_" + Math.random().toString(36).substr(2, 9);
}

export default function ChatDocuments() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm your LegalDoc AI assistant. Upload your PDF documents and I'll help you analyze them. Ask me anything about the documents — I'll give you answers with page-level citations.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<string[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Session ID is stable for this tab (won't change on re-render)
  const sessionId = useRef(generateSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Auto scroll to latest message ─────────────────────────────────

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ── Fetch document list on page load ──────────────────────────────
  // This calls GET /api/documents → FastAPI returns list of filenames in ChromaDB

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const result = await getDocuments();
        setDocuments(result.documents);
      } catch (err) {
        console.error("Failed to fetch documents:", err);
      } finally {
        setDocsLoading(false);
      }
    };

    fetchDocs();
    // Refresh document list every 10 seconds (in case user uploads in another tab)
    const interval = setInterval(fetchDocs, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteDocument = async (filename: string) => {
    if (deletingDoc) return;
    const ok = window.confirm(`Delete "${filename}" from memory?`);
    if (!ok) return;

    try {
      setDeletingDoc(filename);
      setError(null);

      await deleteDocument(filename);
      const result = await getDocuments();
      setDocuments(result.documents);
    } catch (err: any) {
      setError(err?.message || "Failed to delete document");
    } finally {
      setDeletingDoc(null);
    }
  };

  // ── Toggle sources panel open/close ───────────────────────────────

  const toggleSources = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, sourcesOpen: !m.sourcesOpen } : m
      )
    );
  };

  // ── Send message to FastAPI /ask ───────────────────────────────────

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");
    setError(null);

    // Add user message immediately (optimistic UI)
    const userMsg: Message = {
      id: Math.random().toString(36).substr(2, 9),
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // POST to FastAPI /ask with question + session_id
      const result = await askQuestion(question, sessionId.current);

      // Add assistant message with sources
      const assistantMsg: Message = {
        id: Math.random().toString(36).substr(2, 9),
        role: "assistant",
        content: result.answer,
        timestamp: new Date(),
        sources: result.sources,
        sourcesOpen: false, // sources collapsed by default
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />

      <div className="max-w-7xl mx-auto px-6 pt-24 pb-6 h-screen flex flex-col">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Document Chat</h1>
          <p className="text-foreground/60 mt-1">
            Ask questions about your legal documents — answers include page citations
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="flex gap-6 flex-1 min-h-0">

          {/* ── Left Sidebar: Documents List ─────────────────────── */}
          <div className="w-80 flex flex-col bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-foreground">
                  Indexed Documents
                </h2>
                <Link
                  to="/upload"
                  className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                  title="Upload more documents"
                >
                  <Plus className="w-4 h-4 text-primary" />
                </Link>
              </div>
              <p className="text-xs text-foreground/50">
                {docsLoading
                  ? "Loading..."
                  : `${documents.length} document${documents.length !== 1 ? "s" : ""} in memory`}
              </p>
            </div>

            {/* Document list from ChromaDB */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {docsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-foreground/40">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No documents yet</p>
                  <Link
                    to="/upload"
                    className="text-xs text-primary hover:underline mt-1 block"
                  >
                    Upload some PDFs →
                  </Link>
                </div>
              ) : (
                documents.map((docName, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-all group flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="font-medium text-sm text-foreground truncate group-hover:text-primary">
                        {docName}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDeleteDocument(docName)}
                      disabled={deletingDoc === docName}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-destructive disabled:opacity-50 transition-colors"
                      title={`Delete ${docName}`}
                    >
                      {deletingDoc === docName ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-border">
              <Link
                to="/upload"
                className="w-full py-2 px-4 bg-gradient-to-r from-primary to-secondary text-white font-medium rounded-lg hover:opacity-90 transition-opacity text-center text-sm block"
              >
                Upload More PDFs
              </Link>
            </div>
          </div>

          {/* ── Right Panel: Chat ─────────────────────────────────── */}
          <div className="flex-1 flex flex-col bg-white rounded-xl border border-border shadow-sm overflow-hidden">

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div key={message.id}>
                  <div
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* AI avatar */}
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <MessageCircle className="w-4 h-4 text-primary" />
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`max-w-md lg:max-w-2xl rounded-lg p-4 ${
                        message.role === "user"
                          ? "bg-gradient-to-r from-primary to-secondary text-white rounded-br-none"
                          : "bg-foreground/5 text-foreground rounded-bl-none"
                      }`}
                    >
                      {/* Message text — preserve line breaks */}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                      <p
                        className={`text-xs mt-2 opacity-70 ${
                          message.role === "user"
                            ? "text-white"
                            : "text-foreground"
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>

                  {/* ── Sources Panel (only for assistant messages with sources) */}
                  {message.role === "assistant" &&
                    message.sources &&
                    message.sources.length > 0 && (
                      <div className="ml-11 mt-2">
                        {/* Toggle button */}
                        <button
                          onClick={() => toggleSources(message.id)}
                          className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          {message.sources.length} source
                          {message.sources.length !== 1 ? "s" : ""} used
                          {message.sourcesOpen ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        {/* Expanded sources */}
                        {message.sourcesOpen && (
                          <div className="mt-2 space-y-2">
                            {message.sources.map((source, i) => (
                              <div
                                key={i}
                                className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs"
                              >
                                {/* Source header */}
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-primary">
                                    {source.source}
                                  </span>
                                  <span className="text-foreground/40 ml-2">
                                    relevance:{" "}
                                    {Math.round(source.relevance_score * 100)}%
                                  </span>
                                </div>
                                {/* Chunk preview */}
                                <p className="text-foreground/60 leading-relaxed line-clamp-3">
                                  {source.preview}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Loader className="w-4 h-4 text-primary animate-spin" />
                  </div>
                  <div className="bg-foreground/5 rounded-lg p-4 rounded-bl-none">
                    <p className="text-sm text-foreground/60">
                      Searching documents and generating answer...
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input Area ─────────────────────────────────────── */}
            <div className="p-6 border-t border-border">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    documents.length === 0
                      ? "Upload documents first, then ask questions..."
                      : "Ask a question about your documents..."
                  }
                  className="flex-1 px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    loading || !input.trim()
                      ? "bg-foreground/10 text-foreground/50 cursor-not-allowed"
                      : "bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 shadow-md hover:shadow-lg"
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
              <p className="text-xs text-foreground/40 mt-2">
                Session ID: {sessionId.current} · Conversation memory is active
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
