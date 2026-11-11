import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function worker(pdf: Record<string, unknown>, document: Record<string, unknown> = {}) {
  const source = readFileSync('supabase/functions/process-payslip-batch/index.ts', 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/Deno\.serve\([\s\S]*$/, '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function('pdfjs', 'PDFDocument', `${js}\nreturn runBatch;`)(pdf, document);
}

function database(batch: Record<string, unknown>, insertionError: unknown = null, stopAfterRead = false) {
  const updates: Array<Record<string, unknown>> = [];
  const download = vi.fn(async () => ({ data: { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }, error: null }));
  const insert = vi.fn(async () => ({ error: insertionError }));
  let reads = 0;
  const admin = {
    storage: { from: () => ({ download }) },
    from: (table: string) => {
      let value: Record<string, unknown> | null = null;
      const query: Record<string, any> = {
        select: () => query,
        update: (fields: Record<string, unknown>) => { value = fields; return query; },
        eq: () => query,
        single: async () => ({ data: batch, error: null }),
        maybeSingle: async () => ({ data: { status: stopAfterRead && ++reads > 0 ? 'failed' : batch.status }, error: null }),
        insert,
        then: (resolve: (value: unknown) => void) => {
          if (value) updates.push(value);
          resolve(table === 'employee_personal_data' ? { data: [], error: null } : { count: 0, data: [], error: null });
        },
      };
      return query;
    },
  };
  return { admin, download, insert, updates };
}

const batch = { status: 'processing', original_file_path: 'sources/test.pdf', month: 10, year: 2026 };
const pdf = {
  getDocument: () => ({ promise: Promise.resolve({
    numPages: 1,
    getPage: async () => ({
      getViewport: () => ({ width: 800, height: 800 }),
      getTextContent: async () => ({ items: [
        { str: 'LUNA : 10.2026', transform: [1, 0, 0, 1, 10, 780] },
        { str: '99999 - TEST VERIFICARE', transform: [1, 0, 0, 1, 10, 760] },
      ] }),
    }),
  }) }),
};

describe('background payslip failure handling', () => {
  it('marks an old batch without a PDF failed instead of keeping it processing', async () => {
    const db = database({ ...batch, original_file_path: null });
    await worker({})(db.admin, 'id', 'https://example.test', 'test-key');
    expect(db.download).not.toHaveBeenCalled();
    expect(db.updates[db.updates.length - 1]).toMatchObject({ status: 'failed', phase: 'failed' });
  });

  it('makes a PDF parsing error terminal until an explicit retry', async () => {
    const db = database(batch);
    const getDocument = vi.fn(() => { throw new Error('Invalid PDF'); });
    await worker({ getDocument })(db.admin, 'id', 'https://example.test', 'test-key');
    expect(getDocument).toHaveBeenCalled();
    expect(db.updates[db.updates.length - 1]).toMatchObject({ status: 'failed', phase: 'failed' });
  });

  it('makes an insertion error terminal instead of auto-pausing forever', async () => {
    const db = database(batch, { message: 'Insert rejected' });
    await worker(pdf, { load: async () => ({}) })(db.admin, 'id', 'https://example.test', 'test-key');
    expect(db.insert).toHaveBeenCalled();
    expect(db.updates[db.updates.length - 1]).toMatchObject({ status: 'failed', phase: 'failed' });
  });

  it('stops a cancelled worker without adding slips or marking it ready', async () => {
    const db = database(batch, null, true);
    const load = vi.fn(async () => ({}));
    await worker(pdf, { load })(db.admin, 'id', 'https://example.test', 'test-key');
    expect(db.insert).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalled();
    expect(db.updates.some(value => value.status === 'ready')).toBe(false);
  });
});