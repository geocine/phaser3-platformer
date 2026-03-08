import Phaser from 'phaser';
import Hero from '../entities/Hero';

class Game extends Phaser.Scene {
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private jumpKey!: Phaser.Input.Keyboard.Key;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private sprintKey!: Phaser.Input.Keyboard.Key;

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

  private hudText?: Phaser.GameObjects.Text;
  private deathText?: Phaser.GameObjects.Text;
  private debugText?: Phaser.GameObjects.Text;
  private debugGraphics?: Phaser.GameObjects.Graphics;

  private groundCollider?: Phaser.Physics.Arcade.Collider;
  private spikesCollider?: Phaser.Physics.Arcade.Collider;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Add a cache-busting query param so deploy previews don't serve stale tilemaps.
    this.load.tilemapTiledJSON('level-1', 'assets/tilemaps/level-1.json?v=20260308');
    this.load.tilemapTiledJSON('level-2', 'assets/tilemaps/level-2.json?v=20260308');

    // Simple door marker for the Exit goal.
    this.load.image(
      'goal/door',
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDMyIDY0Ij4KICA8cmVjdCB4PSI2IiB5PSIxMiIgd2lkdGg9IjIwIiBoZWlnaHQ9IjQ2IiByeD0iNCIgZmlsbD0iIzdhNGUyMiIgc3Ryb2tlPSIjMmExYTBjIiBzdHJva2Utd2lkdGg9IjMiLz4KICA8cmVjdCB4PSI5IiB5PSIxNSIgd2lkdGg9IjE0IiBoZWlnaHQ9IjQwIiByeD0iMyIgZmlsbD0iIzVmM2ExNiIgc3Ryb2tlPSIjNGEyYzEwIiBzdHJva2Utd2lkdGg9IjIiLz4KICA8Y2lyY2xlIGN4PSIyMiIgY3k9IjM4IiByPSIyIiBmaWxsPSIjZmZkMjRkIi8+CiAgPHJlY3QgeD0iMjEiIHk9IjQ3IiB3aWR0aD0iMiIgaGVpZ2h0PSI1IiBmaWxsPSIjMmExYTBjIi8+CiAgPHBhdGggZD0iTTIwIDQ2YTIgMiAwIDAgMSA0IDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzJhMWEwYyIgc3Ryb2tlLXdpZHRoPSIxIi8+Cjwvc3ZnPgo='
    );

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

    this.addHud();

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
      frameRate: 30,
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

    this.exitDoor?.destroy();
    this.exitDoor = undefined;

    this.exitZone?.destroy();
    this.exitZone = undefined;

    this.debugGraphics?.clear();

    this.addHero();
  }

  private addHud() {
    // Minimal controls hint (camera-fixed).
    this.hudText = this.add
      .text(10, 10, 'Move: ←/→  Jump: ↑/Space  Sprint: Shift  Restart: R', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff'
      })
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

    // Temporary debug overlay so we can *prove* where Exit/Key are.
    this.debugText = this.add
      .text(10, 50, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#aaffaa'
      })
      .setScrollFactor(0)
      .setDepth(2000)
      .setAlpha(0.9);

    this.debugGraphics = this.add.graphics().setDepth(1999);
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

    this.map.createLayer('Foreground', groundTiles);
    // const debugGraphics = this.add.graphics();
    // groundLayer.renderDebug(debugGraphics);
  }

  private setupLevelGoals() {
    // Key pickup (optional per level)
    if (this.keyPos && !this.hasKey) {
      // Make the key extremely visible: bright tint + label + bobbing.
      const icon = this.add
        .sprite(0, 0, 'world-1-sheet', 1)
        .setOrigin(0.5, 1)
        .setTint(0xffd400)
        .setScale(1.1);

      const label = this.add
        .text(0, -48, 'KEY', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffea7a',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5, 1);

      this.keyMarker = this.add
        .container(this.keyPos.x, this.keyPos.y, [icon, label])
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
        .zone(this.keyPos.x, this.keyPos.y - 24, 40, 72)
        .setOrigin(0.5, 1);
      this.physics.add.existing(this.keyZone, true);

      this.physics.add.overlap(this.hero, this.keyZone, () => {
        if (this.hasKey) return;
        this.hasKey = true;

        this.keyMarker?.destroy();
        this.keyMarker = undefined;

        this.keyZone?.destroy();
        this.keyZone = undefined;

        this.cameras.main.flash(120, 255, 255, 200);
      });

      // Debug draw the key pickup zone bounds.
      this.debugGraphics?.lineStyle(2, 0xffff00, 1);
      this.debugGraphics?.strokeRect(
        this.keyPos.x - 20,
        (this.keyPos.y - 24) - 72,
        40,
        72
      );
    }

    // Exit (optional per level)
    if (this.exitPos) {
      // Visible door marker so players know where to go.
      // Use basic shapes/text to avoid any asset-loading issues.
      const doorRect = this.add
        .rectangle(0, -32, 28, 60, 0x5c3a16, 1)
        .setStrokeStyle(3, 0x1b1208, 1);

      const doorLabel = this.add
        .text(0, -80, 'EXIT', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3
        })
        .setOrigin(0.5, 1);

      this.exitDoor = this.add
        .container(this.exitPos.x, this.exitPos.y, [doorRect, doorLabel])
        .setDepth(1500);

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

      // Debug draw the exit zone bounds.
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

  update(time, delta) {
    const cameraBottom = this.cameras.main.getWorldPoint(
      0,
      this.cameras.main.height
    ).y;

    // Debug overlay (camera-fixed)
    this.debugText?.setText(
      [
        `level=${this.currentLevelKey} hasKey=${this.hasKey}`,
        `keyPos=${this.keyPos ? `${Math.round(this.keyPos.x)},${Math.round(this.keyPos.y)}` : 'none'}`,
        `exitPos=${this.exitPos ? `${Math.round(this.exitPos.x)},${Math.round(this.exitPos.y)}` : 'none'}`,
        `mapPx=${this.map?.widthInPixels}x${this.map?.heightInPixels}`
      ].join('\n')
    );

    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.restartHero();
      return;
    }

    if (this.hero.isDead() && this.hero.getBounds().top > cameraBottom + 100) {
      this.restartHero();
    }
  }
}

export default Game;
