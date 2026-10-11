export type QuestionType = 'mcq' | 'true_false' | 'short_answer';
export type QuizStatus = 'draft' | 'published';
export type AttemptStatus = 'in_progress' | 'submitted' | 'graded';
export type EvaluationStatus = 'auto' | 'pending_manual' | 'graded';

export interface Profile {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

export interface Question {
  id: string;
  teacher_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];
  correct_answer: string | null;
  marks: number;
  explanation: string | null;
  topic: string | null;
  created_at: string;
}

export interface Quiz {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  subject: string | null;
  status: QuizStatus;
  access_code: string | null;
  time_limit_minutes: number | null;
  total_marks: number;
  max_attempts: number;
  negative_marking: number;
  show_answers: boolean;
  shuffle_questions: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_id: string;
  display_order: number;
  marks_override: number | null;
  question?: Question;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_name: string;
  student_identifier: string;
  started_at: string;
  submitted_at: string | null;
  score: number;
  total_marks: number;
  percentage: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  status: AttemptStatus;
  attempt_number: number;
}

export interface StudentResponse {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_answer: string | null;
  marks_awarded: number;
  evaluation_status: EvaluationStatus;
  is_correct: boolean | null;
  created_at: string;
}

export interface StudentQuestionView {
  quiz_id: string;
  question_id: string;
  display_order: number;
  marks: number;
  question_text: string;
  question_type: QuestionType;
  options: string[];
}

export interface ParsedQuestion {
  question_text: string;
  question_type: QuestionType;
  options: string[];
  correct_answer: string | null;
  marks: number;
  explanation: string | null;
  topic: string | null;
  _row: number;
  _valid: boolean;
  _errors: string[];
}
