import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { playTimerAlarm } from '../utils/audioAlert';

/**
 * The kitchen timer. It lives above the recipe view, so it keeps counting and stays on screen
 * when the recipe is closed. It is saved on the phone, so it survives a reload too. The end
 * time is stored, not the seconds left, so the count is right after the phone has slept.
 */

export interface KitchenTimer {
  label: string;
  totalSeconds: number;
  secondsLeft: number;
  isRunning: boolean;
  /** When a running timer ends (ms). Null while paused or done. */
  targetEndTime: number | null;
  recipeId?: string;
  recipeTitle?: string;
}

interface TimerContextValue {
  timer: KitchenTimer | null;
  startTimer: (minutes: number, label: string, recipe?: { id: string; title: string }) => void;
  toggleTimer: () => void;
  restartTimer: () => void;
  clearTimer: () => void;
}

const STORAGE_KEY = 'matklar_timer_v1';
const TimerContext = createContext<TimerContextValue | null>(null);

function load(): KitchenTimer | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as KitchenTimer | null;
    if (!saved || typeof saved.totalSeconds !== 'number') return null;
    if (saved.isRunning && saved.targetEndTime) {
      const left = Math.max(0, Math.ceil((saved.targetEndTime - Date.now()) / 1000));
      return left > 0
        ? { ...saved, secondsLeft: left }
        : { ...saved, secondsLeft: 0, isRunning: false, targetEndTime: null };
    }
    return saved;
  } catch {
    return null;
  }
}

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timer, setTimer] = useState<KitchenTimer | null>(load);

  useEffect(() => {
    try {
      if (timer) localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Not saved: the timer still runs while the app is open
    }
  }, [timer]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!timer?.isRunning || !timer.targetEndTime) return;

    const tick = () => {
      setTimer((prev) => {
        if (!prev || !prev.isRunning || !prev.targetEndTime) return prev;
        const left = Math.max(0, Math.ceil((prev.targetEndTime - Date.now()) / 1000));
        if (left <= 0) {
          playTimerAlarm();
          return { ...prev, secondsLeft: 0, isRunning: false, targetEndTime: null };
        }
        return left === prev.secondsLeft ? prev : { ...prev, secondsLeft: left };
      });
    };

    intervalRef.current = setInterval(tick, 250);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [timer?.isRunning, timer?.targetEndTime]);

  const startTimer = useCallback((minutes: number, label: string, recipe?: { id: string; title: string }) => {
    const totalSeconds = Math.round(minutes * 60);
    setTimer({
      label,
      totalSeconds,
      secondsLeft: totalSeconds,
      isRunning: true,
      targetEndTime: Date.now() + totalSeconds * 1000,
      recipeId: recipe?.id,
      recipeTitle: recipe?.title,
    });
  }, []);

  const toggleTimer = useCallback(() => {
    setTimer((prev) => {
      if (!prev) return null;
      return prev.isRunning
        ? { ...prev, isRunning: false, targetEndTime: null }
        : { ...prev, isRunning: true, targetEndTime: Date.now() + prev.secondsLeft * 1000 };
    });
  }, []);

  const restartTimer = useCallback(() => {
    setTimer((prev) =>
      prev
        ? { ...prev, secondsLeft: prev.totalSeconds, isRunning: true, targetEndTime: Date.now() + prev.totalSeconds * 1000 }
        : null
    );
  }, []);

  const clearTimer = useCallback(() => setTimer(null), []);

  return (
    <TimerContext.Provider value={{ timer, startTimer, toggleTimer, restartTimer, clearTimer }}>
      {children}
    </TimerContext.Provider>
  );
};

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used inside TimerProvider');
  return ctx;
}
