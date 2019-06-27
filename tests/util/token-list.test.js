/**
 * @fileoverview Tests for formatter
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { TokenList } from "../../src/util/token-list.js";
import fs from "fs";
import path from "path";
import chai from "chai";
import espree from "espree";

const expect = chai.expect;

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

function parse(text) {
    return espree.parse(text, { range: true, tokens: true, comment: true, ecmaVersion: 2019 });
}

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe.only("TokenList", () => {

    describe("fixtures", () => {
        const tokenListFixturesPath = "./tests/fixtures/token-list";
        fs.readdirSync(tokenListFixturesPath).forEach(fileName => {
            
            const filePath = path.join(tokenListFixturesPath, fileName);
            const contents = fs.readFileSync(filePath, "utf8").replace(/\r/g, "");
            const [ options, source, expected ] = contents.trim().split("\n---\n");
            
            it(`Test in ${ fileName } should represent tokens correctly`, () => {
                const ast = parse(source);
                const tokenList = TokenList.fromAST(ast, source, JSON.parse(options));
                
                expect([...tokenList]).to.deep.equal(JSON.parse(expected));
            });
        });
    });

});
