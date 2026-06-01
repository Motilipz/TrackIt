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
      <div className="bg-surface text-accent-red p-6 rounded-3xl border border-accent-red/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-colors duration-300">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-accent-red/10 rounded-2xl border border-accent-red/20 text-accent-red animate-pulse shrink-0">
            <Shield size={22} className="fill-current" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase text-accent-red font-mono">
              STRICT PERFORMANCE ENFORCEMENT ZONE
            </span>
            <h1 className="text-2xl font-black text-text-primary mt-1 uppercase tracking-tight">
              ACCOUNTABILITY COCKPIT
            </h1>
            <p className="text-text-muted text-xs mt-1 leading-relaxed max-w-xl">
              Where soft excuses die. View your burn rates, audit weekly reports to mentors, upload actual images of scratchpads, and hold yourself to painful financial stakes.
            </p>
          </div>
        </div>

        {/* Dynamic Risk Gauge pill */}
        <div className="bg-surface-elevated border border-border-tactical px-4 py-3 rounded-2xl flex flex-col items-center justify-center min-w-[140px] transition-colors duration-300">
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest font-mono">Risk Level</span>
          <span className={cn(
            "text-sm font-black uppercase tracking-wider mt-1",
            settings.stakesEnabled ? "text-accent-red" : "text-amber-500"
          )}>
            {settings.stakesEnabled ? "🔥 PLEDGE ACTIVE" : "⚠️ LOW ACCOUNTABILITY"}
          </span>
          <span className="text-[10px] text-text-muted mt-1 font-mono">
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
          <div className="p-5 md:p-6 border border-border-tactical rounded-2xl bg-surface flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-colors duration-300 shadow-sm relative overflow-hidden">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className={cn(
                "p-3 rounded-xl border shrink-0",
                auditSentThisWeek 
                  ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-accent-red/10 text-accent-red border-accent-red/20"
              )}>
                {auditSentThisWeek ? <CheckCircle2 className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wide",
                    auditSentThisWeek
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-accent-red/10 text-accent-red"
                  )}>
                    {auditSentThisWeek ? "✓ Audit Completed" : `Urgent: Audit Season (${dayName})`}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-text-primary mt-1 tracking-tight">
                  {auditSentThisWeek ? "Weekly accountability audit dispatched" : "Weekly accountability audit due"}
                </h3>
                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed max-w-2xl font-medium">
                  {auditSentThisWeek 
                    ? "Great job! Your weekly performance reports were successfully compiled and transmitted to your board of directors."
                    : "Authorized directors require immediate submission of your weekly compilation data to finalize transfer and prevent behavioral leaks."}
                </p>

                {/* Structured list of authorized board recipients styled in blue */}
                {settings.boardEmails && (
                  <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Recipients:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {settings.boardEmails.split(',').map(e => e.trim()).filter(Boolean).map((email, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2 py-0.5 bg-sky-50 dark:bg-sky-950/15 border border-sky-100/70 dark:border-sky-900/30 rounded-md text-[11px] text-sky-600 dark:text-sky-400 font-mono">
                          <div className="w-3.5 h-3.5 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-[9px] font-bold flex items-center justify-center shrink-0 uppercase">
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
                    "mt-4 p-4 rounded-xl border text-xs leading-relaxed max-w-xl transition-colors duration-300",
                    emailResult.success 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                      : "bg-accent-red/10 border-accent-red/20 text-accent-red"
                  )}>
                    <div className="font-bold flex items-center gap-1.5">
                      {emailResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertOctagon className="w-4 h-4 shrink-0" />}
                      {emailResult.success ? "Success!" : "Direct Send Setup Assistant"}
                    </div>
                    <p className="mt-1 font-semibold">{emailResult.message}</p>
                    {emailResult.suggestedSetup && (
                      <div className="mt-2.5 p-2.5 bg-surface-elevated text-text-secondary border border-border-tactical rounded-lg text-[10px] space-y-1">
                        <p className="font-bold text-accent-red uppercase">Interactive Server Keys Setup Required:</p>
                        <p>{emailResult.suggestedSetup}</p>
                        <p className="pt-1 text-[10px] text-text-muted">Rest assured, you can send IMMEDIATELY by clicking the "Local Client" button to route through your device's email client.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!auditSentThisWeek && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0 justify-end mt-4 md:mt-0">
                {/* Primary Action (Direct Push) */}
                <button
                  type="button"
                  onClick={() => handleSendDirectEmail()}
                  disabled={isSendingEmail}
                  className="px-4 py-2.5 bg-accent-purple hover:opacity-90 active:opacity-100 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Mail size={13} />
                  {isSendingEmail ? "Pushing..." : "Direct Push"}
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
                  className="px-4 py-2.5 bg-surface hover:bg-surface-elevated text-text-secondary border border-border-tactical font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                >
                  <ExternalLink size={13} className="text-text-muted" />
                  Local Client
                </button>

                {/* Subtle Divider */}
                <div className="hidden sm:block w-px h-6 bg-border-tactical mx-1 shrink-0" />

                {/* Ghost Action (Mark Sent) */}
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem(`audit_sent_${currentWeekSunday}`, 'true');
                    setAuditSentThisWeek(true);
                  }}
                  className="px-3.5 py-2.5 text-text-muted hover:text-text-secondary font-semibold text-xs rounded-xl transition-all hover:bg-surface-elevated text-center shrink-0"
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
                className="text-[10px] text-text-muted hover:text-accent-red font-bold uppercase transition-all shrink-0 mt-2 md:mt-0"
              >
                Reset Status
              </button>
            )}
          </div>
        );
      })()}

      {/* Mode selectors bento navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-surface-elevated p-1.5 rounded-2xl border border-border-tactical transition-colors duration-300">
        <button
          onClick={() => setActiveSection('burn')}
          className={cn(
            "flex items-center gap-2 justify-center py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all",
            activeSection === 'burn'
              ? "bg-surface text-accent-purple shadow-sm border border-border-tactical font-extrabold focus:outline-none"
              : "text-text-muted hover:bg-surface font-semibold hover:text-text-secondary"
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
              ? "bg-surface text-accent-purple shadow-sm border border-border-tactical font-extrabold focus:outline-none"
              : "text-text-muted hover:bg-surface font-semibold hover:text-text-secondary"
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
              ? "bg-surface text-accent-purple shadow-sm border border-border-tactical font-extrabold focus:outline-none"
              : "text-text-muted hover:bg-surface font-semibold hover:text-text-secondary"
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
              ? "bg-surface text-accent-purple shadow-sm border border-border-tactical font-extrabold focus:outline-none"
              : "text-text-muted hover:bg-surface font-semibold hover:text-text-secondary"
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
              ? "bg-surface text-accent-purple shadow-sm border border-border-tactical font-extrabold focus:outline-none"
              : "text-text-muted hover:bg-surface font-semibold hover:text-text-secondary"
          )}
        >
          <Globe size={14} />
          Constraints
        </button>
      </div>

      {/* MAIN CONTAINER PANELS */}
      <div className="bg-surface border border-border-tactical rounded-3xl p-6 md:p-8 shadow-sm transition-colors duration-300">
        
        {/* ============ 1. THE BURN RATE SECTION ============ */}
        {activeSection === 'burn' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 border-b border-border-tactical pb-4">
              <div>
                <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <Flame className="text-accent-red fill-accent-red animate-pulse" size={20} />
                  The Prep "Burn Rate" Calculator
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Treat study time as a rapidly depleting bank account. Track your mandatory pace toward the target exam date.
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-surface-elevated/40 px-2.5 py-1 rounded text-accent-purple">
                {daysRemaining} Days Until Exam
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-6">
                
                {/* Inputs card */}
                <div className="p-5 bg-surface-elevated/40 border border-border-tactical rounded-2xl space-y-4">
                  <h4 className="text-xs uppercase tracking-wider font-extrabold text-text-muted">Configure Targets</h4>
                  
                  {/* Target hours input */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary block">
                      Target Goal Hours (Deep Prep)
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={10000}
                      value={settings.burnGoalHours}
                      onChange={(e) => handleSaveSettings({ burnGoalHours: parseInt(e.target.value) || 500 })}
                      className="w-full text-sm p-3 bg-background border border-border-tactical rounded-xl font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple transition-colors duration-300"
                    />
                  </div>

                  {/* Exam target date input */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-secondary block">
                      Exam Target Date (SimCAT / Official)
                    </label>
                    <input
                      type="date"
                      required
                      value={settings.examDate}
                      onChange={(e) => handleSaveSettings({ examDate: e.target.value })}
                      className="w-full text-sm p-3 bg-background border border-border-tactical rounded-xl font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple transition-colors duration-300"
                    />
                  </div>
                </div>

                {/* Flatline Impact Statement */}
                <div className="p-4 bg-accent-red/5 border border-accent-red/20 rounded-2xl flex items-start gap-3 transition-colors duration-300">
                  <AlertOctagon size={18} className="text-accent-red shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase text-accent-red">Mathematical Flatline Warning</p>
                    <p className="text-text-muted text-xs leading-relaxed">
                      Every day you spend at **0.0 hours completed** permanently raises your daily required burn rate for all remaining days. Procrastination directly shifts tomorrow's hill into a mountain.
                    </p>
                  </div>
                </div>
              </div>

              {/* Big Metric Output Dashboard */}
              <div className="p-6 bg-surface-elevated text-text-primary rounded-3xl border border-border-tactical space-y-6 flex flex-col justify-between h-full min-h-[300px] transition-colors duration-300">
                
                <div>
                  <span className="text-[9px] font-bold text-accent-red uppercase tracking-widest font-mono">Required Pace</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-4xl font-black text-accent-red">{dailyBurnRate.toFixed(2)}</span>
                    <span className="text-xs font-semibold text-text-secondary font-mono">hours / day</span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    To reach your final goal before the exam.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-border-tactical">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-text-secondary">Progress</span>
                    <span className="font-bold text-accent-red">
                      {accomplishedHours.toFixed(1)} hrs completed / {remainingHours.toFixed(1)} hrs left
                    </span>
                  </div>
                  <div className="w-full bg-background h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-accent-red h-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (accomplishedHours / settings.burnGoalHours) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-border-tactical space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary font-medium">Pace Health Indicator:</span>
                    {dailyBurnRate <= 2 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold uppercase font-mono">✅ HEALTHY (PACE &lt;= 2.0h)</span>
                    ) : dailyBurnRate <= 4 ? (
                      <span className="text-yellow-600 dark:text-amber-400 font-extrabold uppercase font-mono">⚠️ CAUTION (PACE 2.0 - 4.0h)</span>
                    ) : (
                      <span className="text-accent-red font-extrabold uppercase animate-pulse font-mono">🔥 CRITICAL (PACE &gt; 4.0h)</span>
                    )}
                  </div>
                  <p className="text-[10px] text-text-muted italic block leading-relaxed font-semibold">
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
            <div className="border-b border-border-tactical pb-4">
              <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Award className="text-accent-purple" size={20} />
                The "Proof of Work" Vault
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Lock down real retention. Upload photos of massive, messy scratchpads, screenshots of correct answers, or worksheet matrices to bypass the administrative illusion.
              </p>
            </div>

            {/* Standalone Proof Intake Form */}
            <form onSubmit={handleUploadProof} className="bg-surface-elevated/40 rounded-2xl p-6 border border-border-tactical grid grid-cols-1 md:grid-cols-2 gap-6 transition-colors duration-300">
              
              <div className="space-y-4">
                <h4 className="text-xs uppercase tracking-widest font-black text-accent-purple">Log New Unpadable Evidence</h4>
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary font-bold">Action / Block Identifier</label>
                  <input
                    type="text"
                    required
                    value={proofTaskTitle}
                    onChange={(e) => setProofTaskTitle(e.target.value)}
                    placeholder="e.g., QA: Resolved 15 Quadratic Matrices"
                    className="w-full text-xs p-3 bg-background border border-border-tactical rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple transition-all"
                  />
                </div>

                {/* Subject & FileLink Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-text-secondary font-bold">Section</label>
                    <select
                      value={proofCategory}
                      onChange={(e) => setProofCategory(e.target.value)}
                      className="w-full text-xs p-3 bg-background border border-border-tactical rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple transition-all"
                    >
                      <option className="bg-surface text-text-primary" value="QA">QA</option>
                      <option className="bg-surface text-text-primary" value="DILR">DILR</option>
                      <option className="bg-surface text-text-primary" value="VARC">VARC</option>
                      <option className="bg-surface text-text-primary" value="Mock">Mock</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-text-secondary font-bold">External Link (optional)</label>
                    <input
                      type="url"
                      value={proofFileLink}
                      onChange={(e) => setProofFileLink(e.target.value)}
                      placeholder="e.g. Notion, Sheets log"
                      className="w-full text-xs p-3 bg-background border border-border-tactical rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple transition-all"
                    />
                  </div>
                </div>

                {/* Takeaway */}
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary font-bold">Key Takeaway Insights</label>
                  <textarea
                    rows={2}
                    value={proofNotes}
                    onChange={(e) => setProofNotes(e.target.value)}
                    placeholder="Capture the raw insight. What did you master? What silly mistake did you isolate?"
                    className="w-full text-xs p-3 bg-background border border-border-tactical rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple transition-all"
                  />
                </div>
              </div>

              {/* Right Dropzone File Attachment Area */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary font-bold">Attach Scratchpad Photo (Max 800KB)</label>
                  
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
                        ? "border-accent-purple bg-accent-purple/10 text-accent-purple" 
                        : "border-border-tactical hover:border-accent-purple text-text-muted hover:text-accent-purple"
                    )}
                  >
                    <input 
                      type="file" 
                      id="vault-file-picker"
                      accept="image/*"
                      className="hidden" 
                      onChange={(e) => e.target.files && e.target.files[0] && handleFileChange(e.target.files[0])}
                    />
                    
                    <Upload className="w-8 h-8 mb-2 animate-bounce animate-duration-1000" />
                    
                    {selectedFile ? (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-text-primary truncate max-w-[220px]">
                          {selectedFile.name}
                        </p>
                        <p className="text-[10px] text-emerald-500 font-bold">
                          ✓ File buffered successfully ({(selectedFile.size/1024).toFixed(1)} KB)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold text-text-secondary">Drag & Drop scratchpad image here</p>
                        <p className="text-[10px] text-text-muted mt-1">or click to browse local files</p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!proofTaskTitle.trim()}
                  className="w-full py-3.5 bg-accent-purple text-white font-black text-xs uppercase tracking-widest rounded-xl hover:opacity-90 active:opacity-100 transition-all disabled:opacity-50"
                >
                  Authorize Proof Submission
                </button>
              </div>

            </form>

            {/* Locked Vault Items Showcase Grid */}
            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest font-black text-text-muted">Vault Ledger Logs ({vaultItems.length})</h4>
              
              {vaultItems.length === 0 ? (
                <div className="border border-dashed border-border-tactical p-8 rounded-2xl text-center text-sm text-text-muted">
                  ⚠️ No proof attachments locked in. Upload your first workout scratchpad above.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {vaultItems.map((item) => (
                    <div 
                      key={item.id} 
                      className="p-5 bg-surface border border-border-tactical rounded-2xl flex gap-4 relative group transition-colors duration-300"
                    >
                      <button
                        onClick={() => handleDeleteProof(item.id)}
                        className="absolute top-3 right-3 p-1.5 text-text-muted hover:text-accent-red rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove Vault Entry"
                      >
                        <Trash2 size={13} />
                      </button>

                      {item.imageDataUrl && (
                        <div className="w-16 h-16 rounded-xl border border-border-tactical overflow-hidden shrink-0 bg-background self-start">
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
                          <span className="text-[9px] bg-accent-purple/10 text-accent-purple border border-accent-purple/20 font-bold px-1.5 py-0.5 rounded truncate uppercase shrink-0">
                            {item.category}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono shrink-0">
                            {format(new Date(item.createdAt), 'MM/dd HH:mm')}
                          </span>
                        </div>
                        <h5 className="font-extrabold text-text-primary truncate mt-0.5 leading-snug">
                          {item.taskTitle}
                        </h5>
                        <p className="text-xs text-text-secondary italic leading-relaxed line-clamp-2">
                          “{item.proofNotes || 'No notes left.'}”
                        </p>
                        {item.fileLink && (
                          <a 
                            href={item.fileLink} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[10px] text-accent-purple font-bold block mt-1 hover:underline truncate"
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
            <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 border-b border-border-tactical pb-4">
              <div>
                <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <DollarSign className="text-accent-purple" size={20} />
                  Financial Escrow (Skin in the Game)
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
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
                <span className="text-xs font-extrabold uppercase text-text-muted tracking-wider">Pledge Status:</span>
                <div className={cn(
                  "w-10 h-6 rounded-full p-0.5 transition-colors relative",
                  settings.stakesEnabled ? "bg-accent-red" : "bg-surface-elevated border border-border-tactical"
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
              <div className="space-y-4 p-5 bg-surface-elevated/40 border border-border-tactical rounded-2xl transition-colors duration-300">
                <h4 className="text-xs uppercase tracking-widest font-black text-accent-purple">Stakes Engine Setup</h4>
                
                {/* Penalty input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary block">
                    Penalty per Daily Frog Fail
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-text-muted">$</span>
                    <input
                      type="number"
                      required
                      min={1}
                      max={500}
                      value={settings.stakesAmount}
                      disabled={settings.stakesEnabled}
                      onChange={(e) => handleSaveSettings({ stakesAmount: parseInt(e.target.value) || 20 })}
                      className="w-full text-sm pl-7 pr-3 py-3 bg-background border border-border-tactical rounded-xl font-bold text-text-primary disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent-purple transition-all"
                    />
                  </div>
                  {settings.stakesEnabled && (
                    <p className="text-[10px] text-accent-red font-semibold mt-1">
                      🔒 Disable pledge above to modify your penalty rate.
                    </p>
                  )}
                </div>

                {/* Anti Charity Target */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary block">
                    Beneficiary Anti-Charity
                  </label>
                  <select
                    value={settings.antiCharity}
                    disabled={settings.stakesEnabled}
                    onChange={(e) => handleSaveSettings({ antiCharity: e.target.value })}
                    className="w-full text-xs p-3 bg-background border border-border-tactical rounded-xl text-text-primary disabled:opacity-50 font-medium focus:outline-none"
                  >
                    {ANTI_CHARITIES.map((c) => (
                      <option className="bg-surface text-text-primary" key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Ledger Monitor Display */}
              <div className="p-6 bg-accent-red/5 border border-accent-red/10 rounded-2xl flex flex-col justify-between h-full space-y-4">
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-accent-red bg-accent-red/10 px-2 py-0.5 rounded-full inline-block">
                    Loss Aversion Ledger
                  </span>
                  
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-xs font-bold text-text-secondary">Pledge Balance Forfeited:</span>
                    <span className="text-3xl font-black text-white bg-accent-red px-3 py-1 rounded-xl shadow">
                      ${totalForfeitedStakes}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-b border-dashed border-border-tactical pb-2">
                    <span className="text-text-muted">Total Failed Frogs:</span>
                    <span className="font-bold text-text-primary font-mono">{failedFrogs.length} Frogs</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-text-primary">Anti-Charity Target Pool:</p>
                  <p className="text-xs text-accent-red italic font-medium">
                    “{settings.antiCharity}”
                  </p>
                </div>

                <p className="text-[10px] text-text-muted leading-relaxed font-semibold">
                  ⚠️ **Weekly settlement compliance policy**: Every Sunday night, if any Frog fails reconciliation, you must prove you transfered the accumulated amount to the anti-charity to secure board audit clearance.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* ============ 4. BOARD OF DIRECTORS AUDIT ============ */}
        {activeSection === 'audit' && (
          <div id="board-audit-tab" className="bg-surface p-6 md:p-8 rounded-3xl border border-border-tactical text-text-primary space-y-6 animate-in fade-in zoom-in-95 duration-200 transition-colors duration-300">
            
            {/* 1. The Impending Deadline Banner (Top, Full Width) */}
            <div className="bg-surface-elevated border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <span className="text-xs font-black tracking-widest uppercase text-amber-500 dark:text-amber-400 font-mono">
                  WEEK 12 AUDIT: PENDING DISPATCH
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <span className="text-sm font-black font-mono tracking-wider text-amber-600 dark:text-amber-400">
                  T-MINUS {countdownStr}
                </span>
              </div>
            </div>

            {/* 2. Main Content Grid (2 Columns: 60% / 40%) */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
              
              {/* Column A (Left - 60%) */}
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-surface-elevated/80 border border-border-tactical rounded-3xl p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary flex items-center gap-2 tracking-tight">
                      <FileText className="text-accent-purple" size={18} />
                      Live Audit Draft
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5 font-mono">
                      What your Board will see on Sunday at 23:59
                    </p>
                  </div>

                  {/* High Stakes Harsh Reality Check Mock Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 text-xs">
                    <div className="p-3.5 bg-background border border-border-tactical rounded-xl flex items-center justify-between">
                      <span className="font-medium text-text-secondary">Burn Rate Compliance:</span>
                      <span className="font-bold text-accent-red flex items-center gap-1 font-mono">
                        🔴 14.2 hours deficit
                      </span>
                    </div>
                    <div className="p-3.5 bg-background border border-border-tactical rounded-xl flex items-center justify-between">
                      <span className="font-medium text-text-secondary">High-Stakes Frogs:</span>
                      <span className="font-bold text-text-primary font-mono">
                        Conquered 4/7
                      </span>
                    </div>
                    <div className="p-3.5 bg-background border border-border-tactical rounded-xl flex items-center justify-between">
                      <span className="font-medium text-text-secondary">Financial Escrow:</span>
                      <span className="font-bold text-accent-red font-mono">
                        Forfeited $20.00
                      </span>
                    </div>
                    <div className="p-3.5 bg-background border border-border-tactical rounded-xl flex items-center justify-between">
                      <span className="font-medium text-text-secondary">Proof Vault Integrity:</span>
                      <span className="font-bold text-amber-500 font-mono">
                        🟡 Missing 1 receipt
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Live Markdown Document Draft Panel */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-widest text-text-muted font-mono">
                      Generated Report Content
                    </span>
                    <div className="text-[11px] font-mono bg-background p-4 rounded-xl overflow-y-auto text-text-secondary border border-border-tactical max-h-[180px] leading-relaxed select-all">
                      <pre className="whitespace-pre-wrap">{generateAuditReport()}</pre>
                    </div>
                  </div>

                  {/* Feedback on dispatch */}
                  {emailResult && (
                    <div className={cn(
                      "p-3.5 rounded-xl border text-xs leading-relaxed",
                      emailResult.success 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                        : "bg-accent-red/10 border-accent-red/20 text-accent-red"
                    )}>
                      <div className="font-bold flex items-center gap-1.5 mb-1">
                        {emailResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <AlertOctagon className="w-4 h-4 shrink-0 text-accent-red" />}
                        {emailResult.success ? "Early Dispatch Transmitted!" : "Auditor Dispatch Assist"}
                      </div>
                      <p className="font-medium text-[11px]">{emailResult.message}</p>
                      {emailResult.suggestedSetup && (
                        <div className="mt-2 p-2 bg-background rounded-lg text-[9px] text-text-muted font-mono leading-normal">
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
                      className="flex-1 py-3 bg-accent-red hover:opacity-90 active:opacity-100 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 shrink-0"
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
                      className="py-3 px-4 bg-surface-elevated hover:bg-background border border-border-tactical transition-all text-text-secondary hover:text-text-primary font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shrink-0"
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
                      className="p-3 bg-surface-elevated hover:bg-background border border-border-tactical transition-all text-text-secondary hover:text-text-primary font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center shrink-0"
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
                <div className="bg-surface-elevated border border-border-tactical rounded-3xl p-6 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                      <Users className="text-text-muted" size={16} />
                      Stakeholder Roster
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Configure your board of directors
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-text-muted tracking-wider">
                      Auditor Email Addresses (comma separated)
                    </label>
                    <input
                      type="text"
                      required
                      value={settings.boardEmails}
                      onChange={(e) => handleSaveSettings({ boardEmails: e.target.value })}
                      placeholder="mentor@example.com, peer@example.com"
                      className="w-full text-xs p-3 bg-background border border-border-tactical rounded-xl font-bold font-mono text-text-primary focus:outline-none focus:border-accent-purple"
                    />
                  </div>

                  {/* Engagement Ledger with mock read statuses */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-black uppercase text-text-muted tracking-wider">
                      Engagement Ledger
                    </span>
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-background border border-border-tactical rounded-xl flex justify-between items-center">
                        <span className="font-mono text-text-primary">Rishabh (Peer)</span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          🟢 Reviewed last week
                        </span>
                      </div>
                      <div className="p-3 bg-background border border-border-tactical rounded-xl flex justify-between items-center">
                        <span className="font-mono text-text-primary">Dr. Sharma (Mentor)</span>
                        <span className="text-[10px] font-bold text-accent-red flex items-center gap-1">
                          🔴 Did not open last week
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* subtle tooltip/text explanation */}
                  <div className="p-3 bg-background/40 border border-border-tactical rounded-xl">
                    <p className="text-[10px] text-text-muted leading-normal font-semibold">
                      ⚠️ Mentors who ignore 2 consecutive reports are automatically flagged for removal.
                    </p>
                  </div>
                </div>

                {/* Behavioral Help card inside board section */}
                <div className="p-5 bg-accent-purple/5 border border-dashed border-accent-purple/20 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black uppercase text-accent-purple flex items-center gap-1">
                    <Sparkles size={11} className="text-amber-500 animate-bounce" /> Behavioral Evasion Shields
                  </h4>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
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
            <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 border-b border-border-tactical pb-4">
              <div>
                <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <Globe className="text-accent-purple" size={20} />
                  Intentional Environment Constraints
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
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
                <span className="text-xs font-extrabold uppercase text-text-muted tracking-wider">Lockdown Blocklist:</span>
                <div className={cn(
                  "w-10 h-6 rounded-full p-0.5 transition-colors relative",
                  settings.restrictionsEnabled ? "bg-accent-red" : "bg-surface-elevated border border-border-tactical"
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
              <div className="space-y-4 p-5 bg-surface-elevated/40 border border-border-tactical rounded-2xl">
                <h4 className="text-xs uppercase tracking-widest font-black text-accent-purple">Restricted Websites</h4>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-secondary block">
                    Distractions Blacklist (comma separated)
                  </label>
                  <textarea
                    rows={3}
                    value={settings.restrictedSites}
                    onChange={(e) => handleSaveSettings({ restrictedSites: e.target.value })}
                    placeholder="youtube.com, reddit.com, twitter.com"
                    className="w-full text-xs p-3 bg-background border border-border-tactical rounded-xl font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple transition-all"
                  />
                </div>

                <div className="flex justify-between items-center bg-background p-3 rounded-lg border border-border-tactical">
                  <span className="text-[10px] font-bold text-text-secondary">Active Peak Hours Block:</span>
                  <span className="text-xs font-black text-accent-red">18:00 - 24:00 Daily</span>
                </div>
              </div>

              {/* Instruction blocks to set up Cold Turkey or Freedom */}
              <div className="p-5 bg-yellow-500/5 dark:bg-yellow-500/10 border border-yellow-250/20 dark:border-border-tactical rounded-2xl space-y-4">
                <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Shield size={14} className="fill-current text-amber-500 animate-pulse animate-duration-1000" /> Physical Enforcement Policy
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed font-semibold">
                  Software tools like **Cold Turkey (PC)**, **SelfControl (Mac)**, or **Freedom** can lock you out with a completely unrecoverable schedule password:
                </p>
                <div className="space-y-2 text-[11px] text-text-muted">
                  <p className="font-bold text-text-primary">How to implement physical locking:</p>
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
