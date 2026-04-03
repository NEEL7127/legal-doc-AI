# ingest.py
# This file handles: PDF reading → chunking → embedding → storing in ChromaDB
# Think of this as the librarian who reads every document and organizes it

import fitz  # PyMuPDF — for reading PDFs
import chromadb  # Our vector database
from chromadb.utils import embedding_functions
from config import EMBEDDING_MODEL, CHROMA_PATH, CHUNK_SIZE, CHUNK_OVERLAP
import os
import uuid  # For generating unique IDs for each chunk


# ─────────────────────────────────────────────
# STEP 1: Connect to ChromaDB
# ─────────────────────────────────────────────
# ChromaDB is like a filing cabinet that stores text + its number representation
# PersistentClient means data is saved to disk (not lost when you restart)

def get_chroma_collection():
    client = chromadb.PersistentClient(path=CHROMA_PATH)

    # sentence-transformers will convert text → embeddings locally on your CPU
    embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )

    # A "collection" is like a table in a database
    # get_or_create means: use existing one if it exists, else make a new one
    collection = client.get_or_create_collection(
        name="legaldocs",
        embedding_function=embedding_fn,
        metadata={"hnsw:space": "cosine"}  # cosine similarity for matching
    )

    return collection


# ─────────────────────────────────────────────
# STEP 2: Read PDF and extract text per page
# ─────────────────────────────────────────────
# fitz (PyMuPDF) opens the PDF and reads each page's raw text

def extract_text_from_pdf(file_path: str) -> list[dict]:
    """
    Returns a list of dicts like:
    [{ "page": 1, "text": "This agreement is between..." }, ...]
    """
    doc = fitz.open(file_path)
    pages = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()  # Extract raw text from page

        # Skip empty pages
        if text.strip():
            pages.append({
                "page": page_num + 1,  # Human-readable page number
                "text": text
            })

    doc.close()
    return pages


# ─────────────────────────────────────────────
# STEP 3: Chop text into chunks
# ─────────────────────────────────────────────
# Why chunk? Because embedding a 10-page document as one piece loses detail.
# Smaller chunks = more precise retrieval.
# Overlap = we don't lose meaning at boundaries.
#
# Example with CHUNK_SIZE=20, OVERLAP=5:
# Text: "Hello world this is legal document about contracts"
# Chunk 1: "Hello world this is "
# Chunk 2: "is legal document abo"  ← starts 5 chars back from end of chunk 1
# Chunk 3: "about contracts"

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        if chunk.strip():  # Skip empty chunks
            chunks.append(chunk)

        # Move forward by (chunk_size - overlap) so next chunk has overlap
        start += chunk_size - overlap

    return chunks


# ─────────────────────────────────────────────
# STEP 4: Main ingest function
# ─────────────────────────────────────────────
# This ties everything together:
# PDF file → pages → chunks → stored in ChromaDB with metadata

def ingest_pdf(file_path: str, filename: str) -> dict:
    """
    Full pipeline: read PDF → chunk → embed → store in ChromaDB
    Returns summary of what was ingested
    """

    print(f"[Ingest] Starting: {filename}")

    # Get ChromaDB collection
    collection = get_chroma_collection()

    # Extract text from all pages
    pages = extract_text_from_pdf(file_path)
    print(f"[Ingest] Extracted {len(pages)} pages from {filename}")

    total_chunks = 0
    documents = []  # The actual text chunks
    metadatas = []  # Metadata: which file, which page
    ids = []        # Unique ID for each chunk

    for page_data in pages:
        page_num = page_data["page"]
        page_text = page_data["text"]

        # Chop this page's text into chunks
        chunks = chunk_text(page_text)

        for chunk in chunks:
            documents.append(chunk)
            metadatas.append({
                "filename": filename,       # e.g. "contract_2024.pdf"
                "page": page_num,           # e.g. 3
                "source": f"{filename} — Page {page_num}"  # For citations
            })
            ids.append(str(uuid.uuid4()))  # Unique ID for this chunk
            total_chunks += 1

    # Store everything in ChromaDB
    # ChromaDB will automatically call sentence-transformers to make embeddings
    if documents:
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )

    print(f"[Ingest] Stored {total_chunks} chunks from {filename}")

    return {
        "filename": filename,
        "pages_processed": len(pages),
        "chunks_stored": total_chunks
    }


# ─────────────────────────────────────────────
# Helper: List all ingested documents
# ─────────────────────────────────────────────

def list_ingested_docs() -> list[str]:
    """Returns unique filenames already in ChromaDB"""
    collection = get_chroma_collection()
    results = collection.get(include=["metadatas"])

    if not results["metadatas"]:
        return []

    # Extract unique filenames from metadata
    filenames = list(set(
        meta["filename"] for meta in results["metadatas"]
    ))
    return filenames


# ─────────────────────────────────────────────
# Helper: Delete one document from ChromaDB
# ─────────────────────────────────────────────

def delete_ingested_doc(filename: str) -> int:
    """
    Deletes all chunks in the ChromaDB collection that belong to `filename`.

    Returns the number of chunks deleted.
    """
    collection = get_chroma_collection()

    # Count first so we can report a meaningful number.
    # ChromaDB `include` supports: documents, embeddings, metadatas, distances, uris, data.
    # `ids` are returned regardless, so we only request allowed include fields.
    matches = collection.get(where={"filename": filename}, include=["metadatas"])
    ids = matches.get("ids") or []
    deleted_count = len(ids)

    if deleted_count > 0:
        collection.delete(where={"filename": filename})

    return deleted_count


# ─────────────────────────────────────────────
# Helper: Clear all documents (reset)
# ─────────────────────────────────────────────

def clear_all_docs():
    """Deletes all stored chunks — useful for testing"""
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    client.delete_collection("legaldocs")
    print("[Ingest] All documents cleared.")