package com.appnativa.spot;

/**
 * Interface the can be used globally to conditionally
 * remove elements from a Sequence's output stream
 *
 * @author Don DeCoteau
 * @see SPOTSequence#spot_setOutputValidator(iSPOTOutputValidator)
 */
public interface iSPOTOutputValidator {
  boolean canOutput(iSPOTElement element);
}
