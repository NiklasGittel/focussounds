"use client"
import { slideVertical } from "@/shared/animations";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion as m } from "motion/react";

const AnimatedIcon = ({ icon: IconComponent, iconKey, animationProps }: { icon: LucideIcon, iconKey: string, animationProps?: any }) => (
   <AnimatePresence mode="wait" initial={false}>
    <m.span
        key={iconKey}
        className="inline-flex"
        {...(animationProps ?? slideVertical)}
    >
        <IconComponent />
    </m.span>
</AnimatePresence>
);

export default AnimatedIcon;