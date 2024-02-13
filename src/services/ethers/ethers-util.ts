import { mnemonicToPrivateKey } from 'dop-engineengine';

export const mnemonicToPKey = (mnemonic: string, derivationIndex?: number) => {
  return `0x${mnemonicToPrivateKey(mnemonic, derivationIndex)}`;
};
