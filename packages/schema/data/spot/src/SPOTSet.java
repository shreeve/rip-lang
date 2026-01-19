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
import com.appnativa.util.IdentityArrayList;
import com.appnativa.util.SNumber;
import com.appnativa.util.aStreamer;
import com.appnativa.util.iStructuredNode;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintWriter;

import com.appnativa.util.io.StringWriterEx;
import com.appnativa.util.json.iJSONArray;
import com.appnativa.util.json.iJSONObject;

import java.io.Writer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.ListIterator;
import java.util.Map;
import java.util.Map.Entry;

/**
 * Set represents an unordered collection of zero or more occurrences of a given
 * type. This can be thought of as and array of elements.
 *
 * @author Don DeCoteau
 * @version 2.0
 */
@SuppressWarnings("unused")
public class SPOTSet extends aSPOTElement implements List {

  /**
   * the maximum range of the set
   */
  protected int _nRangeMax = -1;

  /**
   * the minimum range of the set
   */
  protected int _nRangeMin = -1;

  /**
   * the elements in the set
   */
  protected IdentityArrayList<iSPOTElement> _theElements = new IdentityArrayList<iSPOTElement>();

  /**
   * the class for the elements in the set
   */
  protected Class _clsDefinedBy;

  /**
   * the name for the elements in the set
   */
  protected String _elementName;

  /**
   * the attributes defined for the elements in the set
   */
  protected Map _elementsDefinedAtributes;

  /**
   * the string representation class for the elements in the set
   */
  protected String  _strElementType;
  private   boolean _isAnySet = false;
  private   SPOTAny _anyPrototype;

  /**
   * Creates a new <code>Set</code> object with the specification that the
   * element represented by the object is mandatory.
   */
  public SPOTSet() {
    this(true);
  }

  /**
   * Creates a new <code>Set</code> object
   *
   * @param optional <code>true</code> if the element the object represents is optional
   */
  public SPOTSet(boolean optional) {
    _isOptional = optional;
  }

  /**
   * Creates a new <code>Set</code> object
   *
   * @param name The name of the object/element
   * @param cls  The class of object
   */
  public SPOTSet(String name, Class cls) {
    setType(name, cls);
    _isOptional = false;
  }

  /**
   * Creates a new <code>Set</code> object
   *
   * @param name   The name of the object/element
   * @param sclass The class name of object
   */
  public SPOTSet(String name, String sclass) {
    setType(name, sclass);
    _isOptional = false;
  }

  /**
   * Creates a new <code>Set</code> object
   *
   * @param name     The name of the object/element
   * @param sclass   The class name of object
   * @param optional <code>true</code> if the element the object represents is optional
   */
  public SPOTSet(String name, String sclass, boolean optional) {
    setType(name, sclass);
    _isOptional = optional;
  }

  /**
   * Creates a new <code>Set</code> object
   *
   * @param name   The name of the object/element
   * @param sclass The class name of object
   * @param max    The object's maximum acceptable value
   */
  public SPOTSet(String name, String sclass, int max) {
    _nRangeMax = max;
    setType(name, sclass);
    _isOptional = false;
  }

  /**
   * Creates a new <code>Set</code> object
   *
   * @param name     The name of the object/element
   * @param sclass   The class name of object
   * @param max      The object's maximum acceptable value
   * @param optional <code>true</code> if the element the object represents is optional
   */
  public SPOTSet(String name, String sclass, int max, boolean optional) {
    _nRangeMax = max;
    setType(name, sclass);
    _isOptional = optional;
  }

  /**
   * Creates a new <code>Set</code> object
   *
   * @param name     The name of the object/element
   * @param sclass   The class name of object
   * @param min      The object's minimum acceptable value
   * @param max      The object's maximum acceptable value
   * @param optional <code>true</code> if the element the object represents is optional
   */
  public SPOTSet(String name, iSPOTElement sclass, int min, int max, boolean optional) {
    if (min > -2) {
      _nRangeMin = min;
    }

    if (max > -2) {
      _nRangeMax = max;
    }

    setType(name, sclass);
    _isOptional = optional;
  }

  /**
   * Returns a SPOTSet for holding SPOTAny elements
   *
   * @param name the name of this element
   * @return the SPOTSet
   */
  public static SPOTSet anySet(String name) {
    return new SPOTSet(name, new SPOTAny(), -1, -1, true);
  }

  /**
   * Returns a SPOTSet for holding SPOTAny elements
   *
   * @param name     the name of this element
   * @param anyclass the name of the class that the SPOTAny object will use to restrict
   *                 its content
   * @return the SPOTSet
   */
  public static SPOTSet anySet(String name, String anyclass) {
    return new SPOTSet(name, new SPOTAny(anyclass), -1, -1, true);
  }

  /**
   * Returns a SPOTSet for holding SPOTAny elements
   *
   * @param name     the name of this element
   * @param anyclass the name of the class that the SPOTAny object will use to restrict
   *                 its content
   * @param min      the minimum number of elements that the set must contain
   * @param max      the maximum number of elements that the set must contain
   * @return the SPOTSet
   */
  public static SPOTSet anySet(String name, String anyclass, int min, int max) {
    SPOTSet set = new SPOTSet(name, new SPOTAny(anyclass), -1, -1, true);

    set.spot_setRange(min, max);

    return set;
  }

  /**
   * Returns a SPOTSet for holding an SPOT element
   *
   * @param name the name of this element
   * @return the SPOTSet
   */
  public static SPOTSet elementSet(String name, iSPOTElement type) {
    return new SPOTSet(name, type, -1, -1, true);
  }

  /**
   * Returns a SPOTSet for holding SPOTInteger elements
   *
   * @param name the name of this element
   * @return the SPOTSet
   */
  public static SPOTSet integerSet(String name) {
    return new SPOTSet(name, new SPOTInteger(), -1, -1, true);
  }

  /**
   * Returns a SPOTSet for holding SPOTInteger elements
   *
   * @param name the name of this element
   * @param min  the minimum number of elements that the set must contain
   * @param max  the maximum number of elements that the set must contain
   * @return the SPOTSet
   */
  public static SPOTSet integerSet(String name, int min, int max) {
    SPOTSet set = new SPOTSet(name, new SPOTInteger(), -1, -1, true);

    set.spot_setRange(min, max);

    return set;
  }

  /**
   * Returns a SPOTSet for holding SPOTReal elements
   *
   * @param name the name of this element
   * @return the SPOTSet
   */
  public static SPOTSet realSet(String name) {
    return new SPOTSet(name, new SPOTReal(), -1, -1, true);
  }

  /**
   * Returns a SPOTSet for holding SPOTReal elements
   *
   * @param name the name of this element
   * @param min  the minimum number of elements that the set must contain
   * @param max  the maximum number of elements that the set must contain
   * @return the SPOTSet
   */
  public static SPOTSet realSet(String name, int min, int max) {
    SPOTSet set = new SPOTSet(name, new SPOTReal(), -1, -1, true);

    set.spot_setRange(min, max);

    return set;
  }

  /**
   * Returns a SPOTSet that contains the specified element
   *
   * @param name the name of this element
   * @param e    the element to place in the set
   * @return the SPOTSet
   */
  public static SPOTSet spot_toSet(String name, iSPOTElement e) {
    SPOTSet set = new SPOTSet(name, e, -1, -1, true);

    set.add(e);

    return set;
  }

  /**
   * Returns a SPOTSet for holding SPOTPrintableString elements
   *
   * @param name the name of this element
   * @return the SPOTSet
   */
  public static SPOTSet stringSet(String name) {
    return new SPOTSet(name, new SPOTPrintableString(), -1, -1, true);
  }

  /**
   * Returns a SPOTSet for holding SPOTPrintableString elements
   *
   * @param name the name of this element
   * @param min  the minimum number of elements that the set must contain
   * @param max  the maximum number of elements that the set must contain
   * @return the SPOTSet
   */
  public static SPOTSet stringSet(String name, int min, int max) {
    SPOTSet set = new SPOTSet(name, new SPOTPrintableString(), -1, -1, true);

    set.spot_setRange(min, max);

    return set;
  }

  /**
   * Adds an element to this<code>Set</code> object
   *
   * @param element The element (specified as an interface)
   */
  public boolean add(iSPOTElement element) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (this._isAnySet) {
      element = this.createAnyElement(element);
    } else if ((_clsDefinedBy != null) && !_clsDefinedBy.isInstance(element)) {
      throw new SPOTException(NOT_CLASS, STR_NOT_CLASS, _clsDefinedBy.getName(), element.getClass().getName());
    }

    element.spot_setParent(this);
    _theElements.add(element);

    return true;
  }

  /**
   * Adds an element to this<code>Set</code> object
   *
   * @param o the object
   *          The element (specified as an interface)
   */
  public boolean add(Object o) {
    add(createEntry(o));
    return true;
  }

  public void add(int index, iSPOTElement element) {
    if (this._isAnySet) {
      element = this.createAnyElement(element);
    } else if ((_clsDefinedBy != null) && !_clsDefinedBy.isInstance(element)) {
      throw new SPOTException(NOT_CLASS, STR_NOT_CLASS, _clsDefinedBy.getName(), element.getClass().getName());
    }

    element.spot_setParent(this);

    if ((index < 0) || (index >= _theElements.size())) {
      _theElements.add(element);
    } else {
      _theElements.add(index, element);
    }
  }

  public void add(int index, Object element) {
    add(index, createEntry(element));
  }

  public boolean addAll(Collection c) {
    if (c != null) {

      for (Object o : c) {
        add(o);
      }
    }

    return true;
  }

  public boolean addAll(int index, Collection c) {
    if (c != null) {

      for (Object o : c) {
        add(index, o);
        index++;
      }
    }

    return true;
  }

  /**
   * Returns the value of the element at the specified position as a boolean
   *
   * @param position the position
   * @return the value
   */
  public boolean booleanValueAt(int position) {
    iSPOTElement ti = _theElements.get(position);

    return (ti instanceof aSPOTElement)
        ? ((aSPOTElement) ti).booleanValue()
        : SNumber.booleanValue(ti.spot_stringValue());
  }

  /**
   * Retrieves the set's values as an array of booleans
   *
   * @return The array of booleans
   */
  public boolean[] booleanValues() {
    int          n = _theElements.size();
    boolean[]    b = new boolean[n];
    iSPOTElement ti;

    for (int i = 0; i < n; i++) {
      ti = _theElements.get(i);
      b[i] = (ti instanceof aSPOTElement)
          ? ((aSPOTElement) ti).booleanValue()
          : SNumber.booleanValue(ti.spot_stringValue());
    }

    return b;
  }

  public void clear() {
    _theElements.clear();
  }

  public Object clone() {
    SPOTSet e = (SPOTSet) super.clone();

    e._theElements = new IdentityArrayList();
    e.deepCopy(this);

    return e;
  }

  public SPOTSet copy() {
    SPOTSet e = (SPOTSet) super.clone();

    e._theElements = new IdentityArrayList();
    e._theElements.addAll(_theElements);

    return e;
  }

  public boolean contains(Object o) {
    return _theElements.contains(o);
  }

  public boolean containsAll(Collection c) {
    return _theElements.containsAll(c);
  }

  /**
   * Copies the members of the specified set into this one
   *
   * @param set The set to copy from
   */
  public void copy(SPOTSet set) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _theElements.clear();
    _theElements.addAll(set._theElements);
  }

  /**
   * Copies the members of the specified set into this one
   *
   * @param set The set to copy from
   */
  public void deepCopy(SPOTSet set) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _theElements.clear();

    int          len = set.size();
    iSPOTElement e;

    for (int i = 0; i < len; i++) {
      e = set.getEx(i);

      if (e != null) {
        e = (iSPOTElement) e.clone();
      }

      add(e);
    }
  }

  /**
   * Returns the value of the element at the specified position as a
   * <code>double</code>
   *
   * @param position the position
   * @return the value
   */
  public double doubleValueAt(int position) {
    iSPOTElement ti = _theElements.get(position);

    return (ti instanceof aSPOTElement)
        ? ((aSPOTElement) ti).doubleValue()
        : SNumber.doubleValue(ti.spot_stringValue());
  }

  /**
   * Retrieves the set's values as an array of doubles
   *
   * @return The array of doubles
   */
  public double[] doubleValues() {
    int          n = _theElements.size();
    double[]     d = new double[n];
    iSPOTElement ti;

    for (int i = 0; i < n; i++) {
      ti = _theElements.get(i);
      d[i] = (ti instanceof aSPOTElement)
          ? ((aSPOTElement) ti).doubleValue()
          : SNumber.doubleValue(ti.spot_stringValue());
    }

    return d;
  }

  public boolean equals(aSPOTElement element) {
    if (element == this) {
      return true;
    }

    if (!(element instanceof SPOTSet)) {
      return false;
    }

    IdentityArrayList elements = ((SPOTSet) element)._theElements;
    int               len      = elements.size();

    if (len != _theElements.size()) {
      return false;
    }

    if (!spot_attributesEqual(this, element)) {
      return false;
    }

    for (int i = 0; i < len; i++) {
      if (!elements.get(i).equals(_theElements.get(i))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Retrieves the set's values as an array of doubles
   *
   * @return The array of doubles
   */
  public float[] floatValues() {
    int          n = _theElements.size();
    float[]      d = new float[n];
    iSPOTElement ti;

    for (int i = 0; i < n; i++) {
      ti = _theElements.get(i);
      d[i] = (ti instanceof aSPOTElement)
          ? ((aSPOTElement) ti).floatValue()
          : SNumber.floatValue(ti.spot_stringValue());
    }

    return d;
  }

  public boolean fromSDF(SDFNode node) throws SPOTException {
    if (node == null) {
      return false;
    }

    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    spot_clear();

    if (node.hasChildren() || (node.getNodeValue() != null)) {
      String name;

      if (_strElementType == null) {
        name = node.getNodeAttribute("_type");

        if ((name == null) && (_attributes != null)) {
          name = (String) _attributes.get("_type");
        }

        _strElementType = aSPOTElement.spot_resolveClassName(this, (name == null)
            ? "SPOTPrintableString"
            : name);
      }
    }

    if (node.hasAttributes()) {
      _attributes = new NoNullLinkedHashMap();
      _attributes.putAll(node.getNodeAttributes());
    }

    Map defatt = ((_elementsDefinedAtributes == null) || _elementsDefinedAtributes.isEmpty())
        ? null
        : _elementsDefinedAtributes;

    if (node.hasChildren()) {
      iSPOTElement  ti;
      List<SDFNode> nodes = node.getChildNodes();
      List          list  = null;

      for (SDFNode child : nodes) {

        if (child.getNodeType() == SDFNode.NODETYPE_COMMENT) {
          if (list == null) {
            list = new ArrayList();
          }

          list.add(child.getNodeName());

          continue;
        }
        ti = spot_getArrayClassInstance();
        ti.spot_setParent(this);

        if (defatt != null) {
          ti.spot_defineAttributes(defatt);
        }

        if (!ti.fromSDF(child)) {
          return false;
        }

        if ((list != null) && (list.size() > 0)) {
          ti.spot_setHeaderComments((String[]) list.toArray(new String[list.size()]));
          list.clear();
        }

        add(ti);
      }
    } else if (node.getNodeValue() != null) {
      iSPOTElement ti;

      try {
        ti = (iSPOTElement) SPOTHelper.loadClass(_strElementType).newInstance();
      } catch (Exception e) {
        if (e instanceof SPOTException) {
          throw (SPOTException) e;
        }

        throw new SPOTException(NO_CREATE, String.format(iSPOTConstants.STR_NO_CREATE, _strElementType), e);
      }

      if (!ti.fromSDF(node)) {
        return false;
      }

      if (defatt != null) {
        ti.spot_defineAttributes(defatt);
      }

      add(ti);
    }

    return true;
  }

  public void fromStream(InputStream in) throws IOException {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    int len = aStreamer.readInt(in);

    _theElements.clear();

    iSPOTElement ti;
    for (int i = 0; i < len; i++) {
      ti = spot_getArrayClassInstance();
      ti.fromStream(in);
      _theElements.add(ti);
    }
  }

  public boolean fromStructuredNode(iStructuredNode node) throws SPOTException {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    spot_clear();

    if (node.hasAttributes()) {
      _attributes = new NoNullLinkedHashMap();
      node.copyAttributes(_attributes);
    }

    String name;

    if (_strElementType == null) {
      name = node.getChildrenType();

      _strElementType = aSPOTElement.spot_resolveClassName(this, (name == null)
          ? "SPOTPrintableString"
          : name);
    }

    iSPOTElement ti;

    node = node.getFirstSignificantChild();

    do {
      name = node.getName();

      if (!name.equalsIgnoreCase(_elementName)) {
        throw new SPOTException(INVALID_ELEMENT, STR_INVALID_ELEMENT, _elementName, name);
      }

      ti = spot_getArrayClassInstance();
      ti.spot_setParent(this);

      if (!ti.fromStructuredNode(node)) {
        return false;
      }

      add(ti);
    } while ((node = node.getNextSibling()) != null);

    return true;
  }

  @Override
  public int hashCode() {
    return _theElements.hashCode();
  }

  public int indexOf(Object o) {
    return _theElements.indexOf(o);
  }

  /**
   * Retrieves the index of element in the set This will cause SPOTAny objects
   * to be unwrapped and testedto match the spacified object (if the set ais a
   * <b>Any</b> set)
   *
   * @param e the element to look for
   * @return the index of the specified element of -1 if the element is not
   * found
   */
  public int indexOfEx(iSPOTElement e) {
    int n = _theElements.size();

    for (int i = 0; i < n; i++) {
      if (e == (_theElements.get(i)).spot_elementValue()) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Retrieves the index of element in the set whose string value matches the
   * specified value. This will cause SPOTAny objects to be unwrapped and tested
   * to match the spacified object (if the set is an <b>Any</b> set)
   *
   * @param value the value to look for
   * @return the index of the specified element of -1 if the element is not
   * found
   */
  public int indexOfStringValueEx(String value) {
    int n = _theElements.size();

    for (int i = 0; i < n; i++) {
      iSPOTElement e = (_theElements.get(i)).spot_elementValue();

      if ((e != null) && value.equals(e.spot_stringValue())) {
        return i;
      }
    }

    return -1;
  }

  public Iterator iterator() {
    return _theElements.iterator();
  }

  public int lastIndexOf(Object o) {
    return _theElements.lastIndexOf(o);
  }

  public ListIterator listIterator() {
    return _theElements.listIterator();
  }

  public ListIterator listIterator(int index) {
    return _theElements.listIterator(index);
  }

  /**
   * Returns the value of the element at the specified position as a
   * <code>long</code>
   *
   * @param position the position
   * @return the value
   */
  public long longValueAt(int position) {
    iSPOTElement ti = _theElements.get(position);

    return (ti instanceof aSPOTElement)
        ? ((aSPOTElement) ti).longValue()
        : SNumber.longValue(ti.spot_stringValue());
  }

  /**
   * Retrieves the set's values as an array of longs
   *
   * @return The array of longs
   */
  public long[] longValues() {
    int          n = _theElements.size();
    long[]       l = new long[n];
    iSPOTElement ti;

    for (int i = 0; i < n; i++) {
      ti = _theElements.get(i);
      l[i] = (ti instanceof aSPOTElement)
          ? ((aSPOTElement) ti).longValue()
          : SNumber.longValue(ti.spot_stringValue());
    }

    return l;
  }

  /**
   * Retrieves the set's values as an array of objects
   *
   * @return The array of objects
   */
  public Object[] objectValues() {
    int          n = _theElements.size();
    Object[]     a = new Object[n];
    iSPOTElement ti;

    for (int i = 0; i < n; i++) {
      ti = getEx(i);
      a[i] = ti.spot_getValue();
    }

    return a;
  }

  public Object remove(int index) {
    return _theElements.remove(index);
  }

  public boolean remove(Object o) {
    return _theElements.remove(o);
  }

  public boolean removeAll(Collection c) {
    return _theElements.removeAll((Collection<iSPOTElement>) c);
  }

  /**
   * Removes the specified element from the set This will cause SPOTAny objects
   * to be unwrapped and tested to match the specified object (if the set is an
   * <b>Any</b> set)
   *
   * @param e the element to remove for
   * @return true if the element was removed; false otherwise
   */
  public int removeEx(iSPOTElement e) {
    int n = this.indexOfEx(e);

    if (n != -1) {
      _theElements.remove(n);
    }

    return n;
  }

  public boolean retainAll(Collection c) {
    return _theElements.retainAll(c);
  }

  public int size() {
    return _theElements.size();
  }

  public void spot_addAll(List list) {
    int len = (list == null)
        ? 0
        : list.size();

    for (int i = 0; i < len; i++) {
      add(list.get(i));
    }
  }

  public void spot_addAll(String[] list) {
    int len = (list == null)
        ? 0
        : list.length;

    for (int i = 0; i < len; i++) {
      add(list[i]);
    }
  }

  public String spot_checkRangeValidityStr() {
    int n = _theElements.size();

    if (n == 0) {
      return _isOptional
          ? null
          : Helper.expandString(STR_NULL, spot_getName());
    }

    if ((n < _nRangeMin) && (_nRangeMin != -1)) {
      return Helper.expandString(STR_TOFEW_ELEMENTS, spot_getName(), SNumber.toString(n), SNumber.toString(_nRangeMin));
    }

    if ((n > _nRangeMax) && (_nRangeMax != -1)) {
      return Helper.expandString(STR_TOMANY_ELEMENTS, spot_getName(), SNumber.toString(n),
          SNumber.toString(_nRangeMax));
    }

    iSPOTElement ti;

    for (int i = 0; i < n; i++) {
      ti = _theElements.get(i);

      if ((_clsDefinedBy != null) && !_clsDefinedBy.isInstance(ti)) {
        return Helper.expandString(STR_BAD_ELEMENT, SNumber.toString(i), spot_getName(),
            ti.spot_checkRangeValidityStr());
      }

      if (ti.spot_checkRangeValidity() != 0) {
        return Helper.expandString(STR_BAD_ELEMENT, SNumber.toString(i), spot_getName(),
            ti.spot_checkRangeValidityStr());
      }
    }

    return null;
  }

  public void spot_clear() {
    super.spot_clear();
    _theElements.clear();
  }

  public void spot_copy(iSPOTElement element, boolean newinstance) {
    if (!newinstance) {
      if (!OPTIMIZE_RUNTIME) {
        checkReadOnly();
      }

      spot_clear();
    }

    spot_copyEx(element);

    if (element instanceof SPOTSet) {
      deepCopy((SPOTSet) element);
    } else if (element instanceof aSPOTElement) {
      setValue(element.spot_stringValue());
    }
  }

  /**
   * Defines an attribute for that will be supported for elements in the set
   *
   * @param name         The name of the attribute
   * @param defaultValue the defaultValue
   */
  public void spot_defineElementAttribute(String name, String defaultValue) {
    if (_elementsDefinedAtributes == null) {
      _elementsDefinedAtributes = new LinkedHashMap();
    }

    _elementsDefinedAtributes.put(name, defaultValue);
  }

  public void spot_ensureCapacity(int capacity) {
    _theElements.ensureCapacity(capacity);
  }

  /**
   * Returns a new instance of the sets array type
   *
   * @return a new instance of the sets array type
   */
  public iSPOTElement spot_getArrayClassInstance() {
    try {
      return spot_getArrayClassInstanceEx();
    } catch (Exception e) {
      if (e instanceof SPOTException) {
        throw (SPOTException) e;
      }

      throw new SPOTException(NO_CREATE, String.format(iSPOTConstants.STR_NO_CREATE, _strElementType), e);
    }
  }

  public String spot_getArrayClassShortName() {
    String s = _strElementType;

    if (this._anyPrototype != null) {
      s = _anyPrototype.spot_getDefinedByType();

      if (s == null) {
        return "Any";
      }
    }

    if (s == null) {
      return "";
    }

    int n = s.lastIndexOf('.');

    s = (n == -1)
        ? s
        : s.substring(n + 1);

    if (s.startsWith("SPOT")) {
      s = s.substring(4);
    }

    return s;
  }

  /**
   * Returns the name of the element the set contains
   *
   * @return The name
   */
  public String spot_getElementName() {
    return _elementName;
  }

  public Object[] spot_getRange() {
    if ((_nRangeMin < 0) && (_nRangeMax < 0)) {
      return null;
    }

    return new Object[]{_nRangeMin, _nRangeMax};
  }

  /**
   * Retrieves the named object as a/an <code>Sequence</code> object
   *
   * @param position The position of the element/object
   * @return The <code>Sequence</code> object; otherwise <code>null</code>
   */
  public SPOTSequence spot_getSequenceElement(int position) {
    return (SPOTSequence) _theElements.get(position);
  }

  /**
   * Retrieves the named object as a/an <code>Set</code> object
   *
   * @param position The position of the element/object
   * @return The <code>Set</code> object; otherwise <code>null</code>
   */
  public SPOTSet spot_getSetElement(int position) {
    return (SPOTSet) _theElements.get(position);
  }

  /**
   * Retrieves an unmodifiable list of the supported attributes for elements in
   * the set
   *
   * @return The supported attributes
   */
  public Map spot_getSupportedElementAttributes() {
    return (_elementsDefinedAtributes == null)
        ? null
        : Collections.unmodifiableMap(_elementsDefinedAtributes);
  }

  public final int spot_getType() {
    return SPOT_TYPE_SET;
  }

  /**
   * Retrieves the range of valid values for the object.
   *
   * @return The valid range as a displayable string
   */
  public String spot_getValidityRange() {
    return getRangeString(_nRangeMin, _nRangeMax);
  }

  public Object spot_getValue() {
    return objectValues();
  }

  public boolean spot_isAnySet() {
    return _strElementType.endsWith("SPOTAny");
  }

  public boolean spot_isContainer() {
    return true;
  }

  public boolean spot_isSequenceSet() {
    if (spot_isAnySet()) {
      return false;
    }

    if (_clsDefinedBy != null) {
      return SPOTSequence.class.isAssignableFrom(_clsDefinedBy);
    }

    return !_strElementType.contains("SPOT");
  }

  public void spot_makeReadOnly() {
    if (_canMakeReadOnly && !_isReadOnly) {
      _isReadOnly = true;

      for (iSPOTElement ti : _theElements) {
        ti.spot_makeReadOnly();
      }
    }
  }

  @Override
  public boolean spot_requiresJSONObject(boolean addAttributes, boolean addTypeInfo, boolean addLinkedData) {
    return addTypeInfo || super.spot_requiresJSONObject(addTypeInfo, addLinkedData, addAttributes);
  }


  /**
   * Sets the default value for the object.
   *
   * @param val The value to become the default (i.e. used when the object has no
   *            value ) <code>true</code> if the operation was successful;
   *            <code>false</code> otherwise
   */
  public void spot_setDefaultValue(String val) {
    throw new SPOTException(NOT_SUPPORTED, STR_NOT_SUPPORTED, this.getClass().getName());
  }

  /**
   * Sets the valid range (the number of elements) for the set
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

    if (_nRangeMin < -1) {
      _nRangeMin = -1;
    }

    if (_nRangeMax < -1) {
      _nRangeMax = -1;
    }
  }

  /**
   * Sets the valid range (the number of elements) for the set
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

    if (_nRangeMin < -1) {
      _nRangeMin = -1;
    }

    if (_nRangeMax < -1) {
      _nRangeMax = -1;
    }
  }

  public String spot_stringValue() {
    throw new SPOTException(NOT_SUPPORTED, STR_NOT_SUPPORTED, "Set");
  }

  public String spot_stringValueEx() {
    throw new SPOTException(NOT_SUPPORTED, STR_NOT_SUPPORTED, "Set");
  }

  /**
   * Returns the value of the element at the specified position as a string
   *
   * @param position the position
   * @return the value
   */
  public String stringValueAt(int position) {
    iSPOTElement e = getEx(position);

    return e.spot_stringValue();
  }

  /**
   * Retrieves the set's values as an array of strings
   *
   * @return The array of strings
   */
  public String[] stringValues() {
    int          n = _theElements.size();
    String[]     s = new String[n];
    iSPOTElement ti;

    for (int i = 0; i < n; i++) {
      ti = getEx(i);
      s[i] = ti.spot_stringValue();
    }

    return s;
  }

  public List subList(int fromIndex, int toIndex) {
    return _theElements.subList(fromIndex, toIndex);
  }

  public Object[] toArray() {
    return _theElements.toArray();
  }

  /**
   * Returns an array containing all of the elements in this set in the correct
   * order; the runtime type of the returned array is that of the specified
   * array. If the list fits in the specified array, it is returned therein.
   * Otherwise, a new array is allocated with the runtime type of the specified
   * array and the size of this list.
   * <p>
   * <p>
   * If the list fits in the specified array with room to spare (i.e., the array
   * has more elements than the list), the element in the array immediately
   * following the end of the collection is set to <tt>null</tt>. This is useful
   * in determining the length of the list <i>only</i> if the caller knows that
   * the list does not contain any <tt>null</tt> elements.
   *
   * @param a the array into which the elements of the list are to be stored, if
   *          it is big enough; otherwise, a new array of the same runtime type
   *          is allocated for this purpose.
   * @return an array containing the elements of the list.
   */
  public Object[] toArray(Object a[]) {
    return _theElements.toArray(a);
  }

  @Override
  public Object toJSONValue(boolean addDefaultValues, boolean addAttributes, boolean addTypeInfo, boolean addLinkedData) {
    if (spot_requiresJSONObject(addAttributes, addTypeInfo, addLinkedData)) {
      iJSONObject json = Env.createJSONObject(3);
      json.put(JSON_CLASS_PROPERTY, _strElementType);
      json.put(JSON_VALUE_PROPERTY, toJSONArray(addDefaultValues,addAttributes, addTypeInfo, addLinkedData));
      if (addAttributes && _attributeSet) {
        json.put(JSON_ATTRIBUTES_PROPERTY, Env.createJSONObject((Map) _attributes.clone()));
      }
      if (addLinkedData && _linkedData != null) {
        json.put(JSON_LINKED_DATA_PROPERTY, _linkedData);
      }
      return json;
    }
    return toJSONArray(addDefaultValues,addAttributes, addTypeInfo, addLinkedData);
  }

  public iJSONArray toJSONArray(boolean addDefaultValues,boolean addAttributes, boolean addTypeInfo, boolean addLinkedData) {
    iJSONArray array = Env.createJSONArray(_theElements.size());
    for (iSPOTElement e : _theElements) {
      array.add(e.toJSONValue(addDefaultValues, addAttributes, addTypeInfo, addLinkedData));
    }
    return array;
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
    return toSDF(out, spot_getName(), 0, false, true);
  }

  public boolean toSDF(Writer out, String tag, int depth, boolean outputempty, boolean outputComments)
      throws IOException {
    if ((_headerComment != null) && outputComments) {

      for (String s : _headerComment) {
        writeSDFName(out, s, depth);
        out.write("\n");
      }
    }

    int n = _theElements.size();

    if (n > 0) {
      iSPOTElement prot = null;

      if (tag == null) {
        tag = "{\n";
      } else {
        tag += " {\n";
      }

      aSPOTElement.writeSDFName(out, tag, depth);

      if (n > 0) {
        for (iSPOTElement ti : _theElements) {

          if (ti == null) {
            continue;
          }

          prot = ti;

          if (!ti.toSDF(out, null, depth + 1, outputempty, outputComments)) {
            Helper.writePadding(out, depth + 1);
            out.write("{}\n");
          }
        }

        Helper.writePadding(out, depth);
        out.write("}");

        String type = null;

        if ((spot_getParent() instanceof SPOTAny) && (prot != null)) {
          type = spot_getRelativeClassName(prot);
        }

        if (_attributes != null) {
          if (type != null) {
            _attributes.put("_type", type);
          }

          aSPOTElement.writeAttributes(out, _attributes, _defAttributes, depth);

          if (type != null) {
            _attributes.remove("_type");
          }
        } else if (type != null) {
          out.append(" [ _type=\"");
          out.append(type);
          out.append("\" ]");
        }

        if ((_footerComment != null) && outputComments) {
          out.write(" ");
          out.write(_footerComment);
        }

        out.write("\n");
      }

      return true;
    } else if (outputempty || _attributeSet) {
      if (_clsDefinedBy != null) {
        try {
          iSPOTElement ti = spot_getArrayClassInstanceEx();

          if (tag == null) {
            tag = "{\n";
          } else {
            tag += " {\n";
          }

          aSPOTElement.writeSDFName(out, tag, depth);
          ti.toSDF(out, null, depth + 1, outputempty, outputComments);
          Helper.writePadding(out, depth);
          out.write("}");

          if (_attributes != null) {
            aSPOTElement.writeAttributes(out, _attributes, _defAttributes, depth);
          }

          out.write("\n");

          return true;
        } catch (Exception ex) {
          ex.printStackTrace(new PrintWriter(out));
        }
      }

      if (tag == null) {
        tag = "{}";
      } else {
        tag += " {}";
      }

      if (_attributes != null) {
        aSPOTElement.writeAttributes(out, _attributes, _defAttributes, depth);
      }

      aSPOTElement.writeSDFName(out, tag, depth);
      out.write("\n");

      return true;
    }

    return false;
  }

  public void toStream(OutputStream out) throws IOException {
    int len = _theElements.size();

    aStreamer.toStream(len, out);

    for (iSPOTElement ti : _theElements) {
      ti.toStream(out);
    }
  }

  /**
   * Converts the object to a <code>String</code> object
   *
   * @return The object
   */
  public String toString() {
    com.appnativa.util.io.StringWriterEx sw = new com.appnativa.util.io.StringWriterEx();

    try {
      toSDF(sw);
    } catch (IOException ignored) {
    }

    sw.flush();

    return sw.toString();
  }

  /**
   * This method returns the underlying list of objects It is prefixed with
   * "unsafe" to caution users that the integrity of the set can be compromised
   * if changes are made to the list. If the set is marked as read-only then a
   * copy is returned
   *
   * @return the underlying list of objects
   */
  public List unsafeGetObjectList() {
    if (_isReadOnly) {
      return Collections.unmodifiableList(_theElements);
    }

    return _theElements;
  }

  public iSPOTElement set(int index, iSPOTElement element) {
    if (this._isAnySet) {
      element = this.createAnyElement(element);
    } else if ((_clsDefinedBy != null) && !_clsDefinedBy.isInstance(element)) {
      throw new SPOTException(NOT_CLASS, STR_NOT_CLASS, _clsDefinedBy.getName(), element.getClass().getName());
    }

    element.spot_setParent(this);

    return _theElements.set(index, element);
  }

  public Object set(int index, Object element) {
    return set(index, createEntry(element));
  }

  /**
   * Sets the name and type of elements that make up the <code>Set</code>
   *
   * @param name The name of the object/element
   * @param type The type of object (specified as an interface)
   */
  public void setType(String name, Class type) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _elementName = name;
    _strElementType = type.getName();
    _clsDefinedBy = type;
    _elementsDefinedAtributes = null;
    _isAnySet = _clsDefinedBy.equals(SPOTAny.class);
  }

  /**
   * Sets the name and type of elements that make up the <code>Set</code>
   *
   * @param name  The name of the object/element
   * @param itype The type of object (specified as an interface)
   */
  public void setType(String name, iSPOTElement itype) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _elementName = name;

    if (itype != null) {
      _strElementType = itype.getClass().getName();
      _clsDefinedBy = itype.getClass();
      _elementsDefinedAtributes = itype.spot_getSupportedAttributes();

      if (_elementsDefinedAtributes != null) {
        _elementsDefinedAtributes = new LinkedHashMap(_elementsDefinedAtributes);
      }

      this._isAnySet = _clsDefinedBy.equals(SPOTAny.class);

      if (this._isAnySet) {
        _anyPrototype = new SPOTAny((SPOTAny) itype);
      }
    }
  }

  /**
   * Sets the name and type of elements that make up the <code>Set</code>
   *
   * @param name  The name of the object/element
   * @param itype The type of object (specified as an interface)
   */
  public void setType(String name, String itype) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    _elementName = name;
    _strElementType = aSPOTElement.spot_resolveClassName(this, itype);
    _elementsDefinedAtributes = null;

    if (_strElementType != null) {
      try {
        _clsDefinedBy = SPOTHelper.loadClass(_strElementType);
        this._isAnySet = _clsDefinedBy.equals(SPOTAny.class);
      } catch (ClassNotFoundException ignored) {
      }
    }
  }

  @Override
  public void setValue(String val) {
    clear();
    add(createEntry(val));
  }

  /**
   * Sets the values of the object. Removes any existing values.
   *
   * @param val The array of <code>Interface</code> objects to place in the set
   */
  public void setValue(List val) {
    if (!OPTIMIZE_RUNTIME) {
      checkReadOnly();
    }

    if (val == null) {
      return;
    }

    _theElements.clear();

    _theElements.ensureCapacity(val.size());

    for (Object v : val) {
      add(createEntry(v));
    }

  }

  /**
   * Sets the values of the object. Removes any existing values.
   *
   * @param val The values
   * @throws SPOTException if an error occurs
   */
  public void setValue(Object[] val) throws SPOTException {
    setValue(Arrays.asList(val));
  }

  /**
   * Retrieves the object at the specified position
   *
   * @param position The position
   * @return The object; otherwise <code>null</code>
   */
  public Object get(int position) {
    if ((position < 0) || (position > _theElements.size())) {
      return null;
    }

    return _theElements.get(position);
  }

  /**
   * Returns the number of objects present/contained within the set
   *
   * @return The number of objects in the set
   */
  public int getCount() {
    return _theElements.size();
  }

  /**
   * Retrieves the element value at the specified position. This will cause
   * SPOTAny objects to be unwrapped and the wrapped element to be returned
   *
   * @param position The position
   * @return The object; otherwise <code>null</code>
   */
  public iSPOTElement getEx(int position) {
    if ((position < 0) || (position > _theElements.size())) {
      return null;
    }

    return (_theElements.get(position)).spot_elementValue();
  }

  /**
   * Retrieves the array of object in the set
   *
   * @return The array of objects
   */
  public iSPOTElement[] getValues() {
    return _theElements.toArray(new iSPOTElement[_theElements.size()]);
  }

  /**
   * Retrieves the array of object in the set This will cause SPOTAny objects to
   * be unwrapped and the wrapped element to be returned
   *
   * @return The array of objects
   */
  public iSPOTElement[] getValuesEx() {
    int            n = _theElements.size();
    iSPOTElement[] a = new iSPOTElement[n];

    for (int i = 0; i < n; i++) {
      a[i] = (_theElements.get(i)).spot_elementValue();
    }

    return a;
  }

  public boolean isEmpty() {
    return _theElements.isEmpty();
  }

  public List spot_valuesToList() {
    if (spot_hasValue()) {
      List list = new ArrayList(size());
      spot_valuesToList(list);
      return list;
    }
    return Collections.EMPTY_LIST;
  }

  public void spot_valuesToList(List list) {
    for (iSPOTElement e : _theElements) {
      e = e.spot_elementValue();
      switch (e.spot_getType()) {
        case SPOT_TYPE_SEQUENCE:
          if (e.spot_hasValue()) {
            Map map1 = new LinkedHashMap();
            list.add(map1);
            ((SPOTSequence) e).spot_valuesToMap(map1);
          }
          break;
        case SPOT_TYPE_SET:
          if (e.spot_hasValue()) {
            ArrayList list1 = new ArrayList(((SPOTSet) e).size());
            list.add(list1);
            ((SPOTSet) e).spot_valuesToList(list1);
          }
          break;
        default:
          Object value = e.spot_getValue();
          if (value != null) {
            list.add(value);
          }
          break;
      }

    }
  }

  /**
   * Returns a new instance of the sets array type
   *
   * @return a new instance of the sets array type
   * @throws ClassNotFoundException
   * @throws IllegalAccessException
   * @throws InstantiationException
   */
  public iSPOTElement spot_getArrayClassInstanceEx() throws Exception {
    iSPOTElement e = null;
    if (_anyPrototype != null) {
      return new SPOTAny((_anyPrototype));
    }
    if (_clsDefinedBy != null) {
      e = (iSPOTElement) _clsDefinedBy.newInstance();
    } else if (_strElementType != null) {
      e = (iSPOTElement) SPOTHelper.loadClass(_strElementType).newInstance();
    }

    if (e != null && _elementsDefinedAtributes != null) {

      for (Entry en : (Iterable<Entry>) _elementsDefinedAtributes.entrySet()) {
        e.spot_defineAttribute((String) en.getKey(), (String) en.getValue());
      }
    }

    return e;
  }

  /**
   * Returns a the class associated with the sets array type
   * <p>
   * * @return a new instance of the sets array type
   *
   * @throws ClassNotFoundException
   */
  public Class spot_getDefinedByClass() throws ClassNotFoundException {

    if (_clsDefinedBy == null && _strElementType != null) {
      _clsDefinedBy = SPOTHelper.loadClass(_strElementType);
    }
    return _clsDefinedBy;
  }

  /**
   * Creates an element that can beaddes to the sef rom the specified value
   *
   * @param value the value
   * @return the new element
   */
  public iSPOTElement createEntry(Object value) {
    if (value instanceof iSPOTElement || value == null) {
      return (iSPOTElement) value;
    }
    iSPOTElement ti = spot_getArrayClassInstance();

    if (ti instanceof aSPOTElement) {
      aSPOTElement e = (aSPOTElement) ti;
      if (value instanceof SNumber) {
        e.setValue((SNumber) value);
      } else if (value instanceof Long) {
        e.setValue((Long) value);
      } else if (value instanceof Boolean) {
        e.setValue((Boolean) value);
      } else if (value instanceof Double) {
        e.setValue((Double) value);
      } else {
        e.setValue(value.toString());
      }
    } else {
      ti.spot_setValue(value.toString());
    }

    return ti;

  }

  protected int spot_checkRangeValidityEx() {
    int n = _theElements.size();

    if (n == 0) {
      return _isOptional
          ? VALUE_NULL_AND_OPTIONAL
          : VALUE_NULL;
    }

    if ((n < _nRangeMin) && (_nRangeMin != -1)) {
      return VALUE_TO_SMALL;
    }

    if ((n > _nRangeMax) && (_nRangeMax != -1)) {
      return VALUE_TO_BIG;
    }

    for (iSPOTElement ti : _theElements) {
      int ret = ti.spot_checkRangeValidity();

      if (ret > 0) {
        return VALUE_INVALID_CHILD;
      } else if ((ret < 0) && (ret > -3)) {
        return VALUE_INVALID_CHILD;
      }
    }

    return VALUE_OK;
  }

  iSPOTElement createAnyElement(iSPOTElement e) {
    if (e instanceof SPOTAny) {
      return e;
    }

    SPOTAny a = new SPOTAny(_anyPrototype);

    a.setValue(e);

    return a;
  }
}
