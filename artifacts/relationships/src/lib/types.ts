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
  teacherId?: string;
}

export interface Material {
  id: string;
  title: string;
  description: string;
  content: string;
  subject?: string;
  bab?: string;
  fileName?: string;
  fileDataUrl?: string;
  imageDataUrl?: string;
  videoUrl?: string;
  videoFileName?: string;
  videoDataUrl?: string;
  timerMinutes?: number;
  createdBy: string;
  assignedTo: string[];
  createdAt: number;
  status?: "draft" | "published";
  materialType?: "materi" | "soal";
}

export interface MaterialProgress {
  userId: string;
  materialId: string;
  completedAt: number;
}

export type QuestionType = "mc" | "essay" | "tf" | "fill" | "mc-complex";

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correctAnswer?: number;
  correctAnswers?: number[];
  fillAnswer?: string;
  points: number;
  imageDataUrl?: string;
  pdfDataUrl?: string;
  pdfFileName?: string;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  durationMinutes: number;
  deadline: number;
  startDateTime?: number;
  assignedTo: string[];
  createdBy: string;
  createdAt: number;
  type?: "exam" | "tugas";
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  passingScore?: number;
  status?: "draft" | "published";
}

export interface ExamAnswer {
  questionId: string;
  mcAnswer?: number;
  complexAnswers?: number[];
  essayAnswer?: string;
  fillAnswer?: string;
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
  cbtViolations?: number;
}

export interface QuestionBankItem {
  id: string;
  question: Question;
  subject?: string;
  bab?: string;
  sourceExamTitle?: string;
  createdBy: string;
  createdAt: number;
}

export interface MaterialBankItem {
  id: string;
  title: string;
  description: string;
  content: string;
  subject?: string;
  bab?: string;
  materialType?: "materi" | "soal";
  fileName?: string;
  fileDataUrl?: string;
  imageDataUrl?: string;
  videoUrl?: string;
  videoFileName?: string;
  videoDataUrl?: string;
  timerMinutes?: number;
  createdBy: string;
  createdAt: number;
}

export type PaymentStatus = "unpaid" | "pending" | "paid";

export interface Payment {
  id: string;
  userId: string;
  month: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod?: string;
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
  | "announcement"
  | "new_student";

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
