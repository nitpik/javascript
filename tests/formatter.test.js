/**
 * @fileoverview Tests for formatter
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

const { Formatter } = require("../");
const fs = require("fs");
const path = require("path");
const { expect } = require("chai");

//-----------------------------------------------------------------------------
// Formatter Configs
//-----------------------------------------------------------------------------

const baseConfig = {
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
                            layout.spaceBefore(node.argument);
                        } else {
                            layout.noSpaceAfter(node);
                        }

                        layout.semicolonAfter(node);
                    },
                    Property(node) {

                        // ensure there's a space after the colon in properties
                        if (!node.shorthand && !node.method) {
                            layout.spaceBefore(node.value);
                            layout.noSpaceAfter(node.key);
                        }

                        if (node.method) {
                            layout.spaceBefore(node.value.body);
                        }
                    }
                };
            }
        }
    ]
};

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("Formatter", () => {

    describe("fixtures", () => {
        const formatterFixturesPath = "./tests/fixtures/formatter";
        fs.readdirSync(formatterFixturesPath).forEach(fileName => {
            
            const filePath = path.join(formatterFixturesPath, fileName);
            const contents = fs.readFileSync(filePath, "utf8").replace(/\r/g, "");
            const separatorIndex = contents.indexOf("---");
            const formatter = new Formatter(baseConfig);

            it(`Test in ${ fileName } should format correctly`, () => {
                const source = contents.slice(0, separatorIndex).trim();
                const expected = contents.slice(separatorIndex + 4).trim();
                const result = formatter.format(source);
                expect(result).to.deep.equal(expected);
            });
        });
    });

});
