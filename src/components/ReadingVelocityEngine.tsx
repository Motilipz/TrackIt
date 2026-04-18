import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, RotateCcw, Save, Trash2, 
  Zap, Clock, BookOpen, FileText, BarChart3, 
  History, Settings as SettingsIcon, Shield,
  ChevronRight, Brain, Gauge, Info
} from 'lucide-react';
import { db, collection, addDoc, Timestamp, setDoc, doc } from '../firebase';
import { ReadingLog } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DOMAINS = ['Philosophy', 'Economics', 'Sociology', 'Science', 'Literature', 'History', 'Technology', 'Other'];

const countSyllables = (word: string) => {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const vowels = word.match(/[aeiouy]{1,2}/g);
  return vowels ? vowels.length : 1;
};

const calculateFleschKincaid = (text: string) => {
  const wordsArray = text.trim().split(/\s+/).filter(w => w.length > 0);
  const words = wordsArray.length;
  if (words === 0) return 0;
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
  const syllables = wordsArray.reduce((acc, word) => acc + countSyllables(word), 0);
  
  // Formula: 0.39 * (total words / total sentences) + 11.8 * (syllables / words) - 15.59
  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
};

const BionicText = ({ text }: { text: string }) => {
  return (
    <div className="leading-relaxed whitespace-pre-wrap">
      {text.split(/\s+/).map((word, i) => {
        const boldLength = Math.max(1, Math.ceil(word.length * 0.45));
        const boldPart = word.substring(0, boldLength);
        const rest = word.substring(boldLength);
        return (
          <span key={i} className="mr-1 inline-block">
            <span className="font-bold text-slate-900 dark:text-white">{boldPart}</span>
            <span className="text-slate-600 dark:text-zinc-400">{rest}</span>
          </span>
        );
      })}
    </div>
  );
};

interface RVEProps {
  userId: string;
}

export const ReadingVelocityEngine: React.FC<RVEProps> = ({ userId }) => {
  const [inputText, setInputText] = useState('');
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState(DOMAINS[0]);
  const [isReading, setIsReading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [summary, setSummary] = useState('');
  const [bionicEnabled, setBionicEnabled] = useState(false);
  
  // Timer State
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Metrics
  const words = inputText.trim().split(/\s+/).filter(w => w.length > 0).length;
  const chars = inputText.length;
  const gradeLevel = calculateFleschKincaid(inputText);

  useEffect(() => {
    if (isReading && !isPaused) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isReading, isPaused]);

  const handleTextSelection = async () => {
    if (!isReading) return;
    const selection = window.getSelection()?.toString().trim();
    if (selection && selection.length > 0 && selection.length < 50) {
      if (window.confirm(`Add "${selection}" to vocabulary repository?`)) {
        try {
          await addDoc(collection(db, 'users', userId, 'vocabulary'), {
            term: selection,
            sourceTitle: title || 'Reading Session',
            domain,
            date: Timestamp.now(),
            createdAt: Timestamp.now()
          });
        } catch (error) {
          console.error('Error saving vocabulary:', error);
        }
      }
    }
  };

  const startReading = () => {
    if (inputText.trim().length === 0) return;
    setIsReading(true);
    setIsDone(false);
    setSeconds(0);
  };

  const finishReading = () => {
    setIsReading(false);
    setIsPaused(false);
    setIsDone(true);
  };

  const resetEngine = () => {
    setIsReading(false);
    setIsDone(false);
    setSeconds(0);
    setInputText('');
    setTitle('');
    setSummary('');
  };

  const saveLog = async () => {
    if (!isDone || summary.trim().length < 10) return;
    
    const minutes = Math.max(seconds, 1) / 60;
    const wpm = Math.round(words / minutes);

    try {
      await addDoc(collection(db, 'users', userId, 'readingLogs'), {
        userId,
        title: title || 'Untitled Excerpt',
        excerpt: inputText,
        wordCount: words,
        duration: seconds,
        wpm,
        gradeLevel,
        comprehensionSummary: summary,
        domain,
        date: Timestamp.now(),
        createdAt: Timestamp.now()
      });
      resetEngine();
    } catch (error) {
      console.error('Error saving reading log:', error);
    }
  };

  const formatElapsedTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Pane: Reading Area */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
          {!isReading && !isDone ? (
            <div className="p-8 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <BookOpen className="w-6 h-6 text-indigo-600" />
                  Source Input
                </h2>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                    words > 500 ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"
                  )}>
                    {words} Words
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
                    Grade {gradeLevel}
                  </span>
                </div>
              </div>

              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Excerpt Title (e.g., The Republic - Book I)"
                className="w-full bg-transparent border-b border-slate-100 dark:border-zinc-800 py-3 text-lg font-medium focus:outline-none focus:border-indigo-600 transition-colors dark:text-white mb-4"
              />

              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your reading passage here..."
                className="flex-1 w-full bg-transparent resize-none focus:outline-none dark:text-zinc-300 text-lg leading-relaxed pt-4"
              />

              <div className="mt-8 flex items-center justify-between">
                <button 
                  onClick={() => setBionicEnabled(!bionicEnabled)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border",
                    bionicEnabled ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700"
                  )}
                >
                  <Shield size={14} />
                  Bionic Actuation: {bionicEnabled ? 'ON' : 'OFF'}
                </button>

                <button 
                  onClick={startReading}
                  disabled={words < 20}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all flex items-center gap-3 shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                  <Play className="w-5 h-5" />
                  INITIALIZE SESSION
                </button>
              </div>
            </div>
          ) : isReading ? (
            <div className="p-12 flex-1 relative" onMouseUp={handleTextSelection}>
              <div className={cn(
                "max-w-prose mx-auto transition-all duration-500",
                isPaused ? "blur-xl grayscale pointer-events-none opacity-20" : "blur-0"
              )}>
                <div className="mb-12 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title || 'Untitled Excerpt'}</h2>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mt-1">{domain}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setBionicEnabled(!bionicEnabled)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                        bionicEnabled ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-500"
                      )}
                    >
                      <Shield size={12} />
                      Bionic
                    </button>
                  </div>
                </div>

                <div className={cn(
                  "text-xl md:text-2xl leading-[1.8] font-serif transition-all duration-300",
                  !bionicEnabled ? "text-slate-700 dark:text-zinc-300" : ""
                )}>
                  {bionicEnabled ? (
                    <BionicText text={inputText} />
                  ) : (
                    inputText
                  )}
                </div>

                <div className="mt-16 flex justify-center">
                  <button 
                    onClick={finishReading}
                    className="group flex flex-col items-center gap-4"
                  >
                    <div className="w-20 h-20 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-200 dark:shadow-none group-hover:scale-110 transition-transform">
                      <Pause className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">MARK AS COMPLETED</span>
                  </button>
                </div>
              </div>

              {/* Pause Overlay */}
              <AnimatePresence>
                {isPaused && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md"
                  >
                    <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl">
                      <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-8 h-8 text-amber-600" />
                      </div>
                      <h3 className="text-xl font-bold dark:text-white mb-2">Reading Interrupted</h3>
                      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6 max-w-[240px]">Passage obscured to maintain processing integrity during pause.</p>
                      <button 
                        onClick={() => setIsPaused(false)}
                        className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                      >
                        RESUME PROCESSING
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="p-12 flex-1 flex flex-col items-center justify-center">
              <div className="max-w-md w-full">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center mx-auto mb-8">
                  <Brain className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-2">Comprehension Verification</h2>
                <p className="text-slate-500 text-center mb-8">Distill the core arguments and nuances of the passage to validate active retention.</p>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-2 block tracking-widest">Synthetic Summary</label>
                    <textarea 
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Summarize the key points here (min 10 characters)..."
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl px-6 py-4 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[160px] leading-relaxed"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={resetEngine}
                      className="flex-1 py-4 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                    >
                      ABANDON
                    </button>
                    <button 
                      onClick={saveLog}
                      disabled={summary.trim().length < 10}
                      className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                      ARCHIVE SESSION
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Pane: Metrics Console */}
      <div className="space-y-6">
        <div className="sticky top-8 space-y-6">
          {/* Chronometer Card */}
          <div className="bg-slate-900 dark:bg-zinc-900 rounded-3xl p-8 border border-slate-800 dark:border-zinc-800 shadow-xl text-white">
            <div className="flex items-center justify-between mb-8">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Chronometer</span>
              <div className={cn(
                "w-2 h-2 rounded-full",
                isReading ? "bg-red-500 animate-pulse" : "bg-slate-600"
              )}></div>
            </div>

            <div className="text-6xl font-mono font-bold text-center mb-8 tracking-tighter">
              {formatElapsedTime(seconds)}
            </div>

            <div className="flex gap-4 mb-8">
              <button 
                onClick={() => setIsPaused(!isPaused)}
                disabled={!isReading}
                className={cn(
                  "flex-1 py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-all",
                  isPaused ? "bg-emerald-600 text-white" : "bg-white/10 text-white hover:bg-white/20"
                )}
              >
                {isPaused ? <Play size={18} /> : <Pause size={18} />}
                {isPaused ? 'RESUME' : 'PAUSE'}
              </button>
              <button 
                onClick={resetEngine}
                className="flex-1 py-3 bg-white/5 text-slate-400 font-bold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                RESET
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Elapsed Secs</span>
                <span className="text-xl font-bold">{seconds}s</span>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Word Vol</span>
                <span className="text-xl font-bold">{words}</span>
              </div>
            </div>
          </div>

          {/* Real-time Metrics */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-slate-100 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-indigo-600" />
              Velocity Metrics
            </h3>

            <div className="space-y-8">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">Live WPM Factor</span>
                  <span className="text-xs font-bold text-indigo-600">
                    {seconds > 0 ? Math.round(words / (seconds / 60)) : 0} WPM
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (words / (Math.max(seconds, 1) / 60) / 600) * 100)}%` }}
                    className="h-full bg-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Grade Level</p>
                      <p className="text-sm font-bold dark:text-white">{gradeLevel} <span className="text-[10px] text-slate-400 font-normal">(Flesch-Kincaid)</span></p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Density Factor</p>
                      <p className="text-sm font-bold dark:text-white">{(chars / (words || 1)).toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">chars/word</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-3 block tracking-widest">Categorical Tag</label>
                <div className="flex flex-wrap gap-2">
                  {DOMAINS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDomain(d)}
                      disabled={isReading || isDone}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all",
                        domain === d 
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-none" 
                          : "bg-white dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-800 hover:border-indigo-300"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Guidelines */}
          <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-3 text-emerald-700 dark:text-emerald-400">
              <Info size={16} />
              <h4 className="text-xs font-bold uppercase tracking-widest">RVE Guideline</h4>
            </div>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 leading-relaxed">
              Target a velocity of <span className="font-bold">300+ WPM</span> for Sociology/History, and <span className="font-bold">250 WPM</span> for Philosophy. Bionic Mode helps reduce ocular Fixation time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
