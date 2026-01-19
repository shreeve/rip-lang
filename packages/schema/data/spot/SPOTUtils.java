package com.appnativa.spot;

import com.appnativa.util.CharScanner;
import com.appnativa.util.Env;
import com.appnativa.util.FormatException;
import com.appnativa.util.SNumber;
import com.appnativa.util.iDataValue;
import com.appnativa.util.json.iJSONObject;
import com.appnativa.util.net.JavaURLConnection;
import com.appnativa.util.net.URLLink;
import com.appnativa.util.net.iURLConnection;
import com.appnativa.util.net.iURLResolver;

import java.io.IOException;
import java.io.Reader;
import java.net.URL;
import java.util.Map;

/**
 * DOCUMENT ME!
 *
 * @author Don DeCoteau
 */
public class SPOTUtils {
  public static String DEFAULT_PACKAGE_NAME;

  static {
    if (DEFAULT_PACKAGE_NAME == null) {
      DEFAULT_PACKAGE_NAME = "com.appnativa.rare.spot";
    }
  }

  /**
   * Parses name/value pairs from the specified string. THe mimeType attribute
   * is checked to ascertain the format of the data (the default is name=value
   * pairs separated by a semicolon if a delimiter attribute is present that
   * that delimiter is used instead).
   *
   * @param data the data to parse
   * @return the map of values
   */
  public static Map parseNameValuePairs(SPOTPrintableString data) {
    Object o = data.spot_getLinkedData();
    if (o instanceof Map) {
      data.spot_setLinkedData(null);
      return (Map) o;
    }
    String type = data.spot_getAttribute("mimeType");

    if ((type == null) || (type.length() == 0) || (!type.equals("json") && !type.equals("application/json"))) {
      String delim = data.spot_getAttribute("delimiter");
      char c = ((delim != null) && (delim.length() > 0))
          ? delim.charAt(0)
          : ';';

      return CharScanner.parseOptionString(data.getValue(), c);
    }

    String s = data.getValue();

    s = s.trim();

    if (!s.startsWith("{") && !s.endsWith("}")) {
      s = "{" + s + "}";
    }

    return Env.createJSONObject(s).getObjectMap();
  }

  /**
   * Returns the <code>RenderableDataItem</code>type for the specified
   * SPOT value type.
   *
   * @param type the SPOT value type
   * @return the <code>RenderableDataItem</code>type
   */
  public static iDataValue.ValueType valueTypeFromSPOTType(int type) {
    iDataValue.ValueType v = iDataValue.ValueType.valueOf(type);
    return v == null ? iDataValue.ValueType.unknown_type : v;
  }

  public static float getPercentAttributeValue(iSPOTElement item) {
    float f = SNumber.floatValue(item.spot_getAttribute("percent"));
    if (f != 0) {
      if (f > 1) {
        f = f / 100;
      }

      if (f <= 0) {
        f = 1;
      }
    }
    return f;
  }

  public static iSPOTElement loadSPOTObject(URLLink link) throws IOException {
    return loadSPOTObject(link, null, null, null);
  }

  public static iSPOTElement loadSPOTObject(URLLink link, iSPOTElement element) throws IOException {
    return loadSPOTObject(link, element, null, null);
  }

  public static iSPOTElement loadSPOTObject(URLLink link, iSPOTElement element, boolean keepComments) throws IOException {
    return loadSPOTObject(link, element, null, null, keepComments);
  }

  public static iSPOTElement loadSPOTObject(URLLink link, String defaultPackage) throws IOException {
    return loadSPOTObject(link, null, defaultPackage, null);
  }

  public static iSPOTElement loadSPOTObject(URLLink link, iSPOTElement element, String defaultPackage,
      iSPOTTemplateHandler th) throws IOException {
    return loadSPOTObject(link, element, defaultPackage, th, false);
  }

  public static iSPOTElement loadSPOTObject(URLLink link, iSPOTElement element, String defaultPackage,
      iSPOTTemplateHandler th, boolean keepComments) throws IOException {
    try {
      String type = link.getContentType();
      if (type.startsWith(iURLConnection.JSON_MIME_TYPE)) {
        return null;
      }

      return loadSPOTObjectRML(link.getResolver(), link.getReader(), element, link.getURL(), defaultPackage, th, keepComments);
    } finally {
      link.close();
    }
  }

  public static iSPOTElement loadSPOTObjectRML(iURLResolver context, Reader reader, iSPOTElement element,
      URL contextURL, String defaultPackage, iSPOTTemplateHandler th, boolean keepComments)
      throws IOException {
    SDFNode root = SDFNode.parse(reader, context, (contextURL == null)
        ? null
        : contextURL.toString(), keepComments);

    SDFNode node = root.getFirstBlockNode();

    if (node == null) {
      throw new FormatException(invalidConfiguration(contextURL, ""));
    }
    String s;
    if (element == null) {
      String className = null;
      try {
        String  type  = node.getNodeName();
        boolean isset = false;

        if (type.equals("Set") && node.hasAttributes()) {
          s = (String) node.getNodeAttributes().get("type");

          if (s != null) {
            type = s;
            isset = true;
          }
        }

        if (type.indexOf('.') == -1) {
          if (defaultPackage == null) {
            defaultPackage = DEFAULT_PACKAGE_NAME;
          }
          if (defaultPackage != null) {
            type = defaultPackage + "." + type;
          }
        }
        className = type;
        Class cls = Env.loadClass(type);

        element = (iSPOTElement) cls.newInstance();

        if (isset) {
          SPOTSet set = new SPOTSet("Set", element, -1, -1, true);

          set.spot_setName("Set");
          element = set;
        }
      } catch (ClassNotFoundException e) {
        throw new FormatException(unknownClass(contextURL, className));

      } catch (Exception e) {
        throw new FormatException(invalidConfiguration(contextURL, ""), e);
      }
    }
    try {
      if ((th != null) && (element instanceof SPOTSequence)) {
        ((SPOTSequence) element).spot_setTemplateHandler(th);
      }

      if (!element.fromSDF(node)) {

        throw new FormatException(invalidConfiguration(contextURL, element.toString()));
      }
    } finally {
      if (th != null && (element instanceof SPOTSequence)) {
        ((SPOTSequence) element).spot_setTemplateHandler(null);
      }
    }

    return element;
  }

  static String invalidConfiguration(URL contextURL, String message) {
    String s = Env.getString("SPOT.invalidConfiguration", "Invalid configuration in '%s':\n%s");
    String url = (contextURL == null)
        ? "<UNSPECIFIED>"
        : JavaURLConnection.toExternalForm(contextURL);
    return String.format(s, message, url);
  }

  static String unknownClass(URL contextURL, String className) {
    String s = Env.getString("SPOT.unknownClass", "Unknown class '%s' in '%s'");
    String url = (contextURL == null)
        ? "<UNSPECIFIED>"
        : JavaURLConnection.toExternalForm(contextURL);
    return String.format(s, className, url);

  }
}
