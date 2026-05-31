import React, { useState, useEffect } from 'react';
import { 
  Play, Plus, CheckCircle2, Circle, Trash2, Calendar, Zap, 
  Award, Edit3, X, Save, Clock, ChevronUp, ChevronDown, 
  GripVertical, Sparkles, AlertOctagon, HelpCircle, BarChart2, Shield 
} from 'lucide-react';
import { format } from 'date-fns';
import { DailyTask } from '../types';

// Simple class utility helper
const cn = (...classes: (string | undefined | null | boolean)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface ActionPlanViewProps {
  categories: string[];
  dailyTasks: DailyTask[];
  onAddTask: (title: string, category: string, isFrog: boolean, estimatedDuration: number) => Promise<void>;
  onToggleTask: (task: DailyTask, proofOfWork?: string) => Promise<void>;
  onPlayTask: (task: DailyTask) => void;
  onDeleteTask: (task: DailyTask) => Promise<void>;
  onReorderTasks: (reorderedTasks: DailyTask[]) => Promise<void>;
  onReconcileTask: (task: DailyTask, reason: string) => Promise<void>;
}

const ROUTINE_TEMPLATES = [
  { title: "Read 2 Aeon Essays", category: "VARC", estimatedDuration: 45 },
  { title: "Solve 15 Arithmetic Problems", category: "QA", estimatedDuration: 60 },
  { title: "Practice 3 DILR Sets", category: "DILR", estimatedDuration: 90 },
  { title: "Master 50 Flashcards", category: "VARC", estimatedDuration: 30 },
  { title: "Attempt Sectional Mini-Mock", category: "Mock", estimatedDuration: 45 }
];

const REASON_LABELS: Record<string, string> = {
  underestimated_time: "Underestimated Time",
  burnout: "Low Energy / Burnout",
  distraction: "Distraction",
  unexpected_event: "Unexpected Event"
};

const SUGGESTIONS: Record<string, string> = {
  underestimated_time: "Apply the 'Rule of 1.5x' – multiply your initial time estimates by 1.5 to cushion against planning fallacies.",
  burnout: "Introduce scheduled recovery blocks, sleep checks, or demote non-core tasks. Protect your primary focus pool.",
  distraction: "Implement 100% distraction blocking. Turn off notifications, use deep work containers, or study at off-peak hours.",
  unexpected_event: "Buffer your day with a 65-minute 'Float Block'. An unscheduled time slot preserves your sequence when chaos strikes."
};

export const ActionPlanView: React.FC<ActionPlanViewProps> = ({
  categories,
  dailyTasks,
  onAddTask,
  onToggleTask,
  onPlayTask,
  onDeleteTask,
  onReorderTasks,
  onReconcileTask,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('QA');
  const [estimatedDuration, setEstimatedDuration] = useState<number>(60);
  const [isFrog, setIsFrog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Templates state
  const [showTemplates, setShowTemplates] = useState(false);

  // Milestone Countdown state
  const [milestoneDate, setMilestoneDate] = useState<string>(() => {
    const saved = localStorage.getItem('simcat_milestone_date');
    if (saved) return saved;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const formatted = format(futureDate, 'yyyy-MM-dd');
    localStorage.setItem('simcat_milestone_date', formatted);
    return formatted;
  });
  
  const [milestoneLabel, setMilestoneLabel] = useState<string>(() => {
    const saved = localStorage.getItem('simcat_milestone_label');
    if (saved) return saved;
    localStorage.setItem('simcat_milestone_label', 'SimCAT');
    return 'SimCAT';
  });

  const [isEditingMilestone, setIsEditingMilestone] = useState(false);
  const [editMilestoneDate, setEditMilestoneDate] = useState(milestoneDate);
  const [editMilestoneLabel, setEditMilestoneLabel] = useState(milestoneLabel);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Reconciliation state
  const [reconciliationReasons, setReconciliationReasons] = useState<Record<string, string>>({});
  const [isReconciling, setIsReconciling] = useState(false);

  // Live countdown tick
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Proof of work modal state
  const [completingTask, setCompletingTask] = useState<DailyTask | null>(null);
  const [proofText, setProofText] = useState('');

  // Subject choices
  const subjectChoices = ['QA', 'DILR', 'VARC', 'Mock'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const durationVal = Math.max(1, Math.min(1440, Number(estimatedDuration) || 60));
      await onAddTask(title, category, isFrog, durationVal);
      setTitle('');
      setIsFrog(false);
      setEstimatedDuration(60);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveMilestone = () => {
    localStorage.setItem('simcat_milestone_date', editMilestoneDate);
    localStorage.setItem('simcat_milestone_label', editMilestoneLabel);
    setMilestoneDate(editMilestoneDate);
    setMilestoneLabel(editMilestoneLabel);
    setIsEditingMilestone(false);
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Overdue and Today's task list calculations
  const overdueTasks = dailyTasks.filter(t => t.date < todayStr && t.status === 'pending');
  const todayTasks = dailyTasks
    .filter((t) => t.date === todayStr)
    .sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return aTime - bTime;
    });

  const frogTask = todayTasks.find((t) => t.is_frog);

  // Durations & Progress metrics
  const totalMins = todayTasks.reduce((acc, t) => acc + (t.estimatedDuration || 0), 0);
  const doneMins = todayTasks.filter(t => t.status === 'done').reduce((acc, t) => acc + (t.estimatedDuration || 0), 0);

  const totalHrs = (totalMins / 60).toFixed(1);
  const doneHrs = (doneMins / 60).toFixed(1);

  // Time Debt calculation
  const failedTasks = dailyTasks.filter(t => t.status === 'failed');
  const failedMins = failedTasks.reduce((acc, t) => acc + (t.estimatedDuration || 0), 0);
  const failedHrs = (failedMins / 60).toFixed(1);

  // Post-Mortem distribution analytics
  const counts: Record<string, number> = {
    underestimated_time: 0,
    burnout: 0,
    distraction: 0,
    unexpected_event: 0
  };
  failedTasks.forEach(t => {
    if (t.failureReason && counts[t.failureReason] !== undefined) {
      counts[t.failureReason] = counts[t.failureReason] + 1;
    }
  });
  const totalFailures = failedTasks.length;

  let topReason = '';
  let maxCount = -1;
  Object.entries(counts).forEach(([reason, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topReason = reason;
    }
  });
  const currentSuggestion = SUGGESTIONS[topReason] || "Set granular goals and stay accountable. Every small patch repairs yesterday's execution leak.";

  // Live countdown calculations
  const getMilestoneCountdown = () => {
    const target = new Date(milestoneDate + 'T00:00:00');
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) {
      return "0 Days (Goal!)";
    }
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return `${diffDays} Days`;
  };

  const handleToggleClick = (task: DailyTask) => {
    if (task.status === 'pending') {
      setCompletingTask(task);
      setProofText('');
    } else {
      onToggleTask(task, '');
    }
  };

  const handleConfirmCompletion = async () => {
    if (!completingTask) return;
    await onToggleTask(completingTask, proofText.trim());
    setCompletingTask(null);
    setProofText('');
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    // Swap items in memory and notify parent
    const items = [...todayTasks];
    const draggedItem = items[draggedIndex];
    items.splice(draggedIndex, 1);
    items.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    onReorderTasks(items);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Arrow chronological triggers
  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return;
    const items = [...todayTasks];
    const temp = items[idx];
    items[idx] = items[idx - 1];
    items[idx - 1] = temp;
    await onReorderTasks(items);
  };

  const handleMoveDown = async (idx: number) => {
    if (idx === todayTasks.length - 1) return;
    const items = [...todayTasks];
    const temp = items[idx];
    items[idx] = items[idx + 1];
    items[idx + 1] = temp;
    await onReorderTasks(items);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      
      {/* Premium Stats Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* FROG CARD */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Today's Focus Log (Frog)</p>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
              {frogTask ? frogTask.title : 'No Frog Selected Yet'}
            </h3>
          </div>
          {frogTask ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-4 flex items-center gap-1.5 font-medium animate-pulse">
              <span>🐸</span> PEAK POWER BLOCK ACTIVE (18:00 - 24:00)
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5 font-medium">
              <span>🐸</span> Unlocking peak evening deep work window
            </p>
          )}
        </div>

        {/* TIME BAR PROGRESS */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Hours Planned vs. Executed</p>
            <div className="flex items-baseline justify-between">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                {doneHrs}h <span className="text-slate-400 dark:text-zinc-600 font-medium text-lg">/ {totalHrs}h</span>
              </h3>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                {todayTasks.filter(t => t.status === 'done').length}/{todayTasks.length} Done
              </span>
            </div>
          </div>
          
          <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mt-3">
            <div 
              className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-500"
              style={{ width: `${totalMins ? (doneMins / totalMins) * 100 : 0}%` }}
            />
          </div>

          {/* Time Debt Accountability Ledger Row */}
          {Number(failedHrs) > 0 && (
            <div className="mt-3.5 pt-2.5 border-t border-red-50/50 dark:border-zinc-800/80 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 dark:text-rose-400 flex items-center gap-1">
                ⚠️ Current Deficit
              </span>
              <span className="text-xs font-black text-white bg-red-600 dark:bg-rose-600 px-2.5 py-0.5 rounded-md shadow-sm">
                -{failedHrs} hrs
              </span>
            </div>
          )}
        </div>

        {/* INTERACTIVE MACRO countdown WIDGET */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-between relative group">
          {isEditingMilestone ? (
            <div className="space-y-3 z-10 bg-white dark:bg-zinc-900">
              <input 
                type="text" 
                value={editMilestoneLabel} 
                onChange={(e) => setEditMilestoneLabel(e.target.value)}
                placeholder="SimCAT name"
                className="w-full text-xs p-1 bg-slate-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded dark:text-white font-medium"
              />
              <input 
                type="date" 
                value={editMilestoneDate} 
                onChange={(e) => setEditMilestoneDate(e.target.value)}
                className="w-full text-xs p-1 bg-slate-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded dark:text-white"
              />
              <div className="flex gap-2">
                <button 
                  onClick={handleSaveMilestone}
                  className="flex-1 py-1 text-[10px] uppercase font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700"
                >
                  Save
                </button>
                <button 
                  onClick={() => setIsEditingMilestone(false)}
                  className="flex-1 py-1 text-[10px] uppercase font-bold text-slate-500 bg-slate-100 dark:bg-zinc-800 rounded hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 fill-red-500 animate-pulse text-red-500" /> MACRO URGENCY WATCH
                  </p>
                  <button 
                    onClick={() => {
                      setEditMilestoneDate(milestoneDate);
                      setEditMilestoneLabel(milestoneLabel);
                      setIsEditingMilestone(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity p-0.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-500 flex items-center justify-between">
                  {getMilestoneCountdown()}
                </h3>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-4 font-bold flex items-center gap-1 uppercase tracking-wide">
                <span>🎯</span> Until {milestoneLabel}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Input Bar Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-100 dark:border-zinc-800 shadow-sm relative">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold dark:text-white text-slate-900">Add Today's Action</h2>
          
          {/* Quick Add Routine Templates dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-indigo-50 hover:bg-indigo-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-indigo-600 dark:text-indigo-400 transition-colors border border-indigo-100 dark:border-zinc-700"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse" />
              Quick Add Routine
            </button>
            
            {showTemplates && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1.5 duration-150">
                <div className="px-4 py-1.5 border-b border-rose-50/10 dark:border-zinc-800 mb-1.5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Choose a Routine Template</p>
                </div>
                {ROUTINE_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTitle(tmpl.title);
                      setCategory(tmpl.category);
                      setEstimatedDuration(tmpl.estimatedDuration);
                      setShowTemplates(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-indigo-50/40 dark:hover:bg-zinc-800/80 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {tmpl.title}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {tmpl.category} • {tmpl.estimatedDuration} mins
                      </span>
                    </div>
                    <Plus className="w-3 h-3 text-slate-350 dark:text-zinc-650 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-center">
          
          {/* What needs to be done text input */}
          <div className="flex-1 w-full">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-750 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            />
          </div>

          {/* Subject dropdown */}
          <div className="w-full md:w-36">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-750 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              {subjectChoices.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          </div>

          {/* EST MINUTES INPUT */}
          <div className="w-full md:w-40 flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-750 px-3 py-1.5 rounded-xl">
            <Clock className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
            <div className="flex flex-col flex-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Est. Mins</span>
              <input
                type="number"
                required
                min={1}
                max={1440}
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(Math.max(1, Number(e.target.value)))}
                className="w-full bg-transparent border-none text-sm dark:text-white focus:outline-none focus:ring-0 p-0 font-bold"
              />
            </div>
          </div>

          {/* Frog Checkbox */}
          <label className="flex items-center gap-3 cursor-pointer select-none py-2 px-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors shrink-0">
            <input
              type="checkbox"
              checked={isFrog}
              onChange={(e) => setIsFrog(e.target.checked)}
              className="sr-only"
            />
            <div className={cn(
              "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
              isFrog 
                ? 'bg-emerald-600 border-emerald-600 dark:border-emerald-500 text-white shadow-sm' 
                : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
            )}>
              {isFrog && <span className="text-[10px] font-bold">✓</span>}
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1">
              Is this the Frog? 🐸
            </span>
          </label>

          {/* Button: Add Task */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </form>
      </div>

      {/* Task Board Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold dark:text-white text-slate-900 flex items-center gap-2">
            Task Board
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded-full">
              {todayTasks.length} Planned
            </span>
          </h2>
          <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
        </div>

        {todayTasks.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-dashed border-slate-200 dark:border-zinc-800 p-12 rounded-3xl text-center space-y-3">
            <div className="text-4xl text-slate-300">🌱</div>
            <h3 className="font-bold text-slate-700 dark:text-zinc-300">No action items planned today</h3>
            <p className="text-slate-400 dark:text-zinc-500 text-sm max-w-md mx-auto">
              Plan out today's study block above. Be intentional, choose your highest priority task (Frog) and crush it. Order daily items sequentially by dragging rows!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayTasks.map((task, idx) => {
              const isFrogTask = task.is_frog;
              return (
                <div
                  key={task.id}
                  draggable={task.status !== 'done'}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white dark:bg-zinc-900 border rounded-2xl transition-all shadow-sm gap-4",
                    isFrogTask
                      ? 'border-emerald-500 dark:border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/25 bg-emerald-50/10 dark:bg-emerald-950/5'
                      : 'border-slate-105 dark:border-zinc-800',
                    draggedIndex === idx ? 'opacity-40 scale-95 border-indigo-200 bg-indigo-50/10' : ''
                  )}
                >
                  {/* Left reorder grab handles & checkable title */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    
                    {/* Visual drag handle and tiny up/down mobile buttons */}
                    {task.status !== 'done' && (
                      <div className="flex items-center gap-1 self-center shrink-0 pr-1 select-none">
                        <span className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded transition-colors text-slate-300 dark:text-zinc-600">
                          <GripVertical size={14} />
                        </span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            className="p-0.5 text-slate-300 dark:text-zinc-600 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-20 shrink-0"
                            title="Move task up chronological order"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx === todayTasks.length - 1}
                            className="p-0.5 text-slate-300 dark:text-zinc-600 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-20 shrink-0"
                            title="Move task down chronological order"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleToggleClick(task)}
                      className="text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none mt-1 shrink-0"
                    >
                      {task.status === 'done' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-6 h-6 shrink-0" />
                      )}
                    </button>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn(
                          "font-bold transition-all text-base",
                          task.status === 'done' 
                            ? 'line-through text-slate-400 dark:text-zinc-600 font-medium' 
                            : 'text-slate-800 dark:text-zinc-100'
                        )}>
                          {task.title}
                        </p>
                        {isFrogTask && (
                          <span className="text-[10px] bg-emerald-500 text-white uppercase tracking-widest px-2 py-0.5 rounded-md font-black flex items-center gap-1 shadow-sm ring-1 ring-emerald-400">
                            🐸 PEAK WINDOW 
                          </span>
                        )}
                      </div>
                      
                      {/* Meta stats tags */}
                      <div className="flex items-center gap-2">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-800/40 px-2 py-0.5 rounded">
                          {task.category}
                        </span>
                        <span className="inline-block text-[10px] font-bold text-indigo-500 uppercase tracking-wide bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded">
                          ⏱️ {task.estimatedDuration || 60} mins
                        </span>
                      </div>

                      {/* Display the Proof of Work summary if complete */}
                      {task.status === 'done' && task.proofOfWork && (
                        <div className="mt-2 text-xs bg-slate-50 dark:bg-zinc-800/30 p-2.5 rounded-lg border border-dashed border-slate-200 dark:border-zinc-800/80 text-slate-500 dark:text-zinc-400 italic">
                          <span className="font-bold uppercase text-[9px] not-italic text-slate-400 dark:text-zinc-500 block mb-0.5 animate-pulse">Proof of Work Tagged Takeaway:</span>
                          “{task.proofOfWork}”
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right hand controls: Play and Delete */}
                  <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                    {task.status !== 'done' && (
                      <button
                        onClick={() => onPlayTask(task)}
                        title="Load into Live Chrono-Timer Module"
                        className="p-3 bg-indigo-55 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 rounded-xl transition-all"
                      >
                        <Play className="w-4 h-4 fill-current animate-pulse" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteTask(task)}
                      className="p-3 text-slate-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Failure Post-Mortem Analytics card */}
      {failedTasks.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-red-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Failure Post-Mortem Analytics</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                Analysis of behavioral leaks across <span className="font-semibold text-red-500 dark:text-rose-450">{totalFailures} historical overdue tasks</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Left Column: Categorized reason counts */}
            <div className="space-y-3.5">
              {Object.entries(counts).map(([reason, count]) => {
                const pct = totalFailures > 0 ? (count / totalFailures) * 100 : 0;
                return (
                  <div key={reason} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600 dark:text-zinc-400">{REASON_LABELS[reason] || reason}</span>
                      <span className="font-mono text-slate-500 font-medium">{count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          pct > 40 ? "bg-red-500" : pct > 20 ? "bg-amber-500" : "bg-indigo-500"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Behavioral Actionable Recommend Box */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-950/20 border border-dashed border-slate-200 dark:border-zinc-850 rounded-2xl flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1 flex items-center gap-1">
                  <Sparkles size={11} className="text-amber-500 fill-amber-500" /> Actionable Patch Recommendation
                </p>
                <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 mb-2">
                  Leak: Primarily derailed by <span className="text-red-500 dark:text-rose-400">"{REASON_LABELS[topReason] || topReason || 'No data yet'}"</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed italic">
                  “{currentSuggestion}”
                </p>
              </div>
              <p className="text-[10px] font-semibold text-slate-400 mt-4">
                Refine the next planning block to repair and patch behavioral leaks.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PROOF OF WORK CHECK-OFF MODAL CLIENT WINDOW */}
      {completingTask && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-500 animate-bounce" /> Proof of Work
              </h3>
              <button 
                onClick={() => setCompletingTask(null)}
                className="p-1 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6 leading-relaxed">
              To complete <span className="font-bold dark:text-white">"{completingTask.title}"</span> and cement real retention, log a brief takeaway, crucial insight, or proof of execution.
            </p>

            <textarea
              required
              rows={3}
              maxLength={200}
              placeholder="e.g., Captured 3 key test cases under 12 mins. Understood conditional matrices better."
              value={proofText}
              onChange={(e) => setProofText(e.target.value)}
              className="w-full text-sm p-4 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder-slate-400 mb-6"
            />

            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => setCompletingTask(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleConfirmCompletion}
                disabled={!proofText.trim() || isSubmitting}
                className="flex-1 py-3 bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 dark:shadow-none"
              >
                Crush Task 🐸
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP FAILURE POST-MORTEM RECONCILIATION MODAL */}
      {overdueTasks.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-red-100 dark:border-zinc-850 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden my-auto">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4 mb-5">
              <div className="w-10 h-10 bg-red-50 dark:bg-zinc-800 rounded-xl flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5 text-red-500 animate-bounce" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                  Failure Post-Mortem (Reconciliation)
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  You have pending actions that expired uncaught at midnight. Categorize defaults to patch behavioral leaks.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
              {overdueTasks.map((task) => (
                <div key={task.id} className="p-4 bg-slate-50 dark:bg-zinc-950/30 border border-slate-150 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 sm:max-w-[65%] min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">
                        {task.title}
                      </span>
                      {task.is_frog && (
                        <span className="text-[8px] bg-emerald-500 text-white uppercase tracking-widest px-1.5 py-0.5 rounded font-black shrink-0">
                          🐸 Frog
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                      Planned on {task.date} • {task.category} • {task.estimatedDuration} mins
                    </p>
                  </div>

                  <div className="shrink-0 w-full sm:w-56">
                    <select
                      value={reconciliationReasons[task.id] || ''}
                      onChange={(e) => setReconciliationReasons(prev => ({ ...prev, [task.id]: e.target.value }))}
                      className="w-full text-xs p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 dark:text-white font-medium"
                      required
                    >
                      <option value="" disabled>Select reason...</option>
                      <option value="underestimated_time">Underestimated Time</option>
                      <option value="burnout">Low Energy / Burnout</option>
                      <option value="distraction">Distraction</option>
                      <option value="unexpected_event">Unexpected Event</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider leading-none">
                All {overdueTasks.length} Overdue defaults must be categorized
              </span>
              <button 
                type="button"
                onClick={async () => {
                  const allSelected = overdueTasks.every(t => reconciliationReasons[t.id]);
                  if (!allSelected) return;
                  setIsReconciling(true);
                  try {
                    for (const task of overdueTasks) {
                      const reason = reconciliationReasons[task.id];
                      await onReconcileTask(task, reason);
                    }
                  } catch (err) {
                    console.error("Failed to batch reconcile", err);
                  } finally {
                    setIsReconciling(false);
                  }
                }}
                disabled={!overdueTasks.every(t => reconciliationReasons[t.id]) || isReconciling}
                className="px-6 py-3 bg-red-650 hover:bg-red-700 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center gap-2"
              >
                {isReconciling ? "Saving Post-Mortem..." : "Commit Reconciliation & Archive"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
