import { useState } from "react";
import { useLocation } from "wouter";
import { GraduationCap, BookOpen, Sparkles, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { read, write, uid } from "@/lib/storage";
import { mcApi } from "@/lib/api-client";
import type { User } from "@/lib/types";
import logoUrl from "@assets/Logo_MathCourse_1777550046532.png";

const AVATAR_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#3b82f6",
  "#8b5cf6", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
];

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  // --- Login state ---
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginShowPw, setLoginShowPw] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // --- Register state ---
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regRole, setRegRole] = useState<"student" | "teacher">("student");
  const [regKelas, setRegKelas] = useState("");
  const [regShowPw, setRegShowPw] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState(false);

  const classes = read("classes", [
    "10 IPA 1", "10 IPA 2", "11 IPA 1", "11 IPA 2", "12 IPA 1", "12 IPA 2",
  ]);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const result = await login(loginEmail.trim(), loginPassword);
    if (!result.ok) {
      setLoginError(result.error ?? "Login gagal");
      return;
    }
    setLocation("/");
  }

  function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim()) { setRegError("Nama lengkap wajib diisi."); return; }
    if (!regEmail.trim()) { setRegError("Email wajib diisi."); return; }
    if (regPassword.length < 6) { setRegError("Password minimal 6 karakter."); return; }
    if (regPassword !== regConfirm) { setRegError("Konfirmasi password tidak cocok."); return; }
    const users = read("users", []);
    const exists = users.find(
      (u) => u.email.toLowerCase() === regEmail.trim().toLowerCase(),
    );
    if (exists) {
      setRegError("Email sudah terdaftar. Silakan gunakan email lain.");
      return;
    }

    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const newUser: User = {
      id: uid("u_"),
      email: regEmail.trim().toLowerCase(),
      password: regPassword,
      name: regName.trim(),
      role: regRole,
      avatarColor: color,
      ...(regPhone.trim() ? { phone: regPhone.trim() } : {}),
      ...(regRole === "student" && regKelas ? { kelas: regKelas } : {}),
    };

    write("users", [...users, newUser]);
    void mcApi.createUser(newUser).catch(() => {});
    setRegSuccess(true);

    // Auto-login after 1.2 s
    setTimeout(async () => {
      const result = await login(newUser.email, newUser.password);
      if (result.ok) setLocation("/");
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-background to-purple-50 dark:from-indigo-950 dark:via-background dark:to-purple-950 flex items-center justify-center p-4">
      <div className="grid md:grid-cols-2 gap-8 max-w-5xl w-full">
        {/* Hero panel */}
        <div className="hidden md:flex flex-col justify-center p-8">
          <div className="mb-6">
            <img
              src={logoUrl}
              alt="MathCourse"
              className="h-20 w-auto object-contain"
            />
            <div className="text-sm text-muted-foreground mt-1 ml-1">
              Bimbel Online Modern
            </div>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Belajar matematika
            <br />
            jadi lebih menyenangkan.
          </h1>
          <p className="text-muted-foreground mb-8">
            Platform pembelajaran online untuk guru dan siswa: kelola materi, buat
            ujian, pantau progres, dan kelola pembayaran — semua di satu tempat.
          </p>
          <div className="space-y-3">
            <FeatureRow
              icon={<BookOpen className="h-4 w-4" />}
              text="Materi lengkap dengan timer belajar dan unggah file"
            />
            <FeatureRow
              icon={<Sparkles className="h-4 w-4" />}
              text="Ujian online dengan koreksi otomatis"
            />
            <FeatureRow
              icon={<GraduationCap className="h-4 w-4" />}
              text="Dashboard berbeda untuk guru dan siswa"
            />
          </div>
        </div>

        {/* Auth card */}
        <Card className="shadow-lg">
          <CardContent className="p-6 md:p-8">
            <div className="md:hidden flex flex-col items-start mb-6">
              <img
                src={logoUrl}
                alt="MathCourse"
                className="h-14 w-auto object-contain"
              />
            </div>

            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Masuk</TabsTrigger>
                <TabsTrigger value="register">Daftar Akun</TabsTrigger>
              </TabsList>

              {/* ── LOGIN TAB ── */}
              <TabsContent value="login">
                <h2 className="text-2xl font-bold mb-1">Selamat datang</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Masuk dengan akun guru atau siswa Anda.
                </p>
                <form onSubmit={submitLogin} className="space-y-4">
                  {loginError && (
                    <Alert variant="destructive">
                      <AlertDescription>{loginError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="anda@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={loginShowPw ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        data-testid="input-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setLoginShowPw((v) => !v)}
                        tabIndex={-1}
                      >
                        {loginShowPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    data-testid="button-login"
                  >
                    Masuk
                  </Button>
                </form>
              </TabsContent>

              {/* ── REGISTER TAB ── */}
              <TabsContent value="register">
                <h2 className="text-2xl font-bold mb-1">Buat Akun</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Daftar sebagai siswa atau guru MathClub.
                </p>

                {regSuccess ? (
                  <div className="text-center py-8 space-y-2">
                    <div className="text-4xl">✓</div>
                    <div className="font-semibold text-lg">Akun berhasil dibuat!</div>
                    <div className="text-sm text-muted-foreground">
                      Mengalihkan ke dashboard...
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitRegister} className="space-y-4">
                    {regError && (
                      <Alert variant="destructive">
                        <AlertDescription>{regError}</AlertDescription>
                      </Alert>
                    )}

                    {/* Role selector */}
                    <div className="space-y-2">
                      <Label>Daftar sebagai</Label>
                      <RadioGroup
                        value={regRole}
                        onValueChange={(v) =>
                          setRegRole(v as "student" | "teacher")
                        }
                        className="flex gap-4"
                        data-testid="radio-role"
                      >
                        <div className="flex items-center gap-2 flex-1 border rounded-lg p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                          <RadioGroupItem value="student" id="role-student" />
                          <Label htmlFor="role-student" className="cursor-pointer">
                            <div className="font-medium">Siswa</div>
                            <div className="text-[11px] text-muted-foreground">
                              Akses materi & ujian
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 flex-1 border rounded-lg p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                          <RadioGroupItem value="teacher" id="role-teacher" />
                          <Label htmlFor="role-teacher" className="cursor-pointer">
                            <div className="font-medium">Guru</div>
                            <div className="text-[11px] text-muted-foreground">
                              Kelola siswa & materi
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-name">Nama Lengkap</Label>
                      <Input
                        id="reg-name"
                        placeholder="Nama lengkap Anda"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required
                        data-testid="input-reg-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="anda@email.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required
                        data-testid="input-reg-email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-phone">
                        Nomor HP{" "}
                        <span className="text-muted-foreground font-normal">
                          (opsional)
                        </span>
                      </Label>
                      <Input
                        id="reg-phone"
                        type="tel"
                        placeholder="08xxxxxxxxxx"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        data-testid="input-reg-phone"
                      />
                    </div>

                    {regRole === "student" && (
                      <div className="space-y-2">
                        <Label>
                          Kelas{" "}
                          <span className="text-muted-foreground font-normal">
                            (opsional)
                          </span>
                        </Label>
                        <Select value={regKelas} onValueChange={setRegKelas}>
                          <SelectTrigger data-testid="select-reg-kelas">
                            <SelectValue placeholder="Pilih kelas (bisa diatur nanti)" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map((k) => (
                              <SelectItem key={k} value={k}>
                                {k}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="reg-password"
                          type={regShowPw ? "text" : "password"}
                          placeholder="Minimal 6 karakter"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          required
                          data-testid="input-reg-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setRegShowPw((v) => !v)}
                          tabIndex={-1}
                        >
                          {regShowPw ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-confirm">Konfirmasi Password</Label>
                      <Input
                        id="reg-confirm"
                        type="password"
                        placeholder="Ulangi password"
                        value={regConfirm}
                        onChange={(e) => setRegConfirm(e.target.value)}
                        required
                        data-testid="input-reg-confirm"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      data-testid="button-register"
                    >
                      Buat Akun
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
      <div className="text-sm">{text}</div>
    </div>
  );
}
