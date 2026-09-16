import { Player } from "./sprites/Player.js";
import { ResourceManager } from "./ResourceManager.js";
import { Sprite } from "./sprites/Sprite.js";
import { GRAVITY } from "./GameManager.js";
import { Creature, CreatureState } from "./sprites/Creature.js";
import { FireOrb, Heart, Music, PowerUp, Star } from "./sprites/PowerUp.js";
import { Explosion } from "./sprites/Explosion.js";
import { Projectile } from "./sprites/Projectile.js";
import { Settings } from "./Settings.js";
import { SoundManager } from "./SoundManager.js";

// Upper bound (ms) on the timestep GameMap.updateSprite() uses for a single
// frame's physics -- see the comment at its usage for why this exists.
// ~3 frames' worth at a steady 60fps, generous enough to not affect normal
// play but well below the length of a genuine loading-style stutter.
export const MAX_PHYSICS_DELTA_TIME = 50;

export function computeParallaxX(
    offsetX: number,
    myW: number,
    mapWidth: number,
    bgWidth: number
): number {
    if (mapWidth === myW) return 0;
    return Math.trunc((offsetX * (myW - bgWidth)) / (myW - mapWidth));
}

// --- Energy (stamina) HUD ---
// Top-left corner of the bar's own art (energyFrame.png), in the same fixed
// 800x600 logical space draw() already uses for tiles/background.
export const ENERGY_BAR_X = 20;
export const ENERGY_BAR_Y = 20;
// Centers of the 3 compartments built into energyFrame.png, measured
// directly off that art (relative to its own top-left corner) -- there's no
// other way to derive them, since the 3 slots are baked into one image
// rather than being separate pieces.
const ENERGY_SLOT_CENTERS: { x: number; y: number }[] = [
    { x: 44, y: 23 },
    { x: 100, y: 23 },
    { x: 156, y: 23 },
];
// energyFramePower's canvas is bigger than the plain frame's (the flame
// extends past the metal structure on every side, whereas the plain frame
// was cropped tight to its content), so the same underlying bar structure
// sits further from THAT canvas's own top-left corner. Drawing it at the
// plain frame's exact position would visibly shift the bar down-right;
// this pulls it back left/up so the metal structure lines up across the
// swap. Derived from where the bar sits in the source art plus each power
// frame's own padding, and close enough across all 3 frames (~1px apart)
// to use one constant offset rather than one per frame.
export const ENERGY_FRAME_POWER_OFFSET_X = -10;
export const ENERGY_FRAME_POWER_OFFSET_Y = -13;
const ENERGY_UNIT_FRAME_DURATION = 150; // energy1-3 loop, matches resources.json... (a plain "images" lookup here, not an Animation, so the duration is only known to this file)
const ENERGY_USED_FRAME_DURATION = 100; // energyUsed1-3 one-shot
const ENERGY_FRAME_POWER_FRAME_DURATION = 150; // energyFramePower1-3 loop

// Which image name to draw for one energy slot (index 0-2), or null to draw
// nothing (empty, still regenerating). A pure function of state/time so it's
// directly testable without a p5 canvas -- see GameMap.drawEnergyBar().
export function getEnergySlotImageName(
    slotIndex: number,
    energy: number,
    energyUsedTimer: number,
    hudTime: number
): string | null {
    if (slotIndex < energy) {
        const frame = (Math.floor(hudTime / ENERGY_UNIT_FRAME_DURATION) % 3) + 1;
        return `energy${frame}`;
    }
    if (slotIndex === energy && energyUsedTimer > 0) {
        // Counts forward through the burst from elapsed time, not backward
        // from energyUsedTimer directly, so frame 3 (elapsed >= 200) holds
        // through the last sliver before the timer hits 0, instead of
        // skipping straight from frame 3 to empty.
        const elapsed = Player.ENERGY_USED_ANIM_DURATION - energyUsedTimer;
        const frame = Math.min(2, Math.floor(elapsed / ENERGY_USED_FRAME_DURATION)) + 1;
        return `energyUsed${frame}`;
    }
    return null;
}

// Which frame of the looping "powered" bar to draw while
// Player.hasFireAbility() is true (replacing the plain frame + slots
// entirely -- see drawEnergyBar()).
export function getEnergyFramePowerImageName(hudTime: number): string {
    const frame = (Math.floor(hudTime / ENERGY_FRAME_POWER_FRAME_DURATION) % 3) + 1;
    return `energyFramePower${frame}`;
}

export class GameMap {
    tiles: p5.Image[][];
    tile_size: number;
    sprites: Sprite[];
    projectiles: Projectile[];
    player: Player;
    background: p5.Image[];
    width: number; //height and width in tiles
    height: number;
    level: number;
    resources: ResourceManager;
    settings: Settings;
    soundManager: SoundManager;
    music: p5.SoundFile;
    // Accumulated real time, used only to pick which frame of the energy
    // bar's looping animations (unit shimmer, powered-bar flame) to show --
    // see drawEnergyBar(). Deliberately not reset by initialize() (a level
    // transition/player death restart), unlike sprites/tiles, since it's not
    // level content.
    hudTime: number;

    constructor(
        level: number,
        resources: ResourceManager,
        settings: Settings,
        soundManager: SoundManager
    ) {
        this.settings = settings;
        this.soundManager = soundManager;
        this.level = level;
        this.resources = resources;
        this.hudTime = 0;
        this.initialize();
    }

    initialize() {
        this.music = this.resources.getLoad("music");
        this.sprites = [];
        this.projectiles = [];
        this.background = []; //this.resources.get("background");
        this.tile_size = this.resources.get("TILE_SIZE");
        const mappings = this.resources.get("mappings");
        let map = this.resources.getLoad(this.resources.get("levels")[this.level]);
        if (!map) {
            this.level = 0;
            map = this.resources.getLoad(this.resources.get("levels")[this.level]);
        }
        const lines = [];
        let width = 0;
        let height = 0;
        map.forEach((line) => {
            if (!line.startsWith("#")) {
                //ignore comment lines
                if (line.startsWith("@")) {
                    const parts = line.split(" ");
                    switch (parts[0]) {
                        case "@parallax-layer": {
                            this.background.push(this.resources.getLoad(parts[1]));
                            break;
                        }
                        case "@music": {
                            this.music = this.resources.getLoad(parts[1]);
                            break;
                        }
                        default: {
                            console.warn("don't know how to handle this tag:" + parts[0]);
                            break;
                        }
                    }
                } else {
                    lines.push(line);
                    width = Math.max(width, line.length);
                }
            }
        });
        height = lines.length;
        this.width = width;
        this.height = height;
        this.tiles = [...Array(width)].map(() => Array(height));
        for (let y = 0; y < height; y++) {
            const line = lines[y];
            for (let x = 0; x < line.length; x++) {
                const ch = line.charAt(x);
                if (ch === " ") continue;
                //tiles are A-Z, sprites are a-z, 0-9, and special characters
                if (ch.match(/[A-Z]/)) {
                    //no need to look at mappings for tiles.
                    this.tiles[x][y] = this.resources.get(ch);
                } else {
                    const s = this.resources.get(mappings[ch]).clone();
                    s.setPosition(
                        this.tilesToPixels(x) + this.tile_size - s.getImage().width / 2,
                        this.tilesToPixels(y) + this.tile_size - s.getImage().height
                    );
                    if (ch == "0") {
                        //I don't like hard-coding in the character for the player.
                        this.player = s;
                    } else {
                        this.sprites.push(s);
                    }
                }
            }
        }
    }

    tilesToPixels(x: number): number {
        return Math.floor(x * this.tile_size);
    }

    pixelsToTiles(x: number): number {
        return Math.floor(x / this.tile_size);
    }

    draw() {
        const myW = 800;
        const myH = 600;
        const mapWidth = this.tilesToPixels(this.width);
        const position = this.player.getPosition();
        let offsetX = myW / 2 - Math.round(position.x) - this.tile_size;
        offsetX = Math.min(offsetX, 0);
        offsetX = Math.trunc(Math.max(offsetX, myW - mapWidth));

        const offsetY = Math.trunc(myH - this.tilesToPixels(this.height));
        this.background.forEach((bg) => {
            const x = computeParallaxX(offsetX, myW, mapWidth, bg.width);
            const y = Math.trunc(myH - bg.height);
            image(bg, 0, 0, myW, myH, 0 - x, 0 - y, 800, 600);
        });

        const firstTileX = Math.trunc(this.pixelsToTiles(-offsetX));
        const lastTileX = Math.trunc(firstTileX + this.pixelsToTiles(myW) + 1);
        for (let y = 0; y < this.height; y++) {
            for (let x = firstTileX; x <= lastTileX; x++) {
                if (this.tiles[x] && this.tiles[x][y]) {
                    image(
                        this.tiles[x][y],
                        this.tilesToPixels(x) + offsetX,
                        this.tilesToPixels(y) + offsetY
                    );
                }
            }
        }

        // An exploding-on-death player/caveman disappears entirely once
        // dying -- the separate Explosion sprite (in this.sprites) is what
        // plays at their old position instead.
        const playerExploding =
            this.player.explodesOnDeath && this.player.getState() != CreatureState.NORMAL;
        if (!playerExploding) {
            image(
                this.player.getImage(),
                Math.trunc(Math.trunc(position.x) + offsetX),
                Math.trunc(Math.trunc(position.y) + offsetY + this.player.getDrawOffsetY())
            );
        }

        this.sprites.forEach((sprite) => {
            const p = sprite.getPosition();
            const hiddenWhileExploding =
                sprite instanceof Creature &&
                sprite.explodesOnDeath &&
                sprite.getState() != CreatureState.NORMAL;
            if (!hiddenWhileExploding) {
                image(
                    sprite.getImage(),
                    Math.trunc(Math.trunc(p.x) + offsetX),
                    Math.trunc(Math.trunc(p.y) + offsetY + sprite.getDrawOffsetY())
                );
            }
            if (sprite instanceof Creature && p.x + offsetX > 0 && p.x + offsetX < myW) {
                sprite.wakeUp();
            }
        });

        this.projectiles.forEach((projectile) => {
            const p = projectile.getPosition();
            image(
                projectile.getImage(),
                Math.trunc(Math.trunc(p.x) + offsetX),
                Math.trunc(Math.trunc(p.y) + offsetY)
            );
        });

        this.drawEnergyBar();
    }

    // The stamina HUD, top-left corner of the screen (fixed logical
    // coordinates, not affected by the camera offsetX/offsetY used for the
    // world above). While the FireOrb buff is active, the whole bar swaps to
    // the looping energyFramePower art instead of the plain frame + slots.
    drawEnergyBar() {
        if (this.player.hasFireAbility()) {
            const frameImg = this.resources.get(getEnergyFramePowerImageName(this.hudTime));
            image(
                frameImg,
                ENERGY_BAR_X + ENERGY_FRAME_POWER_OFFSET_X,
                ENERGY_BAR_Y + ENERGY_FRAME_POWER_OFFSET_Y
            );
            return;
        }
        image(this.resources.get("energyFrame"), ENERGY_BAR_X, ENERGY_BAR_Y);
        for (let i = 0; i < Player.MAX_ENERGY; i++) {
            const name = getEnergySlotImageName(
                i,
                this.player.energy,
                this.player.energyUsedTimer,
                this.hudTime
            );
            if (name) {
                const unitImg = this.resources.get(name);
                const center = ENERGY_SLOT_CENTERS[i];
                image(
                    unitImg,
                    ENERGY_BAR_X + center.x - unitImg.width / 2,
                    ENERGY_BAR_Y + center.y - unitImg.height / 2
                );
            }
        }
    }

    isCollision(s1: Sprite, s2: Sprite): boolean {
        if (s1 == s2) return false;
        if (s1 instanceof Creature && (s1 as Creature).getState() != CreatureState.NORMAL)
            return false;
        if (s2 instanceof Creature && (s2 as Creature).getState() != CreatureState.NORMAL)
            return false;
        const pos1 = s1.getPosition().copy();
        const pos2 = s2.getPosition().copy();
        pos1.x = Math.round(pos1.x);
        pos1.y = Math.round(pos1.y);
        pos2.x = Math.round(pos2.x);
        pos2.y = Math.round(pos2.y);
        // Use the collision box (same as tile collision/ground-snapping),
        // not the raw image size: Grub/caveman fix their collision height
        // at 64px while their cropped art frames are much shorter and
        // drawn bottom-aligned via drawOffsetY, so getImage().height here
        // would test overlap against a box floating above the creature's
        // actual drawn position instead of the creature itself.
        const val =
            pos1.x < pos2.x + s2.getCollisionWidth() &&
            pos2.x < pos1.x + s1.getCollisionWidth() &&
            pos1.y < pos2.y + s2.getCollisionHeight() &&
            pos2.y < pos1.y + s1.getCollisionHeight();
        return val;
    }

    checkPlayerCollision(p: Player, isFalling: boolean) {
        if (p.getState() != CreatureState.NORMAL) return;
        // Snapshot every sprite currently overlapping the player (not just
        // the first match) so a Creature and a PowerUp that happen to
        // overlap the same spot both resolve correctly and independently -
        // otherwise whichever happened to come first in this.sprites could
        // mask the other (e.g. a stomp-kill silently skipped because a
        // PowerUp underneath was found first).
        const overlapping = this.sprites.filter((s) => this.isCollision(p, s));
        for (const s of overlapping) {
            if (p.getState() != CreatureState.NORMAL) break; // player already died this call
            if (s instanceof Creature) {
                if (p.isDashing()) {
                    // Dash kill: destroys on contact from any direction, no
                    // bounce/reposition -- the player just powers through
                    // and keeps their dash trajectory. Checked before
                    // isFalling: dash() never touches vertical velocity, so
                    // gravity keeps accruing during a mid-air dash and
                    // isFalling can go true a couple of frames in -- without
                    // this ordering that would misfire the stomp branch
                    // (bounce + reposition) on top of an active dash.
                    this.killCreature(s);
                    this.soundManager.playEvent("boop2");
                } else if (isFalling) {
                    // Stomp kill: bounce off the top.
                    const pos = s.getPosition();
                    this.killCreature(s);
                    this.soundManager.playEvent("boop2");
                    p.setPosition(p.getPosition().x, pos.y - p.getImage().height);
                    p.jump(true);
                } else {
                    this.killCreature(p);
                }
            } else if (s instanceof PowerUp) {
                this.acquirePowerUp(s);
            }
        }
    }

    // Transitions a creature to DYING, and if it has a deathEffect (an
    // "Explosion"-type resource name -- "explosion" for player/caveman,
    // "bugjuice" for grub/fly), spawns a standalone copy of it at the
    // creature's current position to play there (see Creature.deathEffect).
    killCreature(c: Creature) {
        const pos = c.getPosition();
        c.setState(CreatureState.DYING);
        if (c.deathEffect) {
            this.spawnEffect(c.deathEffect, pos.x, pos.y);
        }
    }

    // A fireball kill: the target is destroyed instantly, leaving only the
    // fireball's own explosion behind (see updateProjectiles()) -- no
    // lingering body/tumbling animation and no separate deathEffect splat of
    // its own, unlike an ordinary (stomp/dash/bullet) kill via
    // killCreature(). Force-enables the same hide-and-freeze treatment
    // GameMap already gives player/caveman (see Creature.explodesOnDeath) on
    // this one creature regardless of species, so a grub/fly disappears
    // instead of falling and flopping through its own flipped death
    // animation the way it normally would.
    incinerateCreature(c: Creature) {
        c.explodesOnDeath = true;
        c.setState(CreatureState.DYING);
    }

    spawnEffect(resourceName: string, x: number, y: number) {
        const effect = this.resources.get(resourceName).clone();
        effect.setPosition(x, y);
        this.sprites.push(effect);
    }

    removeSprite(s: Sprite) {
        const i = this.sprites.indexOf(s);
        if (i > -1) this.sprites.splice(i, 1);
    }

    acquirePowerUp(p: PowerUp) {
        this.removeSprite(p);
        if (p instanceof FireOrb) {
            this.player.grantFireAbility();
            this.soundManager.playEvent("fireOrbPickup");
        } else if (p instanceof Star) {
            this.soundManager.playEvent("prize");
        } else if (p instanceof Music) {
            this.soundManager.nextSong();
        } else if (p instanceof Heart) {
            this.soundManager.playEvent("heartPickup");
            this.level += 1;
            this.initialize();
        }
    }

    spawnProjectile(direction: number) {
        // Fireball while the FireOrb buff is active, a plain Bullet
        // otherwise (see Player.tryFire() -- firing itself no longer
        // requires the buff at all).
        const resourceName = this.player.hasFireAbility() ? "projectile" : "bullet";
        const p = (this.resources.get(resourceName) as Projectile).clone();
        const playerPos = this.player.getPosition();
        const playerImg = this.player.getImage();
        const projImg = p.getImage();
        const spawnX = direction > 0 ? playerPos.x + playerImg.width : playerPos.x - projImg.width;
        // Level with the gun barrel, not the sprite's vertical center (see
        // Player.GUN_HEIGHT) -- the center sits noticeably lower than where
        // the gun is actually drawn.
        const spawnY = playerPos.y + Player.GUN_HEIGHT - projImg.height / 2;
        p.setPosition(spawnX, spawnY);
        // Scaled off the player's own speed (rather than a hardcoded
        // constant on Projectile) so a shot always reads as clearly
        // faster than the player, even if MAX_SPEED is ever retuned.
        p.SPEED = this.player.getMaxSpeed() * 3;
        p.setVelocity(direction * p.SPEED, 0);
        // A shot's direction never changes mid-flight, so this is set
        // once here rather than reused from Sprite's per-frame
        // setVelocity()-driven switching -- Projectile.setVelocity()
        // deliberately skips that (see its class comment), since it's
        // called every tick just to apply gravity.
        p.setAnimation(direction < 0 ? "left" : "right");
        this.projectiles.push(p);
        this.soundManager.playEvent("fireLaunch");
    }

    updateProjectiles() {
        // Collect removals and splice after the loop instead of mid-iteration
        // (unlike the sprites.forEach cleanup above, which splices in place) -
        // mutating the array being iterated can skip an adjacent element on
        // the same tick.
        const toRemove: Projectile[] = [];
        this.projectiles.forEach((p) => {
            if (p.pendingRemoval) {
                // Already rendered once at its final position (see below) --
                // actually remove it now, without moving it any further.
                toRemove.push(p);
                return;
            }
            this.updateSprite(p);
            // isCollision() already excludes non-NORMAL Creatures, so no need
            // to re-check state here.
            const target = this.sprites.find(
                (s) => s instanceof Creature && this.isCollision(p, s)
            );
            if (target) {
                // A fireball incinerates its target (see
                // incinerateCreature()) -- instant, no body, no deathEffect
                // splat of its own, just the fireball's explosion (spawned
                // below via explodesOnRemoval). A Bullet instead kills
                // through killCreature(), same as a stomp or dash, so the
                // target's own deathEffect (bugjuice for grub/fly, an
                // explosion for player/caveman) still plays.
                if (p.explodesOnRemoval) {
                    this.incinerateCreature(target as Creature);
                } else {
                    this.killCreature(target as Creature);
                }
                this.soundManager.playEvent("fireHit");
            }
            p.update(deltaTime);
            if (target || p.hitSomething || p.isExpired()) {
                if (p.explodesOnRemoval) {
                    // Same "explosion" Explosion-type resource used for
                    // player/caveman death (see killCreature()) -- plays once
                    // in place, no physics, and self-removes from
                    // this.sprites (see update()'s Explosion branch) once its
                    // animation finishes. A plain Bullet skips all of this
                    // (see its class comment) and just disappears.
                    // On a hit, center it on the enemy rather than the
                    // projectile - isCollision() only requires overlap, not
                    // an exact position match, so the two can differ
                    // slightly.
                    let pos: p5.Vector;
                    if (target) {
                        pos = target.getPosition();
                    } else {
                        // Wall hit or fizzled out with no target: center it
                        // on the projectile's own leading tip -- the edge of
                        // its collision box in whichever direction it was
                        // traveling -- rather than its top-left corner. On a
                        // wall hit specifically, updateSprite()'s horizontal
                        // tile-collision snap (above) has already placed
                        // that edge exactly on the wall surface, so this
                        // lands on the actual point of impact, not just
                        // somewhere near the projectile's own footprint.
                        const explosionImg = (
                            this.resources.get("explosion") as Explosion
                        ).getImage();
                        const vel = p.getVelocity();
                        const ppos = p.getPosition();
                        const tipX = vel.x >= 0 ? ppos.x + p.getCollisionWidth() : ppos.x;
                        const tipY = ppos.y + p.getCollisionHeight() / 2;
                        pos = createVector(
                            tipX - explosionImg.width / 2,
                            tipY - explosionImg.height / 2
                        );
                    }
                    this.spawnEffect("explosion", pos.x, pos.y);
                }
                // Deferred one frame (see the pendingRemoval check above)
                // instead of removing it immediately: updateSprite() above
                // already snapped this frame's position exactly onto the
                // wall (or onto the enemy it overlapped), but splicing it
                // out of this.projectiles right now would mean that exact
                // position is never actually drawn -- the last frame ever
                // rendered would be the one before this snap, up to a whole
                // frame's travel short of the wall. That gap was masked for
                // a fireball by its own explosion appearing right at the
                // true contact point, but a Bullet has no such effect to
                // hide it behind, so it visibly vanished short of the wall.
                p.pendingRemoval = true;
            }
        });
        toRemove.forEach((p) => {
            const i = this.projectiles.indexOf(p);
            if (i > -1) this.projectiles.splice(i, 1);
        });
    }

    getTileCollision(s: Sprite, newPos: p5.Vector) {
        const oldPos = s.getPosition();
        const fromX = Math.min(oldPos.x, newPos.x);
        const fromY = Math.min(oldPos.y, newPos.y);
        const toX = Math.max(oldPos.x, newPos.x);
        const toY = Math.max(oldPos.y, newPos.y);
        const fromTileX = this.pixelsToTiles(fromX);
        const fromTileY = this.pixelsToTiles(fromY);
        const toTileX = this.pixelsToTiles(toX + s.getCollisionWidth() - 1);
        const toTileY = this.pixelsToTiles(toY + s.getCollisionHeight() - 1);
        for (let x = fromTileX; x <= toTileX; x++) {
            for (let y = fromTileY; y <= toTileY; y++) {
                if (x < 0 || x >= this.tiles.length || this.tiles[x][y]) {
                    return createVector(x, y);
                }
            }
        }
        return null;
    }

    updateSprite(s: Sprite) {
        // Freeze physics entirely once dying/dead, but only for creatures
        // that explode on death (player, caveman) -- they disappear and an
        // Explosion plays in their place, so they shouldn't keep
        // falling/colliding invisibly in the meantime. Ordinary enemies
        // (grub, fly) are unaffected and keep tumbling through their own
        // death animation exactly as before.
        if (s instanceof Creature && s.explodesOnDeath && s.getState() != CreatureState.NORMAL) {
            return;
        }
        // Clamp the timestep used for this frame's physics (gravity and
        // position integration) to MAX_PHYSICS_DELTA_TIME. deltaTime is
        // real elapsed time and can spike well past a normal frame (e.g. a
        // stutter while GameMap.initialize() builds a freshly loaded level),
        // and every distance here scales directly with it -- an uncapped
        // spike lets a single frame cover far more ground than intended
        // (most noticeably right after a level loads: a dash triggered then
        // travels dramatically farther than the same dash later once frame
        // timing has settled). Real-time counters like Player.dashTimer are
        // deliberately left on the unclamped deltaTime elsewhere -- only the
        // physical distance covered per frame is bounded here.
        const dt = Math.min(deltaTime, MAX_PHYSICS_DELTA_TIME);
        //update velocity due to gravity
        const oldVel = s.getVelocity();
        const newPos = s.getPosition().copy();

        if (!s.isFlying()) {
            oldVel.y = oldVel.y + GRAVITY * dt;
            s.setVelocity(oldVel.x, oldVel.y);
        }

        //update the x part of position first
        newPos.x = newPos.x + oldVel.x * dt;
        //see if there was a collision with a tile at the new location
        let point = this.getTileCollision(s, newPos);
        if (point) {
            if (oldVel.x > 0) {
                //moving to the right
                newPos.x = this.tilesToPixels(point.x) - s.getCollisionWidth();
            } else if (oldVel.x < 0) {
                //moving to the left
                newPos.x = this.tilesToPixels(point.x + 1);
            }
            s.collideHorizontal();
        }
        s.setPosition(newPos.x, newPos.y);

        //now update the y part of the position
        newPos.y = newPos.y + oldVel.y * dt;
        point = this.getTileCollision(s, newPos);
        if (point) {
            if (oldVel.y > 0) {
                newPos.y = this.tilesToPixels(point.y) - s.getCollisionHeight();
            } else if (oldVel.y < 0) {
                newPos.y = this.tilesToPixels(point.y + 1);
            }
            s.collideVertical();
        }
        s.setPosition(newPos.x, newPos.y);
        // Checked once, after both axes are fully resolved for the frame
        // (not once per axis, and not from a same-frame position/velocity
        // delta). Two problems ruled out an axis-order or single-frame-delta
        // check here:
        // 1. Checking right after the horizontal step (with a hardcoded
        //    isFalling=false) tested overlap against the sprite's position
        //    from *before* this frame's vertical movement. If a tall,
        //    correctly-sized creature (see isCollision()/getCollisionHeight())
        //    already vertically overlapped the player from a prior frame --
        //    common during a running jump's shallow diagonal approach --
        //    while horizontal alignment only completed on this frame, that
        //    earlier check fired first and force-classified a genuine
        //    in-progress stomp as "walked into it," killing the player.
        // 2. Even checking once, comparing this single frame's y before/after
        //    isn't reliable either: gravity is added every frame regardless
        //    of onGround, so a player resting motionlessly still nudges down
        //    a fraction of a pixel before the next frame's tile collision
        //    snaps it back -- the same one-frame ground flicker documented on
        //    Player.airborneStreak. Reusing that already-debounced signal
        //    (instead of re-deriving falling state from a single frame's
        //    motion) avoids misreading a stationary side-bump as a stomp on
        //    whichever frame happens to catch that flicker.
        // airborneStreak alone only says "not freshly grounded" -- it stays
        // true for the whole jump arc, ascending included. Without also
        // requiring oldVel.y > 0 (still moving downward this frame, after
        // gravity/collideVertical()), jumping up into the underside of an
        // enemy was being treated as a stomp: it bounced the player and
        // killed the enemy exactly as if landing on top of it.
        if (s instanceof Player) {
            const player = s as Player;
            this.checkPlayerCollision(
                player,
                player.airborneStreak >= Player.AIRBORNE_ANIM_MIN_STREAK && oldVel.y > 0
            );
        }
    }

    update() {
        this.hudTime += deltaTime;
        if (this.player.getState() == CreatureState.DEAD) {
            this.initialize(); //start the level over
            return;
        }
        this.updateSprite(this.player); //moves sprite within the game
        if (this.player.getPosition().y > this.tilesToPixels(this.height)) {
            //fell out of the level; player is already off-screen, so skip DYING and reset immediately
            this.initialize();
            return;
        }
        this.player.update(deltaTime); //updates the animation of the sprite

        this.sprites.forEach((sprite, index, obj) => {
            if (sprite instanceof Creature) {
                if (sprite.getState() == CreatureState.DEAD) {
                    //remove the sprite
                    obj.splice(index, 1);
                } else {
                    this.updateSprite(sprite);
                    sprite.update(deltaTime);
                }
            } else if (sprite instanceof PowerUp) {
                sprite.update(deltaTime);
            } else if (sprite instanceof Explosion) {
                sprite.update(deltaTime);
                if (sprite.isFinished()) {
                    obj.splice(index, 1);
                }
            }
        });

        this.updateProjectiles();
    }
}
