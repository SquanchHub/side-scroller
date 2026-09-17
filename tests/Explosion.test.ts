import { describe, it, expect } from "vitest";
import { Explosion } from "../src/sprites/Explosion";

// Explosion is a play-once visual effect (see the class doc comment): no
// physics, no collision, just an animation that holds on its last frame
// instead of looping. update()'s frame-advance logic only kicks in once an
// animation has more than one frame (see Sprite.update()), so every test
// here adds at least two frames.
function makeExplosion(frameCount = 3, frameDuration = 100): Explosion {
    const e = new Explosion();
    for (let i = 0; i < frameCount; i++) {
        e.addFrame("default", { width: 8, height: 8 } as unknown as p5.Image, frameDuration);
    }
    return e;
}

describe("Explosion", () => {
    it("the constructor's default animation is non-looping (addAnimation override applies immediately)", () => {
        const e = new Explosion();
        expect(
            (e as unknown as { animations: Record<string, { loop: boolean }> }).animations[
                "default"
            ].loop
        ).toBe(false);
    });

    it("addAnimation() marks any newly added animation as non-looping too", () => {
        const e = new Explosion();
        e.addAnimation("extra");
        expect(
            (e as unknown as { animations: Record<string, { loop: boolean }> }).animations["extra"]
                .loop
        ).toBe(false);
    });

    it("isFinished() is false before the animation has played through its total duration", () => {
        const e = makeExplosion(3, 100); // totalDuration = 300
        e.update(50);
        expect(e.isFinished()).toBe(false);
    });

    it("isFinished() becomes true once elapsed time reaches the total duration", () => {
        const e = makeExplosion(3, 100); // totalDuration = 300
        e.update(300);
        expect(e.isFinished()).toBe(true);
    });

    it("holds on the last frame once finished instead of looping back to the first", () => {
        const e = makeExplosion(3, 100); // totalDuration = 300
        e.update(1000); // well past the end
        expect(e.isFinished()).toBe(true);
        expect(
            (e as unknown as { currAnimation: { currFrameIndex: number } }).currAnimation
                .currFrameIndex
        ).toBe(2); // last of the 3 frames, not wrapped back to 0
    });
});
