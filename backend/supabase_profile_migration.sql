-- ============================================================
-- Profile Extension Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Adds address, partner_id, partner_brand, is_verified to
-- worker_profiles and a license_verified flag.
-- ============================================================

-- Extend worker_profiles with new columns (safe: IF NOT EXISTS via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='worker_profiles' AND column_name='address') THEN
    ALTER TABLE public.worker_profiles ADD COLUMN address TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='worker_profiles' AND column_name='partner_brand') THEN
    ALTER TABLE public.worker_profiles ADD COLUMN partner_brand TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='worker_profiles' AND column_name='partner_id') THEN
    ALTER TABLE public.worker_profiles ADD COLUMN partner_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='worker_profiles' AND column_name='is_verified') THEN
    ALTER TABLE public.worker_profiles ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='worker_profiles' AND column_name='license_verified') THEN
    ALTER TABLE public.worker_profiles ADD COLUMN license_verified BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='worker_profiles' AND column_name='city') THEN
    ALTER TABLE public.worker_profiles ADD COLUMN city TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='worker_profiles' AND column_name='state') THEN
    ALTER TABLE public.worker_profiles ADD COLUMN state TEXT;
  END IF;
END $$;

-- Unique index on partner_id per brand (optional, comment out if not needed)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_id_brand
--   ON public.worker_profiles(partner_brand, partner_id)
--   WHERE partner_id IS NOT NULL;

SELECT 'Migration applied successfully' AS status;
