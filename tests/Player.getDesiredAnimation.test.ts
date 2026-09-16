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
