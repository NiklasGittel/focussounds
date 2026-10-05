"use client"
import { useEffect, useState } from "react";
import { useTimerStore } from "./timerStateProvider";
import { ChevronLast, CoffeeIcon, TimerIcon, TimerOffIcon, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { playTimerElapsedSound } from "../audio-player/audioEngine";
import AnimatedTime from "./AnimatedTime";

const PomoTimer = () => {
    const { workDuration, pauseDuration, pausedAt, timerEnd, currentTimer, setWorkDuration, setPauseDuration, toggleTimer, resetTimer, skipTimer } = useTimerStore();
    const isDisabled = !workDuration && !pauseDuration;
    const isRunning = !!timerEnd && !pausedAt;
    const [now, setNow] = useState<number | null>(null);

    //Update UI
    useEffect(() => {
        if (!isRunning) return;
        const updateNow = () => setNow(Date.now());
        updateNow();
        const intervalId = window.setInterval(updateNow, 1000);
        return () => window.clearInterval(intervalId);
    }, [isRunning]);

    //Timer end - fine here atm
    // TODO: Extract to its own controller
    useEffect(() => {
    if (!timerEnd || pausedAt) return;

    const checkDeadline = () => {
        const current = useTimerStore.getState();

        if (current.timerEnd !== timerEnd || current.pausedAt) return;

        const remaining = timerEnd - Date.now();
        if (remaining > 0) {
            timeoutId = window.setTimeout(checkDeadline, remaining);
            return;
        }

        void playTimerElapsedSound().catch(console.error);
        current.skipTimer(); // resets aswell
    };

    let timeoutId = window.setTimeout(
        checkDeadline,
        Math.max(0, timerEnd - Date.now())
    );

    return () => window.clearTimeout(timeoutId);
}, [timerEnd, pausedAt]);

    const pauseValues = [
        { value: null, label: "Off" },
        { value: 1, label: "1 min" },
        { value: 10, label: "10 min" },
        { value: 15, label: "15 min" }
    ]

    const workValues = [
        { value: null, label: "Off" },
        { value: 30, label: "30 min" },
        { value: 60, label: "60 min" },
        { value: 90, label: "90 min" }
    ];

    const formatTime = (timeInMs: number) => {
        const timeInSeconds = Math.floor(timeInMs / 1000);
        const mins2Display = Math.floor(timeInSeconds / 60);
        const secs2Display = timeInSeconds % 60;
        return `${mins2Display.toString().padStart(2, "0")}:${secs2Display.toString().padStart(2, "0")}`;
    };

    const getRemainingTime = () => {
        let remainingTime = 0;
        if (!timerEnd) remainingTime =  ((currentTimer === "work" ? workDuration : pauseDuration) ?? 0) * 60 * 1000;
        else if (pausedAt) remainingTime = timerEnd - pausedAt;
        else remainingTime = timerEnd - (now ?? Date.now());
        return Math.max(remainingTime, 0);
    };

    return (
        <div className="flex items-center gap-4">
            <ContextMenu>
                <ContextMenuTrigger className="flex min-w-xs w-full items-center justify-start ">
                    <Button variant={isRunning ? "default" : "outline"} onClick={toggleTimer} >
                        {isDisabled ? <TimerOffIcon /> : <>{currentTimer === "work" ? <TimerIcon /> : <CoffeeIcon />}<AnimatedTime text={formatTime(getRemainingTime())} /></>}
                    </Button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuRadioGroup value={workDuration} onValueChange={(value) => setWorkDuration(value)}>
                        <ContextMenuLabel>Work</ContextMenuLabel>
                        {workValues.map(({ value, label }) => (
                            <ContextMenuRadioItem key={value ?? "off-work"} value={value}>
                                {label}
                            </ContextMenuRadioItem>
                        ))}
                    </ContextMenuRadioGroup>
                    <ContextMenuSeparator />
                    <ContextMenuRadioGroup value={pauseDuration} onValueChange={(value) => setPauseDuration(value)}>
                        <ContextMenuLabel>Pause</ContextMenuLabel>
                        {pauseValues.map(({ value, label }) => (
                            <ContextMenuRadioItem key={value ?? "off-pause"} value={value}>
                                {label}
                            </ContextMenuRadioItem>
                        ))}
                    </ContextMenuRadioGroup>
                    <ContextMenuSeparator />
                    <ContextMenuGroup>
                        <ContextMenuLabel>Controls</ContextMenuLabel>
                        <ContextMenuItem onClick={skipTimer}>
                            <ChevronLast /> Skip
                        </ContextMenuItem>
                        <ContextMenuItem onClick={resetTimer}>
                            <TimerReset /> Reset
                        </ContextMenuItem>
                    </ContextMenuGroup>
                </ContextMenuContent>
            </ContextMenu>
        </div>
    );
};

export default PomoTimer;

