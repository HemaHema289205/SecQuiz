/*
# Create quiz_questions_student view

## Overview
Creates a view that allows students (anon role) to see questions for published quizzes
WITHOUT exposing correct_answer or explanation fields.

## New Views
- quiz_questions_student: Shows quiz_id, question_id, display_order, marks, question_text,
  question_type, and options (without correct_answer or explanation)

## Security
- The view is accessible to anon and authenticated roles
- It only returns questions for published quizzes
- correct_answer and explanation columns are NOT included in the view
*/

CREATE OR REPLACE VIEW quiz_questions_student AS
SELECT
  qq.quiz_id,
  qq.question_id,
  qq.display_order,
  COALESCE(qq.marks_override, q.marks) AS marks,
  q.question_text,
  q.question_type,
  q.options
FROM quiz_questions qq
JOIN questions q ON q.id = qq.question_id
JOIN quizzes quiz ON quiz.id = qq.quiz_id
WHERE quiz.status = 'published';

ALTER VIEW quiz_questions_student SET (security_invoker = true);

GRANT SELECT ON quiz_questions_student TO anon, authenticated;