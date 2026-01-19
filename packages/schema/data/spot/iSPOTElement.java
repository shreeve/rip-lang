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

import com.appnativa.util.iStreamable;
import com.appnativa.util.iStructuredNode;
import com.appnativa.util.json.iJSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.io.Writer;
import java.util.Map;

/**
 * The interface that all SPOT objects must support.
 *
 * @author Don DeCoteau
 * @version 2.0
 */
public interface iSPOTElement extends iStreamable {

  /**
   * Returns a deep clone of this object
   *
   * @return a deep clone of this object
   */
  Object clone();

  /**
   * Takes an SDF formatted structure  and populates the object's values and
   * child objects using in the information in the structure. Data validation
   * is not performed
   *
   * @param node the SDF node
   * @return <code>true</code> if the operation was successful;
   * <code>false</code> otherwise
   */
  boolean fromSDF(SDFNode node);

  /**
   * Takes some structured data and populates the object's values and
   * child objects using in the information in the structure. Data validation
   * is not performed
   *
   * @param node the structured node
   * @return <code>true</code> if the operation was successful;
   * <code>false</code> otherwise
   */
  boolean fromStructuredNode(iStructuredNode node);

  /**
   * Adds the contents of the specified map as attributes
   *
   * @param map the map of attributes to add
   */
  void spot_addAttributes(Map map);

  /**
   * Returns whether the element has an attribute that was explicitly set
   *
   * @return <code>true</code> if an attribute was explicitly set; otherwise <code>false</code>
   */
  boolean spot_attributesWereSet();

  /**
   * Check the validity of the object and any child objects.
   *
   * @return <code>VALUE_TO_BIG</code> means that a value was entered that is greater than
   * the specified range.<br>
   * <code>VALUE_OK</code> means that the value is within the valid range specified<br>
   * <code>VALUE_TO_SMALL</code> means that a value was entered that is less than
   * the specified range<br>
   * <code>VALUE_NULL</code> means that the value is null<br>
   * <code>VALUE_NULL_AND_OPTIONAL</code> means that the value is null but the element is
   * designated as optional<br>
   * <code>VALUE_NULL_WITH_DEFAULT</code> means that the value is null but the element has a default value<br>
   */
  int spot_checkRangeValidity();

  /**
   * Check the validity of the object and any child objects.
   *
   * @return error message or <code>null</code> if the object is valid
   */
  String spot_checkRangeValidityStr();

  /**
   * Will cause the attribute map to be cleaned such that spot_attributesWereSet()
   * will return false if no other attributes have been modified
   */
  void spot_cleanAttributes();

  /**
   * Removes any existing values.
   */
  void spot_clear();

  /**
   * Will cause the attribute map to be cleared
   */
  void spot_clearAttributes();

  /**
   * Copies the value and attributes of the specified
   * element to this element. If newinstance is true
   * then the element will not be cleared prior to the copy and
   * the read only flag will not be checked
   *
   * @param element     the element
   * @param newinstance true if the copy if for a new instance; false otherwise
   */
  void spot_copy(iSPOTElement element, boolean newinstance);

  /**
   * Defines an attribute;
   *
   * @param name         The name of the attribute
   * @param defaultValue the defaultValue
   */
  void spot_defineAttribute(String name, String defaultValue);

  /**
   * Defines attributes using the specified map of values
   *
   * @param attributes The map of attribute values
   */
  void spot_defineAttributes(Map attributes);

  /**
   * Returns the value of the element as a SPOT element
   * The value is typically "this" object unless "this" object is a wrapper
   *
   * @return the value
   */
  iSPOTElement spot_elementValue();

  /**
   * Check to see if the specified element is equal to this one
   * The two elements are assumed to be of the same defined type
   * and to contain the same defined attribute set
   *
   * @param e the element
   * @return true if the element are equal; false otherwise
   */
  boolean spot_equals(iSPOTElement e);

  /**
   * Retrieves the value of an attribute
   *
   * @param attribute The name of the attribute to retrieve
   * @return The value of the attribute
   */
  String spot_getAttribute(String attribute);

  /**
   * Retrieves the count of available attributes
   *
   * @return the count of available attributes
   */
  int spot_getAttributeCount();

  /**
   * Retrieves the default value of an attribute
   *
   * @param name The name of the attribute to retrieve
   * @return The default value of the attribute
   */
  String spot_getAttributeDefaultValue(String name);

  /**
   * Retrieves an unmodifiable list of attributes
   *
   * @return The  attributes
   */
  Map spot_getAttributes();

  /**
   * Retrieves a modifiable list of attributes
   *
   * @return the attributes or null of there are no attributes
   */
  Map spot_getAttributesEx();

  /**
   * Return a new map of attribute that start with <code>"data-"</code>.
   * <p>The keys in the resulting map have the <code>"data-"</code> portion of the key stripped
   * out.</p>
   *
   * @return a map of the data attributes or null
   */
  Map<String, String> spot_getDataAttributes();

  /**
   * Retrieves the short name of this SPOT class
   *
   * @return the short name of this class
   */
  String spot_getClassName();

  /**
   * Retrieves the short name of this SPOT class
   *
   * @return the short name of this class
   */
  String spot_getClassShortName();

  /**
   * Gets the footer comment for an element
   *
   * @return the comment
   */
  String spot_getFooterComment();

  /**
   * Gets the header comments for an element
   *
   * @return comments the comments
   */
  String[] spot_getHeaderComments();

  /**
   * Retrieves data that was linked to the element
   *
   * @return The name of the element
   */
  Object spot_getLinkedData();

  /**
   * Retrieves the name of the element.
   *
   * @return The name of the element (always returns a value)
   */
  String spot_getName();

  /**
   * Gets the parent element to this element
   *
   * @return the parent element to this element
   */
  iSPOTElement spot_getParent();

  /**
   * Get the objects the specify the range of allowed values
   *
   * @return the objects the specify the range of allowed values or null if there is no range
   */
  Object[] spot_getRange();

  /**
   * Retrieves an unmodifiable list of the supported attributes
   *
   * @return The supported attributes
   */
  Map spot_getSupportedAttributes();

  /**
   * Gets the template handler for the element
   *
   * @return the template handler for the element
   */
  iSPOTTemplateHandler spot_getTemplateHandler();

  /**
   * Gets the type of element
   *
   * @return the type of element
   */
  int spot_getType();

  /**
   * Retrieves the range of valid values for the object.
   *
   * @return The valid range as a displayable string
   */
  String spot_getValidityRange();

  /**
   * Gets the value of the object
   *
   * @return the value of the object
   */
  Object spot_getValue();

  /**
   * Returns whether this element has attributes
   *
   * @return whether this element has attributes
   */
  boolean spot_hasAttributes();

  /**
   * Returns whether this element has explicitly defined attributes
   *
   * @return whether this element has explicitly defined attributes
   */
  boolean spot_hasDefinedAttributes();

  /**
   * Returns whether this element has a value
   *
   * @return whether this element has a value
   */
  boolean spot_hasValue();

  /**
   * Returns whether the specified attribute is supported for the element
   *
   * @param name The name of the attribute
   * @return true if the attribute is supported; false otherwise
   */
  boolean spot_isAttributeSupported(String name);

  /**
   * Returns whether the element is a container
   *
   * @return <code>true</code> if the element is a container
   * <code>false</code>
   */
  boolean spot_isContainer();

  /**
   * Returns whether the element that the object represents is optional
   *
   * @return <code>true</code> if the element is optional otherwise
   * <code>false</code>
   */
  boolean spot_isOptional();

  /**
   * Returns whether the element that the object represents is read-only
   *
   * @return <code>true</code> if the element is read-only otherwise
   * <code>false</code>
   */
  boolean spot_isReadOnly();

  /**
   * Returns whether the specified attribute is required
   *
   * @param name the name of the attribute
   * @return <code>true</code> if an attribute is required; otherwise <code>false</code>
   */
  boolean spot_isRequiredAttribute(String name);

  /**
   * Makes the element read-only
   */
  void spot_makeReadOnly();

  /**
   * Removes the named attribute from the attribute list
   *
   * @param name The name of the attribute
   */
  void spot_removeAttribute(String name);

  /**
   * Resets the value of an attribute to is default value
   * or null if a default value is not defined
   *
   * @param name  The name of the attribute
   * @param clean true will case the attribute map to be cleaned such that spot_attributesWereSet()
   *              will return fale of not other attributes have been modified
   */
  void spot_resetAttribute(String name, boolean clean);

  /**
   * Resets all attributes to their default value
   */
  void spot_resetAttributes();

  /**
   * Sets the value of an attribute
   *
   * @param name  The name of the attribute
   * @param value The value of the attribute
   */
  void spot_setAttribute(String name, String value);

  /**
   * Sets the footer comment for an element
   *
   * @param comment the comment
   */
  void spot_setFooterComment(String comment);

  /**
   * Sets the header comments for an element
   *
   * @param comments the comments
   */
  void spot_setHeaderComments(String[] comments);

  /**
   * Associates arbitrary data with the element
   *
   * @param data {@inheritDoc}
   * @return the previously associated data
   */
  Object spot_setLinkedData(Object data);

  /**
   * Sets the name of the element
   *
   * @param name the name
   */
  void spot_setName(String name);

  /**
   * Sets the optional value
   *
   * @param optional <code>true</code> if the element is optional; <code>false</code> otherwise
   */
  void spot_setOptional(boolean optional);

  /**
   * Sets the parent element to this element
   *
   * @param element the parent element
   */
  void spot_setParent(iSPOTElement element);

  /**
   * Sets the value
   *
   * @param val the value
   */
  void spot_setValue(String val);

  /**
   * Returns the value of the element as a string
   *
   * @return the value
   */
  String spot_stringValue();

  /**
   * Returns a string value only if a value has actually be set.
   * That is, default values are ignored;
   *
   * @return the value
   */
  String spot_stringValueEx();

  /**
   * Returns whether the element value was explicitly set
   *
   * @return <code>true</code> if the element's value was explicitly set; otherwise <code>false</code>
   */
  boolean spot_valueWasSet();

  /**
   * Returns a value  representing the element that can be added
   * to a {@link iJSONObject} with default values, type info, and attributes added
   *
   * @return a JSON object
   */
  default Object toJSONValue() {
    return toJSONValue(true, true, true, false);
  }

  /**
   * Returns a value  representing the element that can be added
   * to a {@link iJSONObject}
   *
   *
   * @param addDefaultValues
   * @param addAttributes true to include attribute values
   * @param addTypeInfo   true to include type information to the JSON object
   * @param addLinkedData true to include linked data values
   * @return a JSON object
   */
  Object toJSONValue(boolean addDefaultValues, boolean addAttributes, boolean addTypeInfo, boolean addLinkedData);


  /**
   * Converts the object to it SDF representation
   */
  String toSDF();

  /**
   * Converts the object to it SDF representation
   *
   * @param out the Writer to use to write out the XML
   * @return <code>true</code> is the operation was successful
   * @throws IOException if an I/O error occurs
   */
  boolean toSDF(Writer out) throws IOException;

  /**
   * Converts the object to its SDF representation. Data validation is
   * performed
   *
   * @param out            the Writer to use to write out the SDF
   * @param tag            the SDF tag to use for this object
   * @param depth          the element's depth (i.e. indentation level)
   * @param outputempty    <code>true</code> to output empty tags; <code>false</code> otherwise
   * @param outputComments <code>true</code> to output comments; <code>false</code> otherwise
   * @return <code>true</code> is the operation was successful
   * @throws IOException if an I/O error occurs
   */
  boolean toSDF(Writer out, String tag, int depth, boolean outputempty, boolean outputComments) throws IOException;

  /**
   * {@inheritDoc}
   *
   * @param out {@inheritDoc}
   * @throws IOException {@inheritDoc}
   */
  void toStream(OutputStream out) throws IOException;

  /**
   * Retrieves the name of the element if one was set
   *
   * @return The name of the element
   */
  String spot_getNameEx();
}
