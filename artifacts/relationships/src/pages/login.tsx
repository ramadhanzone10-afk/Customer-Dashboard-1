import { useState } from "react";
import { useLocation } from "wouter";
import { GraduationCap, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import logoUrl from "@assets/Logo_MathCourse_1777550046532.png";

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = login(email.trim(), password);
    if (!result.ok) {
      setError(result.error ?? "Login gagal");
      return;
    }
    // location will redirect automatically via App router
    setLocation("/");
  }

  function quickLogin(email: string, password: string) {
    setEmail(email);
    setPassword(password);
    const result = login(email, password);
    if (!result.ok) setError(result.error ?? "Login gagal");
    else setLocation("/");
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
              data-testid="img-logo-hero"
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
            Platform pembelajaran online untuk guru dan siswa: kelola materi, buat ujian,
            pantau progres, dan kelola pembayaran — semua di satu tempat.
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

        {/* Login form */}
        <Card className="shadow-lg">
          <CardContent className="p-6 md:p-8">
            <div className="md:hidden flex flex-col items-start mb-6">
              <img
                src={logoUrl}
                alt="MathCourse"
                className="h-14 w-auto object-contain"
                data-testid="img-logo-mobile"
              />
            </div>
            <h2 className="text-2xl font-bold mb-1">Selamat datang</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Masuk dengan akun guru atau siswa Anda.
            </p>
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="anda@mathclub.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-login">
                Masuk
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <div className="text-xs text-muted-foreground mb-3 font-medium">
                Akun demo (klik untuk login cepat):
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2"
                  onClick={() => quickLogin("guru@mathclub.id", "guru123")}
                  data-testid="button-demo-teacher"
                >
                  <span className="font-semibold">Login Guru</span>
                  <span className="text-[10px] text-muted-foreground">Pak Budi</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-col h-auto py-2"
                  onClick={() => quickLogin("andi@mathclub.id", "siswa123")}
                  data-testid="button-demo-student"
                >
                  <span className="font-semibold">Login Siswa</span>
                  <span className="text-[10px] text-muted-foreground">Andi</span>
                </Button>
              </div>
            </div>
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
