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

    describe("findPreviousIndent()", () => {

        it("should find no previous indent when token has no indent", () => {
            const parts = [
                { type: "Keyword", value: "const", range: [0, 5] },
                { type: "Whitespace", value: " ", range: [5, 6] },
                { type: "Identifier", value: "a", range: [6, 7] },
                { type: "Whitespace", value: " ", range: [7, 8] },
                { type: "Punctuator", value: "=", range: [8, 9] },
                { type: "Whitespace", value: " ", range: [9, 10] },
                { type: "Punctuator", value: "{", range: [10, 11] },
                { type: "LineBreak", value: "\n", range: [11, 11] },
                { type: "Whitespace", value: "    ", range: [12, 16] },
                { type: "Identifier", value: "a", range: [16, 17] },
                { type: "Punctuator", value: ":", range: [17, 18] },
                { type: "Whitespace", value: " ", range: [18, 19] },
                { type: "Identifier", value: "b", range: [19, 20] },
                { type: "LineBreak", value: "\n", range: [20, 20] },
                { type: "Whitespace", value: "" },
                { type: "Punctuator", value: "}", range: [21, 22] },
                { type: "Punctuator", value: ";", range: [22, 23] },
                { type: "LineBreak", value: "\n", range: [23, 23] },
                { type: "LineBreak", value: "\n", range: [24, 24] },
                {
                    type: "BlockComment",
                    value: "/*a\n     *b\n     *c\n     */",
                    range: [25, 40]
                }
            ];

            const tokenList = new TokenList(parts);
            const maybeIndent = tokenList.findPreviousIndent(parts[parts.length - 1]);
            expect(maybeIndent).to.be.undefined;
        });

        it("should find no previous indent when token has no indent", () => {
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

            const maybeIndent = tokenList.findPreviousIndent(token2);
            expect(maybeIndent).to.be.undefined;
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
