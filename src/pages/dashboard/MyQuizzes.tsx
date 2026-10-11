import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ClipboardList,
  Plus,
  Search,
  Eye,
  BarChart3,
  Trash2,
  Copy,
  ExternalLink,
  FileEdit,
  CheckCircle2,
} from 'lucide-react';
import type { Quiz } from '@/types';

export default function MyQuizzes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});

  const loadQuizzes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from('quizzes').select('*').eq('teacher_id', user.id);

    if (search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load quizzes');
    } else {
      setQuizzes(data || []);
      // Load attempt counts
      if (data && data.length > 0) {
        const counts: Record<string, number> = {};
        await Promise.all(
          data.map(async (quiz) => {
            const { count } = await supabase
              .from('quiz_attempts')
              .select('*', { count: 'exact', head: true })
              .eq('quiz_id', quiz.id)
              .in('status', ['submitted', 'graded']);
            counts[quiz.id] = count || 0;
          })
        );
        setAttemptCounts(counts);
      }
    }
    setLoading(false);
  }, [user, search, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => loadQuizzes(), 300);
    return () => clearTimeout(timeout);
  }, [loadQuizzes]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('quizzes').delete().eq('id', deleteId);
    if (error) {
      toast.error('Failed to delete quiz');
    } else {
      toast.success('Quiz deleted');
      loadQuizzes();
    }
    setDeleteId(null);
  };

  const copyLink = (quiz: Quiz) => {
    const link = `${window.location.origin}/quiz/${quiz.access_code}`;
    navigator.clipboard.writeText(link);
    toast.success('Quiz link copied to clipboard');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Quizzes</h1>
          <p className="mt-1 text-muted-foreground">Manage all your quizzes in one place.</p>
        </div>
        <Button onClick={() => navigate('/dashboard/create')}>
          <Plus className="mr-1 h-4 w-4" /> Create Quiz
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search quizzes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-foreground">No quizzes found</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first quiz to get started.</p>
            <Button className="mt-4" onClick={() => navigate('/dashboard/create')}>
              <Plus className="mr-1 h-4 w-4" /> Create Quiz
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="group flex flex-col transition-all hover:shadow-md">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      quiz.status === 'published'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-orange-50 text-orange-700'
                    }`}
                  >
                    {quiz.status === 'published' ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Published
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <FileEdit className="h-3 w-3" /> Draft
                      </span>
                    )}
                  </span>
                  {quiz.subject && (
                    <span className="text-xs text-muted-foreground">{quiz.subject}</span>
                  )}
                </div>

                <h3 className="font-semibold text-foreground">{quiz.title}</h3>
                {quiz.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{quiz.description}</p>
                )}

                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{quiz.total_marks} marks</span>
                  {quiz.time_limit_minutes && <span>{quiz.time_limit_minutes} min</span>}
                  <span>{attemptCounts[quiz.id] || 0} submissions</span>
                </div>

                <div className="mt-auto flex items-center gap-1 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/dashboard/quizzes/${quiz.id}`)}
                  >
                    <Eye className="mr-1 h-4 w-4" /> View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/dashboard/quizzes/${quiz.id}/results`)}
                  >
                    <BarChart3 className="mr-1 h-4 w-4" /> Results
                  </Button>
                  {quiz.status === 'published' && (
                    <Button variant="ghost" size="icon" onClick={() => copyLink(quiz)} title="Copy share link">
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(quiz.id)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the quiz and all associated student attempts and responses.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
