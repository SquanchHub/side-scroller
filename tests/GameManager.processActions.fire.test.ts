import { describe, it, expect, beforeEach, vi } from "vitest";
import { GameManager } from "../src/GameManager";
import { GameAction } from "../src/GameAction";
import { Player } from "../src/sprites/Player";
import { CreatureState } from "../src/sprites/Creature";
import type { GameMap } from "../src/GameMap";

// See tests/GameManager.processActions.test.ts for why Object.create() is
// used instead of `new GameManager()`. processActions()'s fire branch only
// reads this.fire and this.map.player/this.map.spawnProjectile(), so those
// are the only fields hand-wired here.
function makeGameManager(player: Player): {
    gm: GameManager;
    spawnProjectile: ReturnType<typeof vi.fn>;
} {
    const gm = Object.create(GameManager.prototype) as GameManager;
    gm.moveRight = new GameAction();
    gm.moveLeft = new GameAction();
    gm.jump = new GameAction();
    gm.dash = new GameAction();
    gm.stop = new GameAction();
    gm.fire = new GameAction();
    const spawnProjectile = vi.fn();
    gm.map = { player, spawnProjectile } as unknown as GameMap;
    return { gm, spawnProjectile };
}

describe("GameManager.processActions() fire input", () => {
    let player: Player;
    let gm: GameManager;
    let spawnProjectile: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        player = new Player();
        ({ gm, spawnProjectile } = makeGameManager(player));
    });

    it("fires when held, ability active, cooldown ready, and player NORMAL", () => {
        player.grantFireAbility();
        gm.fire.press();
        gm.processActions();
        expect(spawnProjectile).toHaveBeenCalledTimes(1);
        expect(spawnProjectile).toHaveBeenCalledWith(player.facing);
    });

    it("does not fire when no FireOrb has been collected", () => {
        gm.fire.press();
        gm.processActions();
        expect(spawnProjectile).not.toHaveBeenCalled();
    });

    it("does not fire again while still on cooldown", () => {
        player.grantFireAbility();
        gm.fire.press();
        gm.processActions();
        expect(spawnProjectile).toHaveBeenCalledTimes(1);

        gm.fire.press();
        gm.processActions();
        expect(spawnProjectile).toHaveBeenCalledTimes(1); // still just the one call
    });

    it("does not fire when the fire key is not held", () => {
        player.grantFireAbility();
        gm.processActions();
        expect(spawnProjectile).not.toHaveBeenCalled();
    });

    it("does not fire when the player is not in the NORMAL state", () => {
        player.grantFireAbility();
        player.setState(CreatureState.DYING);
        gm.fire.press();
        gm.processActions();
        expect(spawnProjectile).not.toHaveBeenCalled();
    });

    it("vel.y is untouched by the fire branch (vel.x is always reset to 0 each frame when no movement key is held, same as every other branch)", () => {
        player.addVelocity(0, 0.3); // simulate gravity/fall speed
        player.grantFireAbility();
        gm.fire.press();
        gm.processActions();
        expect(player.getVelocity().y).toBeCloseTo(0.3);
    });
});
