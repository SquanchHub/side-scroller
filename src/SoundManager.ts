/**
 * Owns every sound the game plays - one-shot event sounds (registered by
 * name) and a static, wrapping background music queue - gated by its own
 * playEvents/playMusic toggles. Callers never hold a p5.SoundFile
 * themselves; they just name what they want played.
 */
export class SoundManager {
    playEvents: boolean;
    playMusic: boolean;
    events: { [name: string]: p5.SoundFile };
    musicQueue: p5.SoundFile[];
    musicQueueIndex: number;
    music: p5.SoundFile;

    constructor() {
        this.playEvents = true;
        this.playMusic = false;
        this.events = {};
        this.musicQueue = [];
        this.musicQueueIndex = 0;
    }

    registerEvent(name: string, sound: p5.SoundFile) {
        this.events[name] = sound;
    }

    playEvent(name: string) {
        const sound = this.events[name];
        if (sound && this.playEvents) {
            sound.play();
        }
    }

    toggleEvents() {
        this.playEvents = !this.playEvents;
    }

    setMusicQueue(queue: p5.SoundFile[]) {
        this.musicQueue = queue;
        this.musicQueueIndex = 0;
        this.music = queue[0];
    }

    // Advances to the next track (wrapping back to the start after the
    // last one). If music is currently playing, switches to it immediately;
    // otherwise just advances the pointer so playback picks up here the
    // next time it's toggled on.
    nextSong() {
        if (this.playMusic) {
            this.music.stop();
        }
        this.musicQueueIndex = (this.musicQueueIndex + 1) % this.musicQueue.length;
        this.music = this.musicQueue[this.musicQueueIndex];
        if (this.playMusic) {
            this.music.setLoop(true);
            this.music.playMode("restart");
            this.music.play();
        }
    }

    toggleMusic() {
        this.playMusic = !this.playMusic;
        if (this.playMusic) {
            this.music.setLoop(true);
            this.music.playMode("restart");
            this.music.play();
        } else {
            this.music.stop();
        }
    }
}
