import { Sprite } from "./Sprite.js";

/**
 * A standalone visual effect: plays its animation once at a fixed position
 * and then is done (see isFinished()) -- no physics, no collision, no
 * state machine. Spawned by GameMap wherever a creature that "explodes on
 * death" (see Creature.explodesOnDeath) dies, as a stand-in for that
 * creature actually being there.
 */
export class Explosion extends Sprite {
    addAnimation(name: string) {
        super.addAnimation(name);
        this.animations[name].loop = false; // always plays once, never cycles back
    }

    isFinished(): boolean {
        return this.currAnimation.animTime >= this.currAnimation.totalDuration;
    }
}
