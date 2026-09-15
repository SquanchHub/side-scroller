import { describe, it, expect, vi } from "vitest";
import { GameMap } from "../src/GameMap";
import { Player } from "../src/sprites/Player";
import { Grub, CreatureState } from "../src/sprites/Creature";
import { Star } from "../src/sprites/PowerUp";
import type { SoundManager } from "../src/SoundManager";

// Same Object.create(GameMap.prototype) technique as the other GameMap test
// files. checkPlayerCollision() only reads/writes this.sprites, this.player
// (indirectly, via the passed-in Player), and this.soundManager (all sound
// playback routes through it now), so those are the only fields hand-wired
// here.
function makeGameMap() {
    const map = Object.create(GameMap.prototype) as GameMap;
    map.sprites = [];
    map.soundManager = { playEvent: vi.fn(), nextSong: vi.fn() } as unknown as SoundManager;
    return map;
}

function withMockImage<T extends { getImage: () => p5.Image }>(
    sprite: T,
    width: number,
    height: number
): T {
    (sprite as any).getImage = () => ({ width, height });
    return sprite;
}

describe("GameMap.checkPlayerCollision() with an overlapping Creature and PowerUp at the same spot", () => {
    it("landing on top (canKill=true) kills the creature AND collects the powerup, in the same call", () => {
        const map = makeGameMap();
        const player = withMockImage(new Player(), 16, 16);
        player.setPosition(300, 100);

        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        const star = withMockImage(new Star(), 16, 16);
        star.setPosition(300, 100);
        // Array order matters for the bug this test guards against - put the
        // powerup first so the old first-match-only logic would have masked
        // the creature entirely.
        map.sprites.push(star, grub);

        map.checkPlayerCollision(player, true);

        expect(grub.getState()).toBe(CreatureState.DYING);
        expect(map.sprites).not.toContain(star);
        expect(map.soundManager.playEvent).toHaveBeenCalledWith("prize");
        expect(player.getState()).toBe(CreatureState.NORMAL); // stomping, not dying
    });

    it("landing on top still works when the creature happens to be first in the sprites array", () => {
        const map = makeGameMap();
        const player = withMockImage(new Player(), 16, 16);
        player.setPosition(300, 100);

        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        const star = withMockImage(new Star(), 16, 16);
        star.setPosition(300, 100);
        map.sprites.push(grub, star);

        map.checkPlayerCollision(player, true);

        expect(grub.getState()).toBe(CreatureState.DYING);
        expect(map.sprites).not.toContain(star);
    });

    it("touching from the side (canKill=false) still kills the player, regardless of a powerup also overlapping", () => {
        const map = makeGameMap();
        const player = withMockImage(new Player(), 16, 16);
        player.setPosition(300, 100);

        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        const star = withMockImage(new Star(), 16, 16);
        star.setPosition(300, 100);
        map.sprites.push(star, grub);

        map.checkPlayerCollision(player, false);

        expect(player.getState()).toBe(CreatureState.DYING);
        expect(grub.getState()).toBe(CreatureState.NORMAL); // not a stomp - the creature doesn't die
    });

    it("a lone powerup with no creature overlap is still collected as before", () => {
        const map = makeGameMap();
        const player = withMockImage(new Player(), 16, 16);
        player.setPosition(300, 100);
        const star = withMockImage(new Star(), 16, 16);
        star.setPosition(300, 100);
        map.sprites.push(star);

        map.checkPlayerCollision(player, false);

        expect(map.sprites).not.toContain(star);
        expect(player.getState()).toBe(CreatureState.NORMAL);
    });

    it("a lone NORMAL creature touched from the side is still fatal as before (regression)", () => {
        const map = makeGameMap();
        const player = withMockImage(new Player(), 16, 16);
        player.setPosition(300, 100);
        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        map.sprites.push(grub);

        map.checkPlayerCollision(player, false);

        expect(player.getState()).toBe(CreatureState.DYING);
    });
});
