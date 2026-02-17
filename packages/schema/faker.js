// =============================================================================
// faker.js — Compact, zero-dependency fake data generator for Rip Schema
//
// Field-name aware: "name" → person name, "city" → city, "email" → email
// Type-aware fallback: string → words, integer → bounded random, etc.
// Sequential: unique fields get seq suffixes for guaranteed uniqueness
// =============================================================================

// -- Seed data ----------------------------------------------------------------

const FIRST = [
  'Alice', 'Bob', 'Charlie', 'Dana', 'Eve', 'Frank', 'Grace', 'Hank',
  'Ivy', 'Jack', 'Kate', 'Leo', 'Mia', 'Nate', 'Olive', 'Paul',
  'Quinn', 'Rose', 'Sam', 'Tara', 'Uma', 'Vic', 'Wendy', 'Xander',
  'Yuki', 'Zara', 'Aiden', 'Blake', 'Clara', 'Derek', 'Emma', 'Finn',
];

const LAST = [
  'Adams', 'Brown', 'Clark', 'Davis', 'Evans', 'Foster', 'Garcia', 'Harris',
  'Irving', 'Jones', 'Kim', 'Lee', 'Miller', 'Nelson', 'Owens', 'Park',
  'Quinn', 'Reed', 'Smith', 'Taylor', 'Upton', 'Vega', 'Wang', 'Young',
  'Zhang', 'Bell', 'Cruz', 'Diaz', 'Ellis', 'Fox', 'Grant', 'Hayes',
];

const COMPANY = [
  'Acme', 'Apex', 'Atlas', 'Beacon', 'Bloom', 'Bolt', 'Bridge', 'Catalyst',
  'Cedar', 'Cobalt', 'Crest', 'Dawn', 'Echo', 'Ember', 'Fable', 'Forge',
  'Haven', 'Helix', 'Horizon', 'Ivory', 'Jade', 'Lumen', 'Maple', 'Nova',
  'Onyx', 'Orbit', 'Peak', 'Pine', 'Prism', 'Pulse', 'Quill', 'Rift',
];

const COMPANY_SUFFIX = [
  'Inc', 'Co', 'Labs', 'Corp', 'Group', 'Studio', 'Systems', 'Tech',
  'Digital', 'IO', 'HQ', 'Works',
];

const CITY = [
  'Austin', 'Berlin', 'Boulder', 'Boston', 'Chicago', 'Denver', 'Dublin',
  'Helsinki', 'London', 'Miami', 'Montreal', 'Nashville', 'Oslo', 'Paris',
  'Portland', 'Raleigh', 'Seattle', 'Sydney', 'Tokyo', 'Toronto', 'Vancouver',
  'Vienna', 'Zurich', 'Amsterdam', 'Barcelona', 'Copenhagen', 'Lisbon', 'Milan',
];

const STREET_SUFFIX = [
  'St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Ct', 'Pl', 'Rd', 'Cir',
];

const STREET_NAME = [
  'Main', 'Oak', 'Pine', 'Maple', 'Cedar', 'Elm', 'Park', 'Lake',
  'Hill', 'River', 'Spring', 'Sunset', 'Highland', 'Valley', 'Forest',
  'Meadow', 'Ridge', 'Brook', 'Willow', 'Birch', 'Aspen', 'Harbor',
];

const STATE = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const DOMAIN = [
  'example.com', 'test.io', 'demo.dev', 'acme.co', 'sample.org',
  'staging.app', 'dev.net', 'local.host',
];

const WORD = [
  'alpha', 'beta', 'gamma', 'delta', 'quick', 'bright', 'calm', 'deep',
  'eager', 'fair', 'gentle', 'happy', 'ideal', 'just', 'keen', 'lively',
  'modern', 'noble', 'open', 'pure', 'rapid', 'sharp', 'true', 'vivid',
  'warm', 'zeal', 'bold', 'clear', 'fresh', 'grand', 'light', 'prime',
];

const TITLE_ADJ = [
  'Ultimate', 'Complete', 'Essential', 'Modern', 'Advanced', 'Simple',
  'Practical', 'Definitive', 'Quick', 'Comprehensive', 'Elegant', 'Powerful',
];

const TITLE_NOUN = [
  'Guide', 'Approach', 'Framework', 'Strategy', 'Overview', 'Introduction',
  'Deep Dive', 'Walkthrough', 'Blueprint', 'Handbook', 'Primer', 'Manifesto',
];

const TITLE_TOPIC = [
  'API Design', 'Web Performance', 'Clean Code', 'System Architecture',
  'Data Modeling', 'User Experience', 'Cloud Infrastructure', 'DevOps',
  'Type Safety', 'Schema Design', 'Functional Programming', 'Microservices',
];

const LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
  'Curabitur pretium tincidunt lacus, nec dignissim arcu suscipit sit amet.',
  'Praesent commodo cursus magna, vel scelerisque nisl consectetur et.',
  'Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor.',
  'Maecenas faucibus mollis interdum, sed posuere consectetur est at lobortis.',
  'Nullam quis risus eget urna mollis ornare vel eu leo.',
];

// -- Helpers ------------------------------------------------------------------

const pick  = (arr)    => arr[Math.floor(Math.random() * arr.length)];
const range = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

let _seq = 0;
function seq() { return ++_seq; }
function resetSeq() { _seq = 0; }

// -- Generators ---------------------------------------------------------------

const gen = {
  firstName:  ()  => pick(FIRST),
  lastName:   ()  => pick(LAST),
  fullName:   ()  => `${pick(FIRST)} ${pick(LAST)}`,
  email:      (s) => `${pick(FIRST).toLowerCase()}${s}@${pick(DOMAIN)}`,
  username:   (s) => `${pick(FIRST).toLowerCase()}${s}`,
  phone:      ()  => `${range(200,999)}-${range(100,999)}-${range(1000,9999)}`,
  company:    ()  => `${pick(COMPANY)} ${pick(COMPANY_SUFFIX)}`,
  domain:     (s) => `${pick(COMPANY).toLowerCase()}${s}.${pick(['com','io','dev','co','org'])}`,
  url:        (s) => `https://${pick(COMPANY).toLowerCase()}${s}.${pick(['com','io','dev'])}`,
  street:     ()  => `${range(100,9999)} ${pick(STREET_NAME)} ${pick(STREET_SUFFIX)}`,
  city:       ()  => pick(CITY),
  state:      ()  => pick(STATE),
  zip:        ()  => `${range(10000,99999)}`,
  country:    ()  => 'US',
  title:      (s) => `The ${pick(TITLE_ADJ)} ${pick(TITLE_NOUN)} to ${pick(TITLE_TOPIC)}`,
  slug:       (s) => `${pick(WORD)}-${pick(WORD)}-${pick(WORD)}-${s}`,
  bio:        ()  => `${pick(LOREM)} ${pick(LOREM)}`,
  paragraph:  ()  => LOREM.slice(0, range(2, 5)).join(' '),
  paragraphs: ()  => LOREM.slice(0, range(3, 8)).join('\n\n'),
  word:       ()  => pick(WORD),
  words:      (n) => Array.from({ length: n || range(3, 6) }, () => pick(WORD)).join(' '),
  sentence:   ()  => pick(LOREM),
  boolean:    ()  => Math.random() > 0.5,
  integer:    (lo = 0, hi = 1000) => range(lo, hi),
  float:      (lo = 0, hi = 1000) => lo + Math.random() * (hi - lo),
  datetime:   ()  => new Date(Date.now() - Math.floor(Math.random() * 90 * 86400000)).toISOString(),
  pastDate:   ()  => new Date(Date.now() - Math.floor(Math.random() * 365 * 86400000)).toISOString(),
  futureDate: ()  => new Date(Date.now() + Math.floor(Math.random() * 365 * 86400000)).toISOString(),
  ip:         ()  => `${range(1,255)}.${range(0,255)}.${range(0,255)}.${range(1,254)}`,
  hex:        (n) => Array.from({ length: n || 16 }, () => range(0,15).toString(16)).join(''),
  avatar:     (s) => `https://i.pravatar.cc/150?u=${s}`,
};

// -- Field-name hinting -------------------------------------------------------
// Maps common field name patterns → generator functions

const NAME_HINTS = [
  [/^first.?name$/i,              (s) => gen.firstName()],
  [/^last.?name$/i,               (s) => gen.lastName()],
  [/^(full.?)?name$/i,            (s) => gen.fullName()],
  [/^e.?mail$/i,                  (s) => gen.email(s)],
  [/^user.?name$/i,               (s) => gen.username(s)],
  [/^(phone|mobile|cell)$/i,      ()  => gen.phone()],
  [/^(company|org|organization)$/i, () => gen.company()],
  [/^domain$/i,                   (s) => gen.domain(s)],
  [/^(url|website|homepage)$/i,   (s) => gen.url(s)],
  [/^(avatar|image|photo|picture)$/i, (s) => gen.avatar(s)],
  [/^(street|address)$/i,         ()  => gen.street()],
  [/^city$/i,                     ()  => gen.city()],
  [/^(state|province|region)$/i,  ()  => gen.state()],
  [/^(zip|postal|postcode)$/i,    ()  => gen.zip()],
  [/^country$/i,                  ()  => gen.country()],
  [/^title$/i,                    (s) => gen.title(s)],
  [/^slug$/i,                     (s) => gen.slug(s)],
  [/^(bio|about|summary)$/i,     ()  => gen.bio()],
  [/^(excerpt|blurb)$/i,         ()  => gen.sentence()],
  [/^(body|content|description|text)$/i, () => gen.paragraphs()],
  [/^(token|api.?key)$/i,        ()  => gen.hex(32)],
  [/^ip/i,                        ()  => gen.ip()],
  [/^password$/i,                 ()  => gen.hex(20)],
];

// -- Main API -----------------------------------------------------------------

export class Fake {
  /**
   * Generate a value for a field by name + type + constraints.
   *
   * @param {string} fieldName  - The field name (used for hinting)
   * @param {object} fieldDef   - { type, min, max, required, unique, default }
   * @param {number} seq        - Sequence number for uniqueness
   * @param {Set}    [enumVals] - Enum values if field type is an enum
   * @returns {*}
   */
  static value(fieldName, fieldDef, seq, enumVals) {
    // Enum → random pick
    if (enumVals) {
      const vals = [...enumVals];
      return vals[Math.floor(Math.random() * vals.length)];
    }

    // Try field-name hinting first
    for (const [pattern, fn] of NAME_HINTS) {
      if (pattern.test(fieldName)) return fn(seq);
    }

    // Fall back to type-based generation
    const min = fieldDef.min ?? 0;
    const max = fieldDef.max ?? 100;
    switch (fieldDef.type) {
      case 'string':   return gen.words(range(2, 4));
      case 'email':    return gen.email(seq);
      case 'text':     return gen.paragraph();
      case 'integer':  return gen.integer(min, max);
      case 'float': case 'decimal': case 'number':
                       return gen.float(min, max);
      case 'boolean':  return gen.boolean();
      case 'datetime': return gen.datetime();
      default:         return gen.words(2);
    }
  }

  // Expose individual generators for custom fakers
  static get gen() { return gen; }
  static seq()     { return seq(); }
  static resetSeq(){ resetSeq(); }
  static pick(arr) { return pick(arr); }
}
