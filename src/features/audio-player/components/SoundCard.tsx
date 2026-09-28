import { Card } from "@/components/ui/card";
import PlayingIndicator from "./PlayingIndicator";
import { Sound } from "../../../shared/types/sound";

interface SoundCardProps {
    sound: Sound;
    isActive?: boolean;
    onClick?: () => void;
}

const SoundCard = ({ sound, isActive, onClick }: SoundCardProps) => {
    const cardTheme = isActive ? "bg-zinc-100 text-black" : undefined;

    return (
        <Card className={`w-full aspect-square sm:w-28 sm:h-28 sm:aspect-auto sm:shrink-0 lg:w-32 lg:h-32 flex font-semibold flex-col items-start justify-end p-3 sm:p-4 cursor-pointer transition-colors duration-300 ${cardTheme}`} onClick={onClick}>
            {isActive && <PlayingIndicator />}
            <h3 className="text-xs sm:text-sm leading-tight break-words">{sound.title}</h3>
        </Card>
    );
};

export default SoundCard;