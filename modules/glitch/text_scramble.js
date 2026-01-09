export const DEFAULT_SYMBOL_SET = [
  '⌖⌬⍜⍰⟁⟟⌰⌇⎔⌿⍟⍤⍣⍧⍨⍩⍪⍫⍬⍭⍮⍯⍱⍲⍳⍴⍵⍶⍷⍸⍹⍺⍻⍼⍽⍾⍿⎀⎁⎂⎃⎄⎅⎆⎇⎈⎉⎊⎋⎌⎍⎎⎏⎐⎑⎒⎓⎔⎕⎖⎗⎘⎙⎚⎛⎜⎝⎞⎟⎠⎢⎣⎤⎥⎦⎧⎨⎩⎪⎫⎬⎭⎮⎯⎰⎱',
  '⏃⏄⏅⏆⏇⏈⏉⏊⏋⏌⏍⏎⏏⏐⏑⏒⏓⏔⏕⏖⏗⏘⏙⏚⏛⏜⏝⏞⏟⏠⏡⏢⏣⏤⏥',
  '△▲▽▼◆◇◈◉○●◌◍◎◐◑◒◓◔◕◖◗◢◣◤◥',
  '⟐⟑⟒⟓⟔⟕⟖⟗⟘⟙⟚⟛⟜⟝⟞⟟⟠⟡⟢⟣⟤⟥⟦⟧⟨⟩⟪⟫⟬⟭⟮⟯',
].join('');

const MODES = {
  mild: 0.25,
  medium: 0.5,
  aggressive: 0.8,
};

export function scrambleText(text, options = {}) {
  if (!text) return text;
  const mode = options.mode || 'medium';
  const strength = options.strength ?? MODES[mode] ?? 0.5;
  const symbols = options.symbols || DEFAULT_SYMBOL_SET;
  const keepChars = /[\s\-:/,.]/;
  const chars = text.split('');
  return chars
    .map(ch => {
      if (keepChars.test(ch)) return ch;
      if (Math.random() > strength) return ch;
      const idx = Math.floor(Math.random() * symbols.length);
      return symbols[idx] || ch;
    })
    .join('');
}

export class ScrambleAnimator {
  constructor(text = '', options = {}) {
    this.original = text;
    this.current = text;
    this.mode = options.mode || 'medium';
    this.symbols = options.symbols || DEFAULT_SYMBOL_SET;
    this.strengthMultiplier = options.strengthMultiplier ?? 1;
    this.strength = (MODES[this.mode] ?? 0.5) * this.strengthMultiplier;
    this.active = false;
    this.elapsed = 0;
    this.duration = 0.6;
  }

  setText(text) {
    this.original = text ?? '';
    if (!this.active) this.current = this.original;
  }

  activate(mode = 'medium', duration = 0.6) {
    this.mode = mode;
    this.strength = (MODES[this.mode] ?? 0.5) * this.strengthMultiplier;
    this.duration = duration;
    this.elapsed = 0;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return this.current;
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / this.duration);
    const falloff = 1 - t;
    this.current = scrambleText(this.original, {
      mode: this.mode,
      strength: Math.max(0, this.strength * falloff),
      symbols: this.symbols,
    });
    if (t >= 1) {
      this.active = false;
      this.current = this.original;
    }
    return this.current;
  }
}
