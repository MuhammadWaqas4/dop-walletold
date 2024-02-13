import {
  RailgunERC20Amount,
  NetworkName,
  ProofType,
  RailgunERC20AmountRecipient,
  RailgunNFTAmountRecipient,
} from 'dop-sharedmodels';
import {
  generateDummyProofTransactions,
  generateProofTransactions,
  generateTransact,
  generateDecryptBaseToken,
  nullifiersForTransactions,
} from './tx-generator';
import { assertValidEthAddress } from '../railgun/wallets/wallets';
import { setCachedProvedTransaction } from './proof-cache';
import { getRelayAdaptContractForNetwork } from '../railgun/core/providers';
import {
  AdaptID,
  ProverProgressCallback,
  randomHex,
} from 'dop-engineengine';
import { assertNotBlockedAddress } from '../../utils/blocked-address';
import { createRelayAdaptDecryptERC20AmountRecipients } from './tx-cross-contract-calls';
import { reportAndSanitizeError } from '../../utils/error';

export const generateDecryptProof = async (
  networkName: NetworkName,
  railgunWalletID: string,
  encryptionKey: string,
  erc20AmountRecipients: RailgunERC20AmountRecipient[],
  nftAmountRecipients: RailgunNFTAmountRecipient[],
  relayerFeeERC20AmountRecipient: Optional<RailgunERC20AmountRecipient>,
  sendWithPublicWallet: boolean,
  overallBatchMinGasPrice: Optional<bigint>,
  progressCallback: ProverProgressCallback,
): Promise<void> => {
  try {
    setCachedProvedTransaction(undefined);

    const transactions = await generateProofTransactions(
      ProofType.Decrypt,
      networkName,
      railgunWalletID,
      encryptionKey,
      false, // showSenderAddressToRecipient
      undefined, // memoText
      erc20AmountRecipients,
      nftAmountRecipients,
      relayerFeeERC20AmountRecipient,
      sendWithPublicWallet,
      undefined, // relayAdaptID
      false, // useDummyProof
      overallBatchMinGasPrice,
      progressCallback,
    );
    const transaction = await generateTransact(transactions, networkName);

    const nullifiers = nullifiersForTransactions(transactions);

    setCachedProvedTransaction({
      proofType: ProofType.Decrypt,
      railgunWalletID,
      showSenderAddressToRecipient: false,
      memoText: undefined,
      erc20AmountRecipients,
      nftAmountRecipients,
      relayAdaptDecryptERC20Amounts: undefined,
      relayAdaptDecryptNFTAmounts: undefined,
      relayAdaptEncryptERC20Recipients: undefined,
      relayAdaptEncryptNFTRecipients: undefined,
      crossContractCalls: undefined,
      relayerFeeERC20AmountRecipient,
      transaction,
      sendWithPublicWallet,
      overallBatchMinGasPrice,
      nullifiers,
    });
  } catch (err) {
    throw reportAndSanitizeError(generateDecryptProof.name, err);
  }
};

export const generateDecryptBaseTokenProof = async (
  networkName: NetworkName,
  publicWalletAddress: string,
  railgunWalletID: string,
  encryptionKey: string,
  wrappedERC20Amount: RailgunERC20Amount,
  relayerFeeERC20AmountRecipient: Optional<RailgunERC20AmountRecipient>,
  sendWithPublicWallet: boolean,
  overallBatchMinGasPrice: Optional<bigint>,
  progressCallback: ProverProgressCallback,
): Promise<void> => {
  try {
    assertNotBlockedAddress(publicWalletAddress);
    assertValidEthAddress(publicWalletAddress);

    setCachedProvedTransaction(undefined);

    const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
      {
        ...wrappedERC20Amount,
        recipientAddress: publicWalletAddress,
      },
    ];

    const relayAdaptDecryptERC20Amounts: RailgunERC20Amount[] = [
      wrappedERC20Amount,
    ];

    const relayAdaptDecryptERC20AmountRecipients: RailgunERC20AmountRecipient[] =
      createRelayAdaptDecryptERC20AmountRecipients(networkName, [
        wrappedERC20Amount,
      ]);

    // Empty NFT recipients.
    const nftAmountRecipients: RailgunNFTAmountRecipient[] = [];
    const relayAdaptDecryptNFTAmountRecipients: RailgunNFTAmountRecipient[] =
      [];

    const relayAdaptContract = getRelayAdaptContractForNetwork(networkName);

    // Generate dummy txs for relay adapt params.
    const dummyTxs = await generateDummyProofTransactions(
      ProofType.DecryptBaseToken,
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

    const relayAdaptParamsRandom = randomHex(31);
    const relayAdaptParams =
      await relayAdaptContract.getRelayAdaptParamsDecryptBaseToken(
        dummyTxs,
        publicWalletAddress,
        relayAdaptParamsRandom,
      );
    const relayAdaptID: AdaptID = {
      contract: relayAdaptContract.address,
      parameters: relayAdaptParams,
    };

    const showSenderAddressToRecipient = false;
    const memoText: Optional<string> = undefined;

    // Generate final txs with relay adapt ID.
    const transactions = await generateProofTransactions(
      ProofType.DecryptBaseToken,
      networkName,
      railgunWalletID,
      encryptionKey,
      showSenderAddressToRecipient,
      memoText,
      relayAdaptDecryptERC20AmountRecipients,
      relayAdaptDecryptNFTAmountRecipients,
      relayerFeeERC20AmountRecipient,
      sendWithPublicWallet,
      relayAdaptID,
      false, // useDummyProof
      overallBatchMinGasPrice,
      progressCallback,
    );

    const transaction = await generateDecryptBaseToken(
      transactions,
      networkName,
      publicWalletAddress,
      relayAdaptParamsRandom,
      false, // useDummyProof
    );

    const nullifiers = nullifiersForTransactions(transactions);

    setCachedProvedTransaction({
      proofType: ProofType.DecryptBaseToken,
      railgunWalletID,
      showSenderAddressToRecipient,
      memoText,
      erc20AmountRecipients,
      nftAmountRecipients,
      relayAdaptDecryptERC20Amounts,
      relayAdaptDecryptNFTAmounts: undefined,
      relayAdaptEncryptERC20Recipients: undefined,
      relayAdaptEncryptNFTRecipients: undefined,
      crossContractCalls: undefined,
      relayerFeeERC20AmountRecipient,
      sendWithPublicWallet,
      transaction,
      overallBatchMinGasPrice,
      nullifiers,
    });
  } catch (err) {
    throw reportAndSanitizeError(generateDecryptBaseTokenProof.name, err);
  }
};
