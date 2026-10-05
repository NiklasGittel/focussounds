import { Button } from "@/components/ui/button";
import { useTimerStore } from "../providers/timerStateProvider";
import { CoffeeIcon, TimerIcon, TimerOffIcon } from "lucide-react";
import AnimatedChars from "../../../shared/components/AnimatedChars";
import { useEffect, useState } from "react";
import { playTimerElapsedSound } from "../../audio-player/audioEngine";
import AnimatedIcon from "@/shared/components/AnimatedIcon";

const formatTime = (timeInMs: number) => {
    const timeInSeconds = Math.floor(timeInMs / 1000);
    const mins2Display = Math.floor(timeInSeconds / 60);
    const secs2Display = timeInSeconds % 60;
    return `${mins2Display.toString().padStart(2, "0")}:${secs2Display.toString().padStart(2, "0")}`;
};

const icons = {
    "work": TimerIcon,
    "pause": CoffeeIcon,
    "off": TimerOffIcon
};

const TimerButton = () => {
    const { workDuration, pauseDuration, pausedAt, timerEnd, currentTimer, toggleTimer, resetTimer } = useTimerStore();
    const icon = !workDuration && !pauseDuration ? "off" : currentTimer === "work" ? "work" : "pause";
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
            resetTimer(); // resets aswell
        };

        let timeoutId = window.setTimeout(
            checkDeadline,
            Math.max(0, timerEnd - Date.now())
        );

        return () => window.clearTimeout(timeoutId);
    }, [timerEnd, pausedAt]);


    const getRemainingTime = () => {
        let remainingTime = 0;
        if (!timerEnd) remainingTime = ((currentTimer === "work" ? workDuration : pauseDuration) ?? 0) * 60 * 1000;
        else if (pausedAt) remainingTime = timerEnd - pausedAt;
        else remainingTime = timerEnd - (now ?? Date.now());
        return Math.max(remainingTime, 0);
    };

    return (
        <Button variant={isRunning ? "default" : "outline"} onClick={toggleTimer} >
            <AnimatedIcon icon={icons[icon]} iconKey={icon} />
            {icon !== "off" && <AnimatedChars text={formatTime(getRemainingTime())} />}
        </Button>
    );

};

export default TimerButton;