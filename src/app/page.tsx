import AudioControllerInitializer from "@/features/audio-player/components/AudioControllerInitializer";
import AudioControls from "@/features/audio-player/components/AudioControls";
import SoundCardRow from "@/features/audio-player/components/SoundCardRow";
import TodoDrawer from "@/features/todo/components/TodoDrawer";
import { getBinauralBeats, getMusicGenres, getWhiteNoise } from "@/features/audio-player/soundService";
import PomoTimer from "@/features/timer/components/Timer";

export default function Home() {

  return (
    <main className="flex flex-1 flex-col items-center w-full px-0 pt-8 pb-4 sm:px-4 sm:pt-12 lg:px-16 lg:pt-16">
      <AudioControllerInitializer />
      <div className="flex flex-col flex-1 gap-6 sm:gap-8 w-full">
        <SoundCardRow sounds={getMusicGenres()} label="Music" />
        <SoundCardRow sounds={getBinauralBeats()} label="Binaural Beats" />
        <SoundCardRow sounds={getWhiteNoise()} label="White Noise" />
      </div>
      <div className="flex w-full flex-row items-center justify-between p-1">
        <PomoTimer />
        <AudioControls />
        <TodoDrawer />
      </div>
    </main>
  );
}
