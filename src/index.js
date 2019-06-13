

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { Formatter } from "./formatter.js";
import { parse } from "espree";
import fs from "fs";

//-----------------------------------------------------------------------------
// Main
//-----------------------------------------------------------------------------

const text = fs.readFileSync("./.eslintrc.js", "utf8");
const formatter = new Formatter({
    plugins: [
        {
            type: "layout",
            run({ ast, text, layout }) {
                console.log("yo")
                return {
                    Literal(node) {
                        console.log("HERE");
                        if (typeof node.value === "string") {
                            layout.spaceAfter(node);
                        }
                    }
                };
            }
        }
    ]
});




console.log(formatter.format(text));
