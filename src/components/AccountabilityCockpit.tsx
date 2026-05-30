import React, { useState, useEffect } from 'react';
import { 
  Shield, Award, DollarSign, Users, Flame, Clock, 
  Upload, CheckCircle2, ChevronRight, X, Sparkles, 
  AlertOctagon, Globe, Trash2, Mail, FileText, Download
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

export const AccountabilityCockpit: React.FC<AccountabilityCockpitProps> = ({
  user,
  dailyTasks,
  logs
}) => {
  const [settings, setSettings] = useState<AccountabilitySettings>(DEFAULT_ACCOUNTABILITY);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
  
  // Tab indicator
  const [activeSection, setActiveSection] = useState<'burn' | 'proof' | 'stakes' | 'audit' | 'constraints'>('burn');

  // Sync settings and vault items from Firestore
  useEffect(() => {
    if (!user) return;

    // Listen to Accountability Settings
    const setPath = doc(db, 'users', user.uid, 'settings', 'accountability');
    const unsubSettings = onSnapshot(setPath, (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_ACCOUNTABILITY, ...snap.data() });
      } else {
        setDoc(setPath, DEFAULT_ACCOUNTABILITY);
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
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 border-b border-slate-105 dark:border-zinc-800/80 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-905 dark:text-white flex items-center gap-2">
                  <Users className="text-indigo-600 dark:text-indigo-400" size={20} />
                  The "Board of Directors" Audit
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Appoint respected mentors, peers, or contacts. Generate an automatic weekly text draft and email reports to reduce evasion.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Setup Board Address */}
              <div className="space-y-4 p-5 bg-slate-50/60 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 rounded-2xl">
                <h4 className="text-xs uppercase tracking-widest font-black text-indigo-500">Board Membership</h4>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block">
                    Auditor Email Addresses (1 to 3, comma separated)
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.boardEmails}
                    onChange={(e) => handleSaveSettings({ boardEmails: e.target.value })}
                    placeholder="e.g. mentor@example.com, peer@example.com"
                    className="w-full text-xs p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl font-bold dark:text-white"
                  />
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                  📧 Reports are scheduled to generate every **Sunday at 23:59 UTC**. Mentors will inspect your compliance score, frog successes, failure post-mortems, and proof attachments.
                </p>

                <button
                  type="button"
                  onClick={() => setShowAuditPreview(true)}
                  className="w-full py-3 bg-white hover:bg-slate-50 text-indigo-650 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-indigo-200 dark:border-zinc-700 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Preview Auditor weekly Report
                </button>
              </div>

              {/* Integrity Reminder and Guidelines */}
              <div className="p-5 bg-indigo-50/20 border border-dashed border-indigo-150 rounded-2xl space-y-4">
                <h4 className="text-xs font-black uppercase text-indigo-650 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles size={13} className="text-amber-500 fill-amber-500 animate-bounce" /> Behavioral Evasion Shields
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  We easily lie to ourselves in dark corners, but looking lazy or erratic in front of high-reputation mentors triggers deep societal compliance drives. 
                </p>
                <div className="space-y-2 text-xs">
                  <p className="font-bold text-slate-705 dark:text-zinc-300">Suggested board format:</p>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-slate-400 dark:text-zinc-500 font-medium">
                    <li>1 High-discipline peer study partner</li>
                    <li>1 Mentor / Instructor whose time you value</li>
                    <li>1 Highly critical stakeholder</li>
                  </ul>
                </div>
              </div>

            </div>

            {/* EXPANDABLE PREVIEW POPUP MODAL */}
            {showAuditPreview && (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-xl w-full border border-slate-100 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b pb-3 mb-4 shrink-0">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5ClassName">
                      <FileText size={16} className="text-indigo-600" />
                      Weekly Report Preview
                    </h4>
                    <button 
                      onClick={() => setShowAuditPreview(false)}
                      className="p-1 hover:bg-slate-50 dark:hover:bg-zinc-855 rounded text-slate-400 hover:text-slate-650"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-xs font-mono bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl overflow-y-auto flex-1 text-slate-700 dark:text-zinc-350 pr-2 min-h-0">
                    <pre className="whitespace-pre-wrap leading-relaxed">{generateAuditReport()}</pre>
                  </div>

                  <div className="mt-4 pt-3 border-t flex gap-3 shrink-0">
                    <button
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
                      className="flex-1 py-2.5 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-wide rounded-xl border border-slate-205 transition-all text-center"
                    >
                      Export Report (.md)
                    </button>
                    <button
                      onClick={() => {
                        window.location.href = `mailto:${settings.boardEmails}?subject=Weekly%20Accountability%20Auditing%20Log&body=${encodeURIComponent(generateAuditReport())}`;
                      }}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wide rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Mail size={13} /> Send Email via Local Client
                    </button>
                  </div>
                </div>
              </div>
            )}
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
