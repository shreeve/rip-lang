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

import com.appnativa.util.ByteArray;
import com.appnativa.util.ByteArrayHolder;
import com.appnativa.util.Helper;
import com.appnativa.util.SNumber;
import com.appnativa.util.UTF8Helper;
import com.appnativa.util.aStreamer;
import com.appnativa.util.iCharsetHelper;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * A string consisting of bytes
 *
 * @author Don DeCoteau
 * @version   2.0
 */
@SuppressWarnings("unused")
public class SPOTByteString extends aSPOTElement implements Comparable {
  byte[]          _baDefValue = null;
  byte[]          _baValue    = null;
  String          _sValue     = null;
  iCharsetHelper  _csh;
  int             _len;
  long            _nRangeMax;
  long            _nRangeMin;
  ByteArrayHolder _outHolder;
  int             _pos;

  /**
   * Creates a new <code>PrintableString</code> object with the
   * specification that the element represented by the object is mandatory.
   */
  public SPOTByteString() {
    this(null, -1, -1, true);
  }

  /**
   * Creates a new <code>PrintableString</code> object
   *
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTByteString(boolean optional) {
    setValues(null, -1, -1, optional);
  }

  /**
   * Creates a new <code>PrintableString</code> object
   *
   * @param val the value
   */
  public SPOTByteString(byte[] val) {
    setValues(val, -1, -1, false);
  }

  /**
   * Creates a new <code>PrintableString</code> object
   *
   * @param val the value
   */
  public SPOTByteString(String val) {
    setValues((val == null)
              ? null
              : val.getBytes(), -1, -1, false);
  }

  /**
   * Creates a new <code>PrintableString</code> object
   *
   * @param val the value
   * @param max The object's maximum acceptable value
   */
  public SPOTByteString(String val, long max) {
    setValues((val == null)
              ? null
              : val.getBytes(), -1, max, false);
  }

  /**
   * Creates a new <code>PrintableString</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   */
  public SPOTByteString(String val, long min, long max) {
    setValues((val == null)
              ? null
              : val.getBytes(), min, max, false);
  }

  /**
   * Creates a new <code>PrintableString</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTByteString(byte[] val, String min, String max, boolean optional) {
    setValues(null, min, max, optional);
    setValue(val);
  }

  /**
   * Creates a new <code>PrintableString</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTByteString(String val, long min, long max, boolean optional) {
    setValues((val == null)
              ? null
              : val.getBytes(), min, max, optional);
  }

  /**
   * Creates a new <code>PrintableString</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTByteString(String val, String min, String max, boolean optional) {
    setValues(val, min, max, optional);
  }

  /**
   * Creates a new <code>PrintableString</code> object
   *
   * @param val the value
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   * @param defaultval the default value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTByteString(String val, String min, String max, String defaultval, boolean optional) {
    setValues(val, min, max, optional);
    setDefaultValue(defaultval);
  }

  public int compareTo(Object o) {
    return compareTo((SPOTByteString) o);
  }

  public int compareTo(SPOTByteString o) {
    if (o == null) {
      return 1;
    }

    byte[] t1 = (_baValue != null)
                ? _baValue
                : _baDefValue;
    byte[] t2 = (o._baValue != null)
                ? o._baValue
                : o._baDefValue;

    if ((t1 == null) || (t2 == null)) {
      return (t1 == t2)
             ? 0
             : ((t1 != null)
                ? 1
                : -1);
    }

    return ByteArray.compareTo(t1, _pos, _len, t2, o._pos, o._len);
  }

  public boolean equals(Object o) {
    return o instanceof SPOTByteString && equals((SPOTByteString) o);

  }

  public boolean equals(aSPOTElement e) {
    if (!(e instanceof SPOTByteString)) {
      return false;
    }

    SPOTByteString o = (SPOTByteString) e;

    if ((_baValue == null) || (o._baValue == null)) {
      if (_baValue != o._baValue) {
        return false;
      }
    } else if (ByteArray.compareTo(_baValue, _pos, _len, o._baValue, o._pos, o._len) != 0) {
      return false;
    }

    return spot_attributesEqual(this, e);
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

    _pos = 0;
    _len = 0;

    int len = aStreamer.readVarLength(in);

    if (len == -1) {
      _baValue = null;
    } else {
      _baValue = new byte[len];

      int n;
      int pos = 0;

      while(len > 0) {
        n = in.read(_baValue, pos, len);

        if (n == -1) {
          break;
        }

        pos += n;
        len -= n;
      }

      _len = len;
    }
  }

  public int hashCode() {
    int    h = 0;
    byte[] a = (_baValue == null)
               ? _baDefValue
               : _baValue;

    if (a != null) {
      int len = _len + _pos;
      int i   = _pos;

      while(i < len) {
        h = (31 * h) + a[i++];
      }
    }

    return h;
  }

  protected int spot_checkRangeValidityEx() {
    if (_isOptional && ((_baValue == null) || (_len == 0) || (_baDefValue != null))) {
      return VALUE_NULL_AND_OPTIONAL;
    }

    if (_baValue == null) {
      return VALUE_NULL;    // string to short
    }

    if ((_nRangeMin != -1) && (_len < _nRangeMin)) {
      return VALUE_TO_SMALL;    // string to short
    }

    if ((_nRangeMax != -1) && (_len > _nRangeMax)) {
      return VALUE_TO_BIG;    // string to long
    }

    return VALUE_OK;    // string just right
  }

  /**
   * Removes the existing value
   */
  public void spot_clear() {
    super.spot_clear();
    _baValue = null;
  }

  public Object[] spot_getRange() {
    if ((_nRangeMin < 1) && (_nRangeMax < 1)) {
      return null;
    }

    return new Object[] { Long.valueOf(_nRangeMin), Long.valueOf(_nRangeMax) };
  }

  public final int spot_getType() {
    return SPOT_TYPE_BYTESTRING;
  }

  /**
   * Retrieves the range of valid values for the object.
   *
   * @return The valid range as a displayable string
   */
  public String spot_getValidityRange() {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    String s = "";

    if ((_nRangeMin != -1) || (_nRangeMax != -1)) {
      s = (_nRangeMin != -1)
          ? (SNumber.toString(_nRangeMin) + "..")
          : "..";

      if (_nRangeMax != -1) {
        s += SNumber.toString(_nRangeMax);
      }
    }

    return s;
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
  public void spot_setRange(String min, String max) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (min != null) {
      _nRangeMin = SNumber.longValue(min);
    }

    if (max != null) {
      _nRangeMax = SNumber.longValue(max);
    }
  }

  /**
   * Returns the value of the element as a string
   *
   * @return the value
   */
  public String spot_stringValue() {
    iCharsetHelper csh = (_csh == null)
                         ? UTF8Helper.getInstance()
                         : _csh;

    if (_baValue == null) {
      if (_baDefValue == null) {
        return null;
      }

      if (_sValue == null) {
        _sValue = csh.getString(_baDefValue);
      }
    } else {
      _sValue = csh.getString(_baValue, _pos, _len);
    }

    return _sValue;
  }

  public String spot_stringValueEx() {
    return ((_baValue == null) &&!spot_attributesWereSet())
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
    if (_baValue == null) {
      aStreamer.writeVarLength(-1, out);
    } else {
      aStreamer.writeVarLength(_len, out);
      out.write(_baValue, _pos, _len);
    }
  }

  /**
   *  Sets a character set helper for the marshal
   *
   *  @param csh the character set helper
   */
  public void setCharsetHelper(iCharsetHelper csh) {
    _csh = csh;
  }

  /**
   * Sets the default value for the object.
   *
   * @param val The value to become the default (i.e. used when the object has
   *        no value )
   */
  public void setDefaultValue(String val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    iCharsetHelper csh = (_csh == null)
                         ? UTF8Helper.getInstance()
                         : _csh;

    _baDefValue = (val == null)
                  ? null
                  : csh.getBytes(val);
    _len        = (val == null)
                  ? 0
                  : _baDefValue.length;
    _pos        = 0;
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(byte[] val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _baValue = val;
    _sValue  = null;
    _len     = (val == null)
               ? 0
               : val.length;
    _pos     = 0;
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

    iCharsetHelper csh = (_csh == null)
                         ? UTF8Helper.getInstance()
                         : _csh;

    _sValue  = val;
    _baValue = (val == null)
               ? null
               : csh.getBytes(val);
    _len     = (val == null)
               ? 0
               : _baValue.length;
    _pos     = 0;
  }

  /**
   * Sets the value
   *
   * @param val the value
   * @param pos the starting positin
   * @param len the number of bytes
   */
  public void setValue(byte[] val, int pos, int len) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _sValue  = null;
    _baValue = val;
    _pos     = pos;
    _len     = len;
  }

  public Object spot_getValue() {
    return getValue();
  }

  /**
   * Retrieves the value
   *
   * @return The value
   */
  public ByteArrayHolder getValue() {
    if ((_baValue == null) && (_baDefValue == null)) {
      return null;
    }

    if (_outHolder == null) {
      _outHolder = new ByteArrayHolder();
    }

    if (_baValue == null) {
      _outHolder.set(_baDefValue, _pos, _len);
    } else {
      _outHolder.set(_baValue, _pos, _len);
    }

    return _outHolder;
  }

  /**
   * Sets the values of the object.
   *
   * @param val the value.
   * @param min The object's minimum value range
   * @param max The object's maximum value range
   * @param optional Specifies if the element the object represents is optional
   */
  protected void setValues(byte[] val, long min, long max, boolean optional) {
    _sValue     = null;
    _baValue    = val;
    _nRangeMin  = min;
    _nRangeMax  = max;
    _isOptional = optional;
    _len        = (val == null)
                  ? 0
                  : val.length;
    _pos        = 0;
  }

  /**
   * Sets the values of the object.
   *
   * @param val the value.
   * @param min The object's minimum value range
   * @param max The object's maximum value range
   * @param optional Specifies if the element the object represents is optional
   */
  protected void setValues(String val, String min, String max, boolean optional) {
    long           nmin = -1;
    long           nmax = -1;
    iCharsetHelper csh  = (_csh == null)
                          ? UTF8Helper.getInstance()
                          : _csh;

    _sValue = val;

    if (min != null) {
      nmin = SNumber.longValue(min);
    }

    if (max != null) {
      nmax = SNumber.longValue(max);
    }

    _baValue    = (val == null)
                  ? null
                  : csh.getBytes(val);
    _len        = (val == null)
                  ? 0
                  : _baValue.length;
    _pos        = 0;
    _nRangeMin  = nmin;
    _nRangeMax  = nmax;
    _isOptional = optional;
  }
}
