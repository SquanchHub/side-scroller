import { describe, it, expect, vi } from "vitest";
import {
    getEnergySlotImageName,
    getEnergyFramePowerImageName,
    GameMap,
    ENERGY_BAR_X,
    ENERGY_BAR_Y,
    ENERGY_FRAME_POWER_OFFSET_X,
    ENERGY_FRAME_POWER_OFFSET_Y,
} from "../src/GameMap";
import { Player } from "../src/sprites/Player";
import type { ResourceManager } from "../src/ResourceManager";

describe("getEnergySlotImageName()", () => {
    it("cycles through energy1-3 for a full slot, 150ms per frame", () => {
        expect(getEnergySlotImageName(0, 3, 0, 0)).toBe("energy1");
        expect(getEnergySlotImageName(0, 3, 0, 149)).toBe("energy1");
        expect(getEnergySlotImageName(0, 3, 0, 150)).toBe("energy2");
        expect(getEnergySlotImageName(0, 3, 0, 300)).toBe("energy3");
        expect(getEnergySlotImageName(0, 3, 0, 450)).toBe("energy1"); // loops
    });

    it("a slot at or beyond the current energy count, with no active burst, is empty", () => {
        expect(getEnergySlotImageName(1, 1, 0, 0)).toBeNull();
        expect(getEnergySlotImageName(2, 1, 0, 0)).toBeNull();
    });

    it("shows the energyUsed burst on exactly the slot that was just spent (index == energy)", () => {
        // energy=1 means slots 0 is full, slot 1 is the one just emptied,
        // slot 2 was already empty before this.
        expect(getEnergySlotImageName(0, 1, 300, 1000)).toBe("energy1"); // still full, unaffected
        expect(getEnergySlotImageName(1, 1, 300, 1000)).toBe("energyUsed1"); // just spent, burst starts
        expect(getEnergySlotImageName(2, 1, 300, 1000)).toBeNull(); // long empty, no burst here
    });

    it("advances through the energyUsed burst as energyUsedTimer counts down", () => {
        const full = Player.ENERGY_USED_ANIM_DURATION; // 300
        expect(getEnergySlotImageName(1, 1, full, 0)).toBe("energyUsed1"); // elapsed=0
        expect(getEnergySlotImageName(1, 1, full - 100, 0)).toBe("energyUsed2"); // elapsed=100
        expect(getEnergySlotImageName(1, 1, full - 200, 0)).toBe("energyUsed3"); // elapsed=200
        expect(getEnergySlotImageName(1, 1, 1, 0)).toBe("energyUsed3"); // elapsed=299, holds frame 3
    });

    it("goes empty once energyUsedTimer reaches 0, even for the just-spent slot", () => {
        expect(getEnergySlotImageName(1, 1, 0, 0)).toBeNull();
    });
});

describe("getEnergyFramePowerImageName()", () => {
    it("cycles through energyFramePower1-3, 150ms per frame, looping", () => {
        expect(getEnergyFramePowerImageName(0)).toBe("energyFramePower1");
        expect(getEnergyFramePowerImageName(150)).toBe("energyFramePower2");
        expect(getEnergyFramePowerImageName(300)).toBe("energyFramePower3");
        expect(getEnergyFramePowerImageName(450)).toBe("energyFramePower1");
    });
});

describe("GameMap.drawEnergyBar()", () => {
    // image() is a p5 global draw() already relies on; not stubbed globally
    // in tests/setup.ts since no other test needs it. Named images are
    // returned as-is by the resources stub so assertions can check exactly
    // which name was requested/drawn.
    function makeMap(player: Player) {
        const map = Object.create(GameMap.prototype) as GameMap;
        map.player = player;
        map.hudTime = 1000;
        map.resources = {
            get: (name: string) => ({ name, width: 8, height: 8 }),
        } as unknown as ResourceManager;
        return map;
    }

    it("draws the plain frame plus one image per full slot, centered on the measured slot positions", () => {
        (globalThis as any).image = vi.fn();
        const player = new Player();
        player.energy = 2;
        const map = makeMap(player);

        map.drawEnergyBar();

        const calls = (globalThis as any).image.mock.calls;
        expect(calls[0][0]).toEqual({ name: "energyFrame", width: 8, height: 8 });
        expect(calls[0][1]).toBe(ENERGY_BAR_X);
        expect(calls[0][2]).toBe(ENERGY_BAR_Y);
        // 2 full slots drawn (energy=2), no third (empty, no burst) -- frame + 2 units = 3 calls total.
        expect(calls).toHaveLength(3);
        expect(calls[1][0].name).toMatch(/^energy[123]$/);
        expect(calls[2][0].name).toMatch(/^energy[123]$/);
    });

    it("draws only the looping powered frame while hasFireAbility() is active, nothing else", () => {
        (globalThis as any).image = vi.fn();
        const player = new Player();
        player.grantFireAbility();
        const map = makeMap(player);

        map.drawEnergyBar();

        const calls = (globalThis as any).image.mock.calls;
        expect(calls).toHaveLength(1);
        expect(calls[0][0].name).toMatch(/^energyFramePower[123]$/);
        // Shifted left/up from the plain frame's anchor -- its canvas is
        // bigger (the flame extends past the metal structure) -- so the
        // underlying bar still lines up across the swap.
        expect(calls[0][1]).toBe(ENERGY_BAR_X + ENERGY_FRAME_POWER_OFFSET_X);
        expect(calls[0][2]).toBe(ENERGY_BAR_Y + ENERGY_FRAME_POWER_OFFSET_Y);
    });
});
