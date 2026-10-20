import fs from "node:fs";

const path = "src/css/redesign.css";
const source = fs.readFileSync(path, "utf8");
const css = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
const pairs = { "{": "}", "(": ")", "[": "]" };
const closing = new Map(Object.entries(pairs).map(([open, close]) => [close, open]));
const stack = [];
for (let i = 0; i < css.length; i += 1) {
  const character = css[i];
  if (pairs[character]) stack.push({ character, index: i });
  if (closing.has(character)) {
    const previous = stack.pop();
    if (!previous || previous.character !== closing.get(character)) {
      throw new Error(`Delimitador CSS incompatível na posição ${i}.`);
    }
  }
}
if (stack.length) throw new Error(`Delimitador CSS não fechado: ${stack.at(-1).character}.`);

const breakpoints = [
  "(max-width: 420px)",
  "(min-width: 681px) and (max-width: 989px)",
  "(min-width: 990px) and (max-width: 1199px)",
  "(min-width: 1200px)",
  "(min-width: 1600px)",
];
const missing = breakpoints.filter((value) => !source.includes(value));
if (missing.length) throw new Error(`Media queries ausentes: ${missing.join(", ")}`);
console.log(JSON.stringify({ path, syntaxStructure: "balanced", breakpointCount: breakpoints.length }));
