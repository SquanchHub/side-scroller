import { describe, it, expect, beforeEach } from "vitest";
import { Player } from "../src/sprites/Player";

describe("Player energy (stamina)", () => {
    let player: Player;

    beforeEach(() => {
        player = new Player();
        // Creature.update() (called via player.update() below) switches to
        // whatever getDesiredAnimation() returns unconditionally -- a bare
        // test player only has "default" registered, so any name it
        // actually reaches needs real frames too, or currAnimation goes
        // undefined the next time that same name comes up again. With
        // onGround left false and facing left at its default (+1), a
        // several-tick test settles on "right" then "jumpDownRight".
        for (const anim of ["default", "right", "jumpDownRight"]) {
            player.addAnimation(anim);
            player.addFrame(anim, { width: 64, height: 64 } as unknown as p5.Image, 100);
        }
    });

    it("starts full", () => {
        expect(player.energy).toBe(Player.MAX_ENERGY);
    });

    it("spendEnergy() consumes one unit and returns true when available", () => {
        expect(player.spendEnergy()).toBe(true);
        expect(player.energy).toBe(Player.MAX_ENERGY - 1);
    });

    it("spendEnergy() starts the used-burst timer", () => {
        player.spendEnergy();
        expect(player.energyUsedTimer).toBe(Player.ENERGY_USED_ANIM_DURATION);
    });

    it("spendEnergy() returns false and spends nothing once empty", () => {
        for (let i = 0; i < Player.MAX_ENERGY; i++) {
            player.spendEnergy();
        }
        expect(player.energy).toBe(0);
        expect(player.spendEnergy()).toBe(false);
        expect(player.energy).toBe(0);
    });

    it("regenerates exactly one unit per ENERGY_REGEN_TIME", () => {
        player.spendEnergy();
        expect(player.energy).toBe(2);

        player.update(Player.ENERGY_REGEN_TIME - 1);
        expect(player.energy).toBe(2); // not quite yet

        player.update(1);
        expect(player.energy).toBe(3);
    });

    it("does not regenerate past MAX_ENERGY", () => {
        player.update(Player.ENERGY_REGEN_TIME * 5);
        expect(player.energy).toBe(Player.MAX_ENERGY);
    });

    it("regen progress carries over correctly across multiple units (no lost/extra time)", () => {
        player.spendEnergy();
        player.spendEnergy();
        expect(player.energy).toBe(1);

        player.update(Player.ENERGY_REGEN_TIME * 2);
        expect(player.energy).toBe(3);
    });

    it("is unlimited while the FireOrb buff is active: always succeeds, never decrements", () => {
        player.grantFireAbility();
        for (let i = 0; i < 10; i++) {
            expect(player.spendEnergy()).toBe(true);
        }
        expect(player.energy).toBe(Player.MAX_ENERGY); // untouched
    });

    it("does not regenerate while the FireOrb buff is active (moot, but shouldn't accrue either)", () => {
        player.spendEnergy();
        player.grantFireAbility();
        // Comfortably less than FIRE_ABILITY_DURATION (derived from it, not
        // a separate hardcoded multiple of ENERGY_REGEN_TIME) so the buff is
        // still active throughout, regardless of how either constant is tuned.
        player.update(player.FIRE_ABILITY_DURATION / 2);
        expect(player.energy).toBe(2); // still down one -- no regen happened while powered
    });

    it("resumes regenerating once the buff ends", () => {
        player.spendEnergy();
        player.grantFireAbility();
        player.update(player.FIRE_ABILITY_DURATION); // buff fully expires
        expect(player.hasFireAbility()).toBe(false);

        player.update(Player.ENERGY_REGEN_TIME);
        expect(player.energy).toBe(3);
    });

    it("energyUsedTimer counts down to 0 and stays there", () => {
        player.spendEnergy();
        player.update(Player.ENERGY_USED_ANIM_DURATION - 1);
        expect(player.energyUsedTimer).toBe(1);
        player.update(1);
        expect(player.energyUsedTimer).toBe(0);
        player.update(100);
        expect(player.energyUsedTimer).toBe(0);
    });
});

describe("Stamina cost of dash/double-jump/shoot, unpowered", () => {
    let player: Player;

    beforeEach(() => {
        player = new Player();
    });

    it("dash() spends 1 energy on a successful dash", () => {
        expect(player.dash()).toBe(true);
        expect(player.energy).toBe(Player.MAX_ENERGY - 1);
    });

    it("dash() fails once energy is empty, even with cooldown ready", () => {
        player.energy = 0;
        expect(player.dash()).toBe(false);
        expect(player.isDashing()).toBe(false);
    });

    it("dash() is free while the FireOrb buff is active", () => {
        player.grantFireAbility();
        expect(player.dash()).toBe(true);
        expect(player.energy).toBe(Player.MAX_ENERGY);
    });

    it("double jump spends 1 energy on success", () => {
        player.onGround = false;
        player.airborneStreak = Player.AIRBORNE_ANIM_MIN_STREAK;
        expect(player.canDoubleJump).toBe(true);

        player.jump(false);

        expect(player.energy).toBe(Player.MAX_ENERGY - 1);
        expect(player.getVelocity().y).toBe(-player.DOUBLE_JUMP_SPEED);
        expect(player.canDoubleJump).toBe(false);
    });

    it("double jump fails (and stays available) when energy is empty", () => {
        player.onGround = false;
        player.airborneStreak = Player.AIRBORNE_ANIM_MIN_STREAK;
        player.energy = 0;

        player.jump(false);

        expect(player.getVelocity().y).toBe(0); // no jump happened at all
        expect(player.canDoubleJump).toBe(true); // not spent -- only the attempt failed
    });

    it("double jump is free while the FireOrb buff is active", () => {
        player.onGround = false;
        player.airborneStreak = Player.AIRBORNE_ANIM_MIN_STREAK;
        player.grantFireAbility();

        player.jump(false);

        expect(player.energy).toBe(Player.MAX_ENERGY);
        expect(player.getVelocity().y).toBe(-player.DOUBLE_JUMP_SPEED);
    });

    it("tryFire() spends 1 energy on a successful shot", () => {
        expect(player.tryFire()).toBe(true);
        expect(player.energy).toBe(Player.MAX_ENERGY - 1);
    });

    it("tryFire() fails once energy is empty, even with cooldown ready", () => {
        player.energy = 0;
        expect(player.tryFire()).toBe(false);
        expect(player.fireCooldownTimer).toBe(0); // not spent -- the shot never happened
    });

    it("tryFire() does not spend energy when blocked purely by cooldown", () => {
        player.tryFire(); // energy 3 -> 2, cooldown starts
        expect(player.tryFire()).toBe(false); // still on cooldown
        expect(player.energy).toBe(Player.MAX_ENERGY - 1); // unchanged by the blocked attempt
    });

    it("tryFire() is free while the FireOrb buff is active", () => {
        player.grantFireAbility();
        expect(player.tryFire()).toBe(true);
        expect(player.energy).toBe(Player.MAX_ENERGY);
    });
});
