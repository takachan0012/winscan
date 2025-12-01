import { SigningStargateClient, StargateClient, GasPrice, accountFromAny, AccountParser } from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet, makeCosmoshubPath, OfflineDirectSigner, EncodeObject, AccountData, makeSignBytes, Algo, DirectSignResponse } from '@cosmjs/proto-signing';
import { stringToPath } from '@cosmjs/crypto';
import { toBech32, fromBech32, toBase64, fromBase64 } from '@cosmjs/encoding';
import { encodeSecp256k1Signature, StdSignDoc } from '@cosmjs/amino';
import { MsgExec } from 'cosmjs-types/cosmos/authz/v1beta1/tx';
import { MsgWithdrawDelegatorReward, MsgWithdrawValidatorCommission } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { MsgDelegate } from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import { MsgVote } from 'cosmjs-types/cosmos/gov/v1beta1/tx';
import { VoteOption } from 'cosmjs-types/cosmos/gov/v1beta1/gov';
import { Registry, makeSignDoc } from '@cosmjs/proto-signing';
import { defaultRegistryTypes } from '@cosmjs/stargate';
import { ethers } from 'ethers';
import { Secp256k1, Secp256k1Signature, sha256 } from '@cosmjs/crypto';
import { BaseAccount } from 'cosmjs-types/cosmos/auth/v1beta1/auth';
import { Any } from 'cosmjs-types/google/protobuf/any';
import { PubKey as Secp256k1PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { TxRaw, AuthInfo, TxBody, Fee, SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import Long from 'long';
import * as bech32 from 'bech32';
function decodeEthermintPubkey(pubkey: Any): { type: string; value: Uint8Array } {
  if (pubkey.typeUrl === '/ethermint.crypto.v1.ethsecp256k1.PubKey' ||
      pubkey.typeUrl === '/cosmos.evm.crypto.v1.ethsecp256k1.PubKey') {
    const decoded = Secp256k1PubKey.decode(pubkey.value);
    return {
      type: pubkey.typeUrl,
      value: decoded.key
    };
  }
  if (pubkey.typeUrl === '/cosmos.crypto.secp256k1.PubKey') {
    const decoded = Secp256k1PubKey.decode(pubkey.value);
    return {
      type: pubkey.typeUrl,
      value: decoded.key
    };
  }
  throw new Error(`Unsupported pubkey type: ${pubkey.typeUrl}`);
}
function ethermintAccountParser(input: any): any {
  const { typeUrl, value } = input;
  if (typeUrl === '/ethermint.types.v1.EthAccount') {
    if (value instanceof Uint8Array) {
      let offset = 0;
      let baseAccountBytes: Uint8Array | null = null;
      while (offset < value.length) {
        const tag = value[offset++];
        const fieldNumber = tag >> 3;
        const wireType = tag & 0x07;
        if (wireType === 2) {
          let length = 0;
          let shift = 0;
          while (offset < value.length) {
            const b = value[offset++];
            length |= (b & 0x7f) << shift;
            if ((b & 0x80) === 0) break;
            shift += 7;
          }
          const fieldData = value.slice(offset, offset + length);
          offset += length;
          if (fieldNumber === 1) {
            baseAccountBytes = fieldData;
            break;
          }
        } else {
          break;
        }
      }
      if (!baseAccountBytes) {
        throw new Error('EthAccount does not contain base_account field (field 1)');
      }
      const baseAccount = BaseAccount.decode(baseAccountBytes);
      if (baseAccount.pubKey && baseAccount.pubKey.typeUrl === '/ethermint.crypto.v1.ethsecp256k1.PubKey') {
        const ethPubkey = Secp256k1PubKey.decode(baseAccount.pubKey.value);
        baseAccount.pubKey = {
          typeUrl: '/cosmos.crypto.secp256k1.PubKey',
          value: Secp256k1PubKey.encode(ethPubkey).finish()
        };
      }
      const modifiedAccountBytes = BaseAccount.encode(baseAccount).finish();
      return accountFromAny({
        typeUrl: '/cosmos.auth.v1beta1.BaseAccount',
        value: modifiedAccountBytes
      });
    }
    const baseAccount = value.base_account || value.baseAccount;
    if (!baseAccount) {
      throw new Error('EthAccount does not have base_account or baseAccount field');
    }
    return accountFromAny({
      typeUrl: '/cosmos.auth.v1beta1.BaseAccount',
      value: baseAccount
    });
  }
  return accountFromAny(input);
}
class EthermintWallet implements OfflineDirectSigner {
  private hdNode: ethers.utils.HDNode;
  private prefix: string;
  constructor(hdNode: ethers.utils.HDNode, prefix: string) {
    this.hdNode = hdNode;
    this.prefix = prefix;
  }
  static async fromMnemonic(mnemonic: string, prefix: string): Promise<EthermintWallet> {
    const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic).derivePath("m/44'/60'/0'/0/0");
    return new EthermintWallet(hdNode, prefix);
  }
  async getAccounts(): Promise<readonly AccountData[]> {
    const ethAddress = ethers.utils.computeAddress(this.hdNode.publicKey);
    const addressBytes = ethers.utils.arrayify(ethAddress);
    const bech32Address = bech32.encode(this.prefix, bech32.toWords(addressBytes));
    const pubkey = ethers.utils.arrayify(this.hdNode.publicKey);
    return [
      {
        address: bech32Address,
        pubkey: pubkey,
        algo: 'secp256k1' as Algo,
      },
    ];
  }
  async signDirect(signerAddress: string, signDoc: SignDoc, useKeccak256: boolean = false): Promise<DirectSignResponse> {
    const accounts = await this.getAccounts();
    const account = accounts.find(a => a.address === signerAddress);
    if (!account) {
      throw new Error(`Address ${signerAddress} not found in wallet`);
    }
    const signBytes = makeSignBytes(signDoc);
    const messageHash = useKeccak256 
      ? ethers.utils.arrayify(ethers.utils.keccak256(signBytes))
      : sha256(signBytes);
    const signingKey = new ethers.utils.SigningKey(this.hdNode.privateKey);
    const ethSignature = signingKey.signDigest(messageHash);
    const r = ethers.utils.arrayify(ethSignature.r);
    const s = ethers.utils.arrayify(ethSignature.s);
    const signatureBytes = new Uint8Array(64);
    signatureBytes.set(r, 0);
    signatureBytes.set(s, 32);

    return {
      signed: signDoc,
      signature: encodeSecp256k1Signature(account.pubkey, signatureBytes),
    };
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
    const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
    const ethPath = "m/44'/60'/0'/0/0";
    const ethWallet = hdNode.derivePath(ethPath);
    const addressBytes = ethers.utils.arrayify(ethWallet.address);
    const ethAddress = toBech32(prefix, addressBytes);
    return ethAddress;
  }
  private getMnemonicForChain(chainId: string): string {return this.mnemonic;
  }
  async initialize() {
    // Initialize operator address with first chain prefix (will be set properly per-chain)
    // This is just for status display, actual operations use per-chain wallets
    this.operatorAddress = 'multi-chain-operator';
    console.log(`✅ Multi-Chain Operator initialized`);
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
      if (chainConfig.granteeAddress) {
        operatorAddress = chainConfig.granteeAddress;} else {
        const chainMnemonic = this.getMnemonicForChain(chainConfig.chainId);
        const isEVM = chainConfig.coinType === '60';
        if (isEVM) {
          operatorAddress = await this.getEthermintAddress(chainMnemonic, chainConfig.prefix);} else {
          const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
            chainMnemonic,
            { prefix: chainConfig.prefix }
          );
          const [account] = await wallet.getAccounts();
          operatorAddress = account.address;}
      }console.log(`🌐 REST endpoint: ${chainConfig.rest}`);
      const grantsResponse = await fetch(
        `${chainConfig.rest}/cosmos/authz/v1beta1/grants/grantee/${operatorAddress}`
      );if (!grantsResponse.ok) {
        const errorText = await grantsResponse.text();
        console.log(`⚠️ Failed to query grants from ${chainConfig.chainId}`);
        console.log(`Error details: ${errorText}`);
        return;
      }
      const grantsData: any = await grantsResponse.json();
      const grants: Grant[] = grantsData.grants || [];
      console.log(`✅ Found ${grants.length} grants on ${chainConfig.chainId}`);
      if (grants.length > 0) {}
      const granterGrants = new Map<string, { hasCommission: boolean; hasVote: boolean }>();
      for (const grant of grants) {
        const grantInfo = granterGrants.get(grant.granter) || { hasCommission: false, hasVote: false };
        if (grant.authorization['@type'] === '/cosmos.authz.v1beta1.GenericAuthorization') {
          if (grant.authorization.msg === '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission') {
            grantInfo.hasCommission = true;} else if (grant.authorization.msg === '/cosmos.gov.v1beta1.MsgVote') {
            grantInfo.hasVote = true;}
        }
        granterGrants.set(grant.granter, grantInfo);
      }
      for (const grant of grants) {if (grant.authorization['@type'] === '/cosmos.staking.v1beta1.StakeAuthorization') {
          const allowList = grant.authorization.allow_list?.address || [];
          const grantInfo = granterGrants.get(grant.granter) || { hasCommission: false, hasVote: false };for (const validator of allowList) {
            const taskId = `${chainConfig.chainId}-${grant.granter}-${validator}`;
            this.tasks.set(taskId, {
              chainId: chainConfig.chainId,
              granter: grant.granter,
              validator: validator,
              frequency: chainConfig.defaultFrequency || 'daily',
              lastRun: undefined,
              hasCommissionGrant: grantInfo.hasCommission,
              hasVoteGrant: grantInfo.hasVote,
            });console.log(`   Granter: ${grant.granter}`);console.log(`   Validator: ${validator}`);if (grantInfo.hasVote) console.log(`   ✅ Voting grant available`);
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
    if (!task.lastRun) {
      console.log(`✅ Task should run (first time): ${task.chainId} - ${task.granter.substring(0, 12)}...`);
      return true;
    }
    const now = new Date();
    const lastRun = task.lastRun;
    const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
    
    let shouldExecute = false;
    let requiredHours = 0;
    
    switch (task.frequency) {
      case 'hourly':
        requiredHours = 1;
        shouldExecute = hoursSinceLastRun >= 1;
        break;
      case 'daily':
        requiredHours = 24;
        shouldExecute = hoursSinceLastRun >= 24;
        break;
      case 'weekly':
        requiredHours = 24 * 7;
        shouldExecute = hoursSinceLastRun >= 24 * 7;
        break;
      case 'monthly':
        requiredHours = 24 * 30;
        shouldExecute = hoursSinceLastRun >= 24 * 30;
        break;
      default:
        return false;
    }
    
    if (!shouldExecute) {
      const hoursRemaining = (requiredHours - hoursSinceLastRun).toFixed(2);
      console.log(`⏳ Waiting: ${task.chainId} - ${task.granter.substring(0, 12)}... (${hoursRemaining}h remaining, frequency: ${task.frequency})`);
    } else {
      console.log(`✅ Task should run: ${task.chainId} - ${task.granter.substring(0, 12)}... (${hoursSinceLastRun.toFixed(2)}h since last run)`);
    }
    
    return shouldExecute;
  }
  private async executeAutoCompound(task: AutoCompoundTask) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔄 AUTO-COMPOUND EXECUTION`);
    console.log(`   Chain: ${task.chainId}`);
    console.log(`   Granter: ${task.granter}`);
    console.log(`${'='.repeat(80)}`);
    try {
      const chainConfig = await this.getChainConfig(task.chainId);
      if (!chainConfig) {
        console.log(`\n❌ ERROR: Chain config not found for ${task.chainId}`);
        console.log(`${'='.repeat(80)}\n`);
        return;
      }
      const chainMnemonic = this.getMnemonicForChain(chainConfig.chainId);
      let isEthermintChain = false;
      let useEthAddress = false;
      let tempOperatorAddress = '';
      let wardenUsesCosmosKey = false;
      try {
        if (chainConfig.coinType === '60') {
          const ethWallet = await EthermintWallet.fromMnemonic(chainMnemonic, chainConfig.prefix);
          const [ethAccount] = await ethWallet.getAccounts();
          tempOperatorAddress = ethAccount.address;
          const ethAccountUrl = `${chainConfig.rest}/cosmos/auth/v1beta1/accounts/${tempOperatorAddress}`;
          const ethAccountResponse = await fetch(ethAccountUrl);
          if (ethAccountResponse.ok) {
            const ethAccountData: any = await ethAccountResponse.json();
            const ethAccountType = ethAccountData.account?.['@type'];
            if (ethAccountType === '/ethermint.types.v1.EthAccount') {
              isEthermintChain = true;
              useEthAddress = true;console.log(`   Type: ${ethAccountType}`);} else if (ethAccountType === '/cosmos.auth.v1beta1.BaseAccount') {
              isEthermintChain = true;
              useEthAddress = true;
              wardenUsesCosmosKey = true;console.log(`   Type: ${ethAccountType}`);console.log(`   Hash: Keccak256`);} else {
              const cosmosWallet = await DirectSecp256k1HdWallet.fromMnemonic(chainMnemonic, {
                prefix: chainConfig.prefix,
                hdPaths: [makeCosmoshubPath(0)]
              });
              const [cosmosAccount] = await cosmosWallet.getAccounts();
              tempOperatorAddress = cosmosAccount.address;
              const cosmosAccountUrl = `${chainConfig.rest}/cosmos/auth/v1beta1/accounts/${tempOperatorAddress}`;
              const cosmosAccountResponse = await fetch(cosmosAccountUrl);
              if (cosmosAccountResponse.ok) {
                useEthAddress = false;
                isEthermintChain = false;}
            }
          } else {
            const cosmosWallet = await DirectSecp256k1HdWallet.fromMnemonic(chainMnemonic, {
              prefix: chainConfig.prefix,
              hdPaths: [makeCosmoshubPath(0)]
            });
            const [cosmosAccount] = await cosmosWallet.getAccounts();
            tempOperatorAddress = cosmosAccount.address;
            const cosmosAccountUrl = `${chainConfig.rest}/cosmos/auth/v1beta1/accounts/${tempOperatorAddress}`;
            const cosmosAccountResponse = await fetch(cosmosAccountUrl);
            if (cosmosAccountResponse.ok) {
              useEthAddress = false;
              isEthermintChain = false;
              console.log(`🔍 Detected account type: BaseAccount → Standard Cosmos address (coin_type 60)`);
            } else {}
          }
        } else {
          const cosmosWallet = await DirectSecp256k1HdWallet.fromMnemonic(chainMnemonic, {
            prefix: chainConfig.prefix,
            hdPaths: [makeCosmoshubPath(0)]
          });
          const [cosmosAccount] = await cosmosWallet.getAccounts();
          tempOperatorAddress = cosmosAccount.address;
          const accountUrl = `${chainConfig.rest}/cosmos/auth/v1beta1/accounts/${tempOperatorAddress}`;
          const accountResponse = await fetch(accountUrl);
          if (accountResponse.ok) {
            const accountData: any = await accountResponse.json();
            const accountType = accountData.account?.['@type'];console.log(`   Type: ${accountType}`);}
        }
      } catch (e) {console.log(`   Fallback: Using coin_type ${chainConfig.coinType}`);
        isEthermintChain = chainConfig.coinType === '60';
        useEthAddress = chainConfig.coinType === '60';
      }
      const wallet: OfflineDirectSigner = useEthAddress
        ? await EthermintWallet.fromMnemonic(chainMnemonic, chainConfig.prefix)
        : await DirectSecp256k1HdWallet.fromMnemonic(chainMnemonic, {
            prefix: chainConfig.prefix,
            hdPaths: [makeCosmoshubPath(0)]
          });
      const [account] = await wallet.getAccounts();
      const operatorAddress = account.address;
      console.log(`\n🔑 Wallet Information:`);console.log(`   Type: ${isEthermintChain ? 'Ethermint' : 'Cosmos'}`);
      const client = await SigningStargateClient.connectWithSigner(
        chainConfig.rpc,
        wallet,
        {
          gasPrice: GasPrice.fromString(chainConfig.gasPrice),
          accountParser: isEthermintChain ? ethermintAccountParser : undefined,
        }
      );
      const rewards = await this.checkRewards(chainConfig.rest, task.granter, task.validator);
      const rewardsBigInt = BigInt(Math.floor(parseFloat(rewards) * 1e6));
      const rewardsInMicro = rewardsBigInt.toString();const isValidator = await this.isValidatorAddress(task.granter, task.validator, chainConfig.prefix);
      let commission = '0';
      let commissionInMicro = '0';
      let commissionBigInt = BigInt(0);if (isValidator && task.hasCommissionGrant) {
        commission = await this.checkCommission(chainConfig.rest, task.validator);
        commissionBigInt = BigInt(Math.floor(parseFloat(commission) * 1e6));
        commissionInMicro = commissionBigInt.toString();
        if (parseFloat(commission) > 0) {} else {}
      }
      const totalAmount = (parseFloat(rewards) + parseFloat(commission)).toFixed(6);
      const totalInMicroBigInt = rewardsBigInt + commissionBigInt;
      const totalInMicro = totalInMicroBigInt.toString();
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
        messages.push(withdrawCommissionMsg);}
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
      };console.log(`${'─'.repeat(80)}`);
      if (useEthAddress) {
        try {
          const accountUrl = `${chainConfig.rest}/cosmos/auth/v1beta1/accounts/${operatorAddress}`;
          const accountResponse = await fetch(accountUrl);
          const accountData: any = await accountResponse.json();
          const accountType = accountData.account?.['@type'];
          console.log(`\n🔐 Transaction Details:`);let baseAccount: any;
          if (accountType === '/ethermint.types.v1.EthAccount') {
            baseAccount = accountData.account.base_account;
          } else {
            baseAccount = accountData.account;
          }console.log(`   Sequence: ${baseAccount.sequence}`);
          const [walletAccount] = await wallet.getAccounts();
          const registry = new Registry(defaultRegistryTypes);
          const encodedMsgs = [execMsg].map(msg => registry.encodeAsAny(msg));
          const txBodyBytes = TxBody.encode(
            TxBody.fromPartial({
              messages: encodedMsgs,
              memo: 'Auto-Compound via WinScan Bot',
            })
          ).finish();
          const gasLimit = 500000;
          const gasPrice = parseFloat(chainConfig.gasPrice.replace(/[a-z]+$/, ''));
          const feeAmount = Math.ceil(gasLimit * gasPrice * 1.3).toString();
          let pubkeyTypeUrl = '/cosmos.crypto.secp256k1.PubKey';
          if (baseAccount.pub_key && baseAccount.pub_key['@type']) {
            pubkeyTypeUrl = baseAccount.pub_key['@type'];} else {
            if (accountType === '/ethermint.types.v1.EthAccount') {
              pubkeyTypeUrl = '/ethermint.crypto.v1.ethsecp256k1.PubKey';
            } else if (wardenUsesCosmosKey) {
              pubkeyTypeUrl = '/cosmos.evm.crypto.v1.ethsecp256k1.PubKey';
            } else {
              pubkeyTypeUrl = '/cosmos.crypto.secp256k1.PubKey';
            }}
          const useKeccak256 = isEthermintChain;const authInfoBytes = AuthInfo.encode({
            signerInfos: [
              {
                publicKey: {
                  typeUrl: pubkeyTypeUrl,
                  value: Secp256k1PubKey.encode({
                    key: walletAccount.pubkey,
                  }).finish(),
                },
                sequence: BigInt(baseAccount.sequence),
                modeInfo: { single: { mode: SignMode.SIGN_MODE_DIRECT } },
              },
            ],
            fee: Fee.fromPartial({
              amount: [{ denom: chainConfig.denom, amount: feeAmount }],
              gasLimit: BigInt(gasLimit),
            }),
          }).finish();
          const signDoc = makeSignDoc(
            txBodyBytes,
            authInfoBytes,
            chainConfig.chainId,
            parseInt(baseAccount.account_number)
          );
          const { signature, signed } = await (wallet as EthermintWallet).signDirect(
            operatorAddress, 
            signDoc,
            useKeccak256
          );
          const txRaw = TxRaw.encode({
            bodyBytes: signed.bodyBytes,
            authInfoBytes: signed.authInfoBytes,
            signatures: [fromBase64(signature.signature)],
          }).finish();
          const txBytes = toBase64(txRaw);
          const broadcastUrl = `${chainConfig.rest}/cosmos/tx/v1beta1/txs`;
          const broadcastResponse = await fetch(broadcastUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tx_bytes: txBytes,
              mode: 'BROADCAST_MODE_SYNC',
            }),
          });
          if (!broadcastResponse.ok) {
            const error = await broadcastResponse.text();
            throw new Error(`Broadcast failed: ${error}`);
          }
          const broadcastResult: any = await broadcastResponse.json();
          if (broadcastResult.tx_response?.code !== 0) {
            throw new Error(
              `Broadcasting transaction failed with code ${broadcastResult.tx_response.code} (codespace: ${broadcastResult.tx_response.codespace}). Log: ${broadcastResult.tx_response.raw_log}`
            );
          }
          console.log('✅ Auto-compound successful!');
          console.log(`   TX Hash: ${broadcastResult.tx_response.txhash}`);
          console.log(`   Height: ${broadcastResult.tx_response.height}`);
          client.disconnect();
          return;
        } catch (evmError: any) {
          if (evmError.message.includes('account sequence mismatch')) {
            console.log(`⚠️  Sequence mismatch (parallel execution) - will retry in next cycle`);
          } else {
            console.log(`❌ Error executing auto-compound: ${evmError.message}`);
          }
          client.disconnect();
          return;
        }
      }
      const result = await client.signAndBroadcast(
        operatorAddress,
        [execMsg],
        'auto',
        'Auto-Compound via WinScan Bot'
      );
      if (result.code === 0) {console.log(`   TX Hash: ${result.transactionHash}`);console.log(`   Gas: ${result.gasUsed}/${result.gasWanted}`);
        console.log(`${'='.repeat(80)}\n`);
      } else {
        console.log(`❌ Auto-compound failed: ${result.rawLog}`);
      }
      client.disconnect();
    } catch (error: any) {
      console.error(`\n❌ ERROR: ${error.message}`);
      console.log(`${'='.repeat(80)}\n`);
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
      const { data: addressBytes } = fromBech32(granter);
      const validatorAddr = toBech32(`${prefix}valoper`, addressBytes);return validatorAddr === validator;
    } catch (error) {
      console.error(`❌ isValidatorAddress error:`, error);
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
      let isEthermintChain = false;
      let useEthAddress = false;
      try {
        if (chainConfig.coinType === '60') {
          const ethWallet = await EthermintWallet.fromMnemonic(chainMnemonic, chainConfig.prefix);
          const [ethAccount] = await ethWallet.getAccounts();
          const ethAccountUrl = `${chainConfig.rest}/cosmos/auth/v1beta1/accounts/${ethAccount.address}`;
          const ethAccountResponse = await fetch(ethAccountUrl);
          if (ethAccountResponse.ok) {
            const ethAccountData: any = await ethAccountResponse.json();
            const ethAccountType = ethAccountData.account?.['@type'];
            if (ethAccountType === '/ethermint.types.v1.EthAccount') {
              isEthermintChain = true;
              useEthAddress = true;
            } else if (ethAccountType === '/cosmos.auth.v1beta1.BaseAccount') {
              isEthermintChain = true;
              useEthAddress = true;
            }
          } else {
            const cosmosWallet = await DirectSecp256k1HdWallet.fromMnemonic(chainMnemonic, {
              prefix: chainConfig.prefix,
              hdPaths: [makeCosmoshubPath(0)]
            });
            const [cosmosAccount] = await cosmosWallet.getAccounts();
            const cosmosAccountUrl = `${chainConfig.rest}/cosmos/auth/v1beta1/accounts/${cosmosAccount.address}`;
            const cosmosAccountResponse = await fetch(cosmosAccountUrl);
            if (cosmosAccountResponse.ok) {
              useEthAddress = false;
              isEthermintChain = false;
            }
          }
        }
      } catch (e) {
        useEthAddress = chainConfig.coinType === '60';
        isEthermintChain = chainConfig.coinType === '60';
      }
      const wallet: OfflineDirectSigner = useEthAddress
        ? await EthermintWallet.fromMnemonic(chainMnemonic, chainConfig.prefix)
        : await DirectSecp256k1HdWallet.fromMnemonic(chainMnemonic, {
            prefix: chainConfig.prefix,
            hdPaths: [makeCosmoshubPath(0)]
          });
      const [account] = await wallet.getAccounts();
      const operatorAddress = account.address;
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
      if (useEthAddress || chainConfig.coinType === '60') {const readOnlyClient = await StargateClient.connect(chainConfig.rpc);
        const accountResponse = await readOnlyClient.getAccount(operatorAddress);
        if (!accountResponse) {
          throw new Error(`Account not found: ${operatorAddress}`);
        }
        const accountAny = accountResponse as any;
        const accountType = accountAny.typeUrl || '/cosmos.auth.v1beta1.BaseAccount';let baseAccount: any;
        if (accountType === '/ethermint.types.v1.EthAccount') {
          const ethAccountBytes = accountAny.value;
          let offset = 0;
          let baseAccountBytes: Uint8Array | null = null;
          while (offset < ethAccountBytes.length) {
            const tag = ethAccountBytes[offset++];
            const fieldNumber = tag >> 3;
            const wireType = tag & 0x07;
            if (wireType === 2) {
              let length = 0;
              let shift = 0;
              while (offset < ethAccountBytes.length) {
                const b = ethAccountBytes[offset++];
                length |= (b & 0x7f) << shift;
                if ((b & 0x80) === 0) break;
                shift += 7;
              }
              const fieldData = ethAccountBytes.slice(offset, offset + length);
              offset += length;
              if (fieldNumber === 1) {
                baseAccountBytes = fieldData;
                break;
              }
            } else {
              break;
            }
          }
          if (!baseAccountBytes) {
            throw new Error('Failed to extract BaseAccount from EthAccount');
          }
          baseAccount = BaseAccount.decode(baseAccountBytes);
        } else {
          const accountBytes = accountAny.value;
          baseAccount = BaseAccount.decode(accountBytes);
        }const [walletAccount] = await wallet.getAccounts();
        const registry = new Registry(defaultRegistryTypes);
        const encodedMsgs = [execMsg].map(msg => registry.encodeAsAny(msg));
        const txBodyBytes = TxBody.encode(
          TxBody.fromPartial({
            messages: encodedMsgs,
            memo: `Auto-vote on proposal #${proposalId}`,
          })
        ).finish();
        const gasLimit = 300000;
        const gasPrice = parseFloat(chainConfig.gasPrice.replace(/[a-z]+$/, ''));
        const feeAmount = Math.ceil(gasLimit * gasPrice * 1.3).toString();
        let pubkeyTypeUrl = '/cosmos.crypto.secp256k1.PubKey';
        if (baseAccount.pub_key && baseAccount.pub_key['@type']) {
          pubkeyTypeUrl = baseAccount.pub_key['@type'];} else {
          if (accountType === '/ethermint.types.v1.EthAccount') {
            pubkeyTypeUrl = '/ethermint.crypto.v1.ethsecp256k1.PubKey';
          } else if (isEthermintChain) {
            pubkeyTypeUrl = '/ethermint.crypto.v1.ethsecp256k1.PubKey';
          } else {
            pubkeyTypeUrl = '/cosmos.crypto.secp256k1.PubKey';
          }}
        const useKeccak256 = pubkeyTypeUrl === '/ethermint.crypto.v1.ethsecp256k1.PubKey' || isEthermintChain;
        const authInfoBytes = AuthInfo.encode({
          signerInfos: [
            {
              publicKey: {
                typeUrl: pubkeyTypeUrl,
                value: Secp256k1PubKey.encode({
                  key: walletAccount.pubkey,
                }).finish(),
              },
              sequence: BigInt(baseAccount.sequence),
              modeInfo: {
                single: {
                  mode: SignMode.SIGN_MODE_DIRECT,
                },
              },
            },
          ],
          fee: Fee.fromPartial({
            amount: [{ denom: chainConfig.denom, amount: feeAmount }],
            gasLimit: BigInt(gasLimit),
          }),
        }).finish();
        const signDoc = SignDoc.fromPartial({
          bodyBytes: txBodyBytes,
          authInfoBytes: authInfoBytes,
          chainId: chainConfig.chainId,
          accountNumber: BigInt(baseAccount.account_number),
        });
        const signBytes = SignDoc.encode(signDoc).finish();
        const signResponse = await (wallet as EthermintWallet).signDirect(
          operatorAddress, 
          signDoc,
          useKeccak256
        );
        const txRaw = TxRaw.encode({
          bodyBytes: signResponse.signed.bodyBytes,
          authInfoBytes: signResponse.signed.authInfoBytes,
          signatures: [fromBase64(signResponse.signature.signature)],
        }).finish();
        const txBytes = txRaw;
        const response = await fetch(`${chainConfig.rpc}/broadcast_tx_sync?tx=0x${Buffer.from(txBytes).toString('hex')}`);
        const result: any = await response.json();
        if (result.result.code !== 0 && result.result.code !== undefined) {
          throw new Error(`Transaction failed: ${result.result.log}`);
        }
        const txHash = result.result.hash;
        console.log(`✅ Vote successful!`);
        console.log(`   TX Hash: ${txHash}`);
        console.log(`   Proposal: #${proposalId}`);
        console.log(`   Vote: ${chainConfig.voteOption}`);
        readOnlyClient.disconnect();
      } else {
        const client = await SigningStargateClient.connectWithSigner(
          chainConfig.rpc,
          wallet,
          {
            gasPrice: GasPrice.fromString(chainConfig.gasPrice),
          }
        );
        const result = await client.signAndBroadcast(
          operatorAddress,
          [execMsg],
          'auto',
          `Auto-vote on proposal #${proposalId}`
        );
        console.log(`✅ Vote successful!`);console.log(`   Proposal: #${proposalId}`);
        console.log(`   Vote: ${chainConfig.voteOption}`);
        client.disconnect();
      }
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
            const feeToken = chainData.fees?.fee_tokens?.[0];
            const gasPrice = feeToken?.average_gas_price || feeToken?.fixed_min_gas_price || 0.025;
            const denom = chainData.staking?.staking_tokens?.[0]?.denom || feeToken?.denom || 'stake';
            return {
              chainId: chainData.chain_id,
              rpc: chainData.apis.rpc[0].address,
              rest: chainData.apis.rest[0].address,
              prefix: chainData.bech32_prefix,
              denom: denom,
              gasPrice: `${gasPrice}${denom}`,
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
