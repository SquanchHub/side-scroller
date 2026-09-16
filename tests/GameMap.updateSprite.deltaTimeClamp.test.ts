import { describe, it, expect, afterEach } from "vitest";
import { GameMap, MAX_PHYSICS_DELTA_TIME } from "../src/GameMap";
import { Player } from "../src/sprites/Player";

// GameMap.updateSprite() reads the p5 global `deltaTime` directly (see
// tests/setup.ts for the normal fixed-16 mock). These tests temporarily
// override it to simulate a stutter -- e.g. the hitch GameMap.initialize()
// can cause right as a level loads -- and must restore it afterward so
// other test files keep seeing the standard steady-frame-rate value.
const originalDeltaTime = (globalThis as any).deltaTime;
afterEach(() => {
    (globalThis as any).deltaTime = originalDeltaTime;
});

function makeMap(): any {
    const map: any = Object.create(GameMap.prototype);
    map.tiles = Array.from({ length: 100 }, () => [] as unknown[]); // wide open air, no walls/ground
    map.tile_size = 64;
    map.soundManager = { playEvent: () => {}, nextSong: () => {} };
    map.sprites = [];
    return map;
}

function makeDashingPlayer(): Player {
    const p = new Player();
    // Creature.update() (called via player.update() below) switches to
    // whatever getDesiredAnimation() returns unconditionally, so every
    // animation reachable over this test's run needs real frames or
    // currAnimation goes undefined on the next tick: "dashLeft" while
    // dashing, then (once the dash ends, still airborne in this open-air
    // test map with no ground to land on) "jumpDownLeft".
    for (const anim of ["default", "dashLeft", "jumpDownLeft", "left"]) {
        p.addAnimation(anim);
        p.addFrame(anim, { width: 64, height: 64 } as unknown as p5.Image, 100);
    }
    p.setPosition(100, 100);
    p.setVelocity(-0.5, 0); // facing left, so dash direction is unambiguous
    p.dash();
    p.setVelocity(p.getDashVelocityX(), 0); // GameManager.processActions() does this once dashing
    return p;
}

describe("GameMap.updateSprite() clamps the per-frame physics timestep", () => {
    it("a single frame's movement is bounded even when deltaTime spikes far past a normal frame", () => {
        const map = makeMap();
        const player = makeDashingPlayer();
        const startX = player.getPosition().x;

        (globalThis as any).deltaTime = 500; // simulate a large stutter (e.g. right after a level load)
        map.updateSprite(player);

        const traveled = Math.abs(player.getPosition().x - startX);
        const maxAllowed = player.DASH_SPEED * MAX_PHYSICS_DELTA_TIME;
        expect(traveled).toBeLessThanOrEqual(maxAllowed + 1e-9);
    });

    it("normal frame timing is unaffected by the clamp", () => {
        const map = makeMap();
        const player = makeDashingPlayer();
        const startX = player.getPosition().x;

        (globalThis as any).deltaTime = 16; // well under MAX_PHYSICS_DELTA_TIME
        map.updateSprite(player);

        const traveled = Math.abs(player.getPosition().x - startX);
        expect(traveled).toBeCloseTo(player.DASH_SPEED * 16, 5);
    });

    it("total dash distance stays consistent regardless of a mid-dash stutter frame", () => {
        // The real-world symptom this guards against: dashing right after a
        // level loads (one or two stutter frames) covered noticeably more
        // ground than the same dash once frame timing settled down.
        const steadyMap = makeMap();
        const steadyPlayer = makeDashingPlayer();
        (globalThis as any).deltaTime = 16;
        for (let i = 0; i < 10; i++) {
            steadyMap.updateSprite(steadyPlayer);
            steadyPlayer.update(16);
        }
        const steadyDistance = Math.abs(steadyPlayer.getPosition().x - 100);

        const stutterMap = makeMap();
        const stutterPlayer = makeDashingPlayer();
        (globalThis as any).deltaTime = 16;
        stutterMap.updateSprite(stutterPlayer); // one normal frame
        stutterPlayer.update(16);
        (globalThis as any).deltaTime = 500; // then a big stutter frame mid-dash
        stutterMap.updateSprite(stutterPlayer);
        stutterPlayer.update(500);
        (globalThis as any).deltaTime = 16;
        for (let i = 0; i < 8; i++) {
            stutterMap.updateSprite(stutterPlayer);
            stutterPlayer.update(16);
        }
        const stutterDistance = Math.abs(stutterPlayer.getPosition().x - 100);

        // Without the clamp, the stutter frame alone could cover ~30x a
        // normal frame's distance at DASH_SPEED; with it, the total should
        // land in the same ballpark as the steady-frame-rate run.
        expect(stutterDistance).toBeLessThan(steadyDistance * 1.5);
    });
});
