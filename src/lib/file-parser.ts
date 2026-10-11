import ExcelJS from 'exceljs';
import type { ParsedQuestion, QuestionType } from '@/types';

const HEADER_ALIASES: Record<string, string[]> = {
  question: ['question', 'question_text', 'q', 'questiontext'],
  question_type: ['question_type', 'type', 'qtype', 'questiontype'],
  option_a: ['option_a', 'optiona', 'a', 'opt_a', 'optiona'],
  option_b: ['option_b', 'optionb', 'b', 'opt_b', 'optionb'],
  option_c: ['option_c', 'optionc', 'c', 'opt_c', 'optionc'],
  option_d: ['option_d', 'optiond', 'd', 'opt_d', 'optiond'],
  correct_answer: ['correct_answer', 'answer', 'correct', 'correctanswer', 'key'],
  marks: ['marks', 'points', 'weight', 'score'],
  explanation: ['explanation', 'reason', 'rationale', 'note'],
  topic: ['topic', 'subject', 'category', 'tag'],
};

function normalizeHeader(header: string): string {
  const lower = header.trim().toLowerCase().replace(/\s+/g, '_');
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(lower)) return canonical;
  }
  return lower;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        current.push(field);
        field = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && next === '\n') i++;
        current.push(field);
        rows.push(current);
        current = [];
        field = '';
      } else {
        field += char;
      }
    }
  }
  if (field !== '' || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function inferQuestionType(row: Record<string, string>): QuestionType {
  const typeStr = (row['question_type'] || '').trim().toLowerCase();
  if (typeStr === 'mcq' || typeStr === 'multiple' || typeStr === 'multiple_choice') return 'mcq';
  if (typeStr === 'true_false' || typeStr === 'tf' || typeStr === 'true/false') return 'true_false';
  if (typeStr === 'short_answer' || typeStr === 'short' || typeStr === 'sa') return 'short_answer';

  // Auto-infer from options
  const options = [row['option_a'], row['option_b'], row['option_c'], row['option_d']].filter((o) => o && o.trim());
  if (options.length === 2) {
    const lower = options.map((o) => o.trim().toLowerCase());
    if (lower.includes('true') && lower.includes('false')) return 'true_false';
  }
  if (options.length > 0) return 'mcq';
  return 'short_answer';
}

function validateQuestion(parsed: ParsedQuestion): ParsedQuestion {
  const errors: string[] = [];

  if (!parsed.question_text || parsed.question_text.trim() === '') {
    errors.push('Question text is empty');
  }
  if (parsed.question_type === 'mcq') {
    if (parsed.options.filter((o) => o && o.trim()).length < 2) {
      errors.push('MCQ needs at least 2 options');
    }
  }
  if (parsed.question_type === 'true_false') {
    if (!parsed.correct_answer || !['true', 'false'].includes(parsed.correct_answer.trim().toLowerCase())) {
      errors.push('True/False answer must be "true" or "false"');
    }
  }
  if (parsed.marks <= 0 || isNaN(parsed.marks)) {
    errors.push('Marks must be a positive number');
  }

  return { ...parsed, _valid: errors.length === 0, _errors: errors };
}

function rowsToQuestions(rows: string[][]): ParsedQuestion[] {
  if (rows.length < 2) return [];

  const headerRow = rows[0].map(normalizeHeader);
  const dataRows = rows.slice(1);

  return dataRows.map((row, index) => {
    const rowData: Record<string, string> = {};
    headerRow.forEach((header, i) => {
      rowData[header] = (row[i] || '').trim();
    });

    const questionType = inferQuestionType(rowData);
    const options: string[] = [];

    if (questionType === 'mcq') {
      ['option_a', 'option_b', 'option_c', 'option_d'].forEach((key) => {
        if (rowData[key] && rowData[key].trim()) options.push(rowData[key].trim());
      });
    } else if (questionType === 'true_false') {
      options.push('True', 'False');
    }

    let correctAnswer = rowData['correct_answer'] || null;
    if (correctAnswer) correctAnswer = correctAnswer.trim();
    if (questionType === 'true_false' && correctAnswer) {
      correctAnswer = correctAnswer.charAt(0).toUpperCase() + correctAnswer.slice(1).toLowerCase();
    }

    const marks = parseFloat(rowData['marks']) || 1;

    return validateQuestion({
      question_text: (rowData['question'] || '').trim(),
      question_type: questionType,
      options,
      correct_answer: correctAnswer,
      marks,
      explanation: (rowData['explanation'] || '').trim() || null,
      topic: (rowData['topic'] || '').trim() || null,
      _row: index + 2,
      _valid: false,
      _errors: [],
    });
  });
}

export async function parseFile(file: File): Promise<ParsedQuestion[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    const rows = parseCSV(text);
    return rowsToQuestions(rows);
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const rows: string[][] = [];
    worksheet.eachRow((row) => {
      const values = row.values as any[];
      // values[0] is undefined, actual values start at index 1
      const cells: string[] = [];
      for (let i = 1; i < values.length; i++) {
        cells.push(String(values[i] ?? '').trim());
      }
      rows.push(cells);
    });
    return rowsToQuestions(rows);
  }

  // For unsupported formats (docx, pdf), return empty - teacher will use manual entry
  throw new Error(
    `.${ext} files require manual question entry. Excel (.xlsx) and CSV (.csv) files are fully supported for automatic import.`
  );
}

export function createCSVTemplate(): string {
  return [
    'question,question_type,option_a,option_b,option_c,option_d,correct_answer,marks,explanation,topic',
    'What is 2+2?,mcq,1,2,3,4,4,1,Basic addition,Math',
    'The sun is a star.,true_false,,,,,True,1,Basic astronomy,Science',
    'Explain photosynthesis.,short_answer,,,,,,2,Process description,Biology',
  ].join('\n');
}

export async function createExcelTemplate(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Questions');

  worksheet.columns = [
    { header: 'question', key: 'question', width: 40 },
    { header: 'question_type', key: 'question_type', width: 18 },
    { header: 'option_a', key: 'option_a', width: 20 },
    { header: 'option_b', key: 'option_b', width: 20 },
    { header: 'option_c', key: 'option_c', width: 20 },
    { header: 'option_d', key: 'option_d', width: 20 },
    { header: 'correct_answer', key: 'correct_answer', width: 18 },
    { header: 'marks', key: 'marks', width: 8 },
    { header: 'explanation', key: 'explanation', width: 35 },
    { header: 'topic', key: 'topic', width: 15 },
  ];

  worksheet.getRow(1).font = { bold: true };

  worksheet.addRow({
    question: 'What is the capital of France?',
    question_type: 'mcq',
    option_a: 'London',
    option_b: 'Paris',
    option_c: 'Berlin',
    option_d: 'Madrid',
    correct_answer: 'Paris',
    marks: 1,
    explanation: 'Paris is the capital and largest city of France.',
    topic: 'Geography',
  });

  worksheet.addRow({
    question: 'Water boils at 100 degrees Celsius.',
    question_type: 'true_false',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'True',
    marks: 1,
    explanation: 'At standard pressure, water boils at 100°C.',
    topic: 'Science',
  });

  worksheet.addRow({
    question: 'Explain the concept of recursion in programming.',
    question_type: 'short_answer',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: '',
    marks: 3,
    explanation: 'Manual evaluation required.',
    topic: 'Programming',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
