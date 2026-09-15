import { describe, it, expect } from "vitest";
import { Projectile } from "../src/sprites/Projectile";

describe("Projectile", () => {
    it("constructor sets lifeRemaining=LIFETIME and hitSomething=false", () => {
        const p = new Projectile();
        expect(p.lifeRemaining).toBe(p.LIFETIME);
        expect(p.hitSomething).toBe(false);
    });

    it("isFlying() returns false so GameMap.updateSprite() applies gravity to it", () => {
        expect(new Projectile().isFlying()).toBe(false);
    });

    it("setVelocity() sets velocity", () => {
        const p = new Projectile();
        p.setVelocity(0.6, 0);
        expect(p.getVelocity().x).toBeCloseTo(0.6);
        expect(p.getVelocity().y).toBe(0);
    });

    it("setVelocity() does not touch animation state (regression: base Sprite.setVelocity() would crash without a left/right animation defined)", () => {
        const p = new Projectile();
        const before = (p as any).currAnimation;
        expect(() => p.setVelocity(0.6, 0)).not.toThrow();
        expect((p as any).currAnimation).toBe(before);
        expect(() => p.update(16)).not.toThrow();
        expect(() => p.getImage()).not.toThrow();
    });

    it("collideHorizontal() sets hitSomething without zeroing velocity", () => {
        const p = new Projectile();
        p.setVelocity(0.6, 0);
        p.collideHorizontal();
        expect(p.hitSomething).toBe(true);
        expect(p.getVelocity().x).toBeCloseTo(0.6);
    });

    it("collideVertical() zeroes vertical velocity but does NOT set hitSomething - it rests/rolls on the ground instead of disappearing", () => {
        const p = new Projectile();
        p.setVelocity(0.6, 0.3);
        p.collideVertical();
        expect(p.hitSomething).toBe(false);
        expect(p.getVelocity().y).toBe(0);
        expect(p.getVelocity().x).toBeCloseTo(0.6); // horizontal motion is untouched - it keeps rolling
    });

    it("isExpired() is false before LIFETIME elapses", () => {
        const p = new Projectile();
        p.update(p.LIFETIME - 1);
        expect(p.isExpired()).toBe(false);
    });

    it("isExpired() is true once LIFETIME has fully elapsed", () => {
        const p = new Projectile();
        p.update(p.LIFETIME);
        expect(p.isExpired()).toBe(true);
    });

    it("clone() produces an independent instance with a fresh lifetime and hitSomething reset", () => {
        const template = new Projectile();
        template.update(500); // partially decay the template
        template.collideHorizontal(); // hitSomething = true on the template

        const cloned = template.clone();
        expect(cloned).not.toBe(template);
        expect(cloned.lifeRemaining).toBe(cloned.LIFETIME);
        expect(cloned.hitSomething).toBe(false);
        expect(cloned.SPEED).toBe(template.SPEED);
    });
});
