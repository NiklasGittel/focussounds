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
//Where each genre was left, by genre id, so switching back picks up the same song at
//the same position instead of starting over. Per session only, not persisted.
const musicProgress = new Map<string, { songIndex: number; time: number }>();
//currentTime can only be set once the song has metadata, so the seek waits for it
let pendingSeek: (() => void) | null = null;
//Songs fade in and out through their own gain node, kept separate from the music layer
//gain so that fading never fights the volume slider
const MUSIC_FADE_SECONDS = 0.8;
let musicFadeGain: GainNode | null = null;
let isFadingOut = false;
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

//Playback can be refused, or the AudioContext can fall back to suspended, when the
//page has no user activation - a backgrounded tab on iOS is the usual case. We then
//wait for the first interaction anywhere and pick the transport back up there.
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
    musicFadeGain = context.createGain();
    musicFadeGain.gain.value = 1;
    musicFadeGain.connect(gains![SoundCategory.Music]);

    musicSourceNode = context.createMediaElementSource(musicElement);
    musicSourceNode.connect(musicFadeGain);
    //"ended" only fires on a natural end, never on pause or on switching src
    musicElement.addEventListener("ended", playNextSong);
    //A song the browser cannot play (missing file, unsupported codec) is skipped
    musicElement.addEventListener("error", skipUnplayableSong);
    //"playing" is when audio actually starts, which is when the fade in should begin
    musicElement.addEventListener("playing", fadeMusicIn);
    musicElement.addEventListener("timeupdate", fadeMusicOutBeforeEnd);
    return musicElement;
};

const loadCurrentSong = (startAt = 0) => {
    if (!musicGenre || musicGenre.songs.length === 0) return;
    const element = ensureMusicElement();

    //Drop a seek still waiting on the previous song, or it would move this one
    if (pendingSeek) {
        element.removeEventListener("loadedmetadata", pendingSeek);
        pendingSeek = null;
    }

    //A single song has nothing to advance to, so let the element loop it natively
    element.loop = musicGenre.songs.length === 1;
    //Silent until "playing" fades it in, so a new song cannot burst in at full volume
    if (musicFadeGain && audioContext) {
        isFadingOut = false;
        musicFadeGain.gain.cancelScheduledValues(audioContext.currentTime);
        musicFadeGain.gain.value = 0;
    }
    element.src = getSongUrl(musicGenre, musicGenre.songs[musicSongIndex]);

    if (startAt > 0) {
        pendingSeek = () => {
            element.currentTime = startAt;
            pendingSeek = null;
        };
        element.addEventListener("loadedmetadata", pendingSeek, { once: true });
    }

    //Rejects until the first user gesture, same as a suspended AudioContext
    if (isPlaying) void element.play().catch(onPlayRejected);
};

const fadeMusicIn = () => {
    if (!musicFadeGain || !audioContext) return;
    isFadingOut = false;
    const now = audioContext.currentTime;
    musicFadeGain.gain.cancelScheduledValues(now);
    musicFadeGain.gain.setValueAtTime(0, now);
    musicFadeGain.gain.linearRampToValueAtTime(1, now + MUSIC_FADE_SECONDS);
};

const fadeMusicOutBeforeEnd = () => {
    if (!musicElement || !musicFadeGain || !audioContext || isFadingOut) return;
    //A looping single song never ends, so fading it out would silence it for good
    if (musicElement.loop) return;

    const remaining = musicElement.duration - musicElement.currentTime;
    if (!Number.isFinite(remaining) || remaining > MUSIC_FADE_SECONDS) return;

    isFadingOut = true;
    const now = audioContext.currentTime;
    //Reach silence exactly at the end, however far into the fade window we are
    musicFadeGain.gain.cancelScheduledValues(now);
    musicFadeGain.gain.setValueAtTime(musicFadeGain.gain.value, now);
    musicFadeGain.gain.linearRampToValueAtTime(0, now + Math.max(remaining, 0.01));
};

const rememberGenreProgress = () => {
    if (!musicGenre || !musicElement) return;
    musicProgress.set(musicGenre.id, {
        songIndex: musicSongIndex,
        time: musicElement.currentTime,
    });
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
    //Re-selecting the running genre would otherwise restart the current song
    if (musicGenre?.id === newMusicGenre?.id) return;

    rememberGenreProgress();

    if (!newMusicGenre) {
        musicElement?.pause();
        musicGenre = null;
        musicSongIndex = 0;
        return;
    }

    musicGenre = newMusicGenre;
    musicErrorStreak = 0;

    const progress = musicProgress.get(newMusicGenre.id);
    //A saved index can point past the end once the song list is edited
    musicSongIndex = progress && progress.songIndex < newMusicGenre.songs.length
        ? progress.songIndex
        : 0;
    loadCurrentSong(musicSongIndex === progress?.songIndex ? progress.time : 0);
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
        progress: () => Object.fromEntries(musicProgress),
        fade: () => musicFadeGain?.gain.value,
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
