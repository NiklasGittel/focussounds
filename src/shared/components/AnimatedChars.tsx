"use client"
import { slideVertical } from "@/shared/animations";
import { AnimatePresence, motion } from "motion/react";



const AnimatedChars = ({ text }: { text: string }) => (
    <span className="inline-flex tabular-nums">
        {text.split("").map((char, i) => (
            <span key={i} className="relative inline-block overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                        key={char}
                        className="inline-block"
                        {...slideVertical}
                    >
                        {char}
                    </motion.span>
                </AnimatePresence>
            </span>
        ))}
    </span>
);

export default AnimatedChars;