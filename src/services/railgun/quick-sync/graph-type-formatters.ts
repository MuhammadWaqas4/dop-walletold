import {
  Nullifier,
  DecryptStoredEvent,
  CommitmentEvent,
  Commitment,
  TokenType,
  LegacyGeneratedCommitment,
  CommitmentType,
  LegacyEncryptedCommitment,
  EncryptCommitment,
  TransactCommitment,
  PreImage,
  TokenData,
  ByteLength,
  CommitmentCiphertext,
  Ciphertext,
  formatToByteLength,
  LegacyCommitmentCiphertext,
  serializeTokenData,
  serializePreImage,
} from 'dop-engineengine';
import {
  Nullifier as GraphNullifier,
  Decrypt as GraphDecrypt,
  TokenType as GraphTokenType,
  LegacyGeneratedCommitment as GraphLegacyGeneratedCommitment,
  LegacyEncryptedCommitment as GraphLegacyEncryptedCommitment,
  EncryptCommitment as GraphEncryptCommitment,
  TransactCommitment as GraphTransactCommitment,
  CommitmentPreimage as GraphCommitmentPreimage,
  LegacyCommitmentCiphertext as GraphLegacyCommitmentCiphertext,
  CommitmentCiphertext as GraphCommitmentCiphertext,
  Ciphertext as GraphCiphertext,
  Token as GraphToken,
} from './graphql';
import { getAddress } from 'ethers';
import { isDefined } from 'dop-sharedmodels';

export type GraphCommitment =
  | GraphLegacyEncryptedCommitment
  | GraphLegacyGeneratedCommitment
  | GraphEncryptCommitment
  | GraphTransactCommitment;

export type GraphCommitmentBatch = {
  transactionHash: string;
  commitments: GraphCommitment[];
  treeNumber: number;
  startPosition: number;
  blockNumber: number;
};

const graphTokenTypeToEngineTokenType = (
  graphTokenType: GraphTokenType,
): TokenType => {
  switch (graphTokenType) {
    case 'ERC20':
      return TokenType.ERC20;
    case 'ERC721':
      return TokenType.ERC721;
    case 'ERC1155':
      return TokenType.ERC1155;
  }
};

export const formatGraphNullifierEvents = (
  nullifiers: GraphNullifier[],
): Nullifier[] => {
  return nullifiers.map(nullifier => {
    return {
      txid: formatTo32Bytes(nullifier.transactionHash, false),
      nullifier: formatTo32Bytes(nullifier.nullifier, false),
      treeNumber: nullifier.treeNumber,
      blockNumber: Number(nullifier.blockNumber),
    };
  });
};

export const formatGraphDecryptEvents = (
  decrypts: GraphDecrypt[],
): DecryptStoredEvent[] => {
  return decrypts.map(decrypt => {
    return {
      txid: formatTo32Bytes(decrypt.transactionHash, false),
      timestamp: Number(decrypt.blockTimestamp),
      eventLogIndex: Number(decrypt.eventLogIndex),
      toAddress: getAddress(decrypt.to),
      tokenType: graphTokenTypeToEngineTokenType(decrypt.token.tokenType),
      tokenAddress: getAddress(decrypt.token.tokenAddress),
      tokenSubID: decrypt.token.tokenSubID,
      amount: bigIntStringToHex(decrypt.amount),
      fee: bigIntStringToHex(decrypt.fee),
      blockNumber: Number(decrypt.blockNumber),
    };
  });
};

export const formatGraphCommitmentEvents = (
  graphCommitmentBatches: GraphCommitmentBatch[],
): CommitmentEvent[] => {
  return graphCommitmentBatches.map(graphCommitmentBatch => {
    return {
      txid: formatTo32Bytes(graphCommitmentBatch.transactionHash, false),
      commitments: graphCommitmentBatch.commitments.map(formatCommitment),
      treeNumber: graphCommitmentBatch.treeNumber,
      startPosition: graphCommitmentBatch.startPosition,
      blockNumber: graphCommitmentBatch.blockNumber,
    };
  });
};

const formatCommitment = (commitment: GraphCommitment): Commitment => {
  switch (commitment.commitmentType) {
    case 'LegacyGeneratedCommitment':
      return formatLegacyGeneratedCommitment(
        commitment as GraphLegacyGeneratedCommitment,
      );
    case 'LegacyEncryptedCommitment':
      return formatLegacyEncryptedCommitment(
        commitment as GraphLegacyEncryptedCommitment,
      );
    case 'EncryptCommitment':
      return formatEncryptCommitment(commitment as GraphEncryptCommitment);
    case 'TransactCommitment':
      return formatTransactCommitment(commitment as GraphTransactCommitment);
  }
};

// const formatToken = (graphToken: GraphToken): TokenData => {
//   return {
//     tokenAddress: graphToken.tokenAddress,
//     tokenType: formatTo20Bytes(
//       graphTokenTypeToEngineTokenType(graphToken.tokenType).toString(),
//       true,
//     ) as unknown as TokenType,
//     tokenSubID: formatTo20Bytes(graphToken.tokenSubID, true),
//   };
// };

const formatSerializedToken = (graphToken: GraphToken): TokenData => {
  return serializeTokenData(
    graphToken.tokenAddress,
    graphTokenTypeToEngineTokenType(graphToken.tokenType),
    graphToken.tokenSubID,
  );
};

const formatPreImage = (graphPreImage: GraphCommitmentPreimage): PreImage => {
  return serializePreImage(
    graphPreImage.npk,
    formatSerializedToken(graphPreImage.token),
    BigInt(graphPreImage.value),
  );
};

const formatCiphertext = (graphCiphertext: GraphCiphertext): Ciphertext => {
  return {
    iv: formatTo16Bytes(graphCiphertext.iv, false),
    tag: formatTo16Bytes(graphCiphertext.tag, false),
    data: graphCiphertext.data.map(d => formatTo32Bytes(d, false)),
  };
};

const formatTo16Bytes = (value: string, prefix: boolean) => {
  return formatToByteLength(value, ByteLength.UINT_128, prefix);
};

const formatTo32Bytes = (value: string, prefix: boolean) => {
  return formatToByteLength(value, ByteLength.UINT_256, prefix);
};

const formatLegacyCommitmentCiphertext = (
  graphLegacyCommitmentCiphertext: GraphLegacyCommitmentCiphertext,
): LegacyCommitmentCiphertext => {
  return {
    ciphertext: formatCiphertext(graphLegacyCommitmentCiphertext.ciphertext),
    ephemeralKeys: graphLegacyCommitmentCiphertext.ephemeralKeys.map(
      ephemeralKey => formatTo32Bytes(ephemeralKey, false),
    ),
    memo: graphLegacyCommitmentCiphertext.memo.map(m =>
      formatTo32Bytes(m, false),
    ),
  };
};

const formatCommitmentCiphertext = (
  graphCommitmentCiphertext: GraphCommitmentCiphertext,
): CommitmentCiphertext => {
  return {
    ciphertext: formatCiphertext(graphCommitmentCiphertext.ciphertext),
    blindedReceiverViewingKey: formatTo32Bytes(
      graphCommitmentCiphertext.blindedReceiverViewingKey,
      false,
    ),
    blindedSenderViewingKey: formatTo32Bytes(
      graphCommitmentCiphertext.blindedSenderViewingKey,
      false,
    ),
    memo: graphCommitmentCiphertext.memo,
    annotationData: graphCommitmentCiphertext.annotationData,
  };
};

const bigIntStringToHex = (bigintString: string): string => {
  return `0x${BigInt(bigintString).toString(16)}`;
};

const formatLegacyGeneratedCommitment = (
  commitment: GraphLegacyGeneratedCommitment,
): LegacyGeneratedCommitment => {
  return {
    txid: formatTo32Bytes(commitment.transactionHash, false),
    timestamp: Number(commitment.blockTimestamp),
    commitmentType: CommitmentType.LegacyGeneratedCommitment,
    hash: formatTo32Bytes(bigIntStringToHex(commitment.hash), false),
    preImage: formatPreImage(commitment.preimage),
    encryptedRandom: [
      formatTo32Bytes(commitment.encryptedRandom[0], false),
      formatTo16Bytes(commitment.encryptedRandom[1], false),
    ] as [string, string],
    blockNumber: Number(commitment.blockNumber),
  };
};

const formatLegacyEncryptedCommitment = (
  commitment: GraphLegacyEncryptedCommitment,
): LegacyEncryptedCommitment => {
  return {
    txid: formatTo32Bytes(commitment.transactionHash, false),
    timestamp: Number(commitment.blockTimestamp),
    commitmentType: CommitmentType.LegacyEncryptedCommitment,
    hash: formatTo32Bytes(bigIntStringToHex(commitment.hash), false),
    ciphertext: formatLegacyCommitmentCiphertext(commitment.legacyCiphertext),
    blockNumber: Number(commitment.blockNumber),
  };
};

const formatEncryptCommitment = (
  commitment: GraphEncryptCommitment,
): EncryptCommitment => {
  const encryptCommitment: EncryptCommitment = {
    txid: formatTo32Bytes(commitment.transactionHash, false),
    timestamp: Number(commitment.blockTimestamp),
    commitmentType: CommitmentType.EncryptCommitment,
    hash: formatTo32Bytes(bigIntStringToHex(commitment.hash), false),
    preImage: formatPreImage(commitment.preimage),
    blockNumber: Number(commitment.blockNumber),
    encryptedBundle: commitment.encryptedBundle as [string, string, string],
    encryptKey: commitment.encryptKey,
    fee: isDefined(commitment.fee) ? commitment.fee.toString() : undefined,
  };
  if (!isDefined(encryptCommitment.fee)) {
    delete encryptCommitment.fee;
  }
  return encryptCommitment;
};

const formatTransactCommitment = (
  commitment: GraphTransactCommitment,
): TransactCommitment => {
  return {
    txid: formatTo32Bytes(commitment.transactionHash, false),
    timestamp: Number(commitment.blockTimestamp),
    commitmentType: CommitmentType.TransactCommitment,
    hash: formatTo32Bytes(bigIntStringToHex(commitment.hash), false),
    ciphertext: formatCommitmentCiphertext(commitment.ciphertext),
    blockNumber: Number(commitment.blockNumber),
  };
};
