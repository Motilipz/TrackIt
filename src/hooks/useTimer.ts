import { useState, useEffect, useRef, useCallback } from 'react';
import { TimerMode, TimerStatus, TimerSettings } from '../types';

export const useTimer = (initialSettings: TimerSettings) => {
  const [settings, setSettings] = useState<TimerSettings>(initialSettings);
  const [mode, setMode] = useState<TimerMode>('focus');
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [timeLeft, setTimeLeft] = useState(settings.focusTime * 60);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overtimeSeconds, setOvertimeSeconds] = useState(0);
  const [marathonSection, setMarathonSection] = useState<'VARC' | 'DILR' | 'QA' | null>(null);
  
  // Deadman Switch States
  const [deadmanTarget, setDeadmanTarget] = useState<number>(() => Math.floor(Math.random() * (55 * 60 - 45 * 60 + 1)) + 45 * 60);
  const [deadmanPromptActive, setDeadmanPromptActive] = useState(false);
  const [deadmanPromptSecsLeft, setDeadmanPromptSecsLeft] = useState(180);
  const [deadmanVerified, setDeadmanVerified] = useState(false);
  const [deadmanFailed, setDeadmanFailed] = useState(false);

  const resetDeadman = useCallback(() => {
    setDeadmanTarget(Math.floor(Math.random() * (55 * 60 - 45 * 60 + 1)) + 45 * 60);
    setDeadmanPromptActive(false);
    setDeadmanPromptSecsLeft(180);
    setDeadmanVerified(false);
    setDeadmanFailed(false);
  }, []);

  const verifyPresence = useCallback(() => {
    setDeadmanPromptActive(false);
    setDeadmanVerified(true);
    setDeadmanPromptSecsLeft(180);
  }, []);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync timeLeft with settings when idle or when mode/settings change
  useEffect(() => {
    if (status === 'idle') {
      if (settings.marathonMode) {
        setMode('marathon');
        setMarathonSection('VARC');
        setTimeLeft(40 * 60);
      } else if (settings.mockMode) {
        setMode('mock');
        setTimeLeft(settings.mockTime * 60);
      } else {
        if (mode === 'focus') setTimeLeft(settings.focusTime * 60);
        else if (mode === 'break') setTimeLeft(settings.breakTime * 60);
        else if (mode === 'long-break') setTimeLeft(settings.longBreakTime * 60);
        else if (mode === 'mock') setTimeLeft(settings.mockTime * 60);
        else if (mode === 'marathon') {
          setMarathonSection('VARC');
          setTimeLeft(40 * 60);
        }
      }
    }
  }, [
    status, 
    mode, 
    settings.marathonMode, 
    settings.mockMode, 
    settings.focusTime, 
    settings.breakTime, 
    settings.longBreakTime, 
    settings.mockTime
  ]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('idle');
    setOvertimeSeconds(0);
    setElapsedTime(0);
    setMarathonSection(null);
    resetDeadman();
    
    if (settings.marathonMode) {
      setMode('marathon');
      setMarathonSection('VARC');
      setTimeLeft(40 * 60);
    } else if (settings.mockMode) {
      setMode('mock');
      setTimeLeft(settings.mockTime * 60);
    } else {
      setMode('focus');
      setTimeLeft(settings.focusTime * 60);
    }
  }, [settings, resetDeadman]);

  const startTimer = () => {
    if (status === 'running') return;
    setStatus('running');
  };

  const pauseTimer = (force = false) => {
    if (!force && settings.strictMode && status === 'running') return;
    setStatus('paused');
  };

  const toggleTimer = (force = false) => {
    if (status === 'running') pauseTimer(force);
    else startTimer();
  };

  const saveSession = () => {
    resetTimer();
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (status === 'running' || status === 'overtime') {
      interval = setInterval(() => {
        // Increment elapsedTime inside callback to be precise
        setElapsedTime((prev) => {
          const nextVal = prev + 1;
          
          // 1. Biological Threshold check (180:01 is 10801 seconds)
          if (nextVal >= 10801) {
            setStatus('paused');
          }
          
          // 2. Deadman Switch start condition (random interval between min 45 and 55, i.e., 2700-3300 seconds)
          const isStudyMode = mode === 'focus' || mode === 'mock' || mode === 'marathon';
          if (isStudyMode && nextVal === deadmanTarget && !deadmanVerified && !deadmanFailed) {
            setDeadmanPromptActive(true);
          }
          
          return nextVal;
        });

        // Decrement Deadman counter if active
        setDeadmanPromptActive((isActive) => {
          if (isActive) {
            setDeadmanPromptSecsLeft((secs) => {
              if (secs <= 1) {
                setDeadmanFailed(true);
                setStatus('paused'); // timer halts
                return 0;
              }
              return secs - 1;
            });
          }
          return isActive;
        });

        if (status === 'running') {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              // Timer reached zero
              if (settings.marathonMode) {
                if (marathonSection === 'VARC') {
                  setMarathonSection('DILR');
                  return 40 * 60;
                } else if (marathonSection === 'DILR') {
                  setMarathonSection('QA');
                  return 40 * 60;
                } else {
                  setStatus('overtime');
                  return 0;
                }
              }

              if (settings.mockMode) {
                setStatus('overtime');
                return 0;
              }
              
              if (mode === 'focus') {
                if (settings.autoFlow) {
                  const nextSessionCount = sessionsCompleted + 1;
                  setSessionsCompleted(nextSessionCount);
                  const isLongBreak = nextSessionCount % 4 === 0 && nextSessionCount !== 0;
                  setMode(isLongBreak ? 'long-break' : 'break');
                  return (isLongBreak ? settings.longBreakTime : settings.breakTime) * 60;
                } else {
                  setStatus('overtime');
                  return 0;
                }
              } else {
                if (settings.autoFlow) {
                  setMode('focus');
                  return settings.focusTime * 60;
                } else {
                  setStatus('idle');
                  return 0;
                }
              }
            }
            return prev - 1;
          });
        } else if (status === 'overtime') {
          setOvertimeSeconds((prev) => prev + 1);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, mode, settings, sessionsCompleted, marathonSection, deadmanTarget, deadmanPromptActive, deadmanVerified, deadmanFailed]);

  const completeSession = (
    rating: number, 
    notes: string, 
    category: string,
    takeaways?: string,
    sillyMistakes?: string,
    strategicTag?: string
  ) => {
    const newCount = mode === 'focus' ? sessionsCompleted + 1 : sessionsCompleted;
    setSessionsCompleted(newCount);
    
    // In a real app, we'd save these to Firebase/DB here
    console.log('Session Completed with:', { rating, notes, category, takeaways, sillyMistakes, strategicTag });
    
    if (settings.autoFlow && !settings.marathonMode) {
      if (mode === 'focus') {
        const isLongBreak = newCount % 4 === 0 && newCount !== 0;
        setMode(isLongBreak ? 'long-break' : 'break');
        setTimeLeft((isLongBreak ? settings.longBreakTime : settings.breakTime) * 60);
        setStatus('running');
      } else {
        setMode('focus');
        setTimeLeft(settings.focusTime * 60);
        setStatus('running');
      }
    } else {
      resetTimer();
    }
  };

  return {
    timeLeft,
    overtimeSeconds,
    mode,
    status,
    sessionsCompleted,
    elapsedTime,
    marathonSection,
    settings,
    setSettings,
    startTimer,
    pauseTimer,
    toggleTimer,
    resetTimer,
    completeSession,
    setMode,
    setStatus,
    deadmanTarget,
    deadmanPromptActive,
    deadmanPromptSecsLeft,
    deadmanVerified,
    deadmanFailed,
    verifyPresence,
    changeMode: (newMode: TimerMode) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setMode(newMode);
      setStatus('idle');
      setOvertimeSeconds(0);
      setElapsedTime(0);
      resetDeadman();
      if (newMode === 'focus') setTimeLeft(settings.focusTime * 60);
      else if (newMode === 'break') setTimeLeft(settings.breakTime * 60);
      else if (newMode === 'long-break') setTimeLeft(settings.longBreakTime * 60);
      else if (newMode === 'mock') setTimeLeft(settings.mockTime * 60);
      else if (newMode === 'marathon') {
        setMarathonSection('VARC');
        setTimeLeft(40 * 60);
      }
    }
  };
};
