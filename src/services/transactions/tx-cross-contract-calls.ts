import {
  RailgunPopulateTransactionResponse,
  RailgunTransactionGasEstimateResponse,
  RailgunERC20Amount,
  NetworkName,
  ProofType,
  TransactionReceiptLog,
  FeeTokenDetails,
  RailgunERC20AmountRecipient,
  RailgunNFTAmountRecipient,
  RailgunNFTAmount,
  TransactionGasDetails,
  isDefined,
  RailgunERC20Recipient,
} from 'dop-sharedmodels';
import { getRelayAdaptContractForNetwork } from '../railgun/core/providers';
import {
  generateDummyProofTransactions,
  generateProofTransactions,
  nullifiersForTransactions,
} from './tx-generator';
import {
  populateProvedTransaction,
  setCachedProvedTransaction,
} from './proof-cache';
import { sendErrorMessage } from '../../utils/logger';
import {
  RelayAdaptHelper,
  AdaptID,
  TransactionStruct,
  hexlify,
  randomHex,
  RelayAdaptContract,
  ProverProgressCallback,
  NFTTokenData,
  formatToByteLength,
  ByteLength,
  MINIMUM_RELAY_ADAPT_CROSS_CONTRACT_CALLS_GAS_LIMIT,
  RelayAdaptEncryptNFTRecipient,
} from 'dop-engineengine';
import { assertNotBlockedAddress } from '../../utils/blocked-address';
import { gasEstimateResponseDummyProofIterativeRelayerFee } from './tx-gas-relayer-fee-estimator';
import { reportAndSanitizeError } from '../../utils/error';
import { ContractTransaction, Log } from 'ethers';

const createValidCrossContractCalls = (
  crossContractCalls: ContractTransaction[],
): ContractTransaction[] => {
  if (!crossContractCalls.length) {
    throw new Error('No cross contract calls in transaction.');
  }
  try {
    return crossContractCalls.map(transactionRequest => {
      if (!transactionRequest.to || !transactionRequest.data) {
        throw new Error(`Cross-contract calls require 'to' and 'data' fields.`);
      }
      const transaction: ContractTransaction = {
        to: transactionRequest.to,
        value: transactionRequest.value,
        data: hexlify(transactionRequest.data, true),
      };
      assertNotBlockedAddress(transaction.to);
      return transaction;
    });
  } catch (err) {
    if (!(err instanceof Error)) {
      throw err;
    }
    throw reportAndSanitizeError(createValidCrossContractCalls.name, err);
  }
};

export const createRelayAdaptDecryptERC20AmountRecipients = (
  networkName: NetworkName,
  decryptERC20Amounts: RailgunERC20Amount[],
): RailgunERC20AmountRecipient[] => {
  const relayAdaptContract = getRelayAdaptContractForNetwork(networkName);
  const decryptERC20AmountRecipients: RailgunERC20AmountRecipient[] =
    decryptERC20Amounts.map(decryptERC20Amount => ({
      ...decryptERC20Amount,
      recipientAddress: relayAdaptContract.address,
    }));
  return decryptERC20AmountRecipients;
};

export const createRelayAdaptDecryptNFTAmountRecipients = (
  networkName: NetworkName,
  decryptNFTAmounts: RailgunNFTAmount[],
): RailgunNFTAmountRecipient[] => {
  const relayAdaptContract = getRelayAdaptContractForNetwork(networkName);
  const decryptNFTAmountRecipients: RailgunNFTAmountRecipient[] =
    decryptNFTAmounts.map(decryptNFTAmount => ({
      ...decryptNFTAmount,
      recipientAddress: relayAdaptContract.address,
    }));
  return decryptNFTAmountRecipients;
};

export const createNFTTokenDataFromRailgunNFTAmount = (
  nftAmount: RailgunNFTAmount,
): NFTTokenData => {
  return {
    tokenAddress: formatToByteLength(
      nftAmount.nftAddress,
      ByteLength.Address,
      true,
    ),
    tokenType: nftAmount.nftTokenType as 1 | 2,
    tokenSubID: formatToByteLength(
      nftAmount.tokenSubID,
      ByteLength.UINT_256,
      true,
    ),
  };
};

const createRelayAdaptEncryptNFTRecipients = (
  relayAdaptEncryptNFTRecipients: RailgunNFTAmountRecipient[],
): RelayAdaptEncryptNFTRecipient[] => {
  return relayAdaptEncryptNFTRecipients.map(
    (nftRecipient: RailgunNFTAmountRecipient) => ({
      nftTokenData: createNFTTokenDataFromRailgunNFTAmount(nftRecipient),
      recipientAddress: nftRecipient.recipientAddress,
    }),
  );
};

export const populateProvedCrossContractCalls = async (
  networkName: NetworkName,
  railgunWalletID: string,
  relayAdaptDecryptERC20Amounts: RailgunERC20Amount[],
  relayAdaptDecryptNFTAmounts: RailgunNFTAmount[],
  relayAdaptEncryptERC20Recipients: RailgunERC20Recipient[],
  relayAdaptEncryptNFTRecipients: RailgunNFTAmountRecipient[],
  crossContractCalls: ContractTransaction[],
  relayerFeeERC20AmountRecipient: Optional<RailgunERC20AmountRecipient>,
  sendWithPublicWallet: boolean,
  overallBatchMinGasPrice: Optional<bigint>,
  gasDetails: TransactionGasDetails,
): Promise<RailgunPopulateTransactionResponse> => {
  try {
    const { transaction, nullifiers } = await populateProvedTransaction(
      networkName,
      ProofType.CrossContractCalls,
      railgunWalletID,
      false, // showSenderAddressToRecipient
      undefined, // memoText
      [], // erc20AmountRecipients
      [], // nftAmountRecipients
      relayAdaptDecryptERC20Amounts,
      relayAdaptDecryptNFTAmounts,
      relayAdaptEncryptERC20Recipients,
      relayAdaptEncryptNFTRecipients,
      crossContractCalls,
      relayerFeeERC20AmountRecipient,
      sendWithPublicWallet,
      overallBatchMinGasPrice,
      gasDetails,
    );
    delete transaction.from;

    return {
      nullifiers,
      transaction,
    };
  } catch (err) {
    throw reportAndSanitizeError(populateProvedCrossContractCalls.name, err);
  }
};

export const gasEstimateForUnprovenCrossContractCalls = async (
  networkName: NetworkName,
  railgunWalletID: string,
  encryptionKey: string,
  relayAdaptDecryptERC20Amounts: RailgunERC20Amount[],
  relayAdaptDecryptNFTAmounts: RailgunNFTAmount[],
  relayAdaptEncryptERC20Recipients: RailgunERC20Recipient[],
  relayAdaptEncryptNFTRecipients: RailgunNFTAmountRecipient[],
  crossContractCalls: ContractTransaction[],
  originalGasDetails: TransactionGasDetails,
  feeTokenDetails: Optional<FeeTokenDetails>,
  sendWithPublicWallet: boolean,
  minGasLimit: Optional<bigint>,
): Promise<RailgunTransactionGasEstimateResponse> => {
  try {
    setCachedProvedTransaction(undefined);

    const overallBatchMinGasPrice = 0n;

    const validCrossContractCalls =
      createValidCrossContractCalls(crossContractCalls);

    const relayAdaptContract = getRelayAdaptContractForNetwork(networkName);

    const relayAdaptDecryptERC20AmountRecipients: RailgunERC20AmountRecipient[] =
      createRelayAdaptDecryptERC20AmountRecipients(
        networkName,
        relayAdaptDecryptERC20Amounts,
      );
    const relayAdaptDecryptNFTAmountRecipients: RailgunNFTAmountRecipient[] =
      createRelayAdaptDecryptNFTAmountRecipients(
        networkName,
        relayAdaptDecryptNFTAmounts,
      );

    const encryptRandom = randomHex(16);
    const relayEncryptRequests =
      await RelayAdaptHelper.generateRelayEncryptRequests(
        encryptRandom,
        relayAdaptEncryptERC20Recipients,
        createRelayAdaptEncryptNFTRecipients(relayAdaptEncryptNFTRecipients),
      );

    const minimumGasLimit =
      minGasLimit ?? MINIMUM_RELAY_ADAPT_CROSS_CONTRACT_CALLS_GAS_LIMIT;

    const response = await gasEstimateResponseDummyProofIterativeRelayerFee(
      (relayerFeeERC20Amount: Optional<RailgunERC20Amount>) =>
        generateDummyProofTransactions(
          ProofType.CrossContractCalls,
          networkName,
          railgunWalletID,
          encryptionKey,
          false, // showSenderAddressToRecipient
          undefined, // memoText
          relayAdaptDecryptERC20AmountRecipients,
          relayAdaptDecryptNFTAmountRecipients,
          relayerFeeERC20Amount,
          sendWithPublicWallet,
          overallBatchMinGasPrice,
        ),
      async (txs: TransactionStruct[]) => {
        const relayAdaptParamsRandom = randomHex(31);

        // TODO: We should add the relay adapt contract gas limit here.
        const transaction = await relayAdaptContract.populateCrossContractCalls(
          txs,
          validCrossContractCalls,
          relayEncryptRequests,
          relayAdaptParamsRandom,
          true, // isGasEstimate
          !sendWithPublicWallet, // isRelayerTransaction
          minimumGasLimit,
        );
        // Remove gasLimit, we'll set to the minimum below.
        // TODO: Remove after callbacks upgrade.
        delete transaction.gasLimit;
        return transaction;
      },
      networkName,
      railgunWalletID,
      relayAdaptDecryptERC20AmountRecipients,
      originalGasDetails,
      feeTokenDetails,
      sendWithPublicWallet,
      true, // isCrossContractCall
    );

    // TODO: Remove this after callbacks upgrade.
    // If gas estimate is under the cross-contract-minimum, replace it with the minimum.
    if (response.gasEstimate) {
      if (response.gasEstimate < minimumGasLimit) {
        response.gasEstimate = minimumGasLimit;
      }
    }

    return response;
  } catch (err) {
    throw reportAndSanitizeError(
      gasEstimateForUnprovenCrossContractCalls.name,
      err,
    );
  }
};

export const generateCrossContractCallsProof = async (
  networkName: NetworkName,
  railgunWalletID: string,
  encryptionKey: string,
  relayAdaptDecryptERC20Amounts: RailgunERC20Amount[],
  relayAdaptDecryptNFTAmounts: RailgunNFTAmount[],
  relayAdaptEncryptERC20Recipients: RailgunERC20Recipient[],
  relayAdaptEncryptNFTRecipients: RailgunNFTAmountRecipient[],
  crossContractCalls: ContractTransaction[],
  relayerFeeERC20AmountRecipient: Optional<RailgunERC20AmountRecipient>,
  sendWithPublicWallet: boolean,
  overallBatchMinGasPrice: Optional<bigint>,
  minGasLimit: Optional<bigint>,
  progressCallback: ProverProgressCallback,
): Promise<void> => {
  try {
    setCachedProvedTransaction(undefined);

    const validCrossContractCalls =
      createValidCrossContractCalls(crossContractCalls);

    const relayAdaptContract = getRelayAdaptContractForNetwork(networkName);

    const relayAdaptDecryptERC20AmountRecipients: RailgunERC20AmountRecipient[] =
      createRelayAdaptDecryptERC20AmountRecipients(
        networkName,
        relayAdaptDecryptERC20Amounts,
      );
    const relayAdaptDecryptNFTAmountRecipients: RailgunNFTAmountRecipient[] =
      createRelayAdaptDecryptNFTAmountRecipients(
        networkName,
        relayAdaptDecryptNFTAmounts,
      );

    // Generate dummy txs for relay adapt params.
    const dummyDecryptTxs = await generateDummyProofTransactions(
      ProofType.CrossContractCalls,
      networkName,
      railgunWalletID,
      encryptionKey,
      false, // showSenderAddressToRecipient
      undefined, // memoText
      relayAdaptDecryptERC20AmountRecipients,
      relayAdaptDecryptNFTAmountRecipients,
      relayerFeeERC20AmountRecipient,
      sendWithPublicWallet,
      overallBatchMinGasPrice,
    );

    // Generate relay adapt params from dummy transactions.
    const encryptRandom = randomHex(16);

    const relayEncryptRequests =
      await RelayAdaptHelper.generateRelayEncryptRequests(
        encryptRandom,
        relayAdaptEncryptERC20Recipients,
        createRelayAdaptEncryptNFTRecipients(relayAdaptEncryptNFTRecipients),
      );

    const minimumGasLimit =
      minGasLimit ?? MINIMUM_RELAY_ADAPT_CROSS_CONTRACT_CALLS_GAS_LIMIT;

    const isRelayerTransaction = !sendWithPublicWallet;
    const relayAdaptParamsRandom = randomHex(31);
    const relayAdaptParams =
      await relayAdaptContract.getRelayAdaptParamsCrossContractCalls(
        dummyDecryptTxs,
        validCrossContractCalls,
        relayEncryptRequests,
        relayAdaptParamsRandom,
        isRelayerTransaction,
        minimumGasLimit,
      );
    const relayAdaptID: AdaptID = {
      contract: relayAdaptContract.address,
      parameters: relayAdaptParams,
    };

    // Create real transactions with relay adapt params.
    const transactions = await generateProofTransactions(
      ProofType.CrossContractCalls,
      networkName,
      railgunWalletID,
      encryptionKey,
      false, // showSenderAddressToRecipient
      undefined, // memoText
      relayAdaptDecryptERC20AmountRecipients,
      relayAdaptDecryptNFTAmountRecipients,
      relayerFeeERC20AmountRecipient,
      sendWithPublicWallet,
      relayAdaptID,
      false, // useDummyProof
      overallBatchMinGasPrice,
      progressCallback,
    );

    const nullifiers = nullifiersForTransactions(transactions);

    const transaction = await relayAdaptContract.populateCrossContractCalls(
      transactions,
      validCrossContractCalls,
      relayEncryptRequests,
      relayAdaptParamsRandom,
      false, // isGasEstimate
      isRelayerTransaction,
      minimumGasLimit,
    );
    delete transaction.from;

    setCachedProvedTransaction({
      proofType: ProofType.CrossContractCalls,
      railgunWalletID,
      showSenderAddressToRecipient: false,
      memoText: undefined,
      erc20AmountRecipients: [],
      nftAmountRecipients: [],
      relayAdaptDecryptERC20Amounts,
      relayAdaptDecryptNFTAmounts,
      relayAdaptEncryptERC20Recipients,
      relayAdaptEncryptNFTRecipients,
      crossContractCalls: validCrossContractCalls,
      relayerFeeERC20AmountRecipient,
      sendWithPublicWallet,
      transaction,
      overallBatchMinGasPrice,
      nullifiers,
    });
  } catch (err) {
    throw reportAndSanitizeError(generateCrossContractCallsProof.name, err);
  }
};

export const getRelayAdaptTransactionError = (
  receiptLogs: TransactionReceiptLog[] | readonly Log[],
): Optional<string> => {
  try {
    const relayAdaptError =
      RelayAdaptContract.getRelayAdaptCallError(receiptLogs);
    if (isDefined(relayAdaptError)) {
      sendErrorMessage(relayAdaptError);
      return relayAdaptError;
    }
    return undefined;
  } catch (err) {
    throw reportAndSanitizeError(getRelayAdaptTransactionError.name, err);
  }
};

export const parseRelayAdaptReturnValue = (data: string): Optional<string> => {
  try {
    const relayAdaptErrorParsed =
      RelayAdaptContract.parseRelayAdaptReturnValue(data);
    if (relayAdaptErrorParsed) {
      sendErrorMessage(relayAdaptErrorParsed.error);
      return relayAdaptErrorParsed.error;
    }
    return undefined;
  } catch (err) {
    throw reportAndSanitizeError(getRelayAdaptTransactionError.name, err);
  }
};
