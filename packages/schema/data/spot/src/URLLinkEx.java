package com.appnativa.spot;

import com.appnativa.util.Base64;
import com.appnativa.util.CharScanner;
import com.appnativa.util.SNumber;
import com.appnativa.util.UnexpectedException;
import com.appnativa.util.net.iURLResolver;
import com.appnativa.util.net.InlineURLConnection;
import com.appnativa.util.net.URLLink;
import com.appnativa.util.net.aURLConnection;
import com.appnativa.util.net.iURLConnection;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

/**
 * DOCUMENT ME!
 *
 * @author Don DeCoteau
 */
public class URLLinkEx extends URLLink {

  public URLLinkEx() {
  }

  public URLLinkEx(iURLResolver context) {
    super(context);
  }

  public URLLinkEx(iURLResolver context, iURLConnection connection) {
    super(context, connection);
  }

  public URLLinkEx(iURLResolver context, String url) {
    super(context, url);
  }

  public URLLinkEx(iURLResolver context, String url, String type) {
    super(context, url, type);
  }

  public URLLinkEx(iURLResolver context, URL url) {
    super(context, url);
  }

  public URLLinkEx(iURLResolver context, URL url, String type) {
    super(context, url, type);
  }

  public URLLinkEx(String url) {
    super(url);
  }

  public URLLinkEx(String data, String type) {
    super(data, type);
  }

  public URLLinkEx(URL url) {
    super(url);
  }

  public URLLinkEx(URL url, String type) {
    super(url, type);
  }

  /**
   * Creates a new action link using the specified
   * <code>SPOTPrintableString </code> object
   *
   * @param context the widget context for the link
   * @param url     the URL for the link
   */
  public URLLinkEx(iURLResolver context, SPOTPrintableString url) {
    this(context);

    String s = url.spot_getAttribute("inline");
    String inlineData = null,
        encoding = null;

    if ((s != null) && (s.length() > 0)) {
      inlineURL = SNumber.booleanValue(s);
    } else if (url.spot_isValuePreformatted()) {
      inlineURL = true;
    }

    s = url.getValue();

    if (inlineURL || (s == null)) {
      inlineData = s;
    } else if (s.startsWith("data:")) {
      int n = s.indexOf(',');

      if (n == -1) {
        inlineData = "";
      } else {
        inlineData = s.substring(n + 1);
        s = s.substring(5, n);
        n = s.indexOf(';');

        if (n != -1) {
          mimeType = s.substring(0, n);
          s = s.substring(n + 1).trim();

          if (s.endsWith("base64")) {
            String cs = aURLConnection.getCharsetFromMIMEString(s, StandardCharsets.UTF_8.name()).toLowerCase(Locale.US);
            try {
              byte[] b = Base64.encodeBytesToBytes(inlineData.getBytes(cs));

              inlineData = new String(b, cs);
            } catch (IOException ex) {
              throw new UnexpectedException(ex);
            }
          }
        } else {
          mimeType = s;
        }

        mimeType = mimeType.trim();

        if (mimeType.length() == 0) {
          mimeType = null;
        }
      }

      inlineURL = true;
    } else {
      stringURL = s;
    }

    deferred = !"false".equals(url.spot_getAttribute("deferred"));
    s = url.spot_getAttribute("method");
    if (s != null) {
      setRequestMethod(s);
    }
    s = url.spot_getAttribute("columnSeparator");

    if (s != null) {
      if (s.length() > 0) {
        colSeparator = s.charAt(0);
        columnSeparatorSet = true;
      }
    }

    s = url.spot_getAttribute("ldSeparator");

    if (s != null) {
      if (s.length() > 0) {
        ldSeparator = s.charAt(0);
      }
    }

    s = url.spot_getAttribute("riSeparator");

    if (s != null) {
      if (s.length() > 0) {
        rowInfoSeparator = s.charAt(0);
      }
    }

    if (mimeType == null) {
      mimeType = url.spot_getAttribute("mimeType");
    }

    s = url.spot_getAttribute("contentEncoding");

    if (s != null) {
      if (s.length() > 0) {
        encoding = s;
      }
    }

    contentEncoding = encoding;
    s = url.spot_getAttribute("unescape");

    if (s != null) {
      if (s.equalsIgnoreCase("unicode")) {
        unescape = true;
        unescapeUnicodeOnly = true;
      } else {
        unescape = s.equalsIgnoreCase("true");
      }
    }

    s = url.spot_getAttribute("customProperties");
    if (s != null) {
      customProperties = CharScanner.parseOptionStringEx(s, ',');
    }
    else {
      customProperties=url.spot_getDataAttributes();
    }

    s = url.spot_getAttribute("linkAttributes");
    if (s != null) {
      linkAttributes = (Map) CharScanner.parseOptionStringEx(s, ',');
    }

    if (inlineURL) {
      try {
        theURL = InlineURLConnection.createURL(inlineData, mimeType, encoding);
      } catch (Exception e) {
        throw new UnexpectedException(e);
      }
    }
  }

  /**
   * Returns whether the specified printable string points to an inline URL
   *
   * @param url a printable string representing a URL
   * @return true if the string points to an inline URL; false otherwise
   */
  public static boolean isInlineURL(SPOTPrintableString url) {
    String s = url.getValue();

    if (s == null) {
      return false;
    }

    if (s.startsWith("data:")) {
      return true;
    }

    s = url.spot_getAttribute("inline");

    if ((s != null) && (s.length() > 0)) {
      return SNumber.booleanValue(s);
    } else if (url.spot_isValuePreformatted()) {
      return true;
    }

    return false;
  }
}
