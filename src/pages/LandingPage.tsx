import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Upload,
  FileQuestion,
  CheckCircle2,
  BarChart3,
  FileSpreadsheet,
  Share2,
  ArrowRight,
  GraduationCap,
  ClipboardList,
  Timer,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const features = [
    {
      icon: Upload,
      title: 'Upload Question Papers',
      description: 'Import questions from Excel, CSV, or text files with automatic parsing and smart format detection.',
    },
    {
      icon: FileQuestion,
      title: 'Generate Interactive Quizzes',
      description: 'Build engaging quizzes with multiple choice, true/false, and short answer questions in minutes.',
    },
    {
      icon: CheckCircle2,
      title: 'Automatic Evaluation',
      description: 'Objective questions are scored instantly on submission. No manual grading needed for MCQs.',
    },
    {
      icon: BarChart3,
      title: 'Real-Time Results',
      description: 'View student scores, response breakdowns, and performance analytics as soon as submissions arrive.',
    },
    {
      icon: FileSpreadsheet,
      title: 'Excel Result Export',
      description: 'Download complete results as Excel or CSV files with summary and detailed response worksheets.',
    },
    {
      icon: Share2,
      title: 'Easy Quiz Sharing',
      description: 'Share quizzes with a simple link or quiz code. Students join instantly without creating accounts.',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Upload & Review',
      description: 'Upload your question file or add questions manually. Review, edit, and organize them in your question bank.',
      icon: Upload,
    },
    {
      number: '02',
      title: 'Publish & Share',
      description: 'Create a quiz, configure settings like time limits and marks, then publish and share the link with students.',
      icon: Share2,
    },
    {
      number: '03',
      title: 'Assess & Export',
      description: 'Students submit answers online. Get instant scoring, view results in your dashboard, and export to Excel.',
      icon: BarChart3,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/50 via-white to-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              How It Works
            </a>
            {user ? (
              <Button onClick={() => navigate('/dashboard')} size="sm">
                Go to Dashboard <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button onClick={() => navigate('/login')} variant="ghost" size="sm">
                  Login
                </Button>
                <Button onClick={() => navigate('/register')} size="sm">
                  Get Started
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 md:hidden">
            {user ? (
              <Button onClick={() => navigate('/dashboard')} size="sm">
                Dashboard
              </Button>
            ) : (
              <>
                <Button onClick={() => navigate('/login')} variant="ghost" size="sm">
                  Login
                </Button>
                <Button onClick={() => navigate('/register')} size="sm">
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-24 sm:px-6 lg:px-8 lg:pt-28">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50/40 via-transparent to-indigo-50/30" />
        <div className="absolute right-0 top-0 -z-10 h-96 w-96 rounded-full bg-blue-200/20 blur-3xl" />
        <div className="absolute left-0 top-40 -z-10 h-72 w-72 rounded-full bg-indigo-200/15 blur-3xl" />

        <div className="mx-auto max-w-4xl text-center animate-fade-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-700">
            <GraduationCap className="h-4 w-4" />
            Quiz Platform for Teachers & Students
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Create Quizzes. <span className="text-primary">Assess Smarter.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Turn question files into online quizzes and collect student results. Upload, create,
            share, and evaluate assessments with automatic scoring and Excel exports.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => navigate(user ? '/dashboard/upload' : '/register')}
              size="lg"
              className="w-full sm:w-auto"
            >
              Create a Quiz
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              Explore Features
            </Button>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="mx-auto mt-16 max-w-5xl animate-slide-up">
          <div className="rounded-xl border border-border/60 bg-white p-2 shadow-2xl shadow-blue-200/20">
            <div className="rounded-lg bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border/50 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Total Quizzes</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">12</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                      <ClipboardList className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Total Attempts</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">348</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Avg Score</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">78%</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
                      <BarChart3 className="h-5 w-5 text-orange-500" />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Published</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">8</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                      <Share2 className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-lg border border-border/50 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-1 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Recent Submissions</p>
                    <div className="mt-3 space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500" />
                            <span className="text-sm text-muted-foreground">Student {i}</span>
                          </div>
                          <span className="text-sm font-medium text-foreground">{85 + i}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything you need to assess students
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              From question upload to Excel export, secQuiz handles the entire assessment workflow.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <Card
                key={i}
                className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-6 w-6 text-primary transition-colors group-hover:text-primary-foreground" />
                  </div>
                  <CardTitle className="mt-4 text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-slate-50/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How It Works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Three simple steps from question paper to graded results.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={i} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="absolute left-[60%] top-12 hidden h-px w-[80%] bg-gradient-to-r from-primary/30 to-transparent md:block" />
                )}
                <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-border/50">
                  <step.icon className="h-8 w-8 text-primary" />
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, label: 'Secure & Private', desc: 'Row-level security protects teacher data' },
            { icon: Timer, label: 'Instant Scoring', desc: 'Automatic evaluation on submission' },
            { icon: FileSpreadsheet, label: 'Excel Export', desc: 'Download results in spreadsheet format' },
          ].map((badge, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border/50 bg-white p-4">
              <badge.icon className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">{badge.label}</p>
                <p className="text-xs text-muted-foreground">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 px-8 py-16 text-center shadow-xl">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to create your first quiz?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
            Join secQuiz today and streamline your assessment workflow.
          </p>
          <Button
            onClick={() => navigate(user ? '/dashboard' : '/register')}
            size="lg"
            variant="secondary"
            className="mt-8 bg-white text-primary hover:bg-blue-50"
          >
            {user ? 'Go to Dashboard' : 'Get Started Free'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo />
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} secQuiz. Create quizzes, assess smarter.
          </p>
        </div>
      </footer>
    </div>
  );
}
