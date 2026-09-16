import { describe, it, expect, vi } from "vitest";
import { GameMap } from "../src/GameMap";
import { Projectile } from "../src/sprites/Projectile";
import { Bullet } from "../src/sprites/Bullet";
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
// moment it's removed, for whatever reason) - a minimal cloneable stand-in is
// enough since these tests don't inspect the spawned effect itself, but it
// also needs getImage() (real explosion frames are 64x64) since
// updateProjectiles() reads the explosion's own size to center it on a wall
// hit or fizzle-out.
function makeGameMap() {
    const map = Object.create(GameMap.prototype) as GameMap;
    map.sprites = [];
    map.projectiles = [];
    map.soundManager = { playEvent: vi.fn(), nextSong: vi.fn() } as unknown as SoundManager;
    map.tile_size = 64;
    map.tiles = Array.from({ length: 20 }, () => new Array(20));
    map.resources = {
        get: () => ({
            clone: () => ({ setPosition: vi.fn() }),
            getImage: () => ({ width: 64, height: 64 }),
        }),
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
// "projectile" resource template needs actual frames for the clone's
// getImage() to work. spawnProjectile() also sets the clone's animation to
// "left"/"right" once at launch (see GameMap.ts), so both need frames too,
// not just "default".
function makeProjectileTemplate(width: number, height: number): Projectile {
    const p = new Projectile();
    for (const anim of ["default", "left", "right"]) {
        p.addAnimation(anim);
        p.addFrame(anim, { width, height } as unknown as p5.Image, 100);
    }
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

    it("hitting a tile horizontally also sets hitSomething and removes the projectile (one frame later)", () => {
        const map = makeGameMap();
        map.tiles[5][2] = {} as p5.Image; // a "wall" occupying x:[320,384) y:[128,192)
        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(303, 150); // moving right toward the wall
        p.setVelocity(0.6, 0);
        map.projectiles.push(p);

        map.updateProjectiles();

        expect(p.hitSomething).toBe(true);
        // Still present for one more frame -- see updateProjectiles()'s
        // pendingRemoval comment: this lets it actually be drawn once at the
        // wall-snapped position before disappearing.
        expect(map.projectiles).toContain(p);

        map.updateProjectiles();
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
        expect(map.soundManager.playEvent).toHaveBeenCalledWith("fireHit");
        expect(map.projectiles).toContain(p); // removed one frame later, see pendingRemoval

        map.updateProjectiles();
        expect(map.projectiles).not.toContain(p);
    });

    it("incinerates its target instantly: no body, no separate deathEffect splat, just the fireball's own explosion", () => {
        const map = makeGameMap();
        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        grub.deathEffect = "bugjuice"; // set by ResourceManager for a real grub
        map.sprites.push(grub);

        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(300, 100);
        map.projectiles.push(p);

        const spawnSpy = vi.spyOn(map, "spawnEffect");
        map.updateProjectiles();

        expect(grub.getState()).toBe(CreatureState.DYING);
        expect(grub.explodesOnDeath).toBe(true); // hidden and physics-frozen, like player/caveman
        // Only the fireball's own detonation -- never the grub's bugjuice.
        expect(spawnSpy).toHaveBeenCalledTimes(1);
        expect(spawnSpy).toHaveBeenCalledWith("explosion", 300, 100);
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

    it("centers the explosion on the fireball's leading tip -- the exact point of impact -- on a wall hit", () => {
        const map = makeGameMap();
        map.tiles[5][2] = {} as p5.Image; // a "wall" occupying x:[320,384) y:[128,192)
        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(303, 150); // moving right toward the wall
        p.setVelocity(0.6, 0);
        map.projectiles.push(p);

        const spawnSpy = vi.spyOn(map, "spawnEffect");
        map.updateProjectiles();

        // updateSprite()'s horizontal tile-collision snap places the
        // projectile's right edge (its direction of travel) exactly on the
        // wall surface (x=320) -- the explosion (64x64, per makeGameMap()'s
        // resources mock) should be centered on that point, not on the
        // projectile's own top-left corner.
        const finalPos = p.getPosition();
        const tipX = finalPos.x + p.getCollisionWidth(); // == 320, the wall surface
        const tipY = finalPos.y + p.getCollisionHeight() / 2;
        expect(spawnSpy).toHaveBeenCalledWith("explosion", tipX - 32, tipY - 32);
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

    it("centers the fizzle-out explosion on the fireball's tip in its direction of travel (leftward)", () => {
        const map = makeGameMap();
        const p = withMockImage(new Projectile(), 16, 16);
        p.setPosition(300, 100);
        p.setVelocity(-0.6, 0); // traveling left, so the tip is the LEFT edge
        map.projectiles.push(p);

        const spawnSpy = vi.spyOn(map, "spawnEffect");
        const ticks = Math.ceil(p.LIFETIME / 16) + 1;
        for (let i = 0; i < ticks; i++) {
            map.updateProjectiles();
        }

        const finalPos = p.getPosition();
        const tipX = finalPos.x; // left edge, not finalPos.x + width
        const tipY = finalPos.y + p.getCollisionHeight() / 2;
        expect(spawnSpy).toHaveBeenCalledWith("explosion", tipX - 32, tipY - 32);
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

        expect(map.projectiles).toContain(hitter); // removed one frame later, see pendingRemoval
        expect(map.projectiles).toContain(flyer);
        expect(grub.getState()).toBe(CreatureState.DYING);
        expect(map.soundManager.playEvent).toHaveBeenCalledTimes(1); // flyer didn't also trigger a hit sound
        expect(map.soundManager.playEvent).toHaveBeenCalledWith("fireHit");

        map.updateProjectiles();
        expect(map.projectiles).not.toContain(hitter);
        expect(map.projectiles).toContain(flyer); // still flying, untouched
        expect(map.soundManager.playEvent).toHaveBeenCalledTimes(1); // no repeat hit sound on the deferred removal
    });
});

describe("GameMap projectile physics with a Bullet (explodesOnRemoval=false)", () => {
    it("kills an enemy on overlap the same way a fireball does, but spawns no explosion effect", () => {
        const map = makeGameMap();
        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        map.sprites.push(grub);

        const b = withMockImage(new Bullet(), 16, 16);
        b.setPosition(300, 100);
        map.projectiles.push(b);

        const spawnSpy = vi.spyOn(map, "spawnEffect");
        map.updateProjectiles();
        map.updateProjectiles(); // finalize the deferred removal (see pendingRemoval)

        expect(grub.getState()).toBe(CreatureState.DYING); // its own default death animation
        expect(map.projectiles).not.toContain(b);
        expect(spawnSpy).not.toHaveBeenCalled(); // no fireball-style detonation
    });

    it("still spawns the enemy's own deathEffect (e.g. bugjuice) on a kill, despite explodesOnRemoval=false", () => {
        // explodesOnRemoval only gates the projectile's OWN detonation
        // effect on removal (see updateProjectiles()) -- it must not affect
        // killCreature() spawning the killed creature's unrelated
        // deathEffect (bugjuice for grub/fly, an explosion for
        // player/caveman).
        const map = makeGameMap();
        const grub = withMockImage(new Grub(), 16, 16);
        grub.setPosition(300, 100);
        grub.deathEffect = "bugjuice";
        map.sprites.push(grub);

        const b = withMockImage(new Bullet(), 16, 16);
        b.setPosition(300, 100);
        map.projectiles.push(b);

        const spawnSpy = vi.spyOn(map, "spawnEffect");
        map.updateProjectiles();

        expect(spawnSpy).toHaveBeenCalledWith("bugjuice", 300, 100);
    });

    it("is still drawn exactly touching the wall for one frame before disappearing (the actual bug this guards against)", () => {
        const map = makeGameMap();
        map.tiles[5][2] = {} as p5.Image; // a "wall" occupying x:[320,384) y:[128,192)
        const b = withMockImage(new Bullet(), 16, 16);
        b.setPosition(303, 150);
        b.setVelocity(0.6, 0);
        map.projectiles.push(b);

        map.updateProjectiles();

        // updateSprite() snaps the right edge onto the wall surface (x=320)
        // this same frame, and draw() (called after update() each real
        // frame) still iterates this.projectiles regardless of
        // pendingRemoval -- so as long as it's still in the array, it's
        // drawn at this exact, fully-touching position at least once.
        expect(map.projectiles).toContain(b);
        expect(b.getPosition().x + b.getCollisionWidth()).toBe(320);

        map.updateProjectiles();
        expect(map.projectiles).not.toContain(b);
        // Not moved any further during the deferred frame.
        expect(b.getPosition().x + b.getCollisionWidth()).toBe(320);
    });

    it("disappears on a wall hit without spawning an explosion", () => {
        const map = makeGameMap();
        map.tiles[5][2] = {} as p5.Image; // a "wall" occupying x:[320,384) y:[128,192)
        const b = withMockImage(new Bullet(), 16, 16);
        b.setPosition(303, 150);
        b.setVelocity(0.6, 0);
        map.projectiles.push(b);

        const spawnSpy = vi.spyOn(map, "spawnEffect");
        map.updateProjectiles();
        map.updateProjectiles(); // finalize the deferred removal (see pendingRemoval)

        expect(b.hitSomething).toBe(true);
        expect(map.projectiles).not.toContain(b);
        expect(spawnSpy).not.toHaveBeenCalled();
    });

    it("expires silently with no explosion", () => {
        const map = makeGameMap();
        const b = withMockImage(new Bullet(), 16, 16);
        b.setPosition(300, 100);
        map.projectiles.push(b);

        const spawnSpy = vi.spyOn(map, "spawnEffect");
        const ticks = Math.ceil(b.LIFETIME / 16) + 1;
        for (let i = 0; i < ticks; i++) {
            map.updateProjectiles();
        }

        expect(map.projectiles).not.toContain(b);
        expect(spawnSpy).not.toHaveBeenCalled();
    });

    it("is unaffected by gravity, unlike a fireball", () => {
        const map = makeGameMap();
        const fireball = withMockImage(new Projectile(), 16, 16);
        fireball.setPosition(300, 100);
        fireball.setVelocity(0, 0);
        map.projectiles.push(fireball);

        const bullet = withMockImage(new Bullet(), 16, 16);
        bullet.setPosition(300, 100);
        bullet.setVelocity(0, 0);
        map.projectiles.push(bullet);

        for (let i = 0; i < 5; i++) {
            map.updateProjectiles();
        }

        expect(fireball.getPosition().y).toBeGreaterThan(100); // pulled down
        expect(bullet.getPosition().y).toBe(100); // untouched
    });
});

describe("GameMap.spawnProjectile()", () => {
    function makeGameMapWithPlayer() {
        const map = makeGameMap();
        const player = withMockImage(new Player(), 32, 32);
        player.setPosition(100, 200);
        map.player = player;
        // spawnProjectile() picks "projectile" (fireball) or "bullet" based
        // on player.hasFireAbility() -- the default test player has neither
        // granted, so it resolves to "bullet". Both need a real
        // Projectile-like clone template, not just the explosion stub.
        const projectileTemplate = makeProjectileTemplate(16, 16);
        const bulletTemplate = makeProjectileTemplate(16, 16);
        map.resources = {
            get: (name: string) => {
                if (name === "projectile") return projectileTemplate;
                if (name === "bullet") return bulletTemplate;
                return {
                    clone: () => ({ setPosition: vi.fn() }),
                    getImage: () => ({ width: 64, height: 64 }),
                };
            },
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

    it("spawns level with the gun barrel (Player.GUN_HEIGHT), not the sprite's vertical center", () => {
        const map = makeGameMapWithPlayer();
        map.spawnProjectile(1);

        const p = map.projectiles[0];
        // playerPos.y (200) + GUN_HEIGHT - half the projectile's own height
        expect(p.getPosition().y).toBe(200 + Player.GUN_HEIGHT - p.getImage().height / 2);
    });

    it("spawns a projectile just past the player's left edge when facing left, moving left", () => {
        const map = makeGameMapWithPlayer();
        map.spawnProjectile(-1);

        const p = map.projectiles[0];
        expect(p.getPosition().x).toBe(100 - p.getImage().width);
        expect(p.getVelocity().x).toBeCloseTo(-p.SPEED);
    });

    it("faces the fireball's animation to match the launch direction", () => {
        const map = makeGameMapWithPlayer();

        map.spawnProjectile(1);
        expect((map.projectiles[0] as any).currAnimName).toBe("right");

        map.spawnProjectile(-1);
        expect((map.projectiles[1] as any).currAnimName).toBe("left");
    });

    it("launches at 3x the player's own movement speed", () => {
        const map = makeGameMapWithPlayer();
        map.spawnProjectile(1);
        const p = map.projectiles[0];
        expect(p.SPEED).toBeCloseTo(map.player.getMaxSpeed() * 3);
    });

    it("plays the launch sound", () => {
        const map = makeGameMapWithPlayer();
        map.spawnProjectile(1);
        expect(map.soundManager.playEvent).toHaveBeenCalledWith("fireLaunch");
    });

    it("spawns a fireball with the FireOrb buff active, a Bullet otherwise", () => {
        const map = makeGameMapWithPlayer();
        const getSpy = vi.spyOn(map.resources, "get");

        map.spawnProjectile(1); // no fire ability granted
        expect(getSpy).toHaveBeenCalledWith("bullet");

        getSpy.mockClear();
        map.player.grantFireAbility();
        map.spawnProjectile(1);
        expect(getSpy).toHaveBeenCalledWith("projectile");
    });

    it("a shot fired point-blank into a wall the player is already touching fizzles shortly after (expected, not a crash)", () => {
        const map = makeGameMapWithPlayer();
        for (let y = 0; y < 20; y++) {
            map.tiles[2][y] = {} as p5.Image; // solid wall filling the whole column
        }
        map.player.setPosition(100, 190); // right edge at 132, inside the wall's column ([128,192))

        map.spawnProjectile(1);
        expect(map.projectiles).toHaveLength(1);

        map.updateProjectiles();
        map.updateProjectiles(); // finalize the deferred removal (see pendingRemoval)
        expect(map.projectiles).toHaveLength(0);
    });
});
