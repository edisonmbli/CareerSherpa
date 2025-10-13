-- Enable pgvector extension for vector similarity search
-- This should be run manually on the Neon database before running migrations

CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension is installed
SELECT * FROM pg_extension WHERE extname = 'vector';