"use strict";
//
// mission-parser.js — frontmatter and body-section primitives for mission
// files. Hand-rolled YAML parser scoped to the mission schema (no anchors,
// no references, no multi-line scalars, no flow style except literal `[]`
// and `{}` for empty containers).
//
// Exports:
//   parseFrontmatter(text)              → { frontmatter, body }
//   serializeFrontmatter(frontmatter)   → string
//   extractBodySection(body, name)      → string | null
//   appendBodySection(body, name, content) → string
//
// Zero dependencies. The parser fails loudly on unsupported YAML so a
// mission that uses something exotic gets caught at read time rather than
// silently mis-parsed.
//

const FRONTMATTER_DELIM = "---";

// ─── Frontmatter splitting ──────────────────────────────────────────────────

// Split mission text into { frontmatter, body }. If the text doesn't open
// with a `---` line (after any leading blanks) or has no closing `---`,
// returns { frontmatter: {}, body: <original text> } — never throws on
// missing frontmatter, since some legitimately-malformed missions exist.
function parseFrontmatter(text) {
  if (typeof text !== "string") {
    throw new Error("parseFrontmatter: text must be a string");
  }
  const lines = text.split(/\r?\n/);

  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i >= lines.length || lines[i].trim() !== FRONTMATTER_DELIM) {
    return { frontmatter: {}, body: text };
  }
  const fmStart = i + 1;

  let fmEnd = -1;
  for (let j = fmStart; j < lines.length; j++) {
    if (lines[j].trim() === FRONTMATTER_DELIM) {
      fmEnd = j;
      break;
    }
  }
  if (fmEnd === -1) {
    return { frontmatter: {}, body: text };
  }

  const fmLines = lines.slice(fmStart, fmEnd);
  const bodyLines = lines.slice(fmEnd + 1);
  // Drop a single leading blank line from the body for cosmetic consistency
  // with how mission files are conventionally laid out.
  if (bodyLines.length > 0 && bodyLines[0] === "") bodyLines.shift();

  const frontmatter = parseMap(fmLines, 0, 0).result;
  return { frontmatter, body: bodyLines.join("\n") };
}

// ─── Reject unsupported YAML features ───────────────────────────────────────

// Returns true (silently) when the line is allowed; throws otherwise.
// Allowed flow style: `key: []` and `key: {}` only (used for empty containers
// so that round-trip stability holds for valid frontmatter that contains
// an empty array or object).
function rejectExotic(line, lineNum) {
  const allowedEmptyFlow = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*(\[\s*\]|\{\s*\})\s*$/;
  if (allowedEmptyFlow.test(line)) return;

  // Inline flow-style sequence with content: `key: [a, b]`
  if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*\[/.test(line)) {
    throw exoticError(
      "flow-style sequence (`[a, b]`). Use block style:\n"
    + "  key:\n"
    + "    - item\n"
    + "See docs/templates/mission-template.md for the supported YAML subset.",
      line, lineNum
    );
  }
  // Inline flow-style mapping with content: `key: {a: b}`
  if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*\{/.test(line)) {
    throw exoticError(
      "flow-style mapping (`{a: b}`). Use block style:\n"
    + "  key:\n"
    + "    a: b\n"
    + "See docs/templates/mission-template.md for the supported YAML subset.",
      line, lineNum
    );
  }
  // Anchor: `key: &anchor ...`
  if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*&/.test(line)) {
    throw exoticError("YAML anchor (`&name`)", line, lineNum);
  }
  // Reference: `key: *anchor`
  if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*\*/.test(line)) {
    throw exoticError("YAML reference (`*name`)", line, lineNum);
  }
  // Tag: `key: !!str foo` or `key: !Person ...`
  if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*!/.test(line)) {
    throw exoticError("YAML tag (`!!str`, `!Person`)", line, lineNum);
  }
  // Literal block scalar: `key: |`
  if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*\|\s*$/.test(line)) {
    throw exoticError("literal block scalar (`|`)", line, lineNum);
  }
  // Folded block scalar: `key: >`
  if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*>\s*$/.test(line)) {
    throw exoticError("folded block scalar (`>`)", line, lineNum);
  }
  // List items with anchor / reference / tag
  if (/^\s+-\s+[&*!]/.test(line)) {
    throw exoticError("list item with anchor/reference/tag", line, lineNum);
  }
}

function exoticError(featureName, line, lineNum) {
  return new Error(
    `mission-parser: unsupported YAML feature ${featureName} at line ${lineNum}: ${line.trimEnd()}`
  );
}

// ─── Block parsing ──────────────────────────────────────────────────────────

function leadingSpaces(line) {
  const m = line.match(/^( *)/);
  return m[1].length;
}

function isSkippable(line) {
  return line.trim() === "" || /^\s*#/.test(line);
}

// Parse a YAML mapping starting at lines[startLine], with all keys at baseIndent.
// Returns { result, nextLine: index of the first line NOT consumed by this map }.
function parseMap(lines, startLine, baseIndent) {
  const result = {};
  let i = startLine;

  while (i < lines.length) {
    const line = lines[i];
    if (isSkippable(line)) { i++; continue; }

    const indent = leadingSpaces(line);
    if (indent < baseIndent) {
      return { result, nextLine: i };
    }
    if (indent > baseIndent) {
      throw new Error(
        `mission-parser: unexpected indent at line ${i + 1}: expected ${baseIndent} spaces, got ${indent}: ${line.trimEnd()}`
      );
    }

    rejectExotic(line, i + 1);

    const m = line.match(/^( *)([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) {
      throw new Error(`mission-parser: unparseable line ${i + 1}: ${line.trimEnd()}`);
    }
    const key = m[2];
    const inline = m[3].trimEnd();

    if (inline === "[]") {
      result[key] = [];
      i++;
      continue;
    }
    if (inline === "{}") {
      result[key] = {};
      i++;
      continue;
    }
    if (inline !== "") {
      result[key] = parseScalar(inline);
      i++;
      continue;
    }

    // Block-form value: scan ahead.
    const block = parseBlock(lines, i + 1, baseIndent);
    result[key] = block.value;
    i = block.nextLine;
  }
  return { result, nextLine: i };
}

// Inspect lines starting at startLine and parse a block-form value (list or
// nested map). The value's children must indent further than parentIndent.
function parseBlock(lines, startLine, parentIndent) {
  let j = startLine;
  while (j < lines.length && isSkippable(lines[j])) j++;

  if (j >= lines.length) {
    return { value: null, nextLine: j };
  }

  const line = lines[j];
  const indent = leadingSpaces(line);
  if (indent <= parentIndent) {
    // No block content; the key carried no value.
    return { value: null, nextLine: startLine };
  }

  rejectExotic(line, j + 1);

  if (/^ +-(\s|$)/.test(line)) {
    return parseList(lines, j, indent);
  }
  const sub = parseMap(lines, j, indent);
  return { value: sub.result, nextLine: sub.nextLine };
}

function parseList(lines, startLine, indent) {
  const items = [];
  let i = startLine;

  while (i < lines.length) {
    const line = lines[i];
    if (isSkippable(line)) { i++; continue; }

    const lineIndent = leadingSpaces(line);
    if (lineIndent < indent) return { value: items, nextLine: i };
    if (lineIndent > indent) {
      throw new Error(
        `mission-parser: unexpected indent in list at line ${i + 1}: expected ${indent}, got ${lineIndent}: ${line.trimEnd()}`
      );
    }

    rejectExotic(line, i + 1);

    const m = line.match(/^ +-\s+(.*)$/);
    if (!m) {
      // empty `- ` — skip
      if (/^ +-\s*$/.test(line)) { i++; continue; }
      throw new Error(`mission-parser: expected list item at line ${i + 1}: ${line.trimEnd()}`);
    }

    items.push(parseScalar(m[1].trimEnd()));
    i++;
  }
  return { value: items, nextLine: i };
}

// ─── Scalar parsing ─────────────────────────────────────────────────────────

function parseScalar(raw) {
  if (raw === "" || raw === "~" || raw === "null") return null;

  // Double-quoted
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return decodeDoubleQuoted(raw.slice(1, -1));
  }
  // Single-quoted
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replace(/''/g, "'");
  }

  if (raw === "true") return true;
  if (raw === "false") return false;

  if (/^-?\d+$/.test(raw)) {
    const n = Number(raw);
    if (Number.isSafeInteger(n)) return n;
    return raw;
  }
  if (/^-?\d+\.\d+$/.test(raw)) return Number(raw);

  // Plain scalar (includes ISO dates — kept as strings for round-trip).
  return raw;
}

function decodeDoubleQuoted(inner) {
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\" && i + 1 < inner.length) {
      const next = inner[i + 1];
      switch (next) {
        case "n":  out += "\n"; i++; break;
        case "r":  out += "\r"; i++; break;
        case "t":  out += "\t"; i++; break;
        case "\\": out += "\\"; i++; break;
        case '"':  out += '"';  i++; break;
        case "'":  out += "'";  i++; break;
        default:   out += next; i++; break;
      }
      continue;
    }
    out += c;
  }
  return out;
}

// ─── Serialization ──────────────────────────────────────────────────────────

// Serialize a frontmatter object back to a YAML string. Round-trip stable:
// for any frontmatter object x produced by parseFrontmatter, the result of
// parseFrontmatter("---\n" + serializeFrontmatter(x) + "\n---\n").frontmatter
// deep-equals x.
function serializeFrontmatter(frontmatter) {
  if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
    throw new Error("serializeFrontmatter: argument must be a plain object");
  }
  const lines = [];
  for (const key of Object.keys(frontmatter)) {
    serializeKey(lines, key, frontmatter[key], 0);
  }
  return lines.join("\n");
}

function serializeKey(lines, key, value, indent) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`serializeFrontmatter: key "${key}" contains characters not supported by the parser`);
  }
  const pad = " ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${pad}${key}: []`);
      return;
    }
    lines.push(`${pad}${key}:`);
    for (const item of value) {
      if (Array.isArray(item) || (typeof item === "object" && item !== null)) {
        throw new Error(`serializeFrontmatter: list "${key}" contains a non-scalar item; the parser only supports scalar lists`);
      }
      lines.push(`${pad}  - ${serializeScalar(item)}`);
    }
    return;
  }

  if (value !== null && typeof value === "object") {
    if (indent > 0) {
      throw new Error(`serializeFrontmatter: nested objects more than one level deep are not supported (key: ${key})`);
    }
    const subKeys = Object.keys(value);
    if (subKeys.length === 0) {
      lines.push(`${pad}${key}: {}`);
      return;
    }
    lines.push(`${pad}${key}:`);
    for (const sk of subKeys) {
      serializeKey(lines, sk, value[sk], indent + 2);
    }
    return;
  }

  lines.push(`${pad}${key}: ${serializeScalar(value)}`);
}

function serializeScalar(v) {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      throw new Error(`serializeFrontmatter: cannot serialize non-finite number ${v}`);
    }
    return String(v);
  }
  if (typeof v === "string") {
    return needsQuoting(v) ? quoteDouble(v) : v;
  }
  throw new Error(`serializeFrontmatter: cannot serialize value of type ${typeof v}`);
}

function needsQuoting(s) {
  if (s === "") return true;
  // Reserved word lookalikes
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(s)) return true;
  // Number lookalikes
  if (/^-?\d+(\.\d+)?$/.test(s)) return true;
  // Special starts
  if (/^[\s'"!&*?\[\]{}|>%@`#\-]/.test(s)) return true;
  // Embedded ` #` (would start a comment), `:\s` (would be parsed as key:value),
  // trailing `:`
  if (/\s#/.test(s) || /:\s/.test(s) || /:$/.test(s)) return true;
  // Trailing or leading whitespace
  if (s !== s.trim()) return true;
  // Newlines or other control chars
  if (/[\r\n\t\0]/.test(s)) return true;
  return false;
}

function quoteDouble(s) {
  // Escape backslash, double quote, newline, carriage return, tab.
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

// ─── Body section helpers ───────────────────────────────────────────────────

// Locate a `## <name>` heading and return everything from the line after the
// heading up to the next `## ` heading (or EOF). Returns null when the named
// section is not present.
//
// `name` is matched verbatim against the heading text. Pass either "Workpad"
// or "## Workpad" — both work.
function extractBodySection(body, name) {
  if (typeof body !== "string") {
    throw new Error("extractBodySection: body must be a string");
  }
  const target = name.startsWith("#") ? name.replace(/^#+\s*/, "") : name;
  const lines = body.split(/\r?\n/);
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^##\s+(.+?)\s*$/);
    if (!headingMatch) continue;
    if (startIdx === -1 && headingMatch[1] === target) {
      startIdx = i + 1;
    } else if (startIdx !== -1) {
      endIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;
  return lines.slice(startIdx, endIdx).join("\n");
}

// Append `content` to the named section. Splices in immediately before the
// next `## ` heading (or at EOF if the section is the last one). Throws if
// the section is missing.
function appendBodySection(body, name, content) {
  if (typeof body !== "string") {
    throw new Error("appendBodySection: body must be a string");
  }
  if (typeof content !== "string") {
    throw new Error("appendBodySection: content must be a string");
  }
  const target = name.startsWith("#") ? name.replace(/^#+\s*/, "") : name;
  const lines = body.split(/\r?\n/);
  let headingIdx = -1;
  let nextHeadingIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^##\s+(.+?)\s*$/);
    if (!headingMatch) continue;
    if (headingIdx === -1 && headingMatch[1] === target) {
      headingIdx = i;
    } else if (headingIdx !== -1) {
      nextHeadingIdx = i;
      break;
    }
  }
  if (headingIdx === -1) {
    throw new Error(`appendBodySection: section "## ${target}" not found`);
  }

  const before = lines.slice(0, nextHeadingIdx).join("\n");
  const after = nextHeadingIdx < lines.length
    ? "\n" + lines.slice(nextHeadingIdx).join("\n")
    : "";
  return before + content + after;
}

module.exports = {
  parseFrontmatter,
  serializeFrontmatter,
  extractBodySection,
  appendBodySection,
};
