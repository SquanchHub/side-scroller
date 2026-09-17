import { describe, it, expect, vi } from "vitest";
import { ResourceManager } from "../src/ResourceManager";
import { Player } from "../src/sprites/Player";
import { Creature, Grub, Fly } from "../src/sprites/Creature";
import { FireOrb, Heart, Music, PowerUp, Star } from "../src/sprites/PowerUp";
import { Projectile } from "../src/sprites/Projectile";
import { Bullet } from "../src/sprites/Bullet";
import { Sprite } from "../src/sprites/Sprite";
import { Explosion } from "../src/sprites/Explosion";

// buildSprite() only reads this.loads (to resolve "img"/"sheet" names to
// already-loaded images), so a bare Object.create(ResourceManager.prototype)
// with just `loads` wired up is enough - no need for the async init()/p5
// asset-loading pipeline that the real constructor kicks off.
function makeManager(loads: Record<string, unknown> = {}): ResourceManager {
    const rm = Object.create(ResourceManager.prototype) as ResourceManager;
    rm.loads = loads;
    rm.resources = {};
    return rm;
}

describe("ResourceManager.buildSprite() - sprite type construction", () => {
    it.each([
        ["Player", Player],
        ["Creature", Creature],
        ["Sprite", Sprite],
        ["Grub", Grub],
        ["Fly", Fly],
        ["Heart", Heart],
        ["PowerUp", PowerUp],
        ["Star", Star],
        ["Music", Music],
        ["Explosion", Explosion],
        ["FireOrb", FireOrb],
        ["Projectile", Projectile],
        ["Bullet", Bullet],
    ])("builds a %s instance for spriteType %s", (spriteType, ctor) => {
        const rm = makeManager();
        const s = rm.buildSprite("someName", {}, spriteType);
        expect(s).toBeInstanceOf(ctor);
    });

    it("throws and logs an error for an unrecognized spriteType", () => {
        const rm = makeManager();
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => rm.buildSprite("mystery", {}, "NotARealType")).toThrow();
        expect(errorSpy).toHaveBeenCalledWith("No Sprite Type:", "NotARealType");
        errorSpy.mockRestore();
    });
});

describe("ResourceManager.buildSprite() - per-name art/behavior wiring", () => {
    it("nudges player/caveman/grub down at draw time (drawOffsetY=3) but leaves other sprites alone", () => {
        const rm = makeManager();
        expect(rm.buildSprite("player", {}, "Player").drawOffsetY).toBe(3);
        expect(rm.buildSprite("caveman", {}, "Grub").drawOffsetY).toBe(3);
        expect(rm.buildSprite("grub", {}, "Grub").drawOffsetY).toBe(3);
        expect(rm.buildSprite("star", {}, "Star").drawOffsetY).toBe(0);
    });

    it("marks player/caveman to incinerate on death (explosion effect, no body left behind)", () => {
        const rm = makeManager();
        const player = rm.buildSprite("player", {}, "Player") as Creature;
        expect(player.deathEffect).toBe("explosion");
        expect(player.explodesOnDeath).toBe(true);

        const caveman = rm.buildSprite("caveman", {}, "Grub") as Creature;
        expect(caveman.deathEffect).toBe("explosion");
        expect(caveman.explodesOnDeath).toBe(true);
    });

    it("marks grub/fly to spawn a bugjuice splat but keep tumbling through their own death animation", () => {
        const rm = makeManager();
        const grub = rm.buildSprite("grub", {}, "Grub") as Creature;
        expect(grub.deathEffect).toBe("bugjuice");
        expect(grub.explodesOnDeath).toBe(false);

        const fly = rm.buildSprite("fly", {}, "Fly") as Creature;
        expect(fly.deathEffect).toBe("bugjuice");
        expect(fly.explodesOnDeath).toBe(false);
    });

    it("leaves unrelated sprite names (e.g. a powerup) with the default null deathEffect", () => {
        const rm = makeManager();
        const star = rm.buildSprite("star", {}, "Star");
        expect((star as unknown as { deathEffect?: string }).deathEffect).toBeUndefined();
    });
});

describe("ResourceManager.buildSprite() - animation/frame assembly", () => {
    it("builds a frame from a plain 'img' entry and selects the first animation added as current", () => {
        const img = { width: 10, height: 10 };
        const rm = makeManager({ idle1: img });
        const s = rm.buildSprite("thing", { default: [{ img: "idle1", duration: 100 }] }, "Sprite");
        expect(s.getImage()).toBe(img);
    });

    it("only marks the FIRST animation encountered as current, even with multiple animations", () => {
        const img = { width: 10, height: 10 };
        const rm = makeManager({ idle1: img, other1: img });
        const s = rm.buildSprite(
            "thing",
            {
                left: [{ img: "idle1", duration: 100 }],
                right: [{ img: "other1", duration: 100 }],
            },
            "Sprite"
        );
        expect((s as unknown as { currAnimName: string }).currAnimName).toBe("left");
    });

    it("applies the mirror operator via ResourceManager.mirror()", () => {
        const img = { width: 10, height: 10 };
        const rm = makeManager({ idle1: img });
        const mirrorSpy = vi
            .spyOn(rm, "mirror")
            .mockReturnValue({ width: 10, height: 10 } as unknown as p5.Image);
        rm.buildSprite(
            "thing",
            { default: [{ img: "idle1", duration: 100, operators: ["mirror"] }] },
            "Sprite"
        );
        expect(mirrorSpy).toHaveBeenCalledWith(img);
    });

    it("applies the flip operator via ResourceManager.flip()", () => {
        const img = { width: 10, height: 10 };
        const rm = makeManager({ idle1: img });
        const flipSpy = vi
            .spyOn(rm, "flip")
            .mockReturnValue({ width: 10, height: 10 } as unknown as p5.Image);
        rm.buildSprite(
            "thing",
            { default: [{ img: "idle1", duration: 100, operators: ["flip"] }] },
            "Sprite"
        );
        expect(flipSpy).toHaveBeenCalledWith(img);
    });

    it("applies multiple operators in order (flip then mirror)", () => {
        const img = { width: 10, height: 10 };
        const flipped = { width: 10, height: 10, tag: "flipped" };
        const rm = makeManager({ idle1: img });
        const flipSpy = vi.spyOn(rm, "flip").mockReturnValue(flipped as unknown as p5.Image);
        const mirrorSpy = vi
            .spyOn(rm, "mirror")
            .mockReturnValue({ width: 10, height: 10 } as unknown as p5.Image);
        rm.buildSprite(
            "thing",
            { default: [{ img: "idle1", duration: 100, operators: ["flip", "mirror"] }] },
            "Sprite"
        );
        expect(flipSpy).toHaveBeenCalledWith(img);
        expect(mirrorSpy).toHaveBeenCalledWith(flipped);
    });

    it("warns and keeps the unmodified frame when given an unrecognized operator, instead of crashing", () => {
        const img = { width: 10, height: 10 };
        const rm = makeManager({ idle1: img });
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const s = rm.buildSprite(
            "thing",
            { default: [{ img: "idle1", duration: 100, operators: ["spin"] }] },
            "Sprite"
        );
        expect(warnSpy).toHaveBeenCalledWith(
            "Invalid Operation for Sprite ",
            "thing",
            ":",
            "spin",
            "- skipping frame for animation",
            "default"
        );
        expect(s.getImage()).toBe(img); // frame was still added, just unmodified
        warnSpy.mockRestore();
    });

    it("builds frames from a 'sheet' entry via divideUpImage()", () => {
        const sheetImg = { width: 32, height: 32 };
        const slice1 = { width: 16, height: 16 };
        const slice2 = { width: 16, height: 16 };
        const rm = makeManager({ sheet1: sheetImg });
        const divideSpy = vi
            .spyOn(rm, "divideUpImage")
            .mockReturnValue([slice1, slice2] as unknown as p5.Image[]);
        const s = rm.buildSprite(
            "thing",
            { default: [{ sheet: "sheet1", rows: 1, cols: 2, duration: 100 }] },
            "Sprite"
        );
        expect(divideSpy).toHaveBeenCalledWith(sheetImg, 1, 2);
        // both slices should have been added as separate frames of the same animation
        expect(s.getImage()).toBe(slice1); // currFrameIndex starts at 0
    });
});
