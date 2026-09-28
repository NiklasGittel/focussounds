"use client";

import { MusicTrack } from "@/shared/types/musicTrack";
import { SoundCategory } from "@/shared/types/soundCategory";
import SoundCard from "./SoundCard";
import { useAudioState } from "../providers/audioStateProvider";
import { Label } from "@/components/ui/label";
import { BinauralBeat } from "@/shared/types/binauralBeat";
import { WhiteNoise } from "@/shared/types/whitenoise";

interface SoundCardRowProps {
    sounds: MusicTrack[] | BinauralBeat[] | WhiteNoise[];
    label: string;
}

const SoundCardRow = ({ sounds, label }: SoundCardRowProps) => {
    //TODO: Refactor this to use a single state for active sound instead of separate states for each category
    const activeMusicTrack = useAudioState((state) => state.musicTrack);
    const activeBinauralBeat = useAudioState((state) => state.binauralBeat);
    const activeWhiteNoise = useAudioState((state) => state.whitenoise);
    const setMusicTrack = useAudioState((state) => state.setMusicTrack);
    const setBinauralBeat = useAudioState((state) => state.setBinauralBeat);
    const setWhiteNoise = useAudioState((state) => state.setWhiteNoise);


    const onClick = (sound: BinauralBeat | WhiteNoise | MusicTrack) => {
        if (sound.category === SoundCategory.Music) {
            setMusicTrack(activeMusicTrack?.id === (sound as MusicTrack).id ? null : (sound as MusicTrack));
        } else if (sound.category === SoundCategory.BinauralBeats) {
            setBinauralBeat(activeBinauralBeat?.id === (sound as BinauralBeat).id ? null : (sound as BinauralBeat));
        } else if (sound.category === SoundCategory.WhiteNoise) {
            setWhiteNoise(activeWhiteNoise?.id === (sound as WhiteNoise).id ? null : (sound as WhiteNoise));
        }
    };

    const activeSoundForCategory = (category: SoundCategory) => {
        switch (category) {
            case SoundCategory.Music:
                return activeMusicTrack;
            case SoundCategory.BinauralBeats:
                return activeBinauralBeat;
            case SoundCategory.WhiteNoise:
                return activeWhiteNoise;
            default:
                return null;
        }
    };

    return (
        <div>
            <Label className="text-base sm:text-lg font-semibold mb-2 text-muted-foreground">{label}</Label>
            <div className="grid grid-cols-3 gap-3 w-full sm:flex sm:flex-row sm:flex-wrap sm:justify-start sm:gap-4 lg:gap-6">
                {sounds.map((sound) => (
                    <SoundCard key={sound.id} sound={sound} isActive={activeSoundForCategory(sound.category)?.id === sound.id} onClick={() => onClick(sound)} />
                ))}
            </div>
        </div>
    );
};

export default SoundCardRow;