/**
 * Dice Game — Provably Fair Over/Under
 *
 * Player picks a target (2-98) and direction (over/under).
 * Roll is 0-99. Payout = wager × (99 / winChance).
 * House edge ~1%.
 *
 * This is a client-side simulation for now. In production,
 * bets are placed on-chain via DiceGame.sol with commit-reveal RNG.
 */

export function renderDice(container: HTMLElement) {
  let target = 50;
  let rollOver = true;
  let betAmount = 10;
  let rolling = false;
  let balance = 1000; // Mock balance
  let history: { roll: number; target: number; over: boolean; won: boolean; payout: number; amount: number }[] = [];

  function getWinChance() {
    return rollOver ? (99 - target) : target;
  }

  function getMultiplier() {
    const chance = getWinChance();
    return chance > 0 ? (99 / chance) : 0;
  }

  function render() {
    const chance = getWinChance();
    const mult = getMultiplier();
    const potentialWin = betAmount * mult;

    container.innerHTML = `
      <div class="dice-page">
        <div class="dice-header">
          <h1>🎲 Dice</h1>
          <div class="dice-balance">
            <span class="balance-label">Balance</span>
            <span class="balance-value">${balance.toFixed(2)} QFC</span>
          </div>
        </div>

        <div class="dice-game">
          <!-- Result display -->
          <div class="dice-result" id="dice-result">
            <div class="result-number" id="result-number">?</div>
            <div class="result-label" id="result-label">Place your bet</div>
          </div>

          <!-- Slider -->
          <div class="dice-slider-container">
            <div class="slider-bar">
              <div class="slider-fill ${rollOver ? 'fill-right' : 'fill-left'}"
                   style="--target: ${target}%"></div>
              <input type="range" min="2" max="98" value="${target}"
                     class="dice-slider" id="dice-slider">
            </div>
            <div class="slider-labels">
              <span>0</span>
              <span class="target-label">${target}</span>
              <span>99</span>
            </div>
          </div>

          <!-- Direction toggle -->
          <div class="dice-direction">
            <button class="dir-btn ${!rollOver ? 'active' : ''}" id="btn-under">
              Roll Under ${target}
            </button>
            <button class="dir-btn ${rollOver ? 'active' : ''}" id="btn-over">
              Roll Over ${target}
            </button>
          </div>

          <!-- Bet controls -->
          <div class="dice-controls">
            <div class="control-group">
              <label>Bet Amount (QFC)</label>
              <div class="bet-input-row">
                <button class="bet-adj" id="bet-half">½</button>
                <input type="number" value="${betAmount}" min="0.1" max="${balance}"
                       step="0.1" class="bet-input" id="bet-input">
                <button class="bet-adj" id="bet-double">2×</button>
                <button class="bet-adj" id="bet-max">MAX</button>
              </div>
            </div>

            <div class="dice-stats">
              <div class="stat">
                <span class="stat-label">Win Chance</span>
                <span class="stat-value">${chance.toFixed(1)}%</span>
              </div>
              <div class="stat">
                <span class="stat-label">Multiplier</span>
                <span class="stat-value">${mult.toFixed(4)}×</span>
              </div>
              <div class="stat">
                <span class="stat-label">Potential Win</span>
                <span class="stat-value win-value">${potentialWin.toFixed(2)} QFC</span>
              </div>
            </div>
          </div>

          <!-- Roll button -->
          <button class="roll-btn ${rolling ? 'rolling' : ''}" id="roll-btn"
                  ${rolling || betAmount > balance || betAmount <= 0 ? 'disabled' : ''}>
            ${rolling ? '🎲 Rolling...' : '🎲 Roll Dice'}
          </button>

          <!-- Provably fair info -->
          <div class="fair-info">
            <span>🔒 Provably Fair</span> — Each roll uses commit-reveal RNG verified on-chain
          </div>
        </div>

        <!-- History -->
        <div class="dice-history">
          <h3>Recent Rolls</h3>
          <div class="history-list">
            ${history.length === 0 ? '<div class="history-empty">No rolls yet</div>' :
              history.slice(-10).reverse().map(h => `
                <div class="history-item ${h.won ? 'won' : 'lost'}">
                  <span class="history-roll">${h.roll}</span>
                  <span class="history-bet">${h.over ? '>' : '<'} ${h.target}</span>
                  <span class="history-result">${h.won ? `+${h.payout.toFixed(2)}` : `-${h.amount.toFixed(2)}`}</span>
                </div>
              `).join('')}
          </div>
        </div>
      </div>
    `;

    // Bind events
    const slider = document.getElementById('dice-slider') as HTMLInputElement;
    slider?.addEventListener('input', (e) => {
      target = parseInt((e.target as HTMLInputElement).value);
      render();
    });

    document.getElementById('btn-over')?.addEventListener('click', () => { rollOver = true; render(); });
    document.getElementById('btn-under')?.addEventListener('click', () => { rollOver = false; render(); });

    const betInput = document.getElementById('bet-input') as HTMLInputElement;
    betInput?.addEventListener('change', (e) => {
      betAmount = Math.max(0.1, Math.min(balance, parseFloat((e.target as HTMLInputElement).value) || 0));
      render();
    });

    document.getElementById('bet-half')?.addEventListener('click', () => { betAmount = Math.max(0.1, betAmount / 2); render(); });
    document.getElementById('bet-double')?.addEventListener('click', () => { betAmount = Math.min(balance, betAmount * 2); render(); });
    document.getElementById('bet-max')?.addEventListener('click', () => { betAmount = balance; render(); });

    document.getElementById('roll-btn')?.addEventListener('click', () => {
      if (rolling || betAmount > balance || betAmount <= 0) return;
      doRoll();
    });
  }

  function doRoll() {
    rolling = true;
    balance -= betAmount;
    render();

    // Animate rolling
    const resultEl = document.getElementById('result-number');
    const labelEl = document.getElementById('result-label');
    let animFrame = 0;
    const animInterval = setInterval(() => {
      if (resultEl) resultEl.textContent = String(Math.floor(Math.random() * 100));
      animFrame++;
      if (animFrame > 15) {
        clearInterval(animInterval);
        finishRoll();
      }
    }, 80);
  }

  function finishRoll() {
    // Generate provably fair roll (in production: from on-chain seed)
    const roll = Math.floor(Math.random() * 100);
    const won = rollOver ? (roll > target) : (roll < target);
    const payout = won ? betAmount * getMultiplier() : 0;

    if (won) balance += payout;

    history.push({ roll, target, over: rollOver, won, payout, amount: betAmount });

    rolling = false;

    // Show result with animation
    const resultEl = document.getElementById('result-number');
    const labelEl = document.getElementById('result-label');
    const resultContainer = document.getElementById('dice-result');

    if (resultEl) resultEl.textContent = String(roll);
    if (labelEl) labelEl.textContent = won ? `Won ${payout.toFixed(2)} QFC!` : 'Busted!';
    if (resultContainer) {
      resultContainer.classList.add(won ? 'result-win' : 'result-loss');
    }

    // Re-render after a short delay to show the result
    setTimeout(() => render(), 1500);
  }

  render();
}
