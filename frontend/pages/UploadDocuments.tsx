/**
 * UploadDocuments.tsx
 * 
 * What this page does:
 * 1. User drags/drops or selects PDF files
 * 2. Each file is added to a list with status: "pending"
 * 3. On "Continue to Chat", we upload each file to FastAPI one by one
 * 4. Each file's status updates: pending → uploading → success/error
 * 5. After all uploads complete, navigate to /chat
 */

import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import { FileText, Upload, X, CheckCircle, Loader, AlertCircle } from "lucide-react";
import { uploadPDF } from "@/lib/api";

// Status of each file in the upload queue
type FileStatus = "pending" | "uploading" | "success" | "error";

interface UploadedFile {
  id: string;
  file: File;           // The actual File object (needed for real upload)
  name: string;
  size: number;
  status: FileStatus;
  errorMsg?: string;    // Error message if upload failed
  chunks?: number;      // How many chunks were stored (from backend response)
  pages?: number;       // How many pages were processed
}

export default function UploadDocuments() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // ── Drag and Drop Handlers ──────────────────────────────────────

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
  };

  // ── Add files to queue (only PDFs allowed) ──────────────────────

  const addFiles = (fileList: FileList) => {
    const newFiles: UploadedFile[] = [];

    Array.from(fileList).forEach((file) => {
      // Only allow PDFs (our backend only handles PDFs)
      if (!file.type.includes("pdf")) return;

      // Avoid duplicates by checking filename
      const alreadyAdded = files.some((f) => f.name === file.name);
      if (alreadyAdded) return;

      newFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        file,                   // Store the actual File object for upload
        name: file.name,
        size: file.size,
        status: "pending",
      });
    });

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // ── Upload all pending files then navigate to chat ────────────────

  const handleProceedToChat = async () => {
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);

    // Upload files that are "pending" (not already uploaded successfully)
    const pendingFiles = files.filter((f) => f.status === "pending");

    for (const fileItem of pendingFiles) {
      // Mark this file as "uploading"
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileItem.id ? { ...f, status: "uploading" } : f
        )
      );

      try {
        // Call FastAPI /upload endpoint
        const result = await uploadPDF(fileItem.file);

        // Mark as success + store info from backend
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? {
                  ...f,
                  status: "success",
                  chunks: result.details.chunks_stored,
                  pages: result.details.pages_processed,
                }
              : f
          )
        );
      } catch (err: any) {
        // Mark as error with message
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? { ...f, status: "error", errorMsg: err.message }
              : f
          )
        );
      }
    }

    setIsUploading(false);

    // Check if at least one file uploaded successfully
    // We read the latest state using a callback
    setFiles((currentFiles) => {
      const anySuccess = currentFiles.some((f) => f.status === "success");
      if (anySuccess) {
        // Navigate after state update
        setTimeout(() => navigate("/chat"), 300);
      }
      return currentFiles;
    });
  };

  // ── Status Icon per file ───────────────────────────────────────────

  const StatusIcon = ({ status }: { status: FileStatus }) => {
    if (status === "uploading")
      return <Loader className="w-5 h-5 text-primary animate-spin" />;
    if (status === "success")
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (status === "error")
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    return <CheckCircle className="w-5 h-5 text-foreground/30" />;
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <Header />

      <section className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-3">
            Upload Documents
          </h1>
          <p className="text-lg text-foreground/60">
            Upload your legal PDFs. Our AI will read, chunk, and index them so
            you can ask questions instantly.
          </p>
        </div>

        {/* ── Drag and Drop Zone ─────────────────────────────────── */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-primary/2"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf"
            onChange={handleChange}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="space-y-4"
          >
            <div className="flex justify-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <Upload className="w-8 h-8 text-primary" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                Drag and drop your PDF files here
              </p>
              <p className="text-foreground/60 mt-1">
                or click to browse your computer
              </p>
            </div>
            <p className="text-sm text-foreground/50">
              Supported format: PDF only (Max 50MB per file)
            </p>
          </div>
        </div>

        {/* ── File List ──────────────────────────────────────────── */}
        {files.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Files ({files.length})
            </h2>
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between p-4 bg-white rounded-lg border transition-colors ${
                    file.status === "error"
                      ? "border-red-200 bg-red-50"
                      : file.status === "success"
                      ? "border-green-200 bg-green-50"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>

                    <div className="text-left flex-1">
                      <p className="font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      <p className="text-sm text-foreground/60">
                        {formatFileSize(file.size)}
                        {/* Show backend info after success */}
                        {file.status === "success" &&
                          file.pages !== undefined && (
                            <span className="ml-2 text-green-600">
                              ✓ {file.pages} pages · {file.chunks} chunks indexed
                            </span>
                          )}
                        {/* Show error message */}
                        {file.status === "error" && file.errorMsg && (
                          <span className="ml-2 text-red-500">
                            ✗ {file.errorMsg}
                          </span>
                        )}
                      </p>
                    </div>

                    <StatusIcon status={file.status} />
                  </div>

                  {/* Only allow removing files that aren't currently uploading */}
                  {file.status !== "uploading" && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="ml-4 p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-destructive" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Action Buttons ──────────────────────────────────────── */}
        <div className="mt-12 flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-1 px-6 py-3 border-2 border-primary/20 text-foreground font-semibold rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-50"
          >
            Add More Files
          </button>

          <button
            onClick={handleProceedToChat}
            disabled={
              files.length === 0 ||
              isUploading ||
              (pendingCount === 0 && successCount === 0)
            }
            className={`flex-1 px-6 py-3 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              files.length > 0 && !isUploading
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg hover:shadow-xl hover:opacity-90"
                : "bg-foreground/10 text-foreground/50 cursor-not-allowed"
            }`}
          >
            {isUploading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Uploading & Indexing...
              </>
            ) : successCount > 0 && pendingCount === 0 ? (
              "Go to Chat →"
            ) : (
              "Upload & Continue to Chat"
            )}
          </button>
        </div>

        {/* ── How It Works ────────────────────────────────────────── */}
        <div className="mt-16 p-8 bg-white rounded-xl border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            What happens when you upload?
          </h3>
          <ol className="space-y-3 text-foreground/70">
            <li className="flex gap-3">
              <span className="font-semibold text-primary min-w-6">1.</span>
              <span>PDF is read page by page using PyMuPDF</span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-primary min-w-6">2.</span>
              <span>Text is split into ~1000 character chunks with overlap</span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-primary min-w-6">3.</span>
              <span>
                Each chunk is converted to embeddings (numbers) using
                sentence-transformers
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-primary min-w-6">4.</span>
              <span>
                Embeddings are stored in ChromaDB with page/filename metadata
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-primary min-w-6">5.</span>
              <span>
                Now you can ask questions — the AI finds the most relevant
                chunks and answers with citations
              </span>
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
