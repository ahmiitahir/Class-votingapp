-- =============================================================
-- Migration V2: Peer Title-Giving System
-- Run this in the Supabase SQL Editor
-- =============================================================

-- 1. Add password column to students (null = not signed up yet)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS password text;

-- 2. Create student_titles table
CREATE TABLE IF NOT EXISTS public.student_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  title_text text NOT NULL CHECK (char_length(title_text) <= 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_giver_receiver UNIQUE(giver_id, receiver_id),
  CONSTRAINT no_self_title CHECK (giver_id != receiver_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_student_titles_giver ON public.student_titles(giver_id);
CREATE INDEX IF NOT EXISTS idx_student_titles_receiver ON public.student_titles(receiver_id);
CREATE INDEX IF NOT EXISTS idx_students_password ON public.students(password);

-- 4. Enable RLS
ALTER TABLE public.student_titles ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for student_titles
DROP POLICY IF EXISTS "Public can read student titles" ON public.student_titles;
CREATE POLICY "Public can read student titles"
ON public.student_titles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can insert student titles" ON public.student_titles;
CREATE POLICY "Public can insert student titles"
ON public.student_titles FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update student titles" ON public.student_titles;
CREATE POLICY "Public can update student titles"
ON public.student_titles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete student titles" ON public.student_titles;
CREATE POLICY "Public can delete student titles"
ON public.student_titles FOR DELETE TO anon, authenticated USING (true);

-- 6. Update students RLS to allow password updates
-- (Already has full CRUD from schema.sql, so no changes needed)

COMMENT ON TABLE public.student_titles IS
'Each student gives exactly one custom title to each classmate. Constraint ensures uniqueness per giver-receiver pair.';
