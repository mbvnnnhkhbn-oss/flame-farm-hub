ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_category_check CHECK (category IN ('main','partner','other'));

INSERT INTO public.settings (key, value)
VALUES (
  'view_site',
  '{"daily_limit": 10, "reward": 3, "watch_seconds": 10, "links": ["https://omg10.com/4/10176898", "https://omg10.com/4/10339385"]}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
