import { describe, it, expect, vi } from "vitest";
import { GameMap } from "../src/GameMap";
import { Player } from "../src/sprites/Player";
import { FireOrb, Heart, Music, Star } from "../src/sprites/PowerUp";
import type { SoundManager } from "../src/SoundManager";

// GameMap's real constructor calls initialize(), which needs a working
// ResourceManager (p5/DOM-dependent, unavailable under Node) - no prior test
// in this repo instantiates GameMap for real (GameMap.isCollision.test.ts
// tests a standalone replica instead). acquirePowerUp() only reads/writes
// this.sprites, this.player, and this.soundManager (all sound playback
// routes through it now, including the playEvents/nextSong gating, which is
// SoundManager's own responsibility and tested there), so - mirroring the
// Object.create(...) technique the GameManager tests already use for the
// same reason - those are the only fields hand-wired here.
function makeGameMap() {
    const map = Object.create(GameMap.prototype) as GameMap;
    map.sprites = [];
    map.player = new Player();
    map.soundManager = { playEvent: vi.fn(), nextSong: vi.fn() } as unknown as SoundManager;
    return map;
}

describe("GameMap.acquirePowerUp()", () => {
    it("FireOrb: removes the sprite, grants the player's fire ability, and plays a pickup sound", () => {
        const map = makeGameMap();
        const orb = new FireOrb();
        map.sprites.push(orb);

        map.acquirePowerUp(orb);

        expect(map.sprites).not.toContain(orb);
        expect(map.player.hasFireAbility()).toBe(true);
        expect(map.soundManager.playEvent).toHaveBeenCalledWith("fireOrbPickup");
    });

    it("Music: removes the sprite and advances the background music queue (previously played a pickup sound; now the track change itself is the feedback)", () => {
        const map = makeGameMap();
        const note = new Music();
        map.sprites.push(note);

        map.acquirePowerUp(note);

        expect(map.sprites).not.toContain(note);
        expect(map.soundManager.nextSong).toHaveBeenCalledTimes(1);
    });

    it("Heart: removes the sprite, plays a pickup sound (previously silent), and advances the level", () => {
        const map = makeGameMap();
        (map as any).initialize = vi.fn(); // avoid the real initialize()'s ResourceManager dependency
        map.level = 0;
        const heart = new Heart();
        map.sprites.push(heart);

        map.acquirePowerUp(heart);

        expect(map.sprites).not.toContain(heart);
        expect(map.soundManager.playEvent).toHaveBeenCalledWith("heartPickup");
        expect(map.level).toBe(1);
        expect((map as any).initialize).toHaveBeenCalledTimes(1);
    });

    it("Star: still removes the sprite and plays the prize sound (regression)", () => {
        const map = makeGameMap();
        const star = new Star();
        map.sprites.push(star);

        map.acquirePowerUp(star);

        expect(map.sprites).not.toContain(star);
        expect(map.soundManager.playEvent).toHaveBeenCalledWith("prize");
    });
});
