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

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Map.Entry;

/**
 * A linkedHashMap that causes a key to be removed if the put method
 * is called with a null value
 *
 * @author Don DeCoteau
 */
public class NoNullLinkedHashMap extends LinkedHashMap {
  public NoNullLinkedHashMap() {}

  public NoNullLinkedHashMap(int initialCapacity) {
    super(initialCapacity);
  }

  public NoNullLinkedHashMap(Map m) {
    super();
    putAll(m);
  }

  public NoNullLinkedHashMap(int initialCapacity, float loadFactor) {
    super(initialCapacity, loadFactor);
  }

  public NoNullLinkedHashMap(int initialCapacity, float loadFactor, boolean accessOrder) {
    super(initialCapacity, loadFactor, accessOrder);
  }

  public Object put(Object key, Object value) {
    if (value == null) {
      return remove(key);
    }

    return super.put(key, value);
  }

  @Override
  public void putAll(Map m) {
    if(m!=null) {
      Iterator<Entry> it = m.entrySet().iterator();
      while(it.hasNext()) {
        Entry e = it.next();
        Object o=e.getValue();
        if(o!=null) {
          super.put(e.getKey(),o);
        }
      }
      super.putAll(m);
    }
  }
}
