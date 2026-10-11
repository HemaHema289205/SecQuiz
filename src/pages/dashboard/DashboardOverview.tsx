import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ClipboardList,
  CheckCircle2,
  FileEdit,
  Users,
  TrendingUp,
  Upload,
  Plus,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Quiz, QuizAttempt } from '@/types';

export default function DashboardOverview() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [recentAttempts, setRecentAttempts] = useState<QuizAttempt[]>([]);
  const [attemptCount, setAttemptCount] = useState(0);
  const [avgScore, setAvgScore] = useState(0);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const { data: quizData } = await supabase
          .from('quizzes')
          .select('*')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false });

        setQuizzes(quizData || []);

        if (quizData && quizData.length > 0) {
          const quizIds = quizData.map((q) => q.id);
          const { data: attempts } = await supabase
            .from('quiz_attempts')
            .select('*')
            .in('quiz_id', quizIds)
            .order('submitted_at', { ascending: false })
            .limit(10);

          setRecentAttempts(attempts || []);

          const { count } = await supabase
            .from('quiz_attempts')
            .select('*', { count: 'exact', head: true })
            .in('quiz_id', quizIds)
            .in('status', ['submitted', 'graded']);

          setAttemptCount(count || 0);

          if (attempts && attempts.length > 0) {
            const scored = attempts.filter((a) => a.status === 'submitted' || a.status === 'graded');
            if (scored.length > 0) {
              const avg = scored.reduce((sum, a) => sum + Number(a.percentage), 0) / scored.length;
              setAvgScore(Math.round(avg));
            }
          }
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const publishedCount = quizzes.filter((q) => q.status === 'published').length;
  const draftCount = quizzes.filter((q) => q.status === 'draft').length;

  // Chart data: submissions per day (last 7 days)
  const chartData = (() => {
    const days: { date: string; label: string; submissions: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({ date: d.toISOString().split('T')[0], label: dayStr, submissions: 0 });
    }
    recentAttempts.forEach((a) => {
      if (!a.submitted_at) return;
      const dateStr = a.submitted_at.split('T')[0];
      const day = days.find((d) => d.date === dateStr);
      if (day) day.submissions++;
    });
    return days;
  })();

  const stats = [
    {
      label: 'Total Quizzes',
      value: quizzes.length,
      icon: ClipboardList,
      color: 'bg-blue-50 text-primary',
    },
    {
      label: 'Published',
      value: publishedCount,
      icon: CheckCircle2,
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Drafts',
      value: draftCount,
      icon: FileEdit,
      color: 'bg-orange-50 text-orange-500',
    },
    {
      label: 'Total Attempts',
      value: attemptCount,
      icon: Users,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Avg Score',
      value: `${avgScore}%`,
      icon: TrendingUp,
      color: 'bg-teal-50 text-teal-600',
    },
  ];

  const quickActions = [
    {
      title: 'Upload Questions',
      description: 'Import from Excel, CSV, or add manually',
      icon: Upload,
      onClick: () => navigate('/dashboard/upload'),
    },
    {
      title: 'Create Quiz',
      description: 'Build a new quiz from your question bank',
      icon: Plus,
      onClick: () => navigate('/dashboard/create'),
    },
    {
      title: 'View Results',
      description: 'Check student scores and export data',
      icon: BarChart3,
      onClick: () => navigate('/dashboard/results'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Teacher'}
        </h1>
        <p className="mt-1 text-muted-foreground">Here's an overview of your quizzes and student performance.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : stats.map((stat, i) => (
              <Card key={i} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${stat.color}`}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Performance Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.every((d) => d.submissions === 0) ? (
              <div className="flex h-64 items-center justify-center text-center">
                <div>
                  <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">No submissions yet</p>
                  <p className="text-xs text-muted-foreground/70">Student submissions will appear here</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="submissions"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorSubmissions)"
                    name="Submissions"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className="group flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-all hover:border-primary/30 hover:bg-accent/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Quizzes & Submissions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Quizzes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/quizzes')}>
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : quizzes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">No quizzes yet</p>
                <Button size="sm" className="mt-3" onClick={() => navigate('/dashboard/create')}>
                  <Plus className="mr-1 h-4 w-4" /> Create your first quiz
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {quizzes.slice(0, 5).map((quiz) => (
                  <button
                    key={quiz.id}
                    onClick={() => navigate(`/dashboard/quizzes/${quiz.id}`)}
                    className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{quiz.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {quiz.subject || 'No subject'} • {new Date(quiz.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        quiz.status === 'published'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-orange-50 text-orange-700'
                      }`}
                    >
                      {quiz.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Submissions</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/results')}>
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentAttempts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">No submissions yet</p>
                <p className="text-xs text-muted-foreground/70">Student submissions will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentAttempts.slice(0, 5).map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{attempt.student_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {attempt.student_identifier} •{' '}
                        {attempt.submitted_at
                          ? new Date(attempt.submitted_at).toLocaleDateString()
                          : 'In progress'}
                      </p>
                    </div>
                    <div className="ml-2 shrink-0 text-right">
                      <p className="text-sm font-bold text-foreground">{attempt.percentage}%</p>
                      <p className="text-xs text-muted-foreground">
                        {attempt.score}/{attempt.total_marks}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
