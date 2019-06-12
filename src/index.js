

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { Layout } from "./layout.js";
import { parse } from "espree";
import fs from "fs";

//-----------------------------------------------------------------------------
// Main
//-----------------------------------------------------------------------------

const text = fs.readFileSync("./.eslintrc.js", "utf8");
const ast = parse(text, { ecmaVersion: 2018, range: true, comment: true, tokens: true });
const layout = new Layout({ast, text}, { indent: 2 });



console.log(layout.toString());
