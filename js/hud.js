import { WEAPON_DEFS } from './weapons.js';

const $ = id => document.getElementById(id);

/** DOM HUD: crosshair, hitmarker, panels, banners, damage feedback, screens. */
export class HUD {
  constructor() {
    this.el = {
      healthFill: $('health-fill'),
      healthText: $('health-text'),
      mag: $('ammo-mag'),
      reserve: $('ammo-reserve'),
      weaponName: $('weapon-name'),
      reloadBar: $('reload-bar'),
      reloadFill: $('reload-fill'),
      reloadHint: $('reload-hint'),
      slots: $('slots'),
      wave: $('wave-num'),
      enemies: $('enemies-left'),
      score: $('score-num'),
      kills: $('kills-num'),
      banner: $('banner'),
      msg: $('msg'),
      crosshair: $('crosshair'),
      hitmarker: $('hitmarker'),
      vignette: $('vignette'),
      lowHealth: $('low-health'),
      scope: $('scope-overlay'),
      dmgLayer: $('dmg-indicators'),
      screens: { menu: $('menu-screen'), pause: $('pause-screen'), gameover: $('gameover-screen') },
      goScore: $('go-score'),
      goKills: $('go-kills'),
      goWave: $('go-wave'),
    };
    this.msgT = 0;
    this.bannerT = 0;
    this._cache = {};

    this.el.slots.innerHTML = WEAPON_DEFS
      .map((d, i) => `<div class="slot" data-i="${i}"><span class="key">${i + 1}</span><span class="nm">${d.short}</span></div>`)
      .join('');
    this.slotEls = [...this.el.slots.querySelectorAll('.slot')];
  }

  bind({ onPlay, onResume, onRestart }) {
    $('btn-play').addEventListener('click', onPlay);
    $('btn-resume').addEventListener('click', onResume);
    $('btn-restart').addEventListener('click', onRestart);
  }

  update(dt, s) {
    if (this.msgT > 0) {
      this.msgT -= dt;
      if (this.msgT <= 0) this.el.msg.classList.remove('show');
    }
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.el.banner.classList.remove('show');
    }

    // health
    const hp = Math.max(0, Math.round(s.health));
    if (this._cache.hp !== hp) {
      this.el.healthText.textContent = hp;
      this._cache.hp = hp;
    }
    const pct = s.maxHealth > 0 ? s.health / s.maxHealth : 0;
    this.el.healthFill.style.width = (Math.max(0, pct) * 100).toFixed(1) + '%';
    const band = pct > 0.5 ? 'hi' : pct > 0.25 ? 'mid' : 'lo';
    if (this._cache.band !== band) {
      this.el.healthFill.dataset.band = band;
      this._cache.band = band;
    }
    this.el.lowHealth.classList.toggle('show', pct <= 0.3 && s.alive);

    // weapon / ammo
    const w = s.weapon;
    this.el.weaponName.textContent = w.def.name;
    this.el.mag.textContent = w.mag;
    this.el.reserve.textContent = w.reserve === Infinity ? '\u221E' : w.reserve;
    this.el.mag.classList.toggle('empty', w.mag === 0);
    this.el.reloadBar.classList.toggle('show', w.reloading);
    if (w.reloading) this.el.reloadFill.style.width = (w.reloadProgress * 100).toFixed(1) + '%';
    this.el.reloadHint.classList.toggle('show', !w.reloading && w.mag === 0 && w.reserve !== 0);
    if (this._cache.slot !== w.index) {
      this.slotEls.forEach((el, i) => el.classList.toggle('active', i === w.index));
      this._cache.slot = w.index;
    }

    // top panel
    if (this._cache.wave !== s.wave) { this.el.wave.textContent = s.wave; this._cache.wave = s.wave; }
    if (this._cache.enemies !== s.enemiesLabel) { this.el.enemies.textContent = s.enemiesLabel; this._cache.enemies = s.enemiesLabel; }
    if (this._cache.score !== s.score) { this.el.score.textContent = s.score; this._cache.score = s.score; }
    if (this._cache.kills !== s.kills) { this.el.kills.textContent = s.kills; this._cache.kills = s.kills; }

    // crosshair + scope
    const gap = Math.max(3, Math.min(70, 4 + s.spreadPx));
    this.el.crosshair.style.setProperty('--gap', gap.toFixed(1) + 'px');
    this.el.crosshair.style.display = (s.zoom || !s.alive) ? 'none' : '';
    this.el.scope.classList.toggle('show', !!s.zoom);
  }

  hitmarker(kill) {
    const h = this.el.hitmarker;
    h.classList.remove('show', 'kill');
    void h.offsetWidth; // restart animation
    if (kill) h.classList.add('kill');
    h.classList.add('show');
  }

  damageFlash() {
    const v = this.el.vignette;
    v.classList.remove('flash');
    void v.offsetWidth;
    v.classList.add('flash');
  }

  damageIndicator(deg) {
    const d = document.createElement('div');
    d.className = 'dmg-ind';
    d.style.transform = `rotate(${deg.toFixed(1)}deg)`;
    this.el.dmgLayer.appendChild(d);
    setTimeout(() => d.remove(), 950);
  }

  message(text, dur = 2) {
    this.el.msg.textContent = text;
    this.el.msg.classList.add('show');
    this.msgT = dur;
  }

  banner(text, dur = 2.2) {
    this.el.banner.textContent = text;
    this.el.banner.classList.remove('show');
    void this.el.banner.offsetWidth;
    this.el.banner.classList.add('show');
    this.bannerT = dur;
  }

  showScreen(name, stats) {
    for (const k of ['menu', 'pause', 'gameover']) {
      this.el.screens[k].classList.toggle('hidden', k !== name);
    }
    if (name === 'gameover' && stats) {
      this.el.goScore.textContent = stats.score;
      this.el.goKills.textContent = stats.kills;
      this.el.goWave.textContent = stats.wave;
    }
  }
}
