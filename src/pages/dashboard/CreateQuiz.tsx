import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { generateAccessCode } from '@/lib/access-code';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, ArrowRight, Plus, Search, Check } from 'lucide-react';
import type { Question } from '@/types';

export default function CreateQuiz() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [instructions, setInstructions] = useState('');
  const [timeLimit, setTimeLimit] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('1');
  const [negativeMarking, setNegativeMarking] = useState('0');
  const [showAnswers, setShowAnswers] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);

  // Step 2 fields
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadQuestions() {
      if (!user) return;
      setLoadingQuestions(true);
      let q = supabase.from('questions').select('*').eq('teacher_id', user.id);
      if (search.trim()) q = q.ilike('question_text', `%${search.trim()}%`);
      if (typeFilter !== 'all') q = q.eq('question_type', typeFilter);
      const { data } = await q.order('created_at', { ascending: false });
      setQuestions(data || []);
      setLoadingQuestions(false);
    }
    const t = setTimeout(loadQuestions, 300);
    return () => clearTimeout(t);
  }, [user, search, typeFilter]);

  const totalMarks = selectedIds.reduce((sum, id) => {
    const q = questions.find((qq) => qq.id === id);
    return sum + (q ? Number(q.marks) : 0);
  }, 0);

  const handleCreate = async (publish: boolean) => {
    if (!title.trim()) {
      toast.error('Quiz title is required');
      setStep(1);
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Select at least one question');
      setStep(2);
      return;
    }

    setSaving(true);
    try {
      const code = generateAccessCode();
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .insert({
          teacher_id: user!.id,
          title: title.trim(),
          description: description.trim() || null,
          instructions: instructions.trim() || null,
          subject: subject.trim() || null,
          status: publish ? 'published' : 'draft',
          access_code: publish ? code : null,
          time_limit_minutes: timeLimit ? parseInt(timeLimit) : null,
          total_marks: totalMarks,
          max_attempts: parseInt(maxAttempts) || 1,
          negative_marking: parseFloat(negativeMarking) || 0,
          show_answers: showAnswers,
          shuffle_questions: shuffleQuestions,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      const qqData = selectedIds.map((qid, i) => ({
        quiz_id: quiz.id,
        question_id: qid,
        display_order: i,
      }));
      const { error: qqError } = await supabase.from('quiz_questions').insert(qqData);
      if (qqError) throw qqError;

      toast.success(publish ? 'Quiz published! Students can now access it.' : 'Quiz saved as draft');
      navigate(`/dashboard/quizzes/${quiz.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create quiz');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Quiz</h1>
          <p className="mt-1 text-muted-foreground">Configure your quiz and select questions.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {[
          { num: 1, label: 'Quiz Details' },
          { num: 2, label: 'Select Questions' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= s.num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s.num ? <Check className="h-4 w-4" /> : s.num}
            </div>
            <span className={`text-sm font-medium ${step >= s.num ? 'text-foreground' : 'text-muted-foreground'}`}>
              {s.label}
            </span>
            {i < 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="title">Quiz Title *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Midterm Exam - Chapter 5" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject / Category</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxAttempts">Max Attempts</Label>
                <Input id="maxAttempts" type="number" min="1" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the quiz" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions for Students (Optional)</Label>
              <Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Read each question carefully. You have 30 minutes." rows={3} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timeLimit">Time Limit (minutes)</Label>
                <Input id="timeLimit" type="number" min="0" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder="No limit" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="negativeMarking">Negative Marking (points per wrong answer)</Label>
                <Input id="negativeMarking" type="number" min="0" step="0.25" value={negativeMarking} onChange={(e) => setNegativeMarking(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Show correct answers after submission</Label>
                  <p className="text-xs text-muted-foreground">Students will see correct answers after submitting</p>
                </div>
                <Switch checked={showAnswers} onCheckedChange={setShowAnswers} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="cursor-pointer">Shuffle question order</Label>
                  <p className="text-xs text-muted-foreground">Questions appear in random order for each student</p>
                </div>
                <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!title.trim()}>
                Next: Select Questions <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">{selectedIds.length} selected</span>
              <span className="text-sm text-muted-foreground">Total: {totalMarks} marks</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button variant="outline" onClick={() => handleCreate(false)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save as Draft'}
              </Button>
              <Button onClick={() => handleCreate(true)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish Quiz'}
              </Button>
            </div>
          </div>

          {questions.length === 0 && !loadingQuestions ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-medium text-foreground">No questions in your bank</p>
                <p className="mt-1 text-sm text-muted-foreground">Add questions first before creating a quiz.</p>
                <Button className="mt-4" onClick={() => navigate('/dashboard/upload')}>
                  <Plus className="mr-1 h-4 w-4" /> Upload Questions
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                </div>
                <Button variant="outline" onClick={() => setTypeFilter(typeFilter === 'all' ? 'mcq' : typeFilter === 'mcq' ? 'true_false' : typeFilter === 'true_false' ? 'short_answer' : 'all')}>
                  {typeFilter === 'all' ? 'All Types' : typeFilter === 'mcq' ? 'MCQ Only' : typeFilter === 'true_false' ? 'True/False Only' : 'Short Answer Only'}
                </Button>
              </div>

              {loadingQuestions ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {questions.map((q) => (
                    <Card key={q.id} className={`transition-all ${selectedIds.includes(q.id) ? 'border-primary bg-primary/5' : ''}`}>
                      <CardContent className="flex items-start gap-3 p-4">
                        <Checkbox checked={selectedIds.includes(q.id)} onCheckedChange={() => toggleSelect(q.id)} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-primary">
                              {q.question_type === 'mcq' ? 'MCQ' : q.question_type === 'true_false' ? 'T/F' : 'Short'}
                            </span>
                            {q.topic && <span className="text-xs text-muted-foreground">{q.topic}</span>}
                            <span className="text-xs font-medium text-muted-foreground">{q.marks} marks</span>
                          </div>
                          <p className="text-sm text-foreground">{q.question_text}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
