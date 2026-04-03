# query.py
# This file handles: user question → retrieve chunks → ask Groq → return cited answer
# Think of this as the smart assistant who reads the relevant pages and answers you

from groq import Groq
from config import GROQ_API_KEY, GROQ_MODEL
from ingest import get_chroma_collection

# Initialize Groq client
groq_client = Groq(api_key=GROQ_API_KEY)

# ─────────────────────────────────────────────
# Conversation Memory
# ─────────────────────────────────────────────
# We store chat history as a list of messages
# Each message: { "role": "user"/"assistant", "content": "..." }
# This is sent to Groq every time so it remembers context

# In production you'd store this in a database per session
# For now, simple in-memory dict keyed by session_id
conversation_memory: dict[str, list] = {}

def get_memory(session_id: str) -> list:
    """Get conversation history for a session"""
    if session_id not in conversation_memory:
        conversation_memory[session_id] = []
    return conversation_memory[session_id]

def add_to_memory(session_id: str, role: str, content: str):
    """Add a message to conversation history"""
    conversation_memory[session_id].append({
        "role": role,
        "content": content
    })

def clear_memory(session_id: str):
    """Clear conversation history for a session"""
    conversation_memory[session_id] = []


# ─────────────────────────────────────────────
# Retrieval — Find relevant chunks
# ─────────────────────────────────────────────

def retrieve_relevant_chunks(question: str, n_results: int = 5) -> list[dict]:
    """
    Converts the question to embeddings and finds the
    top N most similar chunks in ChromaDB.

    Returns list of: { "text": ..., "source": ..., "page": ..., "filename": ... }
    """
    collection = get_chroma_collection()

    # ChromaDB does the embedding of question + similarity search internally
    results = collection.query(
        query_texts=[question],
        n_results=n_results,
        include=["documents", "metadatas", "distances"]
    )

    chunks = []
    for i in range(len(results["documents"][0])):
        chunks.append({
            "text": results["documents"][0][i],
            "source": results["metadatas"][0][i].get("source", "Unknown"),
            "filename": results["metadatas"][0][i].get("filename", "Unknown"),
            "page": results["metadatas"][0][i].get("page", 0),
            "score": round(1 - results["distances"][0][i], 3)  # similarity score
        })

    return chunks


# ─────────────────────────────────────────────
# Build Prompt — Combine chunks + question
# ─────────────────────────────────────────────

def build_prompt(question: str, chunks: list[dict]) -> str:
    """
    Builds the prompt we send to Groq.
    Format:
      CONTEXT (retrieved chunks with source labels)
      + QUESTION
      + INSTRUCTION (answer using only the context, cite sources)
    """

    context_parts = []
    for i, chunk in enumerate(chunks):
        context_parts.append(
            f"[Source {i+1}: {chunk['source']}]\n{chunk['text']}"
        )

    context = "\n\n".join(context_parts)

    prompt = f"""You are a legal document assistant. Answer the user's question using ONLY the provided context from the uploaded legal documents.

CONTEXT FROM DOCUMENTS:
{context}

INSTRUCTIONS:
- Answer based strictly on the context above
- Always cite which source/page the information came from, like: (Source: contract.pdf — Page 3)
- If the answer is not in the context, say: "This information is not found in the uploaded documents"
- Be precise and professional

QUESTION: {question}

ANSWER:"""

    return prompt


# ─────────────────────────────────────────────
# Main Query Function
# ─────────────────────────────────────────────

def ask_question(question: str, session_id: str = "default") -> dict:
    """
    Full pipeline:
    1. Retrieve relevant chunks from ChromaDB
    2. Build prompt with context
    3. Get conversation history (memory)
    4. Send to Groq with history
    5. Store response in memory
    6. Return answer + sources
    """

    # Step 1: Retrieve relevant chunks
    chunks = retrieve_relevant_chunks(question, n_results=5)

    if not chunks:
        return {
            "answer": "No documents have been uploaded yet. Please upload PDF documents first.",
            "sources": [],
            "question": question
        }

    # Step 2: Build the RAG prompt
    rag_prompt = build_prompt(question, chunks)

    # Step 3: Get conversation history
    history = get_memory(session_id)

    # Step 4: Build messages for Groq
    # System message sets the AI's role
    # Then we include history so Groq remembers previous questions
    # Then the new RAG prompt as the current user message
    messages = [
        {
            "role": "system",
            "content": "You are a helpful legal document assistant. You answer questions based on provided document context with citations."
        }
    ]

    # Add last 6 messages of history (3 exchanges) to keep context
    # We don't add all history to avoid token overflow
    messages.extend(history[-6:])

    # Add current question with context
    messages.append({
        "role": "user",
        "content": rag_prompt
    })

    # Step 5: Call Groq API
    response = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.1,      # Low temp = more factual, less creative
        max_tokens=1024
    )

    answer = response.choices[0].message.content

    # Step 6: Save to memory (just the clean question + answer, not the whole prompt)
    add_to_memory(session_id, "user", question)
    add_to_memory(session_id, "assistant", answer)

    # Step 7: Return answer + sources for frontend to display
    sources = [
        {
            "filename": chunk["filename"],
            "page": chunk["page"],
            "source": chunk["source"],
            "relevance_score": chunk["score"],
            "preview": chunk["text"][:200] + "..."  # Short preview of chunk
        }
        for chunk in chunks
    ]

    return {
        "answer": answer,
        "sources": sources,
        "question": question,
        "session_id": session_id
    }