import { describe, it, expect, vi } from "vitest";
import { GameMap } from "../src/GameMap";
import { Player } from "../src/sprites/Player";
import { FireOrb, Music, Star } from "../src/sprites/PowerUp";
import type { Settings } from "../src/Settings";

// GameMap's real constructor calls initialize(), which needs a working
// ResourceManager (p5/DOM-dependent, unavailable under Node) - no prior test
// in this repo instantiates GameMap for real (GameMap.isCollision.test.ts
// tests a standalone replica instead). acquirePowerUp() only reads/writes
// this.sprites, this.player, this.settings, and the sound fields it plays
// (prize/boop), so - mirroring the Object.create(...) technique the
// GameManager tests already use for the same reason - those are the only
// fields hand-wired here.
function makeGameMap() {
    const map = Object.create(GameMap.prototype) as GameMap;
    map.sprites = [];
    map.player = new Player();
    map.settings = { playEvents: true } as unknown as Settings;
    map.prize = { play: vi.fn() } as unknown as p5.SoundFile;
    map.boop = { play: vi.fn() } as unknown as p5.SoundFile;
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
        expect(map.prize.play).toHaveBeenCalledTimes(1);
    });

    it("Music: removes the sprite and plays a sound (previously a no-op)", () => {
        const map = makeGameMap();
        const note = new Music();
        map.sprites.push(note);

        map.acquirePowerUp(note);

        expect(map.sprites).not.toContain(note);
        expect(map.prize.play).toHaveBeenCalledTimes(1);
    });

    it("Star: still removes the sprite and plays the prize sound (regression)", () => {
        const map = makeGameMap();
        const star = new Star();
        map.sprites.push(star);

        map.acquirePowerUp(star);

        expect(map.sprites).not.toContain(star);
        expect(map.prize.play).toHaveBeenCalledTimes(1);
    });

    it("respects settings.playEvents=false (no sound played)", () => {
        const map = makeGameMap();
        map.settings = { playEvents: false } as unknown as Settings;
        const orb = new FireOrb();
        map.sprites.push(orb);

        map.acquirePowerUp(orb);

        expect(map.player.hasFireAbility()).toBe(true); // the ability grant itself is unaffected
        expect(map.prize.play).not.toHaveBeenCalled();
    });
});
