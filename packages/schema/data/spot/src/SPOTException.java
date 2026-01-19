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

/**
 * SPOT exception class
 *
 * @author Don DeCoteau
 * @version   2.0
 */
@SuppressWarnings("unused")
public class SPOTException extends RuntimeException {

  /** represents an unexpected exception */
  public static final int UNEXPECTED_EXCEPTION = iSPOTConstants.UNEXPECTED_EXCEPTION;

  /** represents that an attempt was made to add an element to a set whose maximum has already been reached */
  public static final int TOMANY_ELEMENTS = iSPOTConstants.TOMANY_ELEMENTS;

  /** represents an attempt to modify a read only element SPOT action exception type */
  public static final int READ_ONLY = iSPOTConstants.READ_ONLY;

  /** represents an NULL value SPOT action exception type */
  public static final int NULL_VALUE = iSPOTConstants.NULL_VALUE;

  /** represents a failure to create an instance of a SPOT elenent exception type */
  public static final int NO_CREATE = iSPOTConstants.NO_CREATE;

  /** represents an unsupported SPOT action exception type */
  public static final int NOT_SUPPORTED = iSPOTConstants.NOT_SUPPORTED;

  /** represents a missing or invalid class name for an element that requires a class name be specified */
  public static final int NOT_CLASS = iSPOTConstants.NOT_CLASS;

  /** represents an invalid SPOT value exception type */
  public static final int MISSING_ELEMENTS = iSPOTConstants.MISSING_ELEMENTS;

  /** represents an invalid SPOT value exception type */
  public static final int INVALID_VALUE = iSPOTConstants.INVALID_VALUE;

  /** represents an invalid SPOT element exception type */
  public static final int INVALID_ELEMENT = iSPOTConstants.INVALID_ELEMENT;

  /** represents an illegal SPOT value exception type */
  public static final int ILLEGAL_VALUE = iSPOTConstants.ILLEGAL_VALUE;

  /** the initiating exception */
  public Throwable initiatingException = null;
  int              exceptionType       = INVALID_VALUE;

  /**
   * Create a new <code>SPOTException</code> object
   */
  public SPOTException() {
    super();
  }

  /**
   * Create a new <code>SPOTException</code> object
   *
   * @param throwable the exception message
   */
  public SPOTException(Throwable throwable) {
    super(throwable);
    exceptionType       = UNEXPECTED_EXCEPTION;
    initiatingException = throwable;
  }

  /**
   * Create a new <code>SPOTException</code> object
   *
   * @param message the exception message
   * @param e the exception message
   */
  public SPOTException(String message, Exception e) {
    super(message, e);
    exceptionType       = UNEXPECTED_EXCEPTION;
    initiatingException = e;
  }

  /**
   * Create a new <code>SPOTException</code> object
   *
   * @param type the type of exception
   * @param message the exception message
   * @param e the exception message
   */
  public SPOTException(int type, String message, Exception e) {
    super(message, e);
    exceptionType       = type;
    initiatingException = e;
  }

  /**
   * Create a new <code>SPOTException</code> object
   *
   * @param message the exception message
   */
  public SPOTException(String message) {
    super(message);
  }

  /**
   * Create a new <code>SPOTException</code> object
   *
   * @param type the type of exception
   * @param message the exception message
   */
  public SPOTException(int type, String message) {
    super(message);
    exceptionType = type;
  }

  /**
   * Create a new <code>SPOTException</code> object
   *
   * @param msgspec the exception message specification
   * @param msgparam the exception message parameter
   */
  public SPOTException(String msgspec, String msgparam) {
    super(Helper.expandString(msgspec, msgparam));
  }

  /**
   * Create a new <code>SPOTException</code> object
   *
   * @param type the type of exception
   * @param msgspec the exception message specification
   * @param msgparam the exception message parameter
   */
  public SPOTException(int type, String msgspec, String msgparam) {
    super(Helper.expandString(msgspec, msgparam));
    exceptionType = type;
  }

  /**
   * Create a new <code>SPOTException</code> object
   *
   * @param msgspec the exception message specification
   * @param msgparam the exception message parameter
   * @param msgparam2 second exception message parameter
   */
  public SPOTException(String msgspec, String msgparam, String msgparam2) {
    super(Helper.expandString(msgspec, msgparam, msgparam2));
  }

  /**
   * Create a new <code>SPOTException</code> object
   *
   * @param type the type of exception
   * @param msgspec the exception message specification
   * @param msgparam the exception message parameter
   * @param msgparam2 second exception message parameter
   */
  public SPOTException(int type, String msgspec, String msgparam, String msgparam2) {
    super(Helper.expandString(msgspec, msgparam, msgparam2));
    exceptionType = type;
  }

  /**
   * Create a new <code>SPOTException</code> object
   *
   * @param msgspec the exception message specification
   * @param msgparam the exception message parameter
   * @param msgparam2 second exception message parameter
   * @param msgparam3 second exception message parameter
   */
  public SPOTException(String msgspec, String msgparam, String msgparam2, String msgparam3) {
    super(Helper.expandString(msgspec, msgparam, msgparam2, msgparam3));
  }

  /**
   * Returns the initiating exception
   *
   * @return the type initiating exception or <code>null</code>
   */
  public Throwable getInitiatingException() {
    return initiatingException;
  }

  /**
   * Returns the exception type
   *
   * @return the type
   */
  public int getType() {
    return exceptionType;
  }
}
