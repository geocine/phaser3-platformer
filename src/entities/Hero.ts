import Phaser from 'phaser';
import StateMachine from 'javascript-state-machine';

class Hero extends Phaser.GameObjects.Sprite {
  body!: Phaser.Physics.Arcade.Body;
  private animState!: any;
  private animPredicates!: Record<string, () => boolean>;
  private moveState!: any;
  private movePredicates!: Record<string, () => boolean>;
  private controlState: {
    didPressJump?: boolean;
    jumpBufferedUntil?: number;
    lastOnFloorTime?: number;
  } = {};
  private keys: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey?: Phaser.Input.Keyboard.Key;

  private readonly jumpBufferMs = 200;
  private readonly coyoteTimeMs = 120;
  private readonly flipGraceMs = 650;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    keys: Phaser.Types.Input.Keyboard.CursorKeys,
    jumpKey?: Phaser.Input.Keyboard.Key
  ) {
    super(scene, x, y, 'sprite/hero/run');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.anims.play('hero/running');

    this.setOrigin(0.5, 1);
    this.body.setCollideWorldBounds(true);
    this.body.setSize(12, 40);
    this.body.setOffset(12, 23);
    this.body.setMaxVelocity(250, 400);
    this.body.setDragX(750);
    this.controlState = {};
    this.keys = keys;
    this.jumpKey = jumpKey;

    this.setupAnimation();
    this.setupMovement();
  }

  setupAnimation() {
    this.animState = new StateMachine({
      init: 'idle',
      transitions: [
        {
          name: 'idle',
          from: ['falling', 'running', 'pivoting'],
          to: 'idle'
        },
        {
          name: 'run',
          from: ['falling', 'idle', 'pivoting'],
          to: 'running'
        },
        {
          name: 'pivot',
          from: ['falling', 'running'],
          to: 'pivoting'
        },
        {
          name: 'jump',
          from: ['idle', 'running', 'pivoting'],
          to: 'jumping'
        },
        {
          name: 'flip',
          from: ['jumping', 'falling'],
          to: 'flipping'
        },
        {
          name: 'fall',
          from: ['idle', 'running', 'pivoting', 'jumping', 'flipping'],
          to: 'falling'
        },
        {
          name: 'die',
          from: '*',
          to: 'dead'
        }
      ],
      methods: {
        onEnterState: lifecycle => {
          this.anims.play(`hero/${lifecycle.to}`);
          // console.log(lifecycle, this.body.velocity.y);
        }
      }
    });

    this.animPredicates = {
      idle: () => {
        return this.body.onFloor() && this.body.velocity.x === 0;
      },
      run: () => {
        return (
          this.body.onFloor() &&
          Math.sign(this.body.velocity.x) === (this.flipX ? -1 : 1)
        );
      },
      pivot: () => {
        return (
          this.body.onFloor() &&
          Math.sign(this.body.velocity.x) === (this.flipX ? 1 : -1)
        );
      },
      jump: () => {
        return this.body.velocity.y < 0;
      },
      flip: () => {
        return this.body.velocity.y < 0 && this.moveState.is('flipping');
      },
      fall: () => {
        return this.body.velocity.y > 0;
      }
    };
  }

  setupMovement() {
    this.moveState = new StateMachine({
      init: 'standing',
      transitions: [
        {
          name: 'jump',
          from: ['standing', 'falling'],
          to: 'jumping'
        },
        {
          name: 'flip',
          from: ['jumping', 'falling'],
          to: 'flipping'
        },
        {
          name: 'fall',
          from: ['standing', 'jumping', 'flipping'],
          to: 'falling'
        },
        {
          name: 'touchdown',
          from: ['jumping', 'flipping', 'falling'],
          to: 'standing'
        },
        {
          name: 'die',
          from: ['jumping', 'flipping', 'falling', 'standing'],
          to: 'dead'
        }
      ],
      methods: {
        onJump: () => {
          this.body.setVelocityY(-400);
        },
        onFlip: () => {
          this.body.setVelocityY(-300);
        },
        onDie: () => {
          this.body.setVelocity(0, -500);
          this.body.setAcceleration(0);
        }
      }
    });

    this.movePredicates = {
      jump: () => {
        const now = this.scene.time.now;
        const buffered = (this.controlState.jumpBufferedUntil ?? 0) > now;
        if (!buffered) return false;

        const lastOnFloor = this.controlState.lastOnFloorTime ?? -Infinity;
        const withinCoyote = now - lastOnFloor <= this.coyoteTimeMs;

        return this.body.onFloor() || withinCoyote;
      },
      flip: () => {
        // Allow the mid-air flip while rising, or shortly after takeoff (grace window).
        const now = this.scene.time.now;
        const lastOnFloor = this.controlState.lastOnFloorTime ?? -Infinity;
        const withinGrace = now - lastOnFloor <= this.flipGraceMs;

        return (
          this.controlState.didPressJump &&
          !this.body.onFloor() &&
          (this.body.velocity.y < 0 || withinGrace)
        );
      },
      fall: () => {
        // Transition out of jump once we start descending.
        return !this.body.onFloor() && this.body.velocity.y > 0;
      },
      touchdown: () => {
        return this.body.onFloor();
      }
    };
  }

  kill() {
    if (this.moveState.can('die')) {
      this.moveState.die();
      this.animState.die();
      this.emit('died');
    }
  }

  isDead() {
    return this.moveState.is('dead');
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);

    if (!this.isDead() && this.body.onFloor()) {
      this.controlState.lastOnFloorTime = this.scene.time.now;
    }

    const didJustPressJump =
      Phaser.Input.Keyboard.JustDown(this.keys.up) ||
      (this.jumpKey ? Phaser.Input.Keyboard.JustDown(this.jumpKey) : false);

    if (!this.isDead() && didJustPressJump) {
      this.controlState.jumpBufferedUntil =
        this.scene.time.now + this.jumpBufferMs;
    }

    this.controlState.didPressJump =
      !this.isDead() &&
      (this.controlState.jumpBufferedUntil ?? 0) > this.scene.time.now;

    if (!this.isDead() && this.keys.left.isDown) {
      this.body.setAccelerationX(-1000);
      this.setFlipX(true);
      this.body.offset.x = 8;
    } else if (!this.isDead() && this.keys.right.isDown) {
      this.body.setAccelerationX(1000);
      this.setFlipX(false);
      this.body.offset.x = 12;
    } else {
      this.body.setAccelerationX(0);
    }

    if (this.moveState.is('jumping') || this.moveState.is('flipping')) {
      const jumpIsDown =
        this.keys.up.isDown || (this.jumpKey ? this.jumpKey.isDown : false);

      if (!jumpIsDown && this.body.velocity.y < -150) {
        this.body.setVelocityY(-150);
      }
    }

    for (const transition of this.moveState.transitions()) {
      if (
        transition in this.movePredicates &&
        this.movePredicates[transition]()
      ) {
        this.moveState[transition]();

        if (transition === 'jump' || transition === 'flip') {
          this.controlState.jumpBufferedUntil = 0;
        }

        break;
      }
    }

    for (const transition of this.animState.transitions()) {
      if (
        transition in this.animPredicates &&
        this.animPredicates[transition]()
      ) {
        this.animState[transition]();
        break;
      }
    }
  }
}

export default Hero;
