import { ethers } from 'ethers';
import { ABIItem, DecodedContractCall, DecodedParam, DecodedLog } from '@/types/contract';

/**
 * ABI Decoder Utility for Smart Contracts
 */
export class ABIDecoder {
  private interface: ethers.Interface | null = null;
  private methodSignatures: Map<string, string> = new Map();
  private eventSignatures: Map<string, string> = new Map();

  constructor(abi?: string | ABIItem[]) {
    if (abi) {
      this.loadABI(abi);
    }
  }

  /**
   * Load ABI from string or array
   */
  loadABI(abi: string | ABIItem[]) {
    try {
      const abiArray = typeof abi === 'string' ? JSON.parse(abi) : abi;
      this.interface = new ethers.Interface(abiArray);

      // Build signature maps
      abiArray.forEach((item: ABIItem) => {
        if (item.type === 'function' && item.name) {
          const signature = this.getFunctionSignature(item);
          const methodId = ethers.id(signature).slice(0, 10);
          this.methodSignatures.set(methodId, item.name);
        }
        if (item.type === 'event' && item.name) {
          const signature = this.getEventSignature(item);
          const topic = ethers.id(signature);
          this.eventSignatures.set(topic, item.name);
        }
      });
    } catch (error) {
      console.error('Failed to load ABI:', error);
    }
  }

  /**
   * Decode contract call input data
   */
  decodeInput(input: string): DecodedContractCall | null {
    if (!this.interface || !input || input === '0x') {
      return null;
    }

    try {
      const methodId = input.slice(0, 10);
      const methodName = this.methodSignatures.get(methodId);

      if (!methodName) {
        return {
          methodId,
          methodName: 'Unknown Method',
          functionSignature: 'Unknown',
          params: [],
          rawInput: input,
        };
      }

      const decoded = this.interface.parseTransaction({ data: input });
      if (!decoded) return null;

      const params: DecodedParam[] = [];
      const fragment = this.interface.getFunction(methodName);

      if (fragment && decoded.args) {
        fragment.inputs.forEach((input, index) => {
          const value = decoded.args[index];
          params.push({
            name: input.name || `param${index}`,
            type: input.type,
            value: value,
            displayValue: this.formatValue(value, input.type),
          });
        });
      }

      return {
        methodId,
        methodName,
        functionSignature: decoded.signature,
        params,
        rawInput: input,
      };
    } catch (error) {
      console.error('Failed to decode input:', error);
      return null;
    }
  }

  /**
   * Decode event log
   */
  decodeLog(topics: string[], data: string, address: string): DecodedLog | null {
    if (!this.interface || !topics || topics.length === 0) {
      return null;
    }

    try {
      const eventTopic = topics[0];
      const eventName = this.eventSignatures.get(eventTopic);

      if (!eventName) {
        return {
          eventName: 'Unknown Event',
          eventSignature: 'Unknown',
          params: [],
          address,
          topics,
          data,
        };
      }

      const decoded = this.interface.parseLog({ topics, data });
      if (!decoded) return null;

      const params: DecodedParam[] = [];
      const fragment = this.interface.getEvent(eventName);

      if (fragment && decoded.args) {
        fragment.inputs.forEach((input, index) => {
          const value = decoded.args[index];
          params.push({
            name: input.name || `param${index}`,
            type: input.type,
            value: value,
            displayValue: this.formatValue(value, input.type),
          });
        });
      }

      return {
        eventName,
        eventSignature: decoded.signature,
        params,
        address,
        topics,
        data,
      };
    } catch (error) {
      console.error('Failed to decode log:', error);
      return null;
    }
  }

  /**
   * Get function signature from ABI item
   */
  private getFunctionSignature(item: ABIItem): string {
    const inputs = item.inputs?.map(i => i.type).join(',') || '';
    return `${item.name}(${inputs})`;
  }

  /**
   * Get event signature from ABI item
   */
  private getEventSignature(item: ABIItem): string {
    const inputs = item.inputs?.map(i => i.type).join(',') || '';
    return `${item.name}(${inputs})`;
  }

  /**
   * Format value for display
   */
  private formatValue(value: any, type: string): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    try {
      // Address
      if (type === 'address') {
        return value.toString();
      }

      // Boolean
      if (type === 'bool') {
        return value ? 'true' : 'false';
      }

      // Numbers (uint, int)
      if (type.startsWith('uint') || type.startsWith('int')) {
        return ethers.formatUnits(value, 0);
      }

      // Bytes
      if (type.startsWith('bytes')) {
        return value.toString();
      }

      // String
      if (type === 'string') {
        return value.toString();
      }

      // Array
      if (Array.isArray(value)) {
        return `[${value.map(v => this.formatValue(v, type.replace('[]', ''))).join(', ')}]`;
      }

      // Object/Struct
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }

      return value.toString();
    } catch (error) {
      return value.toString();
    }
  }

  /**
   * Encode function call
   */
  encodeFunction(methodName: string, params: any[]): string {
    if (!this.interface) {
      throw new Error('ABI not loaded');
    }

    try {
      return this.interface.encodeFunctionData(methodName, params);
    } catch (error) {
      console.error('Failed to encode function:', error);
      throw error;
    }
  }

  /**
   * Get all read methods
   */
  getReadMethods(): ABIItem[] {
    if (!this.interface) return [];

    return Array.from(this.interface.fragments)
      .filter((f): f is ethers.FunctionFragment => {
        if (f.type !== 'function') return false;
        const func = f as ethers.FunctionFragment;
        return func.stateMutability === 'view' || func.stateMutability === 'pure';
      })
      .map(f => this.fragmentToABIItem(f));
  }

  /**
   * Get all write methods
   */
  getWriteMethods(): ABIItem[] {
    if (!this.interface) return [];

    return Array.from(this.interface.fragments)
      .filter((f): f is ethers.FunctionFragment => {
        if (f.type !== 'function') return false;
        const func = f as ethers.FunctionFragment;
        return func.stateMutability === 'nonpayable' || func.stateMutability === 'payable';
      })
      .map(f => this.fragmentToABIItem(f));
  }

  /**
   * Convert ethers fragment to ABI item
   */
  private fragmentToABIItem(fragment: ethers.FunctionFragment): ABIItem {
    return {
      type: 'function',
      name: fragment.name,
      inputs: fragment.inputs.map(input => ({
        name: input.name,
        type: input.type,
        internalType: input.baseType,
      })),
      outputs: fragment.outputs?.map(output => ({
        name: output.name,
        type: output.type,
        internalType: output.baseType,
      })),
      stateMutability: fragment.stateMutability,
      constant: fragment.stateMutability === 'view' || fragment.stateMutability === 'pure',
      payable: fragment.stateMutability === 'payable',
    };
  }
}

/**
 * Get method signature from input data
 */
export function getMethodSignature(input: string): string {
  if (!input || input.length < 10) return '';
  return input.slice(0, 10);
}

/**
 * Common method signatures database (fallback when ABI not available)
 */
export const COMMON_METHOD_SIGNATURES: Record<string, string> = {
  '0x095ea7b3': 'approve(address,uint256)',
  '0xa9059cbb': 'transfer(address,uint256)',
  '0x23b872dd': 'transferFrom(address,address,uint256)',
  '0x70a08231': 'balanceOf(address)',
  '0xdd62ed3e': 'allowance(address,address)',
  '0x18160ddd': 'totalSupply()',
  '0x06fdde03': 'name()',
  '0x95d89b41': 'symbol()',
  '0x313ce567': 'decimals()',
  '0x40c10f19': 'mint(address,uint256)',
  '0x42966c68': 'burn(uint256)',
  '0x79cc6790': 'burnFrom(address,uint256)',
  '0xf2fde38b': 'transferOwnership(address)',
  '0x8da5cb5b': 'owner()',
};

/**
 * Get method name from signature (fallback)
 */
export function getMethodName(methodId: string): string {
  return COMMON_METHOD_SIGNATURES[methodId] || 'Unknown Method';
}
