import { describe, it, expect } from "vitest";
import { Bullet } from "../src/sprites/Bullet";

describe("Bullet", () => {
    it("ignores gravity (isFlying() is true)", () => {
        const b = new Bullet();
        expect(b.isFlying()).toBe(true);
    });

    it("does not spawn an explosion when it disappears (explodesOnRemoval is false)", () => {
        const b = new Bullet();
        expect(b.explodesOnRemoval).toBe(false);
    });

    it("clone() preserves explodesOnRemoval=false", () => {
        const b = new Bullet();
        const cloned = b.clone();
        expect(cloned.explodesOnRemoval).toBe(false);
        expect(cloned.isFlying()).toBe(true);
    });

    it("still inherits ordinary Projectile behavior (hitSomething on a wall, LIFETIME expiry)", () => {
        const b = new Bullet();
        expect(b.hitSomething).toBe(false);
        b.collideHorizontal();
        expect(b.hitSomething).toBe(true);
        expect(b.isExpired()).toBe(false);
        b.update(b.LIFETIME + 1);
        expect(b.isExpired()).toBe(true);
    });
});
