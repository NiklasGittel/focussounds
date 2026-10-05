"use client"
import { useTimerStore } from "../providers/timerStateProvider";
import { ChevronLast, TimerReset } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import TimerButton from "./TimerButton";

const pauseValues = [
    { value: null, label: "Off" },
    { value: 5, label: "5 min" },
    { value: 10, label: "10 min" },
    { value: 15, label: "15 min" }
]

const workValues = [
    { value: null, label: "Off" },
    { value: 30, label: "30 min" },
    { value: 60, label: "60 min" },
    { value: 90, label: "90 min" }
];


const PomoTimer = () => {
    const { workDuration, pauseDuration, currentTimer, timerEnd, setWorkDuration, setPauseDuration, resetTimer, skipTimer } = useTimerStore();
    
    return (
        <div className="flex items-center gap-4">
            <ContextMenu>
                <ContextMenuTrigger className="flex items-center justify-start ">
                    <TimerButton />
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
                        <ContextMenuItem onClick={skipTimer} disabled={currentTimer === "work" && pauseDuration === null || currentTimer === "pause" && workDuration === null || timerEnd === null}>
                            <ChevronLast /> Skip
                        </ContextMenuItem>
                        <ContextMenuItem onClick={resetTimer} disabled={pauseDuration === null && workDuration === null || timerEnd === null}>
                            <TimerReset /> Reset
                        </ContextMenuItem>
                    </ContextMenuGroup>
                </ContextMenuContent>
            </ContextMenu>
        </div>
    );
};

export default PomoTimer;

