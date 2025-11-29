import { SigningStargateClient, StargateClient, GasPrice } from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { MsgExec } from 'cosmjs-types/cosmos/authz/v1beta1/tx';
import { MsgWithdrawDelegatorReward } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { MsgDelegate } from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import { Registry } from '@cosmjs/proto-signing';
import { defaultRegistryTypes } from '@cosmjs/stargate';

interface ChainConfig {
  chainId: string;
  rpc: string;
  rest: string;
  prefix: string;
  denom: string;
  gasPrice: string;
  coinType?: string;
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
}

export class AutoCompoundBot {
  private operatorWallet: DirectSecp256k1HdWallet | null = null;
  private operatorAddress: string = '';
  private tasks: Map<string, AutoCompoundTask> = new Map();
  private isRunning: boolean = false;

  constructor(private mnemonic: string) {}

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
    }, 60 * 60 * 1000);

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
      
      const chainMnemonic = this.getMnemonicForChain(chainConfig.chainId);
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(chainMnemonic, {
        prefix: chainConfig.prefix,
      });
      const [account] = await wallet.getAccounts();
      const operatorAddress = account.address;
      
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

      for (const grant of grants) {
        console.log(`🔍 Processing grant type: ${grant.authorization['@type']}`);
        
        if (grant.authorization['@type'] === '/cosmos.staking.v1beta1.StakeAuthorization') {
          const allowList = grant.authorization.allow_list?.address || [];
          
          console.log(`📝 Allow list validators: ${allowList.length}`);
          
          for (const validator of allowList) {
            const taskId = `${chainConfig.chainId}-${grant.granter}-${validator}`;
            
            this.tasks.set(taskId, {
              chainId: chainConfig.chainId,
              granter: grant.granter,
              validator: validator,
              frequency: 'daily',
              lastRun: undefined,
            });

            console.log(`➕ Added task: ${taskId}`);
            console.log(`   Granter: ${grant.granter}`);
            console.log(`   Grantee: ${operatorAddress}`);
            console.log(`   Validator: ${validator}`);
          }
        } else {
          console.log(`⏭️ Skipping non-staking grant: ${grant.authorization['@type']}`);
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
      const hdPath = isEVM ? [
        { type: 'HD', slip44: 60, accountIndex: 0 }
      ] : undefined;
      
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
        chainMnemonic,
        {
          prefix: chainConfig.prefix,
          ...(hdPath && { hdPaths: [hdPath as any] })
        }
      );

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
      console.log(`💰 Rewards available: ${rewards} ${chainConfig.denom}`);

      if (parseFloat(rewards) < 0.01) {
        console.log(`⚠️ Rewards too low, skipping...`);
        client.disconnect();
        return;
      }

      const withdrawMsg = {
        typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
        value: MsgWithdrawDelegatorReward.fromPartial({
          delegatorAddress: task.granter,
          validatorAddress: task.validator,
        }),
      };

      const delegateMsg = {
        typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
        value: MsgDelegate.fromPartial({
          delegatorAddress: task.granter,
          validatorAddress: task.validator,
          amount: {
            denom: chainConfig.denom,
            amount: '1',
          },
        }),
      };

      const execMsg = {
        typeUrl: '/cosmos.authz.v1beta1.MsgExec',
        value: MsgExec.fromPartial({
          grantee: operatorAddress,
          msgs: [
            {
              typeUrl: withdrawMsg.typeUrl,
              value: MsgWithdrawDelegatorReward.encode(withdrawMsg.value).finish(),
            },
            {
              typeUrl: delegateMsg.typeUrl,
              value: MsgDelegate.encode(delegateMsg.value).finish(),
            },
          ],
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
            return {
              chainId: chainData.chain_id,
              rpc: chainData.apis.rpc[0].address,
              rest: chainData.apis.rest[0].address,
              prefix: chainData.bech32_prefix,
              denom: chainData.staking?.staking_tokens[0]?.denom || chainData.fees?.fee_tokens[0]?.denom,
              gasPrice: `0.025${chainData.fees?.fee_tokens[0]?.denom || 'stake'}`,
              coinType: chainData.coin_type,
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
