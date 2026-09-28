import AudioControllerInitializer from "@/features/audio-player/components/AudioControllerInitializer";
import AudioControls from "@/features/audio-player/components/AudioControls";
import SoundCardRow from "@/features/audio-player/components/SoundCardRow";
import TodoDrawer from "@/features/todo/components/TodoDrawer";
import { getBinauralBeats, getMusicTracks, getWhiteNoise } from "@/features/audio-player/soundService";

export default function Home() {

  return (
    <main className="flex flex-1 flex-col items-center w-full px-0 pt-8 pb-4 sm:px-4 sm:pt-12 lg:px-16 lg:pt-16">
      <AudioControllerInitializer />
      <div className="flex flex-col flex-1 gap-6 sm:gap-8 w-full">
        <SoundCardRow sounds={getMusicTracks()} label="Music" />
        <SoundCardRow sounds={getBinauralBeats()} label="Binaural Beats" />
        <SoundCardRow sounds={getWhiteNoise()} label="White Noise" />
      </div>
      <div className="relative flex w-full flex-row items-center justify-center">
        <AudioControls />
        <div className="absolute right-0">
          <TodoDrawer />
        </div>
      </div>
    </main>
  );
}
