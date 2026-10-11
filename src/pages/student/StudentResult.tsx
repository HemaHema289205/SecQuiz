import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/Logo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, MinusCircle, Award, TrendingUp, Home } from 'lucide-react';
import type { Quiz, QuizAttempt } from '@/types';

interface ResultData {
  score: number;
  totalMarks: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  status: string;
  showAnswers: boolean;
}

export default function StudentResult() {
  const { accessCode, attemptId } = useParams<{ accessCode: string; attemptId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);

  useEffect(() => {
    async function load() {
      // Try to get result from navigation state first
      const stateData = location.state as { result?: ResultData; quiz?: Quiz } | null;
      if (stateData?.result && stateData?.quiz) {
        setResult(stateData.result);
        setQuiz(stateData.quiz);
      }

      // Always fetch the attempt from DB for accuracy
      if (!attemptId) return;
      const { data: att } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('id', attemptId)
        .maybeSingle();

      if (att) {
        setAttempt(att as QuizAttempt);
        if (!result) {
          setResult({
            score: Number(att.score),
            totalMarks: Number(att.total_marks),
            percentage: Number(att.percentage),
            correctCount: att.correct_count,
            incorrectCount: att.incorrect_count,
            unansweredCount: att.unanswered_count,
            status: att.status,
            showAnswers: stateData?.result?.showAnswers ?? false,
          });
        }
      }

      if (!quiz && att) {
        const { data: q } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', att.quiz_id)
          .maybeSingle();
        if (q) setQuiz(q as Quiz);
      }

      setLoading(false);
    }
    load();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50/50 to-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50/50 to-white px-4">
        <Logo />
        <Card className="mt-8 max-w-md">
          <CardContent className="py-12 text-center">
            <p className="font-medium text-foreground">Result not found</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const passStatus = result.percentage >= 40;
  const isPending = result.status === 'submitted';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50/50 to-white px-4 py-8">
      <Logo />

      <Card className="mt-8 w-full max-w-lg animate-scale-in">
        <CardContent className="p-8">
          {/* Score circle */}
          <div className="flex flex-col items-center text-center">
            <div className={`flex h-28 w-28 items-center justify-center rounded-full ${passStatus ? 'bg-green-50' : 'bg-orange-50'}`}>
              <div className="text-center">
                <p className={`text-3xl font-bold ${passStatus ? 'text-green-600' : 'text-orange-500'}`}>
                  {result.percentage}%
                </p>
                <p className="text-xs text-muted-foreground">score</p>
              </div>
            </div>

            <h2 className="mt-4 text-xl font-bold text-foreground">
              {isPending ? 'Submission Received!' : passStatus ? 'Well Done!' : 'Keep Practicing!'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {quiz?.title || 'Quiz'}
            </p>
          </div>

          {/* Score breakdown */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-foreground">Your Score</span>
              </div>
              <span className="text-sm font-bold text-foreground">
                {result.score} / {result.totalMarks}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center rounded-lg border border-green-200 bg-green-50 p-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="mt-1 text-lg font-bold text-green-700">{result.correctCount}</p>
                <p className="text-xs text-green-600">Correct</p>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-red-200 bg-red-50 p-3">
                <XCircle className="h-5 w-5 text-red-500" />
                <p className="mt-1 text-lg font-bold text-red-600">{result.incorrectCount}</p>
                <p className="text-xs text-red-500">Incorrect</p>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50 p-3">
                <MinusCircle className="h-5 w-5 text-slate-400" />
                <p className="mt-1 text-lg font-bold text-slate-600">{result.unansweredCount}</p>
                <p className="text-xs text-slate-500">Skipped</p>
              </div>
            </div>

            {isPending && (
              <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
                <TrendingUp className="h-4 w-4 shrink-0" />
                Your quiz includes short-answer questions that require manual grading by your teacher.
                Your final score may change after grading.
              </div>
            )}

            {!result.showAnswers && (
              <p className="text-center text-xs text-muted-foreground">
                Answer details are not shown for this quiz. Contact your teacher for feedback.
              </p>
            )}
          </div>

          <Button variant="outline" className="mt-6 w-full" onClick={() => navigate('/')}>
            <Home className="mr-2 h-4 w-4" /> Done
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
