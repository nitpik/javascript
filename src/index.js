

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { Formatter } from "./formatter.js";
import fs from "fs";

//-----------------------------------------------------------------------------
// Main
//-----------------------------------------------------------------------------

const text = fs.readFileSync("./tests/fixtures/example1.js", "utf8");
const formatter = new Formatter({
    plugins: [
        {
            type: "layout",
            run({ layout }) {
                return {
                    ArrayExpression(node) {
                        if (node.loc.start.line === node.loc.end.line) {
                            if (node.elements.length) {
                                
                                node.elements.forEach(element => {
                                    layout.spaceBefore(element);
                                    layout.noSpaceAfter(element);
                                });

                                layout.spaceAfter(node.elements[node.elements.length - 1]);
                            }
                        }
                    },
                    ReturnStatement(node) {
                        if (node.argument) {
                            layout.spaceAfter(node);
                        } else {
                            layout.noSpaceAfter(node);
                        }
                    },
                    Property(node) {

                        // ensure there's a space after the colon in properties
                        if (!node.shorthand && !node.method) {
                            layout.spaceBefore(node.value);
                            layout.noSpaceAfter(node.key);
                        }
                    }
                };
            }
        }
    ]
});




console.log(formatter.format(text));
