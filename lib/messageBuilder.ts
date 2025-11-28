/**
 * Test: Create a proper authz grant message
 * Following cosmjs and cosmos-sdk standards
 */

// Proper way to create MsgGrant with StakeAuthorization
// Using Cosmos SDK amino JSON format which Keplr can sign

export function createAutoCompoundGrantMessage(
  delegatorAddress: string,
  granteeAddress: string,
  validatorAddress: string,
  durationSeconds: number
) {
  const expirationDate = new Date(Date.now() + (durationSeconds * 1000));

  return {
    type: 'cosmos-sdk/MsgGrant',
    value: {
      granter: delegatorAddress,
      grantee: granteeAddress,
      grant: {
        authorization: {
          type: 'cosmos-sdk/StakeAuthorization',
          value: {
            delegator_address: delegatorAddress,
            validator_address: validatorAddress,
            authorization_type: 1, // AUTHORIZATION_TYPE_DELEGATE
            max_tokens: null
          }
        },
        expiration: expirationDate.toISOString()
      }
    }
  };
}
