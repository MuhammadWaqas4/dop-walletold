import {
  FormattedCircuitInputs,
  Groth16,
  Proof,
  Prover,
} from 'dop-engineengine';
import { getEngine } from './engine';
import { isDefined } from 'dop-sharedmodels';

export const getProver = (): Prover => {
  const engine = getEngine();
  if (!isDefined(engine)) {
    throw new Error(
      'RAILGUN Engine not yet init. Please reload your app or try again.',
    );
  }
  return engine.prover;
};

export { FormattedCircuitInputs, Proof, Groth16 };
