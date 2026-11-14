/**
 * Ensures every identifier referenced in LabWorkspaceGrid.tsx body is bound
 * (destructured slice field, import, or local declaration). Fails on unbound refs.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gridPath = path.join(__dirname, "../src/thinking-lab/page/shells/LabWorkspaceGrid.tsx");
const src = fs.readFileSync(gridPath, "utf8");
const sf = ts.createSourceFile(gridPath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const importNames = new Set();
const localBindings = new Set();
let gridFunction = null;

function collectBinding(nameNode) {
  if (ts.isIdentifier(nameNode)) localBindings.add(nameNode.text);
  else if (ts.isObjectBindingPattern(nameNode)) {
    for (const el of nameNode.elements) {
      if (ts.isBindingElement(el)) collectBinding(el.name);
    }
  }
}

function visitTop(node) {
  if (ts.isFunctionDeclaration(node) && node.name) localBindings.add(node.name.text);
  if (ts.isImportDeclaration(node) && node.importClause) {
    if (node.importClause.name) importNames.add(node.importClause.name.text);
    if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const spec of node.importClause.namedBindings.elements) {
        importNames.add(spec.name.text);
      }
    }
  }
  if (ts.isFunctionDeclaration(node) && node.name?.text === "LabWorkspaceGrid") {
    gridFunction = node;
  }
  ts.forEachChild(node, visitTop);
}
visitTop(sf);

if (!gridFunction) {
  console.error("LabWorkspaceGrid function not found");
  process.exit(1);
}

for (const param of gridFunction.parameters) collectBinding(param.name);

function collectLocals(node) {
  if (ts.isVariableDeclaration(node) && node.name) collectBinding(node.name);
  if (ts.isParameter(node) && node.name) collectBinding(node.name);
  ts.forEachChild(node, collectLocals);
}
if (gridFunction.body) collectLocals(gridFunction.body);

const globals = new Set([
  "undefined",
  "null",
  "true",
  "false",
  "NaN",
  "Infinity",
  "Object",
  "Array",
  "Map",
  "Set",
  "String",
  "Number",
  "Boolean",
  "Promise",
  "void",
  "typeof",
  "instanceof",
  "console",
  "Math",
  "Date",
  "JSON",
  "Error",
]);

const unbound = new Set();
const body = gridFunction.body;

function checkId(node) {
  if (!ts.isIdentifier(node)) return;
  if (node.parent && ts.isJsxOpeningElement(node.parent) && node.parent.tagName === node) return;
  if (node.parent && ts.isJsxSelfClosingElement(node.parent) && node.parent.tagName === node) return;
  if (node.parent && ts.isJsxClosingElement(node.parent) && node.parent.tagName === node) return;
  if (node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) return;
  if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node) return;
  if (node.parent && ts.isBindingElement(node.parent) && node.parent.name === node) return;
  if (node.parent && ts.isObjectBindingPattern(node.parent)) return;
  if (node.parent && ts.isJsxAttribute(node.parent)) return;
  const name = node.text;
  if (globals.has(name)) return;
  if (importNames.has(name)) return;
  if (localBindings.has(name)) return;
  if (name === "props") return;
  unbound.add(name);
}

function walk(node) {
  if (ts.isIdentifier(node)) checkId(node);
  ts.forEachChild(node, walk);
}
if (gridFunction.body) walk(gridFunction.body);

if (unbound.size > 0) {
  console.error("Unbound identifiers in LabWorkspaceGrid:");
  for (const name of [...unbound].sort()) console.error("  -", name);
  process.exit(1);
}
console.log("OK: no unbound identifiers (" + localBindings.size + " local bindings, " + importNames.size + " imports)");