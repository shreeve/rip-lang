package com.appnativa.spot;

import java.io.IOException;
import java.io.Writer;

/**
 * DOCUMENT ME!
 *
 * @author Don DeCoteau
 */
public interface iSPOTValueWriter {
  void writeValue(Writer w, iSPOTElement element,String value, boolean pre, int depth, boolean trim) throws IOException;
}
