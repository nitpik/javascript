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

    xdescribe("noWrap()", () => {
        it("should unwrap a template literal", () => {
            const text = "`start ${\n    word\n} end`;";
            const expected = "`start ${word} end`;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.noWrap(ast.body[0].expression);
            expect(layout.toString()).to.equal(expected);

        });

        it("should unwrap a call expression", () => {
            const text = "funcName(\na,\nb,\nc\n);";
            const expected = "funcName(a, b, c);";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.noWrap(ast.body[0].expression);
            expect(layout.toString()).to.equal(expected);

        });

        it("should unwrap an if statement", () => {
            const text = "if (\na+\nb\n){\n foo();\n }";
            const expected = "if (a + b) {\n    foo();\n}";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.noWrap(ast.body[0]);
            layout.noWrap(ast.body[0].test);
            expect(layout.toString()).to.equal(expected);

        });

        it("should unwrap an import statement", () => {
            const text = "import {\nfoo,\nbar,\nbaz\n} from \"foo\";";
            const expected = "import { foo, bar, baz } from \"foo\";";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.noWrap(ast.body[0]);
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

        it("should unwrap an object literal", () => {
            const text = "const zz = {\n    \n  };";
            const expected = "const zz = {};";
            const ast = parse(text);
            const layout = new Layout({ ast, text }, { collapseWhitespace: false });
            layout.noWrap(ast.body[0].declarations[0].init);
            expect(layout.toString()).to.equal(expected);

        });
    });

    xdescribe("wrap()", () => {
        it("should wrap a template literal", () => {
            const text = "`start ${word} end`;";
            const expected = "`start ${\n    word\n} end`;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.wrap(ast.body[0].expression);
            expect(layout.toString()).to.equal(expected);
        });

        it("should wrap an array literal when inside an if statement", () => {
            const text = "if (foo) {\nconst bar = [1,2];\n}";
            const expected = "if (foo) {\n    const bar = [\n        1,\n        2\n    ];\n}";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.wrap(ast.body[0].consequent.body[0].declarations[0].init);
            expect(layout.toString()).to.equal(expected);

        });

        it("should wrap a variable declaration when there's an object literal first", () => {
            const text = "const x = {\nfoo:1\n},a=1;";
            const expected = "const x = {\n        foo: 1\n    },\n    a = 1;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.wrap(ast.body[0]);
            expect(layout.toString()).to.equal(expected);

        });
        
        it("should wrap a variable declaration when there's an object literal last", () => {
            const text = "const a=1,x={\nfoo:1\n};";
            const expected = "const a = 1,\n    x = {\n        foo: 1\n    };";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.wrap(ast.body[0]);
            expect(layout.toString()).to.equal(expected);
            
        });
        
        it("should wrap a variable declaration when there's a function first", () => {
            const text = "const x = function(){\n return foo;\n},a=1;";
            const expected = "const x = function() {\n        return foo;\n    },\n    a = 1;";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.wrap(ast.body[0]);
            expect(layout.toString()).to.equal(expected);
        });

        it("should wrap a variable declaration when there's a function last", () => {
            const text = "const a=1,x=function(){\nreturn foo;\n};";
            const expected = "const a = 1,\n    x = function() {\n        return foo;\n    };";
            const ast = parse(text);
            const layout = new Layout({ ast, text });
            layout.wrap(ast.body[0]);
            expect(layout.toString()).to.equal(expected);

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

});
