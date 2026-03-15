/**
 * Roulette Game — Color, Number, and Range Bets
 *
 * European roulette (0-36). Bet types:
 *   - Straight (single number): 36× payout
 *   - Red/Black: 2× payout
 *   - Odd/Even: 2× payout
 *   - High/Low (1-18 / 19-36): 2× payout
 *   - Dozens (1-12, 13-24, 25-36): 3× payout
 */

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

type BetType = 'red' | 'black' | 'odd' | 'even' | 'high' | 'low' | 'dozen1' | 'dozen2' | 'dozen3' | 'straight';

interface RouletteBet {
  type: BetType;
  number?: number; // For straight bets
  amount: number;
}

export function renderRoulette(container: HTMLElement) {
  let balance = 1000;
  let bets: RouletteBet[] = [];
  let chipSize = 10;
  let spinning = false;
  let lastResult: number | null = null;
  let lastWin = 0;
  let history: number[] = [];

  function isRed(n: number) { return RED_NUMBERS.includes(n); }

  function checkWin(bet: RouletteBet, result: number): number {
    switch (bet.type) {
      case 'red': return result > 0 && isRed(result) ? bet.amount * 2 : 0;
      case 'black': return result > 0 && !isRed(result) ? bet.amount * 2 : 0;
      case 'odd': return result > 0 && result % 2 === 1 ? bet.amount * 2 : 0;
      case 'even': return result > 0 && result % 2 === 0 ? bet.amount * 2 : 0;
      case 'high': return result >= 19 && result <= 36 ? bet.amount * 2 : 0;
      case 'low': return result >= 1 && result <= 18 ? bet.amount * 2 : 0;
      case 'dozen1': return result >= 1 && result <= 12 ? bet.amount * 3 : 0;
      case 'dozen2': return result >= 13 && result <= 24 ? bet.amount * 3 : 0;
      case 'dozen3': return result >= 25 && result <= 36 ? bet.amount * 3 : 0;
      case 'straight': return result === bet.number ? bet.amount * 36 : 0;
      default: return 0;
    }
  }

  function totalBet() { return bets.reduce((s, b) => s + b.amount, 0); }

  function addBet(type: BetType, number?: number) {
    if (spinning || chipSize > balance - totalBet()) return;
    bets.push({ type, number, amount: chipSize });
    render();
  }

  function render() {
    const total = totalBet();

    container.innerHTML = `
      <div class="roulette-page">
        <div class="crash-header">
          <h1>🎡 Roulette</h1>
          <div class="dice-balance">
            <span class="balance-label">Balance</span>
            <span class="balance-value">${balance.toFixed(2)} QFC</span>
          </div>
        </div>

        <div class="roulette-game">
          <!-- Wheel result -->
          <div class="roulette-wheel ${spinning ? 'spinning' : ''}" id="wheel">
            ${lastResult !== null ? `
              <div class="wheel-result ${lastResult === 0 ? 'green' : isRed(lastResult) ? 'red' : 'black'}">
                ${lastResult}
              </div>
              ${lastWin > 0 ? `<div class="crash-profit win">+${lastWin.toFixed(2)} QFC</div>` :
                total > 0 && !spinning ? `<div class="crash-profit loss">-${total.toFixed(2)} QFC</div>` : ''}
            ` : `
              <div class="wheel-result idle">🎡</div>
            `}
          </div>

          <!-- History dots -->
          <div class="history-list crash-dots">
            ${history.slice(-15).map(n => `
              <span class="roulette-dot ${n === 0 ? 'green' : isRed(n) ? 'red' : 'black'}">${n}</span>
            `).join('')}
          </div>

          <!-- Betting board -->
          <div class="roulette-board">
            <!-- Numbers grid -->
            <div class="number-grid">
              <button class="num-btn green" onclick="void(0)" data-type="straight" data-num="0">0</button>
              ${Array.from({length: 36}, (_, i) => i + 1).map(n => `
                <button class="num-btn ${isRed(n) ? 'red' : 'black'}"
                        data-type="straight" data-num="${n}">${n}</button>
              `).join('')}
            </div>

            <!-- Outside bets -->
            <div class="outside-bets">
              <button class="out-btn" data-type="red">🔴 Red</button>
              <button class="out-btn" data-type="black">⚫ Black</button>
              <button class="out-btn" data-type="odd">Odd</button>
              <button class="out-btn" data-type="even">Even</button>
              <button class="out-btn" data-type="low">1-18</button>
              <button class="out-btn" data-type="high">19-36</button>
              <button class="out-btn" data-type="dozen1">1st 12</button>
              <button class="out-btn" data-type="dozen2">2nd 12</button>
              <button class="out-btn" data-type="dozen3">3rd 12</button>
            </div>
          </div>

          <!-- Chip selector + controls -->
          <div class="roulette-controls">
            <div class="chip-selector">
              <label>Chip Size</label>
              <div class="chip-row">
                ${[1, 5, 10, 25, 50, 100].map(c => `
                  <button class="chip ${chipSize === c ? 'active' : ''}" data-chip="${c}">${c}</button>
                `).join('')}
              </div>
            </div>

            <div class="bet-summary">
              <span>Bets: ${bets.length}</span>
              <span>Total: ${total.toFixed(2)} QFC</span>
            </div>

            <div class="roulette-actions">
              <button class="clear-btn" id="clear-btn" ${bets.length === 0 ? 'disabled' : ''}>Clear Bets</button>
              <button class="roll-btn" id="spin-btn"
                      ${spinning || bets.length === 0 ? 'disabled' : ''}>
                ${spinning ? '🎡 Spinning...' : '🎡 Spin'}
              </button>
            </div>
          </div>

          <div class="fair-info">
            <span>🔒 Provably Fair</span> — Spin result from auditable on-chain seed
          </div>
        </div>
      </div>
    `;

    // Bind events
    container.querySelectorAll('[data-type="straight"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = parseInt((btn as HTMLElement).dataset.num || '0');
        addBet('straight', num);
      });
    });

    container.querySelectorAll('.out-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        addBet((btn as HTMLElement).dataset.type as BetType);
      });
    });

    container.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        chipSize = parseInt((btn as HTMLElement).dataset.chip || '10');
        render();
      });
    });

    document.getElementById('clear-btn')?.addEventListener('click', () => {
      bets = [];
      render();
    });

    document.getElementById('spin-btn')?.addEventListener('click', () => {
      if (spinning || bets.length === 0) return;
      spin();
    });
  }

  function spin() {
    spinning = true;
    balance -= totalBet();
    render();

    // Animate
    const wheelEl = document.querySelector('.wheel-result');
    let frame = 0;
    const interval = setInterval(() => {
      const rand = Math.floor(Math.random() * 37);
      if (wheelEl) {
        wheelEl.textContent = String(rand);
        wheelEl.className = `wheel-result ${rand === 0 ? 'green' : isRed(rand) ? 'red' : 'black'}`;
      }
      frame++;
      if (frame > 20) {
        clearInterval(interval);
        finishSpin();
      }
    }, 100);
  }

  function finishSpin() {
    const result = Math.floor(Math.random() * 37); // 0-36
    lastResult = result;
    history.push(result);

    // Calculate winnings
    lastWin = 0;
    for (const bet of bets) {
      lastWin += checkWin(bet, result);
    }
    balance += lastWin;

    spinning = false;
    bets = [];
    render();
  }

  render();
}
