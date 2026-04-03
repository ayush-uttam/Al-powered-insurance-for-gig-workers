-- ============================================================
-- Gig Insurance Platform — Supabase Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. users (extends Supabase auth.users)
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null unique,
  role        text not null default 'worker' check (role in ('worker', 'admin')),
  created_at  timestamptz not null default now()
);

-- 2. worker_profiles
create table if not exists public.worker_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.users(id) on delete cascade,
  job_type          text not null,
  platform          text not null,
  average_income    numeric(12,2) not null,
  location          text not null,
  vehicle_type      text,
  license_number    text,
  years_experience  integer default 0,
  updated_at        timestamptz not null default now()
);

-- 3. policies
create table if not exists public.policies (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  policy_type        text not null check (policy_type in ('accident','health','income-protection','vehicle')),
  coverage_amount    numeric(15,2) not null,
  estimated_premium  numeric(12,2),
  premium_frequency  text not null check (premium_frequency in ('daily','weekly','monthly')),
  additional_riders  text[] default '{}',
  status             text not null default 'active' check (status in ('active','paused','expired','cancelled')),
  start_date         date not null,
  end_date           date not null,
  created_at         timestamptz not null default now()
);

-- 4. claims
create table if not exists public.claims (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  policy_id      uuid not null references public.policies(id) on delete restrict,
  claim_type     text not null,
  claim_amount   numeric(15,2) not null,
  incident_date  date not null,
  description    text not null,
  evidence_urls  text[] default '{}',
  status         text not null default 'pending' check (status in ('pending','approved','rejected','investigating')),
  fraud_status   text not null default 'not_checked' check (fraud_status in ('not_checked','cleared','flagged','investigating')),
  created_at     timestamptz not null default now()
);

-- 5. trigger_events
create table if not exists public.trigger_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  trigger_type  text not null,
  outcome       text not null,
  policy_action text,
  metadata      jsonb default '{}',
  triggered_at  timestamptz not null default now()
);

-- 6. ai_risk_scores
create table if not exists public.ai_risk_scores (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references public.users(id) on delete cascade,
  score              integer not null check (score between 0 and 100),
  risk_tier          text not null check (risk_tier in ('low','medium','high','very_high')),
  premium_multiplier numeric(4,2) not null,
  input_data         jsonb default '{}',
  scored_at          timestamptz not null default now()
);

-- 7. fraud_checks
create table if not exists public.fraud_checks (
  id          uuid primary key default gen_random_uuid(),
  claim_id    uuid not null references public.claims(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  fraud_score integer not null check (fraud_score between 0 and 100),
  fraud_risk  text not null check (fraud_risk in ('low','medium','high')),
  verdict     text not null check (verdict in ('approve','manual_review','flag_for_investigation')),
  flags       text[] default '{}',
  checked_at  timestamptz not null default now()
);

-- ── Indexes for common query patterns ──────────────────────────
create index if not exists idx_policies_user       on public.policies(user_id);
create index if not exists idx_claims_user         on public.claims(user_id);
create index if not exists idx_claims_policy       on public.claims(policy_id);
create index if not exists idx_trigger_events_user on public.trigger_events(user_id);
create index if not exists idx_fraud_checks_claim  on public.fraud_checks(claim_id);

-- ── Row Level Security ─────────────────────────────────────────
alter table public.users            enable row level security;
alter table public.worker_profiles  enable row level security;
alter table public.policies         enable row level security;
alter table public.claims           enable row level security;
alter table public.trigger_events   enable row level security;
alter table public.ai_risk_scores   enable row level security;
alter table public.fraud_checks     enable row level security;

-- Users can only read/write their own rows
create policy "users: own row" on public.users
  for all using (auth.uid() = id);

create policy "worker_profiles: own row" on public.worker_profiles
  for all using (auth.uid() = user_id);

create policy "policies: own row" on public.policies
  for all using (auth.uid() = user_id);

create policy "claims: own row" on public.claims
  for all using (auth.uid() = user_id);

create policy "trigger_events: own row" on public.trigger_events
  for all using (auth.uid() = user_id);

create policy "ai_risk_scores: own row" on public.ai_risk_scores
  for all using (auth.uid() = user_id);

create policy "fraud_checks: own row" on public.fraud_checks
  for all using (auth.uid() = user_id);
