/**
 * Auto-Compound Grant Query
 * Query grants directly from blockchain instead of localStorage
 */

interface GrantQueryResult {
  hasGrant: boolean;
  grantee?: string;
  expiration?: string;
}

/**
 * Query auto-compound grant from blockchain
 */
export async function queryAutoCompoundGrant(
  restEndpoint: string,
  granterAddress: string,
  validatorAddress?: string
): Promise<GrantQueryResult> {
  try {
    // Query all grants for the granter
    const response = await fetch(
      `${restEndpoint}/cosmos/authz/v1beta1/grants/granter/${granterAddress}`
    );

    if (!response.ok) {
      console.warn('Failed to query grants:', response.statusText);
      return { hasGrant: false };
    }

    const data = await response.json();
    
    if (!data.grants || data.grants.length === 0) {
      return { hasGrant: false };
    }

    // Look for StakeAuthorization grants (for MsgDelegate)
    const stakeGrants = data.grants.filter((grant: any) => {
      const authType = grant.authorization?.['@type'] || '';
      return authType.includes('StakeAuthorization');
    });

    if (stakeGrants.length === 0) {
      return { hasGrant: false };
    }

    // If validator specified, check for validator-specific grant
    if (validatorAddress) {
      const validatorGrant = stakeGrants.find((grant: any) => {
        const allowList = grant.authorization?.allow_list?.address || [];
        return allowList.includes(validatorAddress);
      });

      if (validatorGrant) {
        return {
          hasGrant: true,
          grantee: validatorGrant.grantee,
          expiration: validatorGrant.expiration
        };
      }
      
      // If validator specified but no grant found, return false
      return { hasGrant: false };
    }

    // Only return true if no validator specified (query all grants)
    if (stakeGrants.length > 0) {
      return {
        hasGrant: true,
        grantee: stakeGrants[0].grantee,
        expiration: stakeGrants[0].expiration
      };
    }

    return { hasGrant: false };
  } catch (error) {
    console.error('Error querying auto-compound grant:', error);
    return { hasGrant: false };
  }
}

/**
 * Check if validator has active auto-compound grant
 */
export async function hasActiveAutoCompound(
  restEndpoint: string,
  granterAddress: string,
  validatorAddress: string
): Promise<boolean> {
  const result = await queryAutoCompoundGrant(
    restEndpoint,
    granterAddress,
    validatorAddress
  );
  
  return result.hasGrant;
}
