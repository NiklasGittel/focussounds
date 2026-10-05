"use client"
import { AnimatePresence, motion } from "motion/react";

const AnimatedTime = ({ text }: { text: string }) => (
    <span className="inline-flex tabular-nums">
        {text.split("").map((char, i) => (
            <span key={i} className="relative inline-block overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                        key={char}
                        className="inline-block"
                        initial={{ y: "-70%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "70%", opacity: 0 }}
                        transition={{ duration: 0.45
                         }}
                    >
                        {char}
                    </motion.span>
                </AnimatePresence>
            </span>
        ))}
    </span>
);

export default AnimatedTime;