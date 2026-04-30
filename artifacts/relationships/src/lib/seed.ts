import { read, write, uid } from "./storage";
import type { User, Material, Exam, Payment, AppNotification } from "./types";

const SEED_KEY = "mathclub:v1:seeded";

export function ensureSeed() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEED_KEY) === "true") {
    // Migration: ensure classes list exists for users seeded before
    const existing = read("classes", []);
    if (existing.length === 0) {
      const defaults = [
        "10 IPA 1",
        "10 IPA 2",
        "11 IPA 1",
        "11 IPA 2",
        "12 IPA 1",
        "12 IPA 2",
      ];
      const fromUsers = Array.from(
        new Set(
          read("users", [])
            .map((u) => u.kelas)
            .filter((k): k is string => !!k && k.trim().length > 0),
        ),
      );
      const merged = Array.from(new Set([...defaults, ...fromUsers]));
      write("classes", merged);
    }
    return;
  }

  const teacher: User = {
    id: "u_teacher",
    email: "guru@mathclub.id",
    password: "guru123",
    name: "Pak Budi",
    role: "teacher",
    avatarColor: "#6366f1",
  };

  const students: User[] = [
    {
      id: "u_andi",
      email: "andi@mathclub.id",
      password: "siswa123",
      name: "Andi Pratama",
      role: "student",
      avatarColor: "#10b981",
      kelas: "10 IPA 1",
      phone: "081234567890",
    },
    {
      id: "u_siti",
      email: "siti@mathclub.id",
      password: "siswa123",
      name: "Siti Nurhaliza",
      role: "student",
      avatarColor: "#f59e0b",
      kelas: "11 IPA 2",
      phone: "081298765432",
    },
    {
      id: "u_rudi",
      email: "rudi@mathclub.id",
      password: "siswa123",
      name: "Rudi Hartono",
      role: "student",
      avatarColor: "#ec4899",
      kelas: "12 IPA 1",
      phone: "081345678910",
    },
  ];

  const users: User[] = [teacher, ...students];

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const materials: Material[] = [
    {
      id: uid("m_"),
      title: "Pengenalan Aljabar Linear",
      description: "Dasar-dasar aljabar linear: vektor, matriks, dan operasi dasar.",
      content:
        "# Aljabar Linear: Pengenalan\n\nAljabar linear adalah cabang matematika yang mempelajari vektor, ruang vektor, dan transformasi linear.\n\n## Vektor\nVektor adalah objek matematis yang memiliki besaran dan arah. Contoh: v = (3, 4) adalah vektor 2 dimensi.\n\n## Matriks\nMatriks adalah susunan bilangan dalam baris dan kolom. Operasi dasar meliputi penjumlahan, perkalian skalar, dan perkalian matriks.\n\n## Latihan\n1. Hitung 2v jika v = (3, 4)\n2. Jumlahkan dua matriks 2x2 sederhana",
      timerMinutes: 30,
      createdBy: teacher.id,
      assignedTo: students.map((s) => s.id),
      createdAt: now - 7 * day,
    },
    {
      id: uid("m_"),
      title: "Trigonometri Dasar",
      description: "Sin, cos, tan dan aplikasinya pada segitiga siku-siku.",
      content:
        "# Trigonometri Dasar\n\nTrigonometri mempelajari hubungan sudut dan sisi segitiga.\n\n## Identitas Pokok\n- sin²θ + cos²θ = 1\n- tan θ = sin θ / cos θ\n\n## Segitiga Siku-siku\nUntuk sudut θ:\n- sin θ = depan / miring\n- cos θ = samping / miring\n- tan θ = depan / samping",
      timerMinutes: 45,
      createdBy: teacher.id,
      assignedTo: students.map((s) => s.id),
      createdAt: now - 3 * day,
    },
    {
      id: uid("m_"),
      title: "Pengantar Kalkulus",
      description: "Konsep limit dan turunan untuk pemula.",
      content:
        "# Pengantar Kalkulus\n\nKalkulus mempelajari perubahan dan akumulasi.\n\n## Limit\nLimit adalah nilai yang didekati fungsi ketika input mendekati suatu titik.\n\n## Turunan\nTurunan f'(x) mengukur laju perubahan f(x) terhadap x.",
      createdBy: teacher.id,
      assignedTo: [students[0].id, students[1].id],
      createdAt: now - 1 * day,
    },
  ];

  const exams: Exam[] = [
    {
      id: uid("e_"),
      title: "Ujian Aljabar Linear",
      description: "Ujian penilaian materi aljabar linear minggu ini.",
      questions: [
        {
          id: uid("q_"),
          type: "mc",
          question: "Berapakah hasil dari 2 × (3, 4)?",
          options: ["(5, 6)", "(6, 8)", "(2, 8)", "(6, 4)"],
          correctAnswer: 1,
          points: 20,
        },
        {
          id: uid("q_"),
          type: "mc",
          question: "Matriks identitas berordo 2x2 adalah:",
          options: ["[[0,0],[0,0]]", "[[1,0],[0,1]]", "[[1,1],[1,1]]", "[[0,1],[1,0]]"],
          correctAnswer: 1,
          points: 20,
        },
        {
          id: uid("q_"),
          type: "essay",
          question:
            "Jelaskan dengan kata-kata Anda sendiri apa yang dimaksud dengan vektor dan berikan satu contoh penerapannya di dunia nyata.",
          points: 60,
        },
      ],
      durationMinutes: 30,
      deadline: now + 5 * day,
      assignedTo: students.map((s) => s.id),
      createdBy: teacher.id,
      createdAt: now - 2 * day,
    },
    {
      id: uid("e_"),
      title: "Quiz Trigonometri",
      description: "Quiz singkat materi trigonometri.",
      questions: [
        {
          id: uid("q_"),
          type: "mc",
          question: "Nilai dari sin 30° adalah:",
          options: ["1/2", "√2/2", "√3/2", "1"],
          correctAnswer: 0,
          points: 25,
        },
        {
          id: uid("q_"),
          type: "mc",
          question: "Identitas pokok trigonometri adalah:",
          options: [
            "sin²θ - cos²θ = 1",
            "sin²θ + cos²θ = 1",
            "tan²θ + 1 = sin²θ",
            "sin θ + cos θ = 1",
          ],
          correctAnswer: 1,
          points: 25,
        },
        {
          id: uid("q_"),
          type: "essay",
          question: "Jelaskan perbedaan sin, cos, dan tan pada segitiga siku-siku.",
          points: 50,
        },
      ],
      durationMinutes: 20,
      deadline: now + 2 * day,
      assignedTo: students.map((s) => s.id),
      createdBy: teacher.id,
      createdAt: now - 1 * day,
    },
  ];

  const months = ["2026-02", "2026-03", "2026-04"];
  const payments: Payment[] = [];
  for (const s of students) {
    months.forEach((month, idx) => {
      let status: Payment["status"] = "paid";
      let uploadedAt: number | undefined = now - (3 - idx) * 14 * day;
      let verifiedAt: number | undefined = now - (3 - idx) * 13 * day;
      if (idx === 2 && s.id === "u_rudi") {
        status = "unpaid";
        uploadedAt = undefined;
        verifiedAt = undefined;
      }
      if (idx === 2 && s.id === "u_siti") {
        status = "pending";
        uploadedAt = now - 1 * day;
        verifiedAt = undefined;
      }
      payments.push({
        id: uid("p_"),
        userId: s.id,
        month,
        amount: 350000,
        status,
        uploadedAt,
        verifiedAt,
      });
    });
  }

  const notifications: AppNotification[] = [];
  for (const s of students) {
    notifications.push({
      id: uid("n_"),
      userId: s.id,
      type: "new_exam",
      title: "Ujian baru tersedia",
      message: "Quiz Trigonometri telah dibagikan. Kerjakan sebelum deadline.",
      link: "/student/exams",
      createdAt: now - 1 * day,
      read: false,
    });
    notifications.push({
      id: uid("n_"),
      userId: s.id,
      type: "new_material",
      title: "Materi baru",
      message: "Pak Budi membagikan materi Trigonometri Dasar.",
      link: "/student/materials",
      createdAt: now - 3 * day,
      read: false,
    });
  }
  notifications.push({
    id: uid("n_"),
    userId: "u_rudi",
    type: "payment_due",
    title: "Pembayaran belum lunas",
    message: "Pembayaran SPP April 2026 belum dilakukan.",
    link: "/student/payments",
    createdAt: now - 2 * day,
    read: false,
  });

  const classes = [
    "10 IPA 1",
    "10 IPA 2",
    "11 IPA 1",
    "11 IPA 2",
    "12 IPA 1",
    "12 IPA 2",
  ];

  write("users", users);
  write("materials", materials);
  write("materialProgress", []);
  write("exams", exams);
  write("examSubmissions", []);
  write("payments", payments);
  write("notifications", notifications);
  write("session", null);
  write("classes", classes);

  // Initial unread teacher notification
  const teacherNotif: AppNotification[] = read("notifications", []);
  teacherNotif.push({
    id: uid("n_"),
    userId: teacher.id,
    type: "payment_uploaded",
    title: "Bukti pembayaran masuk",
    message: "Siti Nurhaliza mengunggah bukti pembayaran April 2026.",
    link: "/teacher/payments",
    createdAt: now - 1 * day,
    read: false,
  });
  write("notifications", teacherNotif);

  window.localStorage.setItem(SEED_KEY, "true");
}
