import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, ZAxis, AreaChart, Area
} from 'recharts';
import { 
  Calendar, Clock, BookOpen, BarChart3, History, Download, 
  Plus, Trash2, LogOut, LayoutDashboard, ChevronLeft, ChevronRight,
  Target, Award, TrendingUp, Settings as SettingsIcon, Save, RotateCcw, X, Star, AlertTriangle, Maximize2,
  Sun, Moon, Monitor, Menu, FileJson, Upload, FileUp, Gauge
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, subDays, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval, addHours } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User,
  collection, doc, addDoc, deleteDoc, query, where, orderBy, onSnapshot, Timestamp, setDoc, getDoc, writeBatch
} from './firebase';

import { TimerCard } from './components/TimerCard';
import { ReadingVelocityEngine } from './components/ReadingVelocityEngine';
import { StudyLog, ReadingLog } from './types';

const DOMAINS = ['Philosophy', 'Economics', 'Sociology', 'Science', 'Literature', 'History', 'Technology'];

// Theme Types
type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme');
    return (saved as Theme) || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme as 'light' | 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let current: 'light' | 'dark';
    if (theme === 'system') {
      current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      current = theme as 'light' | 'dark';
    }

    if (current === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.colorScheme = current;
    setResolvedTheme(current);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = window.document.documentElement;
      const isDark = mediaQuery.matches;
      const current = isDark ? 'dark' : 'light';
      root.classList.remove('light', 'dark');
      if (current === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      root.style.colorScheme = current;
      setResolvedTheme(current);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || '',
      email: auth.currentUser?.email || '',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || '',
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || '',
        email: provider.email || '',
        photoUrl: provider.photoURL || ''
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface UserGoals {
  daily: number; // minutes
  weekly: number; // minutes
}

const DEFAULT_CATEGORIES = ["QA", "QA Lecture", "DILR", "DILR Lecture", "VARC", "VARC Lecture", "Mock", "Mock Analysis", "Revision", "Other"];
const CATEGORY_COLORS: Record<string, string> = {
  'QA': '#6366f1',
  'QA Lecture': '#6366f1',
  'DILR': '#8b5cf6',
  'DILR Lecture': '#8b5cf6',
  'VARC': '#ec4899',
  'VARC Lecture': '#ec4899',
  'Mock': '#f43f5e',
  'Mock Analysis': '#f43f5e',
  'Revision': '#f59e0b',
  'Other': '#10b981'
};

const getCategoryColor = (cat: string) => CATEGORY_COLORS[cat] || '#10b981';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#06b6d4', '#84cc16', '#f97316'];

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "{}");
        if (parsed.error) {
          errorMessage = `Firestore Error: ${parsed.error} (${parsed.operationType} at ${parsed.path})`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-8 border border-red-100 dark:border-red-900/30">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Application Error</h2>
            <p className="text-slate-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [readingLogs, setReadingLogs] = useState<ReadingLog[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [goals, setGoals] = useState<UserGoals>({ daily: 120, weekly: 840 });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'log' | 'history' | 'timer' | 'reading' | 'settings'>('dashboard');
  
  // Editing state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on tab change for mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeTab]);

  // Form state
  const [category, setCategory] = useState('QA');
  const [startTime, setStartTime] = useState(format(new Date(), 'HH:mm'));
  const [endTime, setEndTime] = useState(format(addHours(new Date(), 1), 'HH:mm'));
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(3);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'log' && !editingLogId) {
      setStartTime(format(new Date(), 'HH:mm'));
      setEndTime(format(addHours(new Date(), 1), 'HH:mm'));
      setDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [activeTab, editingLogId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setLogs([]);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'logs'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date.toDate(),
          createdAt: data.createdAt.toDate()
        } as StudyLog;
      });
      setLogs(newLogs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/logs`);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setReadingLogs([]);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'readingLogs'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date.toDate(),
          createdAt: data.createdAt.toDate()
        } as unknown as ReadingLog;
      });
      setReadingLogs(newLogs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/readingLogs`);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/settings/categories`;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid, 'settings', 'categories'), (docSnap) => {
      if (docSnap.exists()) {
        setCategories(docSnap.data().list || DEFAULT_CATEGORIES);
      } else {
        setDoc(doc(db, 'users', user.uid, 'settings', 'categories'), { list: DEFAULT_CATEGORIES })
          .catch(err => handleFirestoreError(err, OperationType.WRITE, path));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const path = `users/${user.uid}/settings/goals`;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid, 'settings', 'goals'), (docSnap) => {
      if (docSnap.exists()) {
        setGoals(docSnap.data() as UserGoals);
      } else {
        setDoc(doc(db, 'users', user.uid, 'settings', 'goals'), { daily: 120, weekly: 840 })
          .catch(err => handleFirestoreError(err, OperationType.WRITE, path));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  const streak = useMemo(() => {
    if (logs.length === 0) return 0;
    
    const uniqueDates = Array.from(new Set(
      logs.map(log => format(log.date, 'yyyy-MM-dd'))
    )).sort((a, b) => b.localeCompare(a));

    let currentStreak = 0;
    let today = format(new Date(), 'yyyy-MM-dd');
    let yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

    let checkDate = uniqueDates[0] === today ? new Date() : subDays(new Date(), 1);

    for (const dateStr of uniqueDates) {
      if (dateStr === format(checkDate, 'yyyy-MM-dd')) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      } else {
        if (dateStr < format(checkDate, 'yyyy-MM-dd')) break;
      }
    }
    return currentStreak;
  }, [logs]);

  const handleAddCategory = async () => {
    if (!user || !newCategoryName.trim()) return;
    const trimmed = newCategoryName.trim();
    if (categories.includes(trimmed)) return;

    const newList = [...categories, trimmed];
    const path = `users/${user.uid}/settings/categories`;
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'categories'), { list: newList });
      setNewCategoryName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleRemoveCategory = async (catToRemove: string) => {
    if (!user || categories.length <= 1) return;
    const newList = categories.filter(c => c !== catToRemove);
    const path = `users/${user.uid}/settings/categories`;
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'categories'), { list: newList });
      if (category === catToRemove) setCategory(newList[0]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    let durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    
    if (durationMinutes <= 0) {
      setFormError("End time must be after start time");
      setTimeout(() => setFormError(null), 3000);
      return;
    }

    setIsSubmitting(true);
    const path = editingLogId 
      ? `users/${user.uid}/logs/${editingLogId}`
      : `users/${user.uid}/logs`;
      
    try {
      const logData = {
        userId: user.uid,
        category,
        duration: durationMinutes,
        date: Timestamp.fromDate(new Date(date)),
        notes,
        rating,
        startTime,
        endTime,
        updatedAt: Timestamp.now()
      };

      if (editingLogId) {
        await setDoc(doc(db, 'users', user.uid, 'logs', editingLogId), {
          ...logData,
          createdAt: logs.find(l => l.id === editingLogId)?.createdAt || Timestamp.now()
        });
      } else {
        await addDoc(collection(db, 'users', user.uid, 'logs'), {
          ...logData,
          createdAt: Timestamp.now()
        });
      }
      
      setNotes('');
      setEditingLogId(null);
      setActiveTab('dashboard');
    } catch (error) {
      handleFirestoreError(error, editingLogId ? OperationType.UPDATE : OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (log: StudyLog) => {
    setEditingLogId(log.id);
    setCategory(log.category);
    setDate(format(log.date, 'yyyy-MM-dd'));
    setStartTime(log.startTime || '09:00');
    setEndTime(log.endTime || '10:00');
    setNotes(log.notes || '');
    setRating(log.rating || 3);
    setActiveTab('log');
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!user || !deleteConfirmId) return;
    const id = deleteConfirmId;
    const path = `users/${user.uid}/logs/${id}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'logs', id));
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const downloadCSV = () => {
    const combinedLogs = [
      ...logs.map(l => ({ date: l.date, category: l.category, duration: l.duration, notes: l.notes || "", type: 'Study' })),
      ...readingLogs.map(l => ({ date: l.date, category: l.domain, duration: Math.floor(l.duration / 60), notes: l.comprehensionSummary, type: 'Reading' }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    if (combinedLogs.length === 0) return;
    
    const headers = ["Date", "Type", "Category/Domain", "Duration (min)", "Performance/Notes"];
    const rows = combinedLogs.map(log => [
      format(log.date, 'yyyy-MM-dd'),
      log.type,
      log.category,
      log.duration,
      log.notes
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `cat_prep_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (logs.length === 0) return;
    
    // Convert logs to a format that's easy to import back
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const exportFileDefaultName = `cat-prep-logs-${format(new Date(), 'yyyy-MM-dd')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', url);
    linkElement.setAttribute('download', exportFileDefaultName);
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const importedLogs = JSON.parse(content);

        if (!Array.isArray(importedLogs)) {
          throw new Error("Invalid file format. Expected an array of logs.");
        }

        let batch = writeBatch(db);
        let count = 0;
        let totalCount = 0;

        for (const log of importedLogs) {
          // Basic validation
          if (!log.category || !log.duration || !log.date) continue;

          const logRef = doc(collection(db, 'users', user.uid, 'logs'));
          
          // Convert date string back to Timestamp
          const logDate = new Date(log.date);
          
          batch.set(logRef, {
            userId: user.uid,
            category: String(log.category),
            duration: Number(log.duration),
            date: Timestamp.fromDate(logDate),
            notes: String(log.notes || ''),
            rating: Number(log.rating || 3),
            startTime: log.startTime ? String(log.startTime) : null,
            endTime: log.endTime ? String(log.endTime) : null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
          
          count++;
          totalCount++;
          
          // Firestore batch limit is 500
          if (count >= 400) {
            await batch.commit();
            // Small delay to keep UI responsive
            await new Promise(resolve => setTimeout(resolve, 50));
            batch = writeBatch(db);
            count = 0;
          }
        }

        if (count > 0) {
          await batch.commit();
        }
        
        alert(`Successfully imported ${totalCount} logs!`);
        e.target.value = ''; // Reset input
      } catch (err) {
        console.error("Import error:", err);
        setImportError(err instanceof Error ? err.message : "Failed to import logs.");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
  };

  // Optimized Analytics - Single Pass
  const analytics = useMemo(() => {
    const now = new Date();
    const startOfW = startOfWeek(now, { weekStartsOn: 1 });
    const endOfW = endOfWeek(now, { weekStartsOn: 1 });
    const startOfM = startOfMonth(now);
    const endOfM = endOfMonth(now);
    
    const weekDays = eachDayOfInterval({ start: startOfW, end: endOfW });
    const monthDays = eachDayOfInterval({ start: startOfM, end: endOfM });
    
    const weeklyMap = new Map(weekDays.map(d => [format(d, 'yyyy-MM-dd'), 0]));
    const monthlyMap = new Map(monthDays.map(d => [format(d, 'yyyy-MM-dd'), 0]));
    const categoryMap = new Map(categories.map(c => [c, 0]));
    if (!categoryMap.has('VARC')) categoryMap.set('VARC', 0);
    const stackedWeeklyMap = new Map(weekDays.map(d => [format(d, 'yyyy-MM-dd'), {} as any]));
    const heatmapMap = new Map();
    const contributionMap = new Map();
    const baseSubjects = ['QA', 'DILR', 'VARC', 'Mock', 'Revision', 'Other'];
    const radarMap = new Map(baseSubjects.map(s => [s, 0]));
    const readingRadarMap = new Map(baseSubjects.map(s => [s, { totalWpm: 0, count: 0 }]));
    const domainVelocityMap = new Map(DOMAINS.map(d => [d, [] as any[]]));
    
    let totalMinutes = 0;
    let thisWeekMinutes = 0;
    let todayMinutes = 0;
    const scatter = [];
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (const log of logs) {
      const logDateStr = format(log.date, 'yyyy-MM-dd');
      const duration = log.duration;
      
      totalMinutes += duration;
      
      if (isSameDay(log.date, now)) {
        todayMinutes += duration;
      }
      
      if (isWithinInterval(log.date, { start: startOfW, end: endOfW })) {
        thisWeekMinutes += duration;
        weeklyMap.set(logDateStr, (weeklyMap.get(logDateStr) || 0) + duration);
        
        const stackedData = stackedWeeklyMap.get(logDateStr) || {};
        stackedData[log.category] = (stackedData[log.category] || 0) + duration / 60;
        stackedWeeklyMap.set(logDateStr, stackedData);
      }
      
      if (isWithinInterval(log.date, { start: startOfM, end: endOfM })) {
        monthlyMap.set(logDateStr, (monthlyMap.get(logDateStr) || 0) + duration);
      }
      
      // Contribution data (last 365 days)
      const startOfContribution = subDays(now, 364);
      if (isWithinInterval(log.date, { start: startOfContribution, end: now })) {
        contributionMap.set(logDateStr, (contributionMap.get(logDateStr) || 0) + duration);
      }
      
      if (categoryMap.has(log.category)) {
        categoryMap.set(log.category, categoryMap.get(log.category)! + duration);
      }
      
      const catUpper = log.category.toUpperCase();
      for (const subject of baseSubjects) {
        if (catUpper.includes(subject.toUpperCase())) {
          radarMap.set(subject, radarMap.get(subject)! + duration);
        }
      }
      
      const logDay = (log.date.getDay() + 6) % 7;
      const logHour = log.startTime ? parseInt(log.startTime.split(':')[0]) : -1;
      if (logHour !== -1) {
        const key = `${logDay}-${logHour}`;
        heatmapMap.set(key, (heatmapMap.get(key) || 0) + duration);
      }
      
      const [h, m] = log.startTime ? log.startTime.split(':').map(Number) : [0, 0];
      scatter.push({
        time: h + m / 60,
        rating: log.rating || 3,
        duration: log.duration,
        category: log.category
      });
    }

    for (const rLog of readingLogs) {
      const logDateStr = format(rLog.date, 'yyyy-MM-dd');
      const durationMins = Math.floor(rLog.duration / 60);
      
      totalMinutes += durationMins;
      
      if (isSameDay(rLog.date, now)) {
        todayMinutes += durationMins;
      }
      
      if (isWithinInterval(rLog.date, { start: startOfW, end: endOfW })) {
        thisWeekMinutes += durationMins;
        weeklyMap.set(logDateStr, (weeklyMap.get(logDateStr) || 0) + durationMins);
        
        const stackedData = stackedWeeklyMap.get(logDateStr) || {};
        const readingCat = 'VARC';
        stackedData[readingCat] = (stackedData[readingCat] || 0) + durationMins / 60;
        stackedWeeklyMap.set(logDateStr, stackedData);
      }
      
      if (isWithinInterval(rLog.date, { start: startOfM, end: endOfM })) {
        monthlyMap.set(logDateStr, (monthlyMap.get(logDateStr) || 0) + durationMins);
      }
      
      const startOfContribution = subDays(now, 364);
      if (isWithinInterval(rLog.date, { start: startOfContribution, end: now })) {
        contributionMap.set(logDateStr, (contributionMap.get(logDateStr) || 0) + durationMins);
      }

      const subject = 'VARC';
      const current = readingRadarMap.get(subject)!;
      readingRadarMap.set(subject, {
        totalWpm: current.totalWpm + rLog.wpm,
        count: current.count + 1
      });

      const domainLogs = domainVelocityMap.get(rLog.domain) || [];
      domainLogs.push(rLog);
      domainVelocityMap.set(rLog.domain, domainLogs);
      
      categoryMap.set('VARC', (categoryMap.get('VARC') || 0) + durationMins);
    }
    
    const weeklyData = weekDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const minutes = weeklyMap.get(dateStr) || 0;
      return {
        name: format(day, 'EEE'),
        minutes,
        hours: (minutes / 60).toFixed(1)
      };
    });

    const monthlyData = monthDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      return {
        name: format(day, 'd'),
        minutes: monthlyMap.get(dateStr) || 0
      };
    });

    const categoryData = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value, color: getCategoryColor(name) }))
      .filter(item => item.value > 0);

    const stackedWeeklyData = weekDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const data = { name: format(day, 'EEE'), ...stackedWeeklyMap.get(dateStr) };
      return data;
    });

    const radarData = baseSubjects.map(subject => {
      return {
        subject,
        A: radarMap.get(subject)! / 60,
        fullMark: 100
      };
    });

    const readingTrendData = readingLogs.slice().reverse().map(log => {
      const entry: any = {
        date: format(log.date, 'MMM dd'),
        wpm: log.wpm,
        target: 350
      };
      // Add domain specific data for trend juctaposition
      entry[log.domain] = log.wpm;
      return entry;
    });

    const heatmapData = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        heatmapData.push({ day: days[d], hour: h, value: heatmapMap.get(`${d}-${h}`) || 0 });
      }
    }

    const contributionData = eachDayOfInterval({ start: subDays(now, 364), end: now }).map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      return {
        date: dateStr,
        count: contributionMap.get(dateStr) || 0
      };
    });

    let cumulative = 0;
    const burnupData = monthDays.map((day, index) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      cumulative += monthlyMap.get(dateStr) || 0;
      return {
        name: format(day, 'd'),
        actual: parseFloat((cumulative / 60).toFixed(1)),
        target: parseFloat(((index + 1) * goals.daily / 60).toFixed(1))
      };
    });

    return {
      weeklyData,
      monthlyData,
      categoryData,
      stackedWeeklyData,
      radarData,
      heatmapData,
      contributionData,
      burnupData,
      scatterData: scatter,
      stats: {
        totalHours: (totalMinutes / 60).toFixed(1),
        weekHours: (thisWeekMinutes / 60).toFixed(1),
        todayHours: (todayMinutes / 60).toFixed(1),
        avgDaily: (logs.length + readingLogs.length) > 0 ? (totalMinutes / 60 / 30).toFixed(1) : "0",
        goalMetDays: weeklyData.filter(d => parseFloat(d.hours) >= (goals.daily / 60)).length
      },
      readingTrendData
    };
  }, [logs, readingLogs, categories, goals.daily]);

  // Destructure optimized analytics
  const { 
    weeklyData, monthlyData, categoryData, stackedWeeklyData, 
    radarData, heatmapData, scatterData, stats, contributionData, burnupData,
    readingTrendData
  } = analytics;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center transition-colors duration-300">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-8 text-center border border-slate-100 dark:border-zinc-800">
          <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Target className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">CAT Prep Tracker</h1>
          <p className="text-slate-500 dark:text-zinc-400 mb-8">Master your preparation with data-driven insights. Log your study hours and track your progress.</p>
          <button
            onClick={handleLogin}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-200 dark:shadow-none"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" alt="Google" className="w-6 h-6 bg-white rounded-full p-1" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col lg:flex-row transition-colors duration-300">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-colors text-slate-600 dark:text-zinc-400"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">CAT Tracker</span>
        </div>
        <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-slate-200 dark:border-zinc-800" />
      </header>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex flex-col z-[60] transition-transform duration-300 transform lg:translate-x-0 lg:static lg:inset-auto",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900 dark:text-white">CAT Tracker</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-colors text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors",
              activeTab === 'dashboard' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors",
              activeTab === 'log' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
            )}
          >
            <Plus className="w-5 h-5" />
            Log Study Time
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors",
              activeTab === 'history' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
            )}
          >
            <History className="w-5 h-5" />
            History
          </button>
          <button
            onClick={() => setActiveTab('timer')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors",
              activeTab === 'timer' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
            )}
          >
            <Clock className="w-5 h-5" />
            Timer Mode
          </button>
          <button
            onClick={() => setActiveTab('reading')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors",
              activeTab === 'reading' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
            )}
          >
            <Gauge className="w-5 h-5" />
            Active Reading (RVE)
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors",
              activeTab === 'settings' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
            )}
          >
            <SettingsIcon className="w-5 h-5" />
            Goals & Settings
          </button>
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-4 border border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tighter">Live Sync Active</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tighter">{streak} Day Streak</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">Your study data is automatically synchronized across all your devices in real-time.</p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Header Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                      <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Total Hours</p>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalHours}h</h3>
                    </div>
                  </div>
                  <div className="h-1 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, (parseFloat(stats.totalHours) / 100) * 100)}%` }}></div>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
                      <Award className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Current Streak</p>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{streak} Days</h3>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">Keep it up! Consistency is key.</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
                      <Target className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Daily Goal</p>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.todayHours} / {(goals.daily / 60).toFixed(1)}h</h3>
                    </div>
                  </div>
                  <div className="h-1 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (parseFloat(stats.todayHours) / (goals.daily / 60)) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Weekly Goal</p>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.weekHours} / {(goals.weekly / 60).toFixed(1)}h</h3>
                    </div>
                  </div>
                  <div className="h-1 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (parseFloat(stats.weekHours) / (goals.weekly / 60)) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Stacked Weekly Progress */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Weekly Balance
                    </h3>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stackedWeeklyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={resolvedTheme === 'dark' ? '#27272a' : '#f1f5f9'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: resolvedTheme === 'dark' ? '#71717a' : '#64748b', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: resolvedTheme === 'dark' ? '#71717a' : '#64748b', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#18181b' : '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', color: resolvedTheme === 'dark' ? '#fff' : '#000' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        {categories.map((cat) => (
                          <Bar key={cat} dataKey={cat} stackId="a" fill={getCategoryColor(cat)} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Radar Chart - Subject Balance */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Subject Mastery
                    </h3>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                        <PolarGrid stroke={resolvedTheme === 'dark' ? '#27272a' : '#f1f5f9'} />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: resolvedTheme === 'dark' ? '#71717a' : '#64748b', fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                        <Radar name="Study Volume" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                        <Tooltip contentStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#18181b' : '#fff', borderRadius: '12px', border: 'none' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Velocity Trendline */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Gauge className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Velocity Trendline (WPM)
                    </h3>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={readingTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={resolvedTheme === 'dark' ? '#27272a' : '#f1f5f9'} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: resolvedTheme === 'dark' ? '#71717a' : '#64748b', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: resolvedTheme === 'dark' ? '#71717a' : '#64748b', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#18181b' : '#fff', borderRadius: '12px', border: 'none' }} />
                        <Legend verticalAlign="top" height={36}/>
                        <Line type="monotone" dataKey="wpm" name="Aggregate Speed" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="Philosophy" name="Philosophy" stroke="#ef4444" strokeWidth={1} dot={false} connectNulls />
                        <Line type="monotone" dataKey="Economics" name="Economics" stroke="#f59e0b" strokeWidth={1} dot={false} connectNulls />
                        <Line type="monotone" dataKey="Sociology" name="Sociology" stroke="#10b981" strokeWidth={1} dot={false} connectNulls />
                        <Line type="monotone" dataKey="Technology" name="Technology" stroke="#3b82f6" strokeWidth={1} dot={false} connectNulls />
                        <Line type="monotone" dataKey="target" name="Target Trajectory" stroke="#94a3b8" strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Donut Chart - 30 Day Split */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      30-Day Distribution
                    </h3>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#18181b' : '#fff', borderRadius: '12px', border: 'none' }} />
                        <Legend iconType="circle" layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Scatter Plot - Focus vs Time */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Star className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Focus Efficiency
                    </h3>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={resolvedTheme === 'dark' ? '#27272a' : '#f1f5f9'} />
                        <XAxis type="number" dataKey="time" name="Time of Day" unit="h" domain={[0, 24]} tick={{ fill: resolvedTheme === 'dark' ? '#71717a' : '#64748b', fontSize: 12 }} />
                        <YAxis type="number" dataKey="rating" name="Focus" domain={[0, 5]} tick={{ fill: resolvedTheme === 'dark' ? '#71717a' : '#64748b', fontSize: 12 }} />
                        <ZAxis type="number" dataKey="duration" range={[50, 400]} name="Duration" unit="m" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#18181b' : '#fff', borderRadius: '12px', border: 'none' }} />
                        <Scatter name="Sessions" data={scatterData} fill="#6366f1" fillOpacity={0.6} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Burnup Chart - Goal Trajectory */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Goal Trajectory (Monthly)
                    </h3>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={burnupData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={resolvedTheme === 'dark' ? '#27272a' : '#f1f5f9'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: resolvedTheme === 'dark' ? '#71717a' : '#64748b', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: resolvedTheme === 'dark' ? '#71717a' : '#64748b', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: resolvedTheme === 'dark' ? '#18181b' : '#fff', borderRadius: '12px', border: 'none' }} />
                        <Legend verticalAlign="top" height={36}/>
                        <Area type="monotone" dataKey="actual" name="Cumulative Hours" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={3} />
                        <Area type="monotone" dataKey="target" name="Target Trajectory" stroke="#94a3b8" fill="transparent" strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Time-of-Day Heatmap */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Biological Study Window (Heatmap)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                      <div className="flex mb-2">
                        <div className="w-12" />
                        {Array.from({ length: 24 }).map((_, i) => (
                          <div key={i} className="flex-1 text-[8px] text-slate-400 text-center font-bold">
                            {i.toString().padStart(2, '0')}
                          </div>
                        ))}
                      </div>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dIdx) => (
                        <div key={day} className="flex items-center gap-1 mb-1">
                          <div className="w-12 text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">{day}</div>
                          {Array.from({ length: 24 }).map((_, hIdx) => {
                            const cell = heatmapData.find(h => h.day === day && h.hour === hIdx);
                            const intensity = cell ? Math.min(4, Math.floor(cell.value / 30)) : 0;
                            const colors = [
                              resolvedTheme === 'dark' ? '#18181b' : '#f1f5f9',
                              '#c7d2fe',
                              '#818cf8',
                              '#4f46e5',
                              '#312e81'
                            ];
                            return (
                              <div 
                                key={hIdx}
                                title={`${day} ${hIdx}:00 - ${cell?.value || 0}m`}
                                className="flex-1 h-6 rounded-sm transition-colors"
                                style={{ backgroundColor: colors[intensity] }}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contribution Heatmap */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Consistency Heatmap
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {contributionData.map((day, i) => {
                      const intensity = Math.min(4, Math.floor(day.count / 60));
                      const colors = [
                        resolvedTheme === 'dark' ? '#18181b' : '#f1f5f9',
                        '#c7d2fe',
                        '#818cf8',
                        '#4f46e5',
                        '#312e81'
                      ];
                      return (
                        <div 
                          key={day.date}
                          title={`${day.date}: ${day.count}m`}
                          className="w-3 h-3 rounded-sm transition-colors"
                          style={{ backgroundColor: colors[intensity] }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-4 text-[10px] text-slate-400 uppercase font-bold">
                    <span>Less</span>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="w-2 h-2 rounded-sm" style={{ backgroundColor: [resolvedTheme === 'dark' ? '#18181b' : '#f1f5f9', '#c7d2fe', '#818cf8', '#4f46e5', '#312e81'][i] }} />
                      ))}
                    </div>
                    <span>More</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'log' && (
            <div className="max-w-2xl mx-auto bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
              <h2 className="text-2xl font-bold mb-6 dark:text-white">{editingLogId ? 'Edit Study Log' : 'Log Study Time'}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Category</label>
                    <select 
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Date</label>
                    <input 
                      type="date" 
                      value={date} 
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Start Time</label>
                    <input 
                      type="time" 
                      value={startTime} 
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">End Time</label>
                    <input 
                      type="time" 
                      value={endTime} 
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Notes</label>
                  <textarea 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    placeholder="What did you study?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Focus Rating (1-5)</label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRating(r)}
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center font-bold transition-all",
                          rating === r 
                            ? "bg-indigo-600 text-white" 
                            : "bg-slate-50 dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {formError && <p className="text-red-500 text-sm">{formError}</p>}
                <div className="flex gap-4">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {editingLogId ? 'Update Log' : 'Save Log'}
                  </button>
                  {editingLogId && (
                    <button 
                      type="button" 
                      onClick={() => setEditingLogId(null)}
                      className="px-8 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold py-4 rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold dark:text-white">Unified Learning History</h2>
                <div className="flex gap-4">
                  <button 
                    onClick={downloadCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors dark:text-white"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Category/Domain</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Duration</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Performance</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {[
                      ...logs.map(l => ({ ...l, logType: 'Study' as const })),
                      ...readingLogs.map(l => ({ ...l, logType: 'Reading' as const, category: l.domain, duration: Math.floor(l.duration / 60), notes: l.comprehensionSummary }))
                    ].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)).map((item, idx) => (
                      <tr key={`${item.id || idx}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-zinc-400">{item.date ? format(item.date, 'MMM d, yyyy') : 'Invalid Date'}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-3 py-1 text-xs font-bold rounded-full",
                            item.logType === 'Study' ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          )}>
                            {item.logType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium dark:text-zinc-300">{item.category}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-zinc-400">{item.duration} mins</td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-zinc-500">
                          {item.logType === 'Reading' ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{(item as any).wpm} WPM</span>
                              <span className="text-[10px] truncate max-w-[120px] italic">{(item as any).notes}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">{(item as any).rating || 3}/5 Focus</span>
                              <span className="text-[10px] truncate max-w-[120px] italic">{(item as any).notes}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {item.logType === 'Study' && (
                              <button onClick={() => handleEdit(item as StudyLog)} className="p-2 text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"><Plus className="w-4 h-4" /></button>
                            )}
                            <button 
                              onClick={() => {
                                if (item.logType === 'Study') handleDelete(item.id);
                                else {
                                  // Add reading log delete if needed, for now just placeholder
                                  if (window.confirm('Delete this reading log?')) {
                                    deleteDoc(doc(db, 'users', user!.uid, 'readingLogs', item.id));
                                  }
                                }
                              }} 
                              className="p-2 text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'timer' && (
            <div className="max-w-4xl mx-auto">
              <TimerCard logs={logs} />
            </div>
          )}

          {activeTab === 'reading' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                  <Gauge className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold dark:text-white">Reading Velocity Engine</h1>
                  <p className="text-slate-500 dark:text-zinc-400">VARC Module • Accelerated Comprehension & Processing</p>
                </div>
              </div>
              <ReadingVelocityEngine userId={user.uid} />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                <h2 className="text-2xl font-bold mb-6 dark:text-white">Appearance</h2>
                <div className="grid grid-cols-3 gap-4">
                  {(['light', 'dark', 'system'] as Theme[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                        theme === t 
                          ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400" 
                          : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-600"
                      )}
                    >
                      {t === 'light' && <Sun className="w-6 h-6" />}
                      {t === 'dark' && <Moon className="w-6 h-6" />}
                      {t === 'system' && <Monitor className="w-6 h-6" />}
                      <span className="text-sm font-bold capitalize">{t}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                <h2 className="text-2xl font-bold mb-6 dark:text-white">Study Goals</h2>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Daily Goal (Minutes)</label>
                    <input 
                      type="number" 
                      value={goals.daily} 
                      onChange={(e) => setDoc(doc(db, 'users', user.uid, 'settings', 'goals'), { ...goals, daily: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Weekly Goal (Minutes)</label>
                    <input 
                      type="number" 
                      value={goals.weekly} 
                      onChange={(e) => setDoc(doc(db, 'users', user.uid, 'settings', 'goals'), { ...goals, weekly: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                <h2 className="text-2xl font-bold mb-6 dark:text-white">Categories</h2>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCategoryName} 
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="New category name"
                      className="flex-1 p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                    <button 
                      onClick={handleAddCategory}
                      className="px-6 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <div key={cat} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-full group">
                        <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">{cat}</span>
                        <button 
                          onClick={() => handleRemoveCategory(cat)}
                          className="text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-xl">
                    <SettingsIcon className="w-6 h-6 text-slate-600 dark:text-zinc-400" />
                  </div>
                  <h2 className="text-2xl font-bold dark:text-white">Data Management</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <FileJson className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <h3 className="font-bold dark:text-white">Export Logs</h3>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6 flex-grow">
                      Download all your study logs as a JSON file. This is perfect for backups or migrating to a new device.
                    </p>
                    <button 
                      onClick={handleExportJSON}
                      className="w-full py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export JSON
                    </button>
                  </div>

                  <div className="p-6 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h3 className="font-bold dark:text-white">Import Logs</h3>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6 flex-grow">
                      Migrate your data from a previous version or restore a backup. This will append logs to your current list.
                    </p>
                    <label className="block cursor-pointer">
                      <div className={cn(
                        "w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2",
                        isImporting && "opacity-50 cursor-not-allowed"
                      )}>
                        {isImporting ? (
                          <RotateCcw className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileUp className="w-4 h-4" />
                        )}
                        {isImporting ? "Importing..." : "Import JSON"}
                      </div>
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={handleImportJSON} 
                        className="hidden" 
                        disabled={isImporting}
                      />
                    </label>
                    {importError && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">{importError}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-zinc-800">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Log?</h3>
            <p className="text-slate-500 dark:text-zinc-400 mb-8">This action cannot be undone. Are you sure you want to delete this study log?</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
