import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Sparkles, Check, Trash2, CalendarRange, Clock, ShieldCheck } from 'lucide-react';

export interface BlueprintTask {
  title: string;
  estimatedDuration: number;
  category: string;
  isFrog?: boolean;
}

export interface DeployedTask {
  id: string;
  title: string;
  estimatedDuration: number;
  category: string;
  isFrog: boolean;
  status: 'pending' | 'done';
  deployedAt: string;
}

// 1. STANDARD_ROUTINE (Monday - Saturday)
export const STANDARD_ROUTINE: BlueprintTask[] = [
  { title: "[06:00] 15km Ruck & Audio Immersion", estimatedDuration: 180, category: "Physical/Passive", isFrog: false },
  { title: "[09:30] Core Conceptual Lecture", estimatedDuration: 120, category: "QA/LRDI/VARC", isFrog: true },
  { title: "[11:30] Quant Execution - 30 Qs", estimatedDuration: 60, category: "QA", isFrog: false },
  { title: "[14:00] Active Reading & Grammar", estimatedDuration: 60, category: "VARC", isFrog: false },
  { title: "[15:00] Deep Analysis - 2 Aeon Essays", estimatedDuration: 60, category: "VARC", isFrog: false },
  { title: "[16:20] LRDI / RC Sprint", estimatedDuration: 50, category: "Mixed", isFrog: false },
  { title: "[18:00] Vocab Active Recall", estimatedDuration: 30, category: "VARC", isFrog: false },
  { title: "[18:30] Spontaneous English / Summary Speech", estimatedDuration: 30, category: "Interview Prep", isFrog: false }
];

// 2. SUNDAY_PROTOCOL (The Reality Check)
export const SUNDAY_PROTOCOL: BlueprintTask[] = [
  { title: "[09:30] IMS Elite Mock Exam - Strict Timer", estimatedDuration: 120, category: "Exam", isFrog: true },
  { title: "[13:00] Deep-Dive Mock Analysis & Error Logging", estimatedDuration: 180, category: "Analysis", isFrog: false },
  { title: "[18:00] Weekly Board Audit Dispatch & Settle Escrow", estimatedDuration: 30, category: "Admin", isFrog: false }
];

interface RoutineDeployerProps {
  onDeployToMainPlan?: (tasks: BlueprintTask[]) => Promise<void>;
}

export const RoutineDeployer: React.FC<RoutineDeployerProps> = ({ onDeployToMainPlan }) => {
  const [tasks, setTasks] = useState<DeployedTask[]>([]);
  const [activeBlueprint, setActiveBlueprint] = useState<string | null>(null);
  const [isDeployingMain, setIsDeployingMain] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleDeployLocal = (blueprintName: 'standard' | 'sunday') => {
    const blueprint = blueprintName === 'standard' ? STANDARD_ROUTINE : SUNDAY_PROTOCOL;
    const label = blueprintName === 'standard' ? 'Standard Routine' : 'Sunday Protocol';

    // Generate unique local tasks
    const newTasks: DeployedTask[] = blueprint.map((item, index) => ({
      id: `${blueprintName}-${Date.now()}-${index}`,
      title: item.title,
      estimatedDuration: item.estimatedDuration,
      category: item.category,
      isFrog: !!item.isFrog,
      status: 'pending',
      deployedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    setTasks(newTasks);
    setActiveBlueprint(label);
    showFeedback(`Locally rendered ${label} (${blueprint.length} blocks)`);
  };

  const handleDeployToMain = async () => {
    if (!activeBlueprint || !onDeployToMainPlan) return;
    const blueprint = activeBlueprint === 'Standard Routine' ? STANDARD_ROUTINE : SUNDAY_PROTOCOL;

    try {
      setIsDeployingMain(true);
      await onDeployToMainPlan(blueprint);
      showFeedback(`Successfully injected ${activeBlueprint} into today's Action Plan!`);
    } catch (error) {
      console.error(error);
      showFeedback('Failed to inject routine into persistent plan.');
    } finally {
      setIsDeployingMain(false);
    }
  };

  const handleClearTasks = () => {
    setTasks([]);
    setActiveBlueprint(null);
  };

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const totalMinutes = tasks.reduce((sum, t) => sum + t.estimatedDuration, 0);
  const formattedHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="space-y-6" id="routine-blueprint-deployer">
      {/* Sleek Tactical Deployment Panel */}
      <div className="bg-surface border border-border-tactical rounded-3xl p-6 transition-all duration-300 relative overflow-hidden">
        
        {/* Subtle grid accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent-purple/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-accent-purple/10 rounded text-accent-purple">
                <CalendarRange size={16} />
              </span>
              <h3 className="text-sm font-black uppercase tracking-widest text-text-primary font-mono">
                ROUTINE BLUEPRINT DISPATCH
              </h3>
            </div>
            <p className="text-xs text-text-muted leading-relaxed max-w-xl">
              Instantly seed optimized, military-grade preparation schedules. Minimize planning friction and protect daily decision cycles.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center font-mono">
            <span className="text-[10px] uppercase font-black tracking-widest text-text-muted">STATUS:</span>
            <span className="text-[10px] font-black uppercase tracking-wider bg-accent-purple/10 text-accent-purple px-2 py-0.5 rounded border border-accent-purple/20">
              {activeBlueprint ? `READY - ${activeBlueprint}` : "STANDBY"}
            </span>
          </div>
        </div>

        {/* Tactical Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => handleDeployLocal('standard')}
            className="group flex flex-col items-start p-4 bg-accent-purple hover:bg-opacity-95 text-white rounded-2xl transition-all duration-300 text-left relative overflow-hidden shadow-sm hover:shadow active:scale-[0.99] border border-accent-purple/30"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-purple-200 bg-white/15 px-2.5 py-0.5 rounded-full">
                MON - SAT PROTOCOL
              </span>
              <Sparkles size={14} className="text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <h4 className="font-extrabold text-base tracking-tight mb-1">
              Deploy Standard Routine
            </h4>
            <p className="text-xs text-purple-200/95 font-medium">
              8 structural blocks • 520 mins • High-intensity conceptual & physical immersion.
            </p>
          </button>

          <button
            onClick={() => handleDeployLocal('sunday')}
            className="group flex flex-col items-start p-4 bg-accent-red hover:bg-opacity-95 text-white rounded-2xl transition-all duration-300 text-left relative overflow-hidden shadow-sm hover:shadow active:scale-[0.99] border border-accent-red/30"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[10px] uppercase tracking-widest font-black text-red-200 bg-white/15 px-2.5 py-0.5 rounded-full">
                SUNDAY PROTOCOL
              </span>
              <Play size={12} className="text-white fill-current group-hover:scale-110 transition-transform" />
            </div>
            <h4 className="font-extrabold text-base tracking-tight mb-1">
              Deploy Sunday Protocol
            </h4>
            <p className="text-xs text-red-200/95 font-medium">
              3 elite blocks • 330 mins • IMS Elite Mock Exam simulation & audit reconciliation.
            </p>
          </button>
        </div>

        {/* Global Blueprint Sync Controller */}
        {activeBlueprint && onDeployToMainPlan && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 pt-4 border-t border-dashed border-border-tactical flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
              <ShieldCheck className="text-emerald-600 dark:text-emerald-400" size={16} />
              <span>Previewing <b>{activeBlueprint}</b>. Push to persistent daily plan?</span>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleClearTasks}
                className="px-3.5 py-1.5 bg-surface-elevated hover:bg-background border border-border-tactical text-text-secondary rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeployToMain}
                disabled={isDeployingMain}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5"
              >
                <Check size={13} strokeWidth={3} />
                {isDeployingMain ? "Injecting..." : "Inject to Active Plan"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Alert Notifications feedback box */}
        <AnimatePresence>
          {feedbackMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-4 left-4 right-4 bg-text-primary text-background text-xs py-2 px-4 rounded-xl font-bold flex items-center justify-between shadow-lg border border-border-tactical/20"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span>{feedbackMessage}</span>
              </div>
              <button onClick={() => setFeedbackMessage(null)} className="text-[10px] uppercase tracking-wider font-black hover:underline opacity-80">
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rendered Blueprint Tasks List Preview */}
      <AnimatePresence mode="popLayout">
        {tasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-widest font-black text-text-muted font-mono flex items-center gap-1.5">
                <span>⚡</span> {activeBlueprint} PREVIEW ({tasks.length} BLOCKS • {formattedHours} HOURS)
              </h4>
              <button
                onClick={handleClearTasks}
                className="text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-accent-red flex items-center gap-1 transition-colors"
                title="Clear local preview"
              >
                <Trash2 size={11} /> Clear Preview
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {tasks.map((task, idx) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0, transition: { delay: idx * 0.05 } }}
                  exit={{ opacity: 0, x: 10 }}
                  className={`flex items-center justify-between p-4 bg-surface border rounded-xl shadow-sm transition-all duration-300 ${
                    task.isFrog 
                      ? 'border-emerald-500 dark:border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.08)] bg-emerald-500/5' 
                      : 'border-border-tactical'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="self-center flex flex-col items-center">
                      <span className="text-[9px] font-bold text-text-muted font-mono">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-extrabold text-sm text-text-primary tracking-tight">
                          {task.title}
                        </p>
                        {task.isFrog && (
                          <span className="text-[8px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded tracking-widest uppercase flex items-center gap-0.5 shadow-sm">
                            🐸 FROG
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-[9px] font-bold uppercase text-text-muted bg-surface-elevated/50 px-1.5 py-0.5 rounded border border-border-tactical/30">
                          {task.category}
                        </span>
                        <span className="text-[9px] font-bold text-accent-purple bg-accent-purple/5 px-1.5 py-0.5 rounded border border-accent-purple/10 flex items-center gap-0.5">
                          <Clock size={10} />
                          {task.estimatedDuration} mins
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted select-none italic font-mono bg-surface-elevated px-2 py-1 rounded border border-border-tactical/25">
                    PREVIEW ONLY
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
