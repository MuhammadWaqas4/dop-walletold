import {
  TransactionHistoryTransferTokenAmount,
  TransactionHistoryTokenAmount,
  TransactionHistoryEntry,
  Chain,
  TransactionHistoryReceiveTokenAmount,
  TokenType,
  formatToByteLength,
  ByteLength,
  TransactionHistoryDecryptTokenAmount,
} from 'dop-engineengine';
import {
  TransactionHistoryItem,
  RailgunERC20Amount,
  RailgunSendERC20Amount,
  RailgunReceiveERC20Amount,
  RailgunSendNFTAmount,
  RailgunNFTAmount,
  RailgunReceiveNFTAmount,
  RailgunDecryptERC20Amount,
  RailgunDecryptNFTAmount,
  TransactionHistoryItemCategory,
} from 'dop-sharedmodels';
import { walletForID } from '../core/engine';
import { parseRailgunTokenAddress } from '../util/bytes';
import { reportAndSanitizeError } from '../../../utils/error';

const transactionHistoryReceiveTokenAmountToRailgunERC20Amount = (
  transactionHistoryReceiveTokenAmount: TransactionHistoryReceiveTokenAmount,
): RailgunReceiveERC20Amount => {
  return {
    ...transactionHistoryTokenAmountToRailgunERC20Amount(
      transactionHistoryReceiveTokenAmount,
    ),
    memoText: transactionHistoryReceiveTokenAmount.memoText,
    senderAddress: transactionHistoryReceiveTokenAmount.senderAddress,
    encryptFee: transactionHistoryReceiveTokenAmount.encryptFee,
  };
};

const transactionHistoryReceiveNFTToRailgunNFTAmount = (
  transactionHistoryReceiveTokenAmount: TransactionHistoryReceiveTokenAmount,
): RailgunReceiveNFTAmount => {
  return {
    ...transactionHistoryNFTToRailgunNFTAmount(
      transactionHistoryReceiveTokenAmount,
    ),
    memoText: transactionHistoryReceiveTokenAmount.memoText,
    senderAddress: transactionHistoryReceiveTokenAmount.senderAddress,
    encryptFee: transactionHistoryReceiveTokenAmount.encryptFee,
  };
};

const transactionHistoryTransferTokenAmountToRailgunERC20Amount = (
  transactionHistoryTokenAmount: TransactionHistoryTransferTokenAmount,
): RailgunSendERC20Amount => {
  const walletSource =
    transactionHistoryTokenAmount.noteAnnotationData?.walletSource;
  return {
    ...transactionHistoryTokenAmountToRailgunERC20Amount(
      transactionHistoryTokenAmount,
    ),
    recipientAddress: transactionHistoryTokenAmount.recipientAddress,
    memoText: transactionHistoryTokenAmount.memoText,
    walletSource,
  };
};

const transactionHistoryDecryptTokenAmountToRailgunERC20Amount = (
  transactionHistoryDecryptTokenAmount: TransactionHistoryDecryptTokenAmount,
): RailgunDecryptERC20Amount => {
  return {
    ...transactionHistoryTransferTokenAmountToRailgunERC20Amount(
      transactionHistoryDecryptTokenAmount,
    ),
    decryptFee: transactionHistoryDecryptTokenAmount.decryptFee,
  };
};

const transactionHistoryTransferNFTToRailgunNFTAmount = (
  transactionHistoryNFT: TransactionHistoryTransferTokenAmount,
): RailgunSendNFTAmount => {
  const walletSource = transactionHistoryNFT.noteAnnotationData?.walletSource;
  return {
    ...transactionHistoryNFTToRailgunNFTAmount(transactionHistoryNFT),
    memoText: transactionHistoryNFT.memoText,
    walletSource,
    recipientAddress: transactionHistoryNFT.recipientAddress,
  };
};

const transactionHistoryDecryptNFTToRailgunNFTAmount = (
  transactionHistoryNFT: TransactionHistoryDecryptTokenAmount,
): RailgunDecryptNFTAmount => {
  return {
    ...transactionHistoryTransferNFTToRailgunNFTAmount(transactionHistoryNFT),
    decryptFee: transactionHistoryNFT.decryptFee,
  };
};

const transactionHistoryTokenAmountToRailgunERC20Amount = (
  transactionHistoryTokenAmount: TransactionHistoryTokenAmount,
): RailgunERC20Amount => {
  return {
    tokenAddress: parseRailgunTokenAddress(
      transactionHistoryTokenAmount.tokenData.tokenAddress,
    ).toLowerCase(),
    amount: transactionHistoryTokenAmount.amount,
  };
};

const transactionHistoryNFTToRailgunNFTAmount = (
  transactionHistoryNFT: TransactionHistoryTokenAmount,
): RailgunNFTAmount => {
  return {
    nftAddress: parseRailgunTokenAddress(
      transactionHistoryNFT.tokenData.tokenAddress,
    ).toLowerCase(),
    nftTokenType: transactionHistoryNFT.tokenData.tokenType as 1 | 2,
    tokenSubID: transactionHistoryNFT.tokenData.tokenSubID,
    amount: transactionHistoryNFT.amount,
  };
};

const filterERC20 = (tokenAmount: TransactionHistoryTokenAmount) => {
  return tokenAmount.tokenData.tokenType === TokenType.ERC20;
};

const filterNFT = (tokenAmount: TransactionHistoryTokenAmount) => {
  switch (tokenAmount.tokenData.tokenType) {
    case TokenType.ERC20:
      return false;
    case TokenType.ERC721:
    case TokenType.ERC1155:
      return tokenAmount.amount > BigInt(0);
  }
};

const receiveERC20AmountsHaveEncryptFee = (
  receiveERC20Amounts: RailgunReceiveERC20Amount[],
): boolean => {
  return receiveERC20Amounts.find(amount => amount.encryptFee) != null;
};

export const categoryForTransactionHistoryItem = (
  historyItem: TransactionHistoryItem,
): TransactionHistoryItemCategory => {
  const hasTransferNFTs = historyItem.transferNFTAmounts.length > 0;
  const hasReceiveNFTs = historyItem.receiveNFTAmounts.length > 0;
  const hasDecryptNFTs = historyItem.decryptNFTAmounts.length > 0;
  if (hasTransferNFTs || hasReceiveNFTs || hasDecryptNFTs) {
    // Some kind of NFT Transfer. Unhandled case.
    return TransactionHistoryItemCategory.Unknown;
  }

  const hasTransferERC20s = historyItem.transferERC20Amounts.length > 0;
  const hasReceiveERC20s = historyItem.receiveERC20Amounts.length > 0;
  const hasDecryptERC20s = historyItem.decryptERC20Amounts.length > 0;

  if (hasTransferERC20s && !hasReceiveERC20s && !hasDecryptERC20s) {
    // Only transfer erc20s.
    return TransactionHistoryItemCategory.TransferSendERC20s;
  }

  if (!hasTransferERC20s && hasReceiveERC20s && !hasDecryptERC20s) {
    // Only receive erc20s.
    const hasEncryptFee = receiveERC20AmountsHaveEncryptFee(
      historyItem.receiveERC20Amounts,
    );
    if (hasEncryptFee) {
      // Note: Encrypt fees were added to contract events in Mar 2023.
      // Prior encrypts will show as TransferReceiveERC20s without fees.
      return TransactionHistoryItemCategory.EncryptERC20s;
    }
    return TransactionHistoryItemCategory.TransferReceiveERC20s;
  }

  if (!hasTransferERC20s && !hasReceiveERC20s && hasDecryptERC20s) {
    // Only decrypt erc20s.
    return TransactionHistoryItemCategory.DecryptERC20s;
  }

  return TransactionHistoryItemCategory.Unknown;
};

const serializeTransactionHistory = (
  transactionHistory: TransactionHistoryEntry[],
): TransactionHistoryItem[] => {
  const historyItemsUncategorized: TransactionHistoryItem[] =
    transactionHistory.map(historyEntry => ({
      txid: formatToByteLength(historyEntry.txid, ByteLength.UINT_256, true),
      blockNumber: historyEntry.blockNumber,
      timestamp: historyEntry.timestamp,
      transferERC20Amounts: historyEntry.transferTokenAmounts
        .filter(filterERC20)
        .map(transactionHistoryTransferTokenAmountToRailgunERC20Amount),
      relayerFeeERC20Amount: historyEntry.relayerFeeTokenAmount
        ? transactionHistoryTokenAmountToRailgunERC20Amount(
            historyEntry.relayerFeeTokenAmount,
          )
        : undefined,
      changeERC20Amounts: historyEntry.changeTokenAmounts
        .filter(filterERC20)
        .map(transactionHistoryTokenAmountToRailgunERC20Amount),
      receiveERC20Amounts: historyEntry.receiveTokenAmounts
        .filter(filterERC20)
        .map(transactionHistoryReceiveTokenAmountToRailgunERC20Amount),
      decryptERC20Amounts: historyEntry.decryptTokenAmounts
        .filter(filterERC20)
        .map(transactionHistoryDecryptTokenAmountToRailgunERC20Amount),
      receiveNFTAmounts: historyEntry.receiveTokenAmounts
        .filter(filterNFT)
        .map(transactionHistoryReceiveNFTToRailgunNFTAmount),
      transferNFTAmounts: historyEntry.transferTokenAmounts
        .filter(filterNFT)
        .map(transactionHistoryTransferNFTToRailgunNFTAmount),
      decryptNFTAmounts: historyEntry.decryptTokenAmounts
        .filter(filterNFT)
        .map(transactionHistoryDecryptNFTToRailgunNFTAmount),
      version: historyEntry.version,
      category: TransactionHistoryItemCategory.Unknown,
    }));

  // Add category for items based on token types.
  return historyItemsUncategorized.map(historyItem => ({
    ...historyItem,
    category: categoryForTransactionHistoryItem(historyItem),
  }));
};

export const getWalletTransactionHistory = async (
  chain: Chain,
  railgunWalletID: string,
  startingBlock: Optional<number>,
): Promise<TransactionHistoryItem[]> => {
  try {
    const wallet = walletForID(railgunWalletID);
    const transactionHistory = await wallet.getTransactionHistory(
      chain,
      startingBlock,
    );
    return serializeTransactionHistory(transactionHistory);
  } catch (err) {
    reportAndSanitizeError(getWalletTransactionHistory.name, err);
    throw new Error('Could not load RAILGUN wallet transaction history.');
  }
};
