import { parseSync } from "@babel/core";

function stringValue(node) {
  return node?.type === "StringLiteral" ? node.value : undefined;
}

export function importsForSource(source, path = "source.ts") {
  const imports = [];
  const sourceFile = parseSync(source, {
    filename: path,
    parserOpts: {
      plugins: ["typescript", "jsx", "decorators-legacy", "importAttributes"],
      sourceType: "unambiguous",
    },
  });

  function visit(node) {
    if (node === null || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) {
        visit(child);
      }
      return;
    }
    if (
      node.type === "ImportDeclaration" ||
      node.type === "ExportNamedDeclaration" ||
      node.type === "ExportAllDeclaration"
    ) {
      const specifier = stringValue(node.source);
      if (specifier !== undefined) {
        imports.push(specifier);
      }
    } else if (
      node.type === "TSImportEqualsDeclaration" &&
      node.moduleReference?.type === "TSExternalModuleReference"
    ) {
      const specifier = stringValue(node.moduleReference.expression);
      if (specifier !== undefined) {
        imports.push(specifier);
      }
    } else if (node.type === "ImportExpression") {
      const specifier = stringValue(node.source);
      if (specifier !== undefined) {
        imports.push(specifier);
      }
    } else if (node.type === "CallExpression") {
      const isDynamicImport = node.callee?.type === "Import";
      const isRequire =
        node.callee?.type === "Identifier" && node.callee.name === "require";
      if (isDynamicImport || isRequire) {
        const specifier = stringValue(node.arguments[0]);
        if (specifier !== undefined) {
          imports.push(specifier);
        }
      }
    }
    for (const value of Object.values(node)) {
      visit(value);
    }
  }

  visit(sourceFile);
  return imports;
}
