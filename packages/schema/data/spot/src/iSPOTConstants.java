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

import com.appnativa.util.json.JSONBinary;

/**
 * SPOT Constants
 *
 * @author Don DeCoteau
 * @version   2.0
 *
 */
public interface iSPOTConstants {

  /** represents an illegal SPOT value */
  public static final int ILLEGAL_VALUE = 3;

  /** represents an invalid SPOT element */
  public static final int INVALID_ELEMENT = 8;

  /** represents an invalid SPOT value */
  public static final int INVALID_VALUE = 1;

  /** represents an invalid SPOT value */
  public static final int MISSING_ELEMENTS = 9;

  /** represents a missing or invalid class name for an element that requires a class name be specified */
  public static final int NOT_CLASS = 6;

  /** represents an unsupported SPOT action */
  public static final int NOT_SUPPORTED = 4;

  /** represents a failure to create an instance of a SPOT element */
  public static final int NO_CREATE = 7;

  /** represents an NULL value SPOT action */
  public static final int NULL_VALUE = 2;

  /** represents an attempt to modify a read only element SPOT action */
  public static final int READ_ONLY = 11;

  /** represents a SPOT Any  type */
  public static final int SPOT_TYPE_ANY = 5;

  /** represents a SPOT Boolean  type */
  public static final int SPOT_TYPE_BOOLEAN = 13;

  /** represents a SPOT ByteString  type */
  public static final int SPOT_TYPE_BYTESTRING = 14;

  /** represents a SPOT DateEx  type */
  public static final int SPOT_TYPE_DATE = 8;

  /** represents a SPOT DateTime  type */
  public static final int SPOT_TYPE_DATETIME = 7;

  /** represents a SPOT Enumerated type */
  public static final int SPOT_TYPE_ENUMERATED = 12;

  /** represents a SPOT Extended  type */
  public static final int SPOT_TYPE_EXTENDS = 15;

  /** represents a SPOT Integer type */
  public static final int SPOT_TYPE_INTEGER = 10;

  /** represents a SPOT OctetString type */
  public static final int SPOT_TYPE_OCTETSTRING = 2;

  /** represents a SPOT PrintableString type */
  public static final int SPOT_TYPE_PRINTABLESTRING = 1;

  /** represents a SPOT Real type */
  public static final int SPOT_TYPE_REAL = 11;

  /** represents a SPOT Refined  type */
  public static final int SPOT_TYPE_REFINE = 16;

  /** represents a SPOT Sequence type */
  public static final int SPOT_TYPE_SEQUENCE = 4;

  /** represents a SPOT Set type */
  public static final int SPOT_TYPE_SET = 3;

  /** represents a SPOT Time type */
  public static final int SPOT_TYPE_TIME = 9;

  /** represents a user-defined SPOT type */
  public static final int SPOT_TYPE_USERCLASS = 20;

  /** bad element message */
  public static final String STR_BAD_ELEMENT = "Element [%s] for %s is invalid { %s }";

  /** string containing "greater than" */
  public static final String STR_GREATER_THAN = "greater than";

  /** static string for use in error messages */
  public static final String STR_ILLEGAL_VALUE = "illegal value (%s)";

  /** static string for use in error messages */
  public static final String STR_INVALID =
    "The value of element [%s] is invalid.\nThe value { %s } is %s the acceptable range ( %s )";

  /** static string for use in error messages */
  public static final String STR_INVALID_ATTRIBUTE = "Element [%s] is not defined to have the attribute [%s].";

  /** static string for use in error messages */
  public static final String STR_INVALID_ELEMENT = "Element [%s] was expected; element [%s] found.";

  /** static string for use in error messages */
  public static final String STR_INVALID_RANGE = "the value { %s } is %s than the specified range ( %s )";

  /** static string for use in error messages */
  public static final String STR_INVALID_VALUE = "The value of element [%s] is invalid";

  /** string containing "less than" */
  public static final String STR_LESS_THAN = "less than";

  /** static string for use in error messages */
  public static final String STR_MISSING_ELEMENTS =
    "The expected element count for [%s] was (%s); the actual count was (%s)";

  /** string containing "not one of" */
  public static final String STR_NOTONEOF = "not one of";

  /** static string for use in error messages */
  public static final String STR_NOT_CLASS =
    " This SPOTSet or SPOTAny object is restricted to objects of type (%s); classes of type (%s) are not valid";

  /** static string for use in error messages */
  public static final String STR_NOT_EXIST = "element [%s] does not exist";

  /** static string for use in error messages */
  public static final String STR_NOT_ONEOF = "The value specified (%s) is not one of %s";

  /** static string for use in error messages */
  public static final String STR_NOT_SUPPORTED = "The requested operation is not supported or %s objects";

  /** static string for use in error messages */
  public static final String STR_NO_CREATE = "Failed to create object (%s)";

  /** static string for use in error messages */
  public static final String STR_NULL =
    "The value of element [%s] is invalid.\nThe value is null for a required element";

  /** static string for use in error messages */
  public static final String STR_NULL_VALUE = "The value of element [%s] is a null value";

  /** static string for use in error messages */
  public static final String STR_READ_ONLY = "The element [%s] is READ-ONLY and cannot be modified";

  /** static string for use in error messages */
  public static final String STR_TOFEW_ELEMENTS =
    "The element count for [%s] is (%s) and the minimum size of the SET is (%s)";

  /** static string for use in error messages */
  public static final String STR_TOMANY_ELEMENTS =
    "The element count  for [%s] is (%s) and the maximum size of the SET is (%s)";

  /** static string for use in error messages */
  public static final String STR_MISSING_ATTRIBUTES = "The element is missing the following required attributes { %s}";

  /** represents that an attempt was made to add an element to a set whose maximum has already been reached */
  public static final int TOMANY_ELEMENTS = 10;

  /** represents an unexpected exception */
  public static final int UNEXPECTED_EXCEPTION = 0;

  /** represents an element with missing required attributes */
  public static final int VALUE_MISSING_REQUIRED_ATTTRIBUTES = -6;

  /** represents a container with a child that has an invalid value */
  public static final int VALUE_INVALID_CHILD = -5;

  /** represents an required element with a NULL value and no default value */
  public static final int VALUE_NULL = -2;

  /** represents an optional element with a NULL value */
  public static final int VALUE_NULL_AND_OPTIONAL = -3;

  /** represents an element with a NULL value that is configured with a default */
  public static final int VALUE_NULL_WITH_DEFAULT = -4;

  /** represents an OK value */
  public static final int VALUE_OK = 0;

  /** represents a value that is larger then the valid minimum */
  public static final int VALUE_TO_BIG = 1;

  /** represents a value that is smaller then the valid minimum */
  public static final int VALUE_TO_SMALL = -1;

  /** prefix of SPOT elements in this package ("SPOT") */
  public static final String classPrefix = "SPOT";

  /** the name of the package for SPOT elements (allows java package to change) */
  public static String SPOT_PACKAGE_NAME = "com.appnativa.spot";
  static final String  emptyString       = "";
  String JSON_LINKED_DATA_PROPERTY="_linkedData";
  String JSON_ATTRIBUTES_PROPERTY="_attributes";
  String JSON_VALUE_PROPERTY="_value";
  String JSON_CLASS_PROPERTY=JSONBinary.CLASS_PROPERTY;
}
