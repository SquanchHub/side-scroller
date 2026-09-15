import { describe, it, expect, vi } from "vitest";
import { GameMap } from "../src/GameMap";
import { Projectile } from "../src/sprites/Projectile";
import { Player } from "../src/sprites/Player";
import { Grub, CreatureState } from "../src/sprites/Creature";
import type { ResourceManager } from "../src/ResourceManager";
import type { SoundManager } from "../src/SoundManager";

// Same Object.create(GameMap.prototype) technique as
// GameMap.acquirePowerUp.test.ts. updateProjectiles() (via updateSprite())
// additionally needs tile_size/tiles for gravity+tile-collision, so those are
// hand-wired too - a generously-sized empty grid by default so gravity can be
// exercised without incidentally colliding with anything. Also needs
// resources (a projectile spawns an "explosion" effect via spawnEffect() the
// moment it's removed, for whatever reason) - a minimal cloneable stand-in
// is enough since these tests don't inspect the spawned effect itself.
function makeGameMap() {
    const map = Object.create(GameMap.prototype) as GameMap;
    map.sprites = [];
    map.projectiles = [];
    map.soundManager = { playEvent: vi.fn(), nextSong: vi.fn() } as unknown as SoundManager;
    map.tile_size = 64;
    map.tiles = Array.from({ length: 20 }, () => new Array(20));
    map.resources = {
        get: () => ({ clone: () => ({ setPosition: vi.fn() }) }),
    } as unknown as ResourceManager;
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

// clone() (used by spawnProjectile()) only carries over real animation
// frames, not ad-hoc instance overrides like withMockImage() above - so the
// "projectile" resource template needs an actual frame for the clone's
// getImage() to work.
function makeProjectileTemplate(width: number, height: number): Projectile {
    const p = new Projectile();
    p.addFrame("default", { width, height } as unknown as p5.Image, 100);
    return p;
}

describe("GameMap projectile physics", () => {
    it("gravity pulls the projectile downward over several ticks when nothing blocks it", () => {
        const map = makeGameMap();
        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(300, 100);
        p.setVelocity(0, 0); // zero initial vertical velocity - gravity alone should pull it down
        map.projectiles.push(p);

        for (let i = 0; i < 5; i++) {
            map.updateProjectiles();
        }

        expect(p.getPosition().y).toBeGreaterThan(100);
    });

    it("landing on the ground does NOT destroy it - it comes to rest vertically and keeps rolling horizontally", () => {
        const map = makeGameMap();
        map.tiles[4][4] = {} as p5.Image; // ground occupying x:[256,320) y:[256,320)
        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(270, 239); // just above the ground's top edge, falling toward it
        p.setVelocity(0.2, 0.3); // rolling right while it falls

        map.projectiles.push(p);
        map.updateProjectiles();

        expect(p.hitSomething).toBe(false);
        expect(map.projectiles).toContain(p);
        expect(p.getVelocity().y).toBe(0); // resting on the ground
        expect(p.getVelocity().x).toBeCloseTo(0.2); // still rolling

        const xAfterLanding = p.getPosition().x;
        map.updateProjectiles(); // one more tick while resting on the ground

        expect(p.getPosition().x).toBeGreaterThan(xAfterLanding); // kept rolling
        expect(map.projectiles).toContain(p); // still alive
    });

    it("hitting a tile horizontally also sets hitSomething and removes the projectile", () => {
        const map = makeGameMap();
        map.tiles[5][2] = {} as p5.Image; // a "wall" occupying x:[320,384) y:[128,192)
        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(303, 150); // moving right toward the wall
        p.setVelocity(0.6, 0);
        map.projectiles.push(p);

        map.updateProjectiles();

        expect(p.hitSomething).toBe(true);
        expect(map.projectiles).not.toContain(p);
    });

    it("kills a NORMAL enemy on overlap: enemy dies, projectile is removed, hit sound plays", () => {
        const map = makeGameMap();
        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        map.sprites.push(grub);

        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(300, 100);
        map.projectiles.push(p);

        map.updateProjectiles();

        expect(grub.getState()).toBe(CreatureState.DYING);
        expect(map.projectiles).not.toContain(p);
        expect(map.soundManager.playEvent).toHaveBeenCalledWith("fireHit");
    });

    it("does not interact with a DYING/DEAD creature (regression of isCollision()'s existing state exclusion)", () => {
        const map = makeGameMap();
        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        grub.setState(CreatureState.DYING);
        map.sprites.push(grub);

        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(300, 100);
        map.projectiles.push(p);

        map.updateProjectiles();

        expect(map.soundManager.playEvent).not.toHaveBeenCalled();
        expect(map.projectiles).toContain(p); // untouched by the (excluded) enemy overlap
    });

    it("removes the projectile once its LIFETIME has fully elapsed with no collision", () => {
        const map = makeGameMap();
        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(300, 100);
        map.projectiles.push(p);

        const ticks = Math.ceil(p.LIFETIME / 16) + 1;
        for (let i = 0; i < ticks; i++) {
            map.updateProjectiles();
        }

        expect(map.projectiles).not.toContain(p);
    });

    it("spawns an explosion effect at the ENEMY's position when it hits one, not the projectile's", () => {
        const map = makeGameMap();
        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        map.sprites.push(grub);

        // Overlapping but not identical positions - isCollision() only needs
        // overlap, not an exact match, so this also guards against the
        // explosion accidentally landing on the projectile's spot instead.
        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(305, 105);
        map.projectiles.push(p);

        const spawnSpy = vi.spyOn(map, "spawnEffect");
        map.updateProjectiles();

        expect(spawnSpy).toHaveBeenCalledWith("explosion", 300, 100);
    });

    it("spawns an explosion effect at the projectile's position when it hits a wall", () => {
        const map = makeGameMap();
        map.tiles[5][2] = {} as p5.Image; // a "wall" occupying x:[320,384) y:[128,192)
        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(303, 150); // moving right toward the wall
        p.setVelocity(0.6, 0);
        map.projectiles.push(p);

        const spawnSpy = vi.spyOn(map, "spawnEffect");
        map.updateProjectiles();

        expect(spawnSpy).toHaveBeenCalledWith("explosion", p.getPosition().x, p.getPosition().y);
    });

    it("spawns an explosion effect when a projectile expires with no collision", () => {
        const map = makeGameMap();
        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(300, 100);
        map.projectiles.push(p);

        const spawnSpy = vi.spyOn(map, "spawnEffect");
        const ticks = Math.ceil(p.LIFETIME / 16) + 1;
        for (let i = 0; i < ticks; i++) {
            map.updateProjectiles();
        }

        expect(spawnSpy).toHaveBeenCalledWith("explosion", expect.any(Number), expect.any(Number));
    });

    it("does NOT spawn an explosion while a projectile is still alive and flying", () => {
        const map = makeGameMap();
        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(300, 100);
        map.projectiles.push(p);

        const spawnSpy = vi.spyOn(map, "spawnEffect");
        map.updateProjectiles();

        expect(spawnSpy).not.toHaveBeenCalled();
    });

    it("processes multiple simultaneous projectiles independently in one tick", () => {
        const map = makeGameMap();
        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        map.sprites.push(grub);

        const hitter = withMockImage(new Projectile(), 16, 16);
        hitter.setPosition(300, 100); // overlaps the grub
        const flyer = withMockImage(new Projectile(), 16, 16);
        flyer.setPosition(600, 100); // far away, no overlap
        map.projectiles.push(hitter, flyer);

        map.updateProjectiles();

        expect(map.projectiles).not.toContain(hitter);
        expect(map.projectiles).toContain(flyer);
        expect(grub.getState()).toBe(CreatureState.DYING);
        expect(map.soundManager.playEvent).toHaveBeenCalledTimes(1); // flyer didn't also trigger a hit sound
        expect(map.soundManager.playEvent).toHaveBeenCalledWith("fireHit");
    });
});

describe("GameMap.spawnProjectile()", () => {
    function makeGameMapWithPlayer() {
        const map = makeGameMap();
        const player = withMockImage(new Player(), 32, 32);
        player.setPosition(100, 200);
        map.player = player;
        const template = makeProjectileTemplate(16, 16);
        map.resources = {
            get: (name: string) =>
                name === "projectile" ? template : { clone: () => ({ setPosition: vi.fn() }) },
        } as unknown as ResourceManager;
        return map;
    }

    it("spawns a projectile just past the player's right edge when facing right, moving right", () => {
        const map = makeGameMapWithPlayer();
        map.spawnProjectile(1);

        expect(map.projectiles).toHaveLength(1);
        const p = map.projectiles[0];
        expect(p.getPosition().x).toBe(100 + 32); // playerPos.x + playerImg.width
        expect(p.getVelocity().x).toBeCloseTo(p.SPEED);
    });

    it("spawns a projectile just past the player's left edge when facing left, moving left", () => {
        const map = makeGameMapWithPlayer();
        map.spawnProjectile(-1);

        const p = map.projectiles[0];
        expect(p.getPosition().x).toBe(100 - p.getImage().width);
        expect(p.getVelocity().x).toBeCloseTo(-p.SPEED);
    });

    it("plays the launch sound", () => {
        const map = makeGameMapWithPlayer();
        map.spawnProjectile(1);
        expect(map.soundManager.playEvent).toHaveBeenCalledWith("fireLaunch");
    });

    it("a shot fired point-blank into a wall the player is already touching fizzles on the very next tick (expected, not a crash)", () => {
        const map = makeGameMapWithPlayer();
        for (let y = 0; y < 20; y++) {
            map.tiles[2][y] = {} as p5.Image; // solid wall filling the whole column
        }
        map.player.setPosition(100, 190); // right edge at 132, inside the wall's column ([128,192))

        map.spawnProjectile(1);
        expect(map.projectiles).toHaveLength(1);

        map.updateProjectiles();
        expect(map.projectiles).toHaveLength(0);
    });
});
