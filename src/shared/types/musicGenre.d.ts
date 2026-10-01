import type { Sound } from "./sound";
import { SoundCategory } from "./soundCategory";

export interface MusicGenre extends Sound {
    category: SoundCategory.Music;
    //Filenames incl. extension, played in this order, relative to /sounds/music/<id>/
    songs: string[];
}
