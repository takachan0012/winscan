export interface ChainAsset {
  base: string;
  symbol: string;
  display?: string;
  exponent: number | string;
  coingecko_id: string;
  logo: string;
}

export interface ChainEndpoint {
  address: string;
  provider: string;
  tx_index?: string; 
}

export interface ChainData {
  chain_name: string;
  chain_id?: string; 
  api: ChainEndpoint[];
  rpc: ChainEndpoint[];
  evm_rpc?: ChainEndpoint[];
  evm_wss?: ChainEndpoint[];
  sdk_version: string;
  coin_type: string;
  min_tx_fee: string;
  gas_price?: string;
  assets: ChainAsset[];
  addr_prefix: string;
  theme_color: string;
  logo: string;
  website?: string;
  github?: string;
  description?: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
}

export interface BlockData {
  height: number;
  hash: string;
  time: string;
  txs: number;
  proposer: string;
  validator?: {
    moniker: string;
    identity?: string;
    address: string;
  } | null;
}

export interface TransactionData {
  hash: string;
  type: string;
  result: string;
  fee: string;
  height: number;
  time: string;
}

export interface ValidatorData {
  address: string;
  moniker: string;
  votingPower: string;
  commission: string;
  status?: string;
  jailed?: boolean;
  identity?: string;  // Keybase identity (16-char hex)
  delegatorsCount?: number; // Number of delegators
  uptime?: number; // Validator uptime percentage (0-100)
  consensus_pubkey?: any; // Consensus public key for signing info
  votingPowerChange24h?: string; // 24h voting power change (real data from API)
}

export interface ChainStats {
  marketCap: string;
  inflation: string;
  apr: string;
  supply: string;
  communityPool: string;
  avgBlockTime: string;
  activeValidators: number;
  totalValidators: number;
  latestBlock: number;
  bondedTokens: string;
  unbondedTokens: string;
}
