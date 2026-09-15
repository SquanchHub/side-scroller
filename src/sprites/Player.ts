import { Creature, CreatureState } from "./Creature.js";

export class Player extends Creature {
    MAX_SPEED: number;
    JUMP_SPEED: number;
    onGround: boolean;
    DASH_SPEED: number;
    DASH_DURATION: number;
    DASH_COOLDOWN: number;
    dashTimer: number; // ms remaining in the active dash burst, 0 = not dashing
    dashCooldownTimer: number; // ms remaining before another dash is allowed
    facing: number; // +1 (right) or -1 (left), last nonzero horizontal direction
    // GameMap's collision correction only kicks in once accumulated gravity
    // crosses a whole pixel, so a player resting motionlessly on flat
    // ground genuinely alternates onGround true/false every other frame
    // (falls ~0.03px under gravity, no collision yet -> onGround=false;
    // next frame the correction lands -> onGround=true; repeat) -- always
    // exactly a single false frame before self-correcting. That's harmless
    // for jump permission (isPressed() doesn't care), but using raw
    // onGround for animation would flicker the jump pose in and out every
    // frame while standing still. A real jump/fall instead holds onGround
    // false continuously for the whole flight, including right around the
    // apex where velocity.y is genuinely near zero -- so counting
    // consecutive airborne frames (not velocity magnitude, which can't
    // tell the apex apart from the resting blip) is what distinguishes
    // them: require a couple of consecutive false frames before treating
    // the player as airborne for animation purposes.
    airborneStreak: number;
    static readonly AIRBORNE_ANIM_MIN_STREAK = 2;
    // Every player frame (walk, jump) is 64x64 except the dash pose, whose
    // canvas is deliberately larger to fit its energy-trail art. Collision
    // should track the character's actual footprint, not that cosmetic art
    // size -- see Sprite.getCollisionWidth/getCollisionHeight.
    static readonly COLLISION_SIZE = 64;
    FIRE_ABILITY_DURATION: number;
    FIRE_COOLDOWN: number;
    fireAbilityTimer: number; // ms remaining of the FireOrb buff, 0 = can't fire
    fireCooldownTimer: number; // ms remaining before the next shot is allowed

    constructor() {
        super();
        this.MAX_SPEED = 0.5;
        this.JUMP_SPEED = 0.95;
        this.onGround = false;
        this.DASH_SPEED = 1.2;
        this.DASH_DURATION = 150;
        this.DASH_COOLDOWN = 600;
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;
        this.facing = 1;
        this.airborneStreak = 0;
        this.FIRE_ABILITY_DURATION = 10000;
        this.FIRE_COOLDOWN = 300;
        this.fireAbilityTimer = 0;
        this.fireCooldownTimer = 0;
    }

    getCollisionWidth(): number {
        return Player.COLLISION_SIZE;
    }

    getCollisionHeight(): number {
        return Player.COLLISION_SIZE;
    }

    getMaxSpeed() {
        return this.MAX_SPEED;
    }

    collideVertical() {
        if (this.velocity.y > 0) {
            this.onGround = true;
        }
        this.velocity.y = 0;
    }

    collideHorizontal() {
        this.dashTimer = 0; // cancel the dash rather than let processActions() re-assert it into the wall
        this.velocity.x = 0;
    }

    jump(forceJump: boolean) {
        if (this.onGround || forceJump) {
            this.onGround = false;
            this.setVelocity(0, -this.JUMP_SPEED);
        }
    }

    dash(): boolean {
        if (this.dashCooldownTimer <= 0) {
            this.dashTimer = this.DASH_DURATION;
            this.dashCooldownTimer = this.DASH_COOLDOWN;
            // The dash animation's own cycle length (see resources.json)
            // matches DASH_DURATION, so by the time a dash ends its
            // Animation's timer has run to (or just past) its last frame.
            // Since setAnimation() doesn't reset frame progress, a second
            // dash would otherwise silently resume from wherever the first
            // one left off instead of starting at the "building up" frame.
            // Force a clean restart here, right when the new dash begins.
            // Guarded because tests (and any other context that builds a
            // Player without going through ResourceManager) never populate
            // a real animations dict, and dash() must stay safe to call
            // even before/without dash art existing.
            const dashAnim = this.facing < 0 ? "dashLeft" : "dashRight";
            if (this.animations[dashAnim]) {
                this.setAnimation(dashAnim);
                this.start();
            }
            return true;
        }
        return false;
    }

    isDashing(): boolean {
        return this.dashTimer > 0;
    }

    getDashVelocityX(): number {
        return this.facing * this.DASH_SPEED;
    }

    grantFireAbility() {
        this.fireAbilityTimer = this.FIRE_ABILITY_DURATION;
    }

    hasFireAbility(): boolean {
        return this.fireAbilityTimer > 0;
    }

    tryFire(): boolean {
        if (this.hasFireAbility() && this.fireCooldownTimer <= 0) {
            this.fireCooldownTimer = this.FIRE_COOLDOWN;
            return true;
        }
        return false;
    }

    setVelocity(x: number, y: number) {
        if (x > 0) {
            this.facing = 1;
        } else if (x < 0) {
            this.facing = -1;
        }
        // Deliberately not calling super.setVelocity(): Sprite's version
        // unconditionally calls setAnimation("left"/"right") whenever x!=0,
        // which would stomp over getDesiredAnimation()'s jump/dash choice
        // every frame GameManager.processActions() re-asserts horizontal
        // velocity -- including while airborne. Player's animation is fully
        // decided by getDesiredAnimation() (via Creature.update()), so only
        // the velocity itself needs to be set here.
        this.velocity.set(x, y);
    }

    update(deltaTime: number) {
        this.airborneStreak = this.onGround ? 0 : this.airborneStreak + 1;
        super.update(deltaTime);
        if (this.dashTimer > 0) {
            this.dashTimer = Math.max(0, this.dashTimer - deltaTime);
        }
        if (this.dashCooldownTimer > 0) {
            this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - deltaTime);
        }
        if (this.fireAbilityTimer > 0) {
            this.fireAbilityTimer = Math.max(0, this.fireAbilityTimer - deltaTime);
        }
        if (this.fireCooldownTimer > 0) {
            this.fireCooldownTimer = Math.max(0, this.fireCooldownTimer - deltaTime);
        }
    }

    getDesiredAnimation(): string {
        if (this.getState() != CreatureState.NORMAL) {
            // Dying/dead: Creature.setState() already switched to
            // deadLeft/deadRight once, and the death animation should just
            // play out undisturbed. Without this, since setState() also
            // zeroes velocity, a player that died mid-air stays !onGround
            // (nothing resolves that once physics freezes on death -- see
            // GameMap.updateSprite()) and this method would otherwise keep
            // re-asserting jumpUp/jumpDown over the death animation every
            // single frame, so it would never actually be seen.
            return "";
        }
        if (this.isDashing()) {
            // Overrides jump/idle/walk for the dash's whole duration; once
            // it ends this check simply stops matching and the very next
            // frame falls through to whatever would normally be showing
            // (e.g. a mid-air dash resumes into the correct ascending or
            // descending jump frame, not the dash pose or idle).
            return this.facing < 0 ? "dashLeft" : "dashRight";
        }
        if (!this.onGround && this.airborneStreak >= Player.AIRBORNE_ANIM_MIN_STREAK) {
            // Rising vs. falling, not a timed cycle: frame 1 holds until
            // the jump's apex (velocity.y crosses from negative to
            // non-negative), then frame 2 holds until landing. This also
            // means the idle/walk pose never shows while airborne, even if
            // horizontal velocity is 0 (e.g. a straight-up jump).
            if (this.velocity.y < 0) {
                return this.facing < 0 ? "jumpUpLeft" : "jumpUpRight";
            }
            return this.facing < 0 ? "jumpDownLeft" : "jumpDownRight";
        }
        // Creature.getDesiredAnimation() returns "" when standing still
        // (meaning "leave the current animation alone"), which would
        // otherwise leave the player frozen on a jump/dash frame forever
        // after landing/stopping. Fall back to a facing-appropriate idle
        // pose instead.
        return super.getDesiredAnimation() || (this.facing < 0 ? "left" : "right");
    }

    setPosition(x: number, y: number) {
        //check if falling
        if (Math.round(y) > Math.round(this.position.y)) {
            this.onGround = false;
        }
        super.setPosition(x, y);
    }

    addVelocity(x: number, y: number) {
        this.velocity.add(x, y);
        if (this.velocity.x > this.MAX_SPEED) {
            this.velocity.x = this.MAX_SPEED;
        } else if (this.velocity.x <= -this.MAX_SPEED) {
            this.velocity.x = -this.MAX_SPEED;
        }
        if (this.velocity.y > this.MAX_SPEED) {
            this.velocity.y = this.MAX_SPEED;
        } else if (this.velocity.y < -this.MAX_SPEED) {
            this.velocity.y = -this.MAX_SPEED;
        }
        if (this.velocity.x > 0 && this.currAnimName != "right") {
            this.setAnimation("right");
        }
        if (this.velocity.x < 0 && this.currAnimName != "left") {
            this.setAnimation("left");
        }
    }

    clone() {
        const p = new Player();
        p.position = this.position.copy();
        p.velocity = this.velocity.copy();
        p.animations = {}; //throw away the animations from the new constructor call
        //and copy over the animations from this
        for (const key in this.animations) {
            if (Object.prototype.hasOwnProperty.call(this.animations, key)) {
                const element = this.animations[key];
                p.animations[key] = element.clone();
            }
        }
        p.currAnimName = this.currAnimName;
        p.currAnimation = p.animations[p.currAnimName];
        p.MAX_SPEED = this.MAX_SPEED;
        p.drawOffsetY = this.drawOffsetY;
        p.airborneStreak = this.airborneStreak;
        p.deathEffect = this.deathEffect;
        p.explodesOnDeath = this.explodesOnDeath;
        return p;
    }
}
