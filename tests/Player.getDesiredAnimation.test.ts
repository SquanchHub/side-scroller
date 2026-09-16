import { describe, it, expect } from "vitest";
import { Player } from "../src/sprites/Player";
import { CreatureState } from "../src/sprites/Creature";

function makePlayer(): Player {
    return new Player();
}

describe("Player.getDesiredAnimation() power-mode suffix", () => {
    it("returns the plain idle/walk animation without the fire ability", () => {
        const player = makePlayer();
        player.setVelocity(-0.5, 0);
        expect(player.getDesiredAnimation()).toBe("left");
        player.setVelocity(0.5, 0);
        expect(player.getDesiredAnimation()).toBe("right");
    });

    it("appends Power to idle/walk once the fire ability is active", () => {
        const player = makePlayer();
        player.grantFireAbility();
        player.setVelocity(-0.5, 0);
        expect(player.getDesiredAnimation()).toBe("leftPower");
        player.setVelocity(0.5, 0);
        expect(player.getDesiredAnimation()).toBe("rightPower");
    });

    it("appends Power to the jump animations while airborne", () => {
        const player = makePlayer();
        player.grantFireAbility();
        player.onGround = false;
        player.airborneStreak = Player.AIRBORNE_ANIM_MIN_STREAK;
        player.setVelocity(-0.5, -0.5); // ascending, facing left
        expect(player.getDesiredAnimation()).toBe("jumpUpLeftPower");
        player.setVelocity(0.5, 0.5); // descending, facing right
        expect(player.getDesiredAnimation()).toBe("jumpDownRightPower");
    });

    it("appends Power to the dash animation while dashing", () => {
        const player = makePlayer();
        player.grantFireAbility();
        player.setVelocity(-0.5, 0); // facing left
        player.dash();
        expect(player.getDesiredAnimation()).toBe("dashLeftPower");
    });

    it("does not append Power while dying, regardless of fire ability", () => {
        const player = makePlayer();
        player.grantFireAbility();
        player.setState(CreatureState.DYING);
        expect(player.getDesiredAnimation()).toBe("");
    });
});

describe("Player.getDesiredAnimation() double jump", () => {
    // jump() only allows a double jump once airborneStreak proves the
    // player has genuinely left the ground (see Player.jump()'s comment) --
    // a fresh, never-moved player reads as grounded, not airborne.
    function makeGenuinelyAirborne(p: Player) {
        p.onGround = false;
        p.airborneStreak = Player.AIRBORNE_ANIM_MIN_STREAK;
    }

    it("shows the doubleJump pose immediately when triggered, facing-appropriate and Power-suffixed", () => {
        const player = makePlayer();
        makeGenuinelyAirborne(player);
        player.setVelocity(-0.5, 0); // facing left
        player.jump(false); // double jump
        expect(player.getDesiredAnimation()).toBe("doubleJumpLeft");

        const powered = makePlayer();
        makeGenuinelyAirborne(powered);
        powered.grantFireAbility();
        powered.setVelocity(0.5, 0); // facing right
        powered.jump(false);
        expect(powered.getDesiredAnimation()).toBe("doubleJumpRightPower");
    });

    it("falls back to the ordinary jump pose once DOUBLE_JUMP_ANIM_DURATION elapses", () => {
        const player = makePlayer();
        makeGenuinelyAirborne(player);
        player.setVelocity(-0.5, -0.5); // facing left, ascending
        player.jump(false); // double jump
        expect(player.getDesiredAnimation()).toBe("doubleJumpLeft");

        player.update(Player.DOUBLE_JUMP_ANIM_DURATION); // the animation's one-shot window fully elapses
        expect(player.getDesiredAnimation()).toBe("jumpUpLeft");
    });

    it("dashing overrides an in-progress doubleJump animation", () => {
        const player = makePlayer();
        makeGenuinelyAirborne(player);
        player.setVelocity(-0.5, 0);
        player.jump(false); // double jump, starts the one-shot animation window
        player.dash();
        expect(player.getDesiredAnimation()).toBe("dashLeft");
    });
});

describe("Player.dash() animation reset with the fire ability active", () => {
    it("resets to the Power dash animation, not the plain one, when the fire ability is active", () => {
        const player = makePlayer();
        player.grantFireAbility();
        player.addAnimation("dashLeftPower");
        player.addFrame("dashLeftPower", { width: 64, height: 64 } as unknown as p5.Image, 50);
        player.setVelocity(-0.5, 0); // facing left
        player.dash();
        expect((player as any).currAnimName).toBe("dashLeftPower");
    });
});
