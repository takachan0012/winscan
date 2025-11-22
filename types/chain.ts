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
  tx_index?: string; // "on" or "off" - indicates if RPC has transaction indexing enabled
}

export interface ChainData {
  chain_name: string;
  chain_id?: string; // Filename without .json for API requests (e.g., "Gitopia" instead of "Gitopia-Mainnet")
  api: ChainEndpoint[];
  rpc: ChainEndpoint[];
  sdk_version: string;
  coin_type: string;
  min_tx_fee: string;
  assets: ChainAsset[];
  addr_prefix: string;
  theme_color: string;
  logo: string;
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
