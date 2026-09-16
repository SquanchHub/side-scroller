import { Projectile } from "./Projectile.js";

/**
 * A plain shot fired without the FireOrb buff active. Unlike a fireball, it
 * ignores gravity entirely (a flat, straight-line shot) and disappears
 * silently wherever it stops -- no detonation effect of its own. An enemy
 * it hits still dies through the same setState(DYING) GameMap.updateProjectiles()
 * already uses for a fireball, so it plays that creature's own default
 * death animation, just without any extra effect layered on top.
 */
export class Bullet extends Projectile {
    constructor() {
        super();
        this.explodesOnRemoval = false;
    }

    isFlying(): boolean {
        return true;
    }
}
