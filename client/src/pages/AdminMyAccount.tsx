import SEOHead from "@/components/SEOHead";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Shield, User, Mail, Phone, Key, Loader2, CheckCircle,
  AlertTriangle, Lock, RefreshCw, Eye, EyeOff
} from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function AdminMyAccount() {
  const { t, lang } = useI18n();
  const { user, isAuthenticated, loading } = useAuth();

  // Profile state
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");

  const [phone, setPhone] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const profile = trpc.auth.getFullProfile.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success(lang === "ar" ? "تم تحديث البيانات بنجاح" : "Profile updated successfully");
      profile.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const [changingPassword, setChangingPassword] = useState(false);

  // Populate form when profile loads
  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name || "");
      setNameAr(profile.data.nameAr || "");

      setPhone(profile.data.phone || "");
      setRecoveryEmail((profile.data as any).recoveryEmail || "");
    }
  }, [profile.data]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }
  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-heading font-bold mb-2">{lang === "ar" ? "غير مصرح" : "Unauthorized"}</h2>
          <p className="text-muted-foreground">{lang === "ar" ? "ليس لديك صلاحية الوصول لهذه الصفحة" : "You don't have access to this page"}</p>
        </div>
        <Footer />
      </div>
    );
  }

  const handleProfileSave = () => {
    updateProfile.mutate({
      name: name || undefined,
      nameAr: nameAr || undefined,
      phone: phone || undefined,
      recoveryEmail: recoveryEmail || undefined,
    });
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword) {
      toast.error(lang === "ar" ? "يرجى ملء جميع الحقول" : "Please fill all fields");
      return;
    }
    if (newPassword.length < 8) {
      toast.error(lang === "ar" ? "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" : "New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(lang === "ar" ? "كلمة المرور الجديدة غير متطابقة" : "New passwords don't match");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(lang === "ar" ? (data.errorAr || data.error) : data.error);
      } else {
        toast.success(lang === "ar" ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setChangingPassword(false);
    }
  };

  const passwordStrength = (pw: string) => {
    if (!pw) return { level: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { level: score, label: lang === "ar" ? "ضعيفة" : "Weak", color: "bg-red-500" };
    if (score <= 3) return { level: score, label: lang === "ar" ? "متوسطة" : "Medium", color: "bg-amber-500" };
    return { level: score, label: lang === "ar" ? "قوية" : "Strong", color: "bg-green-500" };
  };

  const strength = passwordStrength(newPassword);

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead title="My Account" titleAr="حسابي" path="/admin/my-account" noindex={true} />
      <Navbar />
      <div className="container py-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold">{lang === "ar" ? "حسابي — المدير الأساسي" : "My Account — Root Admin"}</h1>
            <p className="text-muted-foreground text-sm">
              {lang === "ar" ? "إدارة بياناتك الشخصية وأمان حسابك" : "Manage your personal info and account security"}
            </p>
          </div>
        </div>

        {/* Root Admin Status */}
        <Card className="mb-6 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-red-500" />
              <div>
                <div className="font-semibold text-sm">
                  {lang === "ar" ? "حساب محمي — المدير الأساسي (Root Admin)" : "Protected Account — Root Admin"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lang === "ar"
                    ? "هذا الحساب لا يمكن تنزيل دوره أو حذفه من قبل أي مدير آخر. أنت المالك الأساسي للمنصة."
                    : "This account cannot be demoted or deleted by any other admin. You are the platform owner."}
                </div>
              </div>
              <Badge className="bg-red-600 text-white border-0 ms-auto shrink-0">Root</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {lang === "ar" ? "البيانات الشخصية" : "Personal Information"}
            </CardTitle>
            <CardDescription>
              {lang === "ar" ? "تحديث اسمك وبيانات التواصل" : "Update your name and contact details"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label>{lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder="الاسم الكامل" dir="rtl" />
              </div>
            </div>
            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {lang === "ar" ? "البريد الإلكتروني" : "Email"}
              </Label>
              <Input type="email" value={profile.data?.email || ""} disabled className="bg-muted/50" />
              <p className="text-xs text-muted-foreground">{lang === "ar" ? "البريد الإلكتروني غير قابل للتغيير — مرتبط بحساب التسجيل" : "Email cannot be changed — linked to your registration account"}</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {lang === "ar" ? "رقم الهاتف" : "Phone"}
              </Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966 5xx xxx xxxx" />
            </div>

            <Separator />

            {/* Recovery Email */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                {lang === "ar" ? "بريد الاسترجاع (Recovery Email)" : "Recovery Email"}
              </Label>
              <Input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder={lang === "ar" ? "بريد إلكتروني بديل لاسترجاع الحساب" : "Alternative email for account recovery"}
              />
              <p className="text-xs text-muted-foreground">
                {lang === "ar"
                  ? "استخدم بريداً مختلفاً عن بريدك الأساسي. سيُستخدم لاسترجاع حسابك في حال فقدان الوصول."
                  : "Use a different email from your primary. This will be used to recover your account if you lose access."}
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleProfileSave}
                disabled={updateProfile.isPending}
                className="gap-2 bg-[#3ECFC0] hover:bg-[#35b5a8] text-white"
              >
                {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle className="h-4 w-4" />
                {lang === "ar" ? "حفظ البيانات" : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {lang === "ar" ? "تغيير كلمة المرور" : "Change Password"}
            </CardTitle>
            <CardDescription>
              {lang === "ar" ? "استخدم كلمة مرور قوية لحماية حسابك" : "Use a strong password to protect your account"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{lang === "ar" ? "كلمة المرور الحالية" : "Current Password"}</Label>
              <div className="relative">
                <Input
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{lang === "ar" ? "كلمة المرور الجديدة" : "New Password"}</Label>
              <div className="relative">
                <Input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Password Strength Meter */}
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          i <= strength.level ? strength.color : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${strength.level <= 2 ? "text-red-500" : strength.level <= 3 ? "text-amber-500" : "text-green-500"}`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{lang === "ar" ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {lang === "ar" ? "كلمة المرور غير متطابقة" : "Passwords don't match"}
                </p>
              )}
            </div>

            {/* Password Tips */}
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">{lang === "ar" ? "نصائح لكلمة مرور قوية:" : "Tips for a strong password:"}</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>{lang === "ar" ? "8 أحرف على الأقل (يُفضل 12+)" : "At least 8 characters (12+ recommended)"}</li>
                <li>{lang === "ar" ? "حروف كبيرة وصغيرة" : "Upper and lowercase letters"}</li>
                <li>{lang === "ar" ? "أرقام ورموز خاصة" : "Numbers and special characters"}</li>
                <li>{lang === "ar" ? "لا تستخدم نفس كلمة المرور في مواقع أخرى" : "Don't reuse passwords from other sites"}</li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handlePasswordChange}
                disabled={changingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                variant="destructive"
                className="gap-2"
              >
                {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                <Key className="h-4 w-4" />
                {lang === "ar" ? "تغيير كلمة المرور" : "Change Password"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {lang === "ar" ? "ملخص الأمان" : "Security Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{lang === "ar" ? "حماية Root Admin" : "Root Admin Protection"}</span>
                </div>
                <Badge className="bg-green-600 text-white border-0">{lang === "ar" ? "مفعّل" : "Active"}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">{lang === "ar" ? "بريد الاسترجاع" : "Recovery Email"}</span>
                </div>
                <Badge className={recoveryEmail ? "bg-green-600 text-white border-0" : "bg-amber-500 text-white border-0"}>
                  {recoveryEmail
                    ? (lang === "ar" ? "مُعيّن" : "Set")
                    : (lang === "ar" ? "غير مُعيّن" : "Not Set")}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">{lang === "ar" ? "رقم الهاتف" : "Phone Number"}</span>
                </div>
                <Badge className={phone ? "bg-green-600 text-white border-0" : "bg-amber-500 text-white border-0"}>
                  {phone
                    ? (lang === "ar" ? "مُعيّن" : "Set")
                    : (lang === "ar" ? "غير مُعيّن" : "Not Set")}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-teal-500" />
                  <span className="text-sm">{lang === "ar" ? "آخر تسجيل دخول" : "Last Sign In"}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {profile.data?.lastSignedIn
                    ? new Date(profile.data.lastSignedIn).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")
                    : "—"}
                </span>
              </div>
            </div>

            {/* Recommendations */}
            {(!recoveryEmail || !phone) && (
              <div className="mt-4 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {lang === "ar" ? "توصيات أمنية" : "Security Recommendations"}
                  </span>
                </div>
                <ul className="text-xs text-amber-600 dark:text-amber-300 space-y-1 list-disc list-inside">
                  {!recoveryEmail && (
                    <li>{lang === "ar" ? "أضف بريد استرجاع لتتمكن من استعادة حسابك" : "Add a recovery email to restore your account if needed"}</li>
                  )}
                  {!phone && (
                    <li>{lang === "ar" ? "أضف رقم هاتف للتحقق الإضافي" : "Add a phone number for additional verification"}</li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back to Dashboard */}
        <div className="text-center">
          <Link href="/admin">
            <Button variant="outline" className="gap-2">
              {lang === "ar" ? "العودة للوحة الإدارة" : "Back to Dashboard"}
            </Button>
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
