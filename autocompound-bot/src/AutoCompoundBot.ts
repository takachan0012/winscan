import { SigningStargateClient, StargateClient, GasPrice } from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet, makeCosmoshubPath, OfflineDirectSigner, EncodeObject, AccountData } from '@cosmjs/proto-signing';
import { stringToPath } from '@cosmjs/crypto';
import { toBech32 } from '@cosmjs/encoding';
import { MsgExec } from 'cosmjs-types/cosmos/authz/v1beta1/tx';
import { MsgWithdrawDelegatorReward, MsgWithdrawValidatorCommission } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { MsgDelegate } from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import { MsgVote } from 'cosmjs-types/cosmos/gov/v1beta1/tx';
import { VoteOption } from 'cosmjs-types/cosmos/gov/v1beta1/gov';
import { Registry } from '@cosmjs/proto-signing';
import { defaultRegistryTypes } from '@cosmjs/stargate';
import { ethers } from 'ethers';

// Custom wallet for Ethermint chains that uses ETH address instead of hashed pubkey
class EthermintWallet implements OfflineDirectSigner {
  private wallet: DirectSecp256k1Wallet;
  private ethAddress: string;
  private pubkey: Uint8Array;

  constructor(wallet: DirectSecp256k1Wallet, ethAddress: string, pubkey: Uint8Array) {
    this.wallet = wallet;
    this.ethAddress = ethAddress;
    this.pubkey = pubkey;
  }

  static async fromMnemonic(mnemonic: string, prefix: string): Promise<EthermintWallet> {
    const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
    const ethPath = "m/44'/60'/0'/0/0";
    const ethWallet = hdNode.derivePath(ethPath);
    
    // Get ETH address in bech32 format
    const addressBytes = ethers.utils.arrayify(ethWallet.address);
    const ethAddress = toBech32(prefix, addressBytes);
    
    // Get compressed public key
    const pubkeyHex = ethers.utils.computePublicKey(ethWallet.privateKey, true);
    const pubkey = ethers.utils.arrayify(pubkeyHex);
    
    // Create base wallet for signing
    const privateKeyBytes = ethers.utils.arrayify(ethWallet.privateKey);
    const baseWallet = await DirectSecp256k1Wallet.fromKey(privateKeyBytes, prefix);
    
    return new EthermintWallet(baseWallet, ethAddress, pubkey);
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    // Override to return ETH-derived address instead of hashed pubkey address
    return [{
      address: this.ethAddress,
      pubkey: this.pubkey,
      algo: 'secp256k1' as const
    }];
  }

  async signDirect(signerAddress: string, signDoc: any): Promise<any> {
    // Use the base wallet for signing
    return this.wallet.signDirect(signerAddress, signDoc);
  }
}

interface ChainConfig {
  chainId: string;
  rpc: string;
  rest: string;
  prefix: string;
  denom: string;
  gasPrice: string;
  coinType?: string;
  defaultFrequency?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  voteOption?: 'YES' | 'NO' | 'ABSTAIN' | 'VETO';
  granteeAddress?: string;
}

interface Grant {
  granter: string;
  grantee: string;
  authorization: any;
  expiration: string;
}

interface AutoCompoundTask {
  chainId: string;
  granter: string;
  validator: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  lastRun?: Date;
  hasCommissionGrant?: boolean;
  hasVoteGrant?: boolean;
}

export class AutoCompoundBot {
  private operatorWallet: DirectSecp256k1HdWallet | null = null;
  private operatorAddress: string = '';
  private tasks: Map<string, AutoCompoundTask> = new Map();
  private isRunning: boolean = false;

  constructor(private mnemonic: string) {}

  private async getEthermintAddress(mnemonic: string, prefix: string): Promise<string> {
    // Derive Ethereum address from mnemonic (like Keplr does for EVM chains)
    const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
    const ethPath = "m/44'/60'/0'/0/0"; // Ethereum HD path
    const wallet = hdNode.derivePath(ethPath);
    const ethAddress = wallet.address; // 0x... format
    
    // Convert Ethereum address to bytes (remove 0x prefix)
    const addressBytes = ethers.utils.arrayify(ethAddress);
    
    // Encode with bech32 using chain prefix
    const bech32Address = toBech32(prefix, addressBytes);
    
    return bech32Address;
  }

  private async getEthermintWallet(mnemonic: string, prefix: string): Promise<EthermintWallet> {
    // Use custom EthermintWallet that returns ETH-derived address
    return await EthermintWallet.fromMnemonic(mnemonic, prefix);
  }

  private getMnemonicForChain(chainId: string): string {
    const envKey = `OPERATOR_MNEMONIC_${chainId.replace(/-/g, '_')}`;
    const chainMnemonic = process.env[envKey];
    
    if (chainMnemonic) {
      console.log(`🔑 Using chain-specific mnemonic from ${envKey}`);
      return chainMnemonic;
    }
    
    console.log(`🔑 Using default mnemonic for ${chainId}`);
    return this.mnemonic;
  }

  async initialize() {
    console.log('🤖 Initializing Auto-Compound Bot...');
    
    this.operatorWallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: 'cosmos',
    });
    
    const [firstAccount] = await this.operatorWallet.getAccounts();
    this.operatorAddress = firstAccount.address;
    
    console.log(`✅ Operator Address: ${this.operatorAddress}`);
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Bot is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Auto-Compound Bot started');

    this.scheduleJobs();
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 Auto-Compound Bot stopped');
  }

  private scheduleJobs() {
    setInterval(() => {
      if (this.isRunning) {
        this.processAllTasks();
      }
    }, 10 * 60 * 1000);

    setTimeout(() => {
      if (this.isRunning) {
        this.processAllTasks();
      }
    }, 5000);
  }

  async loadTasksFromChain(chainConfig: ChainConfig) {
    console.log(`📊 Loading tasks from ${chainConfig.chainId}...`);

    try {
      const client = await StargateClient.connect(chainConfig.rpc);
      
      let operatorAddress: string;
      
      // If grantee_address is specified in chain config, use it directly
      if (chainConfig.granteeAddress) {
        operatorAddress = chainConfig.granteeAddress;
        console.log(`🔑 Using grantee address from chain config: ${operatorAddress}`);
      } else {
        // Otherwise generate from mnemonic
        const chainMnemonic = this.getMnemonicForChain(chainConfig.chainId);
        const isEVM = chainConfig.coinType === '60';
        
        if (isEVM) {
          // Use Ethermint address derivation (Keplr-compatible)
          operatorAddress = await this.getEthermintAddress(chainMnemonic, chainConfig.prefix);
          console.log(`🔑 Generated Ethermint address: ${operatorAddress} (EVM)`);
        } else {
          // Standard Cosmos address
          const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
            chainMnemonic,
            { prefix: chainConfig.prefix }
          );
          const [account] = await wallet.getAccounts();
          operatorAddress = account.address;
          console.log(`🔑 Generated operator address: ${operatorAddress} (Cosmos)`);
        }
      }
      
      console.log(`🔍 Querying grants for operator: ${operatorAddress}`);
      console.log(`🌐 REST endpoint: ${chainConfig.rest}`);
      
      const grantsResponse = await fetch(
        `${chainConfig.rest}/cosmos/authz/v1beta1/grants/grantee/${operatorAddress}`
      );
      
      console.log(`📡 Response status: ${grantsResponse.status} ${grantsResponse.statusText}`);
      
      if (!grantsResponse.ok) {
        const errorText = await grantsResponse.text();
        console.log(`⚠️ Failed to query grants from ${chainConfig.chainId}`);
        console.log(`Error details: ${errorText}`);
        return;
      }

      const grantsData: any = await grantsResponse.json();
      const grants: Grant[] = grantsData.grants || [];

      console.log(`✅ Found ${grants.length} grants on ${chainConfig.chainId}`);
      
      if (grants.length > 0) {
        console.log('📋 Grant details:', JSON.stringify(grants, null, 2));
      }

      // First pass: track commission and voting grants by granter
      const granterGrants = new Map<string, { hasCommission: boolean; hasVote: boolean }>();
      
      for (const grant of grants) {
        const grantInfo = granterGrants.get(grant.granter) || { hasCommission: false, hasVote: false };
        
        if (grant.authorization['@type'] === '/cosmos.authz.v1beta1.GenericAuthorization') {
          if (grant.authorization.msg === '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission') {
            grantInfo.hasCommission = true;
            console.log(`✅ Found commission grant for ${grant.granter}`);
          } else if (grant.authorization.msg === '/cosmos.gov.v1beta1.MsgVote') {
            grantInfo.hasVote = true;
            console.log(`✅ Found voting grant for ${grant.granter}`);
          }
        }
        
        granterGrants.set(grant.granter, grantInfo);
      }

      // Second pass: create tasks from StakeAuthorization grants
      for (const grant of grants) {
        console.log(`🔍 Processing grant type: ${grant.authorization['@type']}`);
        
        if (grant.authorization['@type'] === '/cosmos.staking.v1beta1.StakeAuthorization') {
          const allowList = grant.authorization.allow_list?.address || [];
          const grantInfo = granterGrants.get(grant.granter) || { hasCommission: false, hasVote: false };
          
          console.log(`📝 Allow list validators: ${allowList.length}`);
          
          for (const validator of allowList) {
            const taskId = `${chainConfig.chainId}-${grant.granter}-${validator}`;
            
            this.tasks.set(taskId, {
              chainId: chainConfig.chainId,
              granter: grant.granter,
              validator: validator,
              frequency: chainConfig.defaultFrequency || 'daily',
              lastRun: undefined,
              hasCommissionGrant: grantInfo.hasCommission,
              hasVoteGrant: grantInfo.hasVote,
            });

            console.log(`➕ Added task: ${taskId}`);
            console.log(`   Granter: ${grant.granter}`);
            console.log(`   Grantee: ${operatorAddress}`);
            console.log(`   Validator: ${validator}`);
            if (grantInfo.hasCommission) console.log(`   ✅ Commission grant available`);
            if (grantInfo.hasVote) console.log(`   ✅ Voting grant available`);
          }
        }
      }

      client.disconnect();
    } catch (error) {
      console.error(`❌ Error loading tasks from ${chainConfig.chainId}:`, error);
    }
  }

  private async processAllTasks() {
    console.log(`\n⏰ Processing ${this.tasks.size} tasks...`);

    for (const [taskId, task] of this.tasks) {
      try {
        if (this.shouldRun(task)) {
          await this.executeAutoCompound(task);
          task.lastRun = new Date();
        }
        
        await this.processVoting(task);
      } catch (error) {
        console.error(`❌ Error processing task ${taskId}:`, error);
      }
    }

    console.log('✅ Task processing complete\n');
  }

  private shouldRun(task: AutoCompoundTask): boolean {
    if (!task.lastRun) return true;

    const now = new Date();
    const lastRun = task.lastRun;
    const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

    switch (task.frequency) {
      case 'hourly':
        return hoursSinceLastRun >= 1;
      case 'daily':
        return hoursSinceLastRun >= 24;
      case 'weekly':
        return hoursSinceLastRun >= 24 * 7;
      case 'monthly':
        return hoursSinceLastRun >= 24 * 30;
      default:
        return false;
    }
  }

  private async executeAutoCompound(task: AutoCompoundTask) {
    console.log(`\n🔄 Executing auto-compound for ${task.granter} on ${task.chainId}`);

    try {
      const chainConfig = await this.getChainConfig(task.chainId);
      if (!chainConfig) {
        console.log(`⚠️ Chain config not found for ${task.chainId}`);
        return;
      }

      const chainMnemonic = this.getMnemonicForChain(chainConfig.chainId);
      const isEVM = chainConfig.coinType === '60';
      
      const wallet = isEVM 
        ? await this.getEthermintWallet(chainMnemonic, chainConfig.prefix)
        : await DirectSecp256k1HdWallet.fromMnemonic(chainMnemonic, { prefix: chainConfig.prefix });

      const [account] = await wallet.getAccounts();
      const operatorAddress = account.address;

      console.log(`🔑 Operator address: ${operatorAddress} (${chainConfig.coinType === '60' ? 'EVM' : 'Cosmos'})`);

      const client = await SigningStargateClient.connectWithSigner(
        chainConfig.rpc,
        wallet,
        {
          gasPrice: GasPrice.fromString(chainConfig.gasPrice),
        }
      );

      const rewards = await this.checkRewards(chainConfig.rest, task.granter, task.validator);
      const rewardsInMicro = Math.floor(parseFloat(rewards) * 1e6).toString();
      console.log(`💰 Rewards available: ${rewards} ${chainConfig.denom.replace('u', '')} (${rewardsInMicro} ${chainConfig.denom})`);

      const isValidator = await this.isValidatorAddress(task.granter, task.validator, chainConfig.prefix);
      let commission = '0';
      let commissionInMicro = '0';
      
      if (isValidator && task.hasCommissionGrant) {
        commission = await this.checkCommission(chainConfig.rest, task.validator);
        commissionInMicro = Math.floor(parseFloat(commission) * 1e6).toString();
        if (parseFloat(commission) > 0) {
          console.log(`👔 Commission available: ${commission} ${chainConfig.denom.replace('u', '')} (${commissionInMicro} ${chainConfig.denom})`);
        }
      }

      const totalAmount = (parseFloat(rewards) + parseFloat(commission)).toFixed(6);
      const totalInMicro = Math.floor(parseFloat(totalAmount) * 1e6).toString();

      if (parseFloat(totalAmount) < 0.01) {
        console.log(`⚠️ Total amount too low, skipping...`);
        client.disconnect();
        return;
      }

      const messages: any[] = [];

      const withdrawMsg = {
        typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
        value: MsgWithdrawDelegatorReward.fromPartial({
          delegatorAddress: task.granter,
          validatorAddress: task.validator,
        }),
      };
      messages.push(withdrawMsg);

      if (isValidator && task.hasCommissionGrant && parseFloat(commission) > 0) {
        const withdrawCommissionMsg = {
          typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
          value: MsgWithdrawValidatorCommission.fromPartial({
            validatorAddress: task.validator,
          }),
        };
        messages.push(withdrawCommissionMsg);
        console.log(`📝 Added commission withdrawal to transaction`);
      }

      const delegateMsg = {
        typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
        value: MsgDelegate.fromPartial({
          delegatorAddress: task.granter,
          validatorAddress: task.validator,
          amount: {
            denom: chainConfig.denom,
            amount: totalInMicro,
          },
        }),
      };
      messages.push(delegateMsg);

      const execMsg = {
        typeUrl: '/cosmos.authz.v1beta1.MsgExec',
        value: MsgExec.fromPartial({
          grantee: operatorAddress,
          msgs: messages.map((msg) => {
            if (msg.typeUrl === '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward') {
              return {
                typeUrl: msg.typeUrl,
                value: MsgWithdrawDelegatorReward.encode(msg.value).finish(),
              };
            } else if (msg.typeUrl === '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission') {
              return {
                typeUrl: msg.typeUrl,
                value: MsgWithdrawValidatorCommission.encode(msg.value).finish(),
              };
            } else if (msg.typeUrl === '/cosmos.staking.v1beta1.MsgDelegate') {
              return {
                typeUrl: msg.typeUrl,
                value: MsgDelegate.encode(msg.value).finish(),
              };
            }
            throw new Error(`Unknown message type: ${msg.typeUrl}`);
          }),
        }),
      };

      console.log(`📡 Broadcasting auto-compound transaction...`);
      const result = await client.signAndBroadcast(
        operatorAddress,
        [execMsg],
        'auto',
        'Auto-Compound via WinScan Bot'
      );

      if (result.code === 0) {
        console.log(`✅ Auto-compound successful!`);
        console.log(`   TX Hash: ${result.transactionHash}`);
        console.log(`   Height: ${result.height}`);
        console.log(`   Gas Used: ${result.gasUsed}/${result.gasWanted}`);
      } else {
        console.log(`❌ Auto-compound failed: ${result.rawLog}`);
      }

      client.disconnect();
    } catch (error: any) {
      console.error(`❌ Error executing auto-compound:`, error.message);
    }
  }

  private async checkRewards(rest: string, delegator: string, validator: string): Promise<string> {
    try {
      const response = await fetch(
        `${rest}/cosmos/distribution/v1beta1/delegators/${delegator}/rewards/${validator}`
      );

      if (!response.ok) return '0';

      const data: any = await response.json();
      const rewards = data.rewards || [];
      
      if (rewards.length === 0) return '0';

      const amount = rewards[0].amount || '0';
      return (parseFloat(amount) / 1e6).toFixed(6);
    } catch (error) {
      return '0';
    }
  }

  private async checkCommission(rest: string, validator: string): Promise<string> {
    try {
      const response = await fetch(
        `${rest}/cosmos/distribution/v1beta1/validators/${validator}/commission`
      );

      if (!response.ok) return '0';

      const data: any = await response.json();
      const commission = data.commission?.commission || [];
      
      if (commission.length === 0) return '0';

      const amount = commission[0].amount || '0';
      return (parseFloat(amount) / 1e6).toFixed(6);
    } catch (error) {
      return '0';
    }
  }

  private async isValidatorAddress(granter: string, validator: string, prefix: string): Promise<boolean> {
    try {
      const bech32 = require('bech32');
      
      const { words: accountWords } = bech32.bech32.decode(granter);
      const validatorAddr = bech32.bech32.encode(`${prefix}valoper`, accountWords);
      
      return validatorAddr === validator;
    } catch (error) {
      return false;
    }
  }

  private async processVoting(task: AutoCompoundTask) {
    try {
      if (!task.hasVoteGrant) return;
      
      const chainConfig = await this.getChainConfig(task.chainId);
      if (!chainConfig || !chainConfig.voteOption) return;

      const proposals = await this.getActiveProposals(chainConfig.rest);
      if (proposals.length === 0) return;

      for (const proposal of proposals) {
        const hasVoted = await this.hasVoted(chainConfig.rest, proposal.proposal_id, task.granter);
        if (hasVoted) continue;

        console.log(`\n🗳️ Voting on proposal #${proposal.proposal_id} for ${task.granter} on ${task.chainId}`);
        await this.executeVote(task, chainConfig, proposal.proposal_id);
      }
    } catch (error) {
      console.error(`❌ Error processing voting:`, error);
    }
  }

  private async getActiveProposals(rest: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${rest}/cosmos/gov/v1beta1/proposals?proposal_status=2`
      );

      if (!response.ok) return [];

      const data: any = await response.json();
      return data.proposals || [];
    } catch (error) {
      return [];
    }
  }

  private async hasVoted(rest: string, proposalId: string, voter: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${rest}/cosmos/gov/v1beta1/proposals/${proposalId}/votes/${voter}`
      );

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async executeVote(task: AutoCompoundTask, chainConfig: ChainConfig, proposalId: string) {
    try {
      const chainMnemonic = this.getMnemonicForChain(task.chainId);
      const isEVM = chainConfig.coinType === '60';
      
      const wallet = isEVM 
        ? await this.getEthermintWallet(chainMnemonic, chainConfig.prefix)
        : await DirectSecp256k1HdWallet.fromMnemonic(chainMnemonic, { prefix: chainConfig.prefix });

      const [account] = await wallet.getAccounts();
      const operatorAddress = account.address;

      const client = await SigningStargateClient.connectWithSigner(
        chainConfig.rpc,
        wallet,
        {
          gasPrice: GasPrice.fromString(chainConfig.gasPrice),
        }
      );

      const voteOptionMap: Record<string, VoteOption> = {
        'YES': VoteOption.VOTE_OPTION_YES,
        'NO': VoteOption.VOTE_OPTION_NO,
        'ABSTAIN': VoteOption.VOTE_OPTION_ABSTAIN,
        'VETO': VoteOption.VOTE_OPTION_NO_WITH_VETO,
      };

      const voteMsg = {
        typeUrl: '/cosmos.gov.v1beta1.MsgVote',
        value: MsgVote.fromPartial({
          proposalId: BigInt(proposalId),
          voter: task.granter,
          option: voteOptionMap[chainConfig.voteOption || 'YES'],
        }),
      };

      const execMsg = {
        typeUrl: '/cosmos.authz.v1beta1.MsgExec',
        value: MsgExec.fromPartial({
          grantee: operatorAddress,
          msgs: [{
            typeUrl: voteMsg.typeUrl,
            value: MsgVote.encode(voteMsg.value).finish(),
          }],
        }),
      };

      const result = await client.signAndBroadcast(
        operatorAddress,
        [execMsg],
        'auto',
        `Auto-vote on proposal #${proposalId}`
      );

      console.log(`✅ Vote successful!`);
      console.log(`   TX Hash: ${result.transactionHash}`);
      console.log(`   Proposal: #${proposalId}`);
      console.log(`   Vote: ${chainConfig.voteOption}`);

      client.disconnect();
    } catch (error: any) {
      console.error(`❌ Vote failed:`, error.message);
    }
  }

  private async getChainConfig(chainId: string): Promise<ChainConfig | null> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const possiblePaths = [
        path.join(__dirname, '../../../Chains'),
        path.join(__dirname, '../../Chains'),
        path.join(process.cwd(), 'Chains'),
        path.join(process.cwd(), '../Chains'),
      ];
      
      let chainsDir = null;
      for (const dir of possiblePaths) {
        if (fs.existsSync(dir)) {
          chainsDir = dir;
          break;
        }
      }

      if (!chainsDir) {
        console.error('❌ Chains directory not found');
        return null;
      }

      const files = fs.readdirSync(chainsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const chainData = JSON.parse(
            fs.readFileSync(path.join(chainsDir, file), 'utf8')
          );
          
          if (chainData.chain_id === chainId) {
            const defaultFrequency = chainData.autocompound_operators?.[0]?.default_frequency || 'daily';
            const voteOption = chainData.autocompound_operators?.[0]?.vote_option || 'YES';
            const granteeAddress = chainData.autocompound_operators?.[0]?.grantee_address;
            
            return {
              chainId: chainData.chain_id,
              rpc: chainData.apis.rpc[0].address,
              rest: chainData.apis.rest[0].address,
              prefix: chainData.bech32_prefix,
              denom: chainData.staking?.staking_tokens[0]?.denom || chainData.fees?.fee_tokens[0]?.denom,
              gasPrice: `0.025${chainData.fees?.fee_tokens[0]?.denom || 'stake'}`,
              coinType: chainData.coin_type,
              defaultFrequency: defaultFrequency as 'hourly' | 'daily' | 'weekly' | 'monthly',
              voteOption: voteOption as 'YES' | 'NO' | 'ABSTAIN' | 'VETO',
              granteeAddress: granteeAddress,
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error loading chain config:', error);
      return null;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      operatorAddress: this.operatorAddress,
      tasksCount: this.tasks.size,
      tasks: Array.from(this.tasks.values()),
    };
  }
}
