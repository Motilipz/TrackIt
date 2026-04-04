import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Play, Pause, RotateCcw, Save, Settings as SettingsIcon, X, Star, AlertTriangle, Maximize2, SkipForward, Shield, Zap, CloudRain, Trees, Waves, Music, Link, Volume1, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTimer } from '../hooks/useTimer';
import { Session, TimerSettings } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const AMBIENT_SOUNDS = [
  { id: 'none', name: 'None', icon: VolumeX },
  { id: 'white', name: 'White Noise', icon: Music, url: 'https://actions.google.com/sounds/v1/ambiences/white_noise.ogg' },
  { id: 'brown', name: 'Brown Noise', icon: Music, url: 'https://actions.google.com/sounds/v1/ambiences/brown_noise.ogg' },
  { id: 'cafe', name: 'Coffee Shop', icon: Music, url: 'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg' },
  { id: 'rain', name: 'Rain', icon: CloudRain, url: 'https://actions.google.com/sounds/v1/ambiences/rain_on_roof.ogg' },
  { id: 'forest', name: 'Forest', icon: Trees, url: 'https://actions.google.com/sounds/v1/ambiences/forest_ambience.ogg' },
  { id: 'ordinary', name: 'Ordinary', icon: Music, url: 'https://www.mobiles24.co/downloads/d/Fdho6UN9zG' },
  { id: 'custom', name: 'Custom URL', icon: Link },
];

const IRON_MIND_QUOTES = [
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "The secret of existence is not just to live, but to have something to live for.", author: "Fyodor Dostoevsky" },
  { text: "Where the willingness is great, the difficulties cannot be great.", author: "Niccolò Machiavelli" },
  { text: "That which does not kill us makes us stronger.", author: "Friedrich Nietzsche" },
  { text: "To live is to suffer, to survive is to find some meaning in the suffering.", author: "Friedrich Nietzsche" },
  { text: "The man of character finds an objective in every difficulty.", author: "Niccolò Machiavelli" },
  { text: "Pain is inevitable. Suffering is optional.", author: "Haruki Murakami" },
  { text: "The more we do, the more we can do.", author: "William Hazlitt" }
];

const STRATEGIC_TAGS = [
  "High-Value Strength",
  "Critical Weakness",
  "Defensive Area",
  "Competitive Edge",
  "Conceptual Gap",
  "Speed Bottleneck"
];

export const TimerCard = () => {
  const [initialSettings] = useState<TimerSettings>({
    autoFlow: false,
    strictMode: false,
    mockMode: false,
    marathonMode: false,
    blindMode: false,
    focusTime: 25,
    breakTime: 5,
    longBreakTime: 20,
    mockTime: 120,
    mockSplitTime: 40,
  });

  const timer = useTimer(initialSettings);
  const [category, setCategory] = useState('QA');
  const [notes, setNotes] = useState('');
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [rating, setRating] = useState(0);
  const [abandonReason, setAbandonReason] = useState('');
  
  // Interactive Session Notes
  const [takeaways, setTakeaways] = useState('');
  const [sillyMistakes, setSillyMistakes] = useState('');
  const [strategicTag, setStrategicTag] = useState('');

  // Audio state
  const [ambientSound, setAmbientSound] = useState<string>('none');
  const [ambientVolume, setAmbientVolume] = useState(0.3);
  const [customSoundUrl, setCustomSoundUrl] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [quote, setQuote] = useState(IRON_MIND_QUOTES[0]);

  useEffect(() => {
    if (timer.status === 'idle' || timer.mode === 'break' || timer.mode === 'long-break') {
      const randomQuote = IRON_MIND_QUOTES[Math.floor(Math.random() * IRON_MIND_QUOTES.length)];
      setQuote(randomQuote);
    }
  }, [timer.status, timer.mode]);

  const exportCSV = () => {
    // This would ideally fetch from Firebase, but for now we'll use a placeholder
    // or the current session if it was just completed.
    // In a real app, we'd fetch the user's full history.
    const headers = ["Timestamp", "Duration (s)", "Category", "Notes", "Rating", "Status", "Takeaways", "Silly Mistakes", "Strategic Tag"];
    const csvContent = [headers.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `study_sessions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFocusForecasting = () => {
    // Placeholder logic for forecasting
    return "Focus is predicted to be high for the next 2 hours. Good time for QA problem-solving.";
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (ambientSound !== 'none') {
      let url = '';
      if (ambientSound === 'custom') {
        if (!customSoundUrl) return;
        url = customSoundUrl;
      } else {
        const sound = AMBIENT_SOUNDS.find(s => s.id === ambientSound);
        url = sound?.url || '';
      }

      if (url) {
        const audio = new Audio(url);
        audio.loop = true;
        audio.volume = ambientVolume;
        audio.play().catch(e => console.log('Audio play blocked', e));
        audioRef.current = audio;
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [ambientSound, customSoundUrl]);

  // Update volume without restarting audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = ambientVolume;
    }
  }, [ambientVolume]);

  // Alert chime and Mock splits
  useEffect(() => {
    if (timer.status === 'overtime' && timer.overtimeSeconds === 0) {
      const chime = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
      chime.volume = 0.5;
      chime.play().catch(e => console.log('Chime blocked', e));
    }

    // Mock split alerts
    if (timer.settings.mockMode && timer.status === 'running') {
      const splitSeconds = timer.settings.mockSplitTime * 60;
      const currentElapsed = (timer.settings.mockTime * 60) - timer.timeLeft;
      
      if (currentElapsed > 0 && currentElapsed % splitSeconds === 0) {
        const splitChime = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        splitChime.volume = 0.3;
        splitChime.play().catch(e => console.log('Split chime blocked', e));
        // Visual feedback could be added here
        console.log('Mock Split Alert!');
      }
    }
  }, [timer.status, timer.overtimeSeconds, timer.timeLeft, timer.settings.mockMode]);

  const handleSave = () => {
    if (timer.status === 'idle') return;
    setShowRatingModal(true);
  };

  const handleReset = () => {
    if (timer.status === 'running' && !timer.settings.strictMode) {
      setShowAbandonModal(true);
    } else if (timer.status !== 'running') {
      timer.resetTimer();
    }
  };

  const submitSession = () => {
    const session: Session = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      duration: timer.elapsedTime,
      category,
      notes,
      rating,
      status: timer.status === 'overtime' ? 'overtime' : 'completed',
      takeaways,
      sillyMistakes,
      strategicTag
    };
    
    // In a real app, save to DB/Localstorage
    console.log('Session Saved:', session);
    
    timer.completeSession(rating, notes, category, takeaways, sillyMistakes, strategicTag);
    setShowRatingModal(false);
    setRating(0);
    setNotes('');
    setTakeaways('');
    setSillyMistakes('');
    setStrategicTag('');
  };

  const submitAbandon = () => {
    console.log('Session Abandoned. Reason:', abandonReason);
    timer.resetTimer();
    setShowAbandonModal(false);
    setAbandonReason('');
  };

  // Picture in Picture Simulation (Condensed UI)
  const togglePiP = async () => {
    // Real PiP requires a video element. We can draw the timer to a canvas and use that.
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = document.createElement('video');
    video.muted = true;
    video.srcObject = canvas.captureStream();
    video.play();

    const updateCanvas = () => {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      const timeStr = formatTime(timer.status === 'overtime' ? timer.overtimeSeconds : timer.timeLeft);
      ctx.fillText(timeStr, canvas.width / 2, canvas.height / 2 + 15);
      
      ctx.font = '16px sans-serif';
      ctx.fillText(timer.mode.toUpperCase(), canvas.width / 2, 40);
      
      if (video.srcObject) {
        requestAnimationFrame(updateCanvas);
      }
    };
    
    updateCanvas();

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP failed', err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 p-4 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Focus Engine</h1>
          <p className="text-slate-500 dark:text-zinc-500 text-sm">Pro-Level Exam Prep Timer</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-colors border border-slate-200 dark:border-zinc-800 dark:text-white"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-6xl">
        {/* Left Sidebar - Stats Placeholder */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-slate-400 dark:text-zinc-400 mb-4 uppercase tracking-wider">Analytics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-slate-500 dark:text-zinc-500 text-sm">Daily Streak</span>
                <span className="text-2xl font-bold text-orange-500">12 Days</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '75%' }}
                  className="h-full bg-orange-500"
                />
              </div>
              
              <div className="pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 dark:text-zinc-400">QA Progress</span>
                  <span className="dark:text-white">14/20 hrs</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[70%]" />
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 dark:text-zinc-400">DILR Progress</span>
                  <span className="dark:text-white">8/15 hrs</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 w-[53%]" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-400 dark:text-zinc-400 uppercase tracking-wider">Ambient Sounds</h3>
              <div className="flex items-center gap-2">
                <Volume1 size={14} className="text-slate-400" />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={ambientVolume}
                  onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <Volume2 size={14} className="text-slate-400" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {AMBIENT_SOUNDS.map((sound) => (
                <button
                  key={sound.id}
                  onClick={() => {
                    setAmbientSound(sound.id);
                    if (sound.id === 'custom') setShowCustomInput(true);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all",
                    ambientSound === sound.id 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-none" 
                      : "bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                  )}
                >
                  <sound.icon size={14} />
                  {sound.name}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {(ambientSound === 'custom' || showCustomInput) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Paste audio URL here..."
                      value={customSoundUrl}
                      onChange={(e) => setCustomSoundUrl(e.target.value)}
                      className="flex-1 p-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                    <button 
                      onClick={() => setShowCustomInput(false)}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Supports direct links to .mp3, .ogg, .wav</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-medium text-slate-400 dark:text-zinc-400 mb-4 uppercase tracking-wider">Insights</h3>
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                  <Zap size={16} />
                  <span className="text-xs font-bold uppercase tracking-tight">Focus Forecast</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {getFocusForecasting()}
                </p>
              </div>
              
              <button 
                onClick={exportCSV}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl text-sm font-bold transition-all dark:text-white"
              >
                <Download size={16} />
                EXPORT SESSION DATA (CSV)
              </button>
            </div>
          </div>
        </div>

        {/* Main Timer Card */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div 
            layout
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col items-center"
          >
            {/* Background Glow */}
            <div className={cn(
              "absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] opacity-20 transition-colors duration-1000",
              timer.mode === 'focus' ? "bg-indigo-500" : 
              timer.mode === 'break' ? "bg-emerald-500" : 
              timer.mode === 'long-break' ? "bg-blue-500" : "bg-purple-500"
            )} />

            {/* Status & Mode */}
            <div className="w-full flex justify-between items-center mb-8 relative z-10">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  timer.status === 'running' ? "bg-green-500" : 
                  timer.status === 'overtime' ? "bg-orange-500" : "bg-slate-300 dark:bg-zinc-600"
                )} />
                <span className="text-xs font-mono uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                  {timer.mode === 'marathon' ? `Marathon: ${timer.marathonSection}` : 
                   timer.status === 'idle' ? 'Standby' : 
                   timer.status === 'overtime' ? 'Flow State' : 'Active'}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full text-[10px] font-bold uppercase tracking-tighter text-slate-500 dark:text-zinc-400">
                  {timer.mode.replace('-', ' ')}
                </div>
                <div className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-[10px] font-bold uppercase tracking-tighter text-indigo-600 dark:text-indigo-400">
                  Session {timer.sessionsCompleted + 1}
                </div>
              </div>
            </div>

            {/* Timer Display with Progress Ring */}
            <div className="relative flex items-center justify-center mb-12">
              <svg className="w-64 h-64 md:w-80 md:h-80 -rotate-90 transform">
                <circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  className="stroke-slate-100 dark:stroke-zinc-800 fill-none"
                  strokeWidth="4"
                />
                <motion.circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  className={cn(
                    "fill-none transition-colors duration-500",
                    timer.mode === 'focus' ? "stroke-indigo-500" : 
                    timer.mode === 'marathon' ? "stroke-red-500" :
                    timer.mode === 'break' ? "stroke-emerald-500" : 
                    timer.mode === 'long-break' ? "stroke-blue-500" : "stroke-purple-500"
                  )}
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ 
                    pathLength: timer.status === 'overtime' ? 1 : (timer.timeLeft / (
                      timer.mode === 'marathon' ? 40 * 60 :
                      timer.mode === 'focus' ? timer.settings.focusTime * 60 :
                      timer.mode === 'break' ? timer.settings.breakTime * 60 :
                      timer.mode === 'long-break' ? timer.settings.longBreakTime * 60 :
                      timer.settings.mockTime * 60
                    ))
                  }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {timer.settings.blindMode && timer.timeLeft > 300 && timer.status === 'running' ? (
                  <div className="text-slate-300 dark:text-zinc-700 flex flex-col items-center gap-2">
                    <Shield size={48} className="animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Blind Mode Active</span>
                  </div>
                ) : (
                  <>
                    <motion.div 
                      key={timer.status === 'overtime' ? 'over' : 'time'}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "text-6xl md:text-7xl font-mono font-bold tracking-tighter tabular-nums",
                        timer.status === 'overtime' ? "text-orange-500" : "text-slate-900 dark:text-white"
                      )}
                    >
                      {formatTime(timer.status === 'overtime' ? timer.overtimeSeconds : timer.timeLeft)}
                    </motion.div>
                    {timer.status === 'overtime' && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-orange-500/50 text-[10px] font-mono mt-1 uppercase tracking-widest"
                      >
                        + Overtime
                      </motion.div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Iron Mind Quote */}
            {(timer.status === 'idle' || timer.mode === 'break' || timer.mode === 'long-break') && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-md mb-8 relative z-10"
              >
                <p className="text-lg font-serif italic text-slate-700 dark:text-zinc-300 mb-2">"{quote.text}"</p>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">— {quote.author}</p>
              </motion.div>
            )}

            {/* Quick Toggles */}
            <div className="grid grid-cols-2 gap-4 w-full mb-8 relative z-10">
              <button 
                onClick={() => timer.setSettings({...timer.settings, strictMode: !timer.settings.strictMode})}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-2xl border transition-all",
                  timer.settings.strictMode 
                    ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400" 
                    : "bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400"
                )}
              >
                <div className="flex items-center gap-2">
                  <Shield size={16} />
                  <span className="text-xs font-bold uppercase tracking-tight">Strict</span>
                </div>
                <div className={cn("w-8 h-4 rounded-full relative transition-colors", timer.settings.strictMode ? "bg-red-500" : "bg-slate-300 dark:bg-zinc-700")}>
                  <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", timer.settings.strictMode ? "left-4.5" : "left-0.5")} />
                </div>
              </button>

              <button 
                onClick={() => timer.setSettings({...timer.settings, autoFlow: !timer.settings.autoFlow})}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-2xl border transition-all",
                  timer.settings.autoFlow 
                    ? "bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400" 
                    : "bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400"
                )}
              >
                <div className="flex items-center gap-2">
                  <Zap size={16} />
                  <span className="text-xs font-bold uppercase tracking-tight">Auto</span>
                </div>
                <div className={cn("w-8 h-4 rounded-full relative transition-colors", timer.settings.autoFlow ? "bg-indigo-500" : "bg-slate-300 dark:bg-zinc-700")}>
                  <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", timer.settings.autoFlow ? "left-4.5" : "left-0.5")} />
                </div>
              </button>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-8 relative z-10">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 ml-1">Focus Category</label>
                <input 
                  type="text" 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. QA, DILR"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 ml-1">Session Notes</label>
                <input 
                  type="text" 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What are you working on?"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors dark:text-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 w-full relative z-10">
              <button 
                onClick={handleReset}
                disabled={timer.settings.strictMode && timer.status === 'running'}
                className="p-4 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl transition-all dark:text-white"
                title="Reset Timer"
              >
                <RotateCcw size={24} />
              </button>
              
              <button 
                onClick={timer.toggleTimer}
                className={cn(
                  "flex-1 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg",
                  timer.status === 'running' 
                    ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-white" 
                    : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/20"
                )}
              >
                {timer.status === 'running' ? (
                  <>
                    <Pause fill="currentColor" size={24} />
                    {timer.settings.strictMode ? 'STRICT' : 'PAUSE'}
                  </>
                ) : (
                  <>
                    <Play fill="currentColor" size={24} />
                    {timer.status === 'idle' ? 'START' : 'RESUME'}
                  </>
                )}
              </button>

              {timer.mode !== 'focus' && timer.status === 'running' && (
                <button 
                  onClick={() => {
                    timer.setMode('focus');
                    timer.setStatus('running');
                  }}
                  className="p-4 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 rounded-2xl transition-all"
                  title="Skip Break"
                >
                  <SkipForward size={24} />
                </button>
              )}

              <button 
                onClick={handleSave}
                disabled={timer.status === 'idle'}
                className="p-4 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl transition-all dark:text-white"
                title="Save Session"
              >
                <Save size={24} />
              </button>

              <button 
                onClick={togglePiP}
                className="p-4 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-2xl transition-all dark:text-white hidden md:block"
                title="Picture in Picture"
              >
                <Maximize2 size={24} />
              </button>
            </div>
          </motion.div>

          {/* Settings Panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 overflow-hidden"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold dark:text-white">Timer Configuration</h3>
                  <button onClick={() => setShowSettings(false)} className="dark:text-white"><X size={20}/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium dark:text-white">Auto-Flow</span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">Auto transition to breaks</span>
                      </div>
                      <button 
                        onClick={() => timer.setSettings({...timer.settings, autoFlow: !timer.settings.autoFlow})}
                        className={cn("w-10 h-5 rounded-full transition-colors relative", timer.settings.autoFlow ? "bg-indigo-600" : "bg-slate-200 dark:bg-zinc-700")}
                      >
                        <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", timer.settings.autoFlow ? "left-6" : "left-1")} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium dark:text-white">Strict Mode</span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">Disable pause/cancel during session</span>
                      </div>
                      <button 
                        onClick={() => timer.setSettings({...timer.settings, strictMode: !timer.settings.strictMode})}
                        className={cn("w-10 h-5 rounded-full transition-colors relative", timer.settings.strictMode ? "bg-red-600" : "bg-slate-200 dark:bg-zinc-700")}
                      >
                        <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", timer.settings.strictMode ? "left-6" : "left-1")} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium dark:text-white">Mock Test Mode</span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">Override Pomodoro for exam simulation</span>
                      </div>
                      <button 
                        onClick={() => {
                          const newMock = !timer.settings.mockMode;
                          timer.setSettings({...timer.settings, mockMode: newMock});
                          if (newMock) {
                            timer.setMode('mock');
                            timer.setStatus('idle');
                          } else {
                            timer.setMode('focus');
                            timer.setStatus('idle');
                          }
                        }}
                        className={cn("w-10 h-5 rounded-full transition-colors relative", timer.settings.mockMode ? "bg-purple-600" : "bg-slate-200 dark:bg-zinc-700")}
                      >
                        <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", timer.settings.mockMode ? "left-6" : "left-1")} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase">Focus (Min)</span>
                        <input 
                          type="number" 
                          value={timer.settings.focusTime}
                          onChange={(e) => timer.setSettings({...timer.settings, focusTime: parseInt(e.target.value) || 1})}
                          className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase">Break (Min)</span>
                        <input 
                          type="number" 
                          value={timer.settings.breakTime}
                          onChange={(e) => timer.setSettings({...timer.settings, breakTime: parseInt(e.target.value) || 1})}
                          className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm dark:text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => {
                          const newMarathon = !timer.settings.marathonMode;
                          timer.setSettings({...timer.settings, marathonMode: newMarathon, mockMode: false});
                          if (newMarathon) {
                            timer.setMode('marathon');
                            timer.setStatus('idle');
                          } else {
                            timer.setMode('focus');
                            timer.setStatus('idle');
                          }
                        }}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                          timer.settings.marathonMode 
                            ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400" 
                            : "bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400"
                        )}
                      >
                        <Zap size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-tight">Marathon</span>
                      </button>

                      <button 
                        onClick={() => timer.setSettings({...timer.settings, blindMode: !timer.settings.blindMode})}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                          timer.settings.blindMode 
                            ? "bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-zinc-900" 
                            : "bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400"
                        )}
                      >
                        <Shield size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-tight">Blind</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase">Mock (Min)</span>
                        <input 
                          type="number" 
                          value={timer.settings.mockTime}
                          onChange={(e) => timer.setSettings({...timer.settings, mockTime: parseInt(e.target.value) || 1})}
                          className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase">Split (Min)</span>
                        <input 
                          type="number" 
                          value={timer.settings.mockSplitTime}
                          onChange={(e) => timer.setSettings({...timer.settings, mockSplitTime: parseInt(e.target.value) || 1})}
                          className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showRatingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full text-center"
            >
              <h2 className="text-2xl font-bold mb-2 dark:text-white">Session Complete!</h2>
              <p className="text-slate-400 dark:text-zinc-400 text-sm mb-8">How was your focus during this block?</p>
              
              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button 
                    key={s}
                    onClick={() => setRating(s)}
                    className={cn(
                      "p-3 rounded-xl transition-all",
                      rating >= s ? "text-yellow-500 bg-yellow-500/10" : "text-slate-300 dark:text-zinc-600 bg-slate-100 dark:bg-zinc-800"
                    )}
                  >
                    <Star fill={rating >= s ? "currentColor" : "none"} size={32} />
                  </button>
                ))}
              </div>

              <div className="space-y-4 mb-8 text-left">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1 block">Key Takeaways</label>
                  <textarea 
                    value={takeaways}
                    onChange={(e) => setTakeaways(e.target.value)}
                    placeholder="What did you learn?"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1 block">Silly Mistakes</label>
                  <textarea 
                    value={sillyMistakes}
                    onChange={(e) => setSillyMistakes(e.target.value)}
                    placeholder="Any avoidable errors?"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-sm dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none h-20 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase mb-1 block">Strategic Tag</label>
                  <div className="flex flex-wrap gap-2">
                    {STRATEGIC_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setStrategicTag(tag)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all",
                          strategicTag === tag 
                            ? "bg-indigo-600 text-white border-indigo-600" 
                            : "bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800"
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={submitSession}
                disabled={rating === 0}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold transition-all text-white"
              >
                SAVE LOG & CONTINUE
              </button>
            </motion.div>
          </div>
        )}

        {showAbandonModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full"
            >
              <div className="flex items-center gap-3 text-orange-500 mb-4">
                <AlertTriangle size={24} />
                <h2 className="text-xl font-bold">Abandon Session?</h2>
              </div>
              <p className="text-slate-400 dark:text-zinc-400 text-sm mb-6">You're ending this session early. Please select a reason for accountability.</p>
              
              <select 
                value={abandonReason}
                onChange={(e) => setAbandonReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm mb-8 focus:outline-none dark:text-white"
              >
                <option value="">Select a reason...</option>
                <option value="distracted">Got Distracted</option>
                <option value="finished">Task Finished Early</option>
                <option value="tired">Too Tired / Burnout</option>
                <option value="emergency">External Emergency</option>
              </select>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowAbandonModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-xl font-medium transition-all"
                >
                  GO BACK
                </button>
                <button 
                  onClick={submitAbandon}
                  disabled={!abandonReason}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl font-bold transition-all text-white"
                >
                  ABANDON
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
