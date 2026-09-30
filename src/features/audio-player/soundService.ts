import { BinauralBeat } from "@/shared/types/binauralBeat";
import { MusicGenre } from "@/shared/types/musicGenre";
import { SoundCategory } from "@/shared/types/soundCategory";
import { WhiteNoise } from "@/shared/types/whitenoise";

export const getBinauralBeats = (): BinauralBeat[] => {
    const binauralBeats: BinauralBeat[] = [
        {
            id: "binaural1",
            title: "Focus",
            category: SoundCategory.BinauralBeats,
            carrier: 150,
            delta: 40,
        },
        {
            id: "binaural2",
            title: "Alertness",
            category: SoundCategory.BinauralBeats,
            carrier: 160,
            delta: 20,
        },
        {
            id: "binaural3",
            title: "Calmness",
            category: SoundCategory.BinauralBeats,
            carrier: 200,
            delta: 10,
        }
    ];
    return binauralBeats;
};

export const getWhiteNoise = (): WhiteNoise[] => {
    const whiteNoises: WhiteNoise[] = [
        {
            id: "gentle-rain.wav",
            title: "Gentle Rain",
            category: SoundCategory.WhiteNoise,
        },
        {
            id: "fireplace.wav",
            title: "Fireplace",
            category: SoundCategory.WhiteNoise,
        },
        {
            id: "thunder.wav",
            title: "Thunder",
            category: SoundCategory.WhiteNoise,
        }
    ];
    return whiteNoises;
};

export const getMusicGenres = (): MusicGenre[] => {
    //Each genre streams its songs in this order and wraps around to the first one.
    //To add songs: drop the files into public/sounds/music/<id>/ and list the filenames here.
    const musicGenres: MusicGenre[] = [
        {
            id: "lofi",
            title: "LoFi",
            category: SoundCategory.Music,
            songs: [
                "VinylNod.m4a",
                "DustyHead-Nod.m4a",
                "LateTrainPantry.m4a",
                "LateTrainPantry1.m4a",
            ],
        },
        {
            id: "piano",
            title: "Piano",
            category: SoundCategory.Music,
            songs: [
                "QuietFocus.m4a",
                "QuietFocus1.m4a",
                "FocusedFlow.m4a"
            ],
        },
        {
            id: "techno",
            title: "Techno",
            category: SoundCategory.Music,
            songs: [],
        }
    ];
    return musicGenres;
};
