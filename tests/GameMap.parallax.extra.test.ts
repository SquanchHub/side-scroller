import { describe, it, expect } from "vitest";
import { computeParallaxX } from "../src/GameMap";

describe("computeParallaxX (parallax scrolling offset)", () => {
    it("returns 0 without dividing by zero when mapWidth equals myW", () => {
        // mapWidth === myW means the map never scrolls (offsetX is always 0),
        // which would otherwise make the scaling ratio's denominator 0.
        expect(computeParallaxX(0, 800, 800, 1600)).toBe(0);
    });
});
