/**
 * @fileoverview Handles wrapping for nodes.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

function unwrapObjectOrArrayLiteral(node, layout, tokenList) {
    const children = node.type === "ArrayExpression" ? "elements" : "properties";
    const { firstToken, lastToken } = layout.boundaryTokens(node);
    let token = firstToken;

    if (node[children].length === 0) {

        // if there are comments then we can't unwrap
        if (tokenList.nextTokenOrComment(firstToken) === lastToken) {
            while (token && token !== lastToken) {
                const nextToken = tokenList.next(token);
                if (tokenList.isWhitespaceOrLineBreak(token)) {
                    tokenList.delete(token);
                }
                token = nextToken;
            }
        }
    } else {
        // TODO
    }
}

function wrapObjectOrArrayLiteral(node, layout) {
    const children = node.type === "ArrayExpression" ? "elements" : "properties";
    const { firstToken, lastToken } = layout.boundaryTokens(node);
    const originalIndentLevel = layout.getIndentLevel(node);
    const newIndentLevel = originalIndentLevel + 1;
    
    layout.lineBreakAfter(firstToken);
    layout.lineBreakBefore(lastToken);
    layout.indentLevel(lastToken, originalIndentLevel);

    if (node[children].length) {
        node[children].forEach(child => {
            layout.indentLevel(child, newIndentLevel);

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
}


const wrappers = {
    ArrayExpression: wrapObjectOrArrayLiteral,

    ConditionalExpression(node, layout) {
        const questionMark = layout.findPrevious("?", node.consequent);
        const colon = layout.findNext(":", node.consequent);
        
        layout.lineBreakBefore(questionMark);
        layout.indent(questionMark);
        layout.lineBreakBefore(colon);
        layout.indent(colon);
    },

    MemberExpression(node, layout) {

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
    
    TemplateLiteral(node, layout) {
        const indentLevel = layout.getIndentLevel(node) + 1;
        node.expressions.forEach(child => {
            layout.lineBreakBefore(child);
            layout.lineBreakAfter(child);
            layout.indentLevel(child, indentLevel);
        });
    }
    
};

const unwrappers = {
    ArrayExpression: unwrapObjectOrArrayLiteral,
    ObjectExpression: unwrapObjectOrArrayLiteral,
    
    ConditionalExpression(node, layout) {
        const questionMark = layout.findPrevious("?", node.consequent);
        const colon = layout.findNext(":", node.consequent);

        layout.noLineBreakBefore(questionMark);
        layout.spaces(questionMark);
        layout.noLineBreakBefore(colon);
        layout.spaces(colon);
    },

    TemplateLiteral(node, layout) {
        node.expressions.forEach(child => {
            layout.noLineBreakBefore(child);
            layout.noLineBreakAfter(child);
        });
    }

};

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export class Wrapper {
    constructor(layout, tokenList) {
        this.layout = layout;
        this.tokenList = tokenList;
    }

    wrap(node) {
        return wrappers[node.type](node, this.layout, this.tokenList);
    }

    noWrap(node) {
        return unwrappers[node.type](node, this.layout, this.tokenList);
    }
}
