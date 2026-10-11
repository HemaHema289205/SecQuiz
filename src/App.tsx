import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardLayout from '@/pages/dashboard/DashboardLayout';
import DashboardOverview from '@/pages/dashboard/DashboardOverview';
import MyQuizzes from '@/pages/dashboard/MyQuizzes';
import UploadQuestions from '@/pages/dashboard/UploadQuestions';
import QuestionBank from '@/pages/dashboard/QuestionBank';
import ResultsPage from '@/pages/dashboard/ResultsPage';
import QuizResults from '@/pages/dashboard/QuizResults';
import QuizDetail from '@/pages/dashboard/QuizDetail';
import CreateQuiz from '@/pages/dashboard/CreateQuiz';
import SettingsPage from '@/pages/dashboard/SettingsPage';
import StudentQuiz from '@/pages/student/StudentQuiz';
import StudentResult from '@/pages/student/StudentResult';
import NotFound from '@/pages/NotFound';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* Student routes (public - no auth needed) */}
      <Route path="/quiz/:accessCode" element={<StudentQuiz />} />
      <Route path="/quiz/:accessCode/result/:attemptId" element={<StudentResult />} />

      {/* Teacher dashboard routes (protected) */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<DashboardOverview />} />
        <Route path="quizzes" element={<MyQuizzes />} />
        <Route path="quizzes/:id" element={<QuizDetail />} />
        <Route path="quizzes/:id/results" element={<QuizResults />} />
        <Route path="upload" element={<UploadQuestions />} />
        <Route path="questions" element={<QuestionBank />} />
        <Route path="create" element={<CreateQuiz />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
