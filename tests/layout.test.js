/**
 * @fileoverview Tests for layout
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { Layout } from "../src/layout.js";
import espree from "espree";
import fs from "fs";
import path from "path";
import chai from "chai";

const expect = chai.expect;

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------



//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("Layout", () => {

    describe("getLineLength()", () => {

        it("should return the correct line length when the line has no indent", () => {
            const text = "a.b();";
            const ast = espree.parse(text, { range: true, tokens: true, comment: true });
            const layout = new Layout({ ast, text });
            const length = layout.getLineLength(ast.body[0]);
            expect(length).to.equal(6);
        });

        it("should return the correct line length when the line has an indent", () => {
            const text = "if (foo){\n    a.b();\n}";
            const ast = espree.parse(text, { range: true, tokens: true, comment: true });
            const layout = new Layout({ ast, text });
            const length = layout.getLineLength(ast.body[0].consequent);
            expect(length).to.equal(10);
        });

        it("should return the correct line length when the line has a tab indent", () => {
            const text = "if (foo){\n\ta.b();\n}";
            const ast = espree.parse(text, { range: true, tokens: true, comment: true });
            const layout = new Layout({ ast, text }, { indent: "\t", tabWidth: 4 });
            const length = layout.getLineLength(ast.body[0].consequent);
            expect(length).to.equal(10);
        });

    });

});
