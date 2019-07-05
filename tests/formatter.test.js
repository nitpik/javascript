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

    xdescribe("One-offs", () => {
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
