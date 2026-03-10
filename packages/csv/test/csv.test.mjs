import { describe, test, expect } from 'bun:test';
import { CSV } from '../csv.rip';

// =============================================================================
// Bug reproduction: quoted fields beyond the 8KB probe sample
// =============================================================================

describe('quoted fields beyond probe sample', () => {
  test('quoted field with comma is parsed correctly even when quotes appear late', () => {
    // Build a CSV where the first 8KB has NO quotes, then a quoted field appears
    const header = 'a,b,c,d\n';
    const plainRow = '1,2,3,4\n';
    const rowLen = plainRow.length;
    const rowsNeeded = Math.ceil(8192 / rowLen) + 5;
    let csv = header;
    for (let i = 0; i < rowsNeeded; i++) csv += plainRow;
    csv += 'x,"hello, world",y,z\n';

    const rows = CSV.read(csv);
    const lastRow = rows[rows.length - 1];
    expect(lastRow[1]).toBe('hello, world');
    expect(lastRow.length).toBe(4);
  });

  test('same test with excel+relax+strip options', () => {
    const header = 'a,b,c,d\n';
    const plainRow = '1,2,3,4\n';
    const rowLen = plainRow.length;
    const rowsNeeded = Math.ceil(8192 / rowLen) + 5;
    let csv = header;
    for (let i = 0; i < rowsNeeded; i++) csv += plainRow;
    csv += 'x,"hello, world",y,z\n';

    const rows = CSV.read(csv, { excel: true, relax: true, strip: true });
    const lastRow = rows[rows.length - 1];
    expect(lastRow[1]).toBe('hello, world');
    expect(lastRow.length).toBe(4);
  });
});

// =============================================================================
// Labcorp-style reproduction
// =============================================================================

describe('Labcorp-style CSV', () => {
  test('dx_codes field with comma is read correctly', () => {
    const raw = [
      'Req,Control,Accession,Account,Name,DX,Fasting,Date',
      '111,222,333,444,TestCo,"Z00.00, Z11.3",N,2026-02-09',
      '555,666,777,888,OtherCo,D64.9,,2026-02-09',
    ].join('\n') + '\n';

    const rows = CSV.read(raw, { excel: true, relax: true, strip: true });
    expect(rows[1][5]).toBe('Z00.00, Z11.3');
    expect(rows[1].length).toBe(8);
    expect(rows[2][5]).toBe('D64.9');
  });

  test('dx_codes round-trip preserves data', () => {
    const raw = [
      'Req,DX,Date',
      '111,"Z00.00, Z11.3",2026-02-09',
    ].join('\n') + '\n';

    const rows = CSV.read(raw, { excel: true, relax: true, strip: true });
    expect(rows[1][1]).toBe('Z00.00, Z11.3');

    const written = CSV.write(rows);
    const rows2 = CSV.read(written);
    expect(rows2[1][1]).toBe('Z00.00, Z11.3');
  });

  test('large file with late-appearing quoted fields', () => {
    const header = 'Req,Control,Accession,Account,Name,Last,First,DOB,Sex,Street,City,State,Zip,Phone,NPI,ProvLast,ProvFirst,Bill,DX,Fasting,Notes,ColDate,ColTime,RecDate,RecTime,RepDate,RepTime,TestCode,TestName,ResCode,ResName,Value,Units,Ref,Flag,Lab,Status\n';
    const plainRow = '111,222,333,444,TestCo,SMITH,JOHN,1990-01-01,M,123 Main St,Seattle,WA,98101,2065551234,1234567890,DOE,J,03,Z00.00,N,,2026-02-05,08:00:00,2026-02-06,03:00:00,2026-02-09,12:00:00,001321,Iron,001339,Iron,100,ug/dL,27-159,,PDLCA,F\n';

    let csv = header;
    for (let i = 0; i < 30; i++) csv += plainRow;
    csv += '999,888,777,666,TestCo,DOE,JANE,1985-05-15,F,456 Oak Ave,Portland,OR,97201,5035551234,9876543210,WONG,K,03,"Z13.29, R79.89",,,2026-02-05,08:48:00,2026-02-06,03:01:00,2026-02-09,19:08:00,006684,Thyroid Antibodies,006706,Thyroglobulin Antibody,72.1,IU/mL,0.0-0.9,H,SPOWA,F\n';

    const rows = CSV.read(csv, { excel: true, relax: true, strip: true });
    const lastRow = rows[rows.length - 1];
    expect(lastRow[18]).toBe('Z13.29, R79.89');
    expect(lastRow.length).toBe(37);
  });
});

// =============================================================================
// Reader: quote handling
// =============================================================================

describe('Reader: quote handling', () => {
  test('simple quoted field', () => {
    const rows = CSV.read('"hello",world\n');
    expect(rows[0][0]).toBe('hello');
  });

  test('quoted field with comma', () => {
    const rows = CSV.read('a,"b,c",d\n');
    expect(rows[0][1]).toBe('b,c');
  });

  test('doubled-quote escape', () => {
    const rows = CSV.read('"say ""hello""",b\n');
    expect(rows[0][0]).toBe('say "hello"');
  });

  test('quoted field with newline', () => {
    const rows = CSV.read('"line1\nline2",b\n');
    expect(rows[0][0]).toBe('line1\nline2');
  });

  test('Mr. Bean example', () => {
    const rows = CSV.read('"Hello, ""Mr. Bean"" -- good to see you!",ok\n');
    expect(rows[0][0]).toBe('Hello, "Mr. Bean" -- good to see you!');
  });

  test('empty quoted field', () => {
    const rows = CSV.read('"",b\n');
    expect(rows[0][0]).toBe('');
  });
});

// =============================================================================
// Writer: escaping
// =============================================================================

describe('Writer: escaping', () => {
  test('value with comma gets quoted', () => {
    const out = CSV.write([['a,b', 'c']]);
    expect(out).toBe('"a,b",c\n');
  });

  test('value with quotes gets escaped and quoted', () => {
    const out = CSV.write([['say "hi"', 'ok']]);
    expect(out).toBe('"say ""hi""",ok\n');
  });

  test('value with comma AND quotes gets both treatments', () => {
    const out = CSV.write([['hello, "world"', 'ok']]);
    expect(out).toBe('"hello, ""world""",ok\n');
  });

  test('value with newline gets quoted', () => {
    const out = CSV.write([['line1\nline2', 'ok']]);
    expect(out).toBe('"line1\nline2",ok\n');
  });

  test('plain values are not quoted', () => {
    const out = CSV.write([['hello', 'world']]);
    expect(out).toBe('hello,world\n');
  });
});

// =============================================================================
// Round-trip fidelity
// =============================================================================

describe('round-trip', () => {
  test('plain CSV', () => {
    const input = 'a,b,c\n1,2,3\n';
    expect(CSV.write(CSV.read(input))).toBe(input);
  });

  test('CSV with quoted fields', () => {
    const input = 'name,desc,val\nAlice,"likes, commas",1\n';
    const rows = CSV.read(input);
    expect(rows[1][1]).toBe('likes, commas');
    const written = CSV.write(rows);
    const rows2 = CSV.read(written);
    expect(rows2[1][1]).toBe('likes, commas');
  });

  test('CSV with escaped quotes', () => {
    const rows = CSV.read('"say ""hello""",ok\n');
    expect(rows[0][0]).toBe('say "hello"');
    const written = CSV.write(rows);
    expect(written).toBe('"say ""hello""",ok\n');
    const rows2 = CSV.read(written);
    expect(rows2[0][0]).toBe('say "hello"');
  });
});
