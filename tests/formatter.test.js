/**
 * @fileoverview Tests for formatter
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { Formatter } from "../src/formatter.js";
import fs from "fs";
import path from "path";
import chai from "chai";

const expect = chai.expect;

//-----------------------------------------------------------------------------
// Formatter Configs
//-----------------------------------------------------------------------------

const baseConfig = {
    layout: {
        options: {

        },
        tasks: [
        ]
    }
};

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("Formatter", () => {

    describe("Plugins", () => {
        
        it("should run plugin when specified", () => {
            
            const formatter = new Formatter({
                options: {
                    maxEmptyLines: 2
                },
                plugins: [

                    // insert a line break at end of input
                    function(context) {
                        return {
                            ExpressionStatement(node) {
                                const last = context.layout.lastToken(node);
                                const semi = context.layout.nextToken(last);
                                context.layout.lineBreakAfter(semi);
                            }
                        };
                    }
                ]
            });

            const result = formatter.format("a;");
            expect(result).to.deep.equal("a;\n");
        });

        it("should not run plugins when plugin array is empty", () => {
            
            const formatter = new Formatter({
                options: {
                    maxEmptyLines: 2
                },
                plugins: []
            });

            const result = formatter.format("a;");
            expect(result).to.deep.equal("a;");
        });

    });

    describe("One-offs", () => {
        it("should not add a semicolon after last export", () => {
            const source = `
a(\`hello \${
world
}\`);
`.trim();
            const expected = `
a(\`hello \${
    world
}\`);
`.trim();
            const formatter = new Formatter({
                options: {
                    maxEmptyLines: 2
                }
            });
            const result = formatter.format(source);
            expect(result).to.deep.equal(expected);

        });
    });

    describe("fixtures", () => {
        const formatterFixturesPath = "./tests/fixtures/formatter";
        fs.readdirSync(formatterFixturesPath).forEach(fileName => {
            
            const filePath = path.join(formatterFixturesPath, fileName);
            const contents = fs.readFileSync(filePath, "utf8").replace(/\r/g, "");
            const [ options, source, expected ] = contents.trim().split("\n---\n");
            
            it(`Test in ${ fileName } should format correctly`, () => {
                const formatter = new Formatter({
                    options: JSON.parse(options)
                });
                const result = formatter.format(source);
                expect(result.replace(/ /g, "\u00b7")).to.deep.equal(expected.replace(/ /g, "\u00b7"));
            });
        });
    });

});
