-- Atualiza search_memories para filtrar por owner (phone/group JID)
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_count int,
  owner_id text DEFAULT NULL
)
RETURNS TABLE(content text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT m.content FROM memories m
    WHERE owner_id IS NULL OR m.phone = owner_id
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Atualiza search_document_chunks para filtrar por owner via JOIN com documents
CREATE OR REPLACE FUNCTION search_document_chunks(
  query_embedding vector(1536),
  match_count int,
  owner_id text DEFAULT NULL
)
RETURNS TABLE(content text, document_title text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT dc.content, dc.document_title
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE owner_id IS NULL OR d.uploader_phone = owner_id
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
