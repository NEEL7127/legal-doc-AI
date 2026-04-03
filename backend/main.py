# main.py
# FastAPI server — the bridge between React frontend and our RAG backend
# Think of this as the reception desk: receives requests, calls the right function

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import shutil
import uuid

from ingest import ingest_pdf, list_ingested_docs, clear_all_docs, delete_ingested_doc
from query import ask_question, clear_memory

# ─────────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────────

app = FastAPI(title="LegalDoc AI", version="1.0.0")

# CORS middleware — allows React (running on port 3000) to call this API (port 8000)
# Without this, the browser blocks cross-origin requests
app.add_middleware(
    CORSMiddleware,
    # Your React frontend typically runs on 5173 with Vite.
    # (Also keep 3000 in case you run CRA or a different dev setup.)
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temporary folder to save uploaded PDFs before processing
UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─────────────────────────────────────────────
# Request/Response Models (Pydantic)
# ─────────────────────────────────────────────
# These define the shape of request bodies and responses

class AskRequest(BaseModel):
    question: str
    session_id: str = "default"  # Default session if not provided

class ClearRequest(BaseModel):
    session_id: str = "default"

class DeleteDocumentRequest(BaseModel):
    filename: str


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "LegalDoc AI backend is running!"}


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Accepts a PDF file upload from React.
    Saves it temporarily → runs ingest pipeline → returns result.
    """

    # Only allow PDFs
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Save file to uploads folder temporarily
    # We add a UUID prefix to avoid filename collisions
    safe_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Run the ingest pipeline
    try:
        result = ingest_pdf(file_path, file.filename)
    except Exception as e:
        # Clean up file if ingestion fails
        os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

    # Clean up temp file after processing
    os.remove(file_path)

    return {
        "success": True,
        "message": f"Successfully processed {file.filename}",
        "details": result
    }


@app.post("/ask")
def ask(request: AskRequest):
    """
    Accepts a question + session_id from React.
    Runs the full RAG pipeline and returns answer + sources.
    """

    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    result = ask_question(
        question=request.question,
        session_id=request.session_id
    )

    return result


@app.get("/documents")
def get_documents():
    """
    Returns list of all uploaded documents currently in ChromaDB.
    """
    docs = list_ingested_docs()
    return {
        "documents": docs,
        "count": len(docs)
    }


@app.post("/documents/delete")
def delete_document(request: DeleteDocumentRequest):
    """
    Deletes a specific document (all its chunks) from ChromaDB.
    """
    if not request.filename.strip():
        raise HTTPException(status_code=400, detail="filename cannot be empty")

    deleted_chunks = delete_ingested_doc(request.filename)
    return {
        "success": True,
        "filename": request.filename,
        "deleted_chunks": deleted_chunks,
        "message": f"Deleted {deleted_chunks} chunk(s) from {request.filename}",
    }


@app.delete("/clear")
def clear(request: ClearRequest):
    """
    Clears all documents from ChromaDB and resets conversation memory.
    """
    clear_all_docs()
    clear_memory(request.session_id)

    return {"success": True, "message": "All documents and memory cleared"}