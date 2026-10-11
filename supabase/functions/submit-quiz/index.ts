import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SubmitRequest {
  quizId: string;
  attemptId: string;
  studentName: string;
  studentIdentifier: string;
  responses: {
    questionId: string;
    selectedAnswer: string | null;
  }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: SubmitRequest = await req.json();
    const { quizId, attemptId, studentName, studentIdentifier, responses } = body;

    if (!quizId || !attemptId || !responses || !Array.isArray(responses)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the quiz with server-side validation
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      return new Response(
        JSON.stringify({ error: "Quiz not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (quiz.status !== "published") {
      return new Response(
        JSON.stringify({ error: "Quiz is not published" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check availability window
    const now = new Date();
    if (quiz.start_date && new Date(quiz.start_date) > now) {
      return new Response(
        JSON.stringify({ error: "Quiz has not started yet" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (quiz.end_date && new Date(quiz.end_date) < now) {
      return new Response(
        JSON.stringify({ error: "Quiz has ended" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the attempt exists and belongs to this quiz
    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("id", attemptId)
      .eq("quiz_id", quizId)
      .single();

    if (attemptError || !attempt) {
      return new Response(
        JSON.stringify({ error: "Attempt not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (attempt.status === "submitted" || attempt.status === "graded") {
      return new Response(
        JSON.stringify({ error: "This attempt has already been submitted" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch quiz questions with correct answers (server-side only)
    const { data: quizQuestions, error: qqError } = await supabase
      .from("quiz_questions")
      .select(`
        display_order,
        marks_override,
        question:questions (
          id,
          question_text,
          question_type,
          options,
          correct_answer,
          marks
        )
      `)
      .eq("quiz_id", quizId)
      .order("display_order");

    if (qqError || !quizQuestions) {
      return new Response(
        JSON.stringify({ error: "Failed to load quiz questions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check attempt limit
    const { count: attemptCount } = await supabase
      .from("quiz_attempts")
      .select("*", { count: "exact", head: true })
      .eq("quiz_id", quizId)
      .eq("student_identifier", studentIdentifier)
      .in("status", ["submitted", "graded"]);

    if (attemptCount !== null && attemptCount >= (quiz.max_attempts || 1)) {
      // Mark this attempt as submitted to prevent reuse
      await supabase
        .from("quiz_attempts")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", attemptId);
      return new Response(
        JSON.stringify({ error: "Maximum attempts reached for this quiz" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Score each response
    let totalScore = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    const responseRecords: Array<{
      attempt_id: string;
      question_id: string;
      selected_answer: string | null;
      marks_awarded: number;
      evaluation_status: string;
      is_correct: boolean | null;
    }> = [];

    for (const qq of quizQuestions) {
      const question = Array.isArray(qq.question) ? qq.question[0] : qq.question;
      if (!question) continue;

      const marks = qq.marks_override !== null ? Number(qq.marks_override) : Number(question.marks);
      totalMarks += marks;

      const studentResponse = responses.find((r) => r.questionId === question.id);
      const selectedAnswer = studentResponse?.selectedAnswer ?? null;

      if (!selectedAnswer || selectedAnswer.trim() === "") {
        unansweredCount++;
        responseRecords.push({
          attempt_id: attemptId,
          question_id: question.id,
          selected_answer: null,
          marks_awarded: 0,
          evaluation_status: "auto",
          is_correct: null,
        });
        continue;
      }

      if (question.question_type === "short_answer") {
        // Mark for manual evaluation
        responseRecords.push({
          attempt_id: attemptId,
          question_id: question.id,
          selected_answer: selectedAnswer,
          marks_awarded: 0,
          evaluation_status: "pending_manual",
          is_correct: null,
        });
        unansweredCount++; // not auto-scored
      } else {
        // Auto-evaluate: compare against correct answer
        const isCorrect = selectedAnswer.trim().toLowerCase() === String(question.correct_answer).trim().toLowerCase();

        if (isCorrect) {
          totalScore += marks;
          correctCount++;
        } else {
          incorrectCount++;
          if (Number(quiz.negative_marking) > 0) {
            totalScore -= Number(quiz.negative_marking);
          }
        }

        responseRecords.push({
          attempt_id: attemptId,
          question_id: question.id,
          selected_answer: selectedAnswer,
          marks_awarded: isCorrect ? marks : (Number(quiz.negative_marking) > 0 ? -Number(quiz.negative_marking) : 0),
          evaluation_status: "auto",
          is_correct: isCorrect,
        });
      }
    }

    // Ensure score doesn't go below 0
    if (totalScore < 0) totalScore = 0;

    const percentage = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100 * 100) / 100 : 0;

    const hasManualGrading = responseRecords.some((r) => r.evaluation_status === "pending_manual");
    const finalStatus = hasManualGrading ? "submitted" : "graded";

    // Delete any existing responses for this attempt (in case of retry within same attempt)
    await supabase.from("student_responses").delete().eq("attempt_id", attemptId);

    // Insert all responses
    const { error: insertError } = await supabase
      .from("student_responses")
      .insert(responseRecords);

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to save responses: " + insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the attempt with the score
    const { error: updateError } = await supabase
      .from("quiz_attempts")
      .update({
        score: totalScore,
        total_marks: totalMarks,
        percentage: percentage,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        unanswered_count: unansweredCount,
        status: finalStatus,
        submitted_at: new Date().toISOString(),
        student_name: studentName,
        student_identifier: studentIdentifier,
      })
      .eq("id", attemptId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update attempt: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        score: totalScore,
        totalMarks,
        percentage,
        correctCount,
        incorrectCount,
        unansweredCount,
        status: finalStatus,
        showAnswers: quiz.show_answers,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
