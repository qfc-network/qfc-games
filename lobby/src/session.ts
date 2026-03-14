export interface WalletSession {
  address: string
  connectedAt: string
  network: 'QFC Testnet'
}

const SESSION_KEY = 'qfc_wallet_session'

function randomHex(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

export function createWalletSession(): WalletSession {
  const session: WalletSession = {
    address: `0x${randomHex(8)}...${randomHex(4)}`,
    connectedAt: new Date().toISOString(),
    network: 'QFC Testnet',
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function getWalletSession(): WalletSession | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as WalletSession
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function clearWalletSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function formatConnectedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
