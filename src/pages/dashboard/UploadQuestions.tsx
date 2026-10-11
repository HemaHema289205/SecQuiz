import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Upload,
  File as FileIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';
import { parseFile, createCSVTemplate, createExcelTemplate, downloadBlob } from '@/lib/file-parser';
import type { ParsedQuestion, QuestionType } from '@/types';

const ACCEPTED_TYPES = '.xlsx,.xls,.csv,.txt';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function UploadQuestions() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setParseError(null);

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'txt'].includes(ext || '')) {
      setParseError(`Unsupported file type: .${ext}. Please use Excel (.xlsx), CSV (.csv), or text (.txt) files.`);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setParseError('File is too large. Maximum size is 10MB.');
      return;
    }

    setFile(selectedFile);
    setParsing(true);

    try {
      const parsed = await parseFile(selectedFile);
      if (parsed.length === 0) {
        setParseError('No questions were found in this file. Please check the format and try again.');
        setFile(null);
      } else {
        setQuestions(parsed);
        setStep(2);
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse file');
      setFile(null);
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDownloadTemplate = async (format: 'csv' | 'excel') => {
    if (format === 'csv') {
      const blob = new Blob([createCSVTemplate()], { type: 'text/csv' });
      downloadBlob(blob, 'secQuiz_question_template.csv');
    } else {
      const blob = await createExcelTemplate();
      downloadBlob(blob, 'secQuiz_question_template.xlsx');
    }
    toast.success('Template downloaded');
  };

  const updateQuestion = (index: number, updates: Partial<ParsedQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        const updated = { ...q, ...updates };
        // Re-validate
        const errors: string[] = [];
        if (!updated.question_text.trim()) errors.push('Question text is empty');
        if (updated.question_type === 'mcq' && updated.options.filter((o) => o.trim()).length < 2)
          errors.push('MCQ needs at least 2 options');
        if (updated.question_type === 'true_false' && !['true', 'false'].includes((updated.correct_answer || '').toLowerCase()))
          errors.push('True/False answer must be "true" or "false"');
        if (updated.marks <= 0 || isNaN(updated.marks)) errors.push('Marks must be positive');
        updated._errors = errors;
        updated._valid = errors.length === 0;
        return updated;
      })
    );
  };

  const addManualQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question_text: '',
        question_type: 'mcq',
        options: ['', '', '', ''],
        correct_answer: null,
        marks: 1,
        explanation: null,
        topic: null,
        _row: prev.length + 2,
        _valid: false,
        _errors: ['Question text is empty'],
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const validQuestions = questions.filter((q) => q._valid);
    if (validQuestions.length === 0) {
      toast.error('No valid questions to save. Please fix the errors first.');
      return;
    }

    setSaving(true);
    try {
      const insertData = validQuestions.map((q) => ({
        teacher_id: user!.id,
        question_text: q.question_text.trim(),
        question_type: q.question_type,
        options: q.question_type === 'mcq' ? q.options.filter((o) => o.trim()) : q.question_type === 'true_false' ? ['True', 'False'] : [],
        correct_answer: q.correct_answer,
        marks: q.marks,
        explanation: q.explanation,
        topic: q.topic,
      }));

      const { error } = await supabase.from('questions').insert(insertData);
      if (error) throw error;

      toast.success(`${validQuestions.length} question${validQuestions.length > 1 ? 's' : ''} saved to your question bank`);
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save questions');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep(1);
    setFile(null);
    setQuestions([]);
    setParseError(null);
  };

  const validCount = questions.filter((q) => q._valid).length;
  const invalidCount = questions.length - validCount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Questions</h1>
        <p className="mt-1 text-muted-foreground">Import questions from files or add them manually.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { num: 1, label: 'Select File' },
          { num: 2, label: 'Review & Edit' },
          { num: 3, label: 'Saved' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= s.num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
            </div>
            <span className={`text-sm font-medium ${step >= s.num ? 'text-foreground' : 'text-muted-foreground'}`}>
              {s.label}
            </span>
            {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 1: File upload */}
      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
                  dragActive ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
              >
                {parsing ? (
                  <div className="text-center">
                    <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                    <p className="mt-4 text-sm font-medium text-foreground">Parsing file...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                      <Upload className="h-7 w-7 text-primary" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-foreground">
                      Drag and drop your file here
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Supports Excel (.xlsx), CSV (.csv), and text (.txt) files up to 10MB
                    </p>
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileIcon className="mr-2 h-4 w-4" /> Browse Files
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_TYPES}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileSelect(f);
                      }}
                    />
                  </>
                )}
              </div>

              {parseError && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {file && !parseError && (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={reset}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Download Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Use these templates to ensure your questions are parsed correctly. The expected format
                includes columns: question, question_type, option_a through option_d, correct_answer,
                marks, explanation, and topic.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => handleDownloadTemplate('excel')}>
                  <Download className="mr-2 h-4 w-4" /> Excel Template (.xlsx)
                </Button>
                <Button variant="outline" onClick={() => handleDownloadTemplate('csv')}>
                  <Download className="mr-2 h-4 w-4" /> CSV Template (.csv)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Manual entry */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Prefer to add questions manually?</p>
                  <p className="text-xs text-muted-foreground">Skip the upload and enter questions one by one.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuestions([
                      {
                        question_text: '',
                        question_type: 'mcq',
                        options: ['', '', '', ''],
                        correct_answer: null,
                        marks: 1,
                        explanation: null,
                        topic: null,
                        _row: 1,
                        _valid: false,
                        _errors: ['Question text is empty'],
                      },
                    ]);
                    setStep(2);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Manually
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Format info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supported File Formats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { format: 'Excel (.xlsx)', status: 'Fully supported', color: 'text-green-600' },
                  { format: 'CSV (.csv)', status: 'Fully supported', color: 'text-green-600' },
                  { format: 'Text (.txt)', status: 'Fully supported', color: 'text-green-600' },
                  { format: 'Word (.docx)', status: 'Manual entry', color: 'text-orange-500' },
                  { format: 'PDF (.pdf)', status: 'Manual entry', color: 'text-orange-500' },
                  { format: 'Scanned PDF', status: 'Requires OCR', color: 'text-muted-foreground' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <span className="text-sm font-medium text-foreground">{f.format}</span>
                    <span className={`text-xs font-medium ${f.color}`}>{f.status}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Review and edit */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-green-50 text-green-700">{validCount} valid</Badge>
              {invalidCount > 0 && <Badge className="bg-orange-50 text-orange-700">{invalidCount} need attention</Badge>}
              <span className="text-sm text-muted-foreground">{questions.length} total questions</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button variant="outline" onClick={addManualQuestion}>
                <Plus className="mr-1 h-4 w-4" /> Add Question
              </Button>
              <Button onClick={handleSave} disabled={saving || validCount === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Save ${validCount} Question${validCount !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {questions.map((q, index) => (
              <ReviewQuestionCard
                key={index}
                question={q}
                onUpdate={(updates) => updateQuestion(index, updates)}
                onRemove={() => removeQuestion(index)}
              />
            ))}
          </div>

          {questions.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">No questions to review</p>
                <Button className="mt-3" variant="outline" onClick={addManualQuestion}>
                  <Plus className="mr-1 h-4 w-4" /> Add a Question
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 3: Success */}
      {step === 3 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">Questions Saved!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your questions have been added to your question bank and are ready to use in quizzes.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={reset}>
                Upload Another File
              </Button>
              <Button onClick={() => window.location.href = '/dashboard/questions'}>
                Go to Question Bank
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReviewQuestionCard({
  question,
  onUpdate,
  onRemove,
}: {
  question: ParsedQuestion;
  onUpdate: (updates: Partial<ParsedQuestion>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(!question._valid);

  return (
    <Card className={question._valid ? '' : 'border-orange-300'}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {question._valid ? (
                <Badge className="bg-green-50 text-green-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Valid
                </Badge>
              ) : (
                <Badge className="bg-orange-50 text-orange-700">
                  <AlertCircle className="mr-1 h-3 w-3" /> Needs Review
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">Row {question._row}</span>
              {question._errors.length > 0 && (
                <span className="text-xs text-destructive">{question._errors.join(', ')}</span>
              )}
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full text-left text-sm font-medium text-foreground"
            >
              {question.question_text || '(empty question)'}
            </button>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Collapse' : 'Edit'}
            </Button>
            <Button variant="ghost" size="icon" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="space-y-1">
              <Label className="text-xs">Question Text</Label>
              <Textarea
                value={question.question_text}
                onChange={(e) => onUpdate({ question_text: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select
                  value={question.question_type}
                  onValueChange={(v) => onUpdate({ question_type: v as QuestionType })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Marks</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={question.marks}
                  onChange={(e) => onUpdate({ marks: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Topic</Label>
                <Input
                  value={question.topic || ''}
                  onChange={(e) => onUpdate({ topic: e.target.value || null })}
                  placeholder="Optional"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {question.question_type === 'mcq' && (
              <div className="space-y-2">
                <Label className="text-xs">Options & Correct Answer</Label>
                {question.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-xs">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...question.options];
                        newOpts[i] = e.target.value;
                        onUpdate({ options: newOpts });
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      className="h-8 text-xs"
                    />
                    <Button
                      variant={question.correct_answer === opt && opt.trim() ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => onUpdate({ correct_answer: opt })}
                      disabled={!opt.trim()}
                    >
                      Correct
                    </Button>
                    {question.options.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const newOpts = question.options.filter((_, idx) => idx !== i);
                          if (question.correct_answer === opt) onUpdate({ correct_answer: null, options: newOpts });
                          else onUpdate({ options: newOpts });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {question.options.length < 6 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onUpdate({ options: [...question.options, ''] })}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add Option
                  </Button>
                )}
              </div>
            )}

            {question.question_type === 'true_false' && (
              <div className="space-y-1">
                <Label className="text-xs">Correct Answer</Label>
                <Select
                  value={question.correct_answer || ''}
                  onValueChange={(v) => onUpdate({ correct_answer: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select answer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="True">True</SelectItem>
                    <SelectItem value="False">False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {question.question_type === 'short_answer' && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
                Short answer questions will be marked for manual evaluation after submission.
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Explanation (Optional)</Label>
              <Input
                value={question.explanation || ''}
                onChange={(e) => onUpdate({ explanation: e.target.value || null })}
                placeholder="Brief explanation of the answer"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
