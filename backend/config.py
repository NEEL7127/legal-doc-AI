# config.py
# This file loads environment variables from the .env file
# Think of it as: opening your wallet to get your API key card

import os
from dotenv import load_dotenv

# This line reads the .env file and loads all variables into memory
load_dotenv()

# Now we grab the Groq API key from the environment
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# This is the embedding model we'll use to convert text → numbers
# It's small, free, runs on CPU — perfect for your laptop
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# This is the Groq LLM we'll use to generate answers
GROQ_MODEL = "llama-3.3-70b-versatile"

# ChromaDB will store its data in this folder (auto-created)
CHROMA_PATH = "./chroma_db"

# How many characters per chunk when we split PDFs
CHUNK_SIZE = 1000

# How many characters to overlap between chunks
# (so we don't lose context at chunk boundaries)
CHUNK_OVERLAP = 200