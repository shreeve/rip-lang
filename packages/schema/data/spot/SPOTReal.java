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
 * Real represents any positive or negative whole number. When streaming as
 * XML Real values will be converted to their string representation and
 * encoded as a PrintableString. Negative values will have a minus sign
 * (ASCII 45) pre-pended to them.
 *
 * @author Don DeCoteau
 * @version   2.0
 */
@SuppressWarnings("unused")
public class SPOTReal extends aSPOTElement implements Comparable {
  protected SNumber _nRangeMax;
  protected SNumber _nRangeMin;
  protected SNumber _numDefValue;
  protected SNumber _numValue;
  protected String  _sValue;

  /**
   * Creates a new <code>Real</code> object with the specification that the
   * element represented by the object is mandatory.
   */
  public SPOTReal() {
    this(true);
  }

  /**
   * Creates a new <code>Real</code> object
   *
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTReal(boolean optional) {
    _isOptional = optional;
  }

  /**
   * Creates a new <code>Real</code> object
   *
   * @param val the value
   */
  public SPOTReal(double val) {
    _isOptional = false;
    _numValue   = new SNumber(val);
  }

  /**
   * Creates a new <code>Real</code> object
   *
   * @param val the value
   */
  public SPOTReal(SNumber val) {
    _isOptional = false;
    _numValue   = new SNumber(val);
  }

  /**
   * Creates a new <code>Real</code> object
   *
   * @param val the value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTReal(double val, boolean optional) {
    _isOptional = optional;
    _numValue   = new SNumber(val);
  }

  /**
   * Creates a new <code>Real</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   */
  public SPOTReal(double val, double min) {
    _isOptional = false;
    _nRangeMin  = new SNumber(min);
    _numValue   = new SNumber(val);
  }

  /**
   * Creates a new <code>Real</code> object
   *
   * @param val the value
   * @param defaultval the default value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTReal(double val, double defaultval, boolean optional) {
    _isOptional  = optional;
    _numDefValue = new SNumber(defaultval);
    _numValue    = new SNumber(val);
  }

  /**
   * Creates a new <code>Real</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   */
  public SPOTReal(double val, double min, double max) {
    this(val, min, max, false);
  }

  /**
   * Creates a new <code>Real</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTReal(double val, double min, double max, boolean optional) {
    _isOptional = optional;
    _nRangeMin  = new SNumber(min);
    _nRangeMax  = new SNumber(max);
    _numValue   = new SNumber(val);
  }

  /**
   * Creates a new <code>Real</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTReal(String val, String min, String max, boolean optional) {
    this(val, min, max, val, optional);
  }

  /**
   *  Creates a new <code>Real</code> object
   *
   *  @param val the value
   *  @param min The object's minimum acceptable value
   *  @param max The object's maximum acceptable value
   *  @param defaultval the default value
   *  @param optional <code>true</code> if the element the object represents is
   *         optional
   */
  public SPOTReal(Number val, Number min, Number max, Number defaultval, boolean optional) {
    _isOptional  = optional;
    _nRangeMin   = SNumber.valueOf(min);
    _nRangeMax   = SNumber.valueOf(max);
    _numDefValue = SNumber.valueOf(defaultval);

    if (val != null) {
      if (val instanceof SNumber) {
        _numValue = new SNumber((SNumber) val);
      } else {
        _numValue = new SNumber(val.doubleValue());
      }
    }
  }

  /**
   *  Creates a new <code>Real</code> object
   *
   *  @param val the value
   *  @param min The object's minimum acceptable value
   *  @param max The object's maximum acceptable value
   *  @param defaultval the default value
   *  @param optional <code>true</code> if the element the object represents is
   *         optional
   */
  public SPOTReal(String val, String min, String max, String defaultval, boolean optional) {
    _isOptional  = optional;
    _nRangeMin   = (min == null)
                   ? null
                   : new SNumber(min);
    _nRangeMax   = (max == null)
                   ? null
                   : new SNumber(max);
    _numDefValue = (defaultval == null)
                   ? null
                   : new SNumber(defaultval);

    if (val != null) {
      _numValue = new SNumber(val);
    }
  }

  /**
   *  Creates a new <code>Real</code> object
   *
   *  @param val the value
   *  @param defaultval the default value
   *  @param optional <code>true</code> if the element the object represents is
   *         optional
   */
  public SPOTReal(String val, String defaultval, boolean optional) {
    _isOptional  = optional;
    _numDefValue = (defaultval == null)
                   ? null
                   : new SNumber(defaultval);

    if (val != null) {
      _numValue = new SNumber(val);
    }
  }

  /**
   * Returns the value of the element as a boolean
   *
   * @return the value
   */
  public boolean booleanValue() {
    return !getValue().equals(0);
  }

  public Object clone() {
    SPOTReal e = (SPOTReal) super.clone();

    if (_numValue != null) {
      e._numValue = new SNumber(_numValue);
    }

    return e;
  }

  public int compareTo(Object o) {
    return compareTo((SPOTReal) o);
  }

  /**
   * Compares this object to the specified object
   *
   * @param o the object to compare to
   * @return a negative integer, zero, or a positive integer as this object is less than, equal to, or greater than the specified object
   */
  @SuppressWarnings("Duplicates")
  public int compareTo(SPOTReal o) {
    if (o == null) {
      return 1;
    }
    SNumber num1 = (_numValue != null)
                   ? _numValue
                   : _numDefValue;
    SNumber num2 = (o._numValue != null)
                   ? o._numValue
                   : o._numDefValue;

    if ((num1 == null) || (num2 == null)) {
      //noinspection NumberEquality
      return (num1 == num2)
             ? 0
             : ((num1 != null)
                ? 1
                : -1);
    }

    return num1.compareTo(num2);
  }

  /**
   * Returns the value of the element as a <code>double</code>
   *
   * @return the value
   */
  public double doubleValue() {
    return getValue().doubleValue();
  }

  public boolean equals(Object o) {
    return o instanceof SPOTReal && equals((SPOTReal) o);

  }

  /**
   * Tests whether this object is equal to the specified object
   *
   * @param o the object to test
   *
   * @return <code>true</code> if this object is the same as the specified object; <code>false</code> otherwise
   */
  public boolean equals(SNumber o) {
    SNumber num1 = (_numValue != null)
                   ? _numValue
                   : _numDefValue;

    if ((num1 == null) || (o == null)) {
      //noinspection NumberEquality

      return (num1 == o);
    }

    return _numValue.equals(o);
  }

  public boolean equals(aSPOTElement e) {
    if (!(e instanceof SPOTReal)) {
      return false;
    }

    SPOTReal o = (SPOTReal) e;

    if (o == this) {
      return true;
    }

    SNumber num1 = (_numValue != null)
                   ? _numValue
                   : _numDefValue;
    SNumber num2 = (o._numValue != null)
                   ? o._numValue
                   : o._numDefValue;

    if ((num1 == null) || (num2 == null)) {
      //noinspection NumberEquality
      if (num1 != num2) {
        return false;
      }
    } else if (!num2.equals(num2)) {
      return false;
    }

    return spot_attributesEqual(this, o);
  }

  /**
   * Returns the value of the element as a <code>float</code>
   *
   * @return the value
   */
  public float floatValue() {
    return getValue().floatValue();
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
      _numValue.setValue(aStreamer.readLong(in), aStreamer.readLong(in), aStreamer.readInt(in));
    } else {
      _numValue = null;
    }
  }

  public int hashCode() {
    SNumber num = (_numValue != null)
                  ? _numValue
                  : _numDefValue;

    return (num != null)
           ? num.hashCode()
           : super.hashCode();
  }

  /**
   * Returns the value of the element as a <code>double</code>
   *
   * @return the value
   *
   */
  public long longValue() {
    if (_numValue == null) {
      if (_numDefValue == null) {
        throw new SPOTException(STR_NULL_VALUE, (_theName == null)
                ? getClass().getName()
                : _theName);
      }

      return _numDefValue.longValue();
    }

    return _numValue.longValue();
  }

  /**
   * Returns the value of the element as a <code>SNumber</code>
   *
   * @return the value
   */
  public SNumber numberValue() {
    if (_numValue == null) {
      return (_numDefValue != null)
             ? numValueNumber().setValue(_numDefValue)
             : null;
    }

    return numValueNumber().setValue(_numValue);
  }

  /**
   * Removes the existing value
   */
  public void spot_clear() {
    super.spot_clear();
    _numValue = null;
    _sValue   = null;
  }

  public Object[] spot_getRange() {
    if ((_nRangeMin == null) && (_nRangeMax == null)) {
      return null;
    }

    return new Object[] { _nRangeMin, _nRangeMax };
  }

  public final int spot_getType() {
    return SPOT_TYPE_REAL;
  }

  /**
   * Retrieves the range of valid values for the object.
   *
   * @return The valid range as a displayable string
   */
  public String spot_getValidityRange() {
    return  getRangeStringEx(_nRangeMin,_nRangeMax);
  }

  public Object spot_getValue() {
    return getValue();
  }

  /**
   * Sets the valid range for the object
   *
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   */
  public void spot_setRange(String min, String max) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (min != null) {
      _nRangeMin = new SNumber(min);
    }

    if (max != null) {
      _nRangeMax = new SNumber(max);
    }
  }

  /**
   * Returns the value of the element as a string
   *
   * @return the value
   */
  public String spot_stringValue() {
    if (_numValue == null) {
      return (_numDefValue != null)
             ? _numDefValue.toString()
             : null;
    }

    if (_sValue == null) {
      _sValue = _numValue.toString();
    }

    return _sValue;
  }

  public String spot_stringValueEx() {
    return ((_numValue == null) &&!spot_attributesWereSet())
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
    aStreamer.toStream(_numValue != null, out);

    if (_numValue != null) {
      _numValue.toStream(out);
    }
  }

  public String toString() {
    String s = spot_stringValue();

    return (s == null)
           ? ""
           : s;
  }

  /**
   * Sets the default value for the object.
   *
   * @param val The value to become the default (i.e. used when the object has
   *        no value )
   */
  public void setDefaultValue(double val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _numDefValue = new SNumber(val);
  }

  /**
   * Sets the valid range for the object
   *
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   */
  public void setRange(double min, double max) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _nRangeMin = new SNumber(min);
    _nRangeMax = new SNumber(max);
  }

  /**
   * Sets the valid range for the object
   *
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   */
  public void setRange(SNumber min, SNumber max) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (min != null) {
      _nRangeMin = new SNumber(min);
    }

    if (max != null) {
      _nRangeMax = new SNumber(max);
    }
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(boolean val) {
    setValue(val
             ? 1
             : 0);
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

    if (_numValue == null) {
      _numValue = new SNumber(val);
    } else {
      _numValue.setValue(val);
    }

    _sValue = null;
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

    if (_numValue == null) {
      _numValue = new SNumber(val);
    } else {
      _numValue.setValue(val);
    }

    _sValue = null;
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(SNumber val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (_numValue == null) {
      _numValue = new SNumber(val);
    } else {
      _numValue.setValue(val);
    }

    _sValue = null;
  }

  /**
   * Sets the value
   *
   * @param val the value
   *
   */
  public void setValue(SPOTReal val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _sValue = null;

    SNumber num = val._numValue;

    if (num == null) {
      num = val._numDefValue;
    }

    if (num == null) {
      _numValue = null;

      return;
    }

    if (_numValue == null) {
      _numValue = new SNumber(num);
    } else {
      _numValue.setValue(num);
    }
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

    if (val == null) {
      _numValue = null;
      _sValue   = null;

      return;
    }

    try {
      if (_numValue == null) {
        _numValue = new SNumber(val);
      } else {
        _numValue.setValue(val);
      }

      _sValue = null;
    } catch(java.lang.NumberFormatException e) {
      throw new SPOTException(e);
    }
  }

  /**
   * Gets the default value for the object.
   *
   * @return the default value or <code>null</code>
   */
  public String getDefaultValue() {
    if (_numDefValue != null) {
      return _numDefValue.toString();
    }

    return null;
  }

  /**
   * Retrieves the value
   *
   * @return The value
   *
   */
  public SNumber getValue() {
    if (_numValue == null) {
      return (_numDefValue != null)
             ? numValueNumber().setValue(_numDefValue)
             : null;
    }

    return numValueNumber().setValue(_numValue);
  }

  @SuppressWarnings("Duplicates")
  protected int spot_checkRangeValidityEx() {
    if ((_numValue == null) && (_numDefValue != null)) {
      return VALUE_NULL_WITH_DEFAULT;
    }

    if ((_numValue == null) && _isOptional) {
      return VALUE_NULL_AND_OPTIONAL;
    }

    if (_numValue == null) {
      return VALUE_NULL;
    }

    if ((_nRangeMin != null) && (_numValue.lt(_nRangeMin))) {
      return VALUE_TO_SMALL;    // to small
    }

    if ((_nRangeMax != null) && (_numValue.gt(_nRangeMax))) {
      return VALUE_TO_BIG;    // to big
    }

    return VALUE_OK;    // string just right
  }
}
