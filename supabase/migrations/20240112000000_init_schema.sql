-- Enable pgvector extension
create extension if not exists vector with schema public;

-- Users table (minimal for MVP, relying on Supabase Auth usually but here simplistic)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

-- Settings table
create table if not exists public.settings (
  key text primary key,
  value text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'Backlog', -- 'Backlog', 'In Progress', 'Blocked', 'Done'
  owner text,
  notion_id text unique,
  details text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tasks table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'Todo', -- 'Todo', 'Doing', 'Done'
  priority text default 'Medium', -- 'Low', 'Medium', 'High'
  due_date timestamptz,
  project_id uuid references public.projects(id) on delete set null,
  notion_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages table (Chat History)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  role text not null, -- 'user', 'assistant', 'system'
  content text not null,
  type text default 'text', -- 'text', 'audio'
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Action Logs (Audit/History of actions taken by bot)
create table if not exists public.action_logs (
  id uuid primary key default gen_random_uuid(),
  action_type text not null, -- 'create_project', 'create_task', 'update_status', etc.
  details jsonb not null,
  created_at timestamptz default now()
);

-- Embeddings table (for vector search)
create table if not exists public.embeddings (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536), -- Assuming OpenAI ada-002 dimension
  metadata jsonb default '{}'::jsonb, -- e.g. { source_type: 'message'|'project', source_id: uuid }
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_projects_notion_id on public.projects(notion_id);
create index if not exists idx_tasks_notion_id on public.tasks(notion_id);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_messages_created_at on public.messages(created_at);
create index if not exists idx_embeddings_metadata on public.embeddings using gin (metadata);
