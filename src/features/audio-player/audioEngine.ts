import { SoundCategory } from "@/shared/types/soundCategory";
import type { MusicGenre } from "@/shared/types/musicGenre";
import { BinauralBeat } from "@/shared/types/binauralBeat";
import { WhiteNoise } from "@/shared/types/whitenoise";

let isPlaying = false;
//These need to be nullable because the AudioContext is not available on the server side
let audioContext: AudioContext | null;
let gains: Record<Layer, GainNode> | null;

//Storing the promises to avoid race conditions when loading the same audio file multiple times
const audioBufferPromisesCache = new Map<string, Promise<AudioBuffer>>();
//Storing the audio buffers to avoid reloading the same audio file multiple times
const audioBuffersCache = new Map<string, AudioBuffer>();
const layerVolumes: Record<Layer, number> = {
    master: 0.5,
    music: 0.5,
    whitenoise: 0.5,
    binauralbeats: 0.1,
};
const audioSources: Record<SoundCategory, AudioBufferSourceNode | null> = {
    [SoundCategory.Music]: null,
    [SoundCategory.WhiteNoise]: null,
    [SoundCategory.BinauralBeats]: null,
};
const audioBuffers: Record<SoundCategory, AudioBuffer | null> = {
    [SoundCategory.Music]: null,
    [SoundCategory.WhiteNoise]: null,
    [SoundCategory.BinauralBeats]: null,
};

let binauralOscillators: OscillatorNode[] | null = null;
let binauralBeat: BinauralBeat | null = null;

//Music streams through an <audio> element instead of a decoded buffer, so that full
//length songs start immediately, keep memory flat and report a real "ended" event
let musicElement: HTMLAudioElement | null = null;
let musicSourceNode: MediaElementAudioSourceNode | null = null;
let musicGenre: MusicGenre | null = null;
let musicSongIndex = 0;
//Counts consecutive failed songs so a genre of unplayable files cannot spin forever
let musicErrorStreak = 0;
const ensureInitialized = () => {
    if (audioContext && gains) {
        if (audioContext.state === "suspended") void audioContext.resume();
        return audioContext;
    }

    const constructor = window.AudioContext ?? (window as any).webkitAudioContext;
    audioContext = new constructor();

    const masterGain = audioContext!.createGain();
    masterGain.gain.value = layerVolumes.master;
    masterGain.connect(audioContext!.destination);

    const createCategoryGain = (layer: SoundCategory) => {
        const gain = audioContext!.createGain();
        gain.gain.value = layerVolumes[layer];
        gain.connect(masterGain);
        return gain;
    }

    gains = {
        master: masterGain,
        music: createCategoryGain(SoundCategory.Music),
        whitenoise: createCategoryGain(SoundCategory.WhiteNoise),
        binauralbeats: createCategoryGain(SoundCategory.BinauralBeats),
    };

    gains[SoundCategory.Music].gain.value = layerVolumes.music;
    gains[SoundCategory.WhiteNoise].gain.value = layerVolumes.whitenoise;
    gains[SoundCategory.BinauralBeats].gain.value = layerVolumes.binauralbeats;

    return audioContext;
};

//Browsers refuse to start audio before the page has been interacted with. When that
//happens we wait for the first interaction anywhere and start everything then, so a
//reload with isPlaying persisted does not sit silently until the user hits play.
let isWaitingForGesture = false;

const startOnNextGesture = () => {
    if (isWaitingForGesture || typeof document === "undefined") return;
    isWaitingForGesture = true;

    const onGesture = () => {
        isWaitingForGesture = false;
        document.removeEventListener("pointerdown", onGesture, true);
        document.removeEventListener("keydown", onGesture, true);
        if (!isPlaying) return;
        void audioContext?.resume();
        void musicElement?.play().catch(() => { });
    };

    document.addEventListener("pointerdown", onGesture, { capture: true, once: true });
    document.addEventListener("keydown", onGesture, { capture: true, once: true });
};

//An AbortError only means a newer song replaced this one mid-load, which is expected
const onPlayRejected = (error: unknown) => {
    if ((error as DOMException)?.name === "AbortError") return;
    startOnNextGesture();
};

export const setVolume = (layer: Layer, volume: number) => {
    if (!gains) return;
    gains[layer].gain.value = volume;
    layerVolumes[layer] = volume;
};

export const setMasterVolume = (volume: number) => {
    setVolume("master", volume);
};



const switchAudioBufferForCategory = (layer: SoundCategory, audioBuffer: AudioBuffer) => {
    ensureInitialized();
    stopAudioSourceForLayer(layer);
    audioBuffers[layer] = audioBuffer;
}

export const stopAudioSourceForLayer = (layer: SoundCategory) => {
    ensureInitialized();
    const source = audioSources[layer];
    if (source) {
        try {
            source.stop();
        } catch (e) { }
        source.disconnect();
        audioSources[layer] = null;
    }
};

export const stopAllAudioLayers = () => {
    ensureInitialized();
    for (const layer of Object.keys(audioSources) as SoundCategory[]) {
        stopAudioSourceForLayer(layer);
    }
    //Quickfix
    stopBinauralBeat();
    //Pausing keeps currentTime, so playing again resumes the song where it left off
    musicElement?.pause();
};

export const startAllAudioLayers = () => {
    ensureInitialized();
    for (const layer of Object.keys(audioSources) as SoundCategory[]) {
        startAudioSourceForLayer(layer);
    }
    //Quickfix
    startBinauralBeat();
    if (musicGenre) void musicElement?.play().catch(onPlayRejected);
    //The oscillators and buffer sources are silent too while the context is suspended
    if (audioContext?.state !== "running") startOnNextGesture();
};

export const startAudioSourceForLayer = (layer: SoundCategory) => {
    if (!audioBuffers[layer]) return;
    const audioContext = ensureInitialized();
    //Stop the running source first, otherwise it is orphaned and keeps playing
    stopAudioSourceForLayer(layer);
    const newSource = audioContext!.createBufferSource();
    newSource.buffer = audioBuffers[layer];
    newSource.loop = true;
    newSource.connect(gains![layer]);
    audioSources[layer] = newSource;
    newSource.start();
};

const getSoundUrl = (sound: WhiteNoise) => {
    return `/sounds/${sound.category}/${sound.id}`;
};

const loadBuffer = async (url: string): Promise<AudioBuffer> => {
    //check immediately if the buffer is already loaded
    if (audioBuffersCache.has(url)) return audioBuffersCache.get(url)!;

    //check if the buffer is already being loaded
    if (audioBufferPromisesCache.has(url)) return audioBufferPromisesCache.get(url)!;

    //load the buffer and store the promise to avoid race conditions
    const fetchPromise = (async () => {
        const res = await fetch(url);

        if (!res.ok) throw new Error(`Failed to fetch audio file: ${res.statusText}`);

        const bytes = await res.arrayBuffer();
        audioBufferPromisesCache.delete(url);
        audioBuffersCache.set(url, await audioContext!.decodeAudioData(bytes));
        return audioBuffersCache.get(url)!;
    })();
    fetchPromise.catch(() => audioBufferPromisesCache.delete(url));

    audioBufferPromisesCache.set(url, fetchPromise);
    return fetchPromise;
};

export const setIsPlaying = (playing: boolean) => {
    if (isPlaying === playing) return;
    isPlaying = playing;
    if (isPlaying) {
        startAllAudioLayers();
    } else {
        stopAllAudioLayers();
    }
};


//Music -------------------------------------------------------------------------------------------------

const getSongUrl = (genre: MusicGenre, song: string) => {
    return `/sounds/${genre.category}/${genre.id}/${song}`;
};

//createMediaElementSource may only be called once per element, so the element and its
//source node are built once and every song reuses them by reassigning src
const ensureMusicElement = () => {
    const context = ensureInitialized();
    if (musicElement) return musicElement;

    musicElement = new Audio();
    musicElement.preload = "auto";
    //No crossOrigin: the files are served from this same origin, so it would buy nothing
    musicSourceNode = context.createMediaElementSource(musicElement);
    musicSourceNode.connect(gains![SoundCategory.Music]);
    //"ended" only fires on a natural end, never on pause or on switching src
    musicElement.addEventListener("ended", playNextSong);
    //A song the browser cannot play (missing file, unsupported codec) is skipped
    musicElement.addEventListener("error", skipUnplayableSong);
    return musicElement;
};

const loadCurrentSong = () => {
    if (!musicGenre || musicGenre.songs.length === 0) return;
    const element = ensureMusicElement();
    //A single song has nothing to advance to, so let the element loop it natively
    element.loop = musicGenre.songs.length === 1;
    element.src = getSongUrl(musicGenre, musicGenre.songs[musicSongIndex]);
    //Rejects until the first user gesture, same as a suspended AudioContext
    if (isPlaying) void element.play().catch(onPlayRejected);
};

const playNextSong = () => {
    if (!musicGenre || musicGenre.songs.length === 0) return;
    musicErrorStreak = 0;
    musicSongIndex = (musicSongIndex + 1) % musicGenre.songs.length;
    loadCurrentSong();
};

const skipUnplayableSong = () => {
    if (!musicGenre || musicGenre.songs.length === 0) return;
    console.warn(`[audioEngine] cannot play ${musicGenre.songs[musicSongIndex]}, skipping`);
    //Give up once every song in the genre has failed in a row
    if (++musicErrorStreak >= musicGenre.songs.length) {
        musicErrorStreak = 0;
        return;
    }
    musicSongIndex = (musicSongIndex + 1) % musicGenre.songs.length;
    loadCurrentSong();
};

export const setMusicGenreAsync = async (newMusicGenre: MusicGenre | null) => {
    ensureInitialized();
    if (!newMusicGenre) {
        musicElement?.pause();
        musicGenre = null;
        musicSongIndex = 0;
        return;
    }
    //Re-selecting the running genre would otherwise restart the current song
    if (musicGenre?.id === newMusicGenre.id) return;
    musicGenre = newMusicGenre;
    musicSongIndex = 0;
    musicErrorStreak = 0;
    loadCurrentSong();
}

//Dev-only inspection handle; Next inlines NODE_ENV so this is stripped from the build
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__music = {
        element: () => musicElement,
        state: () => ({
            genre: musicGenre?.id ?? null,
            song: musicGenre?.songs[musicSongIndex] ?? null,
            index: musicSongIndex,
            currentTime: musicElement?.currentTime,
            duration: musicElement?.duration,
            paused: musicElement?.paused,
            isPlaying,
        }),
    };
}

//White noise -------------------------------------------------------------------------------------------

export const setWhitenoiseAsync = async (whitenoise: WhiteNoise | null) => {
    ensureInitialized();
    if (!whitenoise) {
        stopAudioSourceForLayer(SoundCategory.WhiteNoise);
        return;
    }
    const url = getSoundUrl(whitenoise);
    const buffer = await loadBuffer(url);
    if (buffer.length === 0) return;
    switchAudioBufferForCategory(whitenoise.category, buffer);
    if (isPlaying) startAudioSourceForLayer(whitenoise.category);
}

//Binaural -------------------------------------------------------------------------------------------------

export const setBinauralBeatAsync = async (newBinauralBeat: BinauralBeat | null) => {
    stopBinauralBeat();
    if (!newBinauralBeat) return;
    binauralBeat = newBinauralBeat;
    if (isPlaying) startBinauralBeat();
}

const startOscillator = (frequency: number, side: "left" | "right"): OscillatorNode => {
    const context = ensureInitialized();

    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const pan = context.createStereoPanner();
    pan.pan.value = side === "left" ? -1 : 1;
    //The oscillator must reach the gain through the panner, otherwise both ears
    //get both frequencies and there is no binaural beat
    osc.connect(pan);
    pan.connect(gains![SoundCategory.BinauralBeats]);
    osc.onended = () => pan.disconnect();
    osc.start();
    return osc;
}

const startBinauralBeat = () => {
    if (!binauralBeat) return;
    //Stop the running oscillators first, otherwise they are orphaned: stopBinauralBeat
    //can only reach the pair currently held in binauralOscillators
    stopBinauralBeat();

    binauralOscillators = [
        startOscillator(binauralBeat.carrier, "left"),
        startOscillator(binauralBeat.carrier + binauralBeat.delta, "right"),
    ];
}

const stopBinauralBeat = () => {
    binauralOscillators?.forEach((osc) => {
        try {
            osc.stop();
        } catch (e) { }
        osc.disconnect();
    });
    binauralOscillators = null;
}
