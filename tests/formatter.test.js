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
            const source = "export { bing} from \"bar\" ;";
            const formatter = new Formatter({
                layout: {
                },
                tasks: []
            });
            const result = formatter.format(source);
            expect(result).to.deep.equal("export { bing } from \"bar\";");

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
                    layout: {
                        options: JSON.parse(options)
                    },
                    tasks: []
                });
                const result = formatter.format(source);
                expect(result).to.deep.equal(expected);
            });
        });
    });

});