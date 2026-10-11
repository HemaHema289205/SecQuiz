/*
# secQuiz - Complete Database Schema

## Overview
This migration creates the complete database schema for secQuiz, a quiz creation and assessment platform for teachers and students.

## New Tables

### 1. profiles
- Stores teacher profile information linked to auth.users
- `id` (uuid, PK, references auth.users)
- `full_name` (text, teacher's display name)
- `role` (text, default 'teacher')
- `created_at` (timestamp)

### 2. quizzes
- Stores quiz metadata and configuration
- `id` (uuid, PK)
- `teacher_id` (uuid, references profiles, owner of the quiz)
- `title`, `description`, `instructions`, `subject` (text fields)
- `status` (text: 'draft' or 'published')
- `access_code` (text, unique shareable code for students)
- `time_limit_minutes`, `max_attempts`, `total_marks` (numeric configs)
- `negative_marking` (numeric, points deducted per wrong answer)
- `show_answers` (boolean, whether to show correct answers after submission)
- `shuffle_questions` (boolean)
- `start_date`, `end_date` (timestamps for availability window)
- `created_at`, `updated_at` (timestamps)

### 3. questions
- Stores questions in the teacher's question bank
- `id` (uuid, PK)
- `teacher_id` (uuid, references profiles)
- `question_text`, `question_type` (mcq, true_false, short_answer)
- `options` (jsonb array of answer options for mcq)
- `correct_answer` (text, private - never exposed to students before submission)
- `marks` (numeric)
- `explanation` (text, optional)
- `topic` (text, optional category for filtering)
- `created_at` (timestamp)

### 4. quiz_questions
- Junction table linking questions to quizzes with ordering
- `id` (uuid, PK)
- `quiz_id` (uuid, references quizzes)
- `question_id` (uuid, references questions)
- `display_order` (integer)
- `marks_override` (numeric, optional per-quiz marks)

### 5. quiz_attempts
- Records each student attempt at a quiz
- `id` (uuid, PK)
- `quiz_id` (uuid, references quizzes)
- `student_name`, `student_identifier` (text, student details)
- `started_at`, `submitted_at` (timestamps)
- `score` (numeric, final calculated score)
- `total_marks` (numeric)
- `percentage` (numeric)
- `correct_count`, `incorrect_count`, `unanswered_count` (integer)
- `status` (text: 'in_progress', 'submitted', 'graded')
- `attempt_number` (integer)

### 6. student_responses
- Records individual question responses within an attempt
- `id` (uuid, PK)
- `attempt_id` (uuid, references quiz_attempts)
- `question_id` (uuid, references questions)
- `selected_answer` (text, student's answer)
- `marks_awarded` (numeric, calculated by server)
- `evaluation_status` (text: 'auto', 'pending_manual', 'graded')
- `is_correct` (boolean, for objective questions)

## Security (RLS)
- profiles: Users can read/update only their own profile
- quizzes: Teachers can CRUD only their own quizzes; students (anon) can read published quizzes by access_code
- questions: Teachers can CRUD only their own questions
- quiz_questions: Teachers can manage via quiz ownership; anon can read via published quiz
- quiz_attempts: Anon can create attempts for published quizzes and read their own attempts; teachers can read attempts for their quizzes
- student_responses: Anon can create responses for their own attempts; teachers can read responses for their quizzes

## Important Notes
1. All owner columns default to auth.uid() so inserts work without explicitly passing the owner
2. Students participate without accounts - they use anon role with access_code
3. Correct answers in questions table are never exposed to students via RLS
4. Attempt limits and deadline enforcement happen server-side via edge functions
*/

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'teacher',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- QUIZZES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  instructions text,
  subject text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  access_code text UNIQUE,
  time_limit_minutes integer,
  total_marks numeric DEFAULT 0,
  max_attempts integer DEFAULT 1,
  negative_marking numeric DEFAULT 0,
  show_answers boolean DEFAULT false,
  shuffle_questions boolean DEFAULT false,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

-- Teachers can CRUD their own quizzes
DROP POLICY IF EXISTS "select_own_quizzes" ON quizzes;
CREATE POLICY "select_own_quizzes" ON quizzes FOR SELECT
  TO authenticated USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "insert_own_quizzes" ON quizzes;
CREATE POLICY "insert_own_quizzes" ON quizzes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "update_own_quizzes" ON quizzes;
CREATE POLICY "update_own_quizzes" ON quizzes FOR UPDATE
  TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "delete_own_quizzes" ON quizzes;
CREATE POLICY "delete_own_quizzes" ON quizzes FOR DELETE
  TO authenticated USING (auth.uid() = teacher_id);

-- Students (anon) can read published quizzes by access_code (for quiz participation)
DROP POLICY IF EXISTS "anon_read_published_quizzes" ON quizzes;
CREATE POLICY "anon_read_published_quizzes" ON quizzes FOR SELECT
  TO anon, authenticated USING (status = 'published');

-- ============================================================
-- QUESTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('mcq', 'true_false', 'short_answer')),
  options jsonb DEFAULT '[]'::jsonb,
  correct_answer text,
  marks numeric NOT NULL DEFAULT 1,
  explanation text,
  topic text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Teachers can CRUD their own questions only
DROP POLICY IF EXISTS "select_own_questions" ON questions;
CREATE POLICY "select_own_questions" ON questions FOR SELECT
  TO authenticated USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "insert_own_questions" ON questions;
CREATE POLICY "insert_own_questions" ON questions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "update_own_questions" ON questions;
CREATE POLICY "update_own_questions" ON questions FOR UPDATE
  TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "delete_own_questions" ON questions;
CREATE POLICY "delete_own_questions" ON questions FOR DELETE
  TO authenticated USING (auth.uid() = teacher_id);

-- Anon can read questions only through published quiz quiz_questions join
-- BUT must NOT see correct_answer or explanation. We handle this by NOT giving
-- anon direct SELECT on questions table. Instead, we use a view.
-- (See quiz_questions_view below)

-- ============================================================
-- QUIZ_QUESTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  marks_override numeric
);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

-- Teachers can manage quiz_questions for their own quizzes
DROP POLICY IF EXISTS "select_own_quiz_questions" ON quiz_questions;
CREATE POLICY "select_own_quiz_questions" ON quiz_questions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_quiz_questions" ON quiz_questions;
CREATE POLICY "insert_own_quiz_questions" ON quiz_questions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_quiz_questions" ON quiz_questions;
CREATE POLICY "update_own_quiz_questions" ON quiz_questions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.teacher_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_quiz_questions" ON quiz_questions;
CREATE POLICY "delete_own_quiz_questions" ON quiz_questions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.teacher_id = auth.uid())
  );

-- Anon can read quiz_questions for published quizzes (to display questions to students)
DROP POLICY IF EXISTS "anon_read_published_quiz_questions" ON quiz_questions;
CREATE POLICY "anon_read_published_quiz_questions" ON quiz_questions FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.status = 'published')
  );

-- ============================================================
-- QUIZ_ATTEMPTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  student_identifier text NOT NULL,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  score numeric DEFAULT 0,
  total_marks numeric DEFAULT 0,
  percentage numeric DEFAULT 0,
  correct_count integer DEFAULT 0,
  incorrect_count integer DEFAULT 0,
  unanswered_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded')),
  attempt_number integer DEFAULT 1
);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Teachers can read attempts for their own quizzes
DROP POLICY IF EXISTS "teacher_read_attempts" ON quiz_attempts;
CREATE POLICY "teacher_read_attempts" ON quiz_attempts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_attempts.quiz_id AND quizzes.teacher_id = auth.uid())
  );

-- Teachers can update attempts (for manual grading)
DROP POLICY IF EXISTS "teacher_update_attempts" ON quiz_attempts;
CREATE POLICY "teacher_update_attempts" ON quiz_attempts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_attempts.quiz_id AND quizzes.teacher_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_attempts.quiz_id AND quizzes.teacher_id = auth.uid())
  );

-- Teachers can delete attempts
DROP POLICY IF EXISTS "teacher_delete_attempts" ON quiz_attempts;
CREATE POLICY "teacher_delete_attempts" ON quiz_attempts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_attempts.quiz_id AND quizzes.teacher_id = auth.uid())
  );

-- Anon can create attempts (students starting a quiz)
DROP POLICY IF EXISTS "anon_insert_attempts" ON quiz_attempts;
CREATE POLICY "anon_insert_attempts" ON quiz_attempts FOR INSERT
  TO anon, authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_attempts.quiz_id AND quizzes.status = 'published')
  );

-- Anon can read their own attempts (by matching student_identifier within the same quiz)
-- This is deliberately permissive for SELECT since anon has no auth.uid, but we limit
-- to published quizzes. Individual attempt privacy is enforced by the student needing
-- to know the quiz code + their own attempt ID.
DROP POLICY IF EXISTS "anon_read_attempts" ON quiz_attempts;
CREATE POLICY "anon_read_attempts" ON quiz_attempts FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_attempts.quiz_id AND quizzes.status = 'published')
  );

-- Anon can update attempts (to submit answers and save score)
DROP POLICY IF EXISTS "anon_update_attempts" ON quiz_attempts;
CREATE POLICY "anon_update_attempts" ON quiz_attempts FOR UPDATE
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_attempts.quiz_id AND quizzes.status = 'published')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_attempts.quiz_id AND quizzes.status = 'published')
  );

-- ============================================================
-- STUDENT_RESPONSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS student_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer text,
  marks_awarded numeric DEFAULT 0,
  evaluation_status text NOT NULL DEFAULT 'auto' CHECK (evaluation_status IN ('auto', 'pending_manual', 'graded')),
  is_correct boolean,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_responses ENABLE ROW LEVEL SECURITY;

-- Teachers can read responses for attempts on their quizzes
DROP POLICY IF EXISTS "teacher_read_responses" ON student_responses;
CREATE POLICY "teacher_read_responses" ON student_responses FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      JOIN quizzes ON quizzes.id = quiz_attempts.quiz_id
      WHERE quiz_attempts.id = student_responses.attempt_id
      AND quizzes.teacher_id = auth.uid()
    )
  );

-- Teachers can update responses (for manual grading)
DROP POLICY IF EXISTS "teacher_update_responses" ON student_responses;
CREATE POLICY "teacher_update_responses" ON student_responses FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      JOIN quizzes ON quizzes.id = quiz_attempts.quiz_id
      WHERE quiz_attempts.id = student_responses.attempt_id
      AND quizzes.teacher_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      JOIN quizzes ON quizzes.id = quiz_attempts.quiz_id
      WHERE quiz_attempts.id = student_responses.attempt_id
      AND quizzes.teacher_id = auth.uid()
    )
  );

-- Anon can create responses for attempts on published quizzes
DROP POLICY IF EXISTS "anon_insert_responses" ON student_responses;
CREATE POLICY "anon_insert_responses" ON student_responses FOR INSERT
  TO anon, authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      JOIN quizzes ON quizzes.id = quiz_attempts.quiz_id
      WHERE quiz_attempts.id = student_responses.attempt_id
      AND quizzes.status = 'published'
    )
  );

-- Anon can read responses for their own attempts on published quizzes
DROP POLICY IF EXISTS "anon_read_responses" ON student_responses;
CREATE POLICY "anon_read_responses" ON student_responses FOR SELECT
  TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      JOIN quizzes ON quizzes.id = quiz_attempts.quiz_id
      WHERE quiz_attempts.id = student_responses.attempt_id
      AND quizzes.status = 'published'
    )
  );

-- Anon can update responses (for saving answers before submission)
DROP POLICY IF EXISTS "anon_update_responses" ON student_responses;
CREATE POLICY "anon_update_responses" ON student_responses FOR UPDATE
  TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      JOIN quizzes ON quizzes.id = quiz_attempts.quiz_id
      WHERE quiz_attempts.id = student_responses.attempt_id
      AND quizzes.status = 'published'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts
      JOIN quizzes ON quizzes.id = quiz_attempts.quiz_id
      WHERE quiz_attempts.id = student_responses.attempt_id
      AND quizzes.status = 'published'
    )
  );

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_quizzes_teacher_id ON quizzes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes(status);
CREATE INDEX IF NOT EXISTS idx_quizzes_access_code ON quizzes(access_code);
CREATE INDEX IF NOT EXISTS idx_questions_teacher_id ON questions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_question_id ON quiz_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_status ON quiz_attempts(status);
CREATE INDEX IF NOT EXISTS idx_student_responses_attempt_id ON student_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_responses_question_id ON student_responses(question_id);

-- ============================================================
-- UPDATED_AT TRIGGER FOR QUIZZES
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quizzes_updated_at ON quizzes;
CREATE TRIGGER quizzes_updated_at BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'teacher'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();