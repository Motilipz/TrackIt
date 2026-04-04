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
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('idle');
    setOvertimeSeconds(0);
    setElapsedTime(0);
    setMarathonSection(null);
    
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
  }, [settings]);

  const startTimer = () => {
    if (status === 'running') return;
    setStatus('running');
  };

  const pauseTimer = () => {
    if (settings.strictMode && status === 'running') return;
    setStatus('paused');
  };

  const toggleTimer = () => {
    if (status === 'running') pauseTimer();
    else startTimer();
  };

  const saveSession = () => {
    resetTimer();
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (status === 'running' || status === 'overtime') {
      interval = setInterval(() => {
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
          setElapsedTime((prev) => prev + 1);
        } else if (status === 'overtime') {
          setOvertimeSeconds((prev) => prev + 1);
          setElapsedTime((prev) => prev + 1);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status, mode, settings, sessionsCompleted, marathonSection]);

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
    setStatus
  };
};
