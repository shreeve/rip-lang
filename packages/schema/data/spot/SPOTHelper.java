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
import com.appnativa.util.iPackageHelper;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

@SuppressWarnings("unused")
public class SPOTHelper {
  private static       Class[]              _setRefType    = new Class[]{iSPOTElement.class};
  private final static HashMap              _fromShortName = new HashMap();
  private final static HashMap              _fromClassName = new HashMap();
  private static       iPackageHelper       packageHelper;
  private static       iNameResolver        nameResolver;
  private static       iPArsedNodeValidator nodeValidator;

  static {
    String pkg = iSPOTConstants.SPOT_PACKAGE_NAME + ".";

    _fromShortName.put("String", pkg + "SPOTPrintableString");
    _fromShortName.put("PrintableString", pkg + "SPOTPrintableString");
    _fromShortName.put("OctetString", pkg + "SPOTOctetString");
    _fromShortName.put("Integer", pkg + "SPOTInteger");
    _fromShortName.put("Real", pkg + "SPOTReal");
    _fromShortName.put("Set", pkg + "SPOTSet");
    _fromShortName.put("Sequence", pkg + "SPOTSequence");
    _fromShortName.put("Any", pkg + "SPOTAny");
    _fromShortName.put("DateTime", pkg + "SPOTDateTime");
    _fromShortName.put("DateEx", pkg + "SPOTDate");
    _fromShortName.put("Time", pkg + "SPOTTime");
    _fromShortName.put("Boolean", pkg + "SPOTBoolean");
    _fromShortName.put("ByteString", pkg + "SPOTByteString");
    _fromShortName.put("Enumerated", pkg + "SPOTEnumerated");
    _fromClassName.put(pkg + "SPOTPrintableString", "String");
    _fromClassName.put(pkg + "SPOTOctetString", "OctetString");
    _fromClassName.put(pkg + "SPOTInteger", "Integer");
    _fromClassName.put(pkg + "SPOTReal", "Real");
    _fromClassName.put(pkg + "SPOTSet", "Set");
    _fromClassName.put(pkg + "SPOTSequence", "Sequence");
    _fromClassName.put(pkg + "SPOTAny", "Any");
    _fromClassName.put(pkg + "SPOTDateTime", "DateTime");
    _fromClassName.put(pkg + "SPOTDate", "DateEx");
    _fromClassName.put(pkg + "SPOTTime", "Time");
    _fromClassName.put(pkg + "SPOTBoolean", "Boolean");
    _fromClassName.put(pkg + "SPOTByteString", "ByteString");
    _fromClassName.put(pkg + "SPOTEnumerated", "Enumerated");
  }

  private SPOTHelper() {
  }

  /**
   * Creates a defined by class
   *
   * @return the class
   */
  public static Class createDefinedByClass(iSPOTElement parent, String definedBy) {
    if (definedBy == null) {
      return null;
    }

    try {
      String s = definedBy;

      if (definedBy.indexOf('.') == -1) {
        StringBuilder sb = new StringBuilder();

        sb.append(getPackageName(parent.getClass()));
        sb.append('.');

        if (!definedBy.startsWith("SPOT")) {
          sb.append("SPOT");
        }

        sb.append(definedBy);
        s = sb.toString();
      } else {
        s = s.replace(':', '.');
      }

      return loadClass(s);
    } catch (ClassNotFoundException e) {
      throw new SPOTException(e);
    }
  }

  public static Class loadClass(String name) throws ClassNotFoundException {
    if (packageHelper != null) {
      return packageHelper.loadClass(name);
    }

    return Class.forName(name);
  }

  public static Class getFieldClass(Field field) {
    if (packageHelper == null) {
      try {
        packageHelper = (iPackageHelper) Class.forName("com.appnativa.util.JavaPackageHelper").newInstance();
      } catch (Exception e) {
        e.printStackTrace();
      }
    }

    if (packageHelper != null) {
      return packageHelper.getFieldClass(field);
    }

    return null;
  }

  public static String getPackageName(Class cls) {
    if (packageHelper == null) {
      try {
        packageHelper = (iPackageHelper) Class.forName("com.appnativa.util.JavaPackageHelper").newInstance();
      } catch (Exception e) {
        e.printStackTrace();
      }
    }

    if (packageHelper != null) {
      return packageHelper.getPackageName(cls);
    }

    return null;
  }

  public static String createDefinedByString(iSPOTElement parent, String definedby) {
    String s = getPackageName(parent.getClass());

    if (definedby.startsWith(s)) {
      s = definedby.substring(s.length() + 1);

      if (s.startsWith("SPOT")) {
        definedby = s.substring("SPOT".length());
      }
    }

    return definedby;
  }

  public static iSPOTElement elementFromName(Map refClassMap, iSPOTElement parent, String name) {
    try {
      StringBuilder sb = new StringBuilder("get");

      sb.append(name).append("Reference");

      char c = Character.toUpperCase(name.charAt(0));

      sb.setCharAt(3, c);

      String       s = sb.toString();
      Method       m = parent.getClass().getMethod(s, (Class[]) null);
      iSPOTElement e = (iSPOTElement) m.invoke(parent, (Object[]) null);

      if (e != null) {
        refClassMap.put(name, e.getClass());

        return e;
      }
    } catch (NoSuchMethodException ignored) {
    } catch (Exception ex) {
      throw new SPOTException(Helper.pealException(ex));
    }

    Class cls = (Class) refClassMap.get(name);

    if (cls == null) {
      try {
        Field f = parent.getClass().getDeclaredField(name);

        cls = getFieldClass(f);
        refClassMap.put(name, cls);
      } catch (Exception ex) {
        return null;
      }
    }

    try {
      return (iSPOTElement) cls.newInstance();
    } catch (Exception ex1) {
      return null;
    }
  }

  /**
   * Sets the value of a referenced variable
   *
   * @param parent  the parent object
   * @param name    the name of the variable
   * @param element iSPOTElement the element representing the field
   */
  public static void setReferenceVariable(iSPOTElement parent, String name, iSPOTElement element) {
    try {
      StringBuilder sb = new StringBuilder("set");

      sb.append(name);

      char c = Character.toUpperCase(name.charAt(0));

      sb.setCharAt(3, c);

      String s = sb.toString();
      Method m = parent.getClass().getMethod(s, _setRefType);

      m.invoke(parent, element);
    } catch (Exception ex) {
      throw new SPOTException(ex);
    }
  }

  public static String getRelativeClassName(iSPOTElement obj) {
    if (obj == null) {
      return null;
    }
    String name = obj.spot_getClassName();
    String s    = (String) _fromClassName.get(name);
    if (s == null && nameResolver != null) {
      s = nameResolver.getShortName(name);
    }

    if (s != null) {
      return s;
    }

    String       spot = iSPOTConstants.SPOT_PACKAGE_NAME;
    String       rel  = null;
    iSPOTElement o    = obj;

    while (o != null) {
      s = getPackageName(o.getClass());

      if (!s.equals(spot)) {
        rel = s + ".";

        break;
      }

      o = o.spot_getParent();
    }


    if ((rel != null) && name.startsWith(rel)) {
      name = name.substring(rel.length());
    }

    return name;
  }

  public static String resolveClassName(iSPOTElement obj, String type) {
    if (type == null) {
      return null;
    }

    String s = (String) _fromShortName.get(type);
    if (s == null && nameResolver != null) {
      s = nameResolver.getClassName(type);
    }

    if (s != null) {
      return s;
    }

    int n = type.indexOf('.');

    if (n == -1) {
      String spot = iSPOTConstants.SPOT_PACKAGE_NAME;
      String rel  = null;

      while (obj != null) {
        s = getPackageName(obj.getClass());

        if (!s.equals(spot)) {
          rel = s;

          break;
        }

        obj = obj.spot_getParent();
      }

      if (rel == null) {
        rel = spot;
      }

      type = rel + "." + type;
    } else {
      type = type.replace(':', '.');
    }

    return type;
  }

  /**
   * Retrieves the SPOT name for the specified class.
   *
   * @return The name of the element
   */
  public static String getRelativeShortName(Class caller, Class cls) {
    String s = cls.getName();

    do {
      String ss = (String) _fromClassName.get(s);
      if (ss == null && nameResolver != null) {
        ss = nameResolver.getShortName(s);
      }
      if (ss != null) {
        s = ss;

        break;
      }

      if (!getPackageName(caller.getClass()).equals(getPackageName(cls))) {
        break;
      }

      int i = s.lastIndexOf('.');

      if (i != -1) {
        s = s.substring(i + 1);
      }
    } while (false);

    return s;
  }

  public static iPackageHelper getPackageHelper() {
    return packageHelper;
  }

  public static void setPackageHelper(iPackageHelper helper) {
    packageHelper = helper;
  }

  public static iNameResolver getNameResolver() {
    return nameResolver;
  }

  public static void setNameResolver(iNameResolver nameResolver) {
    SPOTHelper.nameResolver = nameResolver;
  }

  public static void addNameMapping(String shortName, String className) {
    _fromShortName.put(shortName, className);
    _fromClassName.put(className, shortName);
  }

  public static iPArsedNodeValidator getNodeValidator() {
    return nodeValidator;
  }

  public static void setNodeValidator(iPArsedNodeValidator nodeValidator) {
    SPOTHelper.nodeValidator = nodeValidator;
  }

  public static boolean isParsedNodeValidInContext(SDFNode child) {
    return nodeValidator == null || nodeValidator.isNodeValid(child);
  }

  public interface iNameResolver {
    String getClassName(String shortName);

    String getShortName(String className);
  }

  public interface iPArsedNodeValidator {
    boolean isNodeValid(SDFNode node);
  }
}
