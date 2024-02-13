import {
  RailgunPopulateTransactionResponse,
  RailgunTransactionGasEstimateResponse,
  RailgunERC20Amount,
  NetworkName,
  ProofType,
  FeeTokenDetails,
  RailgunERC20AmountRecipient,
  RailgunNFTAmountRecipient,
  TransactionGasDetails,
} from 'dop-sharedmodels';
import {
  generateDummyProofTransactions,
  generateTransact,
  generateDecryptBaseToken,
} from './tx-generator';
import { populateProvedTransaction } from './proof-cache';
import { randomHex, TransactionStruct } from 'dop-engineengine';
import { gasEstimateResponseDummyProofIterativeRelayerFee } from './tx-gas-relayer-fee-estimator';
import { createRelayAdaptDecryptERC20AmountRecipients } from './tx-cross-contract-calls';
import { reportAndSanitizeError } from '../../utils/error';

export const populateProvedDecrypt = async (
  networkName: NetworkName,
  railgunWalletID: string,
  erc20AmountRecipients: RailgunERC20AmountRecipient[],
  nftAmountRecipients: RailgunNFTAmountRecipient[],
  relayerFeeERC20AmountRecipient: Optional<RailgunERC20AmountRecipient>,
  sendWithPublicWallet: boolean,
  overallBatchMinGasPrice: Optional<bigint>,
  gasDetails: TransactionGasDetails,
): Promise<RailgunPopulateTransactionResponse> => {
  try {
    const { transaction, nullifiers } = await populateProvedTransaction(
      networkName,
      ProofType.Decrypt,
      railgunWalletID,
      false, // showSenderAddressToRecipient
      undefined, // memoText
      erc20AmountRecipients,
      nftAmountRecipients,
      undefined, // relayAdaptDecryptERC20AmountRecipients
      undefined, // relayAdaptDecryptNFTAmounts
      undefined, // relayAdaptEncryptERC20Recipients
      undefined, // relayAdaptEncryptNFTRecipients
      undefined, // crossContractCalls
      relayerFeeERC20AmountRecipient,
      sendWithPublicWallet,
      overallBatchMinGasPrice,
      gasDetails,
    );
    return {
      nullifiers,
      transaction,
    };
  } catch (err) {
    throw reportAndSanitizeError(populateProvedDecrypt.name, err);
  }
};

export const populateProvedDecryptBaseToken = async (
  networkName: NetworkName,
  publicWalletAddress: string,
  railgunWalletID: string,
  wrappedERC20Amount: RailgunERC20Amount,
  relayerFeeERC20AmountRecipient: Optional<RailgunERC20AmountRecipient>,
  sendWithPublicWallet: boolean,
  overallBatchMinGasPrice: Optional<bigint>,
  gasDetails: TransactionGasDetails,
): Promise<RailgunPopulateTransactionResponse> => {
  try {
    const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
      {
        ...wrappedERC20Amount,
        recipientAddress: publicWalletAddress,
      },
    ];
    const relayAdaptDecryptERC20Amounts: RailgunERC20Amount[] = [
      wrappedERC20Amount,
    ];

    // Empty NFT Recipients.
    const nftAmountRecipients: RailgunNFTAmountRecipient[] = [];

    const { transaction, nullifiers } = await populateProvedTransaction(
      networkName,
      ProofType.DecryptBaseToken,
      railgunWalletID,
      false, // showSenderAddressToRecipient
      undefined, // memoText
      erc20AmountRecipients,
      nftAmountRecipients,
      relayAdaptDecryptERC20Amounts,
      undefined, // relayAdaptDecryptNFTAmounts
      undefined, // relayAdaptEncryptERC20Recipients
      undefined, // relayAdaptEncryptNFTRecipients
      undefined, // crossContractCalls
      relayerFeeERC20AmountRecipient,
      sendWithPublicWallet,
      overallBatchMinGasPrice,
      gasDetails,
    );
    return {
      nullifiers,
      transaction,
    };
  } catch (err) {
    throw reportAndSanitizeError(populateProvedDecryptBaseToken.name, err);
  }
};

export const gasEstimateForUnprovenDecrypt = async (
  networkName: NetworkName,
  railgunWalletID: string,
  encryptionKey: string,
  erc20AmountRecipients: RailgunERC20AmountRecipient[],
  nftAmountRecipients: RailgunNFTAmountRecipient[],
  originalGasDetails: TransactionGasDetails,
  feeTokenDetails: Optional<FeeTokenDetails>,
  sendWithPublicWallet: boolean,
): Promise<RailgunTransactionGasEstimateResponse> => {
  try {
    const overallBatchMinGasPrice = 0n;

    const response = await gasEstimateResponseDummyProofIterativeRelayerFee(
      (relayerFeeERC20Amount: Optional<RailgunERC20Amount>) =>
        generateDummyProofTransactions(
          ProofType.Decrypt,
          networkName,
          railgunWalletID,
          encryptionKey,
          false, // showSenderAddressToRecipient
          undefined, // memoText
          erc20AmountRecipients,
          nftAmountRecipients,
          relayerFeeERC20Amount,
          sendWithPublicWallet,
          overallBatchMinGasPrice,
        ),
      (txs: TransactionStruct[]) =>
        generateTransact(
          txs,
          networkName,
          true, // useDummyProof
        ),
      networkName,
      railgunWalletID,
      erc20AmountRecipients,
      originalGasDetails,
      feeTokenDetails,
      sendWithPublicWallet,
      false, // isCrossContractCall
    );
    return response;
  } catch (err) {
    throw reportAndSanitizeError(gasEstimateForUnprovenDecrypt.name, err);
  }
};

export const gasEstimateForUnprovenDecryptBaseToken = async (
  networkName: NetworkName,
  publicWalletAddress: string,
  railgunWalletID: string,
  encryptionKey: string,
  wrappedERC20Amount: RailgunERC20Amount,
  originalGasDetails: TransactionGasDetails,
  feeTokenDetails: Optional<FeeTokenDetails>,
  sendWithPublicWallet: boolean,
): Promise<RailgunTransactionGasEstimateResponse> => {
  try {
    const relayAdaptDecryptERC20AmountRecipients: RailgunERC20AmountRecipient[] =
      createRelayAdaptDecryptERC20AmountRecipients(networkName, [
        wrappedERC20Amount,
      ]);

    // Empty NFT Recipients.
    const nftAmountRecipients: RailgunNFTAmountRecipient[] = [];

    const overallBatchMinGasPrice = 0n;

    const response = await gasEstimateResponseDummyProofIterativeRelayerFee(
      (relayerFeeERC20Amount: Optional<RailgunERC20Amount>) =>
        generateDummyProofTransactions(
          ProofType.DecryptBaseToken,
          networkName,
          railgunWalletID,
          encryptionKey,
          false, // showSenderAddressToRecipient
          undefined, // memoText
          relayAdaptDecryptERC20AmountRecipients,
          nftAmountRecipients,
          relayerFeeERC20Amount,
          sendWithPublicWallet,
          overallBatchMinGasPrice,
        ),
      (txs: TransactionStruct[]) => {
        const relayAdaptParamsRandom = randomHex(31);
        return generateDecryptBaseToken(
          txs,
          networkName,
          publicWalletAddress,
          relayAdaptParamsRandom,
          true, // useDummyProof
        );
      },
      networkName,
      railgunWalletID,
      relayAdaptDecryptERC20AmountRecipients,
      originalGasDetails,
      feeTokenDetails,
      sendWithPublicWallet,
      false, // isCrossContractCall
    );
    return response;
  } catch (err) {
    throw reportAndSanitizeError(
      gasEstimateForUnprovenDecryptBaseToken.name,
      err,
    );
  }
};
