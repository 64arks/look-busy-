import { GRID_COLS, GRID_ROWS, OFFICE_DESKS, PLAYER_DESK_POS } from './levels';
import { gridToIso, isoToGrid } from './rules';
import { DeskProp, GameSimState, Hotspot, NpcState, Particle, Vec2 } from './types';

export interface CameraTransform {
  originX: number;
  originY: number;
  scale: number;
  tileW: number;
  tileH: number;
}

const PARTICLE_POOL_SIZE = 72;

export class OfficeRenderer {
  private particles: Particle[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
    active: false,
    gx: 0,
    gy: 0,
    gz: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    size: 4,
    color: '#fbbf24',
    life: 0,
    maxLife: 1,
    kind: 'spark',
  }));
  private particleCursor = 0;
  private lastTickEventTime = 0;

  public spawnBurst(
    gx: number,
    gy: number,
    count: number,
    kind: Particle['kind'],
    colors: string[],
  ): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.6 + Math.random() * 1.6;
      p.active = true;
      p.gx = gx + (Math.random() - 0.5) * 0.25;
      p.gy = gy + (Math.random() - 0.5) * 0.25;
      p.gz = 0.7 + Math.random() * 0.4;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.vz = 1.4 + Math.random() * 1.8;
      p.size = kind === 'confetti' ? 5 : kind === 'zzz' ? 11 : 4;
      p.color = colors[i % colors.length];
      p.maxLife = kind === 'zzz' ? 1.2 : 0.75 + Math.random() * 0.35;
      p.life = p.maxLife;
      p.kind = kind;
    }
  }

  public updateParticles(dt: number, sim: GameSimState): void {
    this.lastTickEventTime += dt;
    if (sim.phase === 'playing') {
      if (sim.player.activity === 'nap' && this.lastTickEventTime > 0.75) {
        this.lastTickEventTime = 0;
        this.spawnBurst(sim.player.gx, sim.player.gy, 1, 'zzz', ['#e0f2fe']);
      } else if (sim.player.activity === 'snack' && this.lastTickEventTime > 0.45) {
        this.lastTickEventTime = 0;
        this.spawnBurst(sim.player.gx, sim.player.gy, 3, 'crumb', ['#f59e0b', '#fbbf24', '#d97706']);
      } else if (sim.player.caffeineTimer > 0 && this.lastTickEventTime > 0.32) {
        this.lastTickEventTime = 0;
        this.spawnBurst(sim.player.gx, sim.player.gy, 2, 'steam', ['#fef3c7', '#fde68a']);
      }
    }

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      if (p.kind === 'zzz' || p.kind === 'steam') {
        p.gz += dt * 0.9;
        p.gx += Math.sin(p.life * 6) * dt * 0.25;
      } else {
        p.gx += p.vx * dt;
        p.gy += p.vy * dt;
        p.gz += p.vz * dt;
        p.vz -= 5.2 * dt;
        if (p.gz < 0) {
          p.gz = 0;
          p.vz *= -0.35;
        }
      }
    }
  }

  public computeCamera(width: number, height: number, sim: GameSimState): CameraTransform {
    const tileW = 68;
    const tileH = 36;
    // Full isometric grid spans roughly 12+10 = 22 half-widths horizontally and vertically
    const totalIsoW = (GRID_COLS + GRID_ROWS) * (tileW * 0.5);
    const totalIsoH = (GRID_COLS + GRID_ROWS) * (tileH * 0.5);

    const isPortrait = height > width;
    const padX = isPortrait ? 24 : 120;
    const padY = isPortrait ? 190 : 170;
    const availW = Math.max(260, width - padX);
    const availH = Math.max(260, height - padY);
    const scale = Math.min(availW / totalIsoW, availH / totalIsoH) * (isPortrait ? 1.18 : 1.08);

    // Center on office middle (gx: 5.5, gy: 4.8)
    const centerIso = gridToIso(5.4, 4.9, tileW, tileH);
    const shakeMag = sim.trauma * sim.trauma * 12;
    const shakeX = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;
    const shakeY = shakeMag > 0.1 ? (Math.random() - 0.5) * 2 * shakeMag : 0;

    return {
      originX: width * 0.5 - centerIso.x * scale + shakeX,
      originY: height * (isPortrait ? 0.45 : 0.48) - centerIso.y * scale + shakeY,
      scale,
      tileW,
      tileH,
    };
  }

  public screenToGrid(
    screenX: number,
    screenY: number,
    width: number,
    height: number,
    sim: GameSimState,
  ): Vec2 {
    const cam = this.computeCamera(width, height, sim);
    const ix = (screenX - cam.originX) / cam.scale;
    const iy = (screenY - cam.originY) / cam.scale;
    return isoToGrid(ix, iy, cam.tileW, cam.tileH);
  }

  private toScreen(gx: number, gy: number, gz: number, cam: CameraTransform): Vec2 {
    const iso = gridToIso(gx, gy, cam.tileW, cam.tileH);
    return {
      x: cam.originX + iso.x * cam.scale,
      y: cam.originY + (iso.y - gz * 28) * cam.scale,
    };
  }

  private cachedBgGrad: CanvasGradient | null = null;
  private cachedBgW = 0;
  private cachedBgH = 0;

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    sim: GameSimState,
    timeSec: number,
  ): void {
    const cam = this.computeCamera(width, height, sim);

    // Background ambient dark espresso/walnut vignette framing the isometric diorama
    if (!this.cachedBgGrad || this.cachedBgW !== width || this.cachedBgH !== height) {
      this.cachedBgGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.45,
        Math.min(width, height) * 0.15,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85,
      );
      this.cachedBgGrad.addColorStop(0, '#4a3020');
      this.cachedBgGrad.addColorStop(1, '#23160f');
      this.cachedBgW = width;
      this.cachedBgH = height;
    }
    ctx.fillStyle = this.cachedBgGrad;
    ctx.fillRect(0, 0, width, height);

    // Draw isometric floor slab & walls
    this.drawFloorAndWalls(ctx, cam, timeSec);

    // Draw hotspots floor rings
    for (const h of sim.hotspots) {
      this.drawHotspotFloorCue(ctx, h, cam, timeSec);
    }

    // Player desk highlight cue
    this.drawPlayerDeskFloorRing(ctx, sim, cam, timeSec);

    // Draw NPC vision cones on carpet BEFORE actors
    for (const npc of sim.npcs) {
      if (npc.active && npc.state !== 'distracted') {
        this.drawVisionCone(ctx, npc, cam, timeSec);
      }
    }

    // Collect depth-sorted drawables
    const drawList: Array<{ depth: number; draw: () => void }> = [];

    // Plants along back-left wall
    const plantSpots = [
      { gx: 0.7, gy: 0.8 },
      { gx: 1.4, gy: 0.75 },
      { gx: 0.75, gy: 1.5 },
    ];
    for (const pl of plantSpots) {
      drawList.push({
        depth: pl.gx + pl.gy,
        draw: () => this.drawPlant(ctx, pl.gx, pl.gy, cam, timeSec),
      });
    }

    // Espresso bar & Break Couch on elevated top-right platform
    drawList.push({
      depth: 7.4 + 1.5,
      draw: () => this.drawEspressoBar(ctx, 7.4, 1.5, cam, timeSec),
    });
    drawList.push({
      depth: 9.8 + 1.6,
      draw: () => this.drawBreakCouch(ctx, 9.8, 1.6, cam),
    });

    // Copy Printer
    drawList.push({
      depth: 5.2 + 8.35,
      draw: () => this.drawPrinter(ctx, 5.2, 8.35, cam, timeSec),
    });

    // Reception front counter wall + desks + seated receptionists
    for (const desk of OFFICE_DESKS) {
      drawList.push({
        depth: desk.gx + desk.gy,
        draw: () => this.drawDeskUnit(ctx, desk, sim, cam, timeSec),
      });
    }

    // Player (if walking or standing at hotspot, or seated at desk)
    drawList.push({
      depth: sim.player.gx + sim.player.gy + 0.08,
      draw: () => this.drawPlayer(ctx, sim, cam, timeSec),
    });

    // Active NPCs
    for (const npc of sim.npcs) {
      if (!npc.active) continue;
      drawList.push({
        depth: npc.gx + npc.gy + 0.08,
        draw: () => this.drawNpc(ctx, npc, cam, timeSec),
      });
    }

    drawList.sort((a, b) => a.depth - b.depth);
    for (const item of drawList) {
      item.draw();
    }

    // Hotspot labels drawn above furniture
    for (const h of sim.hotspots) {
      this.drawHotspotLabel(ctx, h, cam);
    }

    // Particles
    this.drawParticles(ctx, cam);

    // Floating combat/score/status texts
    for (const ft of sim.floatingTexts) {
      const pos = this.toScreen(ft.gx, ft.gy, ft.gz, cam);
      const alpha = Math.min(1, ft.life / (ft.maxLife * 0.4));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${Math.round(14 * cam.scale)}px "Bricolage Grotesque", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4 * cam.scale;
      ctx.strokeStyle = '#1f1712';
      ctx.strokeText(ft.text, pos.x, pos.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, pos.x, pos.y);
      ctx.restore();
    }

    // Screen-edge red/amber danger vignette when suspicion is high or mood < 25
    if (sim.phase === 'playing') {
      if (sim.player.suspicion > 30) {
        const intensity = ((sim.player.suspicion - 30) / 70) * 0.35;
        this.drawEdgeVignette(ctx, width, height, `rgba(220, 38, 38, ${intensity.toFixed(3)})`);
      } else if (sim.player.mood < 25) {
        const pulse = 0.5 + 0.5 * Math.sin(timeSec * 5);
        const intensity = (0.12 + pulse * 0.12) * ((25 - sim.player.mood) / 25);
        this.drawEdgeVignette(ctx, width, height, `rgba(245, 158, 11, ${intensity.toFixed(3)})`);
      }
      if (sim.hitFlashTimer > 0) {
        ctx.fillStyle = `rgba(239, 68, 68, ${(sim.hitFlashTimer * 1.2).toFixed(2)})`;
        ctx.fillRect(0, 0, width, height);
      }
    }
  }

  private drawEdgeVignette(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    color: string,
  ): void {
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.32,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.75,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  private drawFloorAndWalls(
    ctx: CanvasRenderingContext2D,
    cam: CameraTransform,
    timeSec: number,
  ): void {
    const p0 = this.toScreen(0, 0, 0, cam);
    const p1 = this.toScreen(GRID_COLS, 0, 0, cam);
    const p2 = this.toScreen(GRID_COLS, GRID_ROWS, 0, cam);
    const p3 = this.toScreen(0, GRID_ROWS, 0, cam);

    // Thick diorama base edge
    const depthPx = 18 * cam.scale;
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p2.x, p2.y + depthPx);
    ctx.lineTo(p3.x, p3.y + depthPx);
    ctx.closePath();
    ctx.fillStyle = '#5c3c24';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p1.x, p1.y + depthPx);
    ctx.lineTo(p2.x, p2.y + depthPx);
    ctx.closePath();
    ctx.fillStyle = '#472d1b';
    ctx.fill();

    // Main warm office carpet (matches screenshot dotted tan/brown)
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fillStyle = '#92633e';
    ctx.fill();
    ctx.lineWidth = 2 * cam.scale;
    ctx.strokeStyle = '#6d472b';
    ctx.stroke();

    // Subtle carpet dot/grid motif (batched for zero overhead)
    ctx.fillStyle = 'rgba(72, 43, 22, 0.24)';
    const dotSize = 3.2 * cam.scale;
    const halfDot = dotSize * 0.5;
    for (let gx = 0.5; gx < GRID_COLS; gx += 1) {
      for (let gy = 0.5; gy < GRID_ROWS; gy += 1) {
        const pt = this.toScreen(gx, gy, 0, cam);
        ctx.fillRect(pt.x - halfDot, pt.y - halfDot, dotSize, dotSize);
      }
    }

    // Bottom-left tiled hallway/reception zone (matches screenshot gray tiles)
    const t0 = this.toScreen(0, 7.1, 0, cam);
    const t1 = this.toScreen(4.4, 7.1, 0, cam);
    const t2 = this.toScreen(4.4, GRID_ROWS, 0, cam);
    const t3 = this.toScreen(0, GRID_ROWS, 0, cam);
    ctx.beginPath();
    ctx.moveTo(t0.x, t0.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t3.x, t3.y);
    ctx.closePath();
    ctx.fillStyle = '#bdb8af';
    ctx.fill();

    // Subtle tile lines
    ctx.strokeStyle = 'rgba(80, 75, 68, 0.22)';
    ctx.lineWidth = 1 * cam.scale;
    for (let x = 1; x <= 4; x++) {
      const a = this.toScreen(x, 7.1, 0, cam);
      const b = this.toScreen(x, GRID_ROWS, 0, cam);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let y = 8; y < GRID_ROWS; y++) {
      const a = this.toScreen(0, y, 0, cam);
      const b = this.toScreen(4.4, y, 0, cam);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Top-right elevated break deck (matches screenshot wood-trimmed upper ledge)
    const e0 = this.toScreen(6.2, 0.2, 0.14, cam);
    const e1 = this.toScreen(11.6, 0.2, 0.14, cam);
    const e2 = this.toScreen(11.6, 3.0, 0.14, cam);
    const e3 = this.toScreen(6.2, 3.0, 0.14, cam);
    const e2b = this.toScreen(11.6, 3.0, 0, cam);
    const e3b = this.toScreen(6.2, 3.0, 0, cam);

    // Front wood step
    ctx.beginPath();
    ctx.moveTo(e3.x, e3.y);
    ctx.lineTo(e2.x, e2.y);
    ctx.lineTo(e2b.x, e2b.y);
    ctx.lineTo(e3b.x, e3b.y);
    ctx.closePath();
    ctx.fillStyle = '#6f482b';
    ctx.fill();

    // Platform top
    ctx.beginPath();
    ctx.moveTo(e0.x, e0.y);
    ctx.lineTo(e1.x, e1.y);
    ctx.lineTo(e2.x, e2.y);
    ctx.lineTo(e3.x, e3.y);
    ctx.closePath();
    ctx.fillStyle = '#b48257';
    ctx.fill();
    ctx.strokeStyle = '#734b2c';
    ctx.lineWidth = 2 * cam.scale;
    ctx.stroke();

    // Back-left & back-right low architectural walls
    const wallH = 1.65;
    const wl0 = this.toScreen(0, 0, wallH, cam);
    const wl1 = this.toScreen(GRID_COLS, 0, wallH, cam);
    const wl3 = this.toScreen(0, GRID_ROWS, wallH, cam);

    // Back-left wall
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(wl3.x, wl3.y);
    ctx.lineTo(wl0.x, wl0.y);
    ctx.closePath();
    ctx.fillStyle = '#efe6d8';
    ctx.fill();
    ctx.strokeStyle = '#c9b79f';
    ctx.stroke();

    // Back-right wall
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(wl1.x, wl1.y);
    ctx.lineTo(wl0.x, wl0.y);
    ctx.closePath();
    ctx.fillStyle = '#e5d8c5';
    ctx.fill();
    ctx.stroke();

    // Boss Executive Door on back-right wall (gx: 5.7..6.7)
    const dA = this.toScreen(5.7, 0.02, 0, cam);
    const dB = this.toScreen(6.7, 0.02, 0, cam);
    const dC = this.toScreen(6.7, 0.02, 1.32, cam);
    const dD = this.toScreen(5.7, 0.02, 1.32, cam);
    ctx.beginPath();
    ctx.moveTo(dA.x, dA.y);
    ctx.lineTo(dB.x, dB.y);
    ctx.lineTo(dC.x, dC.y);
    ctx.lineTo(dD.x, dD.y);
    ctx.closePath();
    ctx.fillStyle = '#5b3822';
    ctx.fill();
    ctx.strokeStyle = '#3b2213';
    ctx.lineWidth = 2 * cam.scale;
    ctx.stroke();

    // Plaque on Boss Door
    const plaque = this.toScreen(6.2, 0.04, 0.92, cam);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(plaque.x - 10 * cam.scale, plaque.y - 4 * cam.scale, 20 * cam.scale, 7 * cam.scale);

    // Subtle sunlit window glow on back-left wall
    const wA = this.toScreen(0.03, 3.2, 0.45, cam);
    const wB = this.toScreen(0.03, 5.8, 0.45, cam);
    const wC = this.toScreen(0.03, 5.8, 1.35, cam);
    const wD = this.toScreen(0.03, 3.2, 1.35, cam);
    ctx.beginPath();
    ctx.moveTo(wA.x, wA.y);
    ctx.lineTo(wB.x, wB.y);
    ctx.lineTo(wC.x, wC.y);
    ctx.lineTo(wD.x, wD.y);
    ctx.closePath();
    const skyPulse = 0.85 + 0.15 * Math.sin(timeSec * 0.5);
    ctx.fillStyle = `rgba(186, 230, 253, ${skyPulse})`;
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2 * cam.scale;
    ctx.stroke();
  }

  private drawIsoBox(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    w: number,
    d: number,
    h: number,
    baseZ: number,
    topColor: string,
    leftColor: string,
    rightColor: string,
    cam: CameraTransform,
    strokeColor = 'rgba(31, 23, 18, 0.35)',
  ): void {
    const hw = w * 0.5;
    const hd = d * 0.5;
    const t0 = this.toScreen(gx - hw, gy - hd, baseZ + h, cam);
    const t1 = this.toScreen(gx + hw, gy - hd, baseZ + h, cam);
    const t2 = this.toScreen(gx + hw, gy + hd, baseZ + h, cam);
    const t3 = this.toScreen(gx - hw, gy + hd, baseZ + h, cam);

    const b1 = this.toScreen(gx + hw, gy - hd, baseZ, cam);
    const b2 = this.toScreen(gx + hw, gy + hd, baseZ, cam);
    const b3 = this.toScreen(gx - hw, gy + hd, baseZ, cam);

    // Left visible face (gy + hd)
    ctx.beginPath();
    ctx.moveTo(t3.x, t3.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.lineTo(b3.x, b3.y);
    ctx.closePath();
    ctx.fillStyle = leftColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.2 * cam.scale;
    ctx.stroke();

    // Right visible face (gx + hw)
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.closePath();
    ctx.fillStyle = rightColor;
    ctx.fill();
    ctx.stroke();

    // Top face
    ctx.beginPath();
    ctx.moveTo(t0.x, t0.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.lineTo(t3.x, t3.y);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();
    ctx.stroke();
  }

  private drawDeskUnit(
    ctx: CanvasRenderingContext2D,
    desk: DeskProp,
    sim: GameSimState,
    cam: CameraTransform,
    timeSec: number,
  ): void {
    const isReception = desk.id.startsWith('rec');
    if (isReception) {
      this.drawIsoBox(
        ctx,
        desk.gx,
        desk.gy,
        1.15,
        0.82,
        0.58,
        0,
        '#f8fafc',
        '#e2e8f0',
        '#cbd5e1',
        cam,
      );
      // Monitor on reception desk
      this.drawIsoBox(ctx, desk.gx, desk.gy - 0.1, 0.36, 0.18, 0.34, 0.58, '#475569', '#334155', '#1e293b', cam);
      if (desk.occupantName) {
        this.drawHumanFigure(
          ctx,
          desk.gx,
          desk.gy + 0.32,
          0,
          Math.PI * 1.5,
          desk.shirtColor || '#475569',
          desk.hairColor || '#3b2416',
          '#f2c4a2',
          'work',
          timeSec * 3,
          0,
          cam,
          false,
          false,
        );
      }
      return;
    }

    const drawOccupant = () => {
      if (!desk.isPlayerDesk && desk.occupantName) {
        const seatOffsetX = desk.facing === 'se' ? -0.52 : 0.56;
        this.drawHumanFigure(
          ctx,
          desk.gx + seatOffsetX,
          desk.gy,
          0.04,
          desk.facing === 'se' ? 0 : Math.PI,
          desk.shirtColor || '#64748b',
          desk.hairColor || '#292524',
          '#f4c7a5',
          'work',
          timeSec * 3.5 + desk.gx,
          0,
          cam,
          false,
          Boolean(desk.hasHardHat),
        );
      }
    };

    if (desk.facing === 'se') {
      drawOccupant();
    }

    // Oak desk
    this.drawIsoBox(ctx, desk.gx, desk.gy, 0.9, 1.24, 0.5, 0, '#dfbe95', '#b99162', '#9b7549', cam);

    // Green desk mat
    this.drawIsoBox(ctx, desk.gx, desk.gy, 0.52, 0.74, 0.03, 0.5, '#228b5a', '#166534', '#14532d', cam);

    // Monitor (player monitor turns colorful when gaming/slacking!)
    let screenColor = '#60a5fa';
    if (desk.isPlayerDesk && sim.phase === 'playing') {
      if (sim.player.activity === 'game') screenColor = '#a855f7';
      else if (sim.player.activity === 'phone') screenColor = '#38bdf8';
      else if (sim.player.activity === 'nap') screenColor = '#1e293b';
      else if (sim.player.activity === 'work') screenColor = '#34d399';
    }
    this.drawIsoBox(ctx, desk.gx - 0.08, desk.gy, 0.2, 0.48, 0.26, 0.53, '#475569', screenColor, '#1e293b', cam);

    if (desk.facing !== 'se') {
      drawOccupant();
    }
  }

  private drawPlant(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    cam: CameraTransform,
    timeSec: number,
  ): void {
    // Pot
    this.drawIsoBox(ctx, gx, gy, 0.48, 0.48, 0.42, 0, '#d97706', '#b45309', '#92400e', cam);
    const pos = this.toScreen(gx, gy, 0.55, cam);
    const sway = Math.sin(timeSec * 1.8 + gx) * 2.5 * cam.scale;
    const leaves = [
      { dx: -10, dy: -6, r: 10, c: '#15803d' },
      { dx: 10, dy: -4, r: 10, c: '#16a34a' },
      { dx: 0, dy: -14, r: 12, c: '#22c55e' },
      { dx: -5, dy: 2, r: 8, c: '#4ade80' },
    ];
    for (const lf of leaves) {
      ctx.beginPath();
      ctx.arc(pos.x + lf.dx * cam.scale + sway, pos.y + lf.dy * cam.scale, lf.r * cam.scale, 0, Math.PI * 2);
      ctx.fillStyle = lf.c;
      ctx.fill();
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.2 * cam.scale;
      ctx.stroke();
    }
  }

  private drawEspressoBar(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    cam: CameraTransform,
    timeSec: number,
  ): void {
    this.drawIsoBox(ctx, gx, gy, 1.0, 0.72, 0.6, 0.14, '#e7d5be', '#8c6239', '#6d4a29', cam);
    // Coffee machine
    this.drawIsoBox(ctx, gx, gy, 0.42, 0.36, 0.44, 0.74, '#475569', '#334155', '#1e293b', cam);
    const led = this.toScreen(gx + 0.12, gy + 0.18, 0.98, cam);
    const glow = 0.6 + 0.4 * Math.sin(timeSec * 4);
    ctx.beginPath();
    ctx.arc(led.x, led.y, 3.2 * cam.scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251, 191, 36, ${glow})`;
    ctx.fill();
  }

  private drawBreakCouch(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    cam: CameraTransform,
  ): void {
    this.drawIsoBox(ctx, gx, gy, 1.5, 0.85, 0.34, 0.14, '#f1f5f9', '#cbd5e1', '#94a3b8', cam);
    // Cozy amber pillow
    this.drawIsoBox(ctx, gx + 0.48, gy, 0.34, 0.58, 0.18, 0.48, '#fbbf24', '#d97706', '#b45309', cam);
  }

  private drawPrinter(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    cam: CameraTransform,
    timeSec: number,
  ): void {
    this.drawIsoBox(ctx, gx, gy, 0.82, 0.72, 0.56, 0, '#e2e8f0', '#94a3b8', '#64748b', cam);
    this.drawIsoBox(ctx, gx, gy, 0.5, 0.4, 0.12, 0.56, '#ffffff', '#cbd5e1', '#94a3b8', cam);
    const led = this.toScreen(gx + 0.35, gy + 0.32, 0.5, cam);
    ctx.beginPath();
    ctx.arc(led.x, led.y, 3 * cam.scale, 0, Math.PI * 2);
    ctx.fillStyle = Math.sin(timeSec * 6) > 0 ? '#38bdf8' : '#0284c7';
    ctx.fill();
  }

  private drawHotspotFloorCue(
    ctx: CanvasRenderingContext2D,
    h: Hotspot,
    cam: CameraTransform,
    timeSec: number,
  ): void {
    const pos = this.toScreen(h.gx, h.gy, 0.02, cam);
    const pulse = 1 + 0.06 * Math.sin(timeSec * 3.2);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, 26 * cam.scale * pulse, 14 * cam.scale * pulse, 0, 0, Math.PI * 2);
    ctx.fillStyle = h.cooldown > 0 ? 'rgba(148, 163, 184, 0.18)' : 'rgba(251, 191, 36, 0.24)';
    ctx.fill();
    ctx.lineWidth = 1.6 * cam.scale;
    ctx.strokeStyle = h.cooldown > 0 ? 'rgba(148, 163, 184, 0.45)' : 'rgba(251, 191, 36, 0.8)';
    ctx.stroke();
    ctx.restore();
  }

  private drawHotspotLabel(
    ctx: CanvasRenderingContext2D,
    h: Hotspot,
    cam: CameraTransform,
  ): void {
    const tagPos = this.toScreen(h.gx, h.gy, 1.55, cam);
    ctx.save();
    ctx.font = `700 ${Math.round(10.5 * cam.scale)}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    const text = h.cooldown > 0 ? `${Math.ceil(h.cooldown)}s` : h.label;
    ctx.lineWidth = 3 * cam.scale;
    ctx.strokeStyle = '#1f1712';
    ctx.strokeText(text, tagPos.x, tagPos.y);
    ctx.fillStyle = h.cooldown > 0 ? '#cbd5e1' : '#fef3c7';
    ctx.fillText(text, tagPos.x, tagPos.y);
    ctx.restore();
  }

  private drawPlayerDeskFloorRing(
    ctx: CanvasRenderingContext2D,
    sim: GameSimState,
    cam: CameraTransform,
    timeSec: number,
  ): void {
    const pos = this.toScreen(PLAYER_DESK_POS.x, PLAYER_DESK_POS.y, 0.02, cam);
    const pulse = 1 + 0.05 * Math.sin(timeSec * 4);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y, 28 * cam.scale * pulse, 15 * cam.scale * pulse, 0, 0, Math.PI * 2);
    ctx.fillStyle =
      sim.player.activity === 'work'
        ? 'rgba(16, 185, 129, 0.22)'
        : 'rgba(249, 115, 22, 0.22)';
    ctx.fill();
    ctx.lineWidth = 2 * cam.scale;
    ctx.strokeStyle = sim.player.activity === 'work' ? '#34d399' : '#fb923c';
    ctx.stroke();
    ctx.restore();
  }

  private drawVisionCone(
    ctx: CanvasRenderingContext2D,
    npc: NpcState,
    cam: CameraTransform,
    timeSec: number,
  ): void {
    const steps = 12;
    const origin = this.toScreen(npc.gx, npc.gy, 0.04, cam);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    for (let i = 0; i <= steps; i++) {
      const a = npc.dir - npc.visionHalfAngle + (i / steps) * npc.visionHalfAngle * 2;
      const wx = npc.gx + Math.cos(a) * npc.visionRange;
      const wy = npc.gy + Math.sin(a) * npc.visionRange;
      const pt = this.toScreen(wx, wy, 0.04, cam);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();

    const alert = npc.alertLevel;
    const flash = alert > 0.2 ? 0.14 + 0.1 * Math.sin(timeSec * 14) : 0;
    if (npc.role === 'boss') {
      ctx.fillStyle = `rgba(239, 68, 68, ${(0.2 + alert * 0.25 + flash).toFixed(2)})`;
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.65)';
    } else if (npc.role === 'security') {
      ctx.fillStyle = `rgba(250, 204, 21, ${(0.18 + alert * 0.25 + flash).toFixed(2)})`;
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.6)';
    } else {
      ctx.fillStyle = `rgba(251, 146, 60, ${(0.15 + alert * 0.26 + flash).toFixed(2)})`;
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.5)';
    }
    ctx.fill();
    ctx.lineWidth = 1.4 * cam.scale;
    ctx.stroke();
    ctx.restore();
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    sim: GameSimState,
    cam: CameraTransform,
    timeSec: number,
  ): void {
    const p = sim.player;
    this.drawHumanFigure(
      ctx,
      p.gx,
      p.gy,
      0,
      p.dir,
      '#f97316',
      '#2c1810',
      '#f6c8a8',
      p.targetPos ? 'walk' : p.activity,
      p.targetPos ? p.walkPhase : p.actionPhase,
      p.suspicion,
      cam,
      true,
      false,
      p.bubbleText,
      timeSec,
    );

    // Overhead suspicion bar if > 4%
    if (p.suspicion > 4) {
      const barPos = this.toScreen(p.gx, p.gy, 1.95, cam);
      const w = 44 * cam.scale;
      const h = 7 * cam.scale;
      ctx.save();
      ctx.fillStyle = '#1f1712';
      ctx.beginPath();
      ctx.roundRect(barPos.x - w * 0.5 - 2, barPos.y - 2, w + 4, h + 4, 4 * cam.scale);
      ctx.fill();
      ctx.fillStyle = p.suspicion > 65 ? '#ef4444' : '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(barPos.x - w * 0.5, barPos.y, w * (p.suspicion / 100), h, 3 * cam.scale);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawNpc(
    ctx: CanvasRenderingContext2D,
    npc: NpcState,
    cam: CameraTransform,
    timeSec: number,
  ): void {
    this.drawHumanFigure(
      ctx,
      npc.gx,
      npc.gy,
      0,
      npc.dir,
      npc.shirtColor,
      npc.hairColor,
      npc.skinColor,
      npc.pauseTimer > 0 && npc.state !== 'distracted' ? 'idle' : 'walk',
      npc.walkPhase,
      npc.alertLevel * 100,
      cam,
      false,
      false,
      npc.bubbleText,
      timeSec,
      npc.role,
    );
  }

  private drawHumanFigure(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    gz: number,
    dir: number,
    shirtColor: string,
    hairColor: string,
    skinColor: string,
    pose: string,
    animPhase: number,
    alertPct: number,
    cam: CameraTransform,
    isPlayer: boolean,
    hasHardHat: boolean,
    bubbleText?: string | null,
    timeSec = 0,
    npcRole?: NpcState['role'],
  ): void {
    const pos = this.toScreen(gx, gy, gz, cam);
    const s = cam.scale;
    const isWalking = pose === 'walk';
    const bob = isWalking ? Math.abs(Math.sin(animPhase)) * 3.5 * s : pose === 'work' ? Math.sin(animPhase * 2) * 1.2 * s : 0;
    const facingLeft = Math.cos(dir - Math.PI * 0.25) < 0;
    const flip = facingLeft ? -1 : 1;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Floor shadow
    ctx.beginPath();
    ctx.ellipse(0, 0, 12 * s, 6.5 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = isPlayer ? 'rgba(249, 115, 22, 0.35)' : 'rgba(15, 10, 8, 0.3)';
    ctx.fill();

    // Rolling office chair behind seated worker
    if (pose === 'work' || pose === 'phone' || pose === 'game' || pose === 'snack' || pose === 'nap') {
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.4 * s;
      ctx.beginPath();
      ctx.roundRect(-9 * s, -22 * s, 18 * s, 16 * s, 5 * s);
      ctx.fill();
      ctx.stroke();
    }

    // Legs / trousers
    const legSwing = isWalking ? Math.sin(animPhase) * 4.5 * s : 0;
    ctx.lineCap = 'round';
    ctx.lineWidth = 4.6 * s;
    ctx.strokeStyle = npcRole === 'boss' ? '#09090b' : '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-3.5 * s, -12 * s);
    ctx.lineTo(-3.5 * s + legSwing, -2 * s);
    ctx.moveTo(3.5 * s, -12 * s);
    ctx.lineTo(3.5 * s - legSwing, -2 * s);
    ctx.stroke();

    // Torso (smooth rounded jacket/shirt)
    ctx.save();
    ctx.translate(0, -bob);
    ctx.beginPath();
    ctx.roundRect(-8.5 * s, -28 * s, 17 * s, 17 * s, 6 * s);
    ctx.fillStyle = shirtColor;
    ctx.fill();
    ctx.strokeStyle = '#1f1712';
    ctx.lineWidth = 1.6 * s;
    ctx.stroke();

    // Role accessories (Tie for Boss, Badge for Security, Clipboard for Manager)
    if (npcRole === 'boss') {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(0, -26 * s);
      ctx.lineTo(2.4 * s, -17 * s);
      ctx.lineTo(0, -14 * s);
      ctx.lineTo(-2.4 * s, -17 * s);
      ctx.closePath();
      ctx.fill();
    } else if (npcRole === 'security') {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(4 * s * flip, -22 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Head
    const headY = pose === 'nap' ? -30 * s : -36 * s;
    const headX = pose === 'nap' ? 3 * s * flip : 0;
    ctx.beginPath();
    ctx.arc(headX, headY, 9.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = skinColor;
    ctx.fill();
    ctx.strokeStyle = '#1f1712';
    ctx.lineWidth = 1.6 * s;
    ctx.stroke();

    // Hair / Hat
    if (hasHardHat) {
      ctx.beginPath();
      ctx.arc(headX, headY - 2 * s, 10.2 * s, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = '#facc15';
      ctx.fill();
      ctx.stroke();
    } else if (npcRole === 'security') {
      // Peaked security cap
      ctx.beginPath();
      ctx.arc(headX, headY - 2.5 * s, 10 * s, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = '#1e3a8a';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(headX - 8 * s, headY - 3 * s, 16 * s, 2.5 * s);
    } else {
      ctx.beginPath();
      ctx.arc(headX, headY - 2.2 * s, 9.8 * s, Math.PI * 0.92, Math.PI * 2.08);
      ctx.fillStyle = hairColor;
      ctx.fill();
    }

    // Eyes (blinking + closed during nap)
    const eyeOffsetX = 2.6 * s * flip;
    const blink = Math.sin(timeSec * 1.9 + gx * 3) > 0.96;
    if (pose === 'nap' || blink) {
      ctx.strokeStyle = '#1f1712';
      ctx.lineWidth = 1.4 * s;
      ctx.beginPath();
      ctx.moveTo(headX + eyeOffsetX - 3.5 * s, headY + 1 * s);
      ctx.lineTo(headX + eyeOffsetX - 1 * s, headY + 1 * s);
      ctx.moveTo(headX + eyeOffsetX + 1.5 * s, headY + 1 * s);
      ctx.lineTo(headX + eyeOffsetX + 4 * s, headY + 1 * s);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1f1712';
      ctx.beginPath();
      ctx.arc(headX + eyeOffsetX - 2.4 * s, headY + 0.5 * s, 1.3 * s, 0, Math.PI * 2);
      ctx.arc(headX + eyeOffsetX + 2.4 * s, headY + 0.5 * s, 1.3 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Activity props in hands!
    if (pose === 'phone') {
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.roundRect(6 * s * flip - 3 * s, -26 * s, 6 * s, 9 * s, 1.5 * s);
      ctx.fill();
      ctx.stroke();
    } else if (pose === 'game') {
      ctx.fillStyle = '#a855f7';
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.roundRect(5 * s * flip - 5 * s, -24 * s, 10 * s, 6 * s, 2 * s);
      ctx.fill();
      ctx.stroke();
    } else if (pose === 'snack') {
      // Pink-frosted donut!
      ctx.beginPath();
      ctx.arc(7 * s * flip, -25 * s, 4 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#f472b6';
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.stroke();
    } else if (pose === 'coffee') {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#78350f';
      ctx.beginPath();
      ctx.roundRect(6 * s * flip - 2.5 * s, -24 * s, 5 * s, 6 * s, 1 * s);
      ctx.fill();
      ctx.stroke();
    } else if (npcRole === 'manager') {
      // Clipboard
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.roundRect(6 * s * flip - 3 * s, -22 * s, 6 * s, 8 * s, 1 * s);
      ctx.fill();
    } else if (npcRole === 'security') {
      // Flashlight
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(8 * s * flip, -20 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player crown/marker arrow so you never lose yourself
    if (isPlayer) {
      const bounce = Math.sin(timeSec * 4.5) * 2.5 * s;
      ctx.beginPath();
      ctx.moveTo(0, -49 * s + bounce);
      ctx.lineTo(-4.5 * s, -55 * s + bounce);
      ctx.lineTo(4.5 * s, -55 * s + bounce);
      ctx.closePath();
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#1f1712';
      ctx.lineWidth = 1.3 * s;
      ctx.stroke();
    }

    // Alert "!" or speech bubble
    if (alertPct > 25 && !isPlayer) {
      ctx.font = `800 ${Math.round(15 * s)}px "Bricolage Grotesque", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3 * s;
      ctx.strokeStyle = '#1f1712';
      ctx.strokeText('!', 0, -50 * s);
      ctx.fillStyle = '#ef4444';
      ctx.fillText('!', 0, -50 * s);
    } else if (bubbleText) {
      ctx.font = `600 ${Math.round(10.5 * s)}px "Plus Jakarta Sans", sans-serif`;
      const tw = ctx.measureText(bubbleText).width + 12 * s;
      const bh = 18 * s;
      const by = -66 * s;
      ctx.fillStyle = '#fffbeb';
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 1.4 * s;
      ctx.beginPath();
      ctx.roundRect(-tw * 0.5, by, tw, bh, 7 * s);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1f1712';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bubbleText, 0, by + bh * 0.5);
    }

    ctx.restore();
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, cam: CameraTransform): void {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      const pos = this.toScreen(p.gx, p.gy, p.gz, cam);
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.kind === 'zzz') {
        ctx.font = `800 ${Math.round(p.size * cam.scale)}px "Bricolage Grotesque", sans-serif`;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2 * cam.scale;
        ctx.strokeText('Z', pos.x, pos.y);
        ctx.fillText('Z', pos.x, pos.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size * 0.5 * cam.scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
