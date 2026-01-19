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

import com.appnativa.util.Helper;
import com.appnativa.util.MutableInteger;
import com.appnativa.util.SNumber;
import com.appnativa.util.aStreamer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import java.util.Locale;
import java.util.Map;

/**
 * Enumerated represents a fixed named set of integer values. When
 * streaming as XML Enumerated values will be converted to their string
 * representation and encoded as a PrintableString. Negative values will
 * have a minus sign (ASCII 45) pre-pended to them.
 *
 * @author Don DeCoteau
 * @version   2.0
 */@SuppressWarnings("unused")
public class SPOTEnumerated extends aSPOTElement implements Comparable {

  /** numeric representation of choices */
  protected int[] _nChoices = null;

  /** string representation of choices */
  protected String[]       _sChoices = null;
  protected MutableInteger _iValue   = new MutableInteger(0);
  protected boolean        _bValSet  = false;
  protected MutableInteger _iDefValue;
  protected String         _sDefaultValue;
  protected String         _sValidRange;
  protected String         _sValue;

  /**
   * Creates a new <code>Enumerated</code> object with the specification
   * that the element represented by the object is mandatory.
   */
  public SPOTEnumerated() {
    this(true);
  }

  /**
   * Creates a new <code>Enumerated</code> object
   *
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTEnumerated(boolean optional) {
    _isOptional = optional;
  }

  /**
   * Creates a new <code>Enumerated</code> object
   *
   * @param val the value
   */
  public SPOTEnumerated(int val) {
    this(val, false);
  }

  /**
   * Creates a new <code>Enumerated</code> object
   *
   * @param val the value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTEnumerated(int val, boolean optional) {
    _isOptional = optional;
    setValue(val);
  }

  /**
   * Creates a new <code>Enumerated</code> object
   *
   * @param val the value
   * @param defaultval the default value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTEnumerated(int val, String defaultval, boolean optional) {
    _isOptional = optional;
    setValue(val);
    spot_setDefaultValue(defaultval);
  }

  /**
   * Creates a new <code>Enumerated</code> object
   * without checking the passed in values. The is meant for compilers
   * that pre check the values
   *
   * @param ival the integer value
   * @param sval the string value
   * @param idefaultval the integer default value
   * @param sdefaultval the string default value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTEnumerated(Integer ival, String sval, Integer idefaultval, String sdefaultval, boolean optional) {
    _isOptional = optional;

    if (ival != null) {
      _iValue.setValue(ival);
      _sValue = sval;
    }

    if (idefaultval != null) {
      _iDefValue     = new MutableInteger(idefaultval);
      _sDefaultValue = sdefaultval;
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
    SPOTEnumerated e = (SPOTEnumerated) super.clone();

    e._iValue = new MutableInteger(_iValue.getValue());

    return e;
  }

  /**
   * {@inheritDoc}
   *
   * @param o {@inheritDoc}
   *
   * @return {@inheritDoc}
   */
  public int compareTo(Object o) {
    return compareTo((SPOTEnumerated) o);
  }

  /**
   * {@inheritDoc}
   *
   * @param o {@inheritDoc}
   *
   * @return {@inheritDoc}
   */
  public int compareTo(SPOTEnumerated o) {
    if (o == null) {
      return 1;
    }

    MutableInteger num1 = _bValSet
                          ? _iValue
                          : _iDefValue;
    MutableInteger num2 = o._bValSet
                          ? o._iValue
                          : o._iDefValue;

    if ((num1 == null) || (num2 == null)) {
      return (num1 == num2)
             ? 0
             : ((num1 != null)
                ? 1
                : -1);
    }

    return num1.intValue() - num2.intValue();
  }

  /**
   * Returns the value of the element as a <code>double</code>
   *
   * @return the value
   */
  public double doubleValue() {
    return (double) getValue();
  }

  public boolean equals(aSPOTElement e) {
    if (!(e instanceof SPOTEnumerated)) {
      return false;
    }

    SPOTEnumerated o = (SPOTEnumerated) e;

    if (o == this) {
      return true;
    }

    MutableInteger num1 = _bValSet
                          ? _iValue
                          : _iDefValue;
    MutableInteger num2 = o._bValSet
                          ? o._iValue
                          : o._iDefValue;

    if ((num1 == null) || (num2 == null)) {
      if (num1 != num2) {
        return false;
      }
    } else if (!num1.equals(num2)) {
      return false;
    }

    return spot_attributesEqual(this, o);
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

    _bValSet = aStreamer.readBoolean(in);

    if (_bValSet) {
      _iValue.setValue(aStreamer.readInt(in));
    }
  }

  /**
   * {@inheritDoc}
   *
   * @return {@inheritDoc}
   */
  public int hashCode() {
    return _bValSet
           ? _iValue.intValue()
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
    if (!_bValSet) {
      return (_iDefValue != null)
             ? numValueNumber().setValue(_iDefValue.intValue())
             : null;
    }

    return numValueNumber().setValue(getValue());
  }

  /**
   * Check the validity of the object and any child objects.
   *
   * @return error message or <code>null</code> if the object is valid
   */
  public String spot_checkRangeValidityStr() {
    int    ret = spot_checkRangeValidity();
    String s   = null;

    switch(ret) {
      case VALUE_TO_BIG :      // this means that a value was entered that is greater than the specified range
      case VALUE_TO_SMALL :    // this means that a value was entered that is less than the specified range
        s = Helper.expandString(STR_INVALID, spot_getName(), spot_stringValue(), spot_getValidityRange(), STR_NOTONEOF);

        break;

      case VALUE_NULL :        // this means that the value is null
        s = Helper.expandString(STR_NULL, spot_getName());

        break;

      default :
        break;
    }

    return s;
  }

  /**
   * Removes the existing value
   */
  public void spot_clear() {
    super.spot_clear();
    _bValSet = false;
    _sValue  = null;
  }

  /**
   * Creates a property map from the enumerated choices
   *
   * @param map  the map to use to store the properties
   * @param prefix  an optional prefix to prepend to the choice name
   * @param propcase the case for the property names (0 for unchanged, -1 for lowercase, 1 for uppercase
   */
  public void spot_generateProperties(Map map, String prefix, int propcase) {
    String[] a   = _sChoices;
    int[]    n   = _nChoices;
    int      len = a.length;

    if ((prefix != null) && (prefix.length() == 0)) {
      prefix = null;
    }

    String s;

    for (int i = 0; i < len; i++) {
      s = a[i];

      if (prefix != null) {
        s = prefix + s;
      }

      if (propcase < 0) {
        s = s.toLowerCase(Locale.ENGLISH);
      } else if (propcase > 0) {
        s = s.toUpperCase(Locale.ENGLISH);
      }

      map.put(s, n[i]);
    }
  }

  /**
   * Retrieves the array of choices
   *
   * @return The choices
   */
  public int[] spot_getCopyOfIntChoices() {
    if (_nChoices == null) {
      return null;
    }

    int s[] = new int[_nChoices.length];

    System.arraycopy(_nChoices, 0, s, 0, _nChoices.length);

    return s;
  }

  /**
   * Retrieves the array of choices
   *
   * @return The choices
   */
  public String[] spot_getCopyOfStrChoices() {
    if (_sChoices == null) {
      return null;
    }

    String s[] = new String[_sChoices.length];

    System.arraycopy(_sChoices, 0, s, 0, _sChoices.length);

    return s;
  }

  /**
   * Gets the default value for the object.
   *
   * @return the default value or <code>null</code>
   */
  public String spot_getDefaultValue() {
    return _sDefaultValue;
  }

  public Object[] spot_getRange() {
    return spot_getCopyOfStrChoices();
  }

  /**
   * {@inheritDoc}
   *
   * @return {@inheritDoc}
   */
  public final int spot_getType() {
    return SPOT_TYPE_ENUMERATED;
  }

  /**
   * Retrieves the choices in brackets value
   *
   * @return The choices in brackets value
   */
  public String spot_getValidityRange() {
    if (_sValidRange != null) {
      return _sValidRange;
    }

    if (_sChoices == null) {
      return "{ }";
    }

    StringBuilder s = new StringBuilder("{ ");
    int           i;

    for (i = 0; i < (_sChoices.length - 1); i++) {
      s.append(_sChoices[i]);
      s.append(" (");
      s.append(_nChoices[i]);
      s.append("), ");
    }

    s.append(_sChoices[i]);
    s.append(" }");
    _sValidRange = s.toString();

    return _sValidRange;
  }

  public Object spot_getValue() {
    return getValue();
  }

  /**
   * Set the choices
   *
   * @param val The string choices
   * @param lval The numeric choices
   */
  public void spot_setChoices(String[] val, int[] lval) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _sChoices = val;
    _nChoices = lval;
  }

  /**
   * Set the choices
   *
   * @param val The string choices
   * @param lval The numeric choices
   */
  public void spot_setChoices(String[] val, long[] lval) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _sChoices = val;
    _nChoices = null;

    if (lval != null) {
      _nChoices = new int[lval.length];

      for (int i = 0; i < lval.length; i++) {
        _nChoices[i] = (int) lval[i];
      }
    }
  }

  /**
   * Sets the default value for the object.
   *
   * @param val The value to become the default (i.e. used when the object has
   *        no value )
   *
   */
  public void spot_setDefaultValue(int val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _sDefaultValue = null;
    _iDefValue     = null;

    if (_nChoices == null) {
      throw new SPOTException(ILLEGAL_VALUE, STR_ILLEGAL_VALUE, SNumber.toString(val));
    }

    for (int i = 0; i < _nChoices.length; i++) {
      if (_nChoices[i] == val) {
        _iDefValue     = new MutableInteger(val);
        _sDefaultValue = _sChoices[i];

        return;
      }
    }

    throw new SPOTException(ILLEGAL_VALUE, STR_ILLEGAL_VALUE, SNumber.toString(val));
  }

  /**
   * Sets the default value for the object.
   *
   * @param val The value to become the default (i.e. used when the object has
   *        no value )
   *
   */
  public void spot_setDefaultValue(long val) {
    spot_setDefaultValue((int) val);
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

    _iDefValue = null;

    if (val == null) {
      return;
    }

    if (_nChoices == null) {
      throw new SPOTException(ILLEGAL_VALUE, STR_ILLEGAL_VALUE, val);
    }

    for (int i = 0; i < _sChoices.length; i++) {
      if (_sChoices[i].equalsIgnoreCase(val)) {
        _iDefValue     = new MutableInteger(_nChoices[i]);
        _sDefaultValue = _sChoices[i];

        return;
      }
    }

    try {
      int l = Integer.parseInt(val);

      for (int i = 0; i < _nChoices.length; i++) {
        if (_nChoices[i] == l) {
          _iDefValue     = new MutableInteger(_nChoices[i]);
          _sDefaultValue = _sChoices[i];

          return;
        }
      }
    } catch(java.lang.NumberFormatException ignored) {}

    throw new SPOTException(ILLEGAL_VALUE, STR_ILLEGAL_VALUE, val);
  }

  /**
   * Sets the default value for the object.
   * The method doe not do an validation and is meant for compilers
   * @param ival The value to become the default (i.e. used when the object has
   *        no value )
   * @param sval the string version of the value
   *
   */
  public void spot_setDefaultValue(int ival, String sval) {
    if (_iDefValue == null) {
      _iDefValue = new MutableInteger(ival);
    } else {
      _iDefValue.setValue(ival);
    }

    _sDefaultValue = sval;
  }

  /**
   * Returns the int value for the specified string value
   *
   * @param val the string to convert to an int
   * @return the int value for the specified string value
   *
   * @throws SPOTException if the specified value is invalid
   */
  public int spot_stringToInt(String val) {
    if (val != null) {
      for (int i = 0; i < _sChoices.length; i++) {
        if (_sChoices[i].equalsIgnoreCase(val)) {
          return _nChoices[i];
        }
      }
    }

    String s = Helper.expandString(STR_NOT_ONEOF, val, spot_getValidityRange());

    throw new SPOTException(s);
  }

  /**
   * Returns the value of the element as a string
   *
   * @return the value
   */
  public String spot_stringValue() {
    return (_sValue == null)
           ? _sDefaultValue
           : _sValue;
  }

  public String spot_stringValueEx() {
    if ((_sValue == null) && spot_attributesWereSet()) {
      return _sDefaultValue;
    }

    return _sValue;
  }

  /**
   * Writes the object's value out to an output stream
   *
   * @param out the output stream
   *
   * @throws IOException if an I/O error occurs
   */
  public void toStream(OutputStream out) throws IOException {
    aStreamer.toStream(_bValSet, out);

    if (_bValSet) {
      aStreamer.toStream(_iValue.intValue(), out);
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
    setValue((long) val);
  }

  /**
   * Sets the value
   *
   * @param val the value
   *
   */
  public void setValue(int val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    for (int i = 0; i < _nChoices.length; i++) {
      if (_nChoices[i] == val) {
        _iValue.setValue(val);
        _sValue  = _sChoices[i];
        _bValSet = true;

        return;
      }
    }

    _bValSet = false;

    String s = Helper.expandString(STR_NOT_ONEOF, SNumber.toString(val), spot_getValidityRange());

    throw new SPOTException(s);
  }

  /**
   * Sets the value
   *
   * @param val the value
   *
   */
  public void setValue(long val) {
    setValue((int) val);
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(SNumber val) {
    setValue(val.intValue());
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(SPOTEnumerated val) {
    MutableInteger num = val._bValSet
                         ? val._iValue
                         : val._iDefValue;

    if (num != null) {
      setValue(num.intValue());
    } else {
      _bValSet = false;
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

    _bValSet = false;

    if (val == null) {
      spot_clear();
      return;
    }

    for (int i = 0; i < _sChoices.length; i++) {
      if (_sChoices[i].equalsIgnoreCase(val)) {
        _sValue = _sChoices[i];
        _iValue.setValue(_nChoices[i]);
        _bValSet = true;

        return;
      }
    }

    try {
      long l = SNumber.longValue(val, true);

      for (int i = 0; i < _nChoices.length; i++) {
        if (_nChoices[i] == l) {
          _sValue = _sChoices[i];
          _iValue.setValue(_nChoices[i]);
          _bValSet = true;

          return;
        }
      }
    } catch(java.lang.NumberFormatException e) {
      String s = Helper.expandString(STR_NOT_ONEOF, val, spot_getValidityRange());

      throw new SPOTException(s);
    }
  }

  /**
   * Get the integer value of a choice
   *
   * @param index the index of the choice
   *
   * @return the value of the choice at the specified index
   *
   *
   */
  public int getChoiceByIndex(int index) {
    return _nChoices[index];
  }

  /**
   * Get the integer value of a choice
   *
   * @param name the name of the choice
   *
   * @return the index of the named choice
   */
  public int getChoiceIndexByName(String name) {
    for (int i = 0; i < _sChoices.length; i++) {
      if (_sChoices[i].equalsIgnoreCase(name)) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Retrieves the value
   *
   * @return The value
   */
  public int getValue() {
    if (!_bValSet) {
      if (_iDefValue == null) {
        throw new SPOTException(STR_NULL_VALUE, (_theName == null)
                ? getClass().getName()
                : _theName);
      }

      return _iDefValue.intValue();
    }

    return _iValue.intValue();
  }

  protected int spot_checkRangeValidityEx() {
    if (!_bValSet && (_iDefValue != null)) {
      return VALUE_NULL_WITH_DEFAULT;
    }

    if (!_bValSet && _isOptional) {
      return VALUE_NULL_AND_OPTIONAL;
    }

    if (!_bValSet) {
      return VALUE_NULL;
    }

    if (_nChoices == null) {
      return VALUE_TO_SMALL;
    }

    return VALUE_OK;
  }
}
