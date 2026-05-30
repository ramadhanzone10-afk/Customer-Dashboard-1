import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Save, User as UserIcon, CheckCircle2, KeyRound, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, useStore } from "@/lib/auth";
import { read, write } from "@/lib/storage";
import { mcApi } from "@/lib/api-client";
import type { User } from "@/lib/types";

export default function StudentProfile() {
  const { user, refresh } = useAuth();
  const classes = useStore<string[]>("classes", []);
  const [name, setName] = useState(user?.name ?? "");
  const [kelas, setKelas] = useState(user?.kelas ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setKelas(user?.kelas ?? "");
    setPhone(user?.phone ?? "");
  }, [user]);

  function save() {
    if (!name.trim()) {
      alert("Nama tidak boleh kosong.");
      return;
    }
    if (password && password !== confirmPassword) {
      alert("Konfirmasi password tidak cocok.");
      return;
    }
    if (password && password.length < 6) {
      alert("Password minimal 6 karakter.");
      return;
    }

    const all = read("users", []);
    const updated: User[] = all.map((u) =>
      u.id === user!.id
        ? {
            ...u,
            name: name.trim(),
            kelas: kelas.trim() || undefined,
            phone: phone.trim() || undefined,
            password: password ? password : u.password,
          }
        : u,
    );
    write("users", updated);
    void mcApi.updateUser(user!.id, {
      name: name.trim(),
      kelas: kelas.trim() || undefined,
      phone: phone.trim() || undefined,
      ...(password ? { password } : {}),
    }).catch(() => {});
    refresh();
    setPassword("");
    setConfirmPassword("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/student">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Kembali
        </Link>
      </Button>

      <div className="flex items-center gap-4">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center text-white font-bold text-2xl"
          style={{ background: user.avatarColor ?? "#6366f1" }}
        >
          {user.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-2xl font-bold">Profil Saya</h1>
          <p className="text-sm text-muted-foreground">
            Kelola informasi pribadi dan akun kamu.
          </p>
        </div>
      </div>

      {saved && (
        <Alert className="border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700 dark:text-emerald-300">
            Perubahan profil berhasil disimpan.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Informasi Pribadi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nama lengkap</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="contoh: Andi Pratama"
              data-testid="input-profile-name"
            />
          </div>
          <div>
            <Label>Kelas</Label>
            <Select
              value={kelas || "__none__"}
              onValueChange={(v) => setKelas(v === "__none__" ? "" : v)}
            >
              <SelectTrigger data-testid="select-profile-kelas">
                <SelectValue placeholder="Pilih kelas kamu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Belum dipilih —</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Hubungi guru jika kelas kamu belum tersedia di daftar.
            </p>
          </div>
          <div>
            <Label>Nomor HP</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="contoh: 081234567890"
              data-testid="input-profile-phone"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user.email} disabled />
            <p className="text-xs text-muted-foreground mt-1">
              Email tidak dapat diubah.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Ganti Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Kosongkan jika tidak ingin mengganti password.
          </p>
          <div>
            <Label>Password baru</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="pr-10"
                data-testid="input-profile-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label>Konfirmasi password baru</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="pr-10"
                data-testid="input-profile-confirm-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {password && (
            <div className="flex gap-1 flex-wrap">
              {[
                { label: "≥6 karakter", ok: password.length >= 6 },
                { label: "Cocok", ok: password === confirmPassword && confirmPassword !== "" },
              ].map(({ label, ok }) => (
                <span
                  key={label}
                  className={`text-xs px-2 py-0.5 rounded-full ${ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
                >
                  {ok ? "✓" : "○"} {label}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} size="lg" data-testid="button-save-profile">
          <Save className="h-4 w-4 mr-2" />
          Simpan Perubahan
        </Button>
      </div>
    </div>
  );
}
