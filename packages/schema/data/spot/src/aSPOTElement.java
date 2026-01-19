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

import com.appnativa.util.CharArray;
import com.appnativa.util.CharScanner;
import com.appnativa.util.Env;
import com.appnativa.util.Helper;
import com.appnativa.util.SNumber;
import com.appnativa.util.aStreamer;
import com.appnativa.util.iStructuredNode;
import com.appnativa.util.io.StringWriterEx;
import com.appnativa.util.json.iJSONObject;
import com.google.j2objc.annotations.Weak;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.Writer;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collections;
import com.appnativa.util.DateEx;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;

/**
 * The base class for most of the other objects.
 *
 * @author Don DeCoteau
 * @version 2.0
 */
@SuppressWarnings("unused")
public abstract class aSPOTElement implements iSPOTElement, iSPOTConstants, Cloneable {
  public static          String               DATA_ATTRIBUTE_PREFIX = "data_";
  /**
   * TLS SNumber object
   */
  protected final static ThreadLocal<SNumber> perThreadNumber       = new ThreadLocal() {
    protected synchronized SNumber initialValue() {
      return new SNumber(0);
    }
  };

  protected static final boolean OPTIMIZE_RUNTIME;

  static {
    boolean opt = true;

    try {
      String s = System.getProperty("spot.optimize", null);

      if (s == null) {
        s = System.getProperty("jnlp.spot.optimize", null);
      }

      if (s != null) {
        opt = "true".equals(s);
      }
    } catch (Throwable ignore) {
    }

    OPTIMIZE_RUNTIME = opt;
  }

  protected int     attributeSizeHint = 0;
  protected boolean _attributeSet;

  /**
   * element attributes
   */
  protected NoNullLinkedHashMap _attributes;

  /**
   * <code>true</code> if the element can be made read-only (<code>true</code> by default)
   */
  protected boolean _canMakeReadOnly;

  /**
   * defined element attributes
   */
  protected LinkedHashMap _defAttributes;
  protected String        _footerComment;
  protected String[]      _headerComment;

  /**
   * <code>true</code> if the element is optional (<code>false</code> by default)
   */
  protected boolean _isOptional;

  /**
   * <code>true</code> if the element is read-only (<code>false</code> by default)
   */
  protected boolean _isReadOnly;

  /**
   * parent element
   */
  @Weak
  protected iSPOTElement _parentElement;
  protected String       _preformattedTag;

  /**
   * protected element attributes
   */
  protected Set _requiredAttributes;

  /**
   * the name of the element
   */
  protected String _theName;

  /**
   *
   */
  protected boolean          _valuePreformatted;
  private   boolean          _allowInvalidAttributes;
  protected Object           _linkedData;
  protected SNumber          _numValue;
  protected boolean          _bWriteUnquoted;
  protected iSPOTValueWriter _valueWriter;

  /**
   * Returns the value of the element as a boolean
   *
   * @return the value
   */
  public boolean booleanValue() {
    String s = spot_stringValue();

    if (s == null) {
      throw new NumberFormatException(STR_NULL_VALUE);
    }

    return s.equalsIgnoreCase("true") || !s.equalsIgnoreCase("false") && (SNumber.longValue(s, true) != 0);

  }

  /**
   * Returns the value of the element as an array of bytes
   *
   * @return the value
   */
  public byte[] byteArrayValue() {
    String s = spot_stringValue();

    return (s == null)
        ? null
        : s.getBytes();
  }

  public Object clone() {
    try {
      aSPOTElement e = (aSPOTElement) super.clone();
      e._parentElement = null;
      e._isReadOnly = false;

      if (_attributes != null) {
        e._attributes = new NoNullLinkedHashMap(_attributes);
      }

      if (_defAttributes != null) {
        e._defAttributes = new LinkedHashMap(_defAttributes);
      }

      if (_requiredAttributes != null) {
        e._requiredAttributes = new HashSet(_requiredAttributes);
      }

      if (_numValue != null) {
        _numValue = new SNumber(_numValue);
      }
      return e;
    } catch (CloneNotSupportedException ex) {
      // this shouldn't happen, since we are Cloneable
      throw new InternalError();
    }
  }

  /**
   * Returns the value of the element as a <code>double</code>
   *
   * @return the value
   */
  public double doubleValue() {
    String s = spot_stringValue();

    if (s == null) {
      throw new NumberFormatException(STR_NULL_VALUE);
    }

    return SNumber.doubleValue(s, true);
  }

  /**
   * Test whether this element is equal to the specified element
   *
   * @param e the element
   * @return whether this element is equal to the specified element
   */
  @SuppressWarnings("StringEquality")
  public boolean equals(aSPOTElement e) {
    if (e == this) {
      return true;
    }

    if (e == null) {
      return false;
    }

    if (e.spot_getType() != spot_getType()) {
      return false;
    }

    String s1 = spot_stringValue();
    String s2 = e.spot_stringValue();

    if ((s2 == null) || (s1 == null)) {
      if (s1 != s2) {
        return false;
      }
    } else if (!s1.equals(s2)) {
      return false;
    }

    return spot_attributesEqual(this, e);
  }

  public boolean equals(Object o) {
    return this == o || o instanceof aSPOTElement && equals((aSPOTElement) o);

  }

  /**
   * Returns the value of the element as a <code>double</code>
   *
   * @return the value
   */
  public float floatValue() {
    String s = spot_stringValue();

    if (s == null) {
      throw new NumberFormatException(STR_NULL_VALUE);
    }

    return SNumber.floatValue(s, true);
  }

  public boolean fromSDF(SDFNode node) throws SPOTException {
    if (node == null) {
      return false;
    }

    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (node.hasAttributes()) {
      if (_attributes == null) {
        createAttributesMap();
      }

      _attributes.putAll(node.getNodeAttributes());
      this._attributeSet = true;
    }

    String value = node.nodeValue;

    this._valuePreformatted = node.valuePreformatted;
    this._preformattedTag = node.preformattedTag;

    if ((value == null) && (node.getChildCount() == 1)) {
      SDFNode nnode = node.getFirstDataNode();
      if (nnode != null) {
        node = nnode;
        value = node.nodeValue;

        if (_attributes == null) {
          createAttributesMap();
        }

        if (node.hasAttributes()) {
          _attributes.putAll(node.getNodeAttributes());
        }

        if (node.valuePreformatted) {
          this._valuePreformatted = true;
        }
      }
    }

    _footerComment = node.nodeComment;
    setValue(value);
    spot_setLinkedData(node.getLinkedData());

    return true;
  }

  /**
   * Populates the object's value from an input stream
   *
   * @param in the input stream
   * @throws IOException if an I/O error occurs
   */
  public void fromStream(InputStream in) throws IOException {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    setValue(aStreamer.readString(in));
  }

  public boolean fromStructuredNode(iStructuredNode node) throws SPOTException {
    if (node == null) {
      return false;
    }

    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (node.hasAttributes()) {
      if (_attributes == null) {
        createAttributesMap();
      }

      node.copyAttributes(_attributes);
      this._attributeSet = true;
    }

    String value = node.getValueAsString();

    this._valuePreformatted = node.isPreformattedData();
    this._preformattedTag = node.getPreformattedTag();

    if ((value == null) && (node.getChildCount() == 1)) {
      node = node.getChild(0);
      value = node.getValueAsString();

      if (_attributes == null) {
        createAttributesMap();
      }

      if (node.hasAttributes()) {
        node.copyAttributes(_attributes);
      }

      this._valuePreformatted = node.isPreformattedData();
      this._preformattedTag = node.getPreformattedTag();
    }

    _footerComment = node.getComment();
    setValue(value);
    spot_setLinkedData(node.getLinkedData());

    return true;
  }

  @Override
  @SuppressWarnings("RedundantCast")
  public int hashCode() {
    String s = spot_stringValue();
    int h = (s == null)
        ? 0
        : (int) s.hashCode();

    if (_attributes != null) {
      h += (int) _attributes.hashCode();
    }

    return h;
  }

  /**
   * Returns the value of the element as a <code>int</code>
   *
   * @return the value
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
    String s = spot_stringValue();

    if (s == null) {
      throw new NumberFormatException(STR_NULL_VALUE);
    }

    return SNumber.longValue(s, true);
  }

  /**
   * Returns the value of the element as a <code>SNumber</code>
   *
   * @return the value
   */
  public SNumber numberValue() {
    String s = spot_stringValue();

    return (s == null)
        ? null
        : numValueNumber().setValue(s, false);
  }

  public void spot_addAttributes(Map map) {
    //noinspection Duplicates
    if ((map != null) && (map.size() > 0)) {
      if (_attributes == null) {
        createAttributesMap();
      }

      _attributes.putAll(map);
      _attributeSet = true;
    }
  }

  public static boolean spot_attributesEqual(iSPOTElement e1, iSPOTElement e2) {
    if (((e1 == null) && (e2 == null))) {
      return true;
    }

    Map m1 = (e1 == null)
        ? null
        : e1.spot_getAttributesEx();
    Map m2 = (e2 == null)
        ? null
        : e2.spot_getAttributesEx();

    if ((m1 == null) || (m2 == null)) {
      return m1 == m2;
    }

    return m1.equals(m2);
  }

  public final boolean spot_attributesWereSet() {
    return _attributeSet;
  }

  public boolean spot_isWriteUnquoted() {
    return _bWriteUnquoted;
  }

  public void spot_setWriteUnquoted(boolean writeUnquoted) {
    this._bWriteUnquoted = writeUnquoted;
  }

  public int spot_checkRangeValidity() {
    if (!spot_requiredAttributesWereSet(_attributes, _requiredAttributes)) {
      return VALUE_MISSING_REQUIRED_ATTTRIBUTES;
    }

    int ret = spot_checkRangeValidityEx();

    if ((ret == VALUE_NULL_AND_OPTIONAL) || (ret == VALUE_NULL_WITH_DEFAULT)) {
      if (_attributeSet) {
        ret = VALUE_OK;
      }
    }

    return ret;
  }

  static Map<String, String> spot_getDataAttributes(iSPOTElement element) {
    Map<String, String> map = element.spot_getAttributesEx();
    if (map == null || map.isEmpty()) {
      return null;
    }
    HashMap<String, String> data   = null;
    final String            prefix = DATA_ATTRIBUTE_PREFIX;
    for (Map.Entry<String, String> e : map.entrySet()) {
      String s = e.getKey();
      if (s.startsWith(prefix)) {
        if (data == null) {
          data = new HashMap<>(5);
        }
        data.put(s.substring(5), e.getValue());
      }
    }
    return data;
  }

  public Map<String, String> spot_getDataAttributes() {
    return spot_getDataAttributes(this);
  }

  /**
   * Check the validity of the object and any child objects.
   *
   * @return error message or <code>null</code> if the object is valid
   */
  public String spot_checkRangeValidityStr() {
    int    ret = spot_checkRangeValidity();
    String s   = null;

    switch (ret) {
      case VALUE_TO_BIG:    // this means that a value was entered that is greater than the specified range
        s = Helper.expandString(STR_INVALID, spot_getName(), spot_stringValue(), STR_GREATER_THAN,
            spot_getValidityRange());

        break;

      case VALUE_TO_SMALL:    // this means that a value was entered that is less than the specified range
        s = Helper.expandString(STR_INVALID, spot_getName(), spot_stringValue(), STR_LESS_THAN,
            spot_getValidityRange());

        break;

      case VALUE_NULL:    // this means that the value is null
        s = Helper.expandString(STR_NULL, spot_getName());

        break;

      case VALUE_MISSING_REQUIRED_ATTTRIBUTES:
        s = Helper.expandString(STR_MISSING_ATTRIBUTES, spot_getName(),
            aSPOTElement.spot_getMissingReqiredAttributes(_attributes, _requiredAttributes));

        break;

      case VALUE_NULL_AND_OPTIONAL:    // this means that the value is null and optional
      case VALUE_NULL_WITH_DEFAULT:    // this means that the value is null with a default
      default:                         // this means that the value is good
        break;
    }

    return s;
  }

  public void spot_cleanAttributes() {
    if (_attributes != null) {
      if (Helper.valuesEquals(_attributes, _defAttributes)) {
        _attributeSet = false;
      }
    }
  }

  /**
   * Clears the contents the element
   */
  public void spot_clear() {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    this._valuePreformatted = false;
    this._preformattedTag = null;
    _numValue = null;

    if (_attributes != null) {
      _attributes.clear();
    }

    if (_defAttributes != null) {
      if (_attributes == null) {
        createAttributesMap();
      } else {
        _attributes.putAll(_defAttributes);
      }
    }

    _attributeSet = false;
  }

  public void spot_clearAttributes() {
    if (_attributes != null) {
      _attributes.clear();
    }

    _attributes = null;
    _attributeSet = false;
  }

  public void spot_copy(iSPOTElement element) {
    if (element == null) {
      return;
    }

    spot_copy(element, false);
  }

  public void spot_copy(iSPOTElement element, boolean newinstance) {
    if (element == null) {
      return;
    }

    if (!newinstance) {
      if (!OPTIMIZE_RUNTIME) {
        checkReadOnly();
      }

      spot_clear();
    }

    spot_copyEx(element);

    if (element.spot_valueWasSet()) {
      setValue(element.spot_stringValue());
    }
  }

  public void spot_defineAttribute(String name, String defaultValue) {
    //noinspection Duplicates
    if (!OPTIMIZE_RUNTIME || (defaultValue != null)) {
      if (_defAttributes == null) {
        _defAttributes = new LinkedHashMap((attributeSizeHint > 5)
            ? attributeSizeHint
            : 10);
      }

      name = spot_handleRequiredAttribute(name);
      _defAttributes.put(name, defaultValue);
    }

    if (defaultValue != null) {
      if (_attributes == null) {
        _attributes = new NoNullLinkedHashMap();
      }

      _attributes.put(name, defaultValue);
    }
  }

  public void spot_defineAttributes(Map attributes) {

    for (Entry e : (Iterable<Entry>) attributes.entrySet()) {
      Object key   = e.getKey();
      Object value = e.getValue();

      if (!OPTIMIZE_RUNTIME && (_defAttributes == null)) {
        _defAttributes = new LinkedHashMap((attributeSizeHint > 5)
            ? attributeSizeHint
            : 10);
      }

      if (_defAttributes != null) {
        _defAttributes.put(key, value);
      }

      if (_attributes == null) {
        _attributes = new NoNullLinkedHashMap();
      }

      if (value != null) {
        _attributes.put(key, value);
      }
    }
  }

  public static iSPOTElement spot_elementForObject(Object val, boolean parseForAttributes) {
    iSPOTElement el = null;

    if (val instanceof Number) {
      if ((val instanceof Double) || (val instanceof Float)) {
        el = new SPOTReal(((Number) val).doubleValue(), true);
      } else {
        el = new SPOTInteger(((Number) val).longValue(), true);
      }
    } else if ((val instanceof DateEx) || (val instanceof Calendar)) {
      DateEx cal;

      if (val instanceof Calendar) {
        cal = new DateEx((Calendar) val);
      } else {
        cal = (DateEx) val;
      }

      el = new SPOTDateTime(cal, true);
    } else if (val instanceof Boolean) {
      el = new SPOTBoolean((Boolean) val, true);
    } else if (val instanceof Map) {
      el = spot_sequenceForMap((Map) val, parseForAttributes);
    } else if (val instanceof List) {
      el = spot_setForList((List) val, parseForAttributes);
    } else if (val instanceof Object[]) {
      el = spot_setForList(Arrays.asList((Object[]) val), parseForAttributes);
    }

    if (el == null) {
      el = new SPOTPrintableString(true);

      if (val != null) {
        String s = val.toString();

        if (parseForAttributes) {
          spot_populatePrimitaveElementFromString(el, s);
        }

        el.spot_setValue(s);
      }
    }

    return el;
  }

  public iSPOTElement spot_elementValue() {
    return this;
  }

  public boolean spot_equals(iSPOTElement e) {
    return this.equals(e) && attributeValueEquals(this, e);

  }

  public iSPOTValueWriter spot_getValueWriter() {
    return _valueWriter;
  }

  public void spot_setValueWriter(iSPOTValueWriter _valueWriter) {
    this._valueWriter = _valueWriter;
  }

  public String spot_getAttribute(String attribute) {
    if (_attributes == null) {
      return null;
    }

    return (String) _attributes.get(attribute);
  }

  public int spot_getAttributeCount() {
    return (_attributes == null)
        ? 0
        : _attributes.size();
  }

  public String spot_getAttributeDefaultValue(String name) {
    return (String) ((_defAttributes == null)
        ? null
        : _defAttributes.get(name));
  }

  public Map spot_getAttributes() {
    return (_attributes == null)
        ? Collections.EMPTY_MAP
        : Collections.unmodifiableMap(_attributes);
  }

  public Map spot_getAttributesEx() {
    return _attributes;
  }

  public String spot_getClassName() {
    return getClass().getName();
  }

  /**
   * Retrieves the short name of this class
   *
   * @return the short name of this class
   */
  public String spot_getClassShortName() {
    return spot_getClassShortName(getClass());
  }

  /**
   * Retrieves the short name of this class
   *
   * @param cls the class
   * @return the short name of this class
   */
  public static String spot_getClassShortName(Class cls) {
    String s = cls.getName();
    int    i = s.lastIndexOf('.');

    if (i != -1) {
      s = s.substring(i + 1);
    }

    if (s.startsWith("SPOT")) {
      return s.substring(4);
    }

    return s;
  }

  public String spot_getFooterComment() {
    return _footerComment;
  }

  public String[] spot_getHeaderComments() {
    return _headerComment;
  }

  public Object spot_getLinkedData() {
    return _linkedData;
  }

  public String spot_getNameEx() {
    return _theName;
  }

  public String spot_getName() {
    //noinspection Duplicates
    if (_theName == null) {
      _theName = this.getClass().getName();

      int i = _theName.lastIndexOf('.');

      if (i != -1) {
        StringBuilder buf = new StringBuilder(_theName);

        buf.setCharAt(i, ':');
        _theName = buf.toString();
      }
    }

    return _theName;
  }

  /**
   * Retrieves the SPOT name for the specified class.
   *
   * @param cls the class whose SPOT compatable name is to be retrieved
   * @return The name of the element
   */
  public static String spot_getName(Class cls) {
    String s = cls.getName();
    int    i = s.lastIndexOf('.');

    if (i != -1) {
      StringBuilder buf = new StringBuilder(s);

      buf.setCharAt(i, ':');
      s = buf.toString();
    }

    return s;
  }

  public iSPOTElement spot_getParent() {
    return _parentElement;
  }

  public Object[] spot_getRange() {
    return null;
  }

  public static String spot_getRelativeClassName(iSPOTElement obj) {
    return SPOTHelper.getRelativeClassName(obj);
  }

  /**
   * Retrieves the SPOT name for the specified class.
   *
   * @return The name of the element
   */
  public static String spot_getRelativeShortName(Class caller, Class cls) {
    return SPOTHelper.getRelativeShortName(caller, cls);
  }

  public Map spot_getSupportedAttributes() {
    return (_defAttributes == null)
        ? Collections.EMPTY_MAP
        : Collections.unmodifiableMap(_defAttributes);
  }

  public Map spot_getSupportedAttributesEx() {
    return _defAttributes;
  }

  public iSPOTTemplateHandler spot_getTemplateHandler() {
    return (_parentElement == null)
        ? null
        : _parentElement.spot_getTemplateHandler();
  }

  public boolean spot_hasAttributes() {
    return ((_attributes != null) && (_attributes.size() > 0));
  }

  public boolean spot_hasDefinedAttributes() {
    return ((_defAttributes != null) && (_defAttributes.size() > 0));
  }

  public boolean spot_hasValue() {
    int n = spot_checkRangeValidity();

    return (n == VALUE_NULL_WITH_DEFAULT) || (n == VALUE_OK);
  }

  public boolean spot_isAllowInvalidAttributes() {
    return _allowInvalidAttributes;
  }

  public boolean spot_isAttributeSupported(String name) {
    return ((_defAttributes == null) || _defAttributes.containsKey(name));
  }

  public boolean spot_isContainer() {
    return false;
  }

  public boolean spot_isOptional() {
    return _isOptional;
  }

  public boolean spot_isReadOnly() {
    return _isReadOnly;
  }

  public static iSPOTElement spot_createDynamicElement(SDFNode child) {
    String value = child.nodeValue;
    if (child.valuePreformatted) {
      SPOTPrintableString ps = new SPOTPrintableString(child.nodeValue);
      ps.spot_setValuePreformatted(true);
      ps.spot_setPreformattedLineStart(child.preformattedLineStart);
      ps.spot_setPreformattedLineEnd(child.preformattedLineEnd);
      return ps;
    }
    if ("true".equals(value)) {
      return new SPOTBoolean(true, true);
    }
    if ("false".equals(value)) {
      return new SPOTBoolean(false, true);
    }
    if (child.nodeType == SDFNode.NODETYPE_BLOCK) {
      return handleDynamicBlockElementCreation(child);
    }
    aSPOTElement e;
    SNumber      num = perThreadNumber.get();
    if (num.setValueEx(value, true)) {
      e = new SPOTReal(num);
    } else {
      if ("null".equals(value)) {
        value = "";
      }
      e = new SPOTPrintableString(value);
    }
    return e;

  }

  private static iSPOTElement handleDynamicBlockElementCreation(SDFNode node) {
    if (!node.hasChildren()) {
      return new SPOTSet();
    }
    List<SDFNode> children = node.childNodes;
    if (children.get(0).nodeName != null) {
      SPOTSequence seq = new SPOTSequence();
      seq.spot_setAllowsDynamicElements(true);
      seq.fromSDF(node);
      return seq;
    }
    iSPOTElement e   = spot_createDynamicElement(children.get(0));
    SPOTSet      set = new SPOTSet(node.nodeName, e, -1, -1, true);
    set.fromSDF(node);
    return set;
  }

  public static iSPOTElement spot_createElement(int type) {
    switch (type) {
      case SPOT_TYPE_BOOLEAN:
        return new SPOTBoolean();
      case SPOT_TYPE_OCTETSTRING:
        return new SPOTOctetString();
      case SPOT_TYPE_PRINTABLESTRING:
        return new SPOTPrintableString();

      case SPOT_TYPE_REAL:
        return new SPOTReal();
      case SPOT_TYPE_INTEGER:
        return new SPOTInteger();
      case SPOT_TYPE_DATE:
        return new SPOTDate();
      case SPOT_TYPE_DATETIME:
        return new SPOTDateTime();
      case SPOT_TYPE_TIME:
        return new SPOTTime();
      case SPOT_TYPE_BYTESTRING:
        return new SPOTByteString();

      case SPOT_TYPE_ENUMERATED:
        return new SPOTEnumerated();
      case SPOT_TYPE_SET:
        return new SPOTSet();
      case SPOT_TYPE_SEQUENCE:
        return new SPOTSequence(true, true);
      default:
        break;
    }
    return null;
  }

  public boolean spot_isRequiredAttribute(String name) {
    return _requiredAttributes != null && _requiredAttributes.contains(name);
  }

  public boolean spot_isValuePreformatted() {
    return _valuePreformatted;
  }

  /**
   * Makes the element read-only
   */
  public void spot_makeReadOnly() {
    if (_canMakeReadOnly) {
      _isReadOnly = true;
    }
  }

  public static void spot_populatePrimitaveElementFromString(iSPOTElement e, String string) {
    if (string != null) {
      Map<String, String> map = null;
      int                 n   = string.indexOf('[');

      if (n != -1) {
        string = string.trim();

        int p = string.lastIndexOf(']');

        if ((p > n) && (string.indexOf('\"', p) == -1)) {
          String s = string.substring(n + 1, p);

          string = string.substring(0, n);
          map = CharScanner.parseOptionStringEx(s, ',');
        }
      }

      e.spot_setValue(string.trim());
      e.spot_clearAttributes();

      if ((map != null) && (map.size() > 0)) {
        e.spot_addAttributes(map);
      }
    }
  }

  /**
   * Returns whether this element requires a JSON object to be serialized as JSON
   *
   * @param addAttributes true to add attribute values
   * @param addTypeInfo   true to add type information to the JSON object
   * @param addLinkedData true to add linked data values
   * @return true if it does; false if in can be streamed as a simple type
   */

  protected boolean spot_requiresJSONObject(boolean addAttributes,boolean addTypeInfo, boolean addLinkedData) {
    if (!_attributeSet && _linkedData == null) {
      return false;
    }
    if (addLinkedData && _linkedData != null) {
      return true;
    }
    return addAttributes && _attributeSet;
  }

  public void spot_removeAttribute(String name) {
    if (_attributes != null) {
      _attributes.remove(name);
    }
  }

  public void spot_resetAttribute(String name, boolean clean) {
    //noinspection Duplicates
    if (_attributes != null) {
      if (_defAttributes != null) {
        _attributes.put(name, _defAttributes.get(name));

        if (clean && Helper.valuesEquals(_attributes, _defAttributes)) {
          _attributeSet = false;
        }
      }
    }
  }

  public void spot_resetAttributes() {
    if (_attributes != null) {
      _attributes.clear();

      if (_defAttributes != null) {
        _attributes.putAll(_defAttributes);
      }
    }

    _attributeSet = false;
  }

  public static String spot_resolveClassName(iSPOTElement obj, String type) {
    return SPOTHelper.resolveClassName(obj, type);
  }

  public static SPOTSequence spot_sequenceForMap(Map map, boolean parseForAttributes) {
    SPOTSequence seq = new SPOTSequence(true);

    for (Entry<String, Object> e : (Iterable<Entry<String, Object>>) map.entrySet()) {
      String name = e.getKey();
      Object val  = e.getValue();

      seq.spot_addElement(name, spot_elementForObject(val, parseForAttributes));
    }

    return seq;
  }

  public void spot_setAllowInvalidAttributes(boolean allow) {
    this._allowInvalidAttributes = allow;
  }

  public void spot_setAttribute(String name, String value) {
    if (!OPTIMIZE_RUNTIME && !_allowInvalidAttributes && (_defAttributes != null) && !_defAttributes.containsKey(name)) {
      throw new SPOTException(INVALID_ELEMENT, STR_INVALID_ATTRIBUTE, (_theName == null)
          ? getClass().getName()
          : _theName, name);
    }

    if (_attributes == null) {
      createAttributesMap();
    }

    _attributes.put(name, value);
    _attributeSet = true;
  }

  public void spot_setFooterComment(String comment) {
    _footerComment = comment;
  }

  public static SPOTSet spot_setForList(List list, boolean parseForAttributes) {
    SPOTSet set = new SPOTSet(true);
    int     len = list.size();

    if (len > 0) {
      iSPOTElement e = spot_elementForObject(list.get(0), parseForAttributes);

      set.setType(e.spot_getClassShortName(), e.getClass().getName());
      set.add(e);

      for (int i = 1; i < len; i++) {
        set.add(spot_elementForObject(list.get(i), parseForAttributes));
      }
    }

    return set;
  }

  public void spot_setHeaderComments(String[] comments) {
    _headerComment = comments;
  }

  public Object spot_setLinkedData(Object data) {
    Object o = _linkedData;

    _linkedData = data;

    return o;
  }

  /**
   * Sets the name of the element
   *
   * @param name the name
   */
  public void spot_setName(String name) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _theName = name;
  }

  /**
   * Sets the optional value
   *
   * @param optional <code>true</code> if the element the object represents is optional
   */
  public void spot_setOptional(boolean optional) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _isOptional = optional;
  }

  public void spot_setParent(iSPOTElement element) {
    _parentElement = element;
  }

  /**
   * Sets the valid range for the object
   *
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   */
  public void spot_setRange(long min, long max) {
    throw new SPOTException(NOT_SUPPORTED, STR_NOT_SUPPORTED, this.getClass().getName());
  }

  /**
   * Sets the valid range for the object
   *
   * @param min The object's minimum acceptable value
   * @param max The object's maximum acceptable value
   */
  public void spot_setRange(String min, String max) {
    throw new SPOTException(NOT_SUPPORTED, STR_NOT_SUPPORTED, this.getClass().getName());
  }

  public void spot_setValue(String val) {
    setValue(val);
  }

  public void spot_setValuePreformatted(boolean valuePreformatted) {
    spot_setValuePreformatted(valuePreformatted, null);
  }

  public void spot_setValuePreformatted(boolean valuePreformatted, String preformattedTag) {
    this._valuePreformatted = valuePreformatted;
    this._preformattedTag = preformattedTag;
  }

  /**
   * Returns a string value only if a value has actually be set.
   * That is, default values are ignored;
   *
   * @return the value
   */
  public abstract String spot_stringValueEx();

  /**
   * Returns whether the element value was explicitly set
   *
   * @return <code>true</code> if the element's value was explicitly set; otherwise <code>false</code>
   */
  public boolean spot_valueWasSet() {
    int n = this.spot_checkRangeValidity();

    return ((n == VALUE_OK) || (n == VALUE_TO_SMALL) || (n == VALUE_TO_BIG));
  }

  /**
   * Returns the value of the element as a <code>String</code>
   *
   * @return the value
   */
  public String stringValue() {
    return spot_stringValue();
  }

  @Override
  public Object toJSONValue(boolean addDefaultValues, boolean addAttributes, boolean addTypeInfo, boolean addLinkedData) {
    if (spot_requiresJSONObject(addAttributes, addTypeInfo, addLinkedData)) {
      iJSONObject json = Env.createJSONObject(3);
      json.put(JSON_VALUE_PROPERTY, spot_getValue());
      if (_linkedData != null) {
        json.put(JSON_LINKED_DATA_PROPERTY, spot_getValue());
      }
      if (_attributeSet) {
        json.put(JSON_ATTRIBUTES_PROPERTY, Env.createJSONObject((Map) _attributes.clone()));
      }
      return json;
    } else {
      return spot_getValue();
    }
  }


  public String toSDF() {
    StringWriterEx sw = new StringWriterEx();

    try {
      toSDF(sw, null, 0, false, true);
    } catch (IOException ignore) {
    }

    return sw.toString();
  }

  public boolean toSDF(Writer out) throws IOException {
    return toSDF(out, null, 0, false, true);
  }

  public boolean toSDF(Writer out, String tag, int depth, boolean outputempty, boolean outputComments)
      throws IOException {
    return toSDF(out, tag, depth, outputempty, spot_stringValueEx(), outputComments);
  }

  /**
   * Writes the object's value out to an output stream
   *
   * @param out the output stream
   * @throws IOException if an I/O error occurs
   */
  public void toStream(OutputStream out) throws IOException {
    aStreamer.toStream(spot_stringValue(), out);
  }

  public String toString() {
    String s = spot_stringValue();

    return (s == null)
        ? ""
        : s;
  }

  public static void writeSDFName(Writer out, String name, int depth) throws IOException {
    Helper.writePadding(out, depth);
    out.write(name);
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(boolean val) {
    setValue(val
        ? "true"
        : "false");
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(double val) {
    setValue(SNumber.toString(val));
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(long val) {
    setValue(SNumber.toString(val));
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(SNumber val) {
    setValue(val.toString());
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public abstract void setValue(String val);

  /**
   * Tests two sets of attributes to see if they are equal
   * The two elements are assumed to be of the same defined type
   * and to contain the same number of attributes with the same names
   *
   * @param e1 the first element
   * @param e2 the second element
   * @return true if they are equal; false otherwise
   */
  static boolean attributeValueEquals(iSPOTElement e1, iSPOTElement e2) {
    if (!e1.spot_hasAttributes()) {
      return !e2.spot_hasAttributes();
    }

    if (!e2.spot_hasAttributes()) {
      return !e1.spot_hasAttributes();
    }

    Map attributes = e1.spot_getSupportedAttributes();

    if (attributes == null) {
      return false;
    }

    Map map1 = e1.spot_getAttributesEx();
    Map map2 = e2.spot_getAttributesEx();

    if ((map1 == null) || (map2 == null)) {
      return false;
    }

    Iterator it = attributes.keySet().iterator();
    String   key, value, value2;

    while (it.hasNext()) {
      key = (String) it.next();
      value = (String) map1.get(key);
      value2 = (String) map2.get(key);

      if (value == null) {
        if ((value2 != null) && (value2.length() > 0)) {
          return false;
        }
      } else {
        if ((value2 == null) && (value.length() == 0)) {
          continue;
        }

        if (!value.equals(value2)) {
          return false;
        }
      }
    }

    return true;
  }

  static void writeAttributes(Writer out, Map attributes, Map def, int depth) throws IOException {
    if ((attributes == null) || (attributes.size() == 0)) {
      return;
    }

    Iterator  it    = attributes.entrySet().iterator();
    CharArray sb    = new CharArray();
    Map.Entry me;
    String    val;
    String    name;
    boolean   first = true;
    int       count = 0;

    while (it.hasNext()) {
      me = (Map.Entry) it.next();
      name = (String) me.getKey();

      if (name.startsWith("xml") || name.startsWith("xsi:") || name.startsWith("xsd")) {
        continue;
      }

      val = (String) me.getValue();

      if (def != null) {
        String v = (String) def.get(name);

        if ((v != null) && v.equals(val)) {
          continue;
        }

        if ((v == null) && (val == null)) {
          continue;
        }
      }

      count += sb.length();
      sb.setLength(0);

      if (!first) {
        sb.append(", ");

        if (count > 80) {
          out.write(",");
          out.write("\n");
          Helper.writePadding(out, depth + 2);
          sb.setLength(0);
          count = 0;
        }
      } else {
        out.write(" [ ");
        first = false;
      }

      sb.append(name);

      if (val != null) {
        sb.append("=\"");

        int n = val.indexOf('\"');

        if (n != -1) {
          CharScanner.escape(val, true, sb);
        } else {
          sb.append(val);
        }

        sb.append('"');
      }

      out.write(sb.toString());
    }

    if (!first) {
      out.write(" ]");
    }
  }

  /**
   * Checks is the element is read-only and throws an exception if it is
   *
   * @throws SPOTException if the element is read only
   */
  protected void checkReadOnly() throws SPOTException {
    if (_isReadOnly) {
      throw new SPOTException(READ_ONLY, STR_READ_ONLY, (_theName == null)
          ? getClass().getName()
          : _theName);
    }
  }

  /**
   * Returns the <CODE>SNumber</CODE> representation of this element
   *
   * @return the <CODE>SNumber</CODE> representation of this element
   */
  protected SNumber numValueNumber() {
    if (_numValue == null) {
      _numValue = new SNumber(0);
    }

    return _numValue;
  }

  /**
   * Returns the <CODE>SNumber</CODE> representation of this element with its value
   * set to the specified string
   *
   * @param val the value to set the element to
   * @return the <CODE>SNumber</CODE> representation of this element
   */
  protected SNumber numValueNumber(String val) {
    if (_numValue == null) {
      _numValue = new SNumber(0);
    }

    _numValue = _numValue.setValue(val);

    return _numValue;
  }

  /**
   * Check the validity of the object .
   *
   * @return <code>VALUE_TO_BIG</code> means that a value was entered that is greater than
   * the specified range.<br>
   * <code>VALUE_OK</code> means that the value is within the valid range specified<br>
   * <code>VALUE_TO_SMALL</code> means that a value was entered that is less than
   * the specified range<br>
   * <code>VALUE_NULL</code> means that the value is null<br>
   * <code>VALUE_NULL_AND_OPTIONAL</code> means that the value is null but the element is
   * designated as optional<br>
   * <code>VALUE_NULL_WITH_DEFAULT</code> means that the value is null but the element has a
   * default value<br>
   */
  protected abstract int spot_checkRangeValidityEx();

  protected void spot_copyEx(iSPOTElement element) {
    Map a = element.spot_getAttributesEx();

    if (a != null) {
      _attributes = new NoNullLinkedHashMap(a);
    }

    if (element instanceof aSPOTElement) {
      aSPOTElement ae = (aSPOTElement) element;

      this._footerComment = ae._footerComment;
      this._headerComment = ae._headerComment;
      this._preformattedTag = ae._preformattedTag;
      this._valuePreformatted = ae._valuePreformatted;
      this._linkedData = ae._linkedData;
      this._attributeSet = ae._attributeSet;
    } else {
      this._attributeSet = Helper.valuesEquals(_attributes, _defAttributes);
    }
  }

  protected static String getRangeString(int min, int max) {

    if ((min != -1) || (max != -1)) {
      String s;

      s = (min != -1)
          ? (SNumber.toString(min) + "..")
          : "..";

      if (max != -1) {
        s += SNumber.toString(max);
      }

      return s;
    } else {
      return "";
    }
  }

  protected static String getRangeStringEx(Number min, Number max) {

    if ((min != null) || (max != null)) {
      String s;

      s = (min != null)
          ? (min + "..")
          : "..";

      if (max != null) {
        s += max;
      }

      return s;
    } else {
      return "";
    }
  }

  protected static String spot_getMissingReqiredAttributes(Map _attributes, Set _requiredAttributes) {
    if (_requiredAttributes == null) {
      return "";
    }

    Iterator      it = _requiredAttributes.iterator();
    StringBuilder sb = new StringBuilder("{missing required attributes: ");

    while (it.hasNext()) {
      String s = (String) it.next();

      if ((_attributes == null) || (_attributes.get(s) == null)) {
        sb.append(s).append(',');
      }
    }

    sb.setLength(sb.length() - 1);
    sb.append("}");

    return sb.toString();
  }

  protected String spot_handleRequiredAttribute(String name) {
    if ((name != null) && name.endsWith("!")) {
      name = name.substring(0, name.length() - 1);

      if (_requiredAttributes == null) {
        _requiredAttributes = new HashSet();
      }
    }

    return name;
  }

  protected static boolean spot_requiredAttributesWereSet(Map _attributes, Set _requiredAttributes) {
    if (_requiredAttributes == null) {
      return true;
    }

    if (_attributes == null) {
      return false;
    }

    for (Object o : _requiredAttributes) {
      if (_attributes.get(o) == null) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sets whether the element can be made read-only
   *
   * @param canmakero <code>true</code> if the element can be made read-only
   */
  protected void spot_setCanMakeReadOnly(boolean canmakero) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _canMakeReadOnly = canmakero;
  }

  protected boolean toSDF(Writer out, String tag, int depth, boolean outputempty, String value, boolean outputComments)
      throws IOException {
    if ((value == null) && !outputempty) {
      if (spot_attributesWereSet()) {
        value = "";
      } else {
        return false;
      }
    }

    if ((_headerComment != null) && outputComments) {
      int len = _headerComment.length;

      if ((len > 0) && _headerComment[0].startsWith("/**")) {
        out.write("\n");
      }

      for (String a_headerComment : _headerComment) {
        writeSDFName(out, a_headerComment, depth);
        out.write("\n");
      }
    }

    if (_valuePreformatted) {
      if (tag == null) {
        tag = "";
      }

      if (_preformattedTag != null) {
        writeSDFName(out, tag + ":<<" + _preformattedTag + "\n", depth);
      } else {
        writeSDFName(out, tag + ":<< ", depth);
      }
    } else {
      if (tag != null) {
        writeSDFName(out, tag + ": ", depth);
      } else {
        Helper.writePadding(out, depth);
      }
    }

    if (value != null) {
      boolean pre   = _valuePreformatted || _bWriteUnquoted;
      boolean mline = false;
      boolean trim  = false;

      if (!pre) {
        switch (this.spot_getType()) {
          case iSPOTConstants.SPOT_TYPE_BOOLEAN:
          case iSPOTConstants.SPOT_TYPE_INTEGER:
          case iSPOTConstants.SPOT_TYPE_REAL:
          case iSPOTConstants.SPOT_TYPE_ENUMERATED:
            pre = true;

            break;

          default:
            break;
        }
      } else {
        mline = value.indexOf('\n') != -1;
      }

      if (mline && (value.charAt(0) > 13)) {
        out.write('\n');
      }

      iSPOTValueWriter vw = spot_getValueWriter();
      if (vw != null) {
        vw.writeValue(out, this, value, pre, trim ? (depth + 1) : depth, trim);
      } else {
        SDFNode.writeValue(out, value, pre, trim ? (depth + 1) : depth, trim);
      }

//      if ((_preformattedTag == null) && mline && lf) {
//        out.write('\n');
//      }
    }

    if (_valuePreformatted) {
      if (depth > 0) {
        out.write('\n');
        Helper.writePadding(out, depth);
      }

      out.write((_preformattedTag == null)
          ? ">>"
          : _preformattedTag);
    }

    aSPOTElement.writeAttributes(out, this._attributes, this._defAttributes, depth);

    if ((_footerComment != null) && outputComments) {
      out.write(" ");
      out.write(_footerComment);
    }

    out.write("\n");

    return true;
  }

  private void createAttributesMap() {
    if (_defAttributes != null) {
      _attributes = new NoNullLinkedHashMap(_defAttributes.size());
      _attributes.putAll(_defAttributes);
    } else {
      _attributes = new NoNullLinkedHashMap();
    }
  }

  public String spot_getPreformattedTag() {
    return _preformattedTag;
  }
}
