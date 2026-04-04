-- ============================================================
-- FIX: Row-Level Security bypass for service_role (backend)
-- ============================================================
-- Your backend uses the Supabase service role key, which should
-- bypass RLS. However the policies only cover auth.uid() checks
-- and don't explicitly grant access to the service_role.
--
-- When auth.uid() returns NULL (no user session on server),
-- the INSERT/UPDATE is blocked even with the service role key
-- if Supabase's internal bypass isn't working correctly.
--
-- This adds explicit `service_role` bypass grants on every table.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. Drop conflicting policies if they exist ───────────────
DROP POLICY IF EXISTS "service_role bypass users"           ON public.users;
DROP POLICY IF EXISTS "service_role bypass worker_profiles" ON public.worker_profiles;
DROP POLICY IF EXISTS "service_role bypass policies"        ON public.policies;
DROP POLICY IF EXISTS "service_role bypass claims"          ON public.claims;
DROP POLICY IF EXISTS "service_role bypass trigger_events"  ON public.trigger_events;
DROP POLICY IF EXISTS "service_role bypass ai_risk_scores"  ON public.ai_risk_scores;
DROP POLICY IF EXISTS "service_role bypass fraud_checks"    ON public.fraud_checks;

-- ── 2. Add service_role bypass policies ──────────────────────
-- These allow the backend (which uses the service role key) to
-- read and write all rows regardless of auth.uid().

CREATE POLICY "service_role bypass users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role bypass worker_profiles"
  ON public.worker_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role bypass policies"
  ON public.policies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role bypass claims"
  ON public.claims
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role bypass trigger_events"
  ON public.trigger_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role bypass ai_risk_scores"
  ON public.ai_risk_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role bypass fraud_checks"
  ON public.fraud_checks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

SELECT 'RLS service_role bypass policies applied successfully' AS status;
