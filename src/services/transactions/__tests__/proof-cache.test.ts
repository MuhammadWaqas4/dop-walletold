import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  ProofType,
  RailgunNFTAmountRecipient,
  RailgunERC20Amount,
  RailgunERC20AmountRecipient,
  NetworkName,
  RailgunNFTAmount,
  RailgunERC20Recipient,
} from 'dop-sharedmodels';
import {
  MOCK_NFT_AMOUNTS,
  MOCK_NFT_AMOUNT_RECIPIENTS,
  MOCK_RAILGUN_WALLET_ADDRESS,
  MOCK_TOKEN_AMOUNTS,
  MOCK_TOKEN_FEE,
} from '../../../tests/mocks.test';
import {
  setCachedProvedTransaction,
  validateCachedProvedTransaction,
} from '../proof-cache';
import { ContractTransaction } from 'ethers';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.BNBChain;
const railgunWalletID = '123';
const showSenderAddressToRecipient = true;
const memoText = 'Some memo';
const recipientAddress = '0x12345';
const erc20AmountRecipients: RailgunERC20AmountRecipient[] =
  MOCK_TOKEN_AMOUNTS.map(erc20Amount => ({
    ...erc20Amount,
    recipientAddress,
  }));
const nftAmountRecipients: RailgunNFTAmountRecipient[] =
  MOCK_NFT_AMOUNT_RECIPIENTS;
const relayerFeeERC20AmountRecipient: RailgunERC20AmountRecipient = {
  ...MOCK_TOKEN_FEE,
  recipientAddress: MOCK_RAILGUN_WALLET_ADDRESS,
};
const crossContractCalls: ContractTransaction[] = [
  { to: '0x4567', data: '0x' },
];
const relayAdaptEncryptERC20Recipients: RailgunERC20Recipient[] = [
  { tokenAddress: '0x123', recipientAddress: MOCK_RAILGUN_WALLET_ADDRESS },
];
const relayAdaptDecryptERC20Amounts: RailgunERC20Amount[] = [MOCK_TOKEN_FEE];
const relayAdaptDecryptNFTAmounts: RailgunNFTAmount[] = MOCK_NFT_AMOUNTS;
const relayAdaptEncryptNFTRecipients: RailgunNFTAmountRecipient[] =
  MOCK_NFT_AMOUNT_RECIPIENTS;

const nullifiers = ['0x1234'];

const sendWithPublicWallet = false;
const overallBatchMinGasPrice = BigInt('0x1000');

const setCached = (proofType: ProofType) => {
  setCachedProvedTransaction({
    transaction: {} as ContractTransaction,
    proofType,
    showSenderAddressToRecipient,
    memoText,
    railgunWalletID,
    erc20AmountRecipients,
    nftAmountRecipients,
    relayAdaptDecryptERC20Amounts,
    relayAdaptDecryptNFTAmounts,
    relayAdaptEncryptERC20Recipients,
    relayAdaptEncryptNFTRecipients,
    crossContractCalls,
    relayerFeeERC20AmountRecipient,
    sendWithPublicWallet: false,
    overallBatchMinGasPrice,
    nullifiers,
  });
};

describe('proof-cache', () => {
  it('Should validate cached transaction correctly', () => {
    setCachedProvedTransaction(undefined);
    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('No proof found.');

    setCached(ProofType.CrossContractCalls);

    // Same same
    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.not.throw();

    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.Decrypt,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: proofType.');

    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.Transfer,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: proofType.');

    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.CrossContractCalls,
        '987',
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: railgunWalletID.');

    // Set new for Transfer proof type
    setCached(ProofType.Transfer);

    // Requires ProofType.Transfer
    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.Transfer,
        railgunWalletID,
        false, // showSenderAddressToRecipient
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: showSenderAddressToRecipient.');

    // Requires ProofType.Transfer
    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.Transfer,
        railgunWalletID,
        showSenderAddressToRecipient,
        'different memo',
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: memoText.');

    // Requires ProofType.Transfer
    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.Transfer,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        [
          {
            tokenAddress: '0x765',
            amount: 100n,
            recipientAddress: '0x123',
          },
        ],
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: erc20AmountRecipients.');

    setCached(ProofType.CrossContractCalls);

    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        [MOCK_NFT_AMOUNT_RECIPIENTS[0]],
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: nftAmountRecipients.');

    // Note: requires ProofType.CrossContractCalls
    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        [
          {
            tokenAddress: '0x765',
            amount: 100n,
          },
        ],
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: relayAdaptDecryptERC20Amounts.');

    // Note: requires ProofType.CrossContractCalls
    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        [MOCK_NFT_AMOUNTS[0]],
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: relayAdaptDecryptNFTAmounts.');

    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        // proofType (ProofType.Transfer) will not validate relayAdaptDecryptERC20Amounts.. requires ProofType.CrossContractCalls
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        [
          {
            tokenAddress: 'test',
            recipientAddress: MOCK_RAILGUN_WALLET_ADDRESS,
          },
        ],
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: relayAdaptEncryptERC20Recipients.');

    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        // proofType (ProofType.Transfer) will not validate relayAdaptDecryptERC20Amounts.. requires ProofType.CrossContractCalls
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        [],
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: relayAdaptEncryptERC20Recipients.');

    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        // proofType (ProofType.Transfer) will not validate relayAdaptDecryptERC20Amounts.. requires ProofType.CrossContractCalls
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        [MOCK_NFT_AMOUNTS[0]],
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: relayAdaptEncryptNFTRecipients.');

    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        // proofType (ProofType.Transfer) will not validate relayAdaptDecryptERC20Amounts.. requires ProofType.CrossContractCalls
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        [{ to: 'test', data: '0x' }],
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: crossContractCalls.');

    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        {
          tokenAddress: '0x765',
          amount: 100n,
          recipientAddress: '0x1233',
        },
        sendWithPublicWallet,
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: relayerFeeERC20AmountRecipient.');

    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        true, // sendWithPublicWallet
        overallBatchMinGasPrice,
      ),
    ).to.throw('Mismatch: sendWithPublicWallet.');

    expect(() =>
      validateCachedProvedTransaction(
        networkName,
        ProofType.CrossContractCalls,
        railgunWalletID,
        showSenderAddressToRecipient,
        memoText,
        erc20AmountRecipients,
        nftAmountRecipients,
        relayAdaptDecryptERC20Amounts,
        relayAdaptDecryptNFTAmounts,
        relayAdaptEncryptERC20Recipients,
        relayAdaptEncryptNFTRecipients,
        crossContractCalls,
        relayerFeeERC20AmountRecipient,
        sendWithPublicWallet,
        BigInt('0x2000'),
      ),
    ).to.throw('Mismatch: overallBatchMinGasPrice.');
  });
});
