import ExcelJS from 'exceljs';
import type { Quiz, QuizAttempt, StudentResponse, Question } from '@/types';

function sanitizeCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Prevent spreadsheet formula injection
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    return `'${str}`;
  }
  return str;
}

export async function exportResultsToExcel(
  quiz: Quiz,
  attempts: QuizAttempt[],
  responses: StudentResponse[],
  questions: Question[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'secQuiz';
  workbook.created = new Date();

  // ============================================================
  // Worksheet 1: Summary
  // ============================================================
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { defaultColWidth: 22 },
  });

  // Quiz metadata section
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'Quiz Results Summary';
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF2563EB' } };
  titleCell.alignment = { vertical: 'middle' };

  const metaRows: [string, string | number][] = [
    ['Quiz Title', sanitizeCell(quiz.title)],
    ['Quiz ID', quiz.id],
    ['Subject', sanitizeCell(quiz.subject || 'N/A')],
    ['Total Questions', questions.length],
    ['Total Marks', quiz.total_marks],
    ['Max Attempts', quiz.max_attempts],
    ['Total Students (Attempts)', attempts.length],
    ['Number of Submissions', attempts.filter((a) => a.status === 'submitted' || a.status === 'graded').length],
  ];

  if (attempts.length > 0) {
    const scored = attempts.filter((a) => a.status === 'submitted' || a.status === 'graded');
    if (scored.length > 0) {
      const scores = scored.map((a) => Number(a.score));
      const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
      const highest = Math.max(...scores);
      const lowest = Math.min(...scores);
      metaRows.push(['Average Score', Math.round(avg * 100) / 100]);
      metaRows.push(['Highest Score', highest]);
      metaRows.push(['Lowest Score', lowest]);
    }
  }

  metaRows.forEach(([label, value], i) => {
    const row = summarySheet.getRow(i + 3);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
  });

  // Spacer
  const studentHeaderRow = metaRows.length + 5;

  // Student results section
  const studentHeaders = [
    'Student Name',
    'Student ID',
    'Score',
    'Total Marks',
    'Percentage',
    'Correct',
    'Incorrect',
    'Unanswered',
    'Submission Date',
    'Status',
  ];

  studentHeaders.forEach((header, i) => {
    const cell = summarySheet.getRow(studentHeaderRow).getCell(i + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
  });

  // Set column widths for summary
  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 20;
  for (let i = 3; i <= 10; i++) {
    summarySheet.getColumn(i).width = 16;
  }

  attempts.forEach((attempt, i) => {
    const row = summarySheet.getRow(studentHeaderRow + 1 + i);
    row.getCell(1).value = sanitizeCell(attempt.student_name);
    row.getCell(2).value = sanitizeCell(attempt.student_identifier);
    row.getCell(3).value = Number(attempt.score);
    row.getCell(4).value = Number(attempt.total_marks);
    row.getCell(5).value = `${Number(attempt.percentage)}%`;
    row.getCell(6).value = attempt.correct_count;
    row.getCell(7).value = attempt.incorrect_count;
    row.getCell(8).value = attempt.unanswered_count;
    row.getCell(9).value = attempt.submitted_at
      ? new Date(attempt.submitted_at).toLocaleString()
      : 'Not submitted';
    row.getCell(10).value = attempt.status;

    // Alternating row colors
    if (i % 2 === 1) {
      for (let c = 1; c <= 10; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      }
    }
  });

  // ============================================================
  // Worksheet 2: Detailed Responses
  // ============================================================
  const detailSheet = workbook.addWorksheet('Detailed Responses', {
    properties: { defaultColWidth: 22 },
  });

  const detailHeaders = [
    'Student Name',
    'Student ID',
    'Question #',
    'Question Text',
    'Question Type',
    'Selected Answer',
    'Correct Answer',
    'Marks Available',
    'Marks Awarded',
    'Status',
    'Evaluation',
  ];

  detailSheet.getRow(1).height = 24;
  detailHeaders.forEach((header, i) => {
    const cell = detailSheet.getRow(1).getCell(i + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF2563EB' } } };
  });

  // Column widths
  detailSheet.getColumn(1).width = 22;
  detailSheet.getColumn(2).width = 18;
  detailSheet.getColumn(3).width = 10;
  detailSheet.getColumn(4).width = 50;
  detailSheet.getColumn(5).width = 14;
  detailSheet.getColumn(6).width = 25;
  detailSheet.getColumn(7).width = 25;
  detailSheet.getColumn(8).width = 14;
  detailSheet.getColumn(9).width = 14;
  detailSheet.getColumn(10).width = 14;
  detailSheet.getColumn(11).width = 16;

  let rowIdx = 2;
  attempts.forEach((attempt) => {
    const attemptResponses = responses.filter((r) => r.attempt_id === attempt.id);

    attemptResponses.forEach((resp) => {
      const question = questions.find((q) => q.id === resp.question_id);
      const row = detailSheet.getRow(rowIdx);

      row.getCell(1).value = sanitizeCell(attempt.student_name);
      row.getCell(2).value = sanitizeCell(attempt.student_identifier);
      row.getCell(3).value = question
        ? questions.findIndex((q) => q.id === resp.question_id) + 1
        : '?';
      row.getCell(4).value = sanitizeCell(question?.question_text || 'Question not found');
      row.getCell(5).value = question?.question_type || '';
      row.getCell(6).value = sanitizeCell(resp.selected_answer) || 'No answer';
      row.getCell(7).value = sanitizeCell(question?.correct_answer || 'N/A');
      row.getCell(8).value = question ? Number(question.marks) : 0;
      row.getCell(9).value = Number(resp.marks_awarded);

      if (resp.is_correct === true) row.getCell(10).value = 'Correct';
      else if (resp.is_correct === false) row.getCell(10).value = 'Incorrect';
      else if (!resp.selected_answer) row.getCell(10).value = 'Unanswered';
      else row.getCell(10).value = 'Pending';

      row.getCell(11).value = resp.evaluation_status;

      rowIdx++;
    });

    // Add a separator row between students
    if (attemptResponses.length > 0 && rowIdx <= responses.length + attempts.length) {
      detailSheet.getRow(rowIdx).height = 6;
      for (let c = 1; c <= 11; c++) {
        detailSheet.getRow(rowIdx).getCell(c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE5E7EB' },
        };
      }
      rowIdx++;
    }
  });

  // Generate filename
  const safeTitle = quiz.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  const filename = `secQuiz_QuizResults_${safeTitle}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportResultsToCSV(
  quiz: Quiz,
  attempts: QuizAttempt[],
  responses: StudentResponse[],
  questions: Question[]
): void {
  const headers = [
    'Student Name',
    'Student ID',
    'Question #',
    'Question Text',
    'Question Type',
    'Selected Answer',
    'Correct Answer',
    'Marks Available',
    'Marks Awarded',
    'Status',
    'Evaluation',
    'Score',
    'Total Marks',
    'Percentage',
    'Submission Date',
  ];

  const rows: string[] = [headers.map((h) => `"${h}"`).join(',')];

  attempts.forEach((attempt) => {
    const attemptResponses = responses.filter((r) => r.attempt_id === attempt.id);
    if (attemptResponses.length === 0) {
      rows.push(
        [
          `"${sanitizeCell(attempt.student_name)}"`,
          `"${sanitizeCell(attempt.student_identifier)}"`,
          '"-"',
          '"-"',
          '"-"',
          '"-"',
          '"-"',
          '0',
          '0',
          '"-"',
          '"-"',
          attempt.score,
          attempt.total_marks,
          `"${attempt.percentage}%"`,
          `"${attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : 'Not submitted'}"`,
        ].join(',')
      );
      return;
    }

    attemptResponses.forEach((resp) => {
      const question = questions.find((q) => q.id === resp.question_id);
      const status = resp.is_correct === true ? 'Correct' : resp.is_correct === false ? 'Incorrect' : !resp.selected_answer ? 'Unanswered' : 'Pending';
      rows.push(
        [
          `"${sanitizeCell(attempt.student_name)}"`,
          `"${sanitizeCell(attempt.student_identifier)}"`,
          question ? questions.findIndex((q) => q.id === resp.question_id) + 1 : '?',
          `"${sanitizeCell(question?.question_text || 'Question not found')}"`,
          `"${question?.question_type || ''}"`,
          `"${sanitizeCell(resp.selected_answer) || 'No answer'}"`,
          `"${sanitizeCell(question?.correct_answer || 'N/A')}"`,
          question ? Number(question.marks) : 0,
          Number(resp.marks_awarded),
          `"${status}"`,
          `"${resp.evaluation_status}"`,
          attempt.score,
          attempt.total_marks,
          `"${attempt.percentage}%"`,
          `"${attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : 'Not submitted'}"`,
        ].join(',')
      );
    });
  });

  const safeTitle = quiz.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  const filename = `secQuiz_QuizResults_${safeTitle}.csv`;
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
