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
    it("landing on top (isFalling=true) kills the creature AND collects the powerup, in the same call", () => {
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

    it("touching from the side (isFalling=false) still kills the player, regardless of a powerup also overlapping", () => {
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

describe("GameMap.checkPlayerCollision() dash kill", () => {
    it("dashing into a creature (isFalling=false, isDashing=true) destroys it without bouncing or killing the player", () => {
        const map = makeGameMap();
        const player = withMockImage(new Player(), 16, 16);
        player.setPosition(300, 100);
        player.dash();
        const jumpSpy = vi.spyOn(player, "jump");

        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        map.sprites.push(grub);

        map.checkPlayerCollision(player, false);

        expect(grub.getState()).toBe(CreatureState.DYING);
        expect(jumpSpy).not.toHaveBeenCalled();
        expect(player.getState()).toBe(CreatureState.NORMAL); // player survives, keeps dashing
        expect(map.soundManager.playEvent).toHaveBeenCalledWith("boop2");
    });

    it("a mid-air dash kill takes priority over a stomp even when isFalling is also true", () => {
        // Regression: dash() never touches vertical velocity, so gravity
        // keeps accruing during a mid-air dash and GameMap.updateSprite()
        // can compute isFalling=true a couple of frames into the dash.
        // Dashing into an enemy should still be a clean pass-through kill,
        // not a stomp bounce+reposition on top of the active dash.
        const map = makeGameMap();
        const player = withMockImage(new Player(), 16, 16);
        player.setPosition(300, 100);
        player.dash();
        const jumpSpy = vi.spyOn(player, "jump");

        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        map.sprites.push(grub);

        map.checkPlayerCollision(player, true); // isFalling=true, as updateSprite would compute mid-air

        expect(grub.getState()).toBe(CreatureState.DYING);
        expect(jumpSpy).not.toHaveBeenCalled();
        expect(player.getState()).toBe(CreatureState.NORMAL);
    });

    it("a dash kill still spawns the creature's death effect, same as a stomp kill", () => {
        // Regression guard for the merge with main's fire-ability branch:
        // checkPlayerCollision's dash-kill branch must go through
        // GameMap.killCreature() (not a bare setState(DYING)) so grub/fly
        // still spawn their bugjuice splat when dashed through, not just
        // when stomped.
        const map = makeGameMap();
        const player = withMockImage(new Player(), 16, 16);
        player.setPosition(300, 100);
        player.dash();

        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        grub.deathEffect = "bugjuice";
        map.sprites.push(grub);

        const spawnSpy = vi.spyOn(map, "spawnEffect").mockImplementation(() => {});
        map.checkPlayerCollision(player, false);

        expect(spawnSpy).toHaveBeenCalledWith("bugjuice", 300, 100);
    });
});
