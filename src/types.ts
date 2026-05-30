export type TimerMode = 'focus' | 'break' | 'long-break' | 'mock' | 'marathon';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'overtime';

export interface StudyLog {
  id: string;
  userId: string;
  category: string;
  duration: number; // minutes
  date: Date;
  notes?: string;
  rating: number; // 1-5
  createdAt: Date;
  startTime?: string;
  endTime?: string;
}

export interface Session {
  id: string;
  timestamp: number;
  duration: number; // in seconds
  category: string;
  notes: string;
  rating: number; // 1-5
  status: 'completed' | 'abandoned' | 'overtime';
  abandonReason?: string;
  takeaways?: string;
  sillyMistakes?: string;
  strategicTag?: string;
}

export interface TimerSettings {
  autoFlow: boolean;
  strictMode: boolean;
  mockMode: boolean;
  marathonMode: boolean;
  blindMode: boolean;
  focusTime: number; // minutes
  breakTime: number;
  longBreakTime: number;
  mockTime: number;
  mockSplitTime: number;
}

export interface ReadingLog {
  id: string;
  userId: string;
  title: string;
  excerpt: string;
  wordCount: number;
  duration: number; // seconds
  wpm: number;
  gradeLevel: number;
  comprehensionSummary: string;
  domain: string;
  date: Date;
  createdAt: Date;
}

export interface DailyTask {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: string;
  is_frog: boolean;
  status: 'pending' | 'done' | 'failed';
  failureReason?: 'underestimated_time' | 'burnout' | 'distraction' | 'unexpected_event' | string;
  estimatedDuration: number; // in minutes
  proofOfWork?: string;
  order?: number;
  createdAt: Date;
}
