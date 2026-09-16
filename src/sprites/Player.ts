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
    // How far down from the top of the (left-facing) walk/idle frames a shot
    // should spawn to read as level with the gun -- used by
    // GameMap.spawnProjectile() instead of the sprite's vertical center
    // (which sits noticeably lower than the gun barrel itself, measured at
    // ~24px off player1-3/playerPower1-3). Nudged a bit below that raw
    // measurement since the projectile art's own glow sits high in its
    // frame, so anchoring exactly on the muzzle read as slightly too high.
    static readonly GUN_HEIGHT = 28;
    FIRE_ABILITY_DURATION: number;
    FIRE_COOLDOWN: number;
    fireAbilityTimer: number; // ms remaining of the FireOrb buff, 0 = can't fire
    fireCooldownTimer: number; // ms remaining before the next shot is allowed
    DOUBLE_JUMP_SPEED: number;
    canDoubleJump: boolean; // refilled on landing (see collideVertical()), spent on use
    doubleJumpAnimTimer: number; // ms remaining to force the one-shot doubleJump pose (see getDesiredAnimation())
    // The 2-frame doubleJump animation (see resources.json) is 100ms/frame;
    // getDesiredAnimation() favors it for exactly this long so it plays
    // through once and then falls back to the ordinary jump pose, the same
    // trick DASH_DURATION uses to size a one-shot animation window.
    static readonly DOUBLE_JUMP_ANIM_DURATION = 200;
    // Stamina for special actions (dash, double jump, an unpowered shot --
    // see spendEnergy(), called from each). 3 whole units, one regenerating
    // per second, unlimited while the FireOrb buff is active.
    static readonly MAX_ENERGY = 3;
    static readonly ENERGY_REGEN_TIME = 2000;
    // The energyUsed burst (see resources.json) is 3 frames x 100ms; the
    // HUD (GameMap) shows it on whichever slot was just spent for exactly
    // this long, then leaves that slot empty until it regenerates.
    static readonly ENERGY_USED_ANIM_DURATION = 300;
    energy: number;
    energyRegenTimer: number; // ms accrued toward refilling the next unit
    energyUsedTimer: number; // ms remaining to show the "just spent" burst

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
        // Half the HEIGHT of a normal jump, not half the speed: under
        // constant gravity, max height scales with velocity squared
        // (h = v^2/2g), so halving height means scaling velocity by
        // 1/sqrt(2), not by 1/2.
        this.DOUBLE_JUMP_SPEED = this.JUMP_SPEED / Math.sqrt(2);
        this.canDoubleJump = true;
        this.doubleJumpAnimTimer = 0;
        this.energy = Player.MAX_ENERGY;
        this.energyRegenTimer = 0;
        this.energyUsedTimer = 0;
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
            this.canDoubleJump = true; // refill on landing, however it happened (jumped, fell off a ledge, ...)
        }
        this.velocity.y = 0;
    }

    collideHorizontal() {
        this.dashTimer = 0; // cancel the dash rather than let processActions() re-assert it into the wall
        this.velocity.x = 0;
    }

    jump(forceJump: boolean) {
        // Treat a flickered onGround=false as still grounded: a player
        // resting motionlessly gets a single false frame every other frame
        // (see the airborneStreak field comment above), and since jump() is
        // now edge-triggered on isBeginPress() (see
        // GameManager.processActions()) rather than the continuous
        // isPressed(), there's no next frame to retry on if that exact
        // frame is misread. airborneStreak only climbs past this threshold
        // during a real, sustained fall -- never during the single-frame
        // flicker -- so using it instead of raw onGround here means an
        // ordinary ground jump can no longer land on the flicker frame and
        // either misfire as a half-height double jump or be dropped
        // entirely.
        const genuinelyAirborne =
            !this.onGround && this.airborneStreak >= Player.AIRBORNE_ANIM_MIN_STREAK;
        if (forceJump || !genuinelyAirborne) {
            this.onGround = false;
            this.setVelocity(0, -this.JUMP_SPEED);
        } else if (this.canDoubleJump && this.spendEnergy()) {
            // canDoubleJump is checked before spendEnergy() (short-circuit)
            // so an attempt blocked purely by empty stamina doesn't consume
            // the one-per-flight allowance -- it's still available to try
            // again once energy regenerates, same flight or not.
            //
            // A genuine second press while airborne (see
            // GameManager.processActions(), which edge-triggers this via
            // isBeginPress() rather than the continuous isPressed() used
            // elsewhere -- otherwise simply holding the jump button down
            // would consume the double jump the instant the first one left
            // the ground). One per flight: spent here, refilled only on
            // the next landing (see collideVertical()).
            this.canDoubleJump = false;
            this.setVelocity(0, -this.DOUBLE_JUMP_SPEED);
            this.doubleJumpAnimTimer = Player.DOUBLE_JUMP_ANIM_DURATION;
        }
    }

    dash(): boolean {
        if (this.dashCooldownTimer <= 0 && this.spendEnergy()) {
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
            let dashAnim = this.facing < 0 ? "dashLeft" : "dashRight";
            if (this.hasFireAbility()) {
                dashAnim += "Power";
            }
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

    // Spends one energy unit and returns true if the caller may proceed, or
    // returns false (spending nothing) if empty. Unlimited -- always
    // succeeds without spending -- while the FireOrb buff is active. Called
    // by dash(), jump()'s double-jump branch, and tryFire() -- each costs
    // exactly 1 unit while unpowered.
    spendEnergy(): boolean {
        if (this.hasFireAbility()) {
            return true;
        }
        if (this.energy <= 0) {
            return false;
        }
        this.energy -= 1;
        this.energyUsedTimer = Player.ENERGY_USED_ANIM_DURATION;
        return true;
    }

    tryFire(): boolean {
        // Available regardless of hasFireAbility() -- GameMap.spawnProjectile()
        // picks a fireball or a plain Bullet based on that. Cooldown checked
        // before spendEnergy() (short-circuit) so a shot blocked purely by
        // cooldown doesn't also spend stamina for nothing.
        if (this.fireCooldownTimer <= 0 && this.spendEnergy()) {
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
        if (this.doubleJumpAnimTimer > 0) {
            this.doubleJumpAnimTimer = Math.max(0, this.doubleJumpAnimTimer - deltaTime);
        }
        if (this.energyUsedTimer > 0) {
            this.energyUsedTimer = Math.max(0, this.energyUsedTimer - deltaTime);
        }
        // No regen while full (nothing to fill) or while the buff makes
        // energy moot -- accruing progress toward a unit that's either
        // already there or doesn't matter yet would just mean an unearned
        // instant refill the moment the buff ends.
        if (!this.hasFireAbility() && this.energy < Player.MAX_ENERGY) {
            this.energyRegenTimer += deltaTime;
            // A while loop, not if: a single large deltaTime (a stutter, or
            // just a big test step) can be worth more than one unit, and
            // each should still count rather than only ever crediting one
            // per update() call regardless of how much time actually passed.
            while (
                this.energyRegenTimer >= Player.ENERGY_REGEN_TIME &&
                this.energy < Player.MAX_ENERGY
            ) {
                this.energyRegenTimer -= Player.ENERGY_REGEN_TIME;
                this.energy += 1;
            }
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
            // single frame, so it would never actually be seen. Returned
            // before the power suffix below since "" is a sentinel, not a
            // real animation name.
            return "";
        }
        let anim: string;
        if (this.isDashing()) {
            // Overrides jump/idle/walk for the dash's whole duration; once
            // it ends this check simply stops matching and the very next
            // frame falls through to whatever would normally be showing
            // (e.g. a mid-air dash resumes into the correct ascending or
            // descending jump frame, not the dash pose or idle).
            anim = this.facing < 0 ? "dashLeft" : "dashRight";
        } else if (this.doubleJumpAnimTimer > 0) {
            // One-shot: held only for DOUBLE_JUMP_ANIM_DURATION (see
            // jump()), matching the doubleJump animation's own 2x100ms
            // length, so it plays through exactly once and then this check
            // simply stops matching -- falling through to the ordinary
            // jump pose below on the very next frame, same pattern as dash.
            anim = this.facing < 0 ? "doubleJumpLeft" : "doubleJumpRight";
        } else if (!this.onGround && this.airborneStreak >= Player.AIRBORNE_ANIM_MIN_STREAK) {
            // Rising vs. falling, not a timed cycle: frame 1 holds until
            // the jump's apex (velocity.y crosses from negative to
            // non-negative), then frame 2 holds until landing. This also
            // means the idle/walk pose never shows while airborne, even if
            // horizontal velocity is 0 (e.g. a straight-up jump).
            if (this.velocity.y < 0) {
                anim = this.facing < 0 ? "jumpUpLeft" : "jumpUpRight";
            } else {
                anim = this.facing < 0 ? "jumpDownLeft" : "jumpDownRight";
            }
        } else {
            // Creature.getDesiredAnimation() returns "" when standing still
            // (meaning "leave the current animation alone"), which would
            // otherwise leave the player frozen on a jump/dash frame forever
            // after landing/stopping. Fall back to a facing-appropriate idle
            // pose instead.
            anim = super.getDesiredAnimation() || (this.facing < 0 ? "left" : "right");
        }
        // While the FireOrb buff is active, every pose has a "*Power"
        // counterpart (see resources.json) using the glowing armor art --
        // same animation names/timing, just a different sprite set.
        return this.hasFireAbility() ? anim + "Power" : anim;
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
