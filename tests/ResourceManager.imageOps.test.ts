import { describe, it, expect, vi, afterEach } from "vitest";
import { ResourceManager } from "../src/ResourceManager";

// flip()/mirror()/divideUpImage() operate on p5.Image-like objects
// (width/height/pixels + loadPixels()/updatePixels(), plus the global
// createImage()/createGraphics() factories) that nothing in tests/mocks or
// tests/setup.ts stubs. Fakes are built by hand here instead.
function makeFakeImage(width: number, height: number, pixels: number[]) {
    return {
        width,
        height,
        pixels: pixels.slice(),
        loadPixels: vi.fn(),
        updatePixels: vi.fn(),
    };
}

function makeManager(): ResourceManager {
    return Object.create(ResourceManager.prototype) as ResourceManager;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("ResourceManager.flip() - vertical mirror", () => {
    it("maps row r of the input to row (height-1-r) of the output (regression: off-by-one used to write out of bounds)", () => {
        vi.stubGlobal("createImage", (w: number, h: number) =>
            makeFakeImage(w, h, new Array(w * h * 4).fill(0))
        );

        const rm = makeManager();
        // 1px wide, 2px tall: row0 = (10,20,30,40), row1 = (50,60,70,80)
        const input = makeFakeImage(1, 2, [10, 20, 30, 40, 50, 60, 70, 80]);

        const output = rm.flip(input as unknown as p5.Image) as unknown as {
            pixels: number[];
            width: number;
            height: number;
        };

        expect(output.width).toBe(1);
        expect(output.height).toBe(2);
        // row0 of the output should be the input's LAST row, and vice versa
        expect(output.pixels.slice(0, 4)).toEqual([50, 60, 70, 80]);
        expect(output.pixels.slice(4, 8)).toEqual([10, 20, 30, 40]);
    });

    it("leaves a single-row image unchanged", () => {
        vi.stubGlobal("createImage", (w: number, h: number) =>
            makeFakeImage(w, h, new Array(w * h * 4).fill(0))
        );
        const rm = makeManager();
        const input = makeFakeImage(1, 1, [1, 2, 3, 4]);
        const output = rm.flip(input as unknown as p5.Image) as unknown as { pixels: number[] };
        expect(output.pixels).toEqual([1, 2, 3, 4]);
    });
});

describe("ResourceManager.mirror() - horizontal reflection", () => {
    it("maps column c of the input to column (width-1-c) of the output", () => {
        vi.stubGlobal("createImage", (w: number, h: number) =>
            makeFakeImage(w, h, new Array(w * h * 4).fill(0))
        );

        const rm = makeManager();
        // 2px wide, 1px tall: col0 = (1,2,3,4), col1 = (5,6,7,8)
        const input = makeFakeImage(2, 1, [1, 2, 3, 4, 5, 6, 7, 8]);

        const output = rm.mirror(input as unknown as p5.Image) as unknown as { pixels: number[] };

        expect(output.pixels.slice(0, 4)).toEqual([5, 6, 7, 8]);
        expect(output.pixels.slice(4, 8)).toEqual([1, 2, 3, 4]);
    });
});

describe("ResourceManager.divideUpImage()", () => {
    it("slices a sheet into rows*cols sub-images and forces the working canvas to density 1", () => {
        const gotten: object[] = [];
        const canvas = {
            pixelDensity: vi.fn(),
            image: vi.fn(),
            get: vi.fn(() => {
                const slice = {};
                gotten.push(slice);
                return slice;
            }),
            clear: vi.fn(),
        };
        vi.stubGlobal(
            "createGraphics",
            vi.fn(() => canvas)
        );

        const rm = makeManager();
        const sheet = { width: 4, height: 2 }; // 1 row x 2 cols of 2x2 tiles
        const images = rm.divideUpImage(sheet as unknown as p5.Image, 1, 2);

        expect(canvas.pixelDensity).toHaveBeenCalledWith(1);
        expect(images).toHaveLength(2);
        expect(images).toEqual(gotten);
        expect(canvas.image).toHaveBeenCalledTimes(2);
        expect(canvas.clear).toHaveBeenCalledTimes(2);
        // first tile is cropped from (0,0), second from (2,0), each 2x2
        expect(canvas.image).toHaveBeenNthCalledWith(1, sheet, 0, 0, 2, 2, 0, 0, 2, 2);
        expect(canvas.image).toHaveBeenNthCalledWith(2, sheet, 0, 0, 2, 2, 2, 0, 2, 2);
    });
});
