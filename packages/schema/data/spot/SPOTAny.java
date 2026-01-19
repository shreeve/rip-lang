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

import com.appnativa.util.Env;
import com.appnativa.util.Helper;
import com.appnativa.util.SNumber;
import com.appnativa.util.aStreamer;
import com.appnativa.util.iStructuredNode;
import com.appnativa.util.json.iJSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.Writer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Any represents an element of any defined type. The default sub-type for an <code>Any</code>
 * object is a printable string. That is, if the sub-object's type is undefined/unspecified then
 * a new printable string object will be instantiated to represent the sub-object.
 * <p>
 * For example if the sub-object has not been defined/instantiated ,a call to <code>setValue()</code> will cause
 * a printable string object to be instantiated and its value set to that specified in the <code>setValue()</code>
 * call
 *
 * @author Don DeCoteau
 * @version 2.0
 */
@SuppressWarnings("unused")
public class SPOTAny extends aSPOTElement {

  /**
   * DEFINED BY java class value
   */
  protected Class _clsDefinedBy = null;

  /**
   * the actual object value
   */
  protected iSPOTElement _objectValue = null;

  /**
   * DEFINED BY string value
   */
  protected String _strDefinedBy = null;

  /**
   * Creates a new <code>Any</code> object of any type with the specification
   * that the element represented by the object is mandatory.
   */
  public SPOTAny() {
    this(true);
  }

  /**
   * Creates a new <code>Any</code> object.
   *
   * @param optional <code>true</code> if the element the object represents is optional
   */
  public SPOTAny(boolean optional) {
    _isOptional = optional;
  }

  /**
   * Creates a new <code>Any</code> object.
   *
   * @param val the value
   */
  public SPOTAny(iSPOTElement val) {
    this(val, true);
  }

  /**
   * Creates a new <code>Any</code> object
   *
   * @param definedby The constraint placed on the ANY object (specified as a
   *                  string)
   */
  public SPOTAny(String definedby) {
    this(definedby, false);
  }

  /**
   * Creates a new <code>Any</code> object.
   *
   * @param val      the value
   * @param optional {@inheritDoc}
   */
  public SPOTAny(iSPOTElement val, boolean optional) {
    _isOptional = optional;
    setValue(val);
  }

  /**
   * Creates a new <code>Any</code> object
   *
   * @param definedby The constraint placed on the ANY object (specified as a
   *                  string)
   * @param optional  <code>true</code> if the element the object represents is optional
   */
  public SPOTAny(String definedby, boolean optional) {
    _isOptional = optional;
    _strDefinedBy = SPOTHelper.createDefinedByString(this, definedby);
  }

  /**
   * Creates a new <code>Any</code> object of any type with the specification
   * that the element represented by the object is mandatory.
   */
  SPOTAny(SPOTAny prototype) {
    _isOptional = prototype._isOptional;
    _clsDefinedBy = prototype._clsDefinedBy;
    _strDefinedBy = prototype._strDefinedBy;
  }

  /**
   * Returns the value of the element as a boolean
   *
   * @return the value
   */
  public boolean booleanValue() {
    if (_objectValue instanceof aSPOTElement) {
      return ((aSPOTElement) _objectValue).booleanValue();
    } else {
      return SNumber.booleanValue(_objectValue.spot_stringValue());
    }
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
    SPOTAny a = (SPOTAny) super.clone();

    if (_objectValue != null) {
      a._objectValue = (iSPOTElement) _objectValue.clone();
    }

    return a;
  }

  /**
   * Returns the value of the element as a <code>double</code>
   *
   * @return the value
   */
  public double doubleValue() {
    if (_objectValue instanceof aSPOTElement) {
      return ((aSPOTElement) _objectValue).doubleValue();
    } else {
      return SNumber.doubleValue(_objectValue.spot_stringValue());
    }
  }

  public boolean equals(aSPOTElement e) {
    if (e == this) {
      return true;
    }

    if (!(e instanceof SPOTAny)) {
      return false;
    }

    SPOTAny o = (SPOTAny) e;

    if ((_objectValue == null) || (o._objectValue == null)) {
      if (_objectValue != o._objectValue) {
        return false;
      }
    }

    if ((_strDefinedBy != null) || (o._strDefinedBy != null)) {
      if ((_strDefinedBy == null) || (o._strDefinedBy == null)) {
        //noinspection StringEquality
        if (_strDefinedBy != o._strDefinedBy) {
          return false;
        }
      }

      if (!_strDefinedBy.equals(o._strDefinedBy)) {
        return false;
      }
    }

    if ((_objectValue == null) || (o._objectValue == null)) {
      if (_objectValue != o._objectValue) {
        return false;
      }
    } else if (!_objectValue.equals(o._objectValue)) {
      return false;
    }

    return spot_attributesEqual(this, e);
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
        _attributes = new NoNullLinkedHashMap();

        if (_defAttributes != null) {
          _attributes.putAll(_defAttributes);
        }
      }

      _attributes.putAll(node.getNodeAttributes());
      _attributeSet = true;
    }

    List<SDFNode> nodes = node.getChildNodes();

    if ((nodes == null) || (nodes.size() == 0)) {
      return _isOptional;
    }

    ArrayList<String> list    = null;
    SDFNode           anyNode = null;
    for (SDFNode child : nodes) {

      if (child.getNodeType() == SDFNode.NODETYPE_COMMENT) {
        if (list == null) {
          list = new ArrayList<String>();
        }

        list.add(child.getNodeName());

        continue;
      }
      anyNode = child;
      break;
    }
    if (anyNode == null) {
      return _isOptional;
    }

    spot_setLinkedData(anyNode.getLinkedData());

    String type = anyNode.getNodeName();

    if (type == null) {
      type = anyNode.getNodeValue();
    }

    if (type == null) {
      type = "String";
    }

    type = aSPOTElement.spot_resolveClassName(this, type);

    try {
      _objectValue = (iSPOTElement) SPOTHelper.loadClass(type).newInstance();
      _objectValue.spot_setParent(this);

      if ((list != null) && (list.size() > 0)) {
        _objectValue.spot_setHeaderComments(list.toArray(new String[list.size()]));
      }

      return _objectValue.fromSDF(anyNode);
    } catch (java.lang.Exception e) {
      if (e instanceof SPOTException) {
        throw (SPOTException) e;
      }

      throw new SPOTException(NO_CREATE, String.format(iSPOTConstants.STR_NO_CREATE, type), e);
    }
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

    String name = aStreamer.readString(in);

    if (name != null) {
      try {
        name = name.replace(':', '.');
        _objectValue = (iSPOTElement) SPOTHelper.loadClass(name).newInstance();
        _objectValue.fromStream(in);
      } catch (java.lang.Exception e) {
        if (e instanceof SPOTException) {
          throw (SPOTException) e;
        }

        throw new SPOTException(e);
      }
    }
  }

  public boolean fromStructuredNode(iStructuredNode node) throws SPOTException {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    String type = null;

    if (node.hasAttributes()) {
      if (_attributes == null) {
        _attributes = new NoNullLinkedHashMap();

        if (_defAttributes != null) {
          _attributes.putAll(_defAttributes);
        }
      }

      int olen = _attributes.size();

      node.copyAttributes(_attributes);
      type = node.getChildrenType();
      _attributeSet = _attributes.size() > olen;
    }

    _theName = node.getName();

    if (type == null) {
      type = node.getValueAsString();

      if (type != null) {
        _objectValue = new SPOTPrintableString(type);
      }

      return true;
    }

    node = node.getFirstSignificantChild();

    if (node == null) {
      return _isOptional;
    }

    try {
      type = aSPOTElement.spot_resolveClassName(this, type);
      _objectValue = (iSPOTElement) SPOTHelper.loadClass(type).newInstance();
      _objectValue.spot_setParent(this);

      return _objectValue.fromStructuredNode(node);
    } catch (java.lang.Exception e) {
      if (e instanceof SPOTException) {
        throw (SPOTException) e;
      }

      throw new SPOTException(e);
    }
  }

  public int hashCode() {
    return (_objectValue != null)
        ? _objectValue.hashCode()
        : super.hashCode();
  }

  /**
   * Returns the value of the element as a <code>int</code>
   *
   * @return the value
   */
  public int intValue() {
    if (_objectValue instanceof aSPOTElement) {
      return ((aSPOTElement) _objectValue).intValue();
    } else {
      return SNumber.intValue(_objectValue.spot_stringValue());
    }
  }

  /**
   * Returns the value of the element as a <code>long</code>
   *
   * @return the value
   */
  public long longValue() {
    if (_objectValue instanceof aSPOTElement) {
      return ((aSPOTElement) _objectValue).longValue();
    } else {
      return SNumber.longValue(_objectValue.spot_stringValue());
    }
  }

  /**
   * Returns the value of the element as a <code>SNumber</code>
   *
   * @return the value
   */
  public SNumber numberValue() {
    if (_objectValue instanceof aSPOTElement) {
      return ((aSPOTElement) _objectValue).numberValue();
    } else {
      return new SNumber(_objectValue.spot_stringValue());
    }
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
      case VALUE_NULL_AND_OPTIONAL:
        break;

      case VALUE_NULL:    // this means that the value is null
        s = Helper.expandString(STR_NULL, spot_getName());

        break;

      default:
        s = _objectValue.spot_checkRangeValidityStr();

        break;
    }

    return s;
  }

  /**
   * Clears the contents the element
   */
  public void spot_clear() {
    super.spot_clear();
    _objectValue = null;
  }

  /**
   * Copies the value of the specified element to this element
   *
   * @param element the element
   */
  public void spot_copy(iSPOTElement element, boolean newinstance) {
    if (element instanceof SPOTAny) {
      if (!newinstance) {
        if (!OPTIMIZE_RUNTIME) {
          checkReadOnly();
        }

        spot_clear();
      }

      spot_copyEx(element);
      _objectValue = ((SPOTAny) element)._objectValue;
      if (newinstance && _objectValue != null) {
        _objectValue = (iSPOTElement) _objectValue.clone();
      }
    } else {
      throw new SPOTException(ILLEGAL_VALUE, STR_ILLEGAL_VALUE);
    }
  }

  public iSPOTElement spot_elementValue() {
    return _objectValue;
  }

  /**
   * Retrieves the defined by value
   *
   * @return The defined by value
   */
  public String spot_getDefinedByType() {
    return _strDefinedBy;
  }

  /**
   * Returns a new instance of the sets array type
   *
   * @return a new instance of the sets array type
   * @throws ClassNotFoundException
   * @throws IllegalAccessException
   * @throws InstantiationException
   */
  public iSPOTElement spot_getDefinedByInstance() throws Exception {
    iSPOTElement e;

    if (_clsDefinedBy != null) {
      e = (iSPOTElement) _clsDefinedBy.newInstance();
    } else {
      e = (iSPOTElement) SPOTHelper.loadClass(_strDefinedBy).newInstance();
    }

    return e;
  }

  /**
   * Returns the class that values are restricted to
   *
   * @return the class that values are restricted to
   */
  public Class spot_getDefinedByClass() {
    _clsDefinedBy = (_clsDefinedBy == null)
        ? SPOTHelper.createDefinedByClass(this, _strDefinedBy)
        : _clsDefinedBy;
    return _clsDefinedBy;
  }

  /**
   * {@inheritDoc}
   *
   * @return {@inheritDoc}
   */
  public final int spot_getType() {
    return SPOT_TYPE_ANY;
  }

  /**
   * Retrieves the range of valid values for the object.
   *
   * @return The valid range as a displayable string
   */
  public String spot_getValidityRange() {
    if (_objectValue != null) {
      return _objectValue.spot_getValidityRange();
    }

    return "";
  }

  public Object spot_getValue() {
    return (_objectValue == null)
        ? null
        : _objectValue.spot_getValue();
  }

  public boolean spot_isContainer() {
    return true;
  }

  /**
   * Makes the element read-only
   */
  public void spot_makeReadOnly() {
    if (_canMakeReadOnly && !_isReadOnly) {
      _isReadOnly = true;

      if (_objectValue != null) {
        _objectValue.spot_makeReadOnly();
      }
    }
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

  /**
   * Returns the value of the element as a string
   *
   * @return the value
   */
  public String spot_stringValue() {
    return (_objectValue == null)
        ? null
        : _objectValue.spot_stringValue();
  }

  public String spot_stringValueEx() {
    return (_objectValue == null)
        ? null
        : _objectValue.spot_stringValueEx();
  }

  @Override
  public Object toJSONValue(boolean addDefaultValues, boolean addAttributes, boolean addTypeInfo, boolean addLinkedData) {
    iSPOTElement e = spot_elementValue();
    if (e == null && !spot_requiresJSONObject(addAttributes,false,addLinkedData)) {
      return null;
    }
    iJSONObject json = Env.createJSONObject(4);
    if(e!=null) {
      json.put(JSON_CLASS_PROPERTY, e.spot_getClassShortName());
      json.put(JSON_VALUE_PROPERTY, e.toJSONValue(addDefaultValues, addAttributes, addTypeInfo, addLinkedData));
    }
    if (_linkedData != null) {
      json.put(JSON_LINKED_DATA_PROPERTY, spot_getValue());
    }
    if (_attributeSet) {
      json.put(JSON_ATTRIBUTES_PROPERTY, Env.createJSONObject((Map) _attributes.clone()));
    }
    return json;
  }

  public boolean toSDF(Writer out, String tag, int depth, boolean outputempty, boolean outputComments)
      throws IOException {
    if (_headerComment != null) {
      for (String s : _headerComment) {
        writeSDFName(out, s, depth);
        out.write("\n");
      }
    }

    iSPOTElement obj = _objectValue;

    while ((obj != null) && (obj instanceof SPOTAny)) {
      obj = ((SPOTAny) obj)._objectValue;
    }

    if ((obj != null) || _attributeSet) {
      if (tag == null) {
        tag = "{\n";
      } else {
        tag += " {\n";
      }

      Helper.writePadding(out, depth);
      out.write(tag);

      String type = aSPOTElement.spot_getRelativeClassName(obj);

      if ((obj != null) && !obj.toSDF(out, type, depth + 1, outputempty, outputComments)
          && (obj instanceof SPOTSequence) && (_attributes == null)) {
        Helper.writePadding(out, depth + 1);
        out.write(type);
        out.write("{}\n");
      }

      Helper.writePadding(out, depth);
      out.write("}");

      if (_attributes != null) {
        aSPOTElement.writeAttributes(out, _attributes, _defAttributes, depth);
      }

      if (_footerComment != null) {
        out.write(" ");
        out.write(_footerComment);
      }

      out.write("\n");

      return true;
    } else if (outputempty && (tag != null)) {
      if (_footerComment != null) {
        tag += " {}" + _footerComment + "\n";
      } else {
        tag += " {}\n";
      }

      Helper.writePadding(out, depth);
      out.write(tag);

      return true;
    }

    return false;
  }

  /**
   * Writes the object's value out to an output stream
   *
   * @param out the output stream
   * @throws IOException if an I/O error occurs
   */
  public void toStream(OutputStream out) throws IOException {
    if (_objectValue != null) {
      String name = _objectValue.getClass().getName();

      aStreamer.toStream(name, out);
      _objectValue.toStream(out);
    } else {
      aStreamer.toStream((String) null, out);
    }
  }

  /**
   * Converts the object to a <code>String</code> object
   *
   * @return The object
   */
  public String toString() {
    if (_objectValue == null) {
      return null;
    }

    return _objectValue.toString();
  }

  /**
   * Sets the value
   *
   * @param val the value
   */
  public void setValue(boolean val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (_objectValue == null) {
      _objectValue = new SPOTPrintableString();
    }

    if (_objectValue instanceof aSPOTElement) {
      ((aSPOTElement) _objectValue).setValue(val);
    } else {
      _objectValue.spot_setValue(SNumber.toString(val));
    }

    _objectValue.spot_setParent(this);
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

    if (_objectValue == null) {
      _objectValue = new SPOTPrintableString();
    }

    if (_objectValue instanceof aSPOTElement) {
      ((aSPOTElement) _objectValue).setValue(val);
    } else {
      _objectValue.spot_setValue(SNumber.toString(val));
    }

    _objectValue.spot_setParent(this);
  }

  /**
   * Sets the ANY object
   *
   * @param val the object
   */
  public void setValue(iSPOTElement val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (val != null) {
      _clsDefinedBy = (_clsDefinedBy == null)
          ? SPOTHelper.createDefinedByClass(this, _strDefinedBy)
          : _clsDefinedBy;

      if ((_clsDefinedBy != null) && !_clsDefinedBy.isInstance(val)) {
        throw new SPOTException(NOT_CLASS, STR_NOT_CLASS, _clsDefinedBy.getName(), val.getClass().getName());
      }
    }

    _objectValue = val;

    if (_objectValue != null) {
      _objectValue.spot_setParent(this);
    }
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

    if (_objectValue == null) {
      _objectValue = new SPOTPrintableString();
    }

    if (_objectValue instanceof aSPOTElement) {
      ((aSPOTElement) _objectValue).setValue(val);
    } else {
      _objectValue.spot_setValue(SNumber.toString(val));
    }

    _objectValue.spot_setParent(this);
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

    if (_objectValue == null) {
      _objectValue = new SPOTPrintableString();
    }

    if (_objectValue instanceof aSPOTElement) {
      ((aSPOTElement) _objectValue).setValue(val);
    } else {
      _objectValue.spot_setValue(val.toString());
    }

    _objectValue.spot_setParent(this);
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

    setValue(new SPOTPrintableString(val));
  }

  /**
   * Retrieves the value
   *
   * @return The value
   */
  public iSPOTElement getValue() {
    return _objectValue;
  }

  protected int spot_checkRangeValidityEx() {
    if (_isOptional && (_objectValue == null)) {
      return VALUE_NULL_AND_OPTIONAL;
    }

    if (_objectValue == null) {
      return VALUE_NULL;
    }

    int ret = _objectValue.spot_checkRangeValidity();

    switch (ret) {
      case VALUE_TO_BIG:
      case VALUE_TO_SMALL:
      case VALUE_INVALID_CHILD:
        return ret;

      default:
        return VALUE_OK;
    }
  }

  /**
   * Checks is the element is read-only and throws an exception if it is
   *
   * @throws SPOTException if the element is read only
   */
  protected final void spot_checkReadOnly() throws SPOTException {
    if (_isReadOnly) {
      throw new SPOTException(READ_ONLY, STR_READ_ONLY, _theName);
    }
  }


  /**
   * {@inheritDoc}
   *
   * @param canmakero {@inheritDoc}
   */
  protected void spot_setCanMakeReadOnly(boolean canmakero) {
    _canMakeReadOnly = canmakero;
  }
}
