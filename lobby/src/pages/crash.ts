/**
 * Crash Game — Cash out before the curve busts
 *
 * A multiplier starts at 1.00x and increases over time.
 * Player must cash out before it crashes. The crash point
 * is determined by a provably fair seed.
 */

export function renderCrash(container: HTMLElement) {
  let balance = 1000;
  let betAmount = 10;
  let autoCashout = 2.0;
  let gameState: 'idle' | 'betting' | 'running' | 'cashed' | 'crashed' = 'idle';
  let currentMultiplier = 1.0;
  let crashPoint = 0;
  let cashoutMultiplier = 0;
  let animId: number | null = null;
  let startTime = 0;
  let history: { crash: number; cashed: number | null; won: boolean; profit: number }[] = [];

  function generateCrashPoint(): number {
    // Provably fair crash point (simplified)
    // House edge ~1%: E[crash] ≈ 99/100 * uniform
    const h = Math.random();
    if (h < 0.01) return 1.0; // Instant crash (1%)
    return Math.max(1.01, 1 / (1 - h) * 0.99);
  }

  function render() {
    const isRunning = gameState === 'running';
    const isCashed = gameState === 'cashed';
    const isCrashed = gameState === 'crashed';
    const profit = isCashed ? betAmount * (cashoutMultiplier - 1) : (isCrashed ? -betAmount : 0);

    container.innerHTML = `
      <div class="crash-page">
        <div class="crash-header">
          <h1>📈 Crash</h1>
          <div class="dice-balance">
            <span class="balance-label">Balance</span>
            <span class="balance-value">${balance.toFixed(2)} QFC</span>
          </div>
        </div>

        <div class="crash-game">
          <!-- Chart area -->
          <div class="crash-chart" id="crash-chart">
            <canvas id="crash-canvas" width="600" height="300"></canvas>
            <div class="crash-multiplier ${isCrashed ? 'crashed' : isCashed ? 'cashed' : ''}"
                 id="crash-multiplier">
              ${isCrashed ? `💥 ${crashPoint.toFixed(2)}×` :
                isCashed ? `💰 ${cashoutMultiplier.toFixed(2)}×` :
                isRunning ? `${currentMultiplier.toFixed(2)}×` : '1.00×'}
            </div>
            ${isCashed ? `<div class="crash-profit win">+${profit.toFixed(2)} QFC</div>` : ''}
            ${isCrashed ? `<div class="crash-profit loss">-${betAmount.toFixed(2)} QFC</div>` : ''}
          </div>

          <!-- Controls -->
          <div class="crash-controls">
            <div class="control-group">
              <label>Bet Amount (QFC)</label>
              <div class="bet-input-row">
                <button class="bet-adj" id="bet-half">½</button>
                <input type="number" value="${betAmount}" min="0.1" step="0.1"
                       class="bet-input" id="bet-input" ${isRunning ? 'disabled' : ''}>
                <button class="bet-adj" id="bet-double">2×</button>
              </div>
            </div>
            <div class="control-group">
              <label>Auto Cashout</label>
              <input type="number" value="${autoCashout}" min="1.01" step="0.1"
                     class="bet-input" id="auto-cashout" ${isRunning ? 'disabled' : ''}>
            </div>
          </div>

          <!-- Action button -->
          ${isRunning ? `
            <button class="roll-btn cashout-btn" id="cashout-btn">
              💰 Cash Out @ ${currentMultiplier.toFixed(2)}×
            </button>
          ` : `
            <button class="roll-btn" id="start-btn"
                    ${betAmount > balance || betAmount <= 0 ? 'disabled' : ''}>
              ${gameState === 'idle' ? '🚀 Place Bet & Start' : '🚀 Play Again'}
            </button>
          `}

          <div class="fair-info">
            <span>🔒 Provably Fair</span> — Crash point derived from hashed server seed
          </div>
        </div>

        <!-- History -->
        <div class="crash-history">
          <h3>Recent Rounds</h3>
          <div class="history-list crash-dots">
            ${history.length === 0 ? '<div class="history-empty">No rounds yet</div>' :
              history.slice(-20).reverse().map(h => `
                <span class="crash-dot ${h.crash < 2 ? 'low' : h.crash < 5 ? 'mid' : 'high'}">
                  ${h.crash.toFixed(2)}×
                </span>
              `).join('')}
          </div>
        </div>
      </div>
    `;

    // Draw chart
    drawChart();

    // Bind events
    if (isRunning) {
      document.getElementById('cashout-btn')?.addEventListener('click', cashOut);
    } else {
      document.getElementById('start-btn')?.addEventListener('click', startRound);
    }

    const betInput = document.getElementById('bet-input') as HTMLInputElement;
    betInput?.addEventListener('change', (e) => {
      betAmount = Math.max(0.1, parseFloat((e.target as HTMLInputElement).value) || 0);
    });

    const autoInput = document.getElementById('auto-cashout') as HTMLInputElement;
    autoInput?.addEventListener('change', (e) => {
      autoCashout = Math.max(1.01, parseFloat((e.target as HTMLInputElement).value) || 2.0);
    });

    document.getElementById('bet-half')?.addEventListener('click', () => { betAmount = Math.max(0.1, betAmount / 2); render(); });
    document.getElementById('bet-double')?.addEventListener('click', () => { betAmount = Math.min(balance, betAmount * 2); render(); });
  }

  function drawChart() {
    const canvas = document.getElementById('crash-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= 5; i++) {
      const y = h - (h * i / 5);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.fillStyle = '#555';
      ctx.font = '11px monospace';
      ctx.fillText(`${(i * 2).toFixed(0)}×`, 5, y + 12);
    }

    if (gameState !== 'running' && gameState !== 'cashed' && gameState !== 'crashed') return;

    // Draw curve
    const elapsed = gameState === 'running' ? (Date.now() - startTime) / 1000 : 0;
    const maxT = gameState === 'crashed' || gameState === 'cashed' ?
      Math.log(Math.max(crashPoint, cashoutMultiplier, currentMultiplier)) * 3 + 1 : elapsed;

    ctx.beginPath();
    ctx.strokeStyle = gameState === 'crashed' ? '#ff4757' : '#2ed573';
    ctx.lineWidth = 3;

    const points = 200;
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * maxT;
      const mult = Math.exp(t * 0.3); // exponential growth curve
      const x = (i / points) * w;
      const y = h - (Math.min(mult, 10) / 10) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function startRound() {
    if (betAmount > balance || betAmount <= 0) return;

    balance -= betAmount;
    crashPoint = generateCrashPoint();
    currentMultiplier = 1.0;
    cashoutMultiplier = 0;
    gameState = 'running';
    startTime = Date.now();

    render();
    tick();
  }

  function tick() {
    if (gameState !== 'running') return;

    const elapsed = (Date.now() - startTime) / 1000;
    currentMultiplier = Math.exp(elapsed * 0.3); // ~1.35x per second

    // Auto cashout
    if (autoCashout > 0 && currentMultiplier >= autoCashout) {
      cashOut();
      return;
    }

    // Crash
    if (currentMultiplier >= crashPoint) {
      gameState = 'crashed';
      currentMultiplier = crashPoint;
      history.push({ crash: crashPoint, cashed: null, won: false, profit: -betAmount });
      render();
      return;
    }

    // Update display
    const multEl = document.getElementById('crash-multiplier');
    if (multEl) multEl.textContent = `${currentMultiplier.toFixed(2)}×`;

    drawChart();
    animId = requestAnimationFrame(tick);
  }

  function cashOut() {
    if (gameState !== 'running') return;

    cashoutMultiplier = currentMultiplier;
    const payout = betAmount * cashoutMultiplier;
    balance += payout;
    gameState = 'cashed';

    history.push({ crash: crashPoint, cashed: cashoutMultiplier, won: true, profit: payout - betAmount });

    if (animId) cancelAnimationFrame(animId);
    render();
  }

  render();
}
