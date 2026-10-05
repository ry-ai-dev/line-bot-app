-- LINE bot app: initial schema (faq / menus / conversations)
-- Adds new tables only. Does not touch mitsumori-app's existing tables
-- (clients, documents, document_items, hearing_responses, job_applications,
-- profiles, user_settings, app_settings).

create table if not exists faq (
  id uuid primary key default gen_random_uuid(),
  category text,
  question text not null,
  answer text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists menus (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null default 0,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  direction text not null check (direction in ('user', 'bot')),
  message_text text not null,
  confidence text check (confidence in ('high', 'mid', 'low')),
  escalated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_line_user_id on conversations(line_user_id);

alter table faq enable row level security;
alter table menus enable row level security;
alter table conversations enable row level security;

create policy "faq_select_auth" on faq for select using (auth.role() = 'authenticated');
create policy "faq_insert_auth" on faq for insert with check (auth.role() = 'authenticated');
create policy "faq_update_auth" on faq for update using (auth.role() = 'authenticated');
create policy "faq_delete_auth" on faq for delete using (auth.role() = 'authenticated');

create policy "menus_select_auth" on menus for select using (auth.role() = 'authenticated');
create policy "menus_insert_auth" on menus for insert with check (auth.role() = 'authenticated');
create policy "menus_update_auth" on menus for update using (auth.role() = 'authenticated');
create policy "menus_delete_auth" on menus for delete using (auth.role() = 'authenticated');

create policy "conversations_select_auth" on conversations for select using (auth.role() = 'authenticated');

grant usage on schema public to authenticated;
grant select, insert, update, delete on faq to authenticated;
grant select, insert, update, delete on menus to authenticated;
grant select on conversations to authenticated;
