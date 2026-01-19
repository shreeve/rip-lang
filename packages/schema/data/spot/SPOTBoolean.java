/*
 * Copyright SparseWare Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.appnativa.spot;

import com.appnativa.util.SNumber;
import com.appnativa.util.aStreamer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Boolean represents an element that can only be "true" or "false". When
 * streaming as XML Boolean values will be converted to their string
 * representation and encoded as a PrintableString.<br>
 *
 * <p>
 * The literal "true" is used to represent <code>true</code> and "false" is
 * used to represent <code>false</code>.
 * </p>
 *
 *
 * @author Don DeCoteau
 * @version   2.0
 *
 */
@SuppressWarnings("unused")
public class SPOTBoolean extends aSPOTElement implements Comparable {
  protected Boolean _bDefaultValue;
  protected Boolean _bValue;

  /**
   * Creates a new <code>Boolean</code> object with the specification that
   * the element represented by the object is mandatory.
   */
  public SPOTBoolean() {
    _isOptional = true;
  }

  /**
   * Creates a new <code>Boolean</code> object
   *
   * @param val the value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTBoolean(boolean val, boolean optional) {
    _isOptional = optional;
    _bValue     = val;
  }

  /**
   * Creates a new <code>Boolean</code> object
   *
   * @param val the value
   * @param defaultval the default value if no value is set
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTBoolean(Boolean val, Boolean defaultval, boolean optional) {
    _isOptional    = optional;
    _bValue        = val;
    _bDefaultValue = defaultval;
  }

  /**
   * Creates a new <code>Boolean</code> object
   *
   * @param val the value
   * @param defaultval the default value if no value is set
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTBoolean(boolean val, boolean defaultval, boolean optional) {
    _isOptional    = optional;
    _bValue        = val;
    _bDefaultValue = defaultval;
  }

  /**
   * Returns the value of the element as a boolean
   *
   * @return the value
   */
  public boolean booleanValue() {
    return getValue();
  }

  public int compareTo(Object o) {
    return compareTo((SPOTBoolean) o);
  }

  public int compareTo(SPOTBoolean o) {
    if (o == null) {
      return 1;
    }

    if ((_bValue == null) || (o._bValue == null)) {
      return (_bValue == o._bValue)
             ? 0
             : ((_bValue != null)
                ? 1
                : -1);
    }

    return (_bValue == o._bValue)
           ? 0
           : (_bValue
              ? 1
              : -1);
  }

  /**
   * Returns the value of the element as a <code>double</code>
   *
   * @return the value
   */
  public double doubleValue() {
    return getValue()
           ? 1.0
           : 0;
  }

  public boolean equals(aSPOTElement e) {
    if (e == this) {
      return true;
    }

    if (!(e instanceof SPOTBoolean)) {
      return false;
    }

    SPOTBoolean o = (SPOTBoolean) e;

    return _bValue == o._bValue && spot_attributesEqual(this, o);


  }

  /**
   * Populates the object's value from an input stream
   *
   * @param in the input stream
   *
   * @throws IOException if an I/O error occurs
   */
  public void fromStream(InputStream in) throws IOException {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (aStreamer.readBoolean(in)) {
      _bValue = aStreamer.readBoolean(in);
    }
  }

  public int hashCode() {
    return (_bValue == null)
           ? 0
           : _bValue.hashCode();
  }

  /**
   * Returns the value of the element as a <code>long</code>
   *
   * @return the value
   */
  public long longValue() {
    return getValue()
           ? 1
           : 0;
  }

  /**
   * Returns the value of the element as a <code>SNumber</code>
   *
   * @return the value
   */
  public SNumber numberValue() {
    return getValue()
           ? numValueNumber().setValue(1)
           : numValueNumber().setValue(0);
  }

  /**
   * Removes the existing value
   */
  public void spot_clear() {
    super.spot_clear();
    _bValue = null;
  }

  public final int spot_getType() {
    return SPOT_TYPE_BOOLEAN;
  }

  /**
   * Retrieves the range of valid values for the object.
   *
   * @return The valid range as a displayable string
   */
  public String spot_getValidityRange() {
    return "{ true(1), false(0) }";
  }

  public Object spot_getValue() {
    return getValue();
  }

  /**
   * Sets the default value for the object.
   *
   * @param val The value to become the default (i.e. used when the object has
   *        no value )
   *
   */
  public void spot_setDefaultValue(boolean val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _bDefaultValue = val;
  }

  /**
   * Returns the value of the element as a string
   *
   * @return the value
   */
  public String spot_stringValue() {
    if (_bValue != null) {
      return _bValue.toString();
    }

    return (_bDefaultValue == null)
           ? null
           : _bDefaultValue.toString();
  }

  public String spot_stringValueEx() {
    return ((_bValue == null) &&!spot_attributesWereSet())
           ? null
           : spot_stringValue();
  }

  /**
   * Writes the object's value out to an output stream
   *
   * @param out the output stream
   *
   * @throws IOException if an I/O error occurs
   */
  public void toStream(OutputStream out) throws IOException {
    aStreamer.toStream(_bValue != null, out);

    if (_bValue != null) {
      aStreamer.toStream(_bValue, out);
    }
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(boolean val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _bValue = val;
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(double val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    setValue(val != 0);
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(long val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    setValue(val != 0);
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(SPOTBoolean val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _bValue = val._bValue;
  }

  /**
   * Sets the value
   *
   * @param val the value
   *
   */
  public void setValue(String val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _bValue = null;

    if (val == null) {
      return;
    }

    if (val.equals("1") || val.equalsIgnoreCase("true")) {
      setValue(true);
    } else if (val.equals("0") || val.equalsIgnoreCase("false")) {
      setValue(false);
    } else {
      String s = "The value specified (" + val + ") is not one of " + spot_getValidityRange() + ".";

      throw new SPOTException(s);
    }
  }

  /**
   * Retrieves the value
   *
   * @return The value
   *
   */
  public boolean getValue() {
    if ((_bValue == null) && (_bDefaultValue == null)) {
      throw new SPOTException(STR_NULL_VALUE, (_theName == null)
              ? getClass().getName()
              : _theName);
    }

    return (_bValue == null)
           ? _bDefaultValue
           : _bValue;
  }

  protected int spot_checkRangeValidityEx() {
    if ((_bValue == null) && (_bDefaultValue != null)) {
      return VALUE_NULL_WITH_DEFAULT;
    }

    if ((_bValue == null) && _isOptional) {
      return VALUE_NULL_AND_OPTIONAL;
    }

    if (_bValue == null) {
      return VALUE_NULL;
    }

    return VALUE_OK;    // just right
  }
}
