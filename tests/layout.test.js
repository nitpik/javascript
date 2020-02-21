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
// Helpers
//-----------------------------------------------------------------------------

function parse(text) {
    return espree.parse(text, { range: true, tokens: true, comment: true, ecmaVersion: 2019, sourceType: "module" });
}

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("Layout", () => {


    describe("Indents", () => {

        it("should remove whitespace tokens when their strings are empty", () => {
            const text = "    `start`;";
            const expected = "`start`;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const result = layout.findNext(token => token.type === "Whitespace", ast);
            expect(layout.toString()).to.equal(expected);
            expect(result).to.equal(undefined);
        });

    });

    describe("getIndentLevel()", () => {

        it("should return the correct indent level when the line has no indent", () => {
            const text = "a.b();";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            const level = layout.getIndentLevel(ast.body[0]);
            expect(level).to.equal(0);
        });

        it("should return the correct indent level when the indent is one level", () => {
            const text = "{\n    foo();\n}";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            const level = layout.getIndentLevel(ast.body[0].body[0]);
            expect(level).to.equal(1);
        });

        it("should return the correct indent level when the indent is two levels", () => {
            const text = "{\n    {\n        foo();\n    }\n}";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            const level = layout.getIndentLevel(ast.body[0].body[0].body[0]);
            expect(level).to.equal(2);
        });

    });

    describe("indentLevel()", () => {

        it("should indent one level when the code has no indent", () => {
            const text = "a.b();";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            expect(layout.indentLevel(ast.body[0], 1)).to.equal(true);
            const level = layout.getIndentLevel(ast.body[0]);
            expect(level).to.equal(1);
        });

        it("should maintain the indent when passed the same indent level", () => {
            const text = "{\n    foo();\n}";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            expect(layout.indentLevel(ast.body[0].body[0], 1)).to.equal(true);
            const level = layout.getIndentLevel(ast.body[0].body[0]);
            expect(level).to.equal(1);
        });

    });

    describe("getLength()", () => {

        it("should return the correct length when the line has no indent", () => {
            const text = "a.b();";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            const { firstToken, lastToken } = layout.boundaryTokens(ast.body[0].expression.callee);
            const length = layout.getLength(firstToken, lastToken);
            expect(text).to.equal(layout.toString());
            expect(length).to.equal(3);
        });

    });


    describe("getLineLength()", () => {

        it("should return the correct line length when the line has no indent", () => {
            const text = "a.b();";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            const length = layout.getLineLength(ast.body[0]);
            expect(text).to.equal(layout.toString());
            expect(length).to.equal(6);
        });

        it("should return the correct line length when the line has an indent", () => {
            const text = "if (foo){\n    a.b();\n}";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            const length = layout.getLineLength(ast.body[0].consequent);
            expect(length).to.equal(10);
        });

        it("should return the correct line length when is inside an if condition", () => {
            const text = "if (foo){\nconst foo = [1, 2, 3, 4, 5];\n}";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            const length = layout.getLineLength(ast.body[0].consequent.body[0]);
            expect(length).to.equal(32);
        });

        it("should return the correct line length when the line has a tab indent", () => {
            const text = "if (foo){\n\ta.b();\n}";
            const ast = parse(text);
            const layout = new Layout({ ast, text }, { indent: "\t", tabWidth: 4 });
            const length = layout.getLineLength(ast.body[0].consequent);
            expect(length).to.equal(10);
        });

    });
    
    describe("emptyLineAfter()", () => {

        it("should insert empty line when not found after node", () => {
            const text = "a;";
            const expected = "a;\n\n";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const semi = layout.findNext(token => token.value === ";", layout.lastToken(ast.body[0]));
            expect(layout.emptyLineAfter(semi)).to.be.true;
            expect(layout.toString()).to.equal(expected);
        });

        it("should insert empty line when there's one line break after node", () => {
            const text = "a;\nb;";
            const expected = "a;\n\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const semi = layout.findNext(token => token.value === ";", layout.lastToken(ast.body[0]));
            expect(layout.emptyLineAfter(semi)).to.be.true;
            expect(layout.toString()).to.equal(expected);
        });

        it("should insert empty line when there's one line break and whitespace after token", () => {
            const text = "a;\n  b;";
            const expected = "a;\n\nb;"; // note: spaces removed by indent behavior
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const semi = layout.findNext(token => token.value === ";", layout.lastToken(ast.body[0]));
            expect(layout.emptyLineAfter(semi)).to.be.true;
            expect(layout.toString()).to.equal(expected);
        });

        it("should insert empty line when no empty line after last token", () => {
            const text = "a;\nb;";
            const expected = "a;\nb;\n\n";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const semi = layout.findNext(token => token.value === ";", layout.lastToken(ast.body[1]));
            expect(layout.emptyLineAfter(semi)).to.be.true;
            expect(layout.toString()).to.equal(expected);
        });

        it("should not insert empty line when empty line is after last token", () => {
            const text = "a;\nb;\n\n";
            const expected = "a;\nb;\n\n";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const semi = layout.findNext(token => token.value === ";", layout.lastToken(ast.body[1]));
            expect(layout.emptyLineAfter(semi)).to.be.false;
            expect(layout.toString()).to.equal(expected);
        });

        it("should not insert empty line when there's an empty line after node", () => {
            const text = "a;\n\nb;";
            const expected = "a;\n\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const semi = layout.findNext(token => token.value === ";", layout.lastToken(ast.body[0]));
            expect(layout.emptyLineAfter(semi)).to.be.false;
            expect(layout.toString()).to.equal(expected);
        });

        it("should not insert empty line when there's an empty line with whitespace after node", () => {
            const text = "a;\n  \nb;";
            const expected = "a;\n\nb;"; // note: extra spaces removed automatically
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const semi = layout.findNext(token => token.value === ";", layout.lastToken(ast.body[0]));
            expect(layout.emptyLineAfter(semi)).to.be.false;
            expect(layout.toString()).to.equal(expected);
        });

    });

    describe("emptyLineBefore()", () => {

        it("should insert empty line when not found before first node", () => {
            const text = "a;";
            const expected = "\n\na;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            expect(layout.emptyLineBefore(ast.body[0])).to.be.true;
            expect(layout.toString()).to.equal(expected);
        });

        it("should insert empty line when there's one line break before node", () => {
            const text = "a;\nb;";
            const expected = "a;\n\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            expect(layout.emptyLineBefore(ast.body[1])).to.be.true;
            expect(layout.toString()).to.equal(expected);
        });

        it("should insert empty line when there's no line break before node", () => {
            const text = "a;b;";
            const expected = "a;\n\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            expect(layout.emptyLineBefore(ast.body[1])).to.be.true;
            expect(layout.toString()).to.equal(expected);
        });

        it("should not insert empty line when empty line is before last node", () => {
            const text = "a;\n\nb;";
            const expected = "a;\n\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            expect(layout.emptyLineBefore(ast.body[1])).to.be.false;
            expect(layout.toString()).to.equal(expected);
        });

        it("should not insert empty line when there's an empty line before first node", () => {
            const text = "\n\na;";
            const expected = "\n\na;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            expect(layout.emptyLineBefore(ast.body[0])).to.be.false;
            expect(layout.toString()).to.equal(expected);
        });

    });

    describe("noEmptyLineAfter()", () => {

        it("should remove empty line when found after node", () => {
            const text = "a;\n\nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            layout.noEmptyLineAfter(ast.body[0]);
            expect(layout.toString()).to.equal(expected);
        });

        it("should remove empty line when found after node with whitespace", () => {
            const text = "a;\n    \nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            layout.noEmptyLineAfter(ast.body[0]);
            expect(layout.toString()).to.equal(expected);
        });

        it("should remove empty line when found after token", () => {
            const text = "a;\n\nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const token = layout.firstToken(ast);
            layout.noEmptyLineAfter(token);
            expect(layout.toString()).to.equal(expected);
        });

        it("should remove empty line when found after token with whitespace", () => {
            const text = "a;\n    \nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const token = layout.firstToken(ast);
            layout.noEmptyLineAfter(token);
            expect(layout.toString()).to.equal(expected);
        });

        it("should remove empty line when found after last node", () => {
            const text = "a;\nb;\n\n";
            const expected = "a;\nb;\n";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            layout.noEmptyLineAfter(ast.body[1]);
            expect(layout.toString()).to.equal(expected);
        });

        it("should not make changes when no empty line found after node", () => {
            const text = "a;\nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            layout.noEmptyLineAfter(ast.body[0]);
            expect(layout.toString()).to.equal(expected);
        });

        it("should not make changes when no empty line found after token", () => {
            const text = "a;\nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const token = layout.firstToken(ast);
            layout.noEmptyLineAfter(token);
            expect(layout.toString()).to.equal(expected);
        });

    });

    describe("noEmptyLineBefore()", () => {

        it("should remove empty line when found before node", () => {
            const text = "a;\n\nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            layout.noEmptyLineBefore(ast.body[1]);
            expect(layout.toString()).to.equal(expected);
        });

        it("should remove empty line when found before with whitespace node", () => {
            const text = "a;\n   \nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            layout.noEmptyLineBefore(ast.body[1]);
            expect(layout.toString()).to.equal(expected);
        });

        it("should remove empty line when found before token", () => {
            const text = "a;\n\nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const token = layout.firstToken(ast.body[1]);
            layout.noEmptyLineBefore(token);
            expect(layout.toString()).to.equal(expected);
        });

        it("should remove empty line when found before token with whitespace", () => {
            const text = "a;\n    \nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const token = layout.firstToken(ast.body[1]);
            layout.noEmptyLineBefore(token);
            expect(layout.toString()).to.equal(expected);
        });

        it("should remove empty line when found before first node", () => {
            const text = "\na;\nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            layout.noEmptyLineBefore(ast.body[0]);
            expect(layout.toString()).to.equal(expected);
        });

        it("should remove empty line when found before first node with whitespace", () => {
            const text = "    \na;\nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            layout.noEmptyLineBefore(ast.body[0]);
            expect(layout.toString()).to.equal(expected);
        });


        it("should not make changes when no empty line found before node", () => {
            const text = "a;\nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            layout.noEmptyLineBefore(ast.body[1]);
            expect(layout.toString()).to.equal(expected);
        });

        it("should not make changes when no empty line found before token", () => {
            const text = "a;\nb;";
            const expected = "a;\nb;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });

            const token = layout.firstToken(ast.body[1]);
            layout.noEmptyLineBefore(token);
            expect(layout.toString()).to.equal(expected);
        });

    });


});
