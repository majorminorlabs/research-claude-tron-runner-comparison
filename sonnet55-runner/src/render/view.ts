import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CFG, laneX } from '../game/config';
import type { Game, GameEvent } from '../game/game';
import { Entities } from './entities';
import { Fx } from './fx';
import { COLORS, POWER_COLORS } from './palette';
import { Runner } from './runner';
import { World } from './world';

export type Quality = 'high' | 'low';
export type ViewMode = 'title' | 'ready' | 'play';

/** Owns the Three.js scene and renders whichever Game it is pointed at. */
export class GameView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(66, 1, 0.1, 500);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private world = new World();
  private runner = new Runner();
  private entities = new Entities();
  private fx = new Fx();
  private game: Game | null = null;
  private mode: ViewMode = 'title';
  private quality: Quality = 'high';
  private time = 0;
  private camX = 0;
  private shake = 0;
  private flash = 0;
  private camBlend = 0;
  private pulse = 0;
  private frameTimes: number[] = [];
  private autoDowngraded = false;
  /** Respect prefers-reduced-motion: damp screen shake and flashes. */
  private motion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.25 : 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.info.autoReset = false;
    this.renderer.setClearColor(COLORS.bg, 1);
    this.scene.background = new THREE.Color(COLORS.bg);
    this.scene.fog = new THREE.Fog(COLORS.fog, 45, 185);
    this.scene.add(this.world.group, this.entities.group, this.runner.group, this.runner.trailObject, this.fx.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.5, 0.22);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.camera.position.set(0, 4.3, 7.4);
    this.resize();
  }

  // ----------------------------------------------------------------- config
  setGame(game: Game | null): void {
    this.game = game;
    this.entities.clear();
    this.runner.resetTrail();
    this.fx.clearDebris();
    this.runner.hidden = false;
    this.shake = 0;
  }

  setMode(mode: ViewMode): void {
    this.mode = mode;
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.bloom.enabled = q === 'high';
    this.resize();
  }
  getQuality(): Quality {
    return this.quality;
  }
  /** Renderer statistics for the last frame (debug / tests). */
  get stats(): { calls: number; triangles: number } {
    const r = this.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles };
  }
  /** True once the view dropped itself to low quality because of slow frames. */
  get wasAutoDowngraded(): boolean {
    return this.autoDowngraded;
  }

  resize(): void {
    const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // narrow / portrait screens need a wider field of view to keep all lanes visible
    this.baseFov = w / h < 0.9 ? 78 : w / h < 1.3 ? 62 : 54;
    this.camera.updateProjectionMatrix();
  }
  private baseFov = 54;

  // ----------------------------------------------------------------- events
  handleEvents(events: GameEvent[]): void {
    const g = this.game;
    if (!g) return;
    const x = laneX(g.laneFloat);
    for (const e of events) {
      switch (e.type) {
        case 'bit':
          this.fx.burst(laneX(e.lane), e.y, 0, COLORS.cyanBright, 7, 4, 0.45);
          this.pulse = Math.min(1, this.pulse + 0.15);
          break;
        case 'power':
          this.fx.burst(laneX(e.lane), e.y, 0, POWER_COLORS[e.kind as keyof typeof POWER_COLORS] ?? COLORS.white, 50, 9, 0.9);
          this.flash = 0.35;
          break;
        case 'jump':
          this.fx.burst(x, 0.05, 0, COLORS.cyan, 10, 3.2, 0.35, 1.2);
          break;
        case 'land':
          this.fx.burst(x, 0.05, 0, COLORS.cyan, 12, 3.6, 0.4, 1.4);
          break;
        case 'slide':
          this.fx.burst(x, 0.05, 0.4, COLORS.cyanBright, 8, 3, 0.3);
          break;
        case 'dodge':
          this.fx.burst(x, 0.9, 0, COLORS.white, 12, 4, 0.4);
          break;
        case 'derez':
          this.fx.burst(laneX(e.obstacle.lane), 1.4, -(e.obstacle.z - g.distance), COLORS.lime, 40, 8, 0.7);
          this.shake = Math.max(this.shake, 0.12);
          break;
        case 'shield-break':
          this.fx.burst(x, 1, 0, 0x4aa8ff, 70, 11, 0.9);
          this.shake = 0.5;
          this.flash = 0.5;
          break;
        case 'crash':
          this.fx.explode(x, g.player.y, 0, COLORS.cyan);
          this.runner.hidden = true;
          this.shake = 1;
          this.flash = 0.6;
          break;
        case 'sector':
          this.flash = 0.25;
          break;
        default:
          break;
      }
    }
  }

  // ----------------------------------------------------------------- update
  update(dt: number): void {
    this.time += dt;
    const g = this.game;
    const distance = g ? g.distance : this.time * CFG.startSpeed;
    const speed = g ? (g.state === 'playing' || g.state === 'over' ? g.speed : 0) : 0;
    const scrollSpeed = g && g.state === 'playing' ? g.speed : 0;

    this.pulse = Math.max(0, this.pulse - dt * 1.8);
    this.world.update(distance, scrollSpeed, dt, this.pulse, !!g && g.effects.phase > 0);
    if (g) {
      this.entities.update(g, this.time);
      const idle = g.state === 'ready';
      this.runner.update(g, dt, this.time, idle);
      const sector = Math.floor((g.sector - 1) % 4);
      this.world.setTint([COLORS.cyan, 0x2f9bff, 0x19ffc4, 0x7a6bff][sector]!);
    }
    this.fx.update(dt, scrollSpeed);
    this.updateCamera(dt, speed);
    this.trackPerformance(dt);
  }

  private updateCamera(dt: number, speed: number): void {
    const g = this.game;
    const cam = this.camera;
    const px = g ? laneX(g.laneFloat) : 0;
    this.camX += (px * 0.55 - this.camX) * (1 - Math.exp(-dt * 7));

    // title mode: slow cinematic sway, a little further back
    const titleBlend = this.mode === 'title' ? 1 : 0;
    this.camBlend += (titleBlend - this.camBlend) * (1 - Math.exp(-dt * 3));
    const sway = Math.sin(this.time * 0.25) * 2.4 * this.camBlend;
    const fovBoost = Math.min(1, speed / CFG.maxSpeed) * 9 + (g && g.effects.phase > 0 ? 8 : 0);

    const baseY = 4.3 - this.camBlend * 0.9;
    const baseZ = 7.4 + this.camBlend * 1.4;
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.6);
      sx = (Math.random() - 0.5) * this.shake * 0.7 * this.motion;
      sy = (Math.random() - 0.5) * this.shake * 0.7 * this.motion;
    }
    const jumpLift = g ? g.player.y * 0.28 : 0;
    cam.position.set(this.camX + sway + sx, baseY + jumpLift + sy, baseZ);
    cam.lookAt(this.camX * 0.6 + sway * 0.3, 0.9 + jumpLift * 0.6, -11);
    const wantFov = this.baseFov + fovBoost;
    cam.fov += (wantFov - cam.fov) * (1 - Math.exp(-dt * 5));
    cam.updateProjectionMatrix();

    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.bloom.strength = 0.85 + (this.flash * 1.4 + this.pulse * 0.25) * this.motion;
  }

  private trackPerformance(dt: number): void {
    if (this.quality !== 'high' || this.autoDowngraded) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length >= 90) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.frameTimes.length = 0;
      // sustained < ~28 fps at high quality: drop bloom / resolution
      if (avg > 1 / 28 && !document.hidden) {
        this.autoDowngraded = true;
        this.setQuality('low');
      }
    }
  }

  render(): void {
    this.renderer.info.reset();
    if (this.quality === 'high') this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
