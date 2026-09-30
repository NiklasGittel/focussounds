"use client";

import { MusicGenre } from "@/shared/types/musicGenre";
import { SoundCategory } from "@/shared/types/soundCategory";
import SoundCard from "./SoundCard";
import { useAudioState } from "../providers/audioStateProvider";
import { Label } from "@/components/ui/label";
import { BinauralBeat } from "@/shared/types/binauralBeat";
import { WhiteNoise } from "@/shared/types/whitenoise";

interface SoundCardRowProps {
    sounds: MusicGenre[] | BinauralBeat[] | WhiteNoise[];
    label: string;
}

const SoundCardRow = ({ sounds, label }: SoundCardRowProps) => {
    //TODO: Refactor this to use a single state for active sound instead of separate states for each category
    const activeMusicGenre = useAudioState((state) => state.musicGenre);
    const activeBinauralBeat = useAudioState((state) => state.binauralBeat);
    const activeWhiteNoise = useAudioState((state) => state.whitenoise);
    const setMusicGenre = useAudioState((state) => state.setMusicGenre);
    const setBinauralBeat = useAudioState((state) => state.setBinauralBeat);
    const setWhiteNoise = useAudioState((state) => state.setWhiteNoise);


    const onClick = (sound: BinauralBeat | WhiteNoise | MusicGenre) => {
        if (sound.category === SoundCategory.Music) {
            setMusicGenre(activeMusicGenre?.id === (sound as MusicGenre).id ? null : (sound as MusicGenre));
        } else if (sound.category === SoundCategory.BinauralBeats) {
            setBinauralBeat(activeBinauralBeat?.id === (sound as BinauralBeat).id ? null : (sound as BinauralBeat));
        } else if (sound.category === SoundCategory.WhiteNoise) {
            setWhiteNoise(activeWhiteNoise?.id === (sound as WhiteNoise).id ? null : (sound as WhiteNoise));
        }
    };

    const activeSoundForCategory = (category: SoundCategory) => {
        switch (category) {
            case SoundCategory.Music:
                return activeMusicGenre;
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
                {sounds.map((sound) => {
                    //A genre without songs has nothing to stream yet, so it stays unselectable
                    const isEmpty = "songs" in sound && sound.songs.length === 0;
                    return (
                        <SoundCard
                            key={sound.id}
                            sound={sound}
                            isActive={activeSoundForCategory(sound.category)?.id === sound.id}
                            disabled={isEmpty}
                            onClick={isEmpty ? undefined : () => onClick(sound)}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default SoundCardRow;