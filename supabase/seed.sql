-- Seed data

-- Default settings
insert into public.settings (key, value, description) values
('allowed_telegram_chat_ids', '', 'Comma separated list of allowed Telegram Chat IDs'),
('notion_projects_db_id', '', 'ID of the Notion Projects Database'),
('notion_tasks_db_id', '', 'ID of the Notion Tasks Database'),
('llm_provider', 'openai', 'LLM Provider (openai, openrouter)'),
('dry_run', 'false', 'If true, do not perform write operations on Notion');

-- Default User (optional, for local dev if needed)
insert into public.users (email) values ('admin@example.com') on conflict do nothing;

-- Sample Project
insert into public.projects (name, status, details) values
('Website Redesign', 'In Progress', 'Redesigning the corporate website for better performance and new branding.'),
('Mobile App MVP', 'Backlog', 'Initial scoping for mobile application.');

-- Sample Tasks
insert into public.tasks (title, status, priority, project_id) 
select 'Design Mockups', 'Done', 'High', id from public.projects where name = 'Website Redesign';

insert into public.tasks (title, status, priority, project_id) 
select 'Implement Homepage', 'Doing', 'High', id from public.projects where name = 'Website Redesign';
