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
 * Integer represents any positive or negative whole number. When streaming
 * as XML Integer values will be converted to their string representation
 * and encoded as a PrintableString. Negative values will have a minus
 * sign (ASCII 45) pre-pended to them.
 *
 * @author Don DeCoteau
 * @version   2.0
 */
@SuppressWarnings("unused")
public class SPOTInteger extends aSPOTElement implements Comparable {
  protected Long    _nRangeMax;
  protected Long    _nRangeMin;
  protected SNumber _numDefValue;
  protected SNumber _numValue;
  protected String  _sValue;

  /**
   * Creates a new <code>Integer</code> object with the specification that
   * the element represented by the object is mandatory.
   */
  public SPOTInteger() {
    this(true);
  }

  /**
   * Creates a new <code>Integer</code> object
   *
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTInteger(boolean optional) {
    _isOptional = optional;
  }

  /**
   * Creates a new <code>Integer</code> object
   *
   * @param val the value
   */
  public SPOTInteger(long val) {
    _isOptional = false;
    _numValue   = new SNumber(val);
  }

  /**
   * Creates a new <code>Integer</code> object
   *
   * @param val the value
   */
  public SPOTInteger(SNumber val) {
    _isOptional = false;
    _numValue   = new SNumber(val);
  }

  /**
   * Creates a new <code>Integer</code> object
   *
   * @param val the value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTInteger(long val, boolean optional) {
    _isOptional = optional;
    _numValue   = new SNumber(val);
  }

  /**
   * Creates a new <code>Integer</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   */
  public SPOTInteger(long val, long min) {
    _isOptional = false;
    _nRangeMin  = min;
    _numValue   = new SNumber(val);
  }

  /**
   * Creates a new <code>Integer</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTInteger(long val, long min, boolean optional) {
    _isOptional = optional;
    _nRangeMin  = min;
    _numValue   = new SNumber(val);
  }

  /**
   * Creates a new <code>Integer</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   */
  public SPOTInteger(long val, long min, long max) {
    this(val, min, max, false);
  }

  /**
   * Creates a new <code>Integer</code> object
   *
   * @param val the value
   * @param defaultval the default value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTInteger(String val, long defaultval, boolean optional) {
    _isOptional  = optional;
    _numDefValue = new SNumber(defaultval);

    if (val != null) {
      _numValue = new SNumber(val);
    }
  }

  /**
   * Creates a new <code>Integer</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTInteger(Integer val, Integer min, Integer max, boolean optional) {
    this(val, min, max, null, optional);
  }

  /**
   * Creates a new <code>Integer</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTInteger(Long val, Long min, Long max, boolean optional) {
    this(val, min, max, null, optional);
  }

  /**
   * Creates a new <code>Integer</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   * @param defaultval the default value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTInteger(Long val, Long min, Long max, Long defaultval, boolean optional) {
    _isOptional = optional;
    _nRangeMin  = min;
    _nRangeMax  = max;

    if (val != null) {
      _numValue = new SNumber(val);
    }

    if (defaultval != null) {
      _numDefValue = new SNumber(defaultval);
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
  public SPOTInteger(Number val, Number min, Number max, Number defaultval, boolean optional) {
    _isOptional  = optional;
    _nRangeMin   = min != null ? min.longValue() : null;
    _nRangeMax   = max != null ? max.longValue() : null;
    _numDefValue = SNumber.valueOf(defaultval);

    if (val != null) {
      _numValue = new SNumber(val.longValue());
    }

    if (defaultval != null) {
      _numDefValue = SNumber.valueOf(defaultval);
    }
  }

  /**
   * Returns the value of the element as a boolean
   *
   * @return the value
   */
  public boolean booleanValue() {
    return getValue() != 0;
  }

  public Object clone() {
    SPOTInteger e = (SPOTInteger) super.clone();

    if (_numValue != null) {
      e._numValue = new SNumber(_numValue);
    }

    return e;
  }

  public int compareTo(Object o) {
    return compareTo((SPOTInteger) o);
  }

  /**
   * Compares this object to the specified object
   *
   * @param o the object to compare to
   * @return a negative integer, zero, or a positive integer as this object is less than, equal to, or greater than the specified object
   */
  @SuppressWarnings("Duplicates")
  public int compareTo(SPOTInteger o) {
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
    return (double) getValue();
  }

  public boolean equals(Object o) {
    return o instanceof SPOTInteger && equals((SPOTInteger) o);

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

    return num1.equals(o);
  }

  public boolean equals(aSPOTElement e) {
    if (!(e instanceof SPOTInteger)) {
      return false;
    }

    SPOTInteger o = (SPOTInteger) e;

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
    return (float) getValue();
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
      _numValue.setValue(aStreamer.readLong(in));
      _sValue = null;
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
   * Returns the value of the element as a <code>long</code>
   *
   * @return the value
   */
  public long longValue() {
    return getValue();
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

  /**
   * Gets the default value for the object.
   *
   * @return the default value or <code>null</code>
   */
  public String spot_getDefaultValue() {
    if (_numDefValue != null) {
      return _numDefValue.toString();
    }

    return null;
  }

  public Object[] spot_getRange() {
    if ((_nRangeMin == null) && (_nRangeMax == null)) {
      return null;
    }

    return new Object[] { _nRangeMin, _nRangeMax };
  }

  public final int spot_getType() {
    return SPOT_TYPE_INTEGER;
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
   * Sets the default value for the object.
   *
   * @param val The value to become the default (i.e. used when the object has
   *        no value )
   */
  public void spot_setDefaultValue(long val) {
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
  public void spot_setRange(long min, long max) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _nRangeMin = min;
    _nRangeMax = max;
  }

  /**
   * Sets the valid range for the object
   *
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   */
  public void spot_setRange(Number min, Number max) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _nRangeMin = min != null ? min.longValue() : null;
    _nRangeMax = max != null ? max.longValue() : null;
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

    _nRangeMin = (min == null)
                 ? null
                 : SNumber.longValue(min);
    _nRangeMax = (max == null)
                 ? null
                 : SNumber.longValue(max);
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
      aStreamer.toStream(_numValue.longValue(), out);
    }
  }

  /**
   * Sets the default value for the object.
   *
   * @param val The value to become the default (i.e. used when the object has
   *        no value )
   */
  public void setDefaultValue(long val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _numDefValue = new SNumber(val);
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
  public void setValue(Number val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (_numValue == null) {
      _numValue = new SNumber(val.longValue());
    } else {
      _numValue.setValue(val.longValue());
    }

    _sValue = null;
  }

  /**
   * Sets the value
   *
   * @param val the value
   *
   */
  public void setValue(SPOTInteger val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

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

    _sValue = null;
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

    if (_numValue == null) {
      _numValue = new SNumber(val);
    } else {
      _numValue.setValue(val);
    }

   _sValue = null;
  }

  /**
   * Retrieves the value
   *
   * @return The value
   *
   */
  public long getValue() {
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
