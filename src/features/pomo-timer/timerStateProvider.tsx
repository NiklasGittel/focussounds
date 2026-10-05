import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { subscribeWithSelector } from "zustand/middleware";

interface TimerState {
    workDuration: number | null;
    pauseDuration: number | null;
    pausedAt: number | null;
    timerEnd: number | null;
    currentTimer: "work" | "pause";
    setWorkDuration: (workDuration: number | null) => void;
    setPauseDuration: (pauseDuration: number | null) => void;
    setTimerEnd: (workDeadline: number | null) => void;
    setTimerPausedAt: (pausedAt: number | null) => void;
    toggleTimer: () => void;
    resetTimer: () => void;
    skipTimer: () => void;
}

export const useTimerStore = create<TimerState>()(
    devtools(
        subscribeWithSelector(
            (set, get) => {
                const updateCurrentTimer = () => {
                    const { currentTimer, workDuration, pauseDuration } = get();
                    if (currentTimer === "work" && !workDuration && pauseDuration) {
                        set({ currentTimer: "pause" });
                    } else if (currentTimer === "pause" && !pauseDuration && workDuration) {
                        set({ currentTimer: "work" });
                    }
                };

                return ({
                    workDuration: 30,
                    pauseDuration: 5,
                    timerEnd: null,
                    pausedAt: null,
                    currentTimer: "work",
                    setWorkDuration: (workDuration: number | null) => {
                        const { currentTimer, resetTimer } = get();
                        if (currentTimer === "work") {
                            resetTimer();
                        }
                        set({ workDuration });
                        updateCurrentTimer();
                    },
                    setPauseDuration: (pauseDuration: number | null) => {
                        const { currentTimer, resetTimer } = get();
                        if (currentTimer === "pause") {
                            resetTimer();
                        }
                        set({ pauseDuration });
                        updateCurrentTimer();
                    },
                    setTimerEnd: (timerEnd: number | null) => set({ timerEnd }),
                    setTimerPausedAt: (pausedAt: number | null) => set({ pausedAt }),
                    toggleTimer: () => {
                        console.log("Toggling timer.");
                        const { workDuration, pauseDuration, currentTimer: currentMode, timerEnd, pausedAt } = get();
                        if (!workDuration && !pauseDuration) return;

                        //start
                        if (!timerEnd) {
                            const duration = currentMode === "work" ? workDuration! : pauseDuration!;
                            set({ timerEnd: Date.now() + duration * 60 * 1000, pausedAt: null });
                            return;
                        }

                        //resume
                        if (pausedAt) {
                            const remainingTime = timerEnd! - pausedAt;
                            set({ timerEnd: Date.now() + remainingTime, pausedAt: null });
                            return;
                        }

                        //pause
                        set({ pausedAt: Date.now() });
                    },
                    resetTimer: () => {
                        console.log("Resetting timer.");
                        set({ timerEnd: null, pausedAt: null });
                    },
                    skipTimer: () => {
                        const { currentTimer } = get();
                        if (currentTimer === "work") {
                            set({ currentTimer: "pause", timerEnd: null, pausedAt: null });
                        } else {
                            set({ currentTimer: "work", timerEnd: null, pausedAt: null });
                        }
                    }
                })
            },

        )
    )
)