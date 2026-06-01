import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Zap, Award, Sparkles, TrendingUp, Gauge, Clock, Flame, CheckCircle2, MessageSquare, Search, Crown, ArrowUp, ShieldAlert, ZapOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, collection, query, onSnapshot, doc, setDoc, Timestamp } from '../firebase';
import { ArenaRanking } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface ArenaBoardProps {
  user: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
  };
  totalHours: number;
  streak: number;
  tasksCompleted: number;
  wpm: number;
}

// Aspirational prep targets to seed into Firestore as real documents
const PREP_BOTS: ArenaRanking[] = [
  {
    userId: 'bot_99_99',
    displayName: '99.99%ile CAT Bot',
    photoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    totalHours: 320.5,
    streak: 42,
    tasksCompleted: 165,
    wpm: 450,
    lastActive: new Date()
  },
  {
    userId: 'bot_iim_ahmedabad',
    displayName: 'Shreya (Aspirational IIM-A)',
    photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    totalHours: 215.2,
    streak: 28,
    tasksCompleted: 110,
    wpm: 380,
    lastActive: new Date(Date.now() - 15 * 60 * 1000) // 15 mins ago
  },
  {
    userId: 'bot_iim_bangalore',
    displayName: 'Aman (Aspirational IIM-B)',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    totalHours: 168.0,
    streak: 19,
    tasksCompleted: 85,
    wpm: 410,
    lastActive: new Date(Date.now() - 40 * 60 * 1000) // 40 mins ago
  },
  {
    userId: 'bot_xlri',
    displayName: 'Neha (Aspirational XLRI)',
    photoURL: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
    totalHours: 112.4,
    streak: 15,
    tasksCompleted: 62,
    wpm: 345,
    lastActive: new Date(Date.now() - 2 * 3600 * 1000) // 2 hrs ago
  }
];

export const ArenaBoard = ({ user, totalHours, streak, tasksCompleted, wpm }: ArenaBoardProps) => {
  const [realRankings, setRealRankings] = useState<ArenaRanking[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [sortBy, setSortBy] = useState<'points' | 'hours' | 'streak' | 'tasks' | 'wpm'>('points');
  const [searchQuery, setSearchQuery] = useState('');
  const [nudgeStates, setNudgeStates] = useState<Record<string, boolean>>({});
  const [includeBenchmarks, setIncludeBenchmarks] = useState(true);

  // Live Sync tracking states
  interface LiveEvent {
    id: string;
    timestamp: Date;
    message: string;
    type: 'success' | 'info';
  }
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([
    {
      id: 'init_event',
      timestamp: new Date(),
      message: '✨ Replicated Arena listening to Firestore streaming snapshot updates...',
      type: 'info'
    }
  ]);
  const [flashingUsers, setFlashingUsers] = useState<Record<string, 'up' | 'down' | null>>({});
  const [timeTicker, setTimeTicker] = useState(0);

  // Periodically tick every 10s to force relative "distance-from-now" format update
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTicker(prev => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Compute points formula: (Hours * 10) + (Streak * 25) + (Tasks * 15) + (WPM / 10)
  const getScore = (item: ArenaRanking | typeof PREP_BOTS[0]) => {
    return Math.round((item.totalHours * 10) + (item.streak * 25) + (item.tasksCompleted * 15) + (item.wpm / 10));
  };

  // Read all real users' public rankings from Firestore
  useEffect(() => {
    const q = query(collection(db, 'arena_rankings'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rankings = snapshot.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          lastActive: data.lastActive?.toDate ? data.lastActive.toDate() : new Date(data.lastActive || Date.now())
        } as ArenaRanking;
      });

      setRealRankings((prevRankings) => {
        if (prevRankings.length > 0) {
          const eventsToAdd: LiveEvent[] = [];
          const flashes: Record<string, 'up' | 'down' | null> = {};
          let shouldUpdateFlashes = false;

          rankings.forEach(newCand => {
            const oldCand = prevRankings.find(r => r.userId === newCand.userId);
            if (oldCand) {
              const prevPoints = getScore(oldCand);
              const nextPoints = getScore(newCand);
              if (nextPoints > prevPoints) {
                flashes[newCand.userId] = 'up';
                shouldUpdateFlashes = true;

                if (newCand.totalHours > oldCand.totalHours) {
                  eventsToAdd.push({
                    id: `${newCand.userId}_hrs_${Date.now()}_${Math.random()}`,
                    timestamp: new Date(),
                    message: `⏱️ ${newCand.displayName} logged +${(newCand.totalHours - oldCand.totalHours).toFixed(1)}h of study session!`,
                    type: 'success'
                  });
                }
                if (newCand.tasksCompleted > oldCand.tasksCompleted) {
                  eventsToAdd.push({
                    id: `${newCand.userId}_task_${Date.now()}_${Math.random()}`,
                    timestamp: new Date(),
                    message: `✅ ${newCand.displayName} finished another verbal/quant target task!`,
                    type: 'success'
                  });
                }
                if (newCand.streak > oldCand.streak) {
                  eventsToAdd.push({
                    id: `${newCand.userId}_str_${Date.now()}_${Math.random()}`,
                    timestamp: new Date(),
                    message: `🔥 ${newCand.displayName} streak extended to ${newCand.streak} preparation days!`,
                    type: 'success'
                  });
                }
                if (newCand.wpm > oldCand.wpm) {
                  eventsToAdd.push({
                    id: `${newCand.userId}_wpm_${Date.now()}_${Math.random()}`,
                    timestamp: new Date(),
                    message: `⚡ ${newCand.displayName} optimized speed to a scorching ${newCand.wpm} words-per-minute!`,
                    type: 'success'
                  });
                }
              } else if (nextPoints < prevPoints) {
                flashes[newCand.userId] = 'down';
                shouldUpdateFlashes = true;
              }
            } else if (newCand.userId !== user.uid) {
              eventsToAdd.push({
                id: `${newCand.userId}_new_${Date.now()}`,
                timestamp: new Date(),
                message: `👋 Candidate ${newCand.displayName} joined the Real-Time Stands!`,
                type: 'info'
              });
            }
          });

          if (eventsToAdd.length > 0) {
            setTimeout(() => {
              setLiveEvents(prev => {
                const combined = [...eventsToAdd, ...prev];
                return combined.slice(0, 15);
              });
            }, 0);
          }

          if (shouldUpdateFlashes) {
            setTimeout(() => {
              setFlashingUsers(prev => ({ ...prev, ...flashes }));
              // Automatically reset flashes in 3 seconds
              setTimeout(() => {
                setFlashingUsers(prev => {
                  const cleaned = { ...prev };
                  Object.keys(flashes).forEach(uid => {
                    cleaned[uid] = null;
                  });
                  return cleaned;
                });
              }, 3000);
            }, 0);
          }
        }
        return rankings;
      });

      setDataLoaded(true);
    }, (error) => {
      console.error("Failed to read arena rankings from Firestore:", error);
      setDataLoaded(true);
    });
    return () => unsubscribe();
  }, [user.uid]);

  // Auto-seed typical competitive candidates directly as real documents under /arena_rankings/{userId} in Firestore
  useEffect(() => {
    if (!dataLoaded) return;

    PREP_BOTS.forEach(async (bot) => {
      const alreadyExists = realRankings.some(r => r.userId === bot.userId);
      if (!alreadyExists) {
        try {
          await setDoc(doc(db, 'arena_rankings', bot.userId), {
            userId: bot.userId,
            displayName: bot.displayName,
            photoURL: bot.photoURL,
            totalHours: bot.totalHours,
            streak: bot.streak,
            tasksCompleted: bot.tasksCompleted,
            wpm: bot.wpm,
            lastActive: Timestamp.fromDate(new Date(bot.lastActive))
          });
        } catch (err) {
          console.error(`Failed to seed simulated competitor ${bot.displayName} into Firestore:`, err);
        }
      }
    });
  }, [dataLoaded, realRankings]);

  // Periodic background study updates of bots directly inside Firestore database!
  // This real-time database update triggers 'onSnapshot' callbacks on all connected devices, showing true live synchronization!
  useEffect(() => {
    if (!dataLoaded || realRankings.length === 0) return;

    const interval = setInterval(async () => {
      // 35% chance each interval (every 22 seconds) to tick a random competitor doc
      if (Math.random() > 0.35) return;

      const botCandidates = realRankings.filter(r => r.userId.startsWith('bot_'));
      if (botCandidates.length === 0) return;

      const randomBot = botCandidates[Math.floor(Math.random() * botCandidates.length)];
      
      const metric = Math.random() > 0.5 ? 'hours' : 'tasks';
      let updateData: Partial<ArenaRanking> = {};
      
      if (metric === 'hours') {
        const increment = parseFloat((Math.random() * 0.3 + 0.1).toFixed(1));
        updateData = {
          totalHours: Number((randomBot.totalHours + increment).toFixed(1)),
        };
      } else {
        updateData = {
          tasksCompleted: randomBot.tasksCompleted + 1,
        };
      }

      try {
        const botRef = doc(db, 'arena_rankings', randomBot.userId);
        await setDoc(botRef, {
          ...randomBot,
          ...updateData,
          lastActive: Timestamp.now()
        });
      } catch (err) {
        console.error("Failed to update simulated competitor live doc in Firestore:", err);
      }
    }, 22000);

    return () => clearInterval(interval);
  }, [dataLoaded, realRankings]);

  // Merge, filter, and sort candidates
  const candidates = useMemo(() => {
    // 1. Incorporate real database users. Make sure currently active state of current logged-in user is either matched or updated.
    let list: ArenaRanking[] = [...realRankings];

    const currentUserExists = list.some(r => r.userId === user.uid);
    if (!currentUserExists) {
      list.push({
        userId: user.uid,
        displayName: user.displayName || 'Active Candidate (You)',
        photoURL: user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
        totalHours: totalHours,
        streak: streak,
        tasksCompleted: tasksCompleted,
        wpm: wpm,
        lastActive: new Date()
      });
    } else {
      // Keep local state in-sync with visual state instantly
      list = list.map(r => {
        if (r.userId === user.uid) {
          return {
            ...r,
            totalHours: totalHours,
            streak: streak,
            tasksCompleted: tasksCompleted,
            wpm: wpm,
            lastActive: new Date()
          };
        }
        return r;
      });
    }

    // 2. Conditionally filter out simulated benchmarks if user toggles them off
    if (!includeBenchmarks) {
      list = list.filter(r => !r.userId.startsWith('bot_'));
    }

    // Sort accordingly
    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'points') return getScore(b) - getScore(a);
      if (sortBy === 'hours') return b.totalHours - a.totalHours;
      if (sortBy === 'streak') return b.streak - a.streak;
      if (sortBy === 'tasks') return b.tasksCompleted - a.tasksCompleted;
      if (sortBy === 'wpm') return b.wpm - a.wpm;
      return 0;
    });

    return sorted;
  }, [realRankings, sortBy, user, totalHours, streak, tasksCompleted, wpm, includeBenchmarks]);

  // Filter with query
  const filteredCandidates = useMemo(() => {
    if (!searchQuery.trim()) return candidates;
    return candidates.filter(c => 
      c.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [candidates, searchQuery]);

  // Extract Podium spots (First Top 3 based on rank)
  const podium = useMemo(() => {
    return {
      first: filteredCandidates[0] || null,
      second: filteredCandidates[1] || null,
      third: filteredCandidates[2] || null,
      rest: filteredCandidates.slice(3)
    };
  }, [filteredCandidates]);

  // Compute stats for current user
  const userStats = useMemo(() => {
    const userRankVal = candidates.findIndex(c => c.userId === user.uid) + 1;
    const userPoints = Math.round((totalHours * 10) + (streak * 25) + (tasksCompleted * 15) + (wpm / 10));
    const nextRival = userRankVal > 1 ? candidates[userRankVal - 2] : null;
    const currentScore = userPoints;
    const gapToNext = nextRival ? Math.max(0, getScore(nextRival) - currentScore) : 0;

    return {
      rank: userRankVal,
      points: userPoints,
      gapToNext,
      nextRivalName: nextRival?.displayName || ''
    };
  }, [candidates, user.uid, totalHours, streak, tasksCompleted, wpm]);

  // Micro-interaction: nudge mechanism
  const triggerNudge = (rivalUserId: string) => {
    setNudgeStates(prev => ({ ...prev, [rivalUserId]: true }));
    // Automatically reset nudge feedback
    setTimeout(() => {
      setNudgeStates(prev => ({ ...prev, [rivalUserId]: false }));
    }, 2500);
  };

  const getSortTitle = () => {
    if (sortBy === 'points') return 'Arena Points';
    if (sortBy === 'hours') return 'Logged Hours';
    if (sortBy === 'streak') return 'Day Streak';
    if (sortBy === 'tasks') return 'Tasks Done';
    if (sortBy === 'wpm') return 'Velocity (WPM)';
    return '';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Interactive Title & Header Block */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-150 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
              <Sparkles className="w-3 h-3 animate-pulse" /> Competitive Mode Active
            </span>
          </div>
          <h1 className="text-3xl font-bold dark:text-white flex items-center gap-2">
            <Crown className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            The Preparation Arena
          </h1>
          <p className="text-slate-500 dark:text-zinc-400">
            Rise through public engagement standings. Master consistency, log serious volume, and clock high verbal velocities.
          </p>
        </div>

        {/* Benchmarking toggle */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Aspirational Benchmarks
          </label>
          <button
            onClick={() => setIncludeBenchmarks(!includeBenchmarks)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              includeBenchmarks ? 'bg-indigo-650' : 'bg-slate-200 dark:bg-zinc-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                includeBenchmarks ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Live Activity Ticker (Real-Time Database Stream Events) */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 overflow-hidden relative">
        <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-indigo-500" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#10b981]">
              Live Replicated Sync
            </span>
          </div>
          <div className="h-4 w-[1px] bg-slate-800 hidden md:block" />
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            Listening on real-time Firestore document snapshot triggers...
          </span>
        </div>

        {/* Dynamic Ticker slide animation */}
        <div className="w-full md:w-auto md:flex-1 max-w-xl overflow-hidden relative flex justify-center md:justify-end">
          <div className="h-6 overflow-hidden">
            <AnimatePresence mode="popLayout">
              {liveEvents.slice(0, 1).map((evt) => (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-100 whitespace-nowrap overflow-hidden text-ellipsis text-center md:text-right"
                >
                  <span className="text-indigo-400 font-mono text-[9px] uppercase tracking-wider bg-indigo-950 px-2 py-0.5 rounded-full border border-indigo-900/60 shrink-0">
                    JUST NOW
                  </span>
                  <span className="truncate max-w-[280px] sm:max-w-md">{evt.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* User Standing & High Contrast Metrics Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 bg-gradient-to-tr from-indigo-50/50 via-white to-slate-50 dark:from-indigo-950/20 dark:via-zinc-900 dark:to-zinc-900/50 p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-zinc-800/80 shadow-md">
        
        {/* User Card */}
        <div className="flex items-center gap-4 lg:col-span-1 border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-zinc-800 pb-4 lg:pb-0 lg:pr-6">
          <img 
            src={user.photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
            alt="User avatar" 
            className="w-14 h-14 rounded-full border-2 border-indigo-500"
          />
          <div>
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Your Position</span>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate max-w-[150px]">
              {user.displayName || 'Active Candidate'}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-slate-500 dark:text-zinc-500">Live Standings</span>
            </div>
          </div>
        </div>

        {/* Standings highlight: RANK */}
        <div className="flex flex-col justify-center px-4">
          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-yellow-500" /> Rank Ranking
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
              #{userStats.rank > 0 ? userStats.rank : realRankings.length + 1}
            </span>
            <span className="text-xs text-slate-400">out of {candidates.length}</span>
          </div>
        </div>

        {/* Arena Points calculated */}
        <div className="flex flex-col justify-center px-4">
          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-indigo-500 animate-bounce" /> Total Standing Points
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-extrabold text-indigo-650 dark:text-indigo-400 font-mono">
              {userStats.points.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">AP</span>
          </div>
        </div>

        {/* Deficit To Next standing */}
        <div className="flex flex-col justify-center px-4 border-t lg:border-t-0 border-slate-100 dark:border-zinc-800 pt-4 lg:pt-0">
          {userStats.gapToNext > 0 ? (
            <>
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                <ArrowUp className="w-3.5 h-3.5 text-emerald-500" /> Gap to overtake
              </span>
              <div className="mt-1">
                <span className="text-sm font-bold text-slate-800 dark:text-zinc-250">
                  {userStats.gapToNext} points
                </span>
                <p className="text-[10px] text-slate-450 truncate">
                  needed to pass <span className="font-semibold text-indigo-500">{userStats.nextRivalName}</span>
                </p>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs font-bold text-slate-500 dark:text-yellow-400 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-yellow-500" /> Supreme Leader
              </span>
              <div className="mt-1">
                <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                  Rank #1 Unrivaled
                </span>
                <p className="text-[10px] text-slate-450">
                  You are leading the public CAT preparation standings. Keep pushing!
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bento Layout: Interactive Podium (Top 3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end mt-4">
        
        {/* Silver Medal (2nd Rank) */}
        {podium.second && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`order-2 md:order-1 bg-white dark:bg-zinc-900 border p-6 rounded-3xl flex flex-col items-center hover:shadow-lg transition-all relative ${
              podium.second.userId === user.uid ? 'ring-2 ring-indigo-500/80 bg-indigo-50/10' : ''
            } ${flashingUsers[podium.second.userId] === 'up' ? 'ring-2 ring-emerald-500 bg-emerald-500/5' : 'border-slate-100 dark:border-zinc-800'}`}
          >
            <div className="absolute top-4 left-4 bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-500 dark:text-zinc-400">
              Rank #2
            </div>
            
            <div className="relative mt-2">
              <img src={podium.second.photoURL} alt={podium.second.displayName} className="w-18 h-18 rounded-full border-4 border-slate-300" />
              <div className="absolute bottom-0 right-0 bg-slate-300 text-slate-850 w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shadow-sm">
                2
              </div>
            </div>

            <h4 className="font-bold text-slate-900 dark:text-white mt-4 truncate max-w-full text-center">
              {podium.second.displayName} {podium.second.userId === user.uid && '(You)'}
            </h4>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 mt-0.5">
              Refined Runner-Up
            </span>

            {/* Score points badge */}
            <div className="mt-4 px-4 py-1.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-center w-full">
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono flex items-center justify-center gap-1">
                <span>{getScore(podium.second).toLocaleString()} pts</span>
                {flashingUsers[podium.second.userId] === 'up' && (
                  <span className="text-emerald-500 text-[10px] font-bold animate-bounce mt-0.5">▲</span>
                )}
              </div>
              <div className="text-[9px] text-slate-450 uppercase font-bold tracking-tighter mt-0.5 flex justify-center gap-2">
                <span>{podium.second.totalHours.toFixed(1)}h</span>
                <span>•</span>
                <span>{podium.second.streak} days</span>
                <span>•</span>
                <span>{podium.second.wpm} WPM</span>
              </div>
            </div>
            
            {podium.second.userId !== user.uid && (
              <button 
                onClick={() => triggerNudge(podium.second!.userId)}
                className={`mt-4 text-xs font-bold px-3 py-1.5 rounded-full transition-all w-full flex items-center justify-center gap-1.5 ${
                  nudgeStates[podium.second.userId]
                    ? 'bg-emerald-500 text-white'
                    : 'bg-indigo-50 dark:bg-indigo-950/35 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100'
                }`}
              >
                {nudgeStates[podium.second.userId] ? (
                  <>🎯 Challenge Dispatched!</>
                ) : (
                  <>📣 Nudge Candidate</>
                )}
              </button>
            )}
          </motion.div>
        )}

        {/* Gold Medal (1st Rank - Centered & Tall) */}
        {podium.first && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }}
            className={`order-1 md:order-2 bg-gradient-to-b from-amber-500/10 to-transparent bg-white dark:bg-zinc-900 p-8 rounded-3xl flex flex-col items-center shadow-lg relative transition-all border-2 ${
              podium.first.userId === user.uid ? 'ring-2 ring-indigo-500 bg-indigo-50/10' : ''
            } ${flashingUsers[podium.first.userId] === 'up' ? 'ring-2 ring-emerald-500 bg-emerald-500/5' : 'border-amber-350 dark:border-amber-900/60'}`}
          >
            <div className="absolute top-4 bg-amber-500/15 text-amber-600 px-3 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 animate-pulse border border-amber-300">
              <Crown className="w-3.5 h-3.5 text-amber-500" /> Arena Leader
            </div>
            
            <div className="relative mt-4">
              <img src={podium.first.photoURL} alt={podium.first.displayName} className="w-24 h-24 rounded-full border-4 border-amber-400" />
              <div className="absolute -top-3 -right-2 transform rotate-12 scale-110">
                <Crown className="w-10 h-10 text-amber-400 drop-shadow-md" />
              </div>
              <div className="absolute bottom-0 right-1 bg-amber-400 text-amber-950 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-md">
                1
              </div>
            </div>

            <h4 className="font-extrabold text-slate-900 dark:text-white mt-4 text-lg truncate max-w-full text-center">
              {podium.first.displayName} {podium.first.userId === user.uid && '(You)'}
            </h4>
            <span className="text-[10px] uppercase font-black tracking-widest text-amber-500 mt-0.5">
              Apex Competitor
            </span>

            {/* Score points badge */}
            <div className="mt-4 px-4 py-2 rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 text-center w-full border border-amber-450/25">
              <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400 font-mono flex items-center justify-center gap-1 font-bold">
                <span>{getScore(podium.first).toLocaleString()} pts</span>
                {flashingUsers[podium.first.userId] === 'up' && (
                  <span className="text-emerald-500 text-[10px] font-bold animate-bounce mt-0.5">▲</span>
                )}
              </div>
              <div className="text-[9px] text-slate-500 dark:text-zinc-400 uppercase font-bold tracking-tighter mt-0.5 flex justify-center gap-2">
                <span>{podium.first.totalHours.toFixed(1)}h</span>
                <span>•</span>
                <span>{podium.first.streak} days</span>
                <span>•</span>
                <span>{podium.first.wpm} WPM</span>
              </div>
            </div>
            
            {podium.first.userId !== user.uid && (
              <button 
                onClick={() => triggerNudge(podium.first!.userId)}
                className={`mt-4 text-xs font-bold px-3 py-1.5 rounded-full transition-all w-full flex items-center justify-center gap-1.5 ${
                  nudgeStates[podium.first.userId]
                    ? 'bg-emerald-500 text-white'
                    : 'bg-amber-500 text-amber-950 hover:bg-amber-400 font-extrabold shadow-sm'
                }`}
              >
                {nudgeStates[podium.first.userId] ? (
                  <>🎯 Challenge Dispatched!</>
                ) : (
                  <>⚡ Challenge Leader</>
                )}
              </button>
            )}
          </motion.div>
        )}

        {/* Bronze Medal (3rd Rank) */}
        {podium.third && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`order-3 bg-white dark:bg-zinc-900 border p-6 rounded-3xl flex flex-col items-center hover:shadow-lg transition-all relative ${
              podium.third.userId === user.uid ? 'ring-2 ring-indigo-500/80 bg-indigo-50/10' : ''
            } ${flashingUsers[podium.third.userId] === 'up' ? 'ring-2 ring-emerald-500 bg-emerald-500/5' : 'border-slate-100 dark:border-zinc-800'}`}
          >
            <div className="absolute top-4 left-4 bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-500 dark:text-zinc-400">
              Rank #3
            </div>
            
            <div className="relative mt-2">
              <img src={podium.third.photoURL} alt={podium.third.displayName} className="w-18 h-18 rounded-full border-4 border-amber-600/40" />
              <div className="absolute bottom-0 right-0 bg-amber-750 text-slate-100 w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold shadow-sm" style={{ backgroundColor: '#b45309' }}>
                3
              </div>
            </div>

            <h4 className="font-bold text-slate-900 dark:text-white mt-4 truncate max-w-full text-center">
              {podium.third.displayName} {podium.third.userId === user.uid && '(You)'}
            </h4>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 mt-0.5">
              Bronze Vanguard
            </span>

            {/* Score points badge */}
            <div className="mt-4 px-4 py-1.5 rounded-2xl bg-slate-50 dark:bg-zinc-800 text-center w-full">
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono flex items-center justify-center gap-1">
                <span>{getScore(podium.third).toLocaleString()} pts</span>
                {flashingUsers[podium.third.userId] === 'up' && (
                  <span className="text-emerald-500 text-[10px] font-bold animate-bounce mt-0.5">▲</span>
                )}
              </div>
              <div className="text-[9px] text-slate-450 uppercase font-bold tracking-tighter mt-0.5 flex justify-center gap-2">
                <span>{podium.third.totalHours.toFixed(1)}h</span>
                <span>•</span>
                <span>{podium.third.streak} days</span>
                <span>•</span>
                <span>{podium.third.wpm} WPM</span>
              </div>
            </div>
            
            {podium.third.userId !== user.uid && (
              <button 
                onClick={() => triggerNudge(podium.third!.userId)}
                className={`mt-4 text-xs font-bold px-3 py-1.5 rounded-full transition-all w-full flex items-center justify-center gap-1.5 ${
                  nudgeStates[podium.third.userId]
                    ? 'bg-emerald-500 text-white'
                    : 'bg-indigo-50 dark:bg-indigo-950/35 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100'
                }`}
              >
                {nudgeStates[podium.third.userId] ? (
                  <>🎯 Challenge Dispatched!</>
                ) : (
                  <>📣 Nudge Candidate</>
                )}
              </button>
            )}
          </motion.div>
        )}

      </div>

      {/* Structured Controls Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-8 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm">
        
        {/* Sort filtering buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide mr-2 pl-2">
            Sort Standings:
          </span>
          <button
            onClick={() => setSortBy('points')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              sortBy === 'points'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 dark:bg-zinc-800/85 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            🔥 Focus Points
          </button>
          <button
            onClick={() => setSortBy('hours')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              sortBy === 'hours'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 dark:bg-zinc-800/85 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            ⏱️ Hours Logged
          </button>
          <button
            onClick={() => setSortBy('streak')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              sortBy === 'streak'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 dark:bg-zinc-800/85 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            ⚡ Streak Length
          </button>
          <button
            onClick={() => setSortBy('wpm')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              sortBy === 'wpm'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 dark:bg-zinc-800/85 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            📈 Reading speed
          </button>
        </div>

        {/* Live Search bar */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-zinc-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-800/80 border border-slate-250 dark:border-zinc-700/85 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
        </div>
      </div>

      {/* Main Ranking Table Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/55 dark:bg-zinc-900/60 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            All Candidates Standings Sorted by {getSortTitle()}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">
            {filteredCandidates.length} Active Candidates Listed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-800/30 border-b border-slate-100 dark:border-zinc-800 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                <th className="px-6 py-4 text-center w-16">Rank</th>
                <th className="px-6 py-4">Candidate Profile</th>
                <th className="px-6 py-4 text-center">Score (AP)</th>
                <th className="px-6 py-4">Study Volume</th>
                <th className="px-6 py-4">Daily Streak</th>
                <th className="px-6 py-4">Action Items</th>
                <th className="px-6 py-4">Speed (WPM)</th>
                <th className="px-6 py-4">Status / Active</th>
                <th className="px-6 py-4 text-right">Interactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {podium.rest.map((candidate, index) => {
                const absoluteRank = index + 4;
                const candidatePoints = getScore(candidate);
                const isUser = candidate.userId === user.uid;
                const isFlashingUp = flashingUsers[candidate.userId] === 'up';
                const isFlashingDown = flashingUsers[candidate.userId] === 'down';
                const trClass = isFlashingUp 
                  ? 'bg-emerald-500/10 border-emerald-500/35 dark:bg-emerald-950/20 font-medium' 
                  : isFlashingDown 
                    ? 'bg-amber-500/10 border-amber-500/35 dark:bg-amber-950/20 font-medium' 
                    : isUser 
                      ? 'bg-indigo-50/20 dark:bg-indigo-950/10 font-medium' 
                      : '';

                return (
                  <tr 
                    key={candidate.userId}
                    className={`hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-all duration-500 ${trClass}`}
                  >
                      {/* Rank Indicator */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-extrabold ${
                          isUser 
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                        }`}>
                          {absoluteRank}
                        </span>
                      </td>
 
                      {/* Candidate Avatar & Profile */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={candidate.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-250 dark:border-zinc-700" />
                          <div className="min-w-0">
                            <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                              {candidate.displayName}
                              {isUser && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500 text-white tracking-widest uppercase">
                                  You
                                </span>
                              )}
                            </h5>
                            <span className="text-[10px] text-slate-400 font-medium italic block mt-0.5">
                              {candidate.userId.startsWith('bot_') ? 'Aspirational Target Bot' : 'Real-Time Candidate'}
                            </span>
                          </div>
                        </div>
                      </td>
 
                      {/* Standing points calculated */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1 font-mono text-xs font-bold text-slate-800 dark:text-zinc-200">
                          <span>{candidatePoints.toLocaleString()}</span>
                          {isFlashingUp && (
                            <span className="text-emerald-500 text-[10px] font-bold animate-bounce">
                              ▲
                            </span>
                          )}
                        </div>
                      </td>
 
                      {/* Study hours logged */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300">
                          <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{candidate.totalHours.toFixed(1)}h logged</span>
                        </div>
                      </td>
 
                      {/* Consistency streak length */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Flame className={`w-3.5 h-3.5 shrink-0 ${candidate.streak > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
                          <span className={`${candidate.streak > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500 dark:text-zinc-400'}`}>
                            {candidate.streak} {candidate.streak === 1 ? 'day' : 'days'}
                          </span>
                        </div>
                      </td>
 
                      {/* Tasks completed */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-350">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{candidate.tasksCompleted} tasks done</span>
                        </div>
                      </td>
 
                      {/* Word processing velocity */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-350">
                          <Gauge className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                          <span className="font-semibold">{candidate.wpm > 0 ? `${candidate.wpm} WPM` : '—'}</span>
                        </div>
                      </td>
 
                      {/* Last updated and state */}
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase flex items-center gap-1.5">
                          {candidate.userId === 'bot_99_99' ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                              <span>Active {formatDistanceToNow(candidate.lastActive)} ago</span>
                            </>
                          ) : (
                            <span>Active {formatDistanceToNow(candidate.lastActive)} ago</span>
                          )}
                        </span>
                      </td>

                      {/* Send Nudge button */}
                      <td className="px-6 py-4 text-right">
                        {!isUser ? (
                          <button
                            onClick={() => triggerNudge(candidate.userId)}
                            className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full transition-all ${
                              nudgeStates[candidate.userId]
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-indigo-50 hover:text-indigo-650'
                            }`}
                          >
                            {nudgeStates[candidate.userId] ? (
                              '🎯 Dispatched!'
                            ) : (
                              '📣 Nudge'
                            )}
                          </button>
                        ) : (
                          <span className="text-[10px] uppercase font-bold text-indigo-400 mr-2 tracking-wider">
                            You
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
