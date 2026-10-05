import type { MotionProps } from "motion/react";

export const slideVertical = {
    initial: { y: "-70%", opacity: 0 },
    animate: { y: "0%", opacity: 1 },
    exit: { y: "70%", opacity: 0 },
    transition: { duration: 0.2 },
} satisfies MotionProps;