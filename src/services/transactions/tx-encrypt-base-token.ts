import {
  RailgunPopulateTransactionResponse,
  RailgunTransactionGasEstimateResponse,
  RailgunERC20Amount,
  NetworkName,
  TransactionGasDetails,
} from 'dop-sharedmodels';
import { getRelayAdaptContractForNetwork } from '../railgun/core/providers';
import {
  gasEstimateResponse,
  getGasEstimate,
  setGasDetailsForTransaction,
} from './tx-gas-details';
import { assertNotBlockedAddress } from '../../utils/blocked-address';
import {
  randomHex,
  EncryptNoteERC20,
  RailgunEngine,
  hexToBytes,
} from 'dop-engineengine';
import { assertValidRailgunAddress } from '../railgun';
import { reportAndSanitizeError } from '../../utils/error';
import { ContractTransaction } from 'ethers';

const generateEncryptBaseTokenTransaction = async (
  networkName: NetworkName,
  railgunAddress: string,
  encryptPrivateKey: string,
  wrappedERC20Amount: RailgunERC20Amount,
): Promise<ContractTransaction> => {
  try {
    const relayAdaptContract = getRelayAdaptContractForNetwork(networkName);
    const { masterPublicKey, viewingPublicKey } =
      RailgunEngine.decodeAddress(railgunAddress);
    const random = randomHex(16);

    const { amount, tokenAddress } = wrappedERC20Amount;

    const encrypt = new EncryptNoteERC20(
      masterPublicKey,
      random,
      amount,
      tokenAddress,
    );

    const encryptRequest = await encrypt.serialize(
      hexToBytes(encryptPrivateKey),
      viewingPublicKey,
    );

    const transaction = await relayAdaptContract.populateEncryptBaseToken(
      encryptRequest,
    );

    return transaction;
  } catch (err) {
    const sanitizedError = reportAndSanitizeError(
      generateEncryptBaseTokenTransaction.name,
      err,
    );
    throw sanitizedError;
  }
};

export const populateEncryptBaseToken = async (
  networkName: NetworkName,
  railgunAddress: string,
  encryptPrivateKey: string,
  wrappedERC20Amount: RailgunERC20Amount,
  gasDetails?: TransactionGasDetails,
): Promise<RailgunPopulateTransactionResponse> => {
  try {
    assertValidRailgunAddress(railgunAddress);

    const transaction = await generateEncryptBaseTokenTransaction(
      networkName,
      railgunAddress,
      encryptPrivateKey,
      wrappedERC20Amount,
    );

    if (gasDetails) {
      const sendWithPublicWallet = true;
      setGasDetailsForTransaction(
        networkName,
        transaction,
        gasDetails,
        sendWithPublicWallet,
      );
    }

    return {
      transaction,
    };
  } catch (err) {
    throw reportAndSanitizeError(populateEncryptBaseToken.name, err);
  }
};

export const gasEstimateForEncryptBaseToken = async (
  networkName: NetworkName,
  railgunAddress: string,
  encryptPrivateKey: string,
  wrappedERC20Amount: RailgunERC20Amount,
  fromWalletAddress: string,
): Promise<RailgunTransactionGasEstimateResponse> => {
  try {
    assertValidRailgunAddress(railgunAddress);
    assertNotBlockedAddress(fromWalletAddress);

    const transaction = await generateEncryptBaseTokenTransaction(
      networkName,
      railgunAddress,
      encryptPrivateKey,
      wrappedERC20Amount,
    );

    const sendWithPublicWallet = true;
    const isGasEstimateWithDummyProof = false;
    return gasEstimateResponse(
      await getGasEstimate(
        networkName,
        transaction,
        fromWalletAddress,
        sendWithPublicWallet,
        false, // isCrossContractCall
      ),
      undefined, // relayerFeeCommitment
      isGasEstimateWithDummyProof,
    );
  } catch (err) {
    throw reportAndSanitizeError(gasEstimateForEncryptBaseToken.name, err);
  }
};
