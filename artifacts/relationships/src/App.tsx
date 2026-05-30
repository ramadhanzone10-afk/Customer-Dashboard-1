import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ensureSeed, ensureDefaultUsers } from "@/lib/seed";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

import TeacherDashboard from "@/pages/teacher/dashboard";
import TeacherStudents from "@/pages/teacher/students";
import TeacherMaterials from "@/pages/teacher/materials";
import TeacherExams from "@/pages/teacher/exams";
import TeacherExamResults from "@/pages/teacher/exam-results";
import TeacherPayments from "@/pages/teacher/payments";

import StudentDashboard from "@/pages/student/dashboard";
import StudentMaterials from "@/pages/student/materials";
import StudentMaterialView from "@/pages/student/material-view";
import StudentExams from "@/pages/student/exams";
import StudentTakeExam from "@/pages/student/take-exam";
import StudentExamResult from "@/pages/student/exam-result";
import StudentProgress from "@/pages/student/progress";
import StudentPayments from "@/pages/student/payments";
import StudentProfile from "@/pages/student/profile";
import StudentClass from "@/pages/student/class";

const queryClient = new QueryClient();

function Protected({ role, children }: { role: "teacher" | "student"; children: React.ReactNode }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!user) setLocation("/login");
    else if (user.role !== role) setLocation(user.role === "teacher" ? "/teacher" : "/student");
  }, [user, role, setLocation]);
  if (!user || user.role !== role) return null;
  return <Layout>{children}</Layout>;
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />;
  return <Redirect to={user.role === "teacher" ? "/teacher" : "/student"} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />

      <Route path="/teacher" component={() => <Protected role="teacher"><TeacherDashboard /></Protected>} />
      <Route path="/teacher/students" component={() => <Protected role="teacher"><TeacherStudents /></Protected>} />
      <Route path="/teacher/materials" component={() => <Protected role="teacher"><TeacherMaterials /></Protected>} />
      <Route path="/teacher/exams" component={() => <Protected role="teacher"><TeacherExams /></Protected>} />
      <Route path="/teacher/exams/:id/results" component={() => <Protected role="teacher"><TeacherExamResults /></Protected>} />
      <Route path="/teacher/payments" component={() => <Protected role="teacher"><TeacherPayments /></Protected>} />

      <Route path="/student" component={() => <Protected role="student"><StudentDashboard /></Protected>} />
      <Route path="/student/materials" component={() => <Protected role="student"><StudentMaterials /></Protected>} />
      <Route path="/student/materials/:id" component={() => <Protected role="student"><StudentMaterialView /></Protected>} />
      <Route path="/student/exams" component={() => <Protected role="student"><StudentExams /></Protected>} />
      <Route path="/student/exams/:id" component={() => <Protected role="student"><StudentTakeExam /></Protected>} />
      <Route path="/student/exams/:id/result" component={() => <Protected role="student"><StudentExamResult /></Protected>} />
      <Route path="/student/progress" component={() => <Protected role="student"><StudentProgress /></Protected>} />
      <Route path="/student/payments" component={() => <Protected role="student"><StudentPayments /></Protected>} />
      <Route path="/student/profile" component={() => <Protected role="student"><StudentProfile /></Protected>} />
      <Route path="/student/class" component={() => <Protected role="student"><StudentClass /></Protected>} />

      <Route path="/" component={RootRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    ensureSeed();
    void ensureDefaultUsers();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
