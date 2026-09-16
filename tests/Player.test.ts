import { describe, it, expect, beforeEach } from "vitest";
import { Player } from "../src/sprites/Player";

describe("Player", () => {
    let player: Player;

    beforeEach(() => {
        player = new Player();
    });

    it("constructor sets MAX_SPEED=0.5, JUMP_SPEED=0.95, onGround=false", () => {
        expect(player.MAX_SPEED).toBe(0.5);
        expect(player.JUMP_SPEED).toBe(0.95);
        expect(player.onGround).toBe(false);
    });

    // jump() treats a couple of consecutive airborne frames (airborneStreak
    // >= AIRBORNE_ANIM_MIN_STREAK), not raw onGround, as proof the player
    // has genuinely left the ground -- see the regression tests further
    // below for why. Helper to put a player in that state for the double
    // jump tests here without needing a real fall.
    function makeGenuinelyAirborne(p: Player) {
        p.onGround = false;
        p.airborneStreak = Player.AIRBORNE_ANIM_MIN_STREAK;
    }

    it("jump(false) while genuinely airborne (double jump available) → triggers a double jump", () => {
        makeGenuinelyAirborne(player);
        player.jump(false);
        expect(player.getVelocity().y).toBe(-player.DOUBLE_JUMP_SPEED);
        expect(player.canDoubleJump).toBe(false);
    });

    it("jump(false) while genuinely airborne and the double jump is already spent → no change", () => {
        makeGenuinelyAirborne(player);
        player.canDoubleJump = false;
        player.jump(false);
        expect(player.getVelocity().y).toBe(0);
        expect(player.onGround).toBe(false);
    });

    it("DOUBLE_JUMP_SPEED is JUMP_SPEED/sqrt(2), giving half the height (h = v^2/2g)", () => {
        expect(player.DOUBLE_JUMP_SPEED).toBeCloseTo(player.JUMP_SPEED / Math.sqrt(2));
        const heightRatio =
            (player.DOUBLE_JUMP_SPEED * player.DOUBLE_JUMP_SPEED) /
            (player.JUMP_SPEED * player.JUMP_SPEED);
        expect(heightRatio).toBeCloseTo(0.5);
    });

    it("a normal jump does not spend the double jump - one is still available once genuinely airborne", () => {
        player.onGround = true;
        player.jump(false); // normal jump
        expect(player.canDoubleJump).toBe(true);
        makeGenuinelyAirborne(player); // a real jump would build this up over a couple of frames
        player.jump(false); // double jump
        expect(player.getVelocity().y).toBe(-player.DOUBLE_JUMP_SPEED);
        expect(player.canDoubleJump).toBe(false);
    });

    it("a second double jump attempt in the same flight does nothing", () => {
        makeGenuinelyAirborne(player);
        player.jump(false); // double jump
        const vyAfterFirst = player.getVelocity().y;
        player.jump(false); // attempt a second one
        expect(player.getVelocity().y).toBe(vyAfterFirst); // unchanged
    });

    it("landing (collideVertical with vy > 0) refills the double jump", () => {
        makeGenuinelyAirborne(player);
        player.jump(false); // spend it
        expect(player.canDoubleJump).toBe(false);
        player.setVelocity(0, 0.3); // now falling back down
        player.collideVertical();
        expect(player.canDoubleJump).toBe(true);
    });

    it("regression: a ground jump on a flickered onGround=false frame still gives a full jump, not a double jump", () => {
        // The exact bug this guards against: a player resting motionlessly
        // gets a single flickered onGround=false frame every other frame
        // (see Player.airborneStreak's comment), which used to be harmless
        // when jump() fired on every held frame -- but jump() is now
        // edge-triggered (see GameManager.processActions()), so pressing
        // jump on exactly that frame must still read as "grounded," not as
        // "airborne enough for a double jump."
        player.onGround = false; // the flicker frame
        player.airborneStreak = 1; // below AIRBORNE_ANIM_MIN_STREAK -- not a real fall
        player.jump(false);
        expect(player.getVelocity().y).toBe(-player.JUMP_SPEED); // full height, not DOUBLE_JUMP_SPEED
        expect(player.canDoubleJump).toBe(true); // untouched -- this wasn't a double jump
    });

    it("jump(false) when onGround → sets vy=-0.95, onGround=false", () => {
        player.onGround = true;
        player.jump(false);
        expect(player.getVelocity().y).toBe(-0.95);
        expect(player.onGround).toBe(false);
    });

    it("jump(true) regardless of onGround → sets vy=-0.95", () => {
        player.jump(true);
        expect(player.getVelocity().y).toBe(-0.95);
        expect(player.onGround).toBe(false);
    });

    it("jump() does not change velocity.x (x=0 in setVelocity call)", () => {
        player.onGround = true;
        player.jump(false);
        expect(player.getVelocity().x).toBe(0);
    });

    it("collideVertical() with vy > 0 → onGround=true, vy=0", () => {
        player.addVelocity(0, 0.3);
        player.collideVertical();
        expect(player.onGround).toBe(true);
        expect(player.getVelocity().y).toBe(0);
    });

    it("collideVertical() with vy = 0 → onGround stays false, vy=0", () => {
        player.collideVertical();
        expect(player.onGround).toBe(false);
        expect(player.getVelocity().y).toBe(0);
    });

    it("collideVertical() with vy < 0 → onGround stays false, vy=0", () => {
        player.jump(true); // sets vy = -0.95
        player.collideVertical();
        expect(player.onGround).toBe(false);
        expect(player.getVelocity().y).toBe(0);
    });

    it("collideHorizontal() → vx=0 (no bounce, unlike base Sprite)", () => {
        player.addVelocity(0.3, 0);
        player.collideHorizontal();
        expect(player.getVelocity().x).toBe(0);
    });

    it("addVelocity() clamps vx above MAX_SPEED to 0.5", () => {
        player.addVelocity(1, 0);
        expect(player.getVelocity().x).toBe(0.5);
    });

    it("addVelocity() clamps vx at or below -MAX_SPEED to -0.5", () => {
        player.addVelocity(-1, 0);
        expect(player.getVelocity().x).toBe(-0.5);
    });

    it("addVelocity() clamps vx exactly at -MAX_SPEED (inclusive)", () => {
        player.addVelocity(-0.5, 0);
        expect(player.getVelocity().x).toBe(-0.5);
    });

    it("addVelocity() does NOT clamp vx exactly at +MAX_SPEED (exclusive)", () => {
        player.addVelocity(0.5, 0);
        expect(player.getVelocity().x).toBe(0.5); // 0.5 is not > 0.5
    });

    it("addVelocity() clamps vy above MAX_SPEED to 0.5", () => {
        player.addVelocity(0, 1);
        expect(player.getVelocity().y).toBe(0.5);
    });

    it("addVelocity() clamps vy below -MAX_SPEED to -0.5", () => {
        player.addVelocity(0, -1);
        expect(player.getVelocity().y).toBe(-0.5);
    });

    it("addVelocity() passes through values within range", () => {
        player.addVelocity(0, 0.3);
        expect(player.getVelocity().y).toBeCloseTo(0.3);
    });
});

describe("Player dash", () => {
    let player: Player;

    beforeEach(() => {
        player = new Player();
    });

    it("dash() cannot retrigger before DASH_COOLDOWN elapses", () => {
        player.dash();
        expect(player.isDashing()).toBe(true);

        // burst ends, but cooldown is still active
        player.update(player.DASH_DURATION);
        expect(player.isDashing()).toBe(false);

        player.dash(); // still within cooldown window, should be ignored
        expect(player.isDashing()).toBe(false);
    });

    it("dash() can retrigger once DASH_COOLDOWN has fully elapsed", () => {
        player.dash();
        player.update(player.DASH_COOLDOWN); // clears both the burst and the cooldown

        player.dash();
        expect(player.isDashing()).toBe(true);
    });

    it("dash() returns true on a successful trigger, false when blocked by cooldown", () => {
        expect(player.dash()).toBe(true);
        expect(player.dash()).toBe(false); // still within cooldown
    });

    it("collideHorizontal() cancels an active dash (dashTimer=0) instead of letting it re-assert", () => {
        player.dash();
        expect(player.isDashing()).toBe(true);

        player.collideHorizontal();
        expect(player.isDashing()).toBe(false);
        expect(player.getVelocity().x).toBe(0);
    });

    it("collideHorizontal() during a dash does not reset the cooldown, so a new dash still respects it", () => {
        player.dash();
        player.collideHorizontal();

        player.dash(); // cooldown from the original dash should still be active
        expect(player.isDashing()).toBe(false);
    });

    it("dash() leaves vel.y untouched", () => {
        player.addVelocity(0, 0.3); // simulate mid-air fall speed
        player.dash();
        expect(player.getVelocity().y).toBeCloseTo(0.3);
    });

    it("vel.y set externally (e.g. by gravity) during an active dash stays independent of dash state", () => {
        player.addAnimation("right"); // update() advances the current animation; stub it out since no frames are loaded in this test
        player.dash();
        player.setVelocity(player.getDashVelocityX(), 0.45); // GameManager.processActions()-style call
        expect(player.isDashing()).toBe(true);
        expect(player.getVelocity().y).toBeCloseTo(0.45);

        player.update(16); // one frame of gravity/physics elapsing
        expect(player.getVelocity().y).toBeCloseTo(0.45); // update() itself never touches velocity.y
    });

    it("getDashVelocityX() uses facing direction and DASH_SPEED", () => {
        player.setVelocity(-player.MAX_SPEED, 0); // face left
        player.dash();
        expect(player.getDashVelocityX()).toBe(-player.DASH_SPEED);
    });
});

describe("Player fire ability", () => {
    let player: Player;

    beforeEach(() => {
        player = new Player();
    });

    it("hasFireAbility() is false before any FireOrb is collected", () => {
        expect(player.hasFireAbility()).toBe(false);
    });

    it("grantFireAbility() sets hasFireAbility() true for FIRE_ABILITY_DURATION", () => {
        player.grantFireAbility();
        expect(player.hasFireAbility()).toBe(true);

        player.update(player.FIRE_ABILITY_DURATION - 1);
        expect(player.hasFireAbility()).toBe(true);

        player.update(1);
        expect(player.hasFireAbility()).toBe(false);
    });

    it("tryFire() succeeds even without a FireOrb collected (GameMap.spawnProjectile() picks a Bullet instead)", () => {
        expect(player.tryFire()).toBe(true);
        expect(player.fireCooldownTimer).toBe(player.FIRE_COOLDOWN);
    });

    it("tryFire() returns true when the ability is active and off cooldown, and starts the cooldown", () => {
        player.grantFireAbility();
        expect(player.tryFire()).toBe(true);
        expect(player.fireCooldownTimer).toBe(player.FIRE_COOLDOWN);
    });

    it("tryFire() returns false immediately after a successful fire (cooldown gating)", () => {
        player.grantFireAbility();
        player.tryFire();
        expect(player.tryFire()).toBe(false);
    });

    it("tryFire() becomes available again once FIRE_COOLDOWN has fully elapsed", () => {
        player.grantFireAbility();
        player.tryFire();

        player.update(player.FIRE_COOLDOWN);
        expect(player.tryFire()).toBe(true);
    });

    it("grantFireAbility() called again mid-buff refreshes to exactly FIRE_ABILITY_DURATION, not additive", () => {
        player.grantFireAbility();
        player.update(player.FIRE_ABILITY_DURATION / 2);
        player.grantFireAbility();
        expect(player.fireAbilityTimer).toBe(player.FIRE_ABILITY_DURATION);
    });

    it("grantFireAbility() and tryFire() leave velocity untouched", () => {
        player.addVelocity(0.2, 0.3);
        player.grantFireAbility();
        player.tryFire();
        expect(player.getVelocity().x).toBeCloseTo(0.2);
        expect(player.getVelocity().y).toBeCloseTo(0.3);
    });
});
