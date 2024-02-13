import {
  RailgunPopulateTransactionResponse,
  RailgunTransactionGasEstimateResponse,
  NetworkName,
  RailgunERC20AmountRecipient,
  RailgunNFTAmountRecipient,
  NFTTokenType,
  TransactionGasDetails,
} from 'dop-sharedmodels';
import {
  EncryptNote,
  RailgunEngine,
  EncryptRequestStruct,
  randomHex,
  hexToBytes,
  EncryptNoteERC20,
  EncryptNoteNFT,
  ERC721_NOTE_VALUE,
} from 'dop-engineengine';
import {
  gasEstimateResponse,
  getGasEstimate,
  setGasDetailsForTransaction,
} from './tx-gas-details';
import { assertNotBlockedAddress } from '../../utils/blocked-address';
import {
  assertValidRailgunAddress,
  getRailgunSmartWalletContractForNetwork,
} from '../railgun';
import { createNFTTokenDataFromRailgunNFTAmount } from './tx-cross-contract-calls';
import { reportAndSanitizeError } from '../../utils/error';
import { ContractTransaction } from 'ethers';

export const getEncryptPrivateKeySignatureMessage = () => {
  return EncryptNote.getEncryptPrivateKeySignatureMessage();
};

const generateERC20EncryptRequests = async (
  erc20AmountRecipient: RailgunERC20AmountRecipient,
  random: string,
  encryptPrivateKey: string,
): Promise<EncryptRequestStruct> => {
  const railgunAddress = erc20AmountRecipient.recipientAddress;

  assertValidRailgunAddress(railgunAddress);

  const { masterPublicKey, viewingPublicKey } =
    RailgunEngine.decodeAddress(railgunAddress);

  const encrypt = new EncryptNoteERC20(
    masterPublicKey,
    random,
    erc20AmountRecipient.amount,
    erc20AmountRecipient.tokenAddress,
  );
  return encrypt.serialize(hexToBytes(encryptPrivateKey), viewingPublicKey);
};

const generateNFTEncryptRequests = async (
  nftAmountRecipient: RailgunNFTAmountRecipient,
  random: string,
  encryptPrivateKey: string,
): Promise<EncryptRequestStruct> => {
  const railgunAddress = nftAmountRecipient.recipientAddress;

  assertValidRailgunAddress(railgunAddress);

  const { masterPublicKey, viewingPublicKey } =
    RailgunEngine.decodeAddress(railgunAddress);

  const value =
    nftAmountRecipient.nftTokenType === NFTTokenType.ERC721
      ? ERC721_NOTE_VALUE
      : nftAmountRecipient.amount;

  const nftTokenData =
    createNFTTokenDataFromRailgunNFTAmount(nftAmountRecipient);

  const encrypt = new EncryptNoteNFT(
    masterPublicKey,
    random,
    value,
    nftTokenData,
  );
  return encrypt.serialize(hexToBytes(encryptPrivateKey), viewingPublicKey);
};

export const generateEncryptTransaction = async (
  networkName: NetworkName,
  encryptPrivateKey: string,
  erc20AmountRecipients: RailgunERC20AmountRecipient[],
  nftAmountRecipients: RailgunNFTAmountRecipient[],
): Promise<ContractTransaction> => {
  try {
    const railgunSmartWalletContract =
      getRailgunSmartWalletContractForNetwork(networkName);
    const random = randomHex(16);

    const encryptInputs: EncryptRequestStruct[] = await Promise.all([
      ...erc20AmountRecipients.map(erc20AmountRecipient =>
        generateERC20EncryptRequests(
          erc20AmountRecipient,
          random,
          encryptPrivateKey,
        ),
      ),
      ...nftAmountRecipients.map(nftAmountRecipient =>
        generateNFTEncryptRequests(nftAmountRecipient, random, encryptPrivateKey),
      ),
    ]);

    const transaction = await railgunSmartWalletContract.generateEncrypt(
      encryptInputs,
    );
    return transaction;
  } catch (err) {
    const sanitizedError = reportAndSanitizeError(
      generateEncryptTransaction.name,
      err,
    );
    throw sanitizedError;
  }
};

export const populateEncrypt = async (
  networkName: NetworkName,
  encryptPrivateKey: string,
  erc20AmountRecipients: RailgunERC20AmountRecipient[],
  nftAmountRecipients: RailgunNFTAmountRecipient[],
  gasDetails?: TransactionGasDetails,
): Promise<RailgunPopulateTransactionResponse> => {
  try {
    const transaction = await generateEncryptTransaction(
      networkName,
      encryptPrivateKey,
      erc20AmountRecipients,
      nftAmountRecipients,
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
    throw reportAndSanitizeError(populateEncrypt.name, err);
  }
};

export const gasEstimateForEncrypt = async (
  networkName: NetworkName,
  encryptPrivateKey: string,
  erc20AmountRecipients: RailgunERC20AmountRecipient[],
  nftAmountRecipients: RailgunNFTAmountRecipient[],
  fromWalletAddress: string,
): Promise<RailgunTransactionGasEstimateResponse> => {
  try {
    assertNotBlockedAddress(fromWalletAddress);

    const transaction = await generateEncryptTransaction(
      networkName,
      encryptPrivateKey,
      erc20AmountRecipients,
      nftAmountRecipients,
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
    throw reportAndSanitizeError(gasEstimateForEncrypt.name, err);
  }
};
