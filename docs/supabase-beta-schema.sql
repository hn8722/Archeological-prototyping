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
