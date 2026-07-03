
UPDATE public.settings
SET value = value || '{"block_id": "", "verify_server": false}'::jsonb,
    updated_at = now()
WHERE key = 'ads';

INSERT INTO public.settings(key, value) VALUES
  ('admin_bootstrap', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
