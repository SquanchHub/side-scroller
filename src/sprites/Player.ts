import { Creature } from "./Creature.js";

export class Player extends Creature {
    MAX_SPEED: number;
    JUMP_SPEED: number;
    onGround: boolean;
    DASH_SPEED: number;
    DASH_DURATION: number;
    DASH_COOLDOWN: number;
    dashTimer: number; // ms remaining in the active dash burst, 0 = not dashing
    dashCooldownTimer: number; // ms remaining before another dash is allowed
    facing: number; // +1 (right) or -1 (left), last nonzero horizontal direction
    FIRE_ABILITY_DURATION: number;
    FIRE_COOLDOWN: number;
    fireAbilityTimer: number; // ms remaining of the FireOrb buff, 0 = can't fire
    fireCooldownTimer: number; // ms remaining before the next shot is allowed

    constructor() {
        super();
        this.MAX_SPEED = 0.5;
        this.JUMP_SPEED = 0.95;
        this.onGround = false;
        this.DASH_SPEED = 1.2;
        this.DASH_DURATION = 150;
        this.DASH_COOLDOWN = 600;
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;
        this.facing = 1;
        this.FIRE_ABILITY_DURATION = 10000;
        this.FIRE_COOLDOWN = 300;
        this.fireAbilityTimer = 0;
        this.fireCooldownTimer = 0;
    }

    getMaxSpeed() {
        return this.MAX_SPEED;
    }

    collideVertical() {
        if (this.velocity.y > 0) {
            this.onGround = true;
        }
        this.velocity.y = 0;
    }

    collideHorizontal() {
        this.dashTimer = 0; // cancel the dash rather than let processActions() re-assert it into the wall
        this.velocity.x = 0;
    }

    jump(forceJump: boolean) {
        if (this.onGround || forceJump) {
            this.onGround = false;
            this.setVelocity(0, -this.JUMP_SPEED);
        }
    }

    dash() {
        if (this.dashCooldownTimer <= 0) {
            this.dashTimer = this.DASH_DURATION;
            this.dashCooldownTimer = this.DASH_COOLDOWN;
        }
    }

    isDashing(): boolean {
        return this.dashTimer > 0;
    }

    getDashVelocityX(): number {
        return this.facing * this.DASH_SPEED;
    }

    grantFireAbility() {
        this.fireAbilityTimer = this.FIRE_ABILITY_DURATION;
    }

    hasFireAbility(): boolean {
        return this.fireAbilityTimer > 0;
    }

    tryFire(): boolean {
        if (this.hasFireAbility() && this.fireCooldownTimer <= 0) {
            this.fireCooldownTimer = this.FIRE_COOLDOWN;
            return true;
        }
        return false;
    }

    setVelocity(x: number, y: number) {
        if (x > 0) {
            this.facing = 1;
        } else if (x < 0) {
            this.facing = -1;
        }
        super.setVelocity(x, y);
    }

    update(deltaTime: number) {
        super.update(deltaTime);
        if (this.dashTimer > 0) {
            this.dashTimer = Math.max(0, this.dashTimer - deltaTime);
        }
        if (this.dashCooldownTimer > 0) {
            this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - deltaTime);
        }
        if (this.fireAbilityTimer > 0) {
            this.fireAbilityTimer = Math.max(0, this.fireAbilityTimer - deltaTime);
        }
        if (this.fireCooldownTimer > 0) {
            this.fireCooldownTimer = Math.max(0, this.fireCooldownTimer - deltaTime);
        }
    }

    setPosition(x: number, y: number) {
        //check if falling
        if (Math.round(y) > Math.round(this.position.y)) {
            this.onGround = false;
        }
        super.setPosition(x, y);
    }

    addVelocity(x: number, y: number) {
        this.velocity.add(x, y);
        if (this.velocity.x > this.MAX_SPEED) {
            this.velocity.x = this.MAX_SPEED;
        } else if (this.velocity.x <= -this.MAX_SPEED) {
            this.velocity.x = -this.MAX_SPEED;
        }
        if (this.velocity.y > this.MAX_SPEED) {
            this.velocity.y = this.MAX_SPEED;
        } else if (this.velocity.y < -this.MAX_SPEED) {
            this.velocity.y = -this.MAX_SPEED;
        }
        if (this.velocity.x > 0 && this.currAnimName != "right") {
            this.setAnimation("right");
        }
        if (this.velocity.x < 0 && this.currAnimName != "left") {
            this.setAnimation("left");
        }
    }

    clone() {
        const p = new Player();
        p.position = this.position.copy();
        p.velocity = this.velocity.copy();
        p.animations = {}; //throw away the animations from the new constructor call
        //and copy over the animations from this
        for (const key in this.animations) {
            if (Object.prototype.hasOwnProperty.call(this.animations, key)) {
                const element = this.animations[key];
                p.animations[key] = element.clone();
            }
        }
        p.currAnimName = this.currAnimName;
        p.currAnimation = p.animations[p.currAnimName];
        p.MAX_SPEED = this.MAX_SPEED;
        return p;
    }
}
