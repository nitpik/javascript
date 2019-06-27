/**
 * @fileoverview Tests for layout
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { Layout } from "../src/layout.js";
import espree from "espree";
import chai from "chai";

const expect = chai.expect;

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------


function parse(text) {
    return espree.parse(text, { range: true, tokens: true, comment: true, ecmaVersion: 2019 });
}

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("Layout", () => {

    describe("noWrap()", () => {
        it("should unwrap a template literal", () => {
            const text = "`start ${\n    word\n} end`;";
            const expected = "`start ${word} end`;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.noWrap(ast.body[0].expression);
            expect(layout.toString()).to.equal(expected);

        });

        it("should unwrap a conditional", () => {
            const text = "foo\n    ? bar\n    : baz;";
            const expected = "foo ? bar : baz;";
            const ast = parse(text);
            const layout = new Layout({ ast, text }, { collapseWhitespace: false });
            layout.noWrap(ast.body[0].expression);
            expect(layout.toString()).to.equal(expected);

        });
    });

    describe("wrap()", () => {
        it("should wrap a template literal", () => {
            const text = "`start ${word} end`;";
            const expected = "`start ${\n    word\n} end`;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.wrap(ast.body[0].expression);
            expect(layout.toString()).to.equal(expected);

        });
    });

    describe("getLineLength()", () => {

        it("should return the correct line length when the line has no indent", () => {
            const text = "a.b();";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            const length = layout.getLineLength(ast.body[0]);
            expect(length).to.equal(6);
        });

        it("should return the correct line length when the line has an indent", () => {
            const text = "if (foo){\n    a.b();\n}";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            const length = layout.getLineLength(ast.body[0].consequent);
            expect(length).to.equal(10);
        });

        it("should return the correct line length when the line has a tab indent", () => {
            const text = "if (foo){\n\ta.b();\n}";
            const ast = parse(text);
            const layout = new Layout({ ast, text }, { indent: "\t", tabWidth: 4 });
            const length = layout.getLineLength(ast.body[0].consequent);
            expect(length).to.equal(10);
        });

    });

});
