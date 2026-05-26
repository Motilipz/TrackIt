import React, { useState, useEffect } from 'react';
import { Play, Plus, CheckCircle2, Circle, Trash2, Calendar, Zap, Award, Edit3, X, Save, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { DailyTask } from '../types';

interface ActionPlanViewProps {
  categories: string[];
  dailyTasks: DailyTask[];
  onAddTask: (title: string, category: string, isFrog: boolean, estimatedDuration: number) => Promise<void>;
  onToggleTask: (task: DailyTask, proofOfWork?: string) => Promise<void>;
  onPlayTask: (task: DailyTask) => void;
  onDeleteTask: (task: DailyTask) => Promise<void>;
}

export const ActionPlanView: React.FC<ActionPlanViewProps> = ({
  categories,
  dailyTasks,
  onAddTask,
  onToggleTask,
  onPlayTask,
  onDeleteTask,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('QA');
  const [estimatedDuration, setEstimatedDuration] = useState<number>(60);
  const [isFrog, setIsFrog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Milestone Countdown state
  const [milestoneDate, setMilestoneDate] = useState<string>(() => {
    const saved = localStorage.getItem('simcat_milestone_date');
    if (saved) return saved;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    return format(futureDate, 'yyyy-MM-dd');
  });
  
  const [milestoneLabel, setMilestoneLabel] = useState<string>(() => {
    return localStorage.getItem('simcat_milestone_label') || 'SimCAT';
  });

  const [isEditingMilestone, setIsEditingMilestone] = useState(false);
  const [editMilestoneDate, setEditMilestoneDate] = useState(milestoneDate);
  const [editMilestoneLabel, setEditMilestoneLabel] = useState(milestoneLabel);

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
  const todayTasks = dailyTasks.filter((t) => t.date === todayStr);
  const frogTask = todayTasks.find((t) => t.is_frog);

  // Durations & Progress metrics
  const totalMins = todayTasks.reduce((acc, t) => acc + (t.estimatedDuration || 0), 0);
  const doneMins = todayTasks.filter(t => t.status === 'done').reduce((acc, t) => acc + (t.estimatedDuration || 0), 0);

  const totalHrs = (totalMins / 60).toFixed(1);
  const doneHrs = (doneMins / 60).toFixed(1);

  // Live countdown calculations
  const getMilestoneCountdown = () => {
    const target = new Date(milestoneDate + 'T00:00:00');
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) {
      return "0 Days (Target Reached!)";
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

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
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
          <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mt-4">
            <div 
              className="bg-indigo-600 dark:bg-indigo-500 h-full transition-all duration-500"
              style={{ width: `${totalMins ? (doneMins / totalMins) * 100 : 0}%` }}
            />
          </div>
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
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-100 dark:border-zinc-800 shadow-sm">
        <h2 className="text-xl font-bold mb-4 dark:text-white text-slate-900">Add Today's Action</h2>
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-center">
          
          {/* What needs to be done text input */}
          <div className="flex-1 w-full">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            />
          </div>

          {/* Subject dropdown */}
          <div className="w-full md:w-36">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              {subjectChoices.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          </div>

          {/* EST MINUTES INPUT */}
          <div className="w-full md:w-40 flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1.5 rounded-xl">
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
            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
              isFrog 
                ? 'bg-emerald-600 border-emerald-600 dark:border-emerald-500 text-white shadow-sm' 
                : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
            }`}>
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
              Plan out today's study block above. Be intentional, choose your highest priority task (Frog) and crush it.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayTasks.map((task) => {
              const isFrogTask = task.is_frog;
              return (
                <div
                  key={task.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white dark:bg-zinc-900 border rounded-2xl transition-all shadow-sm gap-4 ${
                    isFrogTask
                      ? 'border-emerald-500 dark:border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/25 bg-emerald-50/10 dark:bg-emerald-950/5'
                      : 'border-slate-100 dark:border-zinc-800'
                  }`}
                >
                  {/* Checkbox and info block */}
                  <div className="flex items-start gap-4 flex-1">
                    <button
                      onClick={() => handleToggleClick(task)}
                      className="text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none mt-0.5"
                    >
                      {task.status === 'done' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-500 shrink-0" />
                      ) : (
                        <Circle className="w-6 h-6 shrink-0" />
                      )}
                    </button>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-bold transition-all text-base ${
                          task.status === 'done' 
                            ? 'line-through text-slate-400 dark:text-zinc-600 font-medium' 
                            : 'text-slate-800 dark:text-zinc-100'
                        }`}>
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

                      {/* Display the Proof of Work summary beautifully if complete */}
                      {task.status === 'done' && task.proofOfWork && (
                        <div className="mt-2 text-xs bg-slate-50 dark:bg-zinc-800/30 p-2.5 rounded-lg border border-dashed border-slate-200 dark:border-zinc-800/80 text-slate-500 dark:text-zinc-400 italic">
                          <span className="font-bold uppercase text-[9px] not-italic text-slate-400 block mb-0.5">Proof of Work (Takeaway):</span>
                          “{task.proofOfWork}”
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right hand controls: Play and Delete */}
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {task.status !== 'done' && (
                      <button
                        onClick={() => onPlayTask(task)}
                        title="Load into Timer Mode"
                        className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 rounded-xl transition-all"
                      >
                        <Play className="w-4 h-4 fill-current" />
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

      {/* PROOF OF WORK CHECK-OFF MODAL */}
      {completingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
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
    </div>
  );
};
