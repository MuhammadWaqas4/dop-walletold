import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Sinon, { SinonStub } from 'sinon';
import {
  NetworkName,
  EVMGasType,
  RailgunERC20AmountRecipient,
  TransactionGasDetails,
} from 'dop-sharedmodels';
import {
  closeTestEngine,
  initTestEngine,
  initTestEngineNetwork,
} from '../../../tests/setup.test';
import {
  MOCK_DB_ENCRYPTION_KEY,
  MOCK_ETH_WALLET_ADDRESS,
  MOCK_MNEMONIC,
  MOCK_NFT_AMOUNT_RECIPIENTS,
  MOCK_RAILGUN_WALLET_ADDRESS,
  MOCK_TOKEN_ADDRESS,
  MOCK_TOKEN_ADDRESS_2,
} from '../../../tests/mocks.test';
import {
  populateEncrypt,
  gasEstimateForEncrypt,
  getEncryptPrivateKeySignatureMessage,
} from '../tx-encrypt';
import { createRailgunWallet } from '../../railgun/wallets/wallets';
import { getRandomBytes } from '../../railgun';
import { FallbackProvider } from 'ethers';

let gasEstimateStub: SinonStub;
let sendTxStub: SinonStub;

const encryptPrivateKey = getRandomBytes(32);

chai.use(chaiAsPromised);
const { expect } = chai;

const gasDetails: TransactionGasDetails = {
  evmGasType: EVMGasType.Type2,
  gasEstimate: BigInt('0x10'),
  maxFeePerGas: BigInt('0x1000'),
  maxPriorityFeePerGas: BigInt('0x100'),
};

const MOCK_TOKEN_AMOUNT_RECIPIENTS: RailgunERC20AmountRecipient[] = [
  {
    tokenAddress: MOCK_TOKEN_ADDRESS,
    amount: BigInt(0x100),
    recipientAddress: MOCK_RAILGUN_WALLET_ADDRESS,
  },
  {
    tokenAddress: MOCK_TOKEN_ADDRESS_2,
    amount: BigInt(0x200),
    recipientAddress: MOCK_RAILGUN_WALLET_ADDRESS,
  },
];

const MOCK_TOKEN_AMOUNT_RECIPIENTS_INVALID: RailgunERC20AmountRecipient[] = [
  {
    tokenAddress: MOCK_TOKEN_ADDRESS,
    amount: BigInt(0x100),
    recipientAddress: '0x1234',
  },
  {
    tokenAddress: MOCK_TOKEN_ADDRESS_2,
    amount: BigInt(0x200),
    recipientAddress: '0x1234',
  },
];

const stubSuccess = () => {
  gasEstimateStub = Sinon.stub(
    FallbackProvider.prototype,
    'estimateGas',
  ).resolves(200n);
};

const stubFailure = () => {
  gasEstimateStub = Sinon.stub(
    FallbackProvider.prototype,
    'estimateGas',
  ).rejects(new Error('test rejection - gas estimate'));
};

describe('tx-encrypt', () => {
  before(async function run() {
    this.timeout(5000);
    initTestEngine();
    await initTestEngineNetwork();
    await createRailgunWallet(
      MOCK_DB_ENCRYPTION_KEY,
      MOCK_MNEMONIC,
      undefined, // creationBlockNumbers
    );
  });
  afterEach(() => {
    gasEstimateStub?.restore();
    sendTxStub?.restore();
  });
  after(async () => {
    await closeTestEngine();
  });

  it('Should get expected signature message for encryptPrivateKey', () => {
    expect(getEncryptPrivateKeySignatureMessage()).to.equal('RAILGUN_SHIELD');
  });

  it('Should get gas estimate for valid encrypt', async () => {
    stubSuccess();
    const rsp = await gasEstimateForEncrypt(
      NetworkName.Polygon,
      encryptPrivateKey,
      MOCK_TOKEN_AMOUNT_RECIPIENTS,
      MOCK_NFT_AMOUNT_RECIPIENTS,
      MOCK_ETH_WALLET_ADDRESS,
    );
    expect(rsp.gasEstimate).to.equal(200n);
  });

  it('Should error on gas estimates for invalid encrypt', async () => {
    stubSuccess();
    await expect(
      gasEstimateForEncrypt(
        NetworkName.Polygon,
        encryptPrivateKey,
        MOCK_TOKEN_AMOUNT_RECIPIENTS_INVALID,
        MOCK_NFT_AMOUNT_RECIPIENTS,
        MOCK_ETH_WALLET_ADDRESS,
      ),
    ).rejectedWith('Invalid RAILGUN address.');
  });

  it('Should error for ethers rejections', async () => {
    stubFailure();
    await expect(
      gasEstimateForEncrypt(
        NetworkName.Polygon,
        encryptPrivateKey,
        MOCK_TOKEN_AMOUNT_RECIPIENTS,
        MOCK_NFT_AMOUNT_RECIPIENTS,
        MOCK_ETH_WALLET_ADDRESS,
      ),
    ).rejectedWith('test rejection - gas estimate');
  });

  it('Should send tx for valid encrypt - no gas details', async () => {
    stubSuccess();
    const { transaction } = await populateEncrypt(
      NetworkName.Polygon,
      encryptPrivateKey,
      MOCK_TOKEN_AMOUNT_RECIPIENTS,
      MOCK_NFT_AMOUNT_RECIPIENTS,
      undefined, // gasDetails
    );
    expect(transaction).to.be.an('object');
    expect(transaction.data).to.be.a('string');
    expect(transaction.to).to.equal(
      '0x19b620929f97b7b990801496c3b361ca5def8c71',
    );
    expect(transaction.gasPrice).to.be.undefined;
    expect(transaction.gasLimit).to.be.undefined;
    expect(transaction.maxFeePerGas).to.be.undefined;
    expect(transaction.maxPriorityFeePerGas).to.be.undefined;
  });

  it('Should send tx for valid encrypt - gas details', async () => {
    stubSuccess();
    const { transaction } = await populateEncrypt(
      NetworkName.Polygon,
      encryptPrivateKey,
      MOCK_TOKEN_AMOUNT_RECIPIENTS,
      MOCK_NFT_AMOUNT_RECIPIENTS,
      gasDetails,
    );
    expect(transaction).to.be.an('object');
    expect(transaction.data).to.be.a('string');
    expect(transaction.to).to.equal(
      '0x19b620929f97b7b990801496c3b361ca5def8c71',
    );
    expect(transaction.gasPrice).to.be.undefined;
    expect(transaction.gasLimit).to.equal(BigInt('0x13'));
    expect(transaction.maxFeePerGas).to.equal(BigInt('0x1000'));
    expect(transaction.maxPriorityFeePerGas).to.equal(BigInt('0x0100'));
  });

  it('Should error on send tx for invalid encrypt', async () => {
    stubSuccess();
    await expect(
      populateEncrypt(
        NetworkName.Polygon,
        encryptPrivateKey,
        MOCK_TOKEN_AMOUNT_RECIPIENTS_INVALID,
        MOCK_NFT_AMOUNT_RECIPIENTS,
        gasDetails,
      ),
    ).rejectedWith('Invalid RAILGUN address.');
  });
});
