create table if not exists "Session" (
  "id" text primary key,
  "name" text not null,
  "snapshot" text not null,
  "isGroup" boolean not null default false,
  "isPublic" boolean not null default false,
  "ownerId" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "StoryDraft" (
  "id" text primary key,
  "sessionId" text not null references "Session" ("id") on delete cascade on update cascade,
  "content" text not null,
  "model" text,
  "createdAt" timestamptz not null default now()
);

create table if not exists "GroupMember" (
  "id" text primary key,
  "sessionId" text not null references "Session" ("id") on delete cascade on update cascade,
  "userId" text not null,
  "role" text not null default 'member',
  "joinedAt" timestamptz not null default now()
);

create index if not exists "StoryDraft_sessionId_createdAt_idx"
  on "StoryDraft" ("sessionId", "createdAt");

create index if not exists "Session_isGroup_idx"
  on "Session" ("isGroup");

create index if not exists "Session_ownerId_idx"
  on "Session" ("ownerId");

create index if not exists "Session_isPublic_idx"
  on "Session" ("isPublic");

create unique index if not exists "GroupMember_sessionId_userId_key"
  on "GroupMember" ("sessionId", "userId");

create index if not exists "GroupMember_userId_idx"
  on "GroupMember" ("userId");

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('generated-images', 'generated-images', true, 10485760, array['image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can upload generated images'
  ) then
    create policy "Authenticated users can upload generated images"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'generated-images');
  end if;
end $$;
