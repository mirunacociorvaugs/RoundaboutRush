import config from './config.js';
import MainScene from './MainScene.js';

config.scene = [MainScene];

const game = new Phaser.Game(config);

export default game;
