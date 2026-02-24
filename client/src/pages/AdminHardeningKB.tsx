/**
 * Admin Hardening Knowledge Base
 * Accessible only to Root Admin (isRootAdmin) users
 * Integrated into the admin panel via DashboardLayout
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import {
  Shield, Search, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  FileText, ShieldCheck, Server, Gauge, Lock, Eye, BarChart3,
  Activity, ListChecks, Rocket, CheckCircle2, AlertTriangle,
  Zap, HelpCircle, ArrowRight, ArrowLeft, X, Loader2, KeyRound,
  SearchIcon
} from "lucide-react";
import {
  sections, getOverallStats, getSectionStats, getStatusLabel,
  getPriorityLabel, type Section, type CheckItem
} from "@/lib/hardeningData";

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  FileText, ShieldCheck, Server, Gauge, Lock, Search: SearchIcon,
  Eye, BarChart3, Activity, ListChecks, Rocket,
};

function getIcon(name: string) {
  return iconMap[name] || FileText;
}

// Status colors
function getStatusColor(status: CheckItem["status"]) {
  switch (status) {
    case "done": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "partial": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "missing": return "bg-red-500/15 text-red-400 border-red-500/30";
    case "unknown": return "bg-slate-500/15 text-slate-400 border-slate-500/30";
  }
}

function getPriorityColor(priority: CheckItem["priority"]) {
  switch (priority) {
    case "critical": return "bg-red-500/10 text-red-400 border-red-500/20";
    case "high": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "medium": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "low": return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
}

// ─── Section Card (Grid View) ───────────────────────────────────────
function SectionCard({ section, onClick }: { section: Section; onClick: () => void }) {
  const Icon = getIcon(section.icon);
  const stats = getSectionStats(section);

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-[#3ECFC0]/5 hover:border-[#3ECFC0]/30 bg-card"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#3ECFC0]/10 border border-[#3ECFC0]/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-[#3ECFC0]" />
            </div>
            <div>
              <Badge variant="outline" className="text-xs mb-1">{section.number}</Badge>
              <CardTitle className="text-base">{section.titleShort}</CardTitle>
            </div>
          </div>
          <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-[#3ECFC0] transition-colors" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{section.description}</p>
        {stats && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{stats.done}/{stats.total}</span>
              <span className="font-medium text-[#3ECFC0]">{stats.progress}%</span>
            </div>
            <Progress value={stats.progress} className="h-1.5" />
          </div>
        )}
        {section.subsections && !stats && (
          <div className="text-xs text-muted-foreground">
            {section.subsections.length} أقسام فرعية
          </div>
        )}
        {section.tables && !stats && (
          <div className="text-xs text-muted-foreground">
            {section.tables.length} جداول بيانات
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Check Item Row ─────────────────────────────────────────────────
function CheckItemRow({ item, searchQuery }: { item: CheckItem; searchQuery: string }) {
  const [expanded, setExpanded] = useState(false);

  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-[#3ECFC0]/30 text-foreground rounded px-0.5">{part}</mark> : part
    );
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-right"
      >
        <Badge variant="outline" className={`text-xs shrink-0 ${getStatusColor(item.status)}`}>
          {getStatusLabel(item.status)}
        </Badge>
        <span className="flex-1 text-sm">{highlightText(item.text)}</span>
        <Badge variant="outline" className={`text-xs shrink-0 ${getPriorityColor(item.priority)}`}>
          {getPriorityLabel(item.priority)}
        </Badge>
        {expanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-border bg-muted/30 space-y-2">
          {item.details && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">التفاصيل:</span>
              <p className="text-sm mt-0.5">{highlightText(item.details)}</p>
            </div>
          )}
          {item.verification && (
            <div>
              <span className="text-xs font-medium text-[#3ECFC0]">طريقة التحقق:</span>
              <p className="text-sm mt-0.5">{item.verification}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section Detail View ────────────────────────────────────────────
function SectionDetail({ section, onBack, searchQuery }: { section: Section; onBack: () => void; searchQuery: string }) {
  const Icon = getIcon(section.icon);
  const stats = getSectionStats(section);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 mt-1">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-[#3ECFC0]/10 border border-[#3ECFC0]/20 flex items-center justify-center">
              <Icon className="w-6 h-6 text-[#3ECFC0]" />
            </div>
            <div>
              <Badge variant="outline" className="text-xs mb-1">القسم {section.number}</Badge>
              <h2 className="text-xl font-bold">{section.title}</h2>
            </div>
          </div>
          <p className="text-muted-foreground">{section.description}</p>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <Card className="bg-muted/30">
          <CardContent className="py-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm">{stats.done} مكتمل</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm">{stats.partial} جزئي</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm">{stats.missing} غير مطبق</span>
              </div>
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                <span className="text-sm">{stats.unknown} غير معروف</span>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <Progress value={stats.progress} className="w-24 h-2" />
                <span className="text-sm font-bold text-[#3ECFC0]">{stats.progress}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content paragraphs */}
      {section.content.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed">{p}</p>
      ))}

      {/* Tables */}
      {section.tables?.map((table, ti) => (
        <Card key={ti}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {table.headers.map((h, hi) => (
                      <th key={hi} className="text-right px-4 py-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      {row.cells.map((cell, ci) => (
                        <td key={ci} className="px-4 py-3">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Subsections */}
      {section.subsections?.map((sub, si) => (
        <Card key={si}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{sub.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {sub.content.map((p, pi) => (
              <p key={pi} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
            ))}
            {sub.items && (
              <div className="mt-3 space-y-2">
                {sub.items.map(item => (
                  <CheckItemRow key={item.id} item={item} searchQuery={searchQuery} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Check items */}
      {section.items && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">عناصر الفحص ({section.items.length})</h3>
          {section.items.map(item => (
            <CheckItemRow key={item.id} item={item} searchQuery={searchQuery} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Search Overlay ─────────────────────────────────────────────────
function SearchOverlay({
  query, onQueryChange, results, onSelect, onClose
}: {
  query: string;
  onQueryChange: (q: string) => void;
  results: Section[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="ابحث في خطة التقوية..."
            className="border-0 bg-transparent focus-visible:ring-0 text-base"
          />
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="max-h-[50vh]">
          <div className="p-2">
            {results.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">لا توجد نتائج</p>
            ) : (
              results.map(section => {
                const Icon = getIcon(section.icon);
                const stats = getSectionStats(section);
                return (
                  <button
                    key={section.id}
                    onClick={() => onSelect(section.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-right"
                  >
                    <div className="w-8 h-8 rounded-md bg-[#3ECFC0]/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#3ECFC0]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{section.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{section.description}</p>
                    </div>
                    {stats && (
                      <Badge variant="outline" className="text-xs">{stats.progress}%</Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function AdminHardeningKB() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Check if user is root admin
  const permsQuery = trpc.permissions.list.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const isRootAdmin = useMemo(() => {
    if (!user || !permsQuery.data) return false;
    const userPerms = (permsQuery.data as any[]).find((p: any) => p.id === user.id);
    return userPerms?.isRootAdmin === true;
  }, [user, permsQuery.data]);

  const overallStats = useMemo(() => getOverallStats(), []);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      s =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.content.some(c => c.toLowerCase().includes(q)) ||
        s.items?.some(i => i.text.toLowerCase().includes(q) || i.details?.toLowerCase().includes(q)) ||
        s.subsections?.some(sub => sub.title.toLowerCase().includes(q) || sub.content.some(c => c.toLowerCase().includes(q)))
    );
  }, [searchQuery]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (authLoading || permsQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-[#3ECFC0]" />
      </div>
    );
  }

  if (!user) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-bold mb-2">غير مصرح</h2>
          <p className="text-muted-foreground">هذه الصفحة متاحة للمسؤولين فقط</p>
        </div>
        <Footer />
      </div>
    );
  }

  // Root admin check - only root admins can see this page
  if (!isRootAdmin && !permsQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="container py-20 text-center">
          <KeyRound className="h-16 w-16 mx-auto text-red-400/50 mb-4" />
          <h2 className="text-xl font-bold mb-2">صلاحية المسؤول الرئيسي مطلوبة</h2>
          <p className="text-muted-foreground mb-4">هذه الصفحة متاحة فقط للمسؤول الرئيسي (Root Admin)</p>
          <Button variant="outline" onClick={() => navigate("/admin")}>
            العودة للوحة التحكم
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const currentSection = sections.find(s => s.id === activeSection);

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <Navbar />

      {/* Top Stats Bar */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#3ECFC0]/10 border border-[#3ECFC0]/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#3ECFC0]" />
              </div>
              <div>
                <h1 className="text-sm font-bold">خطة تقوية الجاهزية للإنتاج</h1>
                <p className="text-xs text-muted-foreground">المفتاح الشهري - Production Hardening</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-medium">{overallStats.done} مكتمل</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-medium">{overallStats.partial} جزئي</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-medium">{overallStats.missing} غير مطبق</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Progress value={overallStats.progress} className="w-20 h-2" />
                <span className="text-sm font-bold text-[#3ECFC0]">{overallStats.progress}%</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchOpen(true)}
                className="gap-2"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">بحث</span>
                <kbd className="hidden sm:inline text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">⌘K</kbd>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 container py-6">
        {activeSection === null ? (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-emerald-500/5 border-emerald-500/20">
                <CardContent className="py-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-emerald-400">{overallStats.done}</p>
                  <p className="text-xs text-muted-foreground">مكتمل</p>
                </CardContent>
              </Card>
              <Card className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="py-4 text-center">
                  <Zap className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-amber-400">{overallStats.partial}</p>
                  <p className="text-xs text-muted-foreground">جزئي</p>
                </CardContent>
              </Card>
              <Card className="bg-red-500/5 border-red-500/20">
                <CardContent className="py-4 text-center">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-400">{overallStats.missing}</p>
                  <p className="text-xs text-muted-foreground">غير مطبق</p>
                </CardContent>
              </Card>
              <Card className="bg-[#3ECFC0]/5 border-[#3ECFC0]/20">
                <CardContent className="py-4 text-center">
                  <Shield className="w-8 h-8 text-[#3ECFC0] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-[#3ECFC0]">{overallStats.progress}%</p>
                  <p className="text-xs text-muted-foreground">التقدم الكلي</p>
                </CardContent>
              </Card>
            </div>

            {/* Section Grid */}
            <h2 className="text-lg font-bold mb-4">أقسام خطة التقوية ({sections.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sections.map(section => (
                <SectionCard
                  key={section.id}
                  section={section}
                  onClick={() => setActiveSection(section.id)}
                />
              ))}
            </div>
          </>
        ) : currentSection ? (
          <SectionDetail
            section={currentSection}
            onBack={() => setActiveSection(null)}
            searchQuery={searchQuery}
          />
        ) : null}
      </main>

      <Footer />

      {/* Search Overlay */}
      {searchOpen && (
        <SearchOverlay
          query={searchQuery}
          onQueryChange={setSearchQuery}
          results={filteredSections}
          onSelect={(id) => {
            setActiveSection(id);
            setSearchOpen(false);
            setSearchQuery("");
          }}
          onClose={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }}
        />
      )}
    </div>
  );
}
