import Phaser from 'phaser';
import Hero from '../entities/Hero';

const level1TilemapUrl = new URL('../../assets/tilemaps/level-1.json', import.meta.url).href;
const level2TilemapUrl = new URL('../../assets/tilemaps/level-2.json', import.meta.url).href;
const keySpriteUrl = new URL('../../assets/key.png', import.meta.url).href;
const exitDoorSpriteUrl = new URL('../../assets/exit-door.png', import.meta.url).href;
const SHOW_LEVEL_DEBUG = false;
const levelGoalFallbacks = {
  'level-1': {
    exit: { x: 880, y: 416 },
    key: { x: 720, y: 416 }
  },
  'level-2': {
    exit: { x: 1952, y: 385 },
    key: { x: 1408, y: 256 }
  }
} as const;

class Game extends Phaser.Scene {
  private readonly cameraLookAheadX = 52;
  private readonly cameraLookUpY = 40;
  private readonly cameraLookDownY = 72;
  private readonly cameraFallLookAheadY = 34;
  private readonly cameraLookAheadLerp = 0.1;

  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey!: Phaser.Input.Keyboard.Key;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private sprintKey!: Phaser.Input.Keyboard.Key;
  private debugToggleKey!: Phaser.Input.Keyboard.Key;

  private hero!: Hero;
  private map!: Phaser.Tilemaps.Tilemap;
  private spikeGroup!: Phaser.Physics.Arcade.Group;
  private spawnPos = { x: 0, y: 0 };

  private currentLevelKey: 'level-1' | 'level-2' = 'level-1';
  private hasKey = false;

  private keyPos?: { x: number; y: number };
  private exitPos?: { x: number; y: number };

  private keyMarker?: Phaser.GameObjects.Container;
  private keyZone?: Phaser.GameObjects.Zone;
  private exitDoor?: Phaser.GameObjects.Container;
  private exitZone?: Phaser.GameObjects.Zone;
  private exitParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private exitGlowFx?: Phaser.FX.Glow;
  private exitAuraOuter?: Phaser.GameObjects.Image;
  private exitAuraInner?: Phaser.GameObjects.Image;
  private exitFloorGlow?: Phaser.GameObjects.Image;

  private hudText?: Phaser.GameObjects.Text;
  private deathText?: Phaser.GameObjects.Text;
  private debugText?: Phaser.GameObjects.Text;
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private goalFallbacksUsed: string[] = [];

  private groundCollider?: Phaser.Physics.Arcade.Collider;
  private spikesCollider?: Phaser.Physics.Arcade.Collider;

  private showLevelDebug = SHOW_LEVEL_DEBUG;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Let Vite fingerprint the tilemaps so dev and build use the same authored files.
    this.load.tilemapTiledJSON('level-1', level1TilemapUrl);
    this.load.tilemapTiledJSON('level-2', level2TilemapUrl);

    this.load.image('goal/door', exitDoorSpriteUrl);
    this.load.image('pickup/key', keySpriteUrl);

    this.load.spritesheet('world-1-sheet', 'assets/tilesets/world-1.png', {
      frameWidth: 32,
      frameHeight: 32,
      margin: 1,
      spacing: 2
    });
    this.load.image('clouds-sheet', 'assets/tilesets/clouds.png');

    this.load.spritesheet('sprite/hero/run', 'assets/hero/run.png', {
      frameWidth: 32,
      frameHeight: 64
    });
    this.load.spritesheet('sprite/hero/idle', 'assets/hero/idle.png', {
      frameWidth: 32,
      frameHeight: 64
    });
    this.load.spritesheet('sprite/hero/pivot', 'assets/hero/pivot.png', {
      frameWidth: 32,
      frameHeight: 64
    });
    this.load.spritesheet('sprite/hero/jump', 'assets/hero/jump.png', {
      frameWidth: 32,
      frameHeight: 64
    });
    this.load.spritesheet('sprite/hero/flip', 'assets/hero/spinjump.png', {
      frameWidth: 32,
      frameHeight: 64
    });
    this.load.spritesheet('sprite/hero/fall', 'assets/hero/fall.png', {
      frameWidth: 32,
      frameHeight: 64
    });
    this.load.spritesheet('sprite/hero/die', 'assets/hero/bonk.png', {
      frameWidth: 32,
      frameHeight: 64
    });
  }

  create(data) {
    // level selection (defaults to level-1)
    this.currentLevelKey = (data?.levelKey as any) || 'level-1';
    this.hasKey = false;

    this.cursorKeys = this.input.keyboard.createCursorKeys();
    this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.restartKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.R
    );
    this.sprintKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT
    );
    this.debugToggleKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.F3
    );

    this.showLevelDebug = SHOW_LEVEL_DEBUG || this.readInitialDebugFlag();

    this.addHud();
    this.ensureGoalEffectTextures();

    this.anims.create({
      key: 'hero/idle',
      frames: this.anims.generateFrameNumbers('sprite/hero/idle'),
      frameRate: 10,
      repeat: -1
    });
    this.anims.create({
      key: 'hero/running',
      frames: this.anims.generateFrameNumbers('sprite/hero/run'),
      frameRate: 10,
      repeat: -1
    });
    this.anims.create({
      key: 'hero/pivoting',
      frames: this.anims.generateFrameNumbers('sprite/hero/pivot'),
      frameRate: 10,
      repeat: -1
    });
    this.anims.create({
      key: 'hero/jumping',
      frames: this.anims.generateFrameNumbers('sprite/hero/jump'),
      frameRate: 10,
      repeat: -1
    });
    this.anims.create({
      key: 'hero/flipping',
      frames: this.anims.generateFrameNumbers('sprite/hero/flip'),
      frameRate:  30,
      repeat: 0
    });
    this.anims.create({
      key: 'hero/falling',
      frames: this.anims.generateFrameNumbers('sprite/hero/fall'),
      frameRate: 10,
      repeat: -1
    });
    this.anims.create({
      key: 'hero/dead',
      frames: this.anims.generateFrameNumbers('sprite/hero/die'),
      frameRate: 10,
      repeat: 0
    });

    this.addMap();

    this.restartHero();
  }

  private readInitialDebugFlag() {
    try {
      if (typeof window === 'undefined') {
        return false;
      }

      return new URLSearchParams(window.location.search).has('debug');
    } catch {
      return false;
    }
  }

  private setDebugMode(enabled: boolean) {
    this.showLevelDebug = enabled;

    if (!enabled) {
      this.debugText?.destroy();
      this.debugText = undefined;

      this.debugGraphics?.destroy();
      this.debugGraphics = undefined;
      return;
    }

    if (!this.debugText) {
      this.debugText = this.add
        .text(10, 50, '', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#aaffaa'
        })
        .setScrollFactor(0)
        .setDepth(2000)
        .setAlpha(0.9);
    }

    if (!this.debugGraphics) {
      this.debugGraphics = this.add.graphics().setDepth(1999);
    }

    this.redrawGoalDebugBounds();
  }

  private restartHero() {
    this.groundCollider?.destroy();
    this.groundCollider = undefined;

    this.spikesCollider?.destroy();
    this.spikesCollider = undefined;

    this.deathText?.setVisible(false);

    if (this.hero) {
      this.hero.destroy();
    }

    // reset transient objects
    this.keyMarker?.destroy();
    this.keyMarker = undefined;

    this.keyZone?.destroy();
    this.keyZone = undefined;

    if (this.exitGlowFx) {
      this.tweens.killTweensOf(this.exitGlowFx);
      this.exitGlowFx = undefined;
    }

    if (this.exitAuraOuter) {
      this.tweens.killTweensOf(this.exitAuraOuter);
      this.exitAuraOuter = undefined;
    }

    if (this.exitAuraInner) {
      this.tweens.killTweensOf(this.exitAuraInner);
      this.exitAuraInner = undefined;
    }

    if (this.exitFloorGlow) {
      this.tweens.killTweensOf(this.exitFloorGlow);
      this.exitFloorGlow = undefined;
    }

    if (this.exitParticles) {
      this.exitParticles.stop(true);
      this.exitParticles.destroy();
      this.exitParticles = undefined;
    }

    this.tweens.killTweensOf(this.exitDoor);
    this.exitDoor?.destroy();
    this.exitDoor = undefined;

    this.exitZone?.destroy();
    this.exitZone = undefined;

    this.debugGraphics?.clear();
    this.hasKey = false;

    this.addHero();
  }

  private ensureGoalEffectTextures() {
    if (!this.textures.exists('goal/glow')) {
      const glowTexture = this.make.graphics({ x: 0, y: 0, add: false });
      glowTexture.fillStyle(0xffffff, 0.1);
      glowTexture.fillCircle(24, 24, 22);
      glowTexture.fillStyle(0xffffff, 0.2);
      glowTexture.fillCircle(24, 24, 16);
      glowTexture.fillStyle(0xffffff, 0.55);
      glowTexture.fillCircle(24, 24, 9);
      glowTexture.generateTexture('goal/glow', 48, 48);
      glowTexture.destroy();
    }

    if (!this.textures.exists('goal/spark')) {
      const sparkTexture = this.make.graphics({ x: 0, y: 0, add: false });
      sparkTexture.fillStyle(0xffffff, 0.14);
      sparkTexture.fillCircle(12, 12, 10);
      sparkTexture.fillStyle(0xffffff, 0.8);
      sparkTexture.fillCircle(12, 12, 4);
      sparkTexture.generateTexture('goal/spark', 24, 24);
      sparkTexture.destroy();
    }
  }

  private addHud() {
    // Minimal controls hint (camera-fixed).
    this.hudText = this.add
      .text(
        10,
        10,
        '←/→ move  ↑/Space jump  Shift sprint  R restart  F3 debug',
        {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffffff'
        }
      )
      .setScrollFactor(0)
      .setDepth(1000)
      .setAlpha(0.8);

    this.deathText = this.add
      .text(10, 30, 'You died — press R or Space to restart', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffdddd'
      })
      .setScrollFactor(0)
      .setDepth(1000)
      .setAlpha(0.95)
      .setVisible(false);

    this.setDebugMode(this.showLevelDebug);
  }

  private addHero() {
    this.hero = new Hero(
      this,
      this.spawnPos.x,
      this.spawnPos.y,
      this.cursorKeys,
      this.jumpKey,
      this.sprintKey
    );

    this.cameras.main.setBounds(
      0,
      0,
      this.map.widthInPixels,
      this.map.heightInPixels
    );
    this.cameras.main.startFollow(this.hero);
    this.cameras.main.followOffset.set(0, 0);

    this.children.moveTo(
      this.hero,
      this.children.getIndex(this.map.getLayer('Foreground').tilemapLayer)
    );

    this.groundCollider = this.physics.add.collider(
      this.hero,
      this.map.getLayer('Ground').tilemapLayer
    );

    this.spikesCollider = this.physics.add.overlap(
      this.hero,
      this.spikeGroup,
      () => {
        if (this.hero.isSpawnProtected()) {
          return;
        }

        this.hero.kill();
      }
    );

    this.setupLevelGoals();

    this.hero.on('died', () => {
      this.groundCollider?.destroy();
      this.groundCollider = undefined;

      this.spikesCollider?.destroy();
      this.spikesCollider = undefined;

      this.deathText?.setVisible(true);

      this.hero.body.setCollideWorldBounds(false);
    });
  }

  private addMap() {
    this.keyPos = undefined;
    this.exitPos = undefined;
    this.goalFallbacksUsed = [];

    this.map = this.make.tilemap({ key: this.currentLevelKey });
    const groundTiles = this.map.addTilesetImage('world-1', 'world-1-sheet');
    const backgroundTiles = this.map.addTilesetImage('clouds', 'clouds-sheet');

    const backgroundLayer = this.map.createLayer('Background', backgroundTiles);
    backgroundLayer.setScrollFactor(0.6);

    const groundLayer = this.map.createLayer('Ground', groundTiles);
    groundLayer.setCollision([1, 2, 4], true);

    this.physics.world.setBounds(
      0,
      0,
      this.map.widthInPixels,
      this.map.heightInPixels
    );
    this.physics.world.setBoundsCollision(true, true, false, true);

    this.spikeGroup = this.physics.add.group({
      immovable: true,
      allowGravity: false
    });

    this.map.getObjectLayer('Objects').objects.forEach(obj => {
      if (obj.name === 'Start') {
        this.spawnPos = { x: obj.x, y: obj.y };
      }

      if (obj.name === 'Key') {
        this.keyPos = { x: obj.x, y: obj.y };
      }

      if (obj.name === 'Exit') {
        this.exitPos = { x: obj.x, y: obj.y };
      }

      // Spike
      if (obj.gid === 7) {
        const spike = this.spikeGroup.create(
          obj.x,
          obj.y,
          'world-1-sheet',
          obj.gid - 1
        );
        spike.setOrigin(0, 1);
        spike.setSize(obj.width - 10, obj.height - 10);
        spike.setOffset(5, 10);
      }
    });

    const fallback = levelGoalFallbacks[this.currentLevelKey];

    if (!this.exitPos) {
      this.exitPos = { ...fallback.exit };
      this.goalFallbacksUsed.push('exit');
      if (this.showLevelDebug) {
        console.warn(
          `[GameScene] Missing Exit object in ${this.currentLevelKey}; using fallback at ${fallback.exit.x},${fallback.exit.y}.`
        );
      }
    }

    if (!this.keyPos) {
      this.keyPos = { ...fallback.key };
      this.goalFallbacksUsed.push('key');
      if (this.showLevelDebug) {
        console.warn(
          `[GameScene] Missing Key object in ${this.currentLevelKey}; using fallback at ${fallback.key.x},${fallback.key.y}.`
        );
      }
    }

    this.map.createLayer('Foreground', groundTiles);
    // const debugGraphics = this.add.graphics();
    // groundLayer.renderDebug(debugGraphics);
  }

  private setupLevelGoals() {
    const exitStartsUnlocked = !this.keyPos || this.hasKey;

    // Key pickup (optional per level)
    if (this.keyPos && !this.hasKey) {
      // Use the native 16x16 sprite so its pixel density matches the rest of the art.
      const icon = this.add
        .image(0, 0, 'pickup/key')
        .setOrigin(0.5, 1);

      this.keyMarker = this.add
        .container(this.keyPos.x, this.keyPos.y, [icon])
        .setDepth(2000);

      this.tweens.add({
        targets: this.keyMarker,
        y: this.keyPos.y - 8,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });

      this.keyZone = this.add
        .zone(this.keyPos.x, this.keyPos.y + 2, 28, 40)
        .setOrigin(0.5, 1);
      this.physics.add.existing(this.keyZone, true);

      this.physics.add.overlap(this.hero, this.keyZone, () => {
        if (this.hasKey) return;
        this.hasKey = true;

        this.keyMarker?.destroy();
        this.keyMarker = undefined;

        this.keyZone?.destroy();
        this.keyZone = undefined;

        this.setExitUnlocked(true, true);
        this.redrawGoalDebugBounds();
        this.cameras.main.flash(120, 255, 255, 200);
      });
    }

    // Exit (optional per level)
    if (this.exitPos) {
      const floorGlow = this.add
        .image(0, -6, 'goal/glow')
        .setOrigin(0.5, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0x48ebd3)
        .setAlpha(0.2)
        .setScale(1.15, 0.35);

      const auraOuter = this.add
        .image(0, -36, 'goal/glow')
        .setOrigin(0.5, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0x56f0d9)
        .setAlpha(0.28)
        .setScale(1.65, 2.95);

      const auraInner = this.add
        .image(0, -34, 'goal/glow')
        .setOrigin(0.5, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffe68a)
        .setAlpha(0.18)
        .setScale(1.15, 2.25);

      const doorSprite = this.add
        .image(0, 0, 'goal/door')
        .setOrigin(0.5, 1)
        .setFlipX(true);

      if (this.game.renderer.type === Phaser.WEBGL && doorSprite.preFX) {
        this.exitGlowFx = doorSprite.preFX.addGlow(0x6af6d6, 5, 0, false, 0.08, 12);

        this.tweens.add({
          targets: this.exitGlowFx,
          outerStrength: { from: 3.5, to: 6.75 },
          duration: 920,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut'
        });
      }

      this.exitDoor = this.add
        .container(this.exitPos.x, this.exitPos.y, [
          floorGlow,
          auraOuter,
          auraInner,
          doorSprite
        ])
        .setDepth(1500)
        .setVisible(exitStartsUnlocked);

      this.exitAuraOuter = auraOuter;
      this.exitAuraInner = auraInner;
      this.exitFloorGlow = floorGlow;

      this.tweens.add({
        targets: auraOuter,
        alpha: { from: 0.2, to: 0.38 },
        scaleX: { from: 1.55, to: 1.9 },
        scaleY: { from: 2.75, to: 3.2 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });

      this.tweens.add({
        targets: auraInner,
        alpha: { from: 0.14, to: 0.28 },
        scaleX: { from: 1.05, to: 1.25 },
        scaleY: { from: 2.05, to: 2.4 },
        duration: 760,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });

      this.tweens.add({
        targets: floorGlow,
        alpha: { from: 0.14, to: 0.3 },
        scaleX: { from: 1.05, to: 1.32 },
        scaleY: { from: 0.28, to: 0.38 },
        duration: 920,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });

      this.exitParticles = this.add
        .particles(this.exitPos.x, this.exitPos.y, 'goal/spark', {
          x: { min: -14, max: 14 },
          y: { min: -58, max: -10 },
          speedX: { min: -10, max: 10 },
          speedY: { min: -34, max: -8 },
          scale: { start: 0.22, end: 0 },
          alpha: { start: 0.85, end: 0 },
          lifespan: { min: 650, max: 1350 },
          frequency: 90,
          quantity: 2,
          gravityY: -6,
          tint: [0x59f2d7, 0xffeb93, 0xffffff],
          blendMode: Phaser.BlendModes.ADD,
          emitting: false
        })
        .setDepth(1490)
        .setVisible(false);

      this.exitZone = this.add
        .zone(this.exitPos.x, this.exitPos.y, 64, 96)
        .setOrigin(0.5, 1);

      this.physics.add.existing(this.exitZone, true);

      this.physics.add.overlap(this.hero, this.exitZone, () => {
        if (!this.hasKey && this.keyPos) {
          // Only lock if the level actually has a key.
          this.cameras.main.shake(80, 0.004);
          return;
        }

        this.goToNextLevel();
      });

      this.setExitUnlocked(exitStartsUnlocked);
    }

    this.redrawGoalDebugBounds();
  }

  private setExitUnlocked(isUnlocked: boolean, burst = false) {
    if (this.exitDoor) {
      this.exitDoor.setVisible(isUnlocked);
      this.exitDoor.setAlpha(isUnlocked ? 1 : 0);

      if (isUnlocked && burst) {
        this.exitDoor.setScale(0.92);
        this.tweens.add({
          targets: this.exitDoor,
          alpha: { from: 0.45, to: 1 },
          scaleX: { from: 0.92, to: 1 },
          scaleY: { from: 0.92, to: 1 },
          duration: 220,
          ease: 'Quad.out'
        });
      } else {
        this.exitDoor.setScale(1);
      }
    }

    const exitBody = this.exitZone?.body as
      | Phaser.Physics.Arcade.StaticBody
      | undefined;

    if (exitBody) {
      exitBody.enable = isUnlocked;
    }

    if (this.exitParticles) {
      this.exitParticles.setVisible(isUnlocked);

      if (isUnlocked) {
        this.exitParticles.start();

        if (burst) {
          this.exitParticles.emitParticle(24);
        }
      } else {
        this.exitParticles.stop(true);
      }
    }
  }

  private redrawGoalDebugBounds() {
    if (!this.showLevelDebug) {
      return;
    }

    this.debugGraphics?.clear();

    if (this.keyPos && !this.hasKey) {
      this.debugGraphics?.lineStyle(2, 0xffff00, 1);
      this.debugGraphics?.strokeRect(
        this.keyPos.x - 14,
        (this.keyPos.y + 2) - 40,
        28,
        40
      );
    }

    if (this.exitPos && (!this.keyPos || this.hasKey)) {
      this.debugGraphics?.lineStyle(2, 0x00ff00, 1);
      this.debugGraphics?.strokeRect(
        this.exitPos.x - 32,
        this.exitPos.y - 96,
        64,
        96
      );
    }
  }

  private goToNextLevel() {
    // Simple progression for now.
    const next: 'level-1' | 'level-2' =
      this.currentLevelKey === 'level-1' ? 'level-2' : 'level-1';

    this.scene.start('GameScene', { levelKey: next });
  }

  private updateCameraLookAhead() {
    const camera = this.cameras.main;
    const heroBody = this.hero.body;
    const halfWidth = camera.width * 0.5;
    const halfHeight = camera.height * 0.5;

    const leftRoom = Math.max(this.hero.x - halfWidth, 0);
    const rightRoom = Math.max(this.map.widthInPixels - (this.hero.x + halfWidth), 0);
    const topRoom = Math.max(this.hero.y - halfHeight, 0);
    const bottomRoom = Math.max(this.map.heightInPixels - (this.hero.y + halfHeight), 0);

    const horizontalLookAhead = this.hero.isDead()
      ? 0
      : Phaser.Math.Clamp(
          (heroBody.velocity.x / 280) * this.cameraLookAheadX,
          -this.cameraLookAheadX,
          this.cameraLookAheadX
        );
    const fallingLookAhead = this.hero.isDead()
      ? 0
      : Phaser.Math.Clamp(
          Phaser.Math.Clamp(heroBody.velocity.y, 0, 520) / 520 * this.cameraFallLookAheadY,
          0,
          this.cameraFallLookAheadY
        );
    const manualVerticalLookAhead = this.hero.isDead()
      ? 0
      : this.cursorKeys.down.isDown
        ? this.cameraLookDownY
        : this.cursorKeys.up.isDown
          ? -this.cameraLookUpY
          : 0;

    const targetOffsetX = Phaser.Math.Clamp(horizontalLookAhead, -leftRoom, rightRoom);
    const targetOffsetY = Phaser.Math.Clamp(
      fallingLookAhead + manualVerticalLookAhead,
      -topRoom,
      bottomRoom
    );

    camera.followOffset.x = Phaser.Math.Linear(
      camera.followOffset.x,
      targetOffsetX,
      this.cameraLookAheadLerp
    );
    camera.followOffset.y = Phaser.Math.Linear(
      camera.followOffset.y,
      targetOffsetY,
      this.cameraLookAheadLerp
    );
  }

  update(time, delta) {
    const cameraBottom = this.cameras.main.getWorldPoint(
      0,
      this.cameras.main.height
    ).y;

    if (Phaser.Input.Keyboard.JustDown(this.debugToggleKey)) {
      this.setDebugMode(!this.showLevelDebug);
    }

    if (this.showLevelDebug) {
      this.debugText?.setText(
        [
          `level=${this.currentLevelKey} hasKey=${this.hasKey}`,
          `keyPos=${this.keyPos ? `${Math.round(this.keyPos.x)},${Math.round(this.keyPos.y)}` : 'none'}`,
          `exitPos=${this.exitPos ? `${Math.round(this.exitPos.x)},${Math.round(this.exitPos.y)}` : 'none'}`,
          `fallbacks=${this.goalFallbacksUsed.length ? this.goalFallbacksUsed.join(',') : 'none'}`,
          `mapPx=${this.map?.widthInPixels}x${this.map?.heightInPixels}`
        ].join('\n')
      );
    }

    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.restartHero();
      return;
    }

    // The HUD says Space can restart after death — support that.
    if (this.hero.isDead() && Phaser.Input.Keyboard.JustDown(this.jumpKey)) {
      this.restartHero();
      return;
    }

    if (this.hero.isDead() && this.hero.getBounds().top > cameraBottom + 100) {
      this.restartHero();
    }

    this.updateCameraLookAhead();
  }
}

export default Game;
