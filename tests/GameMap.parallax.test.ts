import { describe, it, expect } from "vitest";
import { computeParallaxX } from "../src/GameMap";

// All tests use: myW=800 (viewport), mapWidth=3200 (50 tiles × 64px), bgWidth=1600
// The correct formula scales offsetX by (myW - bgWidth) / (myW - mapWidth) = (-800)/(-2400) = 1/3
// The bug returns offsetX unchanged, which makes the background scroll at the same rate as the map.

describe("computeParallaxX (parallax scrolling offset)", () => {
    it("returns 0 when camera is at the left edge", () => {
        expect(computeParallaxX(0, 800, 3200, 1600)).toBe(0);
    });

    it("returns a proportionally smaller offset than offsetX mid-map", () => {
        // offsetX=-600, correct = (-600 * -800) / -2400 = -200
        expect(computeParallaxX(-600, 800, 3200, 1600)).toBe(-200);
    });

    it("returns (myW - bgWidth) when camera is at the right edge", () => {
        // offsetX = myW - mapWidth = -2400, correct = (-2400 * -800) / -2400 = -800 = myW - bgWidth
        expect(computeParallaxX(-2400, 800, 3200, 1600)).toBe(-800);
    });

    it("background scrolls slower than the map for all mid-map positions", () => {
        // |parallaxX| should always be less than |offsetX| when 0 > offsetX > myW - mapWidth
        for (const offsetX of [-600, -1200, -2000]) {
            const result = computeParallaxX(offsetX, 800, 3200, 1600);
            expect(Math.abs(result)).toBeLessThan(Math.abs(offsetX));
        }
    });
});
