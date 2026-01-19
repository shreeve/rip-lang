package com.appnativa.spot;

import com.appnativa.util.CharArray;
import com.appnativa.util.CharScanner;
import com.appnativa.util.Env;
import com.appnativa.util.Helper;
import com.appnativa.util.io.StringWriterEx;
import com.appnativa.util.json.iJSONArray;
import com.appnativa.util.json.JSONBinary;
import com.appnativa.util.json.iJSONObject;
import com.appnativa.util.json.JSONWriter;

import java.io.Writer;
import java.util.List;
import java.util.Map;

/**
 * This class  generates JSON from a spot node
 *
 * @author Don DeCoteau
 */
public class SPOTJSONWriter {
  protected boolean addLinkedData = false;
  protected boolean addTypeInfo   = false;
  protected boolean addAttributes = false;
  protected String  linkedDataKey = "_linkedData";
  protected String  typeKey       = JSONBinary.CLASS_PROPERTY;
  protected String  valueKey      = "_value";
  private boolean trimLeadingSpacesForDefaultPreformatted;
  private boolean outputDefault;

  /**
   * Creates a write for writing clean JSON
   */
  public SPOTJSONWriter() {
  }

  /**
   * Creates a customizable writer
   * <p>
   * If all the parameters are true, then the resulting JSON
   * can for used as input to {@link com.appnativa.util.json.JSONStructuredNode}
   * </p>
   *
   * @param addLinkedData
   * @param addTypeInfo
   * @param addAttributes
   */
  public SPOTJSONWriter(boolean addLinkedData, boolean addTypeInfo, boolean addAttributes) {
    this.addLinkedData = addLinkedData;
    this.addTypeInfo = addTypeInfo;
    this.addAttributes = addAttributes;
  }

  public boolean isTrimLeadingSpacesForDefaultPreformatted() {
    return trimLeadingSpacesForDefaultPreformatted;
  }

  public void setTrimLeadingSpacesForDefaultPreformatted(boolean trimLeadingSpacesForDefaultPreformatted) {
    this.trimLeadingSpacesForDefaultPreformatted = trimLeadingSpacesForDefaultPreformatted;
  }

  public boolean isOutputDefault() {
    return outputDefault;
  }

  public void setOutputDefault(boolean outputDefault) {
    this.outputDefault = outputDefault;
  }

  /**
   * Creates a simple writer with only key and values
   *
   * @return the writer
   */
  public static SPOTJSONWriter createSimpleWriter() {
    return new SPOTJSONWriter();
  }

  /**
   * Creates a writer the writes all the information
   * needed to recreate a SPOT object from the data
   *
   * @return the writer
   */
  public static SPOTJSONWriter createStructuredNodeWriter() {
    return new SPOTJSONWriter(true, true, true);
  }

  /**
   * Creates a writer that adds linked data values the the simple format
   * to non SPOTSequence and SPOTSet objects.
   *
   * @return the writer
   */
  public static SPOTJSONWriter createSimpleWriterWithLinkedData() {
    return new SPOTJSONWriter(true, false, false);
  }

  public void toJSON(SPOTSequence sequence, Writer writer) {
    JSONWriter jw = new JSONWriter(writer);
    toJSON(sequence, jw);
  }

  public void toJSON(SPOTSequence node, JSONWriter json) {
    toJSON(node, json, false);
  }

  public void toJSON(SPOTSequence node, JSONWriter json, boolean embedded) {
    if (!embedded) {
      json.object();
    }
    if (addLinkedData && (addAttributes || addTypeInfo)) {
      Object ld = node.spot_getLinkedData();
      if (ld != null) {
        json.key("_linkedData").value(ld);
      }
    }
    List<iSPOTElement> list = node.spot_getElements();
    if (!list.isEmpty()) {
      for (iSPOTElement e : list) {
        if (e.spot_hasValue()) {
          if (outputDefault || e.spot_valueWasSet()) {
            json.key(e.spot_getName());
            toJSON(e, json);
          }
        }
      }
    }
    if (addAttributes) {
      addAttributes(node.spot_getAttributes(), json);
    }
    if (!embedded) {
      json.endObject();
    }
  }

  public void toJSON(SPOTSet node, Writer writer) {
    JSONWriter jw = new JSONWriter(writer);
    toJSON(node, jw);
  }

  public void toJSON(SPOTSet node, JSONWriter json) {
    boolean useObject = addTypeInfo;
    if (addAttributes && node.spot_hasAttributes()) {
      useObject=true;
    }
    if (useObject) {
      json.object();
      if (addLinkedData) {
        Object ld = node.spot_getLinkedData();
        if (ld != null) {
          json.key("_linkedData").value(ld);
        }
      }
    }
    List<iSPOTElement> list = node.unsafeGetObjectList();
    if (!list.isEmpty()) {
      if (useObject) {
        json.key("_value").array();
      } else {
        json.array();
      }
      for (iSPOTElement e : list) {
        toJSON(e, json);
      }
      json.endArray();
    }
    if (useObject) {
      if (addAttributes) {
        addAttributes(node.spot_getAttributes(), json);
      }
      json.endObject();
    }
  }

  public void toJSON(SPOTAny node, JSONWriter json) {
    json.object();
    Object ld = addLinkedData ? node.spot_getLinkedData() : null;
    if (ld != null) {
      json.key(linkedDataKey).value(ld);
    }
    iSPOTElement value = node.getValue();
    if(value == null) {
      json.key(typeKey).value(node._strDefinedBy);
    }
    else {
      json.key(typeKey).value(value.spot_getClassShortName());
    }
    if (value instanceof SPOTSequence) {
      toJSON((SPOTSequence) value, json, true);
    } else if (value != null) {
      json.key(valueKey);
      toJSON(value, json);
    }
    if (addAttributes) {
      addAttributes(node.spot_getAttributes(), json);
    }
    json.endObject();
  }

  public void addAttributes(Map map, JSONWriter json) {
    boolean ok = (map != null && !map.isEmpty());
    if (!ok) {
      return;
    }
    json.key("_attributes").object();
    for (Object o : map.entrySet()) {
      Map.Entry e = (Map.Entry) o;
      addAttribute((String) e.getKey(), e.getValue(), json);
    }
    json.endObject();
  }


  public void toJSON(iSPOTElement element, JSONWriter json) {
     Object o;
    switch (element.spot_getType()) {
      case iSPOTConstants.SPOT_TYPE_SEQUENCE:
        toJSON((SPOTSequence) element, json);
        return;
      case iSPOTConstants.SPOT_TYPE_SET:
        toJSON((SPOTSet) element, json);
        return;
      case iSPOTConstants.SPOT_TYPE_ANY:
        toJSON((SPOTAny) element, json);
        return;
      case iSPOTConstants.SPOT_TYPE_ENUMERATED:
        o = element.spot_stringValue();
        break;
      case iSPOTConstants.SPOT_TYPE_PRINTABLESTRING:
        o = element.spot_stringValue();
        if(trimLeadingSpacesForDefaultPreformatted) {
          SPOTPrintableString ps=(SPOTPrintableString) element;
          if(ps.spot_isValuePreformatted() && ps.spot_getPreformattedTag()==null) {
           o=CharScanner.trimLeadingSpaces((String)o);
          }
        }
        break;
      default:
        o = element.spot_getValue();
        break;
    }

    Object ld = addLinkedData ? element.spot_getLinkedData() : null;
    if (o instanceof iSPOTElement) {
      StringWriterEx sw = new StringWriterEx();
      JSONWriter     jw = new JSONWriter(sw);
      jw.object();
      toJSON((iSPOTElement) o, jw);
      jw.endObject();
      o = Env.createJSONObject(sw.toString());
    }
    if ((addAttributes && element.spot_hasAttributes()) || ld != null) {
      json.object();
      if (o != null) {
        json.key(valueKey).value(o);
      }
      if (ld != null) {
        json.key(linkedDataKey).value(ld);
      }
      if (addAttributes) {
        addAttributes(element.spot_getAttributes(), json);
      }
      json.endObject();
    } else {
      json.value(o);
    }
  }

  protected void addAttribute(String name, Object value, JSONWriter json) {
    json.key(name).value(value);
  }
}
