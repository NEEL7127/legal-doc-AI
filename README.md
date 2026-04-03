

# ⚖️ LegalDoc AI — Multi-Document Legal RAG System

Ask questions across multiple legal documents and get cited, page-level answers powered by LLaMA 3.3 70B.


---

## 🧠 What It Does

- Upload multiple legal PDFs via drag-and-drop UI
- AI reads, chunks, and indexes all documents into ChromaDB
- Ask natural language questions across all documents simultaneously
- Get answers with **page-level citations** (which file, which page)
- **Conversation memory** — follow-up questions remember context
- Real-time per-file upload status (uploading → indexed)

---

## 🏗️ Architecture
PDF Upload → PyMuPDF (read) → Chunking (1000 chars, 200 overlap)
→ sentence-transformers (embed) → ChromaDB (store)
Question → ChromaDB (retrieve top 5 chunks across all docs)
→ Build prompt with labeled sources
→ Groq LLaMA 3.3 70B (generate cited answer)
→ React UI (display answer + sources panel)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| PDF Parsing | PyMuPDF |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| Vector DB | ChromaDB |
| LLM | Groq — LLaMA 3.3 70B |
| Backend | FastAPI |
| Frontend | React + TypeScript + Tailwind CSS |
| Memory | Session-based conversation history |

---

## 🚀 Setup & Run

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/legaldoc-ai
cd legaldoc-ai
```

### 2. Backend setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r ../requirements.txt

# Create .env file
echo GROQ_API_KEY=your_key_here > .env

# Run backend
uvicorn main:app --reload --port 8000
```

### 3. Frontend setup
```bash
cd frontend
pnpm install
pnpm dev
```

### 4. Open browser
http://localhost:8080

---

## 📌 Key Concepts Implemented

- **Multi-doc RAG** — chunks from all documents stored with filename + page metadata
- **Citation tracking** — every answer references the exact source document and page
- **Conversation memory** — session-based history sent with each Groq request
- **Hybrid retrieval** — cosine similarity search across all indexed documents
- **Full-stack integration** — React → Vite proxy → FastAPI → ChromaDB + Groq

---

## 📸 Features

- 📤 Drag and drop PDF upload
- ✅ Per-file upload status (pending → uploading → indexed)
- 💬 Chat interface with conversation memory
- 📎 Collapsible sources panel per answer with relevance scores
- 📂 Live document list sidebar
