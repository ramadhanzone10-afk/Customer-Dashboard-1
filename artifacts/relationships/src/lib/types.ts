export type Role = "teacher" | "student";

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  status?: "active" | "pending";
  avatarColor?: string;
  kelas?: string;
  phone?: string;
}

export interface Material {
  id: string;
  title: string;
  description: string;
  content: string;
  fileName?: string;
  fileDataUrl?: string;
  videoUrl?: string;
  videoFileName?: string;
  videoDataUrl?: string;
  timerMinutes?: number;
  createdBy: string;
  assignedTo: string[];
  createdAt: number;
}

export interface MaterialProgress {
  userId: string;
  materialId: string;
  completedAt: number;
}

export type QuestionType = "mc" | "essay";

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: number;
  points: number;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  durationMinutes: number;
  deadline: number;
  assignedTo: string[];
  createdBy: string;
  createdAt: number;
}

export interface ExamAnswer {
  questionId: string;
  mcAnswer?: number;
  essayAnswer?: string;
  essayScore?: number;
  essayFeedback?: string;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  userId: string;
  answers: ExamAnswer[];
  autoScore: number;
  manualScore: number;
  totalScore: number;
  maxScore: number;
  submittedAt: number;
  gradedAt?: number;
  fullyGraded: boolean;
}

export type PaymentStatus = "unpaid" | "pending" | "paid";

export interface Payment {
  id: string;
  userId: string;
  month: string;
  amount: number;
  status: PaymentStatus;
  proofFileName?: string;
  proofDataUrl?: string;
  uploadedAt?: number;
  verifiedAt?: number;
  notes?: string;
}

export interface ClassMessage {
  id: string;
  kelas: string;
  userId: string;
  text: string;
  createdAt: number;
}

export type NotificationType =
  | "new_material"
  | "new_exam"
  | "payment_due"
  | "exam_graded"
  | "payment_verified"
  | "payment_uploaded"
  | "announcement";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  createdAt: number;
  read: boolean;
}
