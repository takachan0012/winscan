/**
 * Create an authz MsgGrant for auto-compound using proper protobuf encoding
 * This uses `cosmjs-types` to encode a `StakeAuthorization` and packs it into
 * the Any.value as bytes. This replaces the fragile manual buffer approach.
 */
import { StakeAuthorization as StakeAuthorizationType } from 'cosmjs-types/cosmos/staking/v1beta1/authz';
import { GenericAuthorization } from 'cosmjs-types/cosmos/authz/v1beta1/authz';

export function createSimpleAutoCompoundGrant(
  delegatorAddress: string,
  grantee: string,
  validatorAddress: string,
  durationSeconds: number
) {
  const expirationTimestamp = {
    seconds: Math.floor(Date.now() / 1000) + durationSeconds,
    nanos: 0,
  };

  const grants: any[] = [];

  // 1. StakeAuthorization for delegation
  const stakeAuthPayload: any = {
    allowList: {
      address: [validatorAddress],
    },
    authorizationType: 1, // 1 = DELEGATE
  };
  const stakeEncoded = StakeAuthorizationType.encode(StakeAuthorizationType.fromPartial(stakeAuthPayload)).finish();

  grants.push({
    typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
    value: {
      granter: delegatorAddress,
      grantee: grantee,
      grant: {
        authorization: {
          typeUrl: '/cosmos.staking.v1beta1.StakeAuthorization',
          value: stakeEncoded,
        },
        expiration: expirationTimestamp,
      },
    },
  });

  // 2. GenericAuthorization for MsgWithdrawDelegatorReward (REQUIRED)
  const withdrawRewardAuthPayload = {
    msg: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
  };
  const withdrawRewardEncoded = GenericAuthorization.encode(GenericAuthorization.fromPartial(withdrawRewardAuthPayload)).finish();

  grants.push({
    typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
    value: {
      granter: delegatorAddress,
      grantee: grantee,
      grant: {
        authorization: {
          typeUrl: '/cosmos.authz.v1beta1.GenericAuthorization',
          value: withdrawRewardEncoded,
        },
        expiration: expirationTimestamp,
      },
    },
  });

  return grants;
}

/**
 * Create multiple grants for auto-compound with optional vote and commission permissions
 * Used when granter is a validator
 */
export function createAutoCompoundGrantsWithPermissions(
  delegatorAddress: string,
  grantee: string,
  validatorAddress: string,
  durationSeconds: number,
  options: {
    includeVote?: boolean;
    includeCommission?: boolean;
  } = {}
) {
  const expirationTimestamp = {
    seconds: Math.floor(Date.now() / 1000) + durationSeconds,
    nanos: 0,
  };

  const grants: any[] = [];

  // 1. Always include StakeAuthorization for delegation
  const stakeAuthPayload: any = {
    allowList: {
      address: [validatorAddress],
    },
    authorizationType: 1, // 1 = DELEGATE
  };
  const stakeEncoded = StakeAuthorizationType.encode(StakeAuthorizationType.fromPartial(stakeAuthPayload)).finish();
  
  grants.push({
    typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
    value: {
      granter: delegatorAddress,
      grantee: grantee,
      grant: {
        authorization: {
          typeUrl: '/cosmos.staking.v1beta1.StakeAuthorization',
          value: stakeEncoded,
        },
        expiration: expirationTimestamp,
      },
    },
  });

  // 2. Always include GenericAuthorization for MsgWithdrawDelegatorReward (REQUIRED for auto-compound)
  const withdrawRewardAuthPayload = {
    msg: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
  };
  const withdrawRewardEncoded = GenericAuthorization.encode(GenericAuthorization.fromPartial(withdrawRewardAuthPayload)).finish();
  
  grants.push({
    typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
    value: {
      granter: delegatorAddress,
      grantee: grantee,
      grant: {
        authorization: {
          typeUrl: '/cosmos.authz.v1beta1.GenericAuthorization',
          value: withdrawRewardEncoded,
        },
        expiration: expirationTimestamp,
      },
    },
  });

  // 3. Add GenericAuthorization for MsgVote (governance)
  if (options.includeVote) {
    const voteAuthPayload = {
      msg: '/cosmos.gov.v1beta1.MsgVote',
    };
    const voteEncoded = GenericAuthorization.encode(GenericAuthorization.fromPartial(voteAuthPayload)).finish();
    
    grants.push({
      typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
      value: {
        granter: delegatorAddress,
        grantee: grantee,
        grant: {
          authorization: {
            typeUrl: '/cosmos.authz.v1beta1.GenericAuthorization',
            value: voteEncoded,
          },
          expiration: expirationTimestamp,
        },
      },
    });
  }

  // 4. Add GenericAuthorization for MsgWithdrawValidatorCommission
  if (options.includeCommission) {
    const commissionAuthPayload = {
      msg: '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
    };
    const commissionEncoded = GenericAuthorization.encode(GenericAuthorization.fromPartial(commissionAuthPayload)).finish();
    
    grants.push({
      typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
      value: {
        granter: delegatorAddress,
        grantee: grantee,
        grant: {
          authorization: {
            typeUrl: '/cosmos.authz.v1beta1.GenericAuthorization',
            value: commissionEncoded,
          },
          expiration: expirationTimestamp,
        },
      },
    });
  }

  return grants;
}
