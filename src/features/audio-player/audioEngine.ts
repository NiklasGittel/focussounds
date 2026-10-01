import { SoundCategory } from "@/shared/types/soundCategory";
import type { MusicGenre } from "@/shared/types/musicGenre";
import { BinauralBeat } from "@/shared/types/binauralBeat";
import { WhiteNoise } from "@/shared/types/whiteNoise";

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

//Music streams through <audio> elements instead of decoded buffers, so that full
//length songs start immediately and keep memory flat
let musicGenre: MusicGenre | null = null;
let musicSongIndex = 0;
//Where each genre was left, by genre id, so switching back picks up the same song at
//the same position instead of starting over. Per session only, not persisted.
const musicProgress = new Map<string, { songIndex: number; time: number }>();
//currentTime can only be set once the song has metadata, so the seek waits for it
let pendingSeek: (() => void) | null = null;

//Counts consecutive failed songs so a genre of unplayable files cannot spin forever
let musicErrorStreak = 0;
const ensureInitialized = () => {
    if (audioContext && gains) {
        if (audioContext.state === "suspended") void audioContext.resume();
        return audioContext;
    }

    const constructor = window.AudioContext ?? (window as any).webkitAudioContext;
    audioContext = new constructor();

    //The browser can suspend the context long after playback started, for instance in a
    //backgrounded tab. The elements then stall with no event of their own, so without
    //this the transport would keep claiming to play while nothing is audible.
    audioContext!.addEventListener("statechange", () => {
        if (!isPlaying || audioContext?.state === "running") return;
        void audioContext?.resume().then(() => {
            if (isPlaying && audioContext?.state !== "running") startOnNextGesture();
        }).catch(() => startOnNextGesture());
    });

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
        resumeMusic();
    };

    document.addEventListener("pointerdown", onGesture, { capture: true, once: true });
    document.addEventListener("keydown", onGesture, { capture: true, once: true });
};

//Lets the engine tell the store that playback has genuinely stopped, so the transport
//cannot keep showing "playing" over silence. The engine never imports the store itself.
let playbackStoppedHandler: (() => void) | null = null;

export const setPlaybackStoppedHandler = (handler: (() => void) | null) => {
    playbackStoppedHandler = handler;
};

//Nothing is coming out of the music layer and nothing is going to start on its own
const reportMusicStopped = () => {
    if (!isPlaying || isWaitingForGesture) return;
    if (musicDecks?.some((deck) => !deck.element.paused)) return;
    playbackStoppedHandler?.();
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
    pauseMusic();
};

export const startAllAudioLayers = () => {
    ensureInitialized();
    for (const layer of Object.keys(audioSources) as SoundCategory[]) {
        startAudioSourceForLayer(layer);
    }
    //Quickfix
    startBinauralBeat();
    resumeMusic();
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

//Two decks so one song can fade up while the other fades down. createMediaElementSource
//may only be called once per element, so each deck keeps its element for the lifetime of
//the page and only ever swaps src.
interface MusicDeck {
    element: HTMLAudioElement;
    gain: GainNode;
}

const MUSIC_CROSSFADE_SECONDS = 2.5;
//The next song is loaded this far from the end so it is buffered when the crossfade starts
const MUSIC_PRELOAD_LEAD_SECONDS = MUSIC_CROSSFADE_SECONDS + 5;
//Starting or resuming a genre fades in faster than a crossfade between songs
const MUSIC_FADE_IN_SECONDS = 0.8;

let musicDecks: MusicDeck[] | null = null;
let activeDeckIndex = 0;
let isCrossfading = false;
let crossfadeTimeout: number | null = null;
let preloadedSongIndex: number | null = null;
let deckAwaitingFadeIn: MusicDeck | null = null;

const getSongUrl = (genre: MusicGenre, song: string) => {
    //Filenames may contain spaces and brackets, so the song segment is encoded
    return `/sounds/${genre.category}/${genre.id}/${encodeURIComponent(song)}`;
};

const activeDeck = () => musicDecks![activeDeckIndex];
const standbyDeck = () => musicDecks![1 - activeDeckIndex];

const setGainNow = (deck: MusicDeck, value: number) => {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    deck.gain.gain.cancelScheduledValues(now);
    deck.gain.gain.setValueAtTime(value, now);
};

const rampGain = (deck: MusicDeck, target: number, seconds: number) => {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    deck.gain.gain.cancelScheduledValues(now);
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, now);
    deck.gain.gain.linearRampToValueAtTime(target, now + Math.max(seconds, 0.01));
};

const ensureMusicDecks = () => {
    const context = ensureInitialized();
    if (musicDecks) return musicDecks;

    musicDecks = [0, 1].map(() => {
        const element = new Audio();
        element.preload = "auto";

        const gain = context.createGain();
        //Decks start silent; every transition ramps them explicitly
        gain.gain.value = 0;
        gain.connect(gains![SoundCategory.Music]);
        context.createMediaElementSource(element).connect(gain);

        const deck: MusicDeck = { element, gain };
        element.addEventListener("timeupdate", () => onDeckTimeUpdate(deck));
        element.addEventListener("ended", () => onDeckEnded(deck));
        element.addEventListener("error", () => onDeckError(deck));
        element.addEventListener("playing", () => onDeckPlaying(deck));
        return deck;
    });

    return musicDecks;
};

const onDeckPlaying = (deck: MusicDeck) => {
    //A crossfade drives its own ramps, so only a deliberate start fades in here
    if (deckAwaitingFadeIn !== deck) return;
    deckAwaitingFadeIn = null;
    rampGain(deck, 1, MUSIC_FADE_IN_SECONDS);
};

const preloadNextSong = () => {
    if (!musicGenre || musicGenre.songs.length === 0) return;
    const nextSongIndex = (musicSongIndex + 1) % musicGenre.songs.length;
    if (preloadedSongIndex === nextSongIndex) return;

    //A one song genre crossfades into itself, which is a seamless loop
    preloadedSongIndex = nextSongIndex;
    const standby = standbyDeck();
    standby.element.src = getSongUrl(musicGenre, musicGenre.songs[nextSongIndex]);
    standby.element.load();
};

const startCrossfade = (remaining: number) => {
    if (!musicGenre || musicGenre.songs.length === 0 || !musicDecks) return;

    const outgoing = activeDeck();
    const incoming = standbyDeck();
    const nextSongIndex = (musicSongIndex + 1) % musicGenre.songs.length;
    //Never fade for longer than the outgoing song has left
    const seconds = Math.min(MUSIC_CROSSFADE_SECONDS, Math.max(remaining, 0.01));

    isCrossfading = true;
    if (preloadedSongIndex !== nextSongIndex) {
        incoming.element.src = getSongUrl(musicGenre, musicGenre.songs[nextSongIndex]);
    }
    preloadedSongIndex = null;
    musicErrorStreak = 0;

    setGainNow(incoming, 0);
    deckAwaitingFadeIn = null;

    //Handing the gain over before the next song is audible would fade the current one
    //out into silence, so the swap waits until play() reports that it really started
    const commit = () => {
        rampGain(incoming, 1, seconds);
        rampGain(outgoing, 0, seconds);

        activeDeckIndex = 1 - activeDeckIndex;
        musicSongIndex = nextSongIndex;

        //Once it is silent the old song is stopped, so it does not keep streaming unheard
        if (crossfadeTimeout !== null) window.clearTimeout(crossfadeTimeout);
        crossfadeTimeout = window.setTimeout(() => {
            outgoing.element.pause();
            setGainNow(outgoing, 0);
            isCrossfading = false;
            crossfadeTimeout = null;
        }, seconds * 1000 + 100);
    };

    //The next song could not start, so keep the current one: it plays on to its end and
    //"ended" takes over from there, rather than leaving both decks silent
    const abandon = (error: unknown) => {
        if (!isCrossfading) return;
        console.warn("[audioEngine] could not start the next song, staying on the current one", error);
        isCrossfading = false;
        preloadedSongIndex = null;
        incoming.element.pause();
        setGainNow(incoming, 0);
        setGainNow(outgoing, 1);
        //If the current song had already run out there is nothing left playing
        reportMusicStopped();
    };

    if (!isPlaying) return;
    void incoming.element.play().then(commit).catch((error) => {
        abandon(error);
        onPlayRejected(error);
    });
};

const cancelCrossfade = () => {
    if (crossfadeTimeout !== null) {
        window.clearTimeout(crossfadeTimeout);
        crossfadeTimeout = null;
    }
    isCrossfading = false;
    preloadedSongIndex = null;
    if (!musicDecks) return;
    //Whatever was fading gets silenced; the caller decides what plays next
    const standby = standbyDeck();
    standby.element.pause();
    setGainNow(standby, 0);
};

const onDeckTimeUpdate = (deck: MusicDeck) => {
    if (!musicGenre || isCrossfading || !musicDecks || deck !== activeDeck()) return;

    const remaining = deck.element.duration - deck.element.currentTime;
    if (!Number.isFinite(remaining)) return;

    if (remaining <= MUSIC_PRELOAD_LEAD_SECONDS) preloadNextSong();
    if (remaining <= MUSIC_CROSSFADE_SECONDS) startCrossfade(remaining);
};

const onDeckEnded = (deck: MusicDeck) => {
    //Only reached when the song was too short to crossfade, or timeupdate was starved
    if (isCrossfading || !musicDecks || deck !== activeDeck()) return;
    startCrossfade(MUSIC_CROSSFADE_SECONDS);
};

const onDeckError = (deck: MusicDeck) => {
    if (!musicGenre || musicGenre.songs.length === 0 || !musicDecks) return;
    //An empty src is the pause path clearing a deck, not a broken file
    if (!deck.element.getAttribute("src")) return;

    //A standby deck failing only means the song it preloaded is unusable. The song that
    //is actually playing must not be cut short for it; it is skipped when its turn comes.
    if (deck !== activeDeck()) {
        console.warn(`[audioEngine] could not preload the next song in ${musicGenre.id}`);
        preloadedSongIndex = null;
        return;
    }

    console.warn(`[audioEngine] cannot play ${musicGenre.songs[musicSongIndex]}, skipping`);
    //Give up once every song in the genre has failed in a row
    if (++musicErrorStreak >= musicGenre.songs.length) {
        musicErrorStreak = 0;
        reportMusicStopped();
        return;
    }
    musicSongIndex = (musicSongIndex + 1) % musicGenre.songs.length;
    loadCurrentSong();
};

const loadCurrentSong = (startAt = 0) => {
    if (!musicGenre || musicGenre.songs.length === 0) return;
    ensureMusicDecks();
    cancelCrossfade();

    const deck = activeDeck();

    //Drop a seek still waiting on the previous song, or it would move this one
    if (pendingSeek) {
        deck.element.removeEventListener("loadedmetadata", pendingSeek);
        pendingSeek = null;
    }

    setGainNow(deck, 0);
    deckAwaitingFadeIn = deck;
    deck.element.src = getSongUrl(musicGenre, musicGenre.songs[musicSongIndex]);

    if (startAt > 0) {
        pendingSeek = () => {
            deck.element.currentTime = startAt;
            pendingSeek = null;
        };
        deck.element.addEventListener("loadedmetadata", pendingSeek, { once: true });
    }

    //Rejects until the first user gesture, same as a suspended AudioContext
    if (isPlaying) void deck.element.play().catch(onPlayRejected);
};

const rememberGenreProgress = () => {
    if (!musicGenre || !musicDecks) return;
    musicProgress.set(musicGenre.id, {
        songIndex: musicSongIndex,
        time: activeDeck().element.currentTime,
    });
};

const pauseMusic = () => {
    musicDecks?.forEach((deck) => deck.element.pause());
};

const resumeMusic = () => {
    if (!musicGenre || !musicDecks) return;
    const deck = activeDeck();
    //Fade back in rather than clicking straight to full volume
    setGainNow(deck, 0);
    deckAwaitingFadeIn = deck;
    void deck.element.play().catch(onPlayRejected);
};

export const setMusicGenreAsync = async (newMusicGenre: MusicGenre | null) => {
    ensureInitialized();
    //Re-selecting the running genre would otherwise restart the current song
    if (musicGenre?.id === newMusicGenre?.id) return;

    rememberGenreProgress();

    if (!newMusicGenre) {
        cancelCrossfade();
        pauseMusic();
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
        decks: () => musicDecks,
        element: () => musicDecks?.[activeDeckIndex].element,
        state: () => ({
            genre: musicGenre?.id ?? null,
            song: musicGenre?.songs[musicSongIndex] ?? null,
            index: musicSongIndex,
            currentTime: musicDecks?.[activeDeckIndex].element.currentTime,
            duration: musicDecks?.[activeDeckIndex].element.duration,
            paused: musicDecks?.[activeDeckIndex].element.paused,
            isPlaying,
            isCrossfading,
            activeDeckIndex,
        }),
        progress: () => Object.fromEntries(musicProgress),
        gains: () => musicDecks?.map((deck) => +deck.gain.gain.value.toFixed(3)),
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
