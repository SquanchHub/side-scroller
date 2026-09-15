import { describe, it, expect, vi } from "vitest";
import { GameMap } from "../src/GameMap";
import { Player } from "../src/sprites/Player";
import { Grub, CreatureState } from "../src/sprites/Creature";

// Builds a GameMap without going through the constructor/initialize() (which
// needs a real, loaded ResourceManager) -- updateSprite()/checkPlayerCollision()
// only touch tiles/tile_size/soundManager/sprites, all supplied manually here.
function makeMap(sprites: Grub[]): any {
    const map: any = Object.create(GameMap.prototype);
    map.tiles = Array.from({ length: 50 }, () => [] as unknown[]); // wide open air, no walls/ground
    map.tile_size = 64;
    map.soundManager = { playEvent: vi.fn(), nextSong: vi.fn() };
    map.sprites = sprites;
    return map;
}

function makePlayer(x: number, y: number, vx: number, vy: number, airborneStreak: number): Player {
    const p = new Player();
    p.addFrame("default", { width: 64, height: 64 } as unknown as p5.Image, 100);
    p.setPosition(x, y);
    p.setVelocity(vx, vy);
    p.airborneStreak = airborneStreak;
    return p;
}

function makeGrub(x: number, y: number): Grub {
    const g = new Grub();
    g.setPosition(x, y);
    return g;
}

describe("GameMap.updateSprite() stomp vs. side-hit classification (running-jump landings)", () => {
    it("registers a stomp kill, not a player death, when vertical overlap with a 64px-tall enemy begins before horizontal alignment completes on the same frame", () => {
        // Reproduces a running-jump landing: the player has been airborne for
        // several frames (well past the ground-flicker threshold, see
        // Player.AIRBORNE_ANIM_MIN_STREAK) and already vertically overlaps
        // the grub's (fixed 64px, see Grub.getCollisionHeight()) collision
        // column from a previous frame, only catching up horizontally now.
        const grub = makeGrub(200, 300); // column x:[200,264], y:[300,364]
        const player = makePlayer(129, 320, 0.5, 0.3, 5); // x:[129,193] doesn't yet overlap [200,264]; y already overlaps

        const map = makeMap([grub]);
        map.updateSprite(player);

        expect(grub.getState()).toBe(CreatureState.DYING);
        expect(player.getState()).toBe(CreatureState.NORMAL);
    });

    it("still kills the player for a grounded side-bump into an enemy, even on the single frame gravity nudges y downward", () => {
        // A resting/grounded player (airborneStreak reset to 0, see
        // Player.update()) still has ordinary gravity added every frame --
        // this must not be mistaken for a genuine fall just because y ticks
        // up a fraction of a pixel this frame.
        const grub = makeGrub(200, 300);
        const player = makePlayer(193, 300, 0.5, 0, 0); // same height as the grub, walking straight into it

        const map = makeMap([grub]);
        map.updateSprite(player);

        expect(player.getState()).toBe(CreatureState.DYING);
        expect(grub.getState()).toBe(CreatureState.NORMAL);
    });

    it("kills the player, not the enemy, when jumping up into the underside of an enemy", () => {
        // airborneStreak alone stays high for the whole jump arc, ascending
        // included -- it's only meant to rule out the one-frame grounded
        // flicker, not to signal "is falling." Without also requiring
        // downward velocity, bumping an enemy's underside while still rising
        // registered as a stomp: same bounce, same enemy kill as landing on
        // top of it.
        const grub = makeGrub(200, 300); // column x:[200,264], y:[300,364]
        const player = makePlayer(200, 360, 0, -0.5, 5); // directly beneath, jumping straight up into it

        const map = makeMap([grub]);
        map.updateSprite(player);

        expect(player.getState()).toBe(CreatureState.DYING);
        expect(grub.getState()).toBe(CreatureState.NORMAL);
    });
});
