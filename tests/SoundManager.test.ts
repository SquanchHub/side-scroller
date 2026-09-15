import { describe, it, expect, vi, beforeEach } from "vitest";
import { SoundManager } from "../src/SoundManager";

function makeSound(): p5.SoundFile {
    return {
        play: vi.fn(),
        stop: vi.fn(),
        setLoop: vi.fn(),
        playMode: vi.fn(),
    } as unknown as p5.SoundFile;
}

describe("SoundManager event sounds", () => {
    let sm: SoundManager;
    let sound: p5.SoundFile;

    beforeEach(() => {
        sm = new SoundManager();
        sound = makeSound();
        sm.registerEvent("boop", sound);
    });

    it("playEvent() plays a registered sound by name", () => {
        sm.playEvent("boop");
        expect(sound.play).toHaveBeenCalledTimes(1);
    });

    it("playEvent() does nothing when playEvents is toggled off", () => {
        sm.toggleEvents();
        sm.playEvent("boop");
        expect(sound.play).not.toHaveBeenCalled();
    });

    it("playEvent() does not throw for an unregistered name", () => {
        expect(() => sm.playEvent("does-not-exist")).not.toThrow();
    });

    it("toggleEvents() flips playEvents each call", () => {
        expect(sm.playEvents).toBe(true);
        sm.toggleEvents();
        expect(sm.playEvents).toBe(false);
        sm.toggleEvents();
        expect(sm.playEvents).toBe(true);
    });
});

describe("SoundManager music queue", () => {
    let sm: SoundManager;
    let queue: p5.SoundFile[];

    beforeEach(() => {
        sm = new SoundManager();
        queue = [makeSound(), makeSound(), makeSound()];
    });

    it("setMusicQueue() starts at the first track", () => {
        sm.setMusicQueue(queue);
        expect(sm.music).toBe(queue[0]);
        expect(sm.musicQueueIndex).toBe(0);
    });

    it("nextSong() advances to the next track in order", () => {
        sm.setMusicQueue(queue);
        sm.nextSong();
        expect(sm.music).toBe(queue[1]);
    });

    it("nextSong() wraps back to the first track after the last", () => {
        sm.setMusicQueue(queue);
        sm.nextSong();
        sm.nextSong();
        sm.nextSong();
        expect(sm.music).toBe(queue[0]);
    });

    it("nextSong() does not start playback while music is toggled off", () => {
        sm.setMusicQueue(queue);
        sm.nextSong();
        expect(queue[1].play).not.toHaveBeenCalled();
    });

    it("nextSong() stops the old track and plays the new one, looping, once music is toggled on", () => {
        sm.setMusicQueue(queue);
        sm.toggleMusic();
        sm.nextSong();
        expect(queue[0].stop).toHaveBeenCalledTimes(1);
        expect(queue[1].play).toHaveBeenCalledTimes(1);
        expect(queue[1].setLoop).toHaveBeenCalledWith(true);
        expect(queue[1].playMode).toHaveBeenCalledWith("restart");
    });

    it("toggleMusic() on starts the current track; off stops it", () => {
        sm.setMusicQueue(queue);
        sm.toggleMusic();
        expect(sm.playMusic).toBe(true);
        expect(queue[0].play).toHaveBeenCalledTimes(1);

        sm.toggleMusic();
        expect(sm.playMusic).toBe(false);
        expect(queue[0].stop).toHaveBeenCalledTimes(1);
    });
});
