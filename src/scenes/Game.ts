import Phaser from 'phaser';
import Hero from '../entities/Hero';

class Game extends Phaser.Scene {
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private restartKey!: Phaser.Input.Keyboard.Key;

  private hero!: Hero;
  private map!: Phaser.Tilemaps.Tilemap;
  private spikeGroup!: Phaser.Physics.Arcade.Group;
  private spawnPos = { x: 0, y: 0 };

  private hudText?: Phaser.GameObjects.Text;
  private deathText?: Phaser.GameObjects.Text;

  private groundCollider?: Phaser.Physics.Arcade.Collider;
  private spikesCollider?: Phaser.Physics.Arcade.Collider;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    this.load.tilemapTiledJSON('level-1', 'assets/tilemaps/level-1.json');

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
    this.cursorKeys = this.input.keyboard.createCursorKeys();
    this.restartKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.R
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

    this.addHero();
  }

  private addHud() {
    // Minimal controls hint (camera-fixed).
    this.hudText = this.add
      .text(10, 10, 'Move: ←/→  Jump: ↑  Restart: R', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff'
      })
      .setScrollFactor(0)
      .setDepth(1000)
      .setAlpha(0.8);

    this.deathText = this.add
      .text(10, 30, 'You died — press R to restart', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffdddd'
      })
      .setScrollFactor(0)
      .setDepth(1000)
      .setAlpha(0.95)
      .setVisible(false);
  }

  private addHero() {
    this.hero = new Hero(this, this.spawnPos.x, this.spawnPos.y, this.cursorKeys);

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
    this.map = this.make.tilemap({ key: 'level-1' });
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

  update(time, delta) {
    const cameraBottom = this.cameras.main.getWorldPoint(
      0,
      this.cameras.main.height
    ).y;

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
