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
    return espree.parse(text, { range: true, tokens: true, comment: true, ecmaVersion: 2019, sourceType:"module" });
}

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("TokenList", () => {

    describe("add()", () => {

        it("should add two tokens in a row with next()/previous() links", () => {
            const tokenList = new TokenList();
            const token1 = {
                type: "Foo",
                range: [0, 5]
            };
            const token2 = {
                type: "Bar",
                range: [5, 10]
            };

            tokenList.add(token1);
            tokenList.add(token2);

            expect(tokenList.first()).to.equal(token1);
            expect(tokenList.next(tokenList.first())).to.equal(token2);
            expect(tokenList.last()).to.equal(token2);
            expect(tokenList.previous(tokenList.last())).to.equal(token1);
        });
    });

    describe("delete()", () => {

        it("should delete token and remove from range maps when called", () => {
            const tokenList = new TokenList();
            const token1 = {
                type: "Foo",
                range: [0, 5]
            };
            const token2 = {
                type: "Bar",
                range: [5, 10]
            };

            tokenList.add(token1);
            tokenList.add(token2);
            tokenList.delete(token1);

            expect(tokenList.getByRangeStart(0)).to.be.undefined;
        });
    });

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
