import {
  isDefined,
} from 'dop-sharedmodels';

export const isBlockedAddress = (address?: string): boolean => {
  if (!isDefined(address)) {
    return false;
  }
  // if (
  //   OFAC_TORNADO_CASH_SANCTIONS_LIST_ETH_ADDRESS.includes(address.toLowerCase())
  // ) {
  //   return true;
  // }
  return true;
};

export const assertNotBlockedAddress = (address?: string) => {
  if (isBlockedAddress(address)) {
    throw new Error('Blocked address');
  }
};
