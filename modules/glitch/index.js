import { AudioDriver } from './audio_driver.js';
import { GlitchManager } from './glitch_manager.js';

export class GlitchSystem {
  constructor(config = {}, blocks = {}, labels = {}, textTargets = []) {
    this.audioDriver = new AudioDriver();
    this.manager = new GlitchManager(config, blocks);
    this.manager.setBlocks(blocks, labels, textTargets);
  }

  onAudioFrame(data) {
    this.audioDriver.onAudioFrame(data);
  }

  update(dt, now) {
    this.audioDriver.update(dt);
    this.manager.update(dt, now, this.audioDriver.getState());
  }

  render(ctx, hudCanvas, mainCanvas) {
    this.manager.render(ctx, hudCanvas, mainCanvas, this.audioDriver.getState());
  }

  setBlocks(blocks, labels, textTargets) {
    this.manager.setBlocks(blocks, labels, textTargets);
  }

  setConfig(config) {
    this.manager.setConfig(config);
  }

  triggerBigEvent() {
    this.manager.triggerBigEvent();
  }

  getAudioState() {
    return this.audioDriver.getState();
  }

  getDebugInfo() {
    return this.manager.getDebugInfo();
  }
}
