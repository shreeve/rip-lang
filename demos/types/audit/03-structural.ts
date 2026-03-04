// 03-structural.ts — TypeScript companion

// Basic structure
type Dimensions = {
  width: number;
  height: number;
};

// With optional properties
type Config = {
  host: string;
  port: number;
  ssl?: boolean;
  timeout?: number;
};

// Nested structures
type ResponseData = {
  items: string[];
  total: number;
};

type ResponseMeta = {
  page: number;
  limit: number;
  hasMore: boolean;
};

type ApiResponse = {
  data: ResponseData;
  meta: ResponseMeta;
};

// With readonly fields
type ImmutableConfig = {
  readonly host: string;
  readonly port: number;
  readonly ssl: boolean;
};

// Recursive type
type TreeNode = {
  value: string;
  children: TreeNode[];
};

// ── Use the types ──

const dim: Dimensions = { width: 800, height: 600 };
const cfg: Config = { host: "localhost", port: 3000 };
const fullCfg: Config = { host: "prod.example.com", port: 443, ssl: true, timeout: 5000 };

const resp: ApiResponse = {
  data: { items: ["a", "b"], total: 2 },
  meta: { page: 1, limit: 10, hasMore: false },
};

const frozen: ImmutableConfig = { host: "localhost", port: 3000, ssl: true };

const tree: TreeNode = {
  value: "root",
  children: [
    { value: "left", children: [] },
    { value: "right", children: [{ value: "deep", children: [] }] },
  ],
};

console.log("dimensions:", dim);
console.log("config:", cfg);
console.log("response items:", resp.data.items);
console.log("tree root:", tree.value);

// ── Negative: wrong types must be caught ──

// @ts-expect-error — missing required field (height)
const badDim: Dimensions = { width: 800 };
// @ts-expect-error — wrong field type
const badCfg: Config = { host: 123, port: 3000 };
// @ts-expect-error — extra unknown field
const badExtra: Dimensions = { width: 800, height: 600, depth: 100 };
// @ts-expect-error — nested wrong type
const badResp: ApiResponse = { data: { items: [1, 2], total: 2 }, meta: { page: 1, limit: 10, hasMore: false } };
