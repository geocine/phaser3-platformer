import Phaser from 'phaser';
import Hero from '../entities/Hero';

class Game extends Phaser.Scene {
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private hero!: Hero;
  private map!: Phaser.Tilemaps.Tilemap;
  private spikeGroup!: Phaser.Physics.Arcade.Group;
  private spawnPos = { x: 0, y: 0 };

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
      frames: this.anims.generateFrameNumbers('sprite/hero/die')
    });

    this.addMap();

    this.addHero();
  }

  addHero() {
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
    const groundCollider = this.physics.add.collider(
      this.hero,
      this.map.getLayer('Ground').tilemapLayer
    );

    const spikesCollider = this.physics.add.overlap(
      this.hero,
      this.spikeGroup,
      () => {
        this.hero.kill();
      }
    );

    this.hero.on('died', () => {
      groundCollider.destroy();
      spikesCollider.destroy();
      this.hero.body.setCollideWorldBounds(false);
    });
  }

  addMap() {
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
    if (this.hero.isDead() && this.hero.getBounds().top > cameraBottom + 100) {
      this.hero.destroy();
      this.addHero();
    }
  }
}

export default Game;
