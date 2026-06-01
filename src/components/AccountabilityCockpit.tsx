import React, { useState, useEffect } from 'react';
import { 
  Shield, Award, DollarSign, Users, Flame, Clock, 
  Upload, CheckCircle2, ChevronRight, X, Sparkles, 
  AlertOctagon, Globe, Trash2, Mail, FileText, Download,
  ExternalLink
} from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc, collection, addDoc, getDocs, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';
import { DailyTask, StudyLog } from '../types';
import { format, differenceInDays, subDays } from 'date-fns';

const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface AccountabilitySettings {
  stakesEnabled: boolean;
  stakesAmount: number;
  antiCharity: string;
  boardEmails: string;
  burnGoalHours: number;
  examDate: string;
  restrictionsEnabled: boolean;
  restrictedSites: string;
}

interface VaultItem {
  id: string;
  taskTitle: string;
  category: string;
  proofNotes: string;
  imageFileName: string;
  imageDataUrl?: string;
  fileLink: string;
  createdAt: string;
}

interface AccountabilityCockpitProps {
  user: any;
  dailyTasks: DailyTask[];
  logs: StudyLog[];
}

const DEFAULT_ACCOUNTABILITY: AccountabilitySettings = {
  stakesEnabled: false,
  stakesAmount: 20,
  antiCharity: 'The Association of Study Slackers',
  boardEmails: 'mentor@example.com',
  burnGoalHours: 500,
  examDate: '2026-11-29',
  restrictionsEnabled: false,
  restrictedSites: 'youtube.com, reddit.com, twitter.com, instagram.com',
};

const ANTI_CHARITIES = [
  'The Association of Study Slackers (Promoters of Procrastination)',
  'The Anti-Intellectual Lobby (Campaigning to reduce math funding)',
  'The Slow-Reading Society (Challenging cognitive literacy limits)',
  'The Infinite Scrolling Foundation (Supporting attention dilution)'
];

const getWeekId = (date: Date) => {
  const temp = new Date(date);
  const day = temp.getDay();
  const diff = temp.getDate() - day; // adjust to Sunday
  const sunday = new Date(temp.setDate(diff));
  return sunday.toISOString().split('T')[0]; // e.g. "2026-05-31"
};

export const AccountabilityCockpit: React.FC<AccountabilityCockpitProps> = ({
  user,
  dailyTasks,
  logs
}) => {
  const [settings, setSettings] = useState<AccountabilitySettings>(() => ({
    ...DEFAULT_ACCOUNTABILITY,
    boardEmails: user?.email || 'mentor@example.com'
  }));
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const currentWeekSunday = getWeekId(new Date());
  const [auditSentThisWeek, setAuditSentThisWeek] = useState(() => {
    return localStorage.getItem(`audit_sent_${currentWeekSunday}`) === 'true';
  });

  // Form states for adding stand-alone Vault proof
  const [proofTaskTitle, setProofTaskTitle] = useState('');
  const [proofCategory, setProofCategory] = useState('QA');
  const [proofNotes, setProofNotes] = useState('');
  const [proofFileLink, setProofFileLink] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileBase64, setSelectedFileBase64] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);

  // Email Audit preview state
  const [showAuditPreview, setShowAuditPreview] = useState(false);
  const [auditEmails, setAuditEmails] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string; suggestedSetup?: string } | null>(null);
  
  // Tab indicator
  const [activeSection, setActiveSection] = useState<'burn' | 'proof' | 'stakes' | 'audit' | 'constraints'>('burn');
  const [countdownStr, setCountdownStr] = useState("02D : 14H : 32M : 00S");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const currentDay = now.getDay();
      const daysUntilSunday = (7 - currentDay) % 7;
      const nextSunday = new Date();
      nextSunday.setDate(now.getDate() + (daysUntilSunday === 0 && (now.getHours() > 23 || (now.getHours() === 23 && now.getMinutes() >= 59)) ? 7 : daysUntilSunday));
      nextSunday.setHours(23, 59, 0, 0);

      const diffMs = nextSunday.getTime() - now.getTime();
      if (diffMs <= 0) {
        setCountdownStr("00D : 00H : 00M : 00S");
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      const formatNum = (num: number) => String(num).padStart(2, '0');
      setCountdownStr(`${formatNum(days)}D : ${formatNum(hours)}H : ${formatNum(minutes)}M : ${formatNum(seconds)}S`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync settings and vault items from Firestore
  useEffect(() => {
    if (!user) return;

    // Listen to Accountability Settings
    const setPath = doc(db, 'users', user.uid, 'settings', 'accountability');
    const unsubSettings = onSnapshot(setPath, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings({ 
          ...DEFAULT_ACCOUNTABILITY, 
          boardEmails: data.boardEmails || user?.email || 'mentor@example.com',
          ...data 
        });
      } else {
        const initialSettings = {
          ...DEFAULT_ACCOUNTABILITY,
          boardEmails: user?.email || 'mentor@example.com'
        };
        setDoc(setPath, initialSettings);
      }
    });

    // Listen to Vault items
    const vaultRef = collection(db, 'users', user.uid, 'proofVault');
    const unsubVault = onSnapshot(vaultRef, (snap) => {
      const items: VaultItem[] = [];
      snap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as VaultItem);
      });
      // Sort by creation date desc
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setVaultItems(items);
    });

    return () => {
      unsubSettings();
      unsubVault();
    };
  }, [user]);

  const handleSaveSettings = async (updates: Partial<AccountabilitySettings>) => {
    if (!user) return;
    try {
      setIsSaving(true);
      const newSettings = { ...settings, ...updates };
      await setDoc(doc(db, 'users', user.uid, 'settings', 'accountability'), newSettings);
      setSettings(newSettings);
    } catch (e) {
      console.error("Error updating settings:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Convert File to Base64 helper
  const handleFileChange = (file: File) => {
    if (file.size > 800 * 1024) {
      alert("Please upload a file smaller than 800 KB to fit within storage parameters.");
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // File drag & drop triggers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Submit Standalone Proof
  const handleUploadProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !proofTaskTitle.trim()) return;

    try {
      const payload: Omit<VaultItem, 'id'> = {
        taskTitle: proofTaskTitle,
        category: proofCategory,
        proofNotes: proofNotes,
        imageFileName: selectedFile ? selectedFile.name : '',
        imageDataUrl: selectedFileBase64 || '',
        fileLink: proofFileLink,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'users', user.uid, 'proofVault'), payload);
      
      // Cleanup inputs
      setProofTaskTitle('');
      setProofNotes('');
      setProofFileLink('');
      setSelectedFile(null);
      setSelectedFileBase64('');
    } catch (err) {
      console.error("Error uploading proof:", err);
    }
  };

  const handleDeleteProof = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'proofVault', id));
    } catch (err) {
      console.error("Error removing proof:", err);
    }
  };

  // Dynamic calculations
  // Days remaining until target exam date
  const targetDate = new Date(settings.examDate + 'T00:00:00');
  const today = new Date();
  const daysRemaining = Math.max(1, differenceInDays(targetDate, today));

  // Study log hours computed
  const accomplishedHours = logs.reduce((acc, log) => acc + (log.duration || 0), 0) / 60;
  const remainingHours = Math.max(0, settings.burnGoalHours - accomplishedHours);
  const dailyBurnRate = (remainingHours / daysRemaining);

  // Time Debt penalty counts
  const failedTasks = dailyTasks.filter(t => t.status === 'failed');
  const completedFrogs = dailyTasks.filter(t => t.status === 'done' && t.is_frog);
  const failedFrogs = dailyTasks.filter(t => t.status === 'failed' && t.is_frog);
  
  // Forfeited cash penalty calculation: failed frogs * stakesAmount
  const totalForfeitedStakes = failedFrogs.length * settings.stakesAmount;

  // Render weekly audit template summary text
  const generateAuditReport = () => {
    const totalWeeklyPlanned = dailyTasks.filter(t => t.date >= format(subDays(today, 7), 'yyyy-MM-dd')).length;
    const totalWeeklyDone = dailyTasks.filter(t => t.date >= format(subDays(today, 7), 'yyyy-MM-dd') && t.status === 'done').length;
    const ratio = totalWeeklyPlanned > 0 ? (totalWeeklyDone / totalWeeklyPlanned) * 100 : 0;

    const completedList = dailyTasks.filter(t => t.date >= format(subDays(today, 7), 'yyyy-MM-dd') && t.status === 'done');
    const failedList = dailyTasks.filter(t => t.date >= format(subDays(today, 7), 'yyyy-MM-dd') && t.status === 'failed');

    return `# WEEKLY ACCOUNTABILITY AUDIT REPORT
Generated on: ${format(new Date(), 'EEEE, MMMM d, yyyy')}
Exam Countdown: ${daysRemaining} Days remaining until ${format(targetDate, 'MMMM d, yyyy')}

## 1. COMPLIANCE RATIO
* Compliance score: ${ratio.toFixed(0)}% (${totalWeeklyDone}/${totalWeeklyPlanned} Tasks Completed)
* Accomplished hours: ${accomplishedHours.toFixed(1)} hrs of ${settings.burnGoalHours} hrs total goal
* Current required burn rate: ${dailyBurnRate.toFixed(2)} hours of deep work daily

## 2. WHAT WENT WELL (COMPLETED BLOCKERS)
${completedList.length > 0 
  ? completedList.map(t => `* ✅ [${t.category}] ${t.title} (${t.estimatedDuration}m) ${t.is_frog ? '🐸 FROG' : ''} -> Takesaway: "${t.proofOfWork || 'Completed without delay'}"`).join('\n')
  : '* No successful tasks logged this week.'}

## 3. WHAT FAILED (BEHAVIORAL LEAKS)
${failedList.length > 0 
  ? failedList.map(t => `* ❌ [${t.category}] ${t.title} (${t.estimatedDuration}m) ${t.is_frog ? '🐸 FROG' : ''} -> Default Leak Reason: "${t.failureReason ? t.failureReason.toUpperCase() : 'Not categorized'}"`).join('\n')
  : '* Flawless alignment! No failed blocks or leaks recorded this week.'}

## 4. NEXT WEEK'S PREP MITIGATION TARGETS
* Primary target: Patch the most common leak, protect the 18:00 - 24:00 deep work window, and maintain a Daily Burn Rate of ${dailyBurnRate.toFixed(1)} hrs.
`;
  };

  const handleSendDirectEmail = async (overrideTo?: string) => {
    setIsSendingEmail(true);
    setEmailResult(null);
    const targetEmails = overrideTo || settings.boardEmails;

    try {
      const report = generateAuditReport();
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: targetEmails,
          subject: 'Weekly Accountability Auditing Log',
          body: report
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setEmailResult({
          success: true,
          message: data.message || "Email delivered successfully by direct app server!"
        });
        localStorage.setItem(`audit_sent_${currentWeekSunday}`, "true");
        setAuditSentThisWeek(true);
      } else {
        setEmailResult({
          success: false,
          message: data.error || "Failed to dispatch email directly.",
          suggestedSetup: data.suggestedSetup
        });
      }
    } catch (error: any) {
      console.error("Direct email dispatch failed:", error);
      setEmailResult({
        success: false,
        message: error.message || "Could not connect to the app email API server."
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      
      {/* HUD Header Alert Block */}
      <div className="bg-zinc-950 dark:bg-black text-rose-500 p-6 rounded-3xl border border-red-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-red-950/40 rounded-2xl border border-red-500/20 text-red-500 animate-pulse shrink-0">
            <Shield size={22} className="fill-current" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase text-red-500 font-mono">
              STRICT PERFORMANCE ENFORCEMENT ZONE
            </span>
            <h1 className="text-2xl font-black text-zinc-100 mt-1 uppercase tracking-tight">
              ACCOUNTABILITY COCKPIT
            </h1>
            <p className="text-zinc-400 text-xs mt-1 leading-relaxed max-w-xl">
              Where soft excuses die. View your burn rates, audit weekly reports to mentors, upload actual images of scratchpads, and hold yourself to painful financial stakes.
            </p>
          </div>
        </div>

        {/* Dynamic Risk Gauge pill */}
        <div className="bg-zinc-900 border border-zinc-800/80 px-4 py-3 rounded-2xl flex flex-col items-center justify-center min-w-[140px]">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Risk Level</span>
          <span className={cn(
            "text-sm font-black uppercase tracking-wider mt-1",
            settings.stakesEnabled ? "text-red-500" : "text-amber-500"
          )}>
            {settings.stakesEnabled ? "🔥 PLEDGE ACTIVE" : "⚠️ LOW ACCOUNTABILITY"}
          </span>
          <span className="text-[10px] text-zinc-400 mt-1 font-mono">
            {settings.stakesEnabled ? `-$${settings.stakesAmount}/Failed Frog` : "No financial pain set"}
          </span>
        </div>
      </div>

      {/* Weekends/Sunday Audit Season Alert Banner */}
      {(() => {
        const todayDay = new Date().getDay();
        const isAuditWindow = todayDay === 6 || todayDay === 0 || todayDay === 1; // Sat, Sun, Mon
        const dayName = todayDay === 6 ? 'Saturday' : todayDay === 0 ? 'Sunday' : 'Monday';
        if (!isAuditWindow) return null;
        return (
          <div className={cn(
            "p-6 md:p-8 rounded-3xl flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 transition-all shadow-2xl relative overflow-hidden border",
            auditSentThisWeek 
              ? "bg-zinc-950 border-emerald-500/25 text-zinc-100"
              : "bg-slate-950 border-amber-500/30 text-zinc-100 shadow-[0_0_20px_rgba(245,158,11,0.08)]"
          )}>
            {/* Subtle amber or green radial glow in background */}
            <div className={cn(
              "absolute top-0 left-0 w-96 h-96 pointer-events-none opacity-40 rounded-full -translate-x-1/4 -translate-y-1/4",
              auditSentThisWeek
                ? "bg-[radial-gradient(circle,rgba(16,185,129,0.1),transparent_70%)]"
                : "bg-[radial-gradient(circle,rgba(245,158,11,0.12),transparent_70%)]"
            )} />

            <div className="flex flex-col sm:flex-row items-start gap-5 min-w-0 flex-1 relative z-10">
              <div className="flex flex-col items-center gap-2.5 shrink-0 self-start sm:self-center">
                <div className={cn(
                  "p-3.5 rounded-2xl border relative overflow-hidden shadow-md shrink-0",
                  auditSentThisWeek 
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/25"
                    : "bg-red-950/30 text-red-550 border-red-500/20"
                )}>
                  {/* Internal radial icon overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.15),transparent_70%)] pointer-events-none" />
                  {auditSentThisWeek ? <CheckCircle2 className="w-7 h-7 stroke-[2.5]" /> : <Mail className="w-7 h-7 stroke-[2.5]" />}
                </div>
                <span className={cn(
                  "text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-md font-mono border",
                  auditSentThisWeek
                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
                    : "bg-red-955/80 text-red-400 border-red-900/60 animate-pulse"
                )}>
                  {auditSentThisWeek ? "✓ COMPLETED" : "URGENT"}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div>
                  <h4 className="text-[10px] font-black tracking-[0.25em] text-zinc-500 uppercase">
                    WEEKLY ACCOUNTABILITY
                  </h4>
                  <h2 className={cn(
                    "text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight leading-none uppercase",
                    auditSentThisWeek 
                      ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]" 
                      : "text-red-500 dark:text-red-440 drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                  )}>
                    {auditSentThisWeek ? "AUDIT DISPATCHED" : "AUDIT DUE"}
                  </h2>
                </div>

                <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed max-w-2xl font-medium">
                  {auditSentThisWeek 
                    ? "Great job! Your weekly performance reports were successfully compiled and transmitted to your board of directors."
                    : "Authorized directors require immediate submission of your weekly compilation data to finalize transfer and prevent behavioral leaks."}
                </p>

                {/* Structured user list with tiny avatars */}
                {settings.boardEmails && (
                  <div className="mt-4 space-y-2">
                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                      Authorized Board Recipients:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {settings.boardEmails.split(',').map(e => e.trim()).filter(Boolean).map((email, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2.5 py-1 bg-zinc-900/80 border border-zinc-800/80 rounded-xl text-xs text-zinc-400 font-mono shadow-sm">
                          <div className="w-4 h-4 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-black flex items-center justify-center border border-indigo-500/10 uppercase shrink-0">
                            {email[0] || '?'}
                          </div>
                          <span>{email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {emailResult && (
                  <div className={cn(
                    "mt-4 p-4 rounded-2xl border text-xs leading-relaxed max-w-xl",
                    emailResult.success 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  )}>
                    <div className="font-bold flex items-center gap-1.5">
                      {emailResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertOctagon className="w-4 h-4 shrink-0" />}
                      {emailResult.success ? "Success!" : "Direct Send Setup Assistant"}
                    </div>
                    <p className="mt-1 font-semibold">{emailResult.message}</p>
                    {emailResult.suggestedSetup && (
                      <div className="mt-2.5 p-2.5 bg-black/40 rounded-xl text-[10px] text-zinc-400 font-mono space-y-1">
                        <p className="font-bold text-amber-500 uppercase">Interactive Server Keys Setup Required:</p>
                        <p>{emailResult.suggestedSetup}</p>
                        <p className="pt-1 text-[10px] text-zinc-500">Rest assured, you can send IMMEDIATELY by clicking the "Local Client" button to route through your device's email client.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!auditSentThisWeek && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto shrink-0 justify-end relative z-10 mt-4 xl:mt-0">
                {/* Primary Action (Direct Push) */}
                <button
                  type="button"
                  onClick={() => handleSendDirectEmail()}
                  disabled={isSendingEmail}
                  className="px-5 py-3.5 bg-gradient-to-b from-indigo-600 via-indigo-700 to-indigo-850 hover:from-indigo-550 hover:via-indigo-650 hover:to-indigo-750 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_12px_rgba(99,102,241,0.25)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_16px_rgba(99,102,241,0.35)] border border-indigo-500/30 hover:border-indigo-400/40 flex items-center justify-center gap-3 shrink-0"
                >
                  <Mail size={14} className="stroke-[3]" />
                  <span>{isSendingEmail ? "SENDING DATA..." : "AUTO-SEND DATA BUNDLE"}</span>
                  <span className="text-[8px] font-black px-1.5 py-0.5 bg-indigo-950/95 text-indigo-300 border border-indigo-500/20 rounded font-mono shrink-0">0 CLICKS</span>
                </button>
                
                {/* Secondary Action (Local Client) */}
                <button
                  type="button"
                  onClick={() => {
                    const report = generateAuditReport();
                    window.location.href = `mailto:${settings.boardEmails}?subject=Weekly%20Accountability%20Auditing%20Log&body=${encodeURIComponent(report)}`;
                    localStorage.setItem(`audit_sent_${currentWeekSunday}`, 'true');
                    setAuditSentThisWeek(true);
                  }}
                  className="px-5 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
                >
                  via Local Client
                </button>

                {/* Subtle Divider */}
                <div className="hidden sm:block w-px h-6 bg-zinc-800/80 mx-1 shrink-0" />

                {/* Ghost Action (Mark Sent) */}
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(`audit_sent_${currentWeekSunday}`, 'true');
                    setAuditSentThisWeek(true);
                  }}
                  className="px-4 py-3 bg-transparent hover:bg-zinc-900/50 text-zinc-500 hover:text-zinc-200 font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shrink-0 text-center"
                >
                  Mark Sent
                </button>
              </div>
            )}

            {auditSentThisWeek && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(`audit_sent_${currentWeekSunday}`);
                  setAuditSentThisWeek(false);
                }}
                className="text-[10px] text-zinc-500 hover:text-red-400 font-black uppercase tracking-widest transition-all shrink-0 mt-2 xl:mt-0 relative z-10"
              >
                Reset Status
              </button>
            )}

            {/* Subtle accountability streak decay meter at the very bottom edge */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-900 pointer-events-none">
              <div 
                className={cn(
                  "h-full transition-all duration-700 ease-out",
                  auditSentThisWeek 
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 w-full"
                    : "bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 w-3/4"
                )} 
              />
            </div>
          </div>
        );
      })()}

      {/* Mode selectors bento navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 dark:bg-zinc-900 p-1.5 rounded-2xl border border-slate-100 dark:border-zinc-800">
        <button
          onClick={() => setActiveSection('burn')}
          className={cn(
            "flex items-center gap-2 justify-center py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all",
            activeSection === 'burn'
              ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-zinc-700"
              : "text-slate-500 dark:text-zinc-500 hover:bg-white/50 dark:hover:bg-zinc-800/40"
          )}
        >
          <Flame size={14} />
          Burn Rate
        </button>
        <button
          onClick={() => setActiveSection('proof')}
          className={cn(
            "flex items-center gap-2 justify-center py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all",
            activeSection === 'proof'
              ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-zinc-700"
              : "text-slate-500 dark:text-zinc-500 hover:bg-white/50 dark:hover:bg-zinc-800/40"
          )}
        >
          <Award size={14} />
          Proof Vault
        </button>
        <button
          onClick={() => setActiveSection('stakes')}
          className={cn(
            "flex items-center gap-2 justify-center py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all",
            activeSection === 'stakes'
              ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-zinc-700"
              : "text-slate-500 dark:text-zinc-500 hover:bg-white/50 dark:hover:bg-zinc-800/40"
          )}
        >
          <DollarSign size={14} />
          Stakes
        </button>
        <button
          onClick={() => setActiveSection('audit')}
          className={cn(
            "flex items-center gap-2 justify-center py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all",
            activeSection === 'audit'
              ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-zinc-700"
              : "text-slate-500 dark:text-zinc-500 hover:bg-white/50 dark:hover:bg-zinc-800/40"
          )}
        >
          <Users size={14} />
          Board Audit
        </button>
        <button
          onClick={() => setActiveSection('constraints')}
          className={cn(
            "flex items-center gap-2 justify-center py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all h-full col-span-2 sm:col-span-1",
            activeSection === 'constraints'
              ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-zinc-700"
              : "text-slate-500 dark:text-zinc-500 hover:bg-white/50 dark:hover:bg-zinc-800/40"
          )}
        >
          <Globe size={14} />
          Constraints
        </button>
      </div>

      {/* MAIN CONTAINER PANELS */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm">
        
        {/* ============ 1. THE BURN RATE SECTION ============ */}
        {activeSection === 'burn' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 border-b border-slate-105 dark:border-zinc-800/80 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-905 dark:text-white flex items-center gap-2">
                  <Flame className="text-red-500 fill-red-500 animate-pulse" size={20} />
                  The Prep "Burn Rate" Calculator
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Treat study time as a rapidly depleting bank account. Track your mandatory pace toward the target exam date.
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-slate-50 dark:bg-zinc-800/40 px-2.5 py-1 rounded text-indigo-600 dark:text-indigo-400">
                {daysRemaining} Days Until Exam
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-6">
                
                {/* Inputs card */}
                <div className="p-5 bg-slate-50/60 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 rounded-2xl space-y-4">
                  <h4 className="text-xs uppercase tracking-wider font-extrabold text-slate-400">Configure Targets</h4>
                  
                  {/* Target hours input */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block">
                      Target Goal Hours (Deep Prep)
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={10000}
                      value={settings.burnGoalHours}
                      onChange={(e) => handleSaveSettings({ burnGoalHours: parseInt(e.target.value) || 500 })}
                      className="w-full text-sm p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Exam target date input */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block">
                      Exam Target Date (SimCAT / Official)
                    </label>
                    <input
                      type="date"
                      required
                      value={settings.examDate}
                      onChange={(e) => handleSaveSettings({ examDate: e.target.value })}
                      className="w-full text-sm p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Flatline Impact Statement */}
                <div className="p-4 bg-red-500/5 dark:bg-red-500/10 border border-red-200/50 dark:border-red-950/50 rounded-2xl flex items-start gap-3">
                  <AlertOctagon size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase text-red-500">Mathematical Flatline Warning</p>
                    <p className="text-slate-500 dark:text-zinc-400 text-xs leading-relaxed">
                      Every day you spend at **0.0 hours completed** permanently raises your daily required burn rate for all remaining days. Procrastination directly shifts tomorrow's hill into a mountain.
                    </p>
                  </div>
                </div>
              </div>

              {/* Big Metric Output Dashboard */}
              <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 space-y-6 flex flex-col justify-between h-full min-h-[300px]">
                
                <div>
                  <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest font-mono">Required Pace</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-4xl font-black text-rose-500">{dailyBurnRate.toFixed(2)}</span>
                    <span className="text-xs font-semibold text-slate-400">hours / day</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    To reach your final goal before the exam.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Progress</span>
                    <span className="font-bold text-rose-400">
                      {accomplishedHours.toFixed(1)} hrs completed / {remainingHours.toFixed(1)} hrs left
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (accomplishedHours / settings.burnGoalHours) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Pace Health Indicator:</span>
                    {dailyBurnRate <= 2 ? (
                      <span className="text-emerald-400 font-extrabold uppercase">✅ HEALTHY (PACE &lt;= 2.0h)</span>
                    ) : dailyBurnRate <= 4 ? (
                      <span className="text-yellow-400 font-extrabold uppercase">⚠️ CAUTION (PACE 2.0 - 4.0h)</span>
                    ) : (
                      <span className="text-red-400 font-extrabold uppercase animate-pulse">🔥 CRITICAL (PACE &gt; 4.0h)</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 italic block leading-relaxed">
                    “Diligently track daily time logging in the Log tab to dynamically update this accomplished value.”
                  </p>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ============ 2. THE PROOF VAULT SECTION ============ */}
        {activeSection === 'proof' && (
          <div className="space-y-8">
            <div className="border-b border-slate-105 dark:border-zinc-800/80 pb-4">
              <h3 className="text-xl font-bold text-slate-905 dark:text-white flex items-center gap-2">
                <Award className="text-indigo-650 dark:text-indigo-400" size={20} />
                The "Proof of Work" Vault
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Lock down real retention. Upload photos of massive, messy scratchpads, screenshots of correct answers, or worksheet matrices to bypass the administrative illusion.
              </p>
            </div>

            {/* Standalone Proof Intake Form */}
            <form onSubmit={handleUploadProof} className="bg-slate-50 dark:bg-zinc-950/20 rounded-2xl p-6 border border-slate-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-widest font-black text-indigo-500">Log New Unpadable Evidence</h4>
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-600 dark:text-zinc-400 font-bold">Action / Block Identifier</label>
                  <input
                    type="text"
                    required
                    value={proofTaskTitle}
                    onChange={(e) => setProofTaskTitle(e.target.value)}
                    placeholder="e.g., QA: Resolved 15 Quadratic Matrices"
                    className="w-full text-xs p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Subject & FileLink Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 dark:text-zinc-400 font-bold">Section</label>
                    <select
                      value={proofCategory}
                      onChange={(e) => setProofCategory(e.target.value)}
                      className="w-full text-xs p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl dark:text-white focus:outline-none"
                    >
                      <option value="QA">QA</option>
                      <option value="DILR">DILR</option>
                      <option value="VARC">VARC</option>
                      <option value="Mock">Mock</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 dark:text-zinc-400 font-bold">External Link (optional)</label>
                    <input
                      type="url"
                      value={proofFileLink}
                      onChange={(e) => setProofFileLink(e.target.value)}
                      placeholder="e.g. Notion, Sheets log"
                      className="w-full text-xs p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Takeaway */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-600 dark:text-zinc-400 font-bold">Key Takeaway Insights</label>
                  <textarea
                    rows={2}
                    value={proofNotes}
                    onChange={(e) => setProofNotes(e.target.value)}
                    placeholder="Capture the raw insight. What did you master? What silly mistake did you isolate?"
                    className="w-full text-xs p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Right Dropzone File Attachment Area */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-600 dark:text-zinc-400 font-bold">Attach Scratchpad Photo (Max 800KB)</label>
                  
                  {/* File Upload drag/drop UI */}
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('vault-file-picker')?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px]",
                      dragActive 
                        ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10" 
                        : "border-slate-300 dark:border-zinc-800 hover:border-indigo-400 text-slate-400 hover:text-indigo-600"
                    )}
                  >
                    <input 
                      type="file" 
                      id="vault-file-picker"
                      accept="image/*"
                      className="hidden" 
                      onChange={(e) => e.target.files && e.target.files[0] && handleFileChange(e.target.files[0])}
                    />
                    
                    <Upload className="w-8 h-8 mb-2 animate-bounce" />
                    
                    {selectedFile ? (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate max-w-[220px]">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-emerald-500 font-bold">
                          ✓ File buffered successfully ({(selectedFile.size/1024).toFixed(1)} KB)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold text-slate-705 dark:text-zinc-300">Drag & Drop scratchpad image here</p>
                        <p className="text-[10px] text-slate-400 mt-1">or click to browse local files</p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!proofTaskTitle.trim()}
                  className="w-full py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Authorize Proof Submission
                </button>
              </div>

            </form>

            {/* Locked Vault Items Showcase Grid */}
            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest font-black text-slate-400">Vault Ledger Logs ({vaultItems.length})</h4>
              
              {vaultItems.length === 0 ? (
                <div className="border border-dashed border-slate-200 dark:border-zinc-850 p-8 rounded-2xl text-center text-sm text-slate-450">
                  ⚠️ No proof attachments locked in. Upload your first workout scratchpad above.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {vaultItems.map((item) => (
                    <div 
                      key={item.id} 
                      className="p-5 bg-white dark:bg-zinc-950/40 border border-slate-105 dark:border-zinc-800 rounded-2xl flex gap-4 relative group"
                    >
                      <button
                        onClick={() => handleDeleteProof(item.id)}
                        className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove Vault Entry"
                      >
                        <Trash2 size={13} />
                      </button>

                      {item.imageDataUrl && (
                        <div className="w-16 h-16 rounded-xl border overflow-hidden shrink-0 bg-slate-50 dark:bg-zinc-800 self-start">
                          <img 
                            src={item.imageDataUrl} 
                            alt="scratchpad proof" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      <div className="space-y-1 text-sm min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] bg-indigo-50 text-indigo-600 border dark:bg-zinc-800/40 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded truncate uppercase shrink-0">
                            {item.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {format(new Date(item.createdAt), 'MM/dd HH:mm')}
                          </span>
                        </div>
                        <h5 className="font-extrabold text-slate-850 dark:text-zinc-200 truncate mt-0.5 leading-snug">
                          {item.taskTitle}
                        </h5>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 italic leading-relaxed line-clamp-2">
                          “{item.proofNotes || 'No notes left.'}”
                        </p>
                        {item.fileLink && (
                          <a 
                            href={item.fileLink} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[10px] text-indigo-500 font-bold block mt-1 hover:underline truncate"
                          >
                            🔗 View External Log File
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ 3. FINANCIAL STAKES SECTION ============ */}
        {activeSection === 'stakes' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 border-b border-slate-105 dark:border-zinc-800/80 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-905 dark:text-white flex items-center gap-2">
                  <DollarSign className="text-emerald-600 dark:text-emerald-500" size={20} />
                  Financial Escrow (Skin in the Game)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Leverage raw loss aversion. Fail to defeat your Daily Frog, and you forfeit real cash to deep anti-charities.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.stakesEnabled}
                  onChange={(e) => handleSaveSettings({ stakesEnabled: e.target.checked })}
                  className="sr-only"
                />
                <span className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Pledge Status:</span>
                <div className={cn(
                  "w-10 h-6 rounded-full p-0.5 transition-colors relative",
                  settings.stakesEnabled ? "bg-red-600" : "bg-slate-300 dark:bg-zinc-800"
                )}>
                  <div className={cn(
                    "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                    settings.stakesEnabled ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Stakes Settings Configurator */}
              <div className="space-y-4 p-5 bg-slate-50/60 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 rounded-2xl">
                <h4 className="text-xs uppercase tracking-widest font-black text-indigo-500">Stakes Engine Setup</h4>
                
                {/* Penalty input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block">
                    Penalty per Daily Frog Fail
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-slate-400">$</span>
                    <input
                      type="number"
                      required
                      min={1}
                      max={500}
                      value={settings.stakesAmount}
                      disabled={settings.stakesEnabled}
                      onChange={(e) => handleSaveSettings({ stakesAmount: parseInt(e.target.value) || 20 })}
                      className="w-full text-sm pl-7 pr-3 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold dark:text-white disabled:opacity-50"
                    />
                  </div>
                  {settings.stakesEnabled && (
                    <p className="text-[10px] text-red-500 font-semibold mt-1">
                      🔒 Disable pledge above to modify your penalty rate.
                    </p>
                  )}
                </div>

                {/* Anti Charity Target */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block">
                    Beneficiary Anti-Charity
                  </label>
                  <select
                    value={settings.antiCharity}
                    disabled={settings.stakesEnabled}
                    onChange={(e) => handleSaveSettings({ antiCharity: e.target.value })}
                    className="w-full text-xs p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl dark:text-white disabled:opacity-50 font-medium"
                  >
                    {ANTI_CHARITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Ledger Monitor Display */}
              <div className="p-6 bg-rose-950/10 border border-red-500/10 rounded-2xl flex flex-col justify-between h-full space-y-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full inline-block">
                    Loss Aversion Ledger
                  </span>
                  
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">Pledge Balance Forfeited:</span>
                    <span className="text-3xl font-black text-white bg-red-600 dark:bg-red-600 px-3 py-1 rounded-xl shadow">
                      ${totalForfeitedStakes}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-b border-dashed border-red-500/10 pb-2">
                    <span className="text-slate-500 dark:text-zinc-400">Total Failed Frogs:</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-105 font-mono">{failedFrogs.length} Frogs</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-slate-800 dark:text-zinc-200">Anti-Charity Target Pool:</p>
                  <p className="text-xs text-red-500/80 dark:text-rose-450 italic font-medium">
                    “{settings.antiCharity}”
                  </p>
                </div>

                <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-relaxed font-semibold">
                  ⚠️ **Weekly settlement compliance policy**: Every Sunday night, if any Frog fails reconciliation, you must prove you transfered the accumulated amount to the anti-charity to secure board audit clearance.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* ============ 4. BOARD OF DIRECTORS AUDIT ============ */}
        {activeSection === 'audit' && (
          <div id="board-audit-tab" className="bg-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 text-gray-100 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            
            {/* 1. The Impending Deadline Banner (Top, Full Width) */}
            <div className="bg-gray-950/80 border border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="text-xs font-black tracking-widest uppercase text-amber-500 font-mono">
                  WEEK 12 AUDIT: PENDING DISPATCH
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-black font-mono tracking-wider text-amber-400">
                  T-MINUS {countdownStr}
                </span>
              </div>
            </div>

            {/* 2. Main Content Grid (2 Columns: 60% / 40%) */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
              
              {/* Column A (Left - 60%) */}
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-gray-800/80 border border-gray-700/60 rounded-3xl p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2 tracking-tight">
                      <FileText className="text-indigo-405" size={18} />
                      Live Audit Draft
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                      What your Board will see on Sunday at 23:59
                    </p>
                  </div>

                  {/* High Stakes Harsh Reality Check Mock Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 text-xs">
                    <div className="p-3.5 bg-gray-900/60 border border-gray-700/40 rounded-xl flex items-center justify-between">
                      <span className="font-medium text-gray-300">Burn Rate Compliance:</span>
                      <span className="font-bold text-red-400 flex items-center gap-1 font-mono">
                        🔴 14.2 hours deficit
                      </span>
                    </div>
                    <div className="p-3.5 bg-gray-900/60 border border-gray-700/40 rounded-xl flex items-center justify-between">
                      <span className="font-medium text-gray-300">High-Stakes Frogs:</span>
                      <span className="font-bold text-gray-100 font-mono">
                        Conquered 4/7
                      </span>
                    </div>
                    <div className="p-3.5 bg-gray-900/60 border border-gray-700/40 rounded-xl flex items-center justify-between">
                      <span className="font-medium text-gray-300">Financial Escrow:</span>
                      <span className="font-bold text-red-400 font-mono">
                        Forfeited $20.00
                      </span>
                    </div>
                    <div className="p-3.5 bg-gray-900/60 border border-gray-700/40 rounded-xl flex items-center justify-between">
                      <span className="font-medium text-gray-300">Proof Vault Integrity:</span>
                      <span className="font-bold text-amber-400 flex items-center gap-1 font-mono">
                        🟡 Missing 1 receipt
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Live Markdown Document Draft Panel */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 font-mono">
                      Generated Report Content
                    </span>
                    <div className="text-[11px] font-mono bg-gray-950 p-4 rounded-xl overflow-y-auto text-gray-300 border border-gray-800 max-h-[180px] leading-relaxed select-all">
                      <pre className="whitespace-pre-wrap">{generateAuditReport()}</pre>
                    </div>
                  </div>

                  {/* Feedback on dispatch */}
                  {emailResult && (
                    <div className={cn(
                      "p-3.5 rounded-xl border text-xs leading-relaxed",
                      emailResult.success 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                    )}>
                      <div className="font-bold flex items-center gap-1.5 mb-1">
                        {emailResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertOctagon className="w-4 h-4 shrink-0 text-red-400" />}
                        {emailResult.success ? "Early Dispatch Transmitted!" : "Auditor Dispatch Assist"}
                      </div>
                      <p className="font-medium text-[11px]">{emailResult.message}</p>
                      {emailResult.suggestedSetup && (
                        <div className="mt-2 p-2 bg-gray-950 rounded-lg text-[9px] text-gray-400 font-mono leading-normal">
                          {emailResult.suggestedSetup}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Force Early Dispatch Action Button */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isSendingEmail}
                      onClick={() => handleSendDirectEmail()}
                      className="flex-1 py-3 bg-red-650 hover:bg-red-600 active:bg-red-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Mail size={14} className="stroke-[3]" />
                      {isSendingEmail ? "Dispatching..." : "Force Early Dispatch"}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        const report = generateAuditReport();
                        window.location.href = `mailto:${settings.boardEmails}?subject=Weekly%20Accountability%20Auditing%20Log&body=${encodeURIComponent(report)}`;
                        localStorage.setItem(`audit_sent_${currentWeekSunday}`, 'true');
                        setAuditSentThisWeek(true);
                      }}
                      className="py-3 px-4 bg-gray-750 hover:bg-gray-700 hover:text-white transition-all text-gray-350 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shrink-0"
                    >
                      via Local Client
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const report = generateAuditReport();
                        const blob = new Blob([report], { type: 'text/markdown;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.setAttribute("href", url);
                        link.setAttribute("download", `weekly-audit-report-${format(new Date(), 'yyyy-MM-dd')}.md`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="p-3 bg-gray-750 hover:bg-gray-700 hover:text-white transition-all text-gray-350 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center shrink-0"
                      title="Download Markdown Report"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Column B (Right - 40%) */}
              <div className="lg:col-span-4 space-y-4">
                
                {/* Board Roster Configuration */}
                <div className="bg-gray-800/80 border border-gray-700/60 rounded-3xl p-6 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                      <Users className="text-gray-400" size={16} />
                      Stakeholder Roster
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Configure your board of directors
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-405 tracking-wider">
                      Auditor Email Addresses (comma separated)
                    </label>
                    <input
                      type="text"
                      required
                      value={settings.boardEmails}
                      onChange={(e) => handleSaveSettings({ boardEmails: e.target.value })}
                      placeholder="mentor@example.com, peer@example.com"
                      className="w-full text-xs p-3 bg-gray-955 border border-gray-700 rounded-xl font-bold font-mono text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Engagement Ledger with mock read statuses */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      Engagement Ledger
                    </span>
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-gray-900/60 border border-gray-700/30 rounded-xl flex justify-between items-center">
                        <span className="font-mono text-gray-200">Rishabh (Peer)</span>
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          🟢 Reviewed last week
                        </span>
                      </div>
                      <div className="p-3 bg-gray-900/60 border border-gray-700/30 rounded-xl flex justify-between items-center">
                        <span className="font-mono text-gray-200">Dr. Sharma (Mentor)</span>
                        <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                          🔴 Did not open last week
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* subtle tooltip/text explanation */}
                  <div className="p-3 bg-gray-900/40 border border-gray-800 rounded-xl">
                    <p className="text-[10px] text-gray-400 leading-normal font-medium">
                      ⚠️ Mentors who ignore 2 consecutive reports are automatically flagged for removal.
                    </p>
                  </div>
                </div>

                {/* Behavioral Help card inside board section */}
                <div className="p-5 bg-indigo-950/20 border border-dashed border-indigo-500/20 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black uppercase text-indigo-300 flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-400 animate-bounce" /> Behavioral Evasion Shields
                  </h4>
                  <p className="text-[11px] text-gray-450 leading-relaxed">
                    We easily lie to ourselves in dark corners, but looking lazy or erratic in front of high-reputation mentors triggers deep societal compliance drives.
                  </p>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* ============ 5. INTENTIONAL ENVIRONMENT CONSTRAINTS ============ */}
        {activeSection === 'constraints' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 border-b border-slate-105 dark:border-zinc-805 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-905 dark:text-white flex items-center gap-2">
                  <Globe className="text-indigo-650 dark:text-indigo-400" size={20} />
                  Intentional Environment Constraints
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Distraction blocking is not a willpower contest. Configure rules to physically disable access to sinkholes.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.restrictionsEnabled}
                  onChange={(e) => handleSaveSettings({ restrictionsEnabled: e.target.checked })}
                  className="sr-only"
                />
                <span className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Lockdown Blocklist:</span>
                <div className={cn(
                  "w-10 h-6 rounded-full p-0.5 transition-colors relative",
                  settings.restrictionsEnabled ? "bg-red-600" : "bg-slate-300 dark:bg-zinc-800"
                )}>
                  <div className={cn(
                    "w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
                    settings.restrictionsEnabled ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Blocklist input */}
              <div className="space-y-4 p-5 bg-slate-50/60 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 rounded-2xl">
                <h4 className="text-xs uppercase tracking-widest font-black text-indigo-500">Restricted Websites</h4>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-605 dark:text-zinc-400 block">
                    Distractions Blacklist (comma separated)
                  </label>
                  <textarea
                    rows={3}
                    value={settings.restrictedSites}
                    onChange={(e) => handleSaveSettings({ restrictedSites: e.target.value })}
                    placeholder="youtube.com, reddit.com, twitter.com"
                    className="w-full text-xs p-3 bg-white dark:bg-zinc-900 border border-slate-205 dark:border-zinc-800 rounded-xl font-bold dark:text-white"
                  />
                </div>

                <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-3 rounded-lg border border-slate-200 dark:border-zinc-800/80">
                  <span className="text-[10px] font-bold text-slate-500">Active Peak Hours Block:</span>
                  <span className="text-xs font-black text-rose-500">18:00 - 24:00 Daily</span>
                </div>
              </div>

              {/* Instruction blocks to set up Cold Turkey or Freedom */}
              <div className="p-5 bg-yellow-500/5 dark:bg-yellow-500/10 border border-yellow-200/50 dark:border-zinc-800 rounded-2xl space-y-4">
                <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-450 flex items-center gap-1.5">
                  <Shield size={14} className="fill-current text-amber-500 animate-pulse" /> Physical Enforcement Policy
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-semibold">
                  Software tools like **Cold Turkey (PC)**, **SelfControl (Mac)**, or **Freedom** can lock you out with a completely unrecoverable schedule password:
                </p>
                <div className="space-y-2 text-[11px] text-slate-400 dark:text-zinc-500">
                  <p className="font-bold text-slate-700 dark:text-zinc-300">How to implement physical locking:</p>
                  <ol className="list-decimal list-inside space-y-1.5 pl-1 font-medium">
                    <li>Copy your blacklisted domains above list.</li>
                    <li>Import domains list as a daily block theme inside Cold Turkey.</li>
                    <li>Set the blockade schedule to automatically engage from **18:00 to 24:00**.</li>
                    <li>Configure the lock password to a random 60-character hash, and store it on an offline note inside another room to prevent willpower fatigue during stress blocks.</li>
                  </ol>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
};
