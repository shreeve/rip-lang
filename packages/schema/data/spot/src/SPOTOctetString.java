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

import com.appnativa.util.Base64;
import com.appnativa.util.SNumber;
import com.appnativa.util.UTF8Helper;

import java.io.IOException;
import java.io.Writer;

/**
 * Represents an arbitrary string of octets (eight-bit values). When streaming
 * as XML An OctetString value will convert to Base64 representation and
 * then encoded as a PrintableString
 *
 * @author Don DeCoteau
 * @version   2.0
 */
@SuppressWarnings("unused")
public class SPOTOctetString extends aSPOTElement implements Comparable {
  int   _nRangeMax;
  int   _nRangeMin;
  String _osValue;
  String _sDefaultValue;
  String _sValue;

  /**
   * Creates a new <code>OctetString</code> object with the specification
   * that the element represented by the object is mandatory.
   */
  public SPOTOctetString() {
    this(null, -1, -1, true);
  }

  /**
   * Creates a new <code>OctetString</code> object
   *
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTOctetString(boolean optional) {
    this(null, -1, -1, optional);
  }

  /**
   * Creates a new <code>OctetString</code> object
   *
   * @param val the value
   */
  public SPOTOctetString(String val) {
    this(val, 0, -1, false);
  }

  /**
   * Creates a new <code>OctetString</code> object
   *
   * @param val the value
   * @param max The object's maximum acceptable value
   */
  public SPOTOctetString(String val, int max) {
    this(val, -1, max, null, false);
  }

  /**
   * Creates a new <code>OctetString</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   */
  public SPOTOctetString(String val, int min, int max) {
    this(val, min, max, null, false);
  }

  /**
   * Creates a new <code>OctetString</code> object
   *
   * @param val the value
   * @param defaultval the default value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTOctetString(String val, String defaultval, boolean optional) {
    this(val, -1, -1, null, optional);
  }

  /**
   * Creates a new <code>OctetString</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTOctetString(String val, int min, int max, boolean optional) {
    this(val, min, max, null, optional);
  }

  /**
   * Creates a new <code>OctetString</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   * @param defaultval the default value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTOctetString(String val, int min, int max, String defaultval, boolean optional) {
    _sValue        = val;
    _nRangeMin     = min;
    _nRangeMax     = max;
    _isOptional    = optional;
    _sDefaultValue = defaultval;
    _isOptional    = optional;
  }

  public int compareTo(Object o) {
    return compareTo((SPOTOctetString) o);
  }

  /**
   * Compares this object to the specified object
   *
   * @param o the object to compare to
   * @return a negative integer, zero, or a positive integer as this object is less than, equal to, or greater than the specified object
   */
  public int compareTo(SPOTOctetString o) {
    String t1 = (_sValue != null)
                ? _sValue
                : _sDefaultValue;
    String t2 = (o._sValue != null)
                ? o._sValue
                : o._sDefaultValue;

    if ((t1 == null) || (t2 == null)) {
      //noinspection StringEquality
      return (t1 == t2)
             ? 0
             : ((t1 == null)
                ? -1
                : 1);
    }

    return t1.compareTo(t2);
  }

  /**
   * Compares this object to the specified object
   *
   * @param o the object to compare to
   * @return a negative integer, zero, or a positive integer as this object is less than, equal to, or greater than the specified object
   */
  public int compareTo(SPOTPrintableString o) {
    String t1 = (_sValue != null)
                ? _sValue
                : _sDefaultValue;
    String t2 = (o._sValue != null)
                ? o._sValue
                : o._sDefaultValue;

    if ((t1 == null) || (t2 == null)) {
      //noinspection StringEquality
      return (t1 == t2)
             ? 0
             : ((t1 == null)
                ? -1
                : 1);
    }

    return t1.compareTo(t2);
  }

  /**
   * Compares this object to the specified object
   *
   * @param o the object to compare to
   * @return a negative integer, zero, or a positive integer as this object is less than, equal to, or greater than the specified object
   */
  public int compareTo(String o) {
    String t1 = (_sValue != null)
                ? _sValue
                : _sDefaultValue;

    if ((t1 == null) || (o == null)) {
      //noinspection StringEquality
      return (t1 == o)
             ? 0
             : ((t1 == null)
                ? -1
                : 1);
    }

    return t1.compareTo(o);
  }

  /**
   * Returns true if and only if this string contains the specified
   * string
   *
   * @param s the sequence to search for
   * @return true if this string contains specified string, false otherwise
   */
  public boolean contains(String s) {
    String t1 = (_sValue != null)
        ? _sValue
        : _sDefaultValue;

    return !((t1 == null) || (s == null)) && t1.contains(s);

  }

  /**
   * Tests whether this object ends with the specified string
   *
   * @param s the string to test
   *
   * @return <code>true</code> if it doest; <code>false</code> otherwise
   */
  public boolean endsWith(String s) {
    String t1 = (_sValue != null)
        ? _sValue
        : _sDefaultValue;

    return !((t1 == null) || (s == null)) && t1.endsWith(s);

  }

  public boolean equals(aSPOTElement e) {
    if (e == this) {
      return true;
    }

    if (!(e instanceof SPOTPrintableString)) {
      return false;
    }

    SPOTPrintableString o  = (SPOTPrintableString) e;
    String              t1 = (_sValue != null)
                             ? _sValue
                             : _sDefaultValue;
    String              t2 = (o._sValue != null)
                             ? o._sValue
                             : o._sDefaultValue;

    if ((t1 == null) || (t2 == null)) {
      //noinspection StringEquality
      if (t1 != t2) {
        return false;
      }

    } else if (!t1.equals(t2)) {
      return false;
    }

    return spot_attributesEqual(this, o);
  }

  /**
   * Tests whether this object is equal to the specified object
   *
   * @param o the object to test
   *
   * @return <code>true</code> if this object is the same as the specified object; <code>false</code> otherwise
   */
  public boolean equals(SPOTOctetString o) {
    String t1 = (_sValue != null)
                ? _sValue
                : _sDefaultValue;
    String t2 = (o._sValue != null)
                ? o._sValue
                : o._sDefaultValue;

    if ((t1 == null) || (t2 == null)) {
      //noinspection StringEquality
      return t1 == t2;
    }

    return t1.equals(t2);
  }

  /**
   * Tests whether this object is equal to the specified object
   *
   * @param o the object to test
   *
   * @return <code>true</code> if this object is the same as the specified object; <code>false</code> otherwise
   */
  public boolean equals(SPOTPrintableString o) {
    String t1 = (_sValue != null)
                ? _sValue
                : _sDefaultValue;
    String t2 = (o._sValue != null)
                ? o._sValue
                : o._sDefaultValue;

    if ((t1 == null) || (t2 == null)) {
      //noinspection StringEquality
      return t1 == t2;
    }

    return t1.equals(t2);
  }

  /**
   * Tests whether this object is equal to the specified object
   *
   * @param o the object to test
   *
   * @return <code>true</code> if this object is the same as the specified object; <code>false</code> otherwise
   */
  public boolean equals(String o) {
    String t1 = (_sValue != null)
                ? _sValue
                : _sDefaultValue;

    if ((t1 == null) || (o == null)) {
      //noinspection StringEquality
       return t1 == o;
    }

    return t1.equals(o);
  }

  /**
   * Decodes the specified encoded string
   *
   * @param oval The octet string value (Base64 encoded)
   *
   * @return the value
   */
  public static String fromOctetString(String oval) {
    return  Base64.decodeUTF8(oval);
  }

  public int hashCode() {
    String s = (_sValue != null)
               ? _sValue
               : _osValue;

    if (s == null) {
      s = _sDefaultValue;
    }

    return (s != null)
           ? s.hashCode()
           : super.hashCode();
  }

  /**
   * Removes the existing value
   */
  public void spot_clear() {
    super.spot_clear();
    _sValue = null;
  }

  public Object[] spot_getRange() {
    if ((_nRangeMin < 0) && (_nRangeMax < 0)) {
      return null;
    }

    return new Object[] { _nRangeMin, _nRangeMax };
  }

  public final int spot_getType() {
    return SPOT_TYPE_OCTETSTRING;
  }

  /**
   * Retrieves the range of valid values for the object.
   *
   * @return The valid range as a displayable string
   */
  public String spot_getValidityRange() {
    return getRangeString(_nRangeMin,_nRangeMax);
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
  public void spot_setDefaultValue(String val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (val == null) {
      _sDefaultValue = null;

      return;
    }

    int len = val.length();

    do {
      if ((_nRangeMin != -1) && (len < _nRangeMin)) {
        break;    // string to short
      }

      if ((_nRangeMax != -1) && (len > _nRangeMax)) {
        break;    // string to long
      }

      _sDefaultValue = val;

      return;
    } while(false);

    throw new SPOTException(ILLEGAL_VALUE, STR_ILLEGAL_VALUE, val);
  }

  /**
   * Sets the valid range for the object
   *
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   */
  public void spot_setRange(int min, int max) {
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
  public void spot_setRange(String min, String max) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (min != null) {
      _nRangeMin = SNumber.intValue(min);
    }

    if (max != null) {
      _nRangeMax = SNumber.intValue(max);
    }
  }

  /**
   * Returns the value of the element as a string
   *
   * @return the value
   */
  public String spot_stringValue() {
    return getValue();
  }

  public String spot_stringValueEx() {
    return ((_sValue == null) && (_osValue == null) &&!spot_attributesWereSet())
           ? null
           : getValue();
  }

  /**
   * Tests whether this object starts with the specified string
   *
   * @param s the string to test
   *
   * @return <code>true</code> if it doest; <code>false</code> otherwise
   */
  public boolean startsWith(String s) {
    String t1 = (_sValue != null)
        ? _sValue
        : _sDefaultValue;

    return !((t1 == null) || (s == null)) && t1.startsWith(s);

  }

  /**
   * Converts the object to a <code>String</code> object
   *
   * @param s The string value
   *
   * @return The object
   */
  public static String toOctetString(String s) {
    String os = Base64.encodeBytes(UTF8Helper.getInstance().getBytes(s));

    return os.trim();
  }

  public boolean toSDF(Writer out, String tag, int depth, boolean outputempty, boolean outputComments)
          throws IOException {
    return toSDF(out, tag, depth, outputempty, getOctetValue(), outputComments);
  }

  /**
   * Converts the object to a <code>String</code> object
   *
   * @return The object
   */
  public String toString() {
    if (_sValue == null) {
      return null;
    }

    if (_osValue == null) {
      _osValue = toOctetString(_sValue);
    }

    return _osValue;
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(SPOTOctetString val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _sValue  = val.spot_stringValue();
    _osValue = null;
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(String val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _sValue  = val;
    _osValue = null;
  }

  /**
   * Retrieves the octet value
   *
   * @return The octet value
   */
  public String getOctetValue() {
    if ((_osValue == null) && (_sValue != null)) {
      _osValue = toOctetString(_sValue);
    }

    return _osValue;
  }

  /**
   * Sets the octet value
   *
   * @param value The octet value
   */
  public void setOctetValue(String value) {
    _osValue = value;
    _sValue  = null;
  }

  /**
   * Retrieves the value
   *
   * @return The value
   */
  public String getValue() {
    if ((_sValue == null) && (_osValue != null)) {
      _sValue = fromOctetString(_osValue);
    }

    if ((_sValue == null) && (_sDefaultValue != null)) {
      return _sDefaultValue;
    }

    return _sValue;
  }

  public boolean fromSDF(SDFNode node) throws SPOTException {
    boolean ok = super.fromSDF(node);

    if (ok) {
      _osValue = _sValue;
      _sValue  = null;
    }

    return ok;
  }

  protected int spot_checkRangeValidityEx() {
    if ((_sValue == null) && (_sDefaultValue != null)) {
      return VALUE_NULL_WITH_DEFAULT;
    }

    if ((_sValue == null) && _isOptional) {
      return VALUE_NULL_AND_OPTIONAL;
    }

    if (_sValue == null) {
      return VALUE_NULL;    // string to short
    }

    if ((_nRangeMin != -1) && (_sValue.length() < _nRangeMin)) {
      return -1;    // string to short
    }

    if ((_nRangeMax != -1) && (_sValue.length() > _nRangeMax)) {
      return VALUE_TO_BIG;    // string to long
    }

    return VALUE_OK;    // string just right
  }

  /**
   * Sets the values of the object.
   *
   * @param val the value.
   * @param min The object's minimum value range
   * @param max The object's maximum value range
   * @param optional Specifies if the element the object represents is optional
   */
  protected void setValues(String val, int min, int max, boolean optional) {
    _sValue     = val;
    _nRangeMin  = min;
    _nRangeMax  = max;
    _isOptional = optional;
  }
}
