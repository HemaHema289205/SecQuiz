import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { exportResultsToExcel, exportResultsToCSV } from '@/lib/excel-export';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Search,
  FileSpreadsheet,
  FileDown,
  Loader2,
  BarChart3,
  Users,
  TrendingUp,
  Award,
  Eye,
  GraduationCap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Quiz, QuizAttempt, StudentResponse, Question } from '@/types';

export default function QuizResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [responses, setResponses] = useState<StudentResponse[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('submitted');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [detailAttempt, setDetailAttempt] = useState<QuizAttempt | null>(null);
  const [detailResponses, setDetailResponses] = useState<(StudentResponse & { question?: Question })[]>([]);
  const [grading, setGrading] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: q } = await supabase.from('quizzes').select('*').eq('id', id).maybeSingle();
    if (q) setQuiz(q as Quiz);

    const { data: att } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('quiz_id', id)
      .order('submitted_at', { ascending: false });
    setAttempts(att || []);

    const { data: qq } = await supabase
      .from('quiz_questions')
      .select('question:questions(*)')
      .eq('quiz_id', id)
      .order('display_order');
    setQuestions((qq || []).map((item: any) => item.question).filter(Boolean) as Question[]);

    if (att && att.length > 0) {
      const attemptIds = att.map((a) => a.id);
      const { data: resp } = await supabase
        .from('student_responses')
        .select('*')
        .in('attempt_id', attemptIds);
      setResponses(resp || []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredAttempts = attempts
    .filter((a) => statusFilter === 'all' || a.status === statusFilter)
    .filter((a) => !search.trim() || a.student_name.toLowerCase().includes(search.toLowerCase()) || a.student_identifier.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'score') return Number(b.percentage) - Number(a.percentage);
      if (sortBy === 'name') return a.student_name.localeCompare(b.student_name);
      return new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime();
    });

  const submittedAttempts = attempts.filter((a) => a.status === 'submitted' || a.status === 'graded');
  const scores = submittedAttempts.map((a) => Number(a.percentage));
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : 0;
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  const scoreDistribution = [
    { range: '0-20%', count: scores.filter((s) => s >= 0 && s < 20).length, color: '#ef4444' },
    { range: '20-40%', count: scores.filter((s) => s >= 20 && s < 40).length, color: '#f97316' },
    { range: '40-60%', count: scores.filter((s) => s >= 40 && s < 60).length, color: '#eab308' },
    { range: '60-80%', count: scores.filter((s) => s >= 60 && s < 80).length, color: '#22c55e' },
    { range: '80-100%', count: scores.filter((s) => s >= 80).length, color: '#2563eb' },
  ];

  const handleExportExcel = async () => {
    if (!quiz || submittedAttempts.length === 0) {
      toast.error('No submissions to export');
      return;
    }
    setExporting(true);
    try {
      await exportResultsToExcel(quiz, submittedAttempts, responses, questions);
      toast.success('Excel file downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (!quiz || submittedAttempts.length === 0) {
      toast.error('No submissions to export');
      return;
    }
    try {
      exportResultsToCSV(quiz, submittedAttempts, responses, questions);
      toast.success('CSV file downloaded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export CSV');
    }
  };

  const openDetail = async (attempt: QuizAttempt) => {
    setDetailAttempt(attempt);
    const { data: resp } = await supabase
      .from('student_responses')
      .select('*')
      .eq('attempt_id', attempt.id);
    const enriched = (resp || []).map((r) => {
      const q = questions.find((qq) => qq.id === r.question_id);
      return { ...r, question: q };
    });
    setDetailResponses(enriched);
  };

  const handleGradeResponse = async (responseId: string, marks: number) => {
    setGrading(true);
    const resp = detailResponses.find((r) => r.id === responseId);
    if (!resp) return;
    const isCorrect = marks > 0;
    const { error } = await supabase
      .from('student_responses')
      .update({ marks_awarded: marks, evaluation_status: 'graded', is_correct: isCorrect })
      .eq('id', responseId);
    if (error) {
      toast.error('Failed to update grade');
    } else {
      toast.success('Response graded');
      setDetailResponses((prev) =>
        prev.map((r) => (r.id === responseId ? { ...r, marks_awarded: marks, evaluation_status: 'graded', is_correct: isCorrect } : r))
      );
    }
    setGrading(false);
  };

  const recalculateAttempt = async (attemptId: string) => {
    const allResp = detailResponses;
    let totalScore = 0;
    let totalMarks = 0;
    let correct = 0, incorrect = 0, unanswered = 0;
    for (const r of allResp) {
      const q = questions.find((qq) => qq.id === r.question_id);
      const marks = q ? Number(q.marks) : 0;
      totalMarks += marks;
      if (!r.selected_answer) { unanswered++; continue; }
      totalScore += Number(r.marks_awarded);
      if (r.is_correct === true) correct++;
      else incorrect++;
    }
    if (totalScore < 0) totalScore = 0;
    const pct = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100 * 100) / 100 : 0;
    const hasPending = allResp.some((r) => r.evaluation_status === 'pending_manual');
    const { error } = await supabase
      .from('quiz_attempts')
      .update({
        score: totalScore, total_marks: totalMarks, percentage: pct,
        correct_count: correct, incorrect_count: incorrect, unanswered_count: unanswered,
        status: hasPending ? 'submitted' : 'graded',
      })
      .eq('id', attemptId);
    if (error) toast.error('Failed to update attempt score');
    else { toast.success('Score recalculated'); loadData(); }
  };

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm font-medium">Quiz not found</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/dashboard/results')}>Back to Results</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/results')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{quiz.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Results & Submissions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={exporting || submittedAttempts.length === 0}>
            <FileDown className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button onClick={handleExportExcel} disabled={exporting || submittedAttempts.length === 0}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Submissions', value: submittedAttempts.length, icon: Users },
          { label: 'Average', value: `${avgScore}%`, icon: TrendingUp },
          { label: 'Highest', value: `${highestScore}%`, icon: Award },
          { label: 'Lowest', value: `${lowestScore}%`, icon: BarChart3 },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{s.value}</p>
                </div>
                <s.icon className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Score distribution chart */}
      {submittedAttempts.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Score Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="range" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                  {scoreDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by student name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="submitted">Submission Time</SelectItem>
            <SelectItem value="score">Score</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="graded">Graded</SelectItem>
            <SelectItem value="submitted">Pending Grading</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Attempts table */}
      {submittedAttempts.length === 0 && attempts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-foreground">No submissions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Share your quiz link with students to collect responses.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate(`/dashboard/quizzes/${quiz.id}`)}>
              View Quiz Details
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Student</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Score</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Percentage</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Submitted</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttempts.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium text-foreground">{a.student_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.student_identifier}</td>
                      <td className="px-4 py-3 text-foreground">{a.score}/{a.total_marks}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${a.percentage >= 60 ? 'text-green-600' : a.percentage >= 40 ? 'text-orange-500' : 'text-destructive'}`}>
                          {a.percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={
                          a.status === 'graded' ? 'bg-green-50 text-green-700' :
                          a.status === 'submitted' ? 'bg-orange-50 text-orange-700' :
                          'bg-blue-50 text-blue-700'
                        }>
                          {a.status === 'graded' ? 'Graded' : a.status === 'submitted' ? 'Pending' : 'In Progress'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(a)}>
                          <Eye className="mr-1 h-4 w-4" /> Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredAttempts.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No results match your filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail dialog */}
      {detailAttempt && (
        <Dialog open onOpenChange={() => setDetailAttempt(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                {detailAttempt.student_name} - {detailAttempt.percentage}%
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/30 p-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Score</p><p className="font-medium">{detailAttempt.score}/{detailAttempt.total_marks}</p></div>
                <div><p className="text-xs text-muted-foreground">Correct/Incorrect</p><p className="font-medium">{detailAttempt.correct_count}/{detailAttempt.incorrect_count}</p></div>
                <div><p className="text-xs text-muted-foreground">Unanswered</p><p className="font-medium">{detailAttempt.unanswered_count}</p></div>
              </div>
              {detailResponses.map((r, i) => (
                <div key={r.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-medium text-primary">{i + 1}</span>
                      <p className="text-sm font-medium text-foreground">{r.question?.question_text}</p>
                    </div>
                    {r.is_correct === true && <Badge className="bg-green-50 text-green-700">Correct</Badge>}
                    {r.is_correct === false && <Badge className="bg-red-50 text-red-700">Incorrect</Badge>}
                    {!r.selected_answer && <Badge className="bg-slate-100 text-slate-600">Unanswered</Badge>}
                  </div>
                  <div className="ml-8 space-y-1 text-xs">
                    <p className="text-muted-foreground">Student answer: <span className="font-medium text-foreground">{r.selected_answer || 'No answer'}</span></p>
                    <p className="text-muted-foreground">Correct answer: <span className="font-medium text-green-600">{r.question?.correct_answer || 'N/A'}</span></p>
                    <p className="text-muted-foreground">Marks: <span className="font-medium text-foreground">{r.marks_awarded}/{r.question?.marks || 0}</span></p>
                    {r.evaluation_status === 'pending_manual' && (
                      <div className="mt-2 flex items-center gap-2 rounded bg-orange-50 p-2">
                        <span className="text-orange-700">Manual grading needed:</span>
                        <Input
                          type="number"
                          min="0"
                          max={r.question?.marks || 0}
                          step="0.5"
                          defaultValue={r.marks_awarded}
                          className="h-7 w-20 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleGradeResponse(r.id, parseFloat((e.target as HTMLInputElement).value) || 0);
                            }
                          }}
                        />
                        <Button size="sm" className="h-7 text-xs" disabled={grading} onClick={() => {
                          const input = document.querySelector(`input[data-response-id="${r.id}"]`) as HTMLInputElement;
                          handleGradeResponse(r.id, parseFloat(input?.value || '0') || 0);
                        }}>
                          Grade
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {detailResponses.some((r) => r.evaluation_status === 'pending_manual') && (
                <Button onClick={() => recalculateAttempt(detailAttempt.id)} className="w-full">
                  Recalculate Total Score
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
