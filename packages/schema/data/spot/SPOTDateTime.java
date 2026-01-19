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

import com.appnativa.util.DateEx;
import com.appnativa.util.DateUtils;
import com.appnativa.util.SNumber;

import java.time.ZoneId;
import java.time.ZonedDateTime;

import static java.time.temporal.ChronoUnit.DAYS;

/**
 * SPOTDateTime represents date and time element.
 * The format is:
 * <blockquote>
 * yyyy-MM-dd'T'hh:mm:ssZ<br> yyyy-MM-ddThh:mm:ss+hh'mm'<br>
 * yyyy-MM-dd'T'hh:mm:ss-hh'mm'<br>
 * o        <code>yyyy</code> represents the four digit year<br>
 * o        <code>MM</code> represents the two digit month<br>
 * o        <code>dd</code> represents the two digit day of the month<br>
 * o        <code>Z</code> indicates that local time is GMT<br>
 * o        <code>+</code>(plus) indicates that local time is later than GMT<br>
 * o        <code>-</code>(minus) indicates that local time is earlier than GMT<br>
 * o        <code>hh'</code> is the absolute value of the offset from GMT in hours<br>
 * o        <code>mm'</code> is the absolute value of the offset from GMT in
 * minutes<br>
 * </blockquote>
 *
 * @author Don DeCoteau
 * @version   2.0
 */
@SuppressWarnings({"MagicConstant","unused"})
public class SPOTDateTime extends aSPOTElement {

  static final int DAY_MASK = 0x1f;
  static final int HHMM_MASK = 0xfff;
  static final int MILL_MASK = 0x3ff;
  static final int MIN_MASK = 0x3f;
  static final int MONTH_MASK = 0xf;
  static final int SEC_MASK = 0x3f;
  static final int YEAR_MASK = 0xfff;

  /** three letter months of the year array */
  static final String months[] = {
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
  };

  /** DOCUMENT ME */
  static final double LN_10      = Math.log(10);
  DateEx            _cDefValue = null;
  DateEx            _cRangeMax = null;
  DateEx            _cRangeMin = null;
  DateEx            _cValue    = null;

  /**
   * Creates a new <code>DateTime</code> object with the specification that
   * the element represented by the object is mandatory.
   */
  public SPOTDateTime() {
    this(true);
  }

  /**
   * Creates a new <code>DateTime</code> object
   *
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   */
  public SPOTDateTime(boolean optional) {
    _isOptional = optional;
  }

  /**
   * Creates a new <code>DateTime</code> object
   *
   * @param val the value
   *
   * @throws SPOTException if the value of the object or a child object
   *         is invalid. The exception will contain information on the invalid
   *         object
   */
  public SPOTDateTime(DateEx val) throws SPOTException {
    _isOptional = false;
    setValue(val);
  }

  /**
   * Creates a new <code>DateTime</code> object
   *
   * @param val the value
   *
   * @throws SPOTException if the value of the object or a child object
   *         is invalid. The exception will contain information on the invalid
   *         object
   */
  public SPOTDateTime(SNumber val) throws SPOTException {
    _isOptional = false;
    setValue(val);
  }

  /**
   * Creates a new <code>DateTime</code> object
   *
   * @param val the value
   *
   * @throws SPOTException if the value of the object or a child object
   *         is invalid. The exception will contain information on the invalid
   *         object
   */
  public SPOTDateTime(String val) throws SPOTException {
    setValues(val, null, null, false);
  }

  /**
   * Creates a new <code>DateTime</code> object
   *
   * @param val the value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   *
   * @throws SPOTException if the value of the object or a child object
   *         is invalid. The exception will contain information on the invalid
   *         object
   */
  public SPOTDateTime(DateEx val, boolean optional) throws SPOTException {
    _isOptional = optional;
    setValue(val);
  }

  /**
   * Creates a new <code>DateTime</code> object
   *
   * @param val the value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   *
   * @throws SPOTException if the value of the object or a child object
   *         is invalid. The exception will contain information on the invalid
   *         object
   */
  public SPOTDateTime(String val, boolean optional) throws SPOTException {
    _isOptional = optional;
    setValues(val, null, null, false);
  }

  /**
   * Creates a new <code>DateTime</code> object
   *
   * @param val the value
   * @param defaultval the default value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   *
   * @throws SPOTException if the value of the object or a child object
   *         is invalid. The exception will contain information on the invalid
   *         object
   */
  public SPOTDateTime(String val, String defaultval, boolean optional) throws SPOTException {
    _isOptional = optional;
    setDefaultValue(defaultval);
    setValues(val, null, null, false);
  }

  /**
   * Creates a new <code>DateTime</code> object
   *
   * @param val the value
   * @param min The minimum acceptable value
   * @param max The maximum acceptable value
   *
   * @throws SPOTException if the value is invalid.
   */
  public SPOTDateTime(String val, String min, String max) throws SPOTException {
    setValues(val, min, max, false);
  }

  /**
   * Creates a new <code>DateTime</code> object
   *
   * @param val the value
   * @param min The minimum acceptable value
   * @param max The maximum acceptable value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   *
   * @throws SPOTException if the value is invalid.
   */
  public SPOTDateTime(String val, String min, String max, boolean optional) throws SPOTException {
    setValues(val, min, max, optional);
  }

  /**
   * Creates a new <code>DateTime</code> object
   *
   * @param val the value
   * @param min The minimum acceptable value
   * @param max The maximum acceptable value
   * @param defaultval the default value
   * @param optional <code>true</code> if the element the object represents is
   *        optional
   *
   * @throws SPOTException if the value is invalid.
   */
  public SPOTDateTime(String val, String min, String max, String defaultval, boolean optional) throws SPOTException {
    setValues(val, min, max, optional);
    setDefaultValue(defaultval);
  }

  /**
   * Returns the value of the element as a boolean
   *
   * @return the value
   *
   */
  public boolean booleanValue() {
    throw new NumberFormatException(STR_ILLEGAL_VALUE);
  }

  public Object clone() {
    SPOTDateTime dt = (SPOTDateTime) super.clone();

    if (_cValue != null) {
      dt._cValue = (DateEx) _cValue.clone();
    }

    return dt;
  }

  public int compareTo(Object o) {
    return compareTo((SPOTDateTime) o);
  }

  public int compareTo(SPOTDateTime o) {
    if (o == null) {
      return 1;
    }

    DateEx t1 = (_cValue != null)
                  ? _cValue
                  : _cDefValue;
    DateEx t2 = (o._cValue != null)
                  ? o._cValue
                  : o._cDefValue;

    if ((t1 == null) || (t2 == null)) {
      return (t1 == t2)
             ? 0
             : ((t1 != null)
                ? 1
                : -1);
    }

    return (int) (longValue() - o.longValue());
  }

  /**
   * Returns the value of the element as a <code>double</code>
   *
   * @return the value
   */
  public double doubleValue() {
    SNumber num = numberValue();

    if (num == null) {
      throw new SPOTException(STR_NULL_VALUE, (_theName == null)
              ? getClass().getName()
              : _theName);
    }

    return num.doubleValue();
  }

  public boolean equals(aSPOTElement e) {
    if (!(e instanceof SPOTDateTime)) {
      return false;
    }

    SPOTDateTime o  = (SPOTDateTime) e;
    DateEx     t1 = (_cValue != null)
                      ? _cValue
                      : _cDefValue;
    DateEx     t2 = (o._cValue != null)
                      ? o._cValue
                      : o._cDefValue;

    if ((t1 == null) || (t2 == null)) {
      if (t1 != t2) {
        return false;
      }
    } else if (longValue() != o.longValue()) {
      return false;
    }

    return spot_attributesEqual(this, o);
  }

  public int hashCode() {
    DateEx t1 = (_cValue != null)
                  ? _cValue
                  : _cDefValue;

    return (t1 != null)
           ? t1.hashCode()
           : super.hashCode();
  }

  /**
   * Returns the value of the element as a <code>int</code>
   *
   * @return the value
   *
   */
  public int intValue() {
    return (int) longValue();
  }

  /**
   * Returns the value of the element as a <code>long</code>
   *
   * @return the value
   */
  public long longValue() {
    DateEx t1 = (_cValue != null)
        ? _cValue
        : _cDefValue;
    if (t1 == null) {
      throw new SPOTException(STR_NULL_VALUE, (_theName == null)
          ? getClass().getName()
          : _theName);
    }
    return t1.getTimeInMillis();
  }

  /**
   * Get the current date and time
   *
   * @return the current date and time as a string
   */
  public static SPOTDateTime nowDateTime() {
    SPOTDateTime d = new SPOTDateTime();

    d.setToCurrentTime();

    return d;
  }

  /**
   * Returns the value of the element as a <code>SNumber</code>
   *
   * @return the value
   */
  public SNumber numberValue() {
    DateEx t1 = (_cValue != null)
                  ? _cValue
                  : _cDefValue;

    if (t1 == null) {
      return null;
    }

    return DateUtils.toSNumber(t1,true,numValueNumber());
  }
  /**
   * Removes the existing value
   */
  public void spot_clear() {
    super.spot_clear();
    _cValue = null;
  }

  public Object[] spot_getRange() {
    if ((_cRangeMin == null) && (_cRangeMax == null)) {
      return null;
    }

    return new Object[] { _cRangeMin, _cRangeMax };
  }

  public int spot_getType() {
    return SPOT_TYPE_DATETIME;
  }

  /**
   * Retrieves the range of valid values for the object.
   *
   * @return The valid range as a displayable string
   */
  public String spot_getValidityRange() {
    if ((_cRangeMin != null) || (_cRangeMax != null)) {
      String s;

      s = (_cRangeMin != null)
          ? (toString(_cRangeMin) + "..")
          : "..";

      if (_cRangeMax != null) {
        s += toString(_cRangeMax);
      }

      return s;
    } else {
      return "";
    }
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

    if ((min != null) && (min.length() > 0)) {
      _cRangeMin = DateUtils.parseDateTime(min);
    } else {
      _cRangeMin = null;
    }

    if ((max != null) && (max.length() > 0)) {
      _cRangeMax = DateUtils.parseDateTime(max);
    } else {
      _cRangeMax = null;
    }
  }

  /**
   * Returns the value of the element as a string
   *
   * @return the value
   */
  public String spot_stringValue() {
    DateEx t1 = (_cValue != null)
                  ? _cValue
                  : _cDefValue;

    return (t1 == null)
           ? null
           : toString(t1);
  }

  public String spot_stringValueEx() {
    return ((_cValue == null) &&!spot_attributesWereSet())
           ? null
           : spot_stringValue();
  }
  
  /**
   * Converts the object to its string representation
   *
   * @return The string
   */
  public String toString() {
    DateEx t1 = (_cValue != null)
                  ? _cValue
                  : _cDefValue;

    return (t1 == null)
           ? ""
           : toString(t1);
  }

  /**
   * Converts the object to its string representation
   *
   * @param date the date
   *
   * @return The object
   */
  public static String toString(DateEx date) {
    return toString(date, false, false);
  }

  public static String toString(DateEx date, boolean dateonly, boolean timeonly) {
    if(dateonly) {
      return DateUtils.ISO_DATE_FORMAT.format(date);
    }
    if(timeonly) {
      return DateUtils.ISO_TIME_FORMAT.format(date);
    }
    return DateUtils.ISO_DATE_TIME_FORMAT.format(date);
  }

  /**
   * Converts the object to a string in "dd MMM yyyy hh:mma" format
   *
   * @return The data and time
   *
   */
  public String toStringEx() {
    DateEx date = (_cValue == null)
                    ? _cDefValue
                    : _cValue;

    if (date == null) {
      throw new SPOTException(STR_NULL_VALUE, (_theName == null)
              ? getClass().getName()
              : _theName);
    }

    java.text.SimpleDateFormat df = new java.text.SimpleDateFormat("dd MMM yyyy hh:mma");

    return df.format(date.getTime());
  }

  /**
   * Converts the object to a <code>String</code> object
   *
   * @param format The format to represent the DateTime object as
   *
   * @return The date and time
   *
   */
  public String toStringEx(String format) {
    DateEx date = (_cValue == null)
                    ? _cDefValue
                    : _cValue;

    if (date == null) {
      throw new SPOTException(STR_NULL_VALUE, (_theName == null)
              ? getClass().getName()
              : _theName);
    }

    java.text.SimpleDateFormat df = new java.text.SimpleDateFormat(format);

    return df.format(date.getTime());
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

    if (val == null) {
      _cDefValue = null;
    } else {
      _cDefValue = DateUtils.parseDateTime(val);
    }
  }


  /**
   * Sets the to current time value
   */
  public void setToCurrentTime() {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _cValue = new DateEx();
  }

  /**
   * Sets the value
   *
   * @param val the value
   *
   */
  public void setValue(boolean val) {
    throw new SPOTException(NOT_SUPPORTED, STR_NOT_SUPPORTED, "Sequence");
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(DateEx val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (val == null) {
      spot_clear();

      return;
    }

    _cValue = (DateEx) val.clone();
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(double val) {
    setValue(new SNumber(val));
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

    _cValue = new DateEx(val);
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

   _cValue=DateUtils.fromSNumber(val);
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(SPOTDateTime val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    DateEx cal = val._cValue;

    if (cal == null) {
      cal = val._cDefValue;
    }

    if (cal == null) {
      spot_clear();

      return;
    }

    _cValue=new DateEx(cal.getZonedDateTime());
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

    if (val == null) {
      spot_clear();

      return;
    }

    if (val.length() == 0) {
      setValue(new DateEx());
    } else {
      _cValue=DateUtils.parseDateTime(val);
    }
  }


  /**
   * Retrieves the calendar value
   *
   * @return The time zone value
   */
  public DateEx getDate() {
    return _cValue;
  }

  /**
   * Retrieves the time zone value
   *
   * @return The time zone value
   */
  public ZoneId getTimeZone() {
    return (_cValue == null)
           ? ZoneId.systemDefault()
           : _cValue.getZone();
  }

  /**
   * Retrieves the value
   *
   * @return The value
   */
  public DateEx getValue() {
    if (_cValue == null) {
      return (_cDefValue != null)
             ? _cDefValue
             : null;
    }

    return _cValue;
  }

  /**
   * Returns whether this date represents the current date
   *
   * @return <code>true</code> if this date represents current date; <code>false </code> otherwise
   */
  public boolean isToday() {
    if (_cValue == null) {
      return false;
    }
    return DAYS.between(_cValue.getZonedDateTime(), ZonedDateTime.now())==0;
  }

  protected int spot_checkRangeValidityEx() {
    if ((_cValue == null) && (_cDefValue != null)) {
      return VALUE_NULL_WITH_DEFAULT;    // optional string don't need a value
    }

    if ((_cValue == null) && _isOptional) {
      return VALUE_NULL_AND_OPTIONAL;    // optional string don't need a value
    }

    if (_cValue == null) {
      return VALUE_NULL;
    }

    if ((_cRangeMin != null) && _cValue.before(_cRangeMin)) {
      return VALUE_TO_SMALL;    // to early
    }

    if ((_cRangeMax != null) && _cValue.after(_cRangeMax)) {
      return VALUE_TO_BIG;    // to late
    }

    return VALUE_OK;    // just right
  }

  /**
   * Sets the values of the object.
   *
   * @param val the value.
   * @param min The minimum acceptable value
   * @param max The maximum acceptable value
   * @param optional Specifies if the element the object represents is optional
   */
  protected void setValues(String val, String min, String max, boolean optional) {
    _isOptional = optional;
    spot_setRange(min, max);
    setValue(val);
  }
}
