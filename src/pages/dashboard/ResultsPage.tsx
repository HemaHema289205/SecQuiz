import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Search, Eye, ArrowRight } from 'lucide-react';
import type { Quiz, QuizAttempt } from '@/types';

interface QuizWithAttempts extends Quiz {
  attempt_count: number;
  recent_attempts: QuizAttempt[];
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<QuizWithAttempts[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from('quizzes').select('*').eq('teacher_id', user.id);
    if (search.trim()) q = q.ilike('title', `%${search.trim()}%`);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data: quizData } = await q.order('created_at', { ascending: false });

    if (!quizData) { setLoading(false); return; }

    const enriched: QuizWithAttempts[] = await Promise.all(
      quizData.map(async (quiz) => {
        const { data: attempts } = await supabase
          .from('quiz_attempts')
          .select('*')
          .eq('quiz_id', quiz.id)
          .in('status', ['submitted', 'graded'])
          .order('submitted_at', { ascending: false })
          .limit(5);
        return { ...quiz, attempt_count: attempts?.length || 0, recent_attempts: attempts || [] };
      })
    );
    setQuizzes(enriched);
    setLoading(false);
  }, [user, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Results</h1>
        <p className="mt-1 text-muted-foreground">View student submissions across all your quizzes.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search quizzes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : quizzes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-foreground">No results yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create and publish a quiz to start collecting results.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{quiz.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${quiz.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                        {quiz.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {quiz.attempt_count} submission{quiz.attempt_count !== 1 ? 's' : ''} • {quiz.total_marks} marks
                    </p>
                    {quiz.recent_attempts.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {quiz.recent_attempts.slice(0, 3).map((a) => (
                          <div key={a.id} className="flex items-center justify-between rounded bg-muted/30 px-3 py-1.5 text-xs">
                            <span className="text-foreground">{a.student_name}</span>
                            <span className="font-medium text-foreground">{a.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/quizzes/${quiz.id}/results`)}>
                    <Eye className="mr-1 h-4 w-4" /> View Results <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
