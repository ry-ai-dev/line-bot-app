-- Stage 3: 管理画面の権限管理
-- bot_admins に登録された auth.users のみが管理画面(faq/menus/conversations)を操作できるようにする。
-- mitsumori-app の既存テーブル(clients, documents, document_items, hearing_responses,
-- job_applications, profiles, user_settings, app_settings)には一切変更を加えない。

create table if not exists bot_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table bot_admins enable row level security;

create policy "bot_admins_select_self" on bot_admins
  for select using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select on bot_admins to authenticated;

-- security definer + search_path固定 + stable: RLSポリシー内で安全に呼び出せる関数
create or replace function is_bot_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from bot_admins where user_id = auth.uid()
  );
$$;

-- faq: 既存の *_auth ポリシーを削除し、is_bot_admin() ベースに作り直す
drop policy if exists "faq_select_auth" on faq;
drop policy if exists "faq_insert_auth" on faq;
drop policy if exists "faq_update_auth" on faq;
drop policy if exists "faq_delete_auth" on faq;

create policy "faq_select_admin" on faq for select using (is_bot_admin());
create policy "faq_insert_admin" on faq for insert with check (is_bot_admin());
create policy "faq_update_admin" on faq for update using (is_bot_admin()) with check (is_bot_admin());
create policy "faq_delete_admin" on faq for delete using (is_bot_admin());

-- menus: 同様
drop policy if exists "menus_select_auth" on menus;
drop policy if exists "menus_insert_auth" on menus;
drop policy if exists "menus_update_auth" on menus;
drop policy if exists "menus_delete_auth" on menus;

create policy "menus_select_admin" on menus for select using (is_bot_admin());
create policy "menus_insert_admin" on menus for insert with check (is_bot_admin());
create policy "menus_update_admin" on menus for update using (is_bot_admin()) with check (is_bot_admin());
create policy "menus_delete_admin" on menus for delete using (is_bot_admin());

-- conversations: selectのみ
drop policy if exists "conversations_select_auth" on conversations;

create policy "conversations_select_admin" on conversations for select using (is_bot_admin());

-- GRANTは既存のまま維持(変更なし):
-- grant select, insert, update, delete on faq to authenticated;
-- grant select, insert, update, delete on menus to authenticated;
-- grant select on conversations to authenticated;
