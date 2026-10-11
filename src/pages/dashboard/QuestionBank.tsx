import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { LibraryBig, Plus, Search, Edit2, Trash2, Loader2 } from 'lucide-react';
import type { Question, QuestionType } from '@/types';

export default function QuestionBank() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadQuestions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from('questions').select('*').eq('teacher_id', user.id);

    if (search.trim()) {
      query = query.ilike('question_text', `%${search.trim}%`);
    }
    if (typeFilter !== 'all') {
      query = query.eq('question_type', typeFilter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load questions');
    } else {
      setQuestions(data || []);
    }
    setLoading(false);
  }, [user, search, typeFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => loadQuestions(), 300);
    return () => clearTimeout(timeout);
  }, [loadQuestions]);

  const handleSave = async (data: Partial<Question>) => {
    setSaving(true);
    try {
      if (editingQuestion) {
        const { error } = await supabase
          .from('questions')
          .update({
            question_text: data.question_text,
            question_type: data.question_type,
            options: data.options,
            correct_answer: data.correct_answer,
            marks: data.marks,
            explanation: data.explanation,
            topic: data.topic,
          })
          .eq('id', editingQuestion.id);

        if (error) throw error;
        toast.success('Question updated');
      } else {
        const { error } = await supabase.from('questions').insert({
          teacher_id: user!.id,
          question_text: data.question_text,
          question_type: data.question_type,
          options: data.options || [],
          correct_answer: data.correct_answer,
          marks: data.marks || 1,
          explanation: data.explanation,
          topic: data.topic,
        });

        if (error) throw error;
        toast.success('Question added');
      }
      setEditingQuestion(null);
      setShowAddDialog(false);
      loadQuestions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('questions').delete().eq('id', deleteId);
    if (error) {
      toast.error('Failed to delete question');
    } else {
      toast.success('Question deleted');
      loadQuestions();
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
          <p className="mt-1 text-muted-foreground">Manage your reusable questions across all quizzes.</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add Question
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="mcq">Multiple Choice</SelectItem>
            <SelectItem value="true_false">True / False</SelectItem>
            <SelectItem value="short_answer">Short Answer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Questions list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LibraryBig className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium text-foreground">No questions found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a file or add questions manually to get started.
            </p>
            <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add Your First Question
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <Card key={q.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-primary">
                        {q.question_type === 'mcq' ? 'Multiple Choice' : q.question_type === 'true_false' ? 'True/False' : 'Short Answer'}
                      </span>
                      {q.topic && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {q.topic}
                        </span>
                      )}
                      <span className="text-xs font-medium text-muted-foreground">{q.marks} marks</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{q.question_text}</p>
                    {q.question_type === 'mcq' && q.options.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2 text-xs ${
                              opt === q.correct_answer ? 'font-medium text-green-600' : 'text-muted-foreground'
                            }`}
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded border border-border text-[10px]">
                              {String.fromCharCode(65 + i)}
                            </span>
                            {opt}
                            {opt === q.correct_answer && <span className="text-green-600">(correct)</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.question_type === 'true_false' && q.correct_answer && (
                      <p className="mt-1 text-xs text-green-600">Correct: {q.correct_answer}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditingQuestion(q)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(q.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      {(showAddDialog || editingQuestion) && (
        <QuestionDialog
          question={editingQuestion}
          saving={saving}
          onSave={handleSave}
          onClose={() => {
            setShowAddDialog(false);
            setEditingQuestion(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the question from your question bank. If it's used in
              quizzes, it will also be removed from those quizzes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuestionDialog({
  question,
  saving,
  onSave,
  onClose,
}: {
  question: Question | null;
  saving: boolean;
  onSave: (data: Partial<Question>) => void;
  onClose: () => void;
}) {
  const [questionText, setQuestionText] = useState(question?.question_text || '');
  const [questionType, setQuestionType] = useState<QuestionType>(question?.question_type || 'mcq');
  const [options, setOptions] = useState<string[]>(question?.options || ['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(question?.correct_answer || '');
  const [marks, setMarks] = useState(question?.marks?.toString() || '1');
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const [topic, setTopic] = useState(question?.topic || '');

  const handleSubmit = () => {
    if (!questionText.trim()) {
      toast.error('Question text is required');
      return;
    }
    const data: Partial<Question> = {
      question_text: questionText.trim(),
      question_type: questionType,
      options: questionType === 'mcq' ? options.filter((o) => o.trim()) : questionType === 'true_false' ? ['True', 'False'] : [],
      correct_answer: questionType === 'mcq' ? correctAnswer : questionType === 'true_false' ? correctAnswer : null,
      marks: parseFloat(marks) || 1,
      explanation: explanation.trim() || null,
      topic: topic.trim() || null,
    };
    onSave(data);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? 'Edit Question' : 'Add New Question'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Question Text</Label>
            <Textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Enter your question..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Question Type</Label>
              <Select value={questionType} onValueChange={(v) => { setQuestionType(v as QuestionType); setCorrectAnswer(''); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple Choice</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Marks</Label>
              <Input type="number" min="0" step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} />
            </div>
          </div>

          {questionType === 'mcq' && (
            <div className="space-y-2">
              <Label>Answer Options</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border text-sm font-medium">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...options];
                      newOpts[i] = e.target.value;
                      setOptions(newOpts);
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  />
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setOptions(options.filter((_, idx) => idx !== i));
                        if (correctAnswer === opt) setCorrectAnswer('');
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <Button variant="outline" size="sm" onClick={() => setOptions([...options, ''])}>
                  <Plus className="mr-1 h-4 w-4" /> Add Option
                </Button>
              )}
              <div className="space-y-2 pt-2">
                <Label>Correct Answer</Label>
                <Select value={correctAnswer} onValueChange={setCorrectAnswer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select the correct answer" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.filter((o) => o.trim()).map((opt, i) => (
                      <SelectItem key={i} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {questionType === 'true_false' && (
            <div className="space-y-2">
              <Label>Correct Answer</Label>
              <Select value={correctAnswer} onValueChange={setCorrectAnswer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select the correct answer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="True">True</SelectItem>
                  <SelectItem value="False">False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {questionType === 'short_answer' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              Short answer questions require manual evaluation after student submission. You can
              award marks later from the results page.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Topic (Optional)</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Mathematics" />
            </div>
            <div className="space-y-2">
              <Label>Explanation (Optional)</Label>
              <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Brief explanation" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : question ? 'Save Changes' : 'Add Question'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
