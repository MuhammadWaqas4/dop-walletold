import {
  CommitmentCiphertextStructOutput,
  TransactionStruct,
  formatCommitmentCiphertext,
} from 'dop-engineengine';
import {
  CommitmentCiphertext,
  CommitmentSummary,
} from 'dop-sharedmodels';

export const convertTransactionStructToCommitmentSummary = (
  transactionStruct: TransactionStruct,
  commitmentIndex: number,
): CommitmentSummary => {
  const commitmentCiphertextStruct = transactionStruct.boundParams
    .commitmentCiphertext[commitmentIndex] as CommitmentCiphertextStructOutput;

  const commitmentCiphertext: CommitmentCiphertext = formatCommitmentCiphertext(
    commitmentCiphertextStruct,
  );
  const commitmentHash = transactionStruct.commitments[
    commitmentIndex
  ] as string;

  return {
    commitmentCiphertext,
    commitmentHash,
  };
};
