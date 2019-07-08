/**
 * @fileoverview Handles wrapping for nodes.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------


function shouldIncreaseIndentForVariableDeclaration(node, nodeParents) {
    const parent = nodeParents.get(node);
    if (parent.type === "VariableDeclarator" && parent.init === node) {
        const grandParent = nodeParents.get(parent);

        return grandParent.declarations.length > 1 &&
            grandParent.declarations[0] === parent;
    }

    return false;
}

function unwrapObjectOrArrayLiteral(node, {layout}) {
    const children = node.type.startsWith("Array") ? "elements" : "properties";
    const { firstToken, lastToken } = layout.boundaryTokens(node);

    if (node[children].length === 0) {

        // if there are comments then we can't unwrap
        if (layout.nextTokenOrComment(firstToken) === lastToken) {
            layout.noLineBreakAfter(firstToken);
            layout.noSpaceAfter(firstToken);
            layout.noLineBreakBefore(lastToken);
            layout.noSpaceBefore(lastToken);
        }
    } else {
        // TODO
    }
}

function wrapObjectOrArrayLiteral(node, {layout, nodeParents }) {
    const children = node.type.startsWith("Array") ? "elements" : "properties";
    const { firstToken, lastToken } = layout.boundaryTokens(node);
    const firstBodyToken = layout.nextTokenOrComment(firstToken);
    const lastBodyToken = layout.previousTokenOrComment(lastToken);
    let originalIndentLevel = layout.getIndentLevel(node);
    
    if (shouldIncreaseIndentForVariableDeclaration(node, nodeParents)) {
        originalIndentLevel++;
    }

    const newIndentLevel = originalIndentLevel + 1;

    layout.lineBreakAfter(firstToken);
    layout.lineBreakBefore(lastToken);
    layout.indentLevel(lastToken, originalIndentLevel);

    if (node[children].length) {
        node[children].forEach(child => {

            const lastToken = layout.lastToken(child);
            const maybeComma = layout.nextToken(lastToken);

            if (maybeComma.value === ",") {
                layout.lineBreakAfter(maybeComma);
            }
        });

        if (layout.options.trailingCommas) {
            layout.commaAfter(node[children][node[children].length - 1]);
        } else {
            layout.noCommaAfter(node[children][node[children].length - 1]);
        }
    }

    layout.indentLevelBetween(firstBodyToken, lastBodyToken, newIndentLevel);

}

function wrapFunction(node, { layout, nodeParents }) {
    const { firstToken, lastToken } = layout.boundaryTokens(node.body);
    const firstBodyToken = layout.nextTokenOrComment(firstToken);
    const lastBodyToken = layout.previousTokenOrComment(lastToken);
    let originalIndentLevel = layout.getIndentLevel(node);

    if (shouldIncreaseIndentForVariableDeclaration(node, nodeParents)) {
        originalIndentLevel++;
    }

    const newIndentLevel = originalIndentLevel + 1;

    // indent arguments
    if (node.params.length > 1 && layout.isLineTooLong(node)) {
        const openParen = layout.findPrevious("(", node.params[0]);
        const closeParen = layout.findPrevious(")", firstToken);

        layout.lineBreakAfter(openParen);
        layout.lineBreakBefore(closeParen);
        layout.indentLevel(closeParen, originalIndentLevel);

        node.params.forEach(param => {
            layout.indentLevel(param, newIndentLevel);
            const lastParamToken = layout.lastToken(param);
            const maybeComma = layout.nextToken(lastParamToken);
            if (maybeComma.value === ",") {
                layout.lineBreakAfter(maybeComma);
            }
        });
    }

    // indent body
    layout.lineBreakAfter(firstToken);
    layout.lineBreakBefore(lastToken);
    layout.indentLevel(lastToken, originalIndentLevel);
    layout.indentLevelBetween(firstBodyToken, lastBodyToken, newIndentLevel);
}

function wrapBinaryOrLogicalExpression(node, { layout, nodeParents }) {
    const parent = nodeParents.get(node);
    const indentLevel = layout.isMultiLine(parent)
        ? layout.getIndentLevel(parent) + 1
        : layout.getIndentLevel(node) + 1;
    const operator = layout.findNext(node.operator, node.left);

    layout.lineBreakAfter(operator);
    layout.indentLevel(node.right, indentLevel);
}

function unwrapBinaryOrLogicalExpression(node, { layout }) {
    const operator = layout.findNext(node.operator, node.left);
    layout.noLineBreakAfter(operator);
    layout.spaces(operator);
}

function wrapStatementWithTestCondition(node, { layout }) {
    const openParen = layout.findPrevious("(", node.test);
    const closeParen = layout.findNext(")", node.test);

    layout.noLineBreakAfter(openParen);
    layout.lineBreakBefore(closeParen);
}

function unwrapStatementWithTestCondition(node, { layout }) {
    const openParen = layout.findPrevious("(", node.test);
    const closeParen = layout.findNext(")", node.test);

    layout.noLineBreakAfter(openParen);
    layout.noLineBreakBefore(closeParen);
    layout.noSpaceAfter(openParen);
    layout.noSpaceBefore(closeParen);
}

const wrappers = new Map(Object.entries({
    ArrayExpression: wrapObjectOrArrayLiteral,
    ArrayPattern: wrapObjectOrArrayLiteral,
    ArrowFunctionExpression: wrapFunction,

    BinaryExpression: wrapBinaryOrLogicalExpression,

    CallExpression(node, {layout}) {
        const indentLevel = layout.getIndentLevel(node) + 1;
        const openParen = layout.findNext("(", node.callee);
        const closeParen = layout.lastToken(node);

        if (node.arguments.length > 1) {
            layout.lineBreakAfter(openParen);
            layout.lineBreakBefore(closeParen);

            node.arguments.forEach(argument => {
                layout.indentLevel(argument, indentLevel);
                const maybeComma = layout.nextToken(layout.lastToken(argument));
                if (maybeComma.value === ",") {
                    layout.lineBreakAfter(maybeComma)
                }
            });
        } else {
            layout.noSpaceAfter(openParen);
            layout.noSpaceBefore(closeParen);
        }
    },

    ConditionalExpression(node, {layout}) {
        const questionMark = layout.findPrevious("?", node.consequent);
        const colon = layout.findNext(":", node.consequent);
        
        layout.lineBreakBefore(questionMark);
        layout.indent(questionMark);
        layout.lineBreakBefore(colon);
        layout.indent(colon);
    },

    DoWhileStatement: wrapStatementWithTestCondition,
    FunctionDeclaration: wrapFunction,
    FunctionExpression: wrapFunction,
    IfStatement: wrapStatementWithTestCondition,

    ImportDeclaration(node, { layout }) {
        let startSpecifierIndex = 0;

        // don't consider default or namespace specifiers
        if (node.specifiers[0].type !== "ImportSpecifier") {
            startSpecifierIndex = 1;
        }

        if (node.specifiers[startSpecifierIndex]) {
            const openBrace = layout.findPrevious("{", node.specifiers[startSpecifierIndex]);
            const closeBrace = layout.findNext("}", node.specifiers[node.specifiers.length - 1]);
            layout.lineBreakAfter(openBrace);
            layout.lineBreakBefore(closeBrace);

            for (let i = startSpecifierIndex; i < node.specifiers.length; i++) {

                // imports always have no indent because they are top-level
                layout.indentLevel(node.specifiers[i], 1);
                const lastSpecifierToken = layout.lastToken(node.specifiers[i]);
                const maybeComma = layout.nextToken(lastSpecifierToken);
                if (maybeComma.value === ",") {
                    layout.noSpaceBefore(maybeComma);
                    layout.lineBreakAfter(maybeComma);
                }
            }
        }
    },

    LogicalExpression: wrapBinaryOrLogicalExpression,

    MemberExpression(node, {layout}) {

        // don't wrap member expressions with computed properties
        if (node.computed) {
            return;
        }

        const indentLevel = layout.getIndentLevel(node);
        const dot = layout.findPrevious(".", node.property);
        
        layout.lineBreakBefore(dot);
        layout.indentLevel(dot, indentLevel + 1);
    },

    ObjectExpression: wrapObjectOrArrayLiteral,
    ObjectPattern: wrapObjectOrArrayLiteral,
    
    TemplateLiteral(node, {layout}) {
        const indentLevel = layout.getIndentLevel(node) + 1;
        node.expressions.forEach(child => {
            layout.lineBreakBefore(child);
            layout.lineBreakAfter(child);
            layout.indentLevel(child, indentLevel);
        });
    },

    VariableDeclaration(node, {layout}) {
        const indentLevel = layout.getIndentLevel(node) + 1;
        
        if (node.declarations.length > 1) {
            node.declarations.forEach((declarator, i) => {
                const lastToken = layout.lastToken(declarator);
                const commaToken = layout.nextToken(lastToken);
                if (commaToken.value === ",") {
                    layout.lineBreakAfter(commaToken);
                }

                if (i > 0) {
                    layout.indentLevel(declarator, indentLevel);
                }
            });
        }
    },
    WhileStatement: wrapStatementWithTestCondition,
    
}));

const unwrappers = new Map(Object.entries({
    ArrayExpression: unwrapObjectOrArrayLiteral,
    ArrayPattern: unwrapObjectOrArrayLiteral,
    BinaryExpression: unwrapBinaryOrLogicalExpression,

    CallExpression(node, { layout }) {
        const openParen = layout.findNext("(", node.callee);
        const closeParen = layout.lastToken(node);

        layout.noLineBreakAfter(openParen);
        layout.noSpaceAfter(openParen);
        layout.noLineBreakBefore(closeParen);
        layout.noSpaceBefore(closeParen);

        node.arguments.forEach(argument => {
            const maybeComma = layout.nextToken(layout.lastToken(argument));
            if (maybeComma.value === ",") {
                layout.noLineBreakAfter(maybeComma);
                layout.noSpaceBefore(maybeComma);
                layout.spaceAfter(maybeComma);
            }
        });
    },

    ConditionalExpression(node, {layout}) {
        const questionMark = layout.findPrevious("?", node.consequent);
        const colon = layout.findNext(":", node.consequent);

        layout.noLineBreakBefore(questionMark);
        layout.spaces(questionMark);
        layout.noLineBreakBefore(colon);
        layout.spaces(colon);
    },

    DoWhileStatement: unwrapStatementWithTestCondition,
    IfStatement: unwrapStatementWithTestCondition,

    ImportDeclaration(node, { layout }) {
        let startSpecifierIndex = 0;

        // don't consider default or namespace specifiers
        if (node.specifiers[0].type !== "ImportSpecifier") {
            startSpecifierIndex = 1;
        }

        if (node.specifiers[startSpecifierIndex]) {
            const openBrace = layout.findPrevious("{", node.specifiers[startSpecifierIndex]);
            const closeBrace = layout.findNext("}", node.specifiers[node.specifiers.length - 1]);
            layout.noLineBreakAfter(openBrace);
            layout.spaceAfter(openBrace);
            layout.noLineBreakBefore(closeBrace);
            layout.spaceBefore(closeBrace);

            for (let i = startSpecifierIndex; i < node.specifiers.length; i++) {
                
                const lastSpecifierToken = layout.lastToken(node.specifiers[i]);
                const maybeComma = layout.nextToken(lastSpecifierToken);

                if (maybeComma.value === ",") {
                    layout.noSpaceBefore(maybeComma);
                    layout.noLineBreakAfter(maybeComma);
                    layout.spaceAfter(maybeComma);
                }
            }
        }
    },

    LogicalExpression: unwrapBinaryOrLogicalExpression,
    ObjectExpression: unwrapObjectOrArrayLiteral,
    ObjectPattern: unwrapObjectOrArrayLiteral,
    
    TemplateLiteral(node, {layout}) {
        node.expressions.forEach(child => {
            layout.noLineBreakBefore(child);
            layout.noLineBreakAfter(child);
        });
    },

    WhileStatement: unwrapStatementWithTestCondition,
}));

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export class Wrapper {
    constructor(options) {
        this.options = options;
    }

    wrap(node) {
        return wrappers.get(node.type)(node, this.options);
    }

    noWrap(node) {
        return unwrappers.get(node.type)(node, this.options);
    }
}
