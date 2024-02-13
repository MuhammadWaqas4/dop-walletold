import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Sinon, { SinonStub } from 'sinon';
import {
  NetworkName,
  EVMGasType,
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
  MOCK_TOKEN_AMOUNTS,
} from '../../../tests/mocks.test';
import {
  populateEncryptBaseToken,
  gasEstimateForEncryptBaseToken,
} from '../tx-encrypt-base-token';
import { createRailgunWallet } from '../../railgun/wallets/wallets';
import { randomHex } from 'dop-engineengine';
import { FallbackProvider } from 'ethers';

let gasEstimateStub: SinonStub;
let sendTxStub: SinonStub;
let railgunAddress: string;

const encryptPrivateKey = randomHex(32);

chai.use(chaiAsPromised);
const { expect } = chai;

const gasDetails: TransactionGasDetails = {
  evmGasType: EVMGasType.Type2,
  gasEstimate: 1000n,
  maxFeePerGas: BigInt('0x1000'),
  maxPriorityFeePerGas: BigInt('0x100'),
};

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

describe('tx-encrypt-base-token', () => {
  before(async function run() {
    this.timeout(5000);
    initTestEngine();
    await initTestEngineNetwork();
    const railgunWalletInfo = await createRailgunWallet(
      MOCK_DB_ENCRYPTION_KEY,
      MOCK_MNEMONIC,
      undefined, // creationBlockNumbers
    );

    railgunAddress = railgunWalletInfo.railgunAddress;
  });
  afterEach(() => {
    gasEstimateStub?.restore();
    sendTxStub?.restore();
  });
  after(async () => {
    await closeTestEngine();
  });

  it('Should get gas estimate for valid encrypt base token', async () => {
    stubSuccess();
    const rsp = await gasEstimateForEncryptBaseToken(
      NetworkName.Polygon,
      railgunAddress,
      encryptPrivateKey,
      MOCK_TOKEN_AMOUNTS[0],
      MOCK_ETH_WALLET_ADDRESS,
    );
    expect(rsp.gasEstimate).to.equal(200n);
  });

  it('Should error on gas estimates for invalid encrypt base token', async () => {
    stubSuccess();
    await expect(
      gasEstimateForEncryptBaseToken(
        NetworkName.Polygon,
        '123456789',
        encryptPrivateKey,
        MOCK_TOKEN_AMOUNTS[0],
        MOCK_ETH_WALLET_ADDRESS,
      ),
    ).rejectedWith('Invalid RAILGUN address.');
  });

  it('Should error for ethers rejections', async () => {
    stubFailure();
    await expect(
      gasEstimateForEncryptBaseToken(
        NetworkName.Polygon,
        railgunAddress,
        encryptPrivateKey,
        MOCK_TOKEN_AMOUNTS[0],
        MOCK_ETH_WALLET_ADDRESS,
      ),
    ).rejectedWith('test rejection - gas estimate');
  });

  it('Should send tx for valid encrypt base token', async () => {
    stubSuccess();
    const { transaction } = await populateEncryptBaseToken(
      NetworkName.Polygon,
      railgunAddress,
      encryptPrivateKey,
      MOCK_TOKEN_AMOUNTS[0],
      gasDetails,
    );
    expect(transaction).to.be.an('object');
    expect(transaction.data).to.be.a('string');
    expect(transaction.to).to.be.a('string');
  });

  it('Should error on send tx for invalid encrypt base token', async () => {
    stubSuccess();
    await expect(
      populateEncryptBaseToken(
        NetworkName.Polygon,
        '123456789',
        encryptPrivateKey,
        MOCK_TOKEN_AMOUNTS[0],
        gasDetails,
      ),
    ).rejectedWith('Invalid RAILGUN address.');
  });
});
