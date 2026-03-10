# Chain Integration Plan — 把游戏变成真正的链游

## 验证结果
- ✅ QFC Testnet (chain_id: 9000 / 0x2328) 完全支持 EVM
- ✅ 转账交易成功 (block 12322)
- ✅ 合约部署成功 (block 12325, addr: 0x29ccd25...)
- ✅ Gas price: 1 Gwei, 部署 gas ~70k
- ✅ Wallet A: 25 QFC, 足够部署多个合约

## 每个游戏需要改什么

### 共同模块 (qfc-chain-sdk)
创建共享 SDK，所有游戏复用：

```typescript
// qfc-chain-sdk/
├── wallet.ts      // 钱包连接 (MetaMask / 手动输入私钥)
├── contracts.ts   // 合约交互封装
├── provider.ts    // QFC RPC provider
├── verify.ts      // 签名验证
└── types.ts
```

**功能：**
1. **钱包连接**: MetaMask 风格弹窗，或输入私钥（testnet 用）
2. **签名验证**: 用钱包签名验证玩家身份
3. **链上读写**: 封装合约调用
4. **区块哈希随机**: 用区块哈希做可验证随机数

---

### 🏢 Virtual Office — 链上签到
**合约**: `OfficeRegistry.sol`
```solidity
contract OfficeRegistry {
    event CheckIn(address indexed member, string room, uint256 timestamp);
    event CheckOut(address indexed member, uint256 timestamp);
    event RoomMove(address indexed member, string from, string to);
    event MessageSent(address indexed sender, string room, string text);
    
    mapping(address => string) public currentRoom;
    mapping(address => bool) public isOnline;
    mapping(address => uint256) public totalOnlineTime;
    
    function checkIn(string calldata room) external { ... }
    function checkOut() external { ... }
    function moveRoom(string calldata newRoom) external { ... }
    function sendMessage(string calldata room, string calldata text) external { ... }
}
```
**改动：**
- 签到/签退写链上 → 不可篡改的出勤记录
- 消息哈希上链 → 可验证但不暴露全文
- 在线时长 = 贡献证明的一部分
- 前端加钱包连接按钮

---

### 🃏 AI Cards — 链上卡牌 + 对战结算
**合约**: `QFCCards.sol` (ERC721 + 游戏逻辑)
```solidity
contract QFCCards is ERC721 {
    struct Card {
        string name;
        uint8 element; // 0-4
        uint8 attack;
        uint8 defense;
        uint8 cost;
    }
    
    mapping(uint256 => Card) public cards;
    mapping(address => uint256) public wins;
    mapping(address => uint256) public losses;
    
    event BattleResult(address indexed winner, address indexed loser, uint256 winnerScore);
    
    function mintCard() external returns (uint256) { ... } // random card from block hash
    function recordBattle(address winner, address loser, bytes calldata proof) external { ... }
}
```
**改动：**
- 卡牌 = NFT (ERC721), mint 用区块哈希决定属性
- 对战结果上链 (winner/loser/score)
- 排行榜从合约读取
- 前端: 钱包连接 → mint cards → battle → 结果上链

---

### 🐾 AI Pets — 链上宠物 NFT
**合约**: `QFCPets.sol` (ERC721 + 繁殖)
```solidity
contract QFCPets is ERC721 {
    struct Pet {
        string name;
        uint8 species;   // 0-4
        uint8 element;   // 0-4
        uint8 level;
        uint16 hp; uint8 attack; uint8 defense; uint8 speed; uint8 charm;
        uint8 gen;
        uint256 parent1; uint256 parent2;
        uint256 bornAt;
    }
    
    mapping(uint256 => Pet) public pets;
    
    event PetAdopted(address indexed owner, uint256 tokenId, uint8 species);
    event PetBred(address indexed owner, uint256 childId, uint256 parent1, uint256 parent2);
    event BattleResult(uint256 winner, uint256 loser);
    
    function adopt() external returns (uint256) { ... }
    function breed(uint256 pet1, uint256 pet2) external returns (uint256) { ... }
    function battle(uint256 myPet, uint256 opponent) external { ... }
}
```
**改动：**
- 宠物 = NFT (ERC721), 链上存属性
- 繁殖在链上执行 (基因混合用区块哈希)
- 对战结果上链
- 喂养/聊天保持链下 (太频繁, gas 太高)

---

### 🏰 AI Dungeon — 链上排行榜 + 可验证随机
**合约**: `DungeonLeaderboard.sol`
```solidity
contract DungeonLeaderboard {
    struct Run {
        address player;
        uint256 score;
        uint8 floor;
        uint16 turns;
        uint256 seed;      // block hash used as seed
        uint256 timestamp;
    }
    
    Run[] public leaderboard;
    mapping(address => uint256) public bestScore;
    
    event RunCompleted(address indexed player, uint256 score, uint8 floor);
    
    function submitRun(uint256 score, uint8 floor, uint16 turns, uint256 seed) external { ... }
    function getSeed() external view returns (uint256) { return uint256(blockhash(block.number - 1)); }
}
```
**改动：**
- 地牢种子 = 区块哈希 → 任何人可以重放验证
- 死亡后分数上链 → 不可篡改排行榜
- 前端: 连接钱包 → 获取链上种子 → 开始游戏 → 死亡 → 提交分数

---

## 实施顺序

```
Step 1: qfc-chain-sdk (共享钱包/合约模块)
Step 2: AI Dungeon 链上排行榜 (最简单，只写不读复杂状态)
Step 3: Virtual Office 链上签到
Step 4: AI Cards 链上卡牌 NFT
Step 5: AI Pets 链上宠物 NFT
```

## 合约部署计划
- 全部部署到 QFC Testnet (chain_id: 9000)
- Wallet A (0x5BE3...) 作为部署者
- 使用 ethers.js 直接部署 (不用 Hardhat, 减少依赖)
- 合约源码存在各自 repo 的 `contracts/` 目录
