export interface WalletSession {
  address: string
  connectedAt: string
  network: 'QFC Testnet'
}

const SESSION_KEY = 'qfc_wallet_session'
const QFC_CHAIN_ID = '0x2328' // 9000

export async function connectWallet(): Promise<WalletSession | null> {
  const ethereum = (window as any).ethereum
  if (!ethereum) {
    alert('Please install MetaMask to connect your wallet.')
    return null
  }

  try {
    const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' })
    if (!accounts || accounts.length === 0) return null

    // Switch to QFC Testnet
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: QFC_CHAIN_ID }],
      })
    } catch (switchErr: any) {
      // Chain not added — add it
      if (switchErr.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: QFC_CHAIN_ID,
            chainName: 'QFC Testnet',
            nativeCurrency: { name: 'QFC', symbol: 'QFC', decimals: 18 },
            rpcUrls: ['https://rpc.testnet.qfc.network'],
            blockExplorerUrls: ['https://explorer.testnet.qfc.network'],
          }],
        })
      } else {
        throw switchErr
      }
    }

    const address = accounts[0]
    const session: WalletSession = {
      address,
      connectedAt: new Date().toISOString(),
      network: 'QFC Testnet',
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  } catch (err: any) {
    console.error('Wallet connection failed:', err)
    return null
  }
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

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const RPC_URL = 'https://rpc.testnet.qfc.network'

export async function getBalance(address: string): Promise<string> {
  try {
    const resp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: 1,
      }),
    })
    const data = await resp.json()
    const hex = data.result || '0x0'
    // Convert wei to QFC (18 decimals) without BigInt precision loss
    const wei = BigInt(hex)
    const whole = wei / BigInt(1e18)
    const remainder = wei % BigInt(1e18)
    const decimals = remainder.toString().padStart(18, '0').slice(0, 4)
    return `${whole.toLocaleString()}.${decimals}`
  } catch {
    return '0'
  }
}

export function formatConnectedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Listen for account/chain changes
if ((window as any).ethereum) {
  (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
    if (accounts.length === 0) {
      clearWalletSession()
    } else {
      const session = getWalletSession()
      if (session) {
        session.address = accounts[0]
        localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      }
    }
    window.location.reload()
  })

  ;(window as any).ethereum.on('chainChanged', () => {
    window.location.reload()
  })
}
