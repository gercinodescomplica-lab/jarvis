-- Adiciona flag para documentos globais (visíveis para todos os usuários)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

-- Atualiza search_document_chunks para incluir documentos globais
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
    WHERE owner_id IS NULL OR d.uploader_phone = owner_id OR d.is_global = true
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
