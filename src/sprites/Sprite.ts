/**
 * A Sprite is a character in a game.  It can have mulitple animations and each animation
 * can have multiple images displayed for a varying amount of time.  In addition, a Sprite can have different
 * state properties which can be set/changed/deleted.  These state properties can be used to change the Sprites
 * behavior and abilities.
 */

export class Sprite {
    protected position: p5.Vector;
    protected velocity: p5.Vector;
    protected animations: AnimPair;
    protected currAnimName: string;
    protected currAnimation: Animation;
    // Purely cosmetic vertical offset applied only when drawing (see
    // GameMap.draw()) -- lets a sprite's art be nudged relative to its
    // hitbox/collision position without editing the image files or
    // affecting physics. Applies equally to every animation (including
    // flipped/dead poses), unlike baking an offset into the image itself.
    drawOffsetY: number;

    constructor() {
        this.animations = {};
        this.addAnimation("default");
        this.position = createVector(0, 0);
        this.velocity = createVector(0, 0);
        this.currAnimName = "default";
        this.currAnimation = this.animations["default"];
        this.drawOffsetY = 0;
    }

    collideVertical() {
        this.velocity.y = 0;
    }

    collideHorizontal() {
        this.velocity.x = -this.velocity.x;
    }

    isFlying() {
        return false;
    }

    clone() {
        const s = new (this.constructor as any)();
        s.position = this.position.copy();
        s.velocity = this.velocity.copy();
        s.animations = {}; //throw away the animations from the new constructor call
        //and copy over the animations from this
        for (const key in this.animations) {
            if (Object.prototype.hasOwnProperty.call(this.animations, key)) {
                const element = this.animations[key];
                s.animations[key] = element.clone();
            }
        }
        s.currAnimName = this.currAnimName;
        s.currAnimation = s.animations[s.currAnimName];
        s.drawOffsetY = this.drawOffsetY;
        return s;
    }

    getPosition() {
        return this.position;
    }

    getVelocity() {
        return this.velocity;
    }

    addVelocity(x: number, y: number) {
        this.velocity.add(x, y);
    }

    setVelocity(x: number, y: number) {
        if (x > 0) {
            this.setAnimation("right");
        } else if (x < 0) {
            this.setAnimation("left");
        }
        this.velocity.set(x, y);
    }

    setPosition(x: number, y: number) {
        this.position.set(x, y);
    }

    addAnimations(anims: { string: p5.Image }, width: number, duration: number, reverse = false) {
        for (const name in anims) {
            if (Object.prototype.hasOwnProperty.call(anims, name)) {
                const img = anims[name];
                this.animations[name] = new Animation();
                for (
                    let i = reverse ? img.width - width : 0;
                    reverse ? i >= 0 : i < img.width;
                    reverse ? (i -= width) : (i += width)
                ) {
                    const frame = img.get(i, 0, width, img.height);
                    this.addFrame(name, frame, duration);
                }
            }
        }
    }

    addAnimation(name: string) {
        this.animations[name] = new Animation();
        // Defaults to looping (see the Animation constructor) -- e.g.
        // grub/fly's own flipped deadLeft/deadRight cycle continuously for
        // their whole death pause, same as their living walk cycle. A
        // sprite that should play an animation once instead (see
        // Explosion) overrides addAnimation() to set loop=false itself,
        // rather than this being inferred from the animation's name.
        //this.currAnimName=name;
        //this.currAnimation=this.animations[name];
    }

    setAnimation(name: string) {
        this.currAnimName = name;
        this.currAnimation = this.animations[name];
        //this.start();
    }

    addFrame(name: string, img: p5.Image, duration: number) {
        this.animations[name].totalDuration += duration;
        this.animations[name].frames.push(new AnimFrame(img, this.animations[name].totalDuration));
    }

    start() {
        this.currAnimation.animTime = 0;
        this.currAnimation.currFrameIndex = 0;
    }

    update(elapsedTime: number) {
        //update the animation
        if (this.currAnimation.frames.length > 1) {
            this.currAnimation.animTime += elapsedTime;
            if (this.currAnimation.animTime >= this.currAnimation.totalDuration) {
                if (this.currAnimation.loop) {
                    this.currAnimation.animTime %= this.currAnimation.totalDuration;
                    this.currAnimation.currFrameIndex = 0;
                } else {
                    // Hold on the last frame instead of wrapping back to
                    // frame 0 -- e.g. a death animation should stay on its
                    // final frame once finished, not flash back to its
                    // first frame for the last tick or two before the
                    // creature is actually removed.
                    this.currAnimation.animTime = this.currAnimation.totalDuration;
                    this.currAnimation.currFrameIndex = this.currAnimation.frames.length - 1;
                }
            }
            while (
                this.currAnimation.animTime >
                this.currAnimation.frames[this.currAnimation.currFrameIndex].endTime
            ) {
                this.currAnimation.currFrameIndex++;
            }
        }
    }

    getImage(): p5.Image {
        if (this.currAnimation.frames.length > 0) {
            return this.currAnimation.frames[this.currAnimation.currFrameIndex].image;
        }
        return null;
    }

    // GameMap's tile-collision math uses these (not getImage() directly) to
    // size the sprite's hitbox. Defaulting to the current frame's actual
    // size preserves existing behavior for every sprite that doesn't
    // override this. Player does override it, since its cosmetic frames
    // (e.g. the dash pose's wider energy-trail art) vary in size while the
    // character's actual footprint doesn't -- using the raw image size
    // there would size/reposition the hitbox differently per animation
    // frame, causing a visible snap when a frame with a different width
    // collides with a wall and the animation then changes.
    getCollisionWidth(): number {
        return this.getImage().width;
    }

    getCollisionHeight(): number {
        return this.getImage().height;
    }

    // Where GameMap.draw() should draw this sprite's current frame,
    // relative to its physics position (the top of its collision box).
    // Bottom-aligns the actual image within the declared collision height
    // -- necessary whenever a cosmetic frame's real size differs from
    // getCollisionHeight() (e.g. Player's dash pose, whose canvas is
    // shorter than the standard 64px collision box: drawing it top-aligned
    // like every other frame would leave a gap under its feet and make it
    // look like it's floating) -- then applies drawOffsetY on top for any
    // further per-sprite margin adjustment.
    getDrawOffsetY(): number {
        return this.getCollisionHeight() - this.getImage().height + this.drawOffsetY;
    }
}

interface AnimPair {
    [name: string]: Animation;
}

class Animation {
    frames: AnimFrame[];
    currFrameIndex: number;
    animTime: number;
    totalDuration: number;
    loop: boolean;

    constructor() {
        this.frames = [];
        this.currFrameIndex = 0;
        this.animTime = 0;
        this.totalDuration = 0;
        this.loop = true;
    }

    clone(): Animation {
        // The cloned Animation is a pointer to this Animation, except
        // currFrameIndex and animTime so the cloned Animation can be at
        // a different point in the animation cycle.
        const a = new Animation();
        a.frames = this.frames;
        a.totalDuration = this.totalDuration;
        a.loop = this.loop;
        return a;
    }
}

class AnimFrame {
    image: p5.Image;
    endTime: number;

    constructor(img: p5.Image, endTime: number) {
        this.image = img;
        this.endTime = endTime;
    }
}
