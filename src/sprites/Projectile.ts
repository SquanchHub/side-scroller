import { Sprite } from "./Sprite.js";

/**
 * A fireball thrown by the player after collecting a FireOrb. Falls under
 * gravity like any other Sprite passed to GameMap.updateSprite() (it does
 * not override isFlying()). It deliberately overrides setVelocity() to skip
 * the base class's animation-name switching: GameMap.updateSprite() calls
 * setVelocity() every tick just to apply gravity, and re-deriving
 * left/right from velocity.x every tick would fight with the one-time
 * facing GameMap.spawnProjectile() sets at launch (a fireball's direction
 * never changes mid-flight, unlike a walking Creature).
 *
 * Landing on the ground doesn't destroy it - it rolls until it hits a wall
 * or its LIFETIME runs out (see collideVertical()/collideHorizontal()).
 */
export class Projectile extends Sprite {
    SPEED: number;
    LIFETIME: number;
    lifeRemaining: number;
    hitSomething: boolean;
    // Whether GameMap.updateProjectiles() spawns an "explosion" effect
    // wherever this projectile disappears (enemy hit, wall hit, or simply
    // expiring) -- true for a fireball's own detonation, false for a plain
    // Bullet (see its class comment), which just vanishes.
    explodesOnRemoval: boolean;
    // Set by GameMap.updateProjectiles() once a removal condition (hit
    // something, hitSomething, or expired) is first seen, and only actually
    // spliced out of this.sprites on the NEXT call -- see that method's
    // comment for why a one-frame delay matters here.
    pendingRemoval: boolean;

    constructor() {
        super();
        this.SPEED = 0.6;
        this.LIFETIME = 700;
        this.lifeRemaining = this.LIFETIME;
        this.hitSomething = false;
        this.explodesOnRemoval = true;
        this.pendingRemoval = false;
    }

    setVelocity(x: number, y: number) {
        this.velocity.set(x, y);
    }

    collideHorizontal() {
        // A wall destroys it outright.
        this.hitSomething = true;
    }

    collideVertical() {
        // The ground/a ceiling doesn't destroy it - it comes to rest
        // vertically and keeps rolling on whatever horizontal velocity it
        // already had, until LIFETIME runs out or it hits a wall.
        this.velocity.y = 0;
    }

    update(deltaTime: number) {
        super.update(deltaTime);
        this.lifeRemaining = Math.max(0, this.lifeRemaining - deltaTime);
    }

    isExpired(): boolean {
        return this.lifeRemaining <= 0;
    }

    clone(): Projectile {
        const p = super.clone() as Projectile;
        p.SPEED = this.SPEED;
        p.LIFETIME = this.LIFETIME;
        p.lifeRemaining = this.LIFETIME; // fresh clone always starts with a full lifetime
        p.hitSomething = false;
        p.explodesOnRemoval = this.explodesOnRemoval;
        p.pendingRemoval = false;
        return p;
    }
}
