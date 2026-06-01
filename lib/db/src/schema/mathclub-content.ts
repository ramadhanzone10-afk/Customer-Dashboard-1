import { pgTable, text, integer, real, boolean, bigint, jsonb, timestamp } from "drizzle-orm/pg-core";

export const mcMaterialsTable = pgTable("mc_materials", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  content: text("content").notNull().default(""),
  fileName: text("file_name"),
  fileDataUrl: text("file_data_url"),
  videoUrl: text("video_url"),
  videoFileName: text("video_file_name"),
  videoDataUrl: text("video_data_url"),
  timerMinutes: integer("timer_minutes"),
  createdBy: text("created_by").notNull(),
  assignedTo: jsonb("assigned_to").notNull().default([]),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const mcMaterialProgressTable = pgTable("mc_material_progress", {
  userId: text("user_id").notNull(),
  materialId: text("material_id").notNull(),
  completedAt: bigint("completed_at", { mode: "number" }).notNull(),
});

export const mcExamsTable = pgTable("mc_exams", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  questions: jsonb("questions").notNull().default([]),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  deadline: bigint("deadline", { mode: "number" }).notNull(),
  assignedTo: jsonb("assigned_to").notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const mcExamSubmissionsTable = pgTable("mc_exam_submissions", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull(),
  userId: text("user_id").notNull(),
  answers: jsonb("answers").notNull().default([]),
  autoScore: real("auto_score").notNull().default(0),
  manualScore: real("manual_score").notNull().default(0),
  totalScore: real("total_score").notNull().default(0),
  maxScore: real("max_score").notNull().default(0),
  submittedAt: bigint("submitted_at", { mode: "number" }).notNull(),
  gradedAt: bigint("graded_at", { mode: "number" }),
  fullyGraded: boolean("fully_graded").notNull().default(false),
});

export const mcPaymentsTable = pgTable("mc_payments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  month: text("month").notNull(),
  amount: integer("amount").notNull().default(350000),
  status: text("status").notNull().default("unpaid"),
  paymentMethod: text("payment_method"),
  proofFileName: text("proof_file_name"),
  proofDataUrl: text("proof_data_url"),
  uploadedAt: bigint("uploaded_at", { mode: "number" }),
  verifiedAt: bigint("verified_at", { mode: "number" }),
  notes: text("notes"),
});

export const mcNotificationsTable = pgTable("mc_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  read: boolean("read").notNull().default(false),
});

export type McMaterialRow = typeof mcMaterialsTable.$inferSelect;
export type McExamRow = typeof mcExamsTable.$inferSelect;
export type McExamSubmissionRow = typeof mcExamSubmissionsTable.$inferSelect;
export type McPaymentRow = typeof mcPaymentsTable.$inferSelect;
export type McNotificationRow = typeof mcNotificationsTable.$inferSelect;
