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

};

const unwrappers = {
    ArrayExpression: unwrapObjectOrArrayLiteral,
    ObjectExpression: unwrapObjectOrArrayLiteral,
    ConditionalExpression(node, layout, tokenList) {
        const firstToken = layout.getFirstCodePart(node);
        const questionMark = layout.findPrevious("?", node.consequent);
        const colon = layout.findNext(":", node.consequent);

        if (!layout.isSameLine(firstToken, questionMark)) {
            layout.moveToPreviousLine(questionMark);
        }

        if (!layout.isSameLine(questionMark, colon)) {
            layout.moveToPreviousLine(questionMark);
        }
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
