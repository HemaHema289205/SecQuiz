import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { generateAccessCode } from '@/lib/access-code';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  BarChart3,
  FileEdit,
  Loader2,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { Quiz, Question, QuizAttempt } from '@/types';

export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data: quizData } = await supabase.from('quizzes').select('*').eq('id', id).maybeSingle();
      if (!quizData) { setLoading(false); return; }
      setQuiz(quizData as Quiz);

      const { data: qq } = await supabase
        .from('quiz_questions')
        .select('question:questions(*)')
        .eq('quiz_id', id)
        .order('display_order');
      const qs = (qq || []).map((item: any) => item.question).filter(Boolean) as Question[];
      setQuestions(qs);

      const { data: att } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', id)
        .order('submitted_at', { ascending: false });
      setAttempts(att || []);
      setLoading(false);
    }
    load();
  }, [id]);

  const copyLink = () => {
    if (!quiz?.access_code) return;
    const link = `${window.location.origin}/quiz/${quiz.access_code}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard');
  };

  const handlePublish = async () => {
    if (!quiz) return;
    setPublishing(true);
    try {
      const code = generateAccessCode();
      const { error } = await supabase
        .from('quizzes')
        .update({ status: 'published', access_code: code })
        .eq('id', quiz.id);
      if (error) throw error;
      toast.success('Quiz published! Students can now access it.');
      setQuiz({ ...quiz, status: 'published', access_code: code });
    } catch (err: any) {
      toast.error(err.message || 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!quiz) return;
    setPublishing(true);
    try {
      const { error } = await supabase
        .from('quizzes')
        .update({ status: 'draft' })
        .eq('id', quiz.id);
      if (error) throw error;
      toast.success('Quiz moved to drafts');
      setQuiz({ ...quiz, status: 'draft' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium">Quiz not found</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/dashboard/quizzes')}>Back to Quizzes</Button>
      </div>
    );
  }

  const studentLink = quiz.access_code ? `${window.location.origin}/quiz/${quiz.access_code}` : '';
  const submittedAttempts = attempts.filter((a) => a.status === 'submitted' || a.status === 'graded');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/quizzes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{quiz.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{quiz.subject || 'No subject'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/dashboard/quizzes/${quiz.id}/results`)}>
            <BarChart3 className="mr-1 h-4 w-4" /> View Results
          </Button>
          {quiz.status === 'draft' ? (
            <Button onClick={handlePublish} disabled={publishing || questions.length === 0}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish Quiz'}
            </Button>
          ) : (
            <Button variant="outline" onClick={handleUnpublish} disabled={publishing}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unpublish'}
            </Button>
          )}
        </div>
      </div>

      {questions.length === 0 && quiz.status === 'draft' && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          This quiz has no questions. Add questions from your question bank before publishing.
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Status', value: quiz.status, icon: quiz.status === 'published' ? CheckCircle2 : FileEdit },
          { label: 'Questions', value: questions.length, icon: FileEdit },
          { label: 'Total Marks', value: quiz.total_marks, icon: BarChart3 },
          { label: 'Submissions', value: submittedAttempts.length, icon: Users },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-xl font-bold capitalize text-foreground">{s.value}</p>
                </div>
                <s.icon className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sharing */}
      {quiz.status === 'published' && quiz.access_code && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Share with Students</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex-1 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground">
                {studentLink}
              </div>
              <Button onClick={copyLink}>
                <Copy className="mr-2 h-4 w-4" /> Copy Link
              </Button>
              <Button variant="outline" onClick={() => window.open(studentLink, '_blank')}>
                <ExternalLink className="mr-2 h-4 w-4" /> Open
              </Button>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              <span className="font-medium">Quiz Code:</span>
              <code className="rounded bg-white px-2 py-0.5 font-mono text-blue-800">{quiz.access_code}</code>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { navigator.clipboard.writeText(quiz.access_code!); toast.success('Code copied'); }}>
                <Copy className="h-3 w-3" /> Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings summary */}
      <Card>
        <CardHeader><CardTitle className="text-base">Quiz Settings</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Time Limit</p>
                <p className="text-sm font-medium">{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} min` : 'No limit'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Max Attempts</p>
                <p className="text-sm font-medium">{quiz.max_attempts}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Show Answers</p>
                <p className="text-sm font-medium">{quiz.show_answers ? 'Yes' : 'No'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileEdit className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Shuffle Questions</p>
                <p className="text-sm font-medium">{quiz.shuffle_questions ? 'Yes' : 'No'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Negative Marking</p>
                <p className="text-sm font-medium">{quiz.negative_marking > 0 ? `${quiz.negative_marking} pts` : 'None'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium">{new Date(quiz.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
          {quiz.description && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="mt-1 text-sm text-foreground">{quiz.description}</p>
            </div>
          )}
          {quiz.instructions && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">Instructions</p>
              <p className="mt-1 text-sm text-foreground">{quiz.instructions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Questions preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Questions ({questions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions in this quiz yet.</p>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={q.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-primary">
                        {q.question_type === 'mcq' ? 'MCQ' : q.question_type === 'true_false' ? 'T/F' : 'Short'}
                      </span>
                      <span className="text-xs text-muted-foreground">{q.marks} marks</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{q.question_text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
