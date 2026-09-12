import { WEAPON_DEFS } from './weapons.js?v=3';
import { SCENARIOS, DIFFICULTIES, DEFAULT_DIFFICULTY, getScenario, getDifficulty, fmtClock } from './scenarios.js?v=3';

const $ = id => document.getElementById(id);

/** DOM HUD: crosshair, hitmarker, panels, banners, damage feedback, screens. */
export class HUD {
  constructor(stats) {
    this.el = {
      healthFill: $('health-fill'),
      healthText: $('health-text'),
      mag: $('ammo-mag'),
      reserve: $('ammo-reserve'),
      weaponName: $('weapon-name'),
      reloadBar: $('reload-bar'),
      reloadFill: $('reload-fill'),
      reloadHint: $('reload-hint'),
      grenadeCount: $('grenade-count'),
      slots: $('slots'),
      time: $('time-num'),
      enemies: $('enemies-left'),
      score: $('score-num'),
      kills: $('kills-num'),
      missionName: $('mission-name'),
      missionDiff: $('mission-diff'),
      banner: $('banner'),
      msg: $('msg'),
      crosshair: $('crosshair'),
      hitmarker: $('hitmarker'),
      vignette: $('vignette'),
      lowHealth: $('low-health'),
      scope: $('scope-overlay'),
      dmgLayer: $('dmg-indicators'),
      scenarioList: $('scenario-list'),
      scenarioDetail: $('scenario-detail'),
      difficultyList: $('difficulty-list'),
      difficultyDetail: $('difficulty-detail'),
      screens: { menu: $('menu-screen'), pause: $('pause-screen'), gameover: $('gameover-screen'), victory: $('victory-screen') },
      goTitle: $('go-title'),
      goMission: $('go-mission'),
      goScore: $('go-score'),
      goKills: $('go-kills'),
      goTime: $('go-time'),
      vMission: $('v-mission'),
      vScore: $('v-score'),
      vKills: $('v-kills'),
      vTime: $('v-time'),
      vBonus: $('v-bonus'),
    };
    this.msgT = 0;
    this.bannerT = 0;
    this._cache = {};
    this.stats = stats || {};
    this.selection = { scenarioId: SCENARIOS[0].id, difficultyId: DEFAULT_DIFFICULTY };
    this.onPreview = null;

    this.el.slots.innerHTML = WEAPON_DEFS
      .map((d, i) => `<div class="slot" data-i="${i}"><span class="key">${i + 1}</span><span class="nm">${d.short}</span></div>`)
      .join('');
    this.slotEls = [...this.el.slots.querySelectorAll('.slot')];

    this._buildPickers();
  }

  // ---------- deploy screen: scenario + difficulty ----------

  _buildPickers() {
    this.el.scenarioList.innerHTML = SCENARIOS.map(s => {
      const st = this.stats[s.id];
      return `<button type="button" class="pick scenario" data-id="${s.id}" style="--accent:${s.color}">
        <span class="pick-name">${s.name}</span>
        <span class="pick-mode">${s.mode}</span>
        <span class="pick-stat">${st ? `${st.hostiles} HOSTILES · ${st.supplies} SUPPLIES` : ''}</span>
      </button>`;
    }).join('');
    this.scenarioEls = [...this.el.scenarioList.querySelectorAll('.scenario')];
    for (const el of this.scenarioEls) {
      el.addEventListener('click', () => this.setScenario(el.dataset.id));
    }

    this.el.difficultyList.innerHTML = DIFFICULTIES.map(d =>
      `<button type="button" class="pick difficulty" data-id="${d.id}" style="--accent:${d.color}">${d.name}</button>`
    ).join('');
    this.diffEls = [...this.el.difficultyList.querySelectorAll('.difficulty')];
    for (const el of this.diffEls) {
      el.addEventListener('click', () => this.setDifficulty(el.dataset.id));
    }

    this.refreshPickers();
  }

  setScenario(id) {
    if (!SCENARIOS.some(s => s.id === id)) return;
    this.selection.scenarioId = id;
    this.refreshPickers();
    this.onPreview?.(id);
  }

  setDifficulty(id) {
    if (!DIFFICULTIES.some(d => d.id === id)) return;
    this.selection.difficultyId = id;
    this.refreshPickers();
  }

  getSelection() { return { ...this.selection }; }

  refreshPickers() {
    const scenario = getScenario(this.selection.scenarioId);
    const difficulty = getDifficulty(this.selection.difficultyId);
    for (const el of this.scenarioEls) el.classList.toggle('active', el.dataset.id === scenario.id);
    for (const el of this.diffEls) el.classList.toggle('active', el.dataset.id === difficulty.id);

    const st = this.stats[scenario.id];
    const rules = [];
    if (scenario.rules.timeLimit) rules.push(`TIME LIMIT ${fmtClock(scenario.rules.timeLimit)}`);
    if (scenario.rules.noLeash) rules.push('NO DISENGAGE');
    if (scenario.rules.alertOnStart) rules.push('ALERTED ON ARRIVAL');
    if (scenario.rules.startWeapon !== undefined) {
      rules.push(`START: ${WEAPON_DEFS[scenario.rules.startWeapon].short}`);
    }
    this.el.scenarioDetail.innerHTML =
      `<p>${scenario.description}</p>
       <div class="detail-meta">
         <span>${st ? st.hostiles : '?'} HOSTILES</span>
         <span>${st ? st.supplies : '?'} SUPPLIES</span>
         <span>OBJECTIVE: ${scenario.objective}</span>
         ${rules.map(r => `<span class="rule">${r}</span>`).join('')}
       </div>`;

    this.el.difficultyDetail.innerHTML =
      `<p>${difficulty.blurb}</p>
       <div class="detail-meta">
         <span>ENEMY HP &times;${difficulty.enemyHp}</span>
         <span>ENEMY DAMAGE &times;${difficulty.enemyDamage}</span>
         <span>YOU TAKE &times;${difficulty.playerDamage}</span>
         <span>AMMO &times;${difficulty.ammo}</span>
         <span>SCORE &times;${difficulty.score}</span>
       </div>`;
  }

  // ---------- screens ----------

  bind({ onPlay, onResume, onRestart, onRedeploy, onMenu, onScenarioPreview }) {
    this.onPreview = onScenarioPreview || null;
    $('btn-play').addEventListener('click', () => onPlay(this.getSelection()));
    $('btn-resume').addEventListener('click', onResume);
    $('btn-restart').addEventListener('click', onRestart);
    $('btn-redeploy').addEventListener('click', onRedeploy);
    for (const el of document.querySelectorAll('.btn-menu')) el.addEventListener('click', onMenu);
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

    // grenades
    if (s.grenades && this._cache.grenades !== s.grenades.count) {
      this.el.grenadeCount.textContent = s.grenades.count;
      this.el.grenadeCount.classList.toggle('empty', s.grenades.count === 0);
      this._cache.grenades = s.grenades.count;
    }

    // top panel
    if (this._cache.mission !== s.missionLabel) { this.el.missionName.textContent = s.missionLabel; this._cache.mission = s.missionLabel; }
    if (this._cache.threat !== s.threatLabel) { this.el.missionDiff.textContent = s.threatLabel; this._cache.threat = s.threatLabel; }
    if (this._cache.time !== s.time) { this.el.time.textContent = s.time; this._cache.time = s.time; }
    if (this._cache.timeLow !== !!s.timeLow) {
      this.el.time.classList.toggle('low', !!s.timeLow);
      this._cache.timeLow = !!s.timeLow;
    }
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
    for (const k of ['menu', 'pause', 'gameover', 'victory']) {
      this.el.screens[k].classList.toggle('hidden', k !== name);
    }
    if (name === 'gameover' && stats) {
      this.el.goTitle.textContent = stats.reason || 'YOU DIED';
      this.el.goMission.textContent = `${stats.mission} \u00B7 ${stats.difficulty}`;
      this.el.goScore.textContent = stats.score;
      this.el.goKills.textContent = stats.kills;
      this.el.goTime.textContent = stats.time;
    }
    if (name === 'victory' && stats) {
      this.el.vMission.textContent = `${stats.mission} \u00B7 ${stats.difficulty}`;
      this.el.vScore.textContent = stats.score;
      this.el.vKills.textContent = stats.kills;
      this.el.vTime.textContent = stats.time;
      this.el.vBonus.textContent = '+' + stats.bonus;
    }
  }
}
