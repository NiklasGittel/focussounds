import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { MusicGenre } from "@/shared/types/musicGenre";
import { getMusicGenres } from "../soundService";
import { BinauralBeat } from "@/shared/types/binauralBeat";
import { WhiteNoise } from "@/shared/types/whitenoise";

interface AudioState {
    isPlaying: boolean;
    musicGenre: MusicGenre | null;
    binauralBeat: BinauralBeat | null;
    whitenoise: WhiteNoise | null;
    volumes: Record<Layer, number>;
    togglePlaying: () => void;
    setMusicGenre: (genre: MusicGenre | null) => void;
    setBinauralBeat: (sound: BinauralBeat | null) => void;
    setWhiteNoise: (sound: WhiteNoise | null) => void;
}

export const useAudioState = create<AudioState>()(
    devtools(
        subscribeWithSelector(
            persist(
                (set) => ({
                    isPlaying: false,
                    musicGenre: null,
                    binauralBeat: null,
                    whitenoise: null,
                    volumes: {
                        master: 0.5,
                        music: 0.5,
                        whitenoise: 0.5,
                        binauralbeats: 0.1,
                    },
                    togglePlaying: () => {
                        set((state) => ({ isPlaying: !state.isPlaying }));
                    },
                    setMusicGenre: async (genre: MusicGenre | null) => {
                        set((_) => ({ musicGenre: genre }));
                    },
                    setBinauralBeat: async (beat: BinauralBeat | null) => {
                        set((_) => ({ binauralBeat: beat }));
                    },
                    setWhiteNoise: async (whitenoise: WhiteNoise | null) => {
                        set((_) => ({ whitenoise: whitenoise }));
                    },
                }),
                {
                    name: 'audio-state-storage',
                    version: 1,
                    migrate: (persisted: unknown, version: number) => {
                        if (version === 0) {
                            //v0 stored a single musicTrack whose id was a filename,
                            //which has no equivalent among the genres
                            const stored = { ...(persisted ?? {}) } as Record<string, unknown>;
                            delete stored.musicTrack;
                            return { ...stored, musicGenre: null };
                        }
                        return persisted;
                    },
                    //The stored genre carries the song list it had when it was saved.
                    //Always re-resolve it from the code so that editing the song list
                    //reaches everyone, and a removed genre degrades to nothing selected.
                    merge: (persisted, current) => {
                        const stored = (persisted ?? {}) as Partial<AudioState>;
                        const storedGenreId = stored.musicGenre?.id;
                        return {
                            ...current,
                            ...stored,
                            musicGenre: storedGenreId
                                ? getMusicGenres().find((genre) => genre.id === storedGenreId) ?? null
                                : null,
                            volumes: { ...current.volumes, ...(stored.volumes ?? {}) },
                        };
                    },
                },
            ),
        ),
    ),
)

