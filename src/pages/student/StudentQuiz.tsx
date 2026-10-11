import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  ClipboardList,
  Timer,
  Flag,
} from 'lucide-react';
import type { Quiz, StudentQuestionView, QuizAttempt } from '@/types';

type Phase = 'loading' | 'details' | 'quiz' | 'submitting';

export default function StudentQuiz() {
  const { accessCode } = useParams<{ accessCode: string }>();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<StudentQuestionView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    async function loadQuiz() {
      if (!accessCode) return;
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('access_code', accessCode)
        .eq('status', 'published')
        .maybeSingle();

      if (error || !data) {
        setError('Quiz not found or no longer available. Please check your link and try again.');
        setPhase('loading');
        return;
      }

      const q = data as Quiz;

      // Check availability window
      const now = new Date();
      if (q.start_date && new Date(q.start_date) > now) {
        setError('This quiz has not started yet. Please come back later.');
        return;
      }
      if (q.end_date && new Date(q.end_date) < now) {
        setError('This quiz has ended and is no longer accepting submissions.');
        return;
      }

      setQuiz(q);

      const { data: qq } = await supabase
        .from('quiz_questions_student')
        .select('*')
        .eq('quiz_id', q.id)
        .order('display_order');

      if (!qq || qq.length === 0) {
        setError('This quiz has no questions.');
        return;
      }

      // Shuffle if enabled
      let qs = qq as StudentQuestionView[];
      if (q.shuffle_questions) {
        qs = [...qs].sort(() => Math.random() - 0.5);
      }
      setQuestions(qs);
      setPhase('details');
    }
    loadQuiz();
  }, [accessCode]);

  // Timer
  useEffect(() => {
    if (phase !== 'quiz' || !timeLeft) return;
    if (timeLeft <= 0) {
      toast.error('Time is up! Submitting your quiz.');
      handleSubmit();
      return;
    }
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, phase]);

  const startQuiz = async () => {
    if (!studentName.trim() || !studentId.trim()) {
      toast.error('Please enter your name and student ID');
      return;
    }
    if (!quiz) return;

    // Check attempt count
    const { count } = await supabase
      .from('quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_id', quiz.id)
      .eq('student_identifier', studentId.trim())
      .in('status', ['submitted', 'graded']);

    if (count !== null && count >= quiz.max_attempts) {
      setError(`You have already used all ${quiz.max_attempts} attempt${quiz.max_attempts > 1 ? 's' : ''} for this quiz.`);
      return;
    }

    // Create attempt
    const { data: att, error: attError } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: quiz.id,
        student_name: studentName.trim(),
        student_identifier: studentId.trim(),
        status: 'in_progress',
        attempt_number: (count || 0) + 1,
      })
      .select()
      .single();

    if (attError || !att) {
      toast.error('Failed to start quiz. Please try again.');
      return;
    }

    setAttempt(att as QuizAttempt);
    if (quiz.time_limit_minutes) {
      setTimeLeft(quiz.time_limit_minutes * 60);
    }
    setPhase('quiz');
  };

  const setAnswer = (questionId: string, value: string | null) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const answeredCount = questions.filter((q) => answers[q.question_id]).length;

  const handleSubmit = async () => {
    if (!quiz || !attempt) return;
    setShowConfirm(false);
    setPhase('submitting');

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          quizId: quiz.id,
          attemptId: attempt.id,
          studentName: studentName.trim(),
          studentIdentifier: studentId.trim(),
          responses: questions.map((q) => ({
            questionId: q.question_id,
            selectedAnswer: answers[q.question_id] || null,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      toast.success('Quiz submitted successfully!');
      navigate(`/quiz/${accessCode}/result/${attempt.id}`, {
        state: { result, quiz },
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit quiz');
      setPhase('quiz');
    }
  };

  // Loading / error state
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50/50 to-white px-4">
        <Logo />
        <Card className="mt-8 max-w-md animate-scale-in">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="mt-4 font-medium text-foreground">{error}</p>
            <p className="mt-2 text-sm text-muted-foreground">If you believe this is an error, please contact your teacher.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50/50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Student details form
  if (phase === 'details') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50/50 to-white px-4 py-8">
        <Logo />
        <Card className="mt-8 w-full max-w-lg animate-scale-in">
          <CardHeader>
            <CardTitle className="text-xl">{quiz?.title}</CardTitle>
            {quiz?.description && <p className="text-sm text-muted-foreground">{quiz.description}</p>}
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Quiz info */}
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-4 text-sm">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">{questions.length} questions</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">{quiz?.total_marks} marks</span>
              </div>
              {quiz?.time_limit_minutes && (
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">{quiz.time_limit_minutes} min</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Max {quiz?.max_attempts} attempt{quiz!.max_attempts > 1 ? 's' : ''}</span>
              </div>
            </div>

            {quiz?.instructions && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <p className="font-medium">Instructions:</p>
                <p className="mt-1">{quiz.instructions}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Your Full Name *</Label>
              <Input id="name" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Enter your full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sid">Student ID / Roll Number *</Label>
              <Input id="sid" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Enter your student ID" />
            </div>

            <Button onClick={startQuiz} className="w-full" size="lg" disabled={!studentName.trim() || !studentId.trim()}>
              Start Quiz <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'submitting') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50/50 to-white">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium text-foreground">Submitting your quiz...</p>
      </div>
    );
  }

  // Quiz taking interface
  const question = questions[currentQ];
  const progress = ((currentQ + 1) / questions.length) * 100;
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <span className="text-sm font-semibold text-foreground truncate">{quiz?.title}</span>
          {timeLeft !== null && (
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium ${timeLeft < 60 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-primary'}`}>
              <Clock className="h-4 w-4" />
              {formatTime(timeLeft)}
            </div>
          )}
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Question {currentQ + 1} of {questions.length}</span>
            <span>{answeredCount} answered</span>
          </div>
          <Progress value={progress} className="mt-1 h-1.5" />
        </div>
      </header>

      {/* Question navigation */}
      <div className="mx-auto max-w-3xl px-4 pt-4">
        <div className="flex flex-wrap gap-2">
          {questions.map((q, i) => (
            <button
              key={q.question_id}
              onClick={() => setCurrentQ(i)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                i === currentQ
                  ? 'bg-primary text-primary-foreground'
                  : answers[q.question_id]
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Question content */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Card className="animate-fade-in" key={question.question_id}>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-primary">
                {question.question_type === 'mcq' ? 'Multiple Choice' : question.question_type === 'true_false' ? 'True / False' : 'Short Answer'}
              </span>
              <span className="text-xs text-muted-foreground">{question.marks} marks</span>
            </div>

            <h2 className="text-lg font-medium text-foreground">{question.question_text}</h2>

            <div className="mt-6">
              {question.question_type === 'mcq' || question.question_type === 'true_false' ? (
                <RadioGroup
                  value={answers[question.question_id] || ''}
                  onValueChange={(v) => setAnswer(question.question_id, v)}
                >
                  <div className="space-y-3">
                    {question.options.map((opt, i) => (
                      <label
                        key={i}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                          answers[question.question_id] === opt
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/30'
                        }`}
                      >
                        <RadioGroupItem value={opt} id={`opt-${i}`} />
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-sm font-medium">
                          {question.question_type === 'true_false' ? (opt === 'True' ? 'T' : 'F') : String.fromCharCode(65 + i)}
                        </span>
                        <span className="text-sm text-foreground">{opt}</span>
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              ) : (
                <Textarea
                  value={answers[question.question_id] || ''}
                  onChange={(e) => setAnswer(question.question_id, e.target.value)}
                  placeholder="Type your answer here..."
                  rows={5}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentQ((prev) => Math.max(0, prev - 1))}
            disabled={currentQ === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          {currentQ < questions.length - 1 ? (
            <Button onClick={() => setCurrentQ((prev) => prev + 1)}>
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setShowConfirm(true)}>
              <CheckCircle className="mr-1 h-4 w-4" /> Submit Quiz
            </Button>
          )}
        </div>

        {currentQ === questions.length - 1 && (
          <div className="mt-3 text-center text-xs text-muted-foreground">
            {answeredCount} of {questions.length} questions answered
          </div>
        )}
      </main>

      {/* Submit confirmation */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} out of {questions.length} questions.
              {answeredCount < questions.length && ' Unanswered questions will receive 0 marks.'}
              {' '}You cannot change your answers after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>
              Submit Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
