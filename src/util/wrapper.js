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

const wrappers = {
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

        const dot = layout.findPrevious(".", node.property);
        
        layout.lineBreakBefore(dot);
        layout.indent(dot);
    },

    TemplateLiteral(node, layout) {
        node.expressions.forEach(child => {
            layout.lineBreakBefore(child);
            layout.lineBreakAfter(child);
            layout.indent(child);
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
