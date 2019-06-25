/**
 * @fileoverview A task to automatically adjust spaces as needed.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

function findNextCommaOrSemicolon(layout, start) {
    return layout.findNext(part => part.type === "Punctuator", start);
}

function normalizePunctuatorSpacing(layout) {
    let token = findNextCommaOrSemicolon(layout);
    while (token) {

        switch (token.value) {
            case ",":
            case ";":
                layout.noSpaceBefore(token);
                layout.spaceAfter(token);
                break;
                
            default:
                if (token.value.includes("=")) {
                    layout.spaceBefore(token);
                    layout.spaceAfter(token);
                }
        }

        token = findNextCommaOrSemicolon(layout, token);
    }
}

function spaceKeywordAndBrace(node, bodyKey, layout) {
    const firstToken = layout.firstToken(node);
    layout.spaceAfter(firstToken);

    const braceToken = layout.firstToken(node[bodyKey]);
    if (braceToken.value === "{") {
        layout.spaceBefore(braceToken);
    }

}

//-----------------------------------------------------------------------------
// Task
//-----------------------------------------------------------------------------

export default function(context) {
    const layout = context.layout;

    // first, adjust all commas
    normalizePunctuatorSpacing(layout);


    return {

        ArrayExpression(node) {
            
            const { firstToken, lastToken } = layout.boundaryTokens(node);
            layout.noSpaceAfter(firstToken);
            
            // no spacing work for multiline
            if (!layout.isMultiLine(node)) {
              
                layout.noSpaceBefore(lastToken);

                if (node.elements.length) {

                    node.elements.forEach((element, index) => {

                        if (index > 0) {
                            layout.spaceBefore(element);
                        }
                        layout.noSpaceAfter(element);
                    });
                }
            }
        },

        ArrowFunctionExpression(node) {
    
            let openParenToken, closeParenToken;
            const firstToken = layout.firstToken(node);
    
            if (node.async) {
                layout.spaceAfter(firstToken);
            }
    
            if (node.params.length === 0) {
    
                openParenToken = node.async
                    ? layout.findNext("(", firstToken)
                    : firstToken;
    
                closeParenToken = layout.findNext(")", openParenToken);
            } else if (node.params.length === 1) {
                
                if (node.async) {
                    layout.spaceAfter(firstToken);
                    openParenToken = layout.findPrevious(part => {
                        return part === firstToken || part.value === "(";
                    }, node.params[0]);
                    
                    if (openParenToken.value !== "(") {
                        openParenToken = null;
                    } else {
                        closeParenToken = layout.findNext(")", node.params[0]);
                    }
    
                } else {
                    if (firstToken.value === "(") {
                        openParenToken = firstToken;
                        closeParenToken = layout.findNext(")", node.params[0]);
                    }
                }
    
            } else {
    
                openParenToken = node.async
                    ? layout.findNext("(", firstToken)
                    : firstToken;
    
                closeParenToken = layout.findNext(")", node.params[node.params.length - 1]);
            }
    
            if (openParenToken) {
                // have to do both in case there's a comment inside
                layout.noSpaceAfter(openParenToken);
                layout.noSpaceBefore(closeParenToken);
            }
        },


        AwaitExpression(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);
        },

        BinaryExpression(node) {
            const firstToken = layout.firstToken(node);
            const operatorToken = layout.findNext(node.operator, firstToken);
            layout.spaces(operatorToken);
        },

        ConditionalExpression(node) {
            const questionMark = layout.findPrevious("?", node.consequent);
            const colon = layout.findNext(":", node.consequent);

            layout.spaces(questionMark);
            layout.spaces(colon);
        },

        DoWhileStatement(node) {
            spaceKeywordAndBrace(node, "body", layout);

            const whileToken = layout.findPrevious("while", node.test);
            layout.spaces(whileToken);
        },

        ExportNamedDeclaration(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);

            if (node.specifiers.length) {

                // adjust spaces around braces
                layout.spaceAfter(layout.findNext("{", firstToken));
                layout.spaceBefore(layout.findNext("}", firstToken));
            }
        },

        ForStatement(node) {
            spaceKeywordAndBrace(node, "body", layout);
        },

        ForInStatement(node) {
            this.ForStatement(node);
        },

        ForOfStatement(node) {
            this.ForStatement(node);
        },

        FunctionDeclaration(node, parent) {
            this.FunctionExpression(node, parent);
        },

        FunctionExpression(node, parent) {

            // ESTree quirk: concise methods don't have "function" keyword
            const isConcise =
                (parent.type === "Property" && parent.method) ||
                (parent.type === "MethodDefinition");
            let token = layout.firstToken(node);
            let id, openParen;

            if (!isConcise) {
                
                // "async" keyword
                if (token.value === "async") {
                    layout.spaceAfter(token);
                    token = layout.nextToken(token);
                }

                // "function" keyword
                layout.spaceAfter(token);
                token = layout.nextToken(token);

                // "*" punctuator
                if (token.value === "*") {
                    layout.noSpaceAfter(token);
                    token = layout.nextToken(token);
                }

                // function name
                if (token.type === "Identifier") {
                    layout.noSpaceAfter(token);
                    token = layout.nextToken(token);
                }
                
                if (token.value === "(") {
                    openParen = token;
                } else {
                    throw new Error(`Unexpected token "${token.value}".`);
                }
            } else {
                let idStart = layout.firstToken(parent.key);
                id = idStart;

                if (parent.computed) {
                    const leftBracket = layout.previousToken(idStart);
                    layout.noSpaceAfter(leftBracket);

                    const rightBracket = layout.nextToken(idStart);
                    layout.noSpaceBefore(rightBracket);

                    idStart = leftBracket;
                    id = rightBracket;
                }

                if (parent.generator) {
                    const star = layout.previousToken(idStart);
                    layout.noSpaceAfter(star);
                }

                openParen = token;
            }

            if (id) {
                layout.noSpaceAfter(id);
            }
            
            layout.noSpaces(openParen);

            const openBrace = layout.firstToken(node.body);
            layout.spaceBefore(openBrace);
            
            const closeParen = layout.findPrevious(")", openBrace);
            layout.noSpaceBefore(closeParen);
        },
        
        IfStatement(node) {
            spaceKeywordAndBrace(node, "consequent", layout);

            if (node.alternate) {
                const elseToken = layout.findPrevious("else", node.alternate);
                layout.spaces(elseToken);
            }
        },

        ImportDeclaration(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);

            const fromToken = layout.findPrevious("from", node.source);
            layout.spaces(fromToken);

            if (node.specifiers.some(node => node.type === "ImportSpecifier")) {

                // adjust spaces around braces
                layout.spaceAfter(layout.findNext("{", firstToken));
                layout.spaceBefore(layout.findNext("}", firstToken));
            }
        },

        LogicalExpression(node) {
            this.BinaryExpression(node);
        },

        MethodDefinition(node) {
            this.FunctionExpression(node.value, node);
        },

        ObjectExpression(node) {

            const { firstToken, lastToken } = layout.boundaryTokens(node);
            layout.noSpaceAfter(firstToken);

            // no spacing work for multiline
            if (!layout.isMultiLine(node)) {

                layout.noSpaceBefore(lastToken);

                if (node.properties.length) {

                    node.properties.forEach((property, index) => {

                        if (index > 0) {
                            layout.spaceBefore(property);
                        }
                        layout.noSpaceAfter(property);
                    });
                }
            }
        },

        Property(node) {

            // ensure there's a space after the colon in properties
            if (!node.shorthand && !node.method) {

                layout.spaceBefore(node.value);
                
                // also be sure to check spacing of computed properties
                if (node.computed) {
                    const firstToken = layout.firstToken(node.key);
                    const openBracket = layout.findPrevious("[", firstToken);
                    const closeBracket = layout.findNext("]", firstToken);
                    
                    layout.noSpaceAfter(openBracket);
                    layout.noSpaceBefore(closeBracket);
                    layout.noSpaceAfter(closeBracket);
                } else {
                    layout.noSpaceAfter(node.key);
                }
            }

            if (node.method) {
                layout.spaceBefore(node.value.body);
            }
        },

        ReturnStatement(node) {
            if (node.argument) {
                layout.spaceBefore(node.argument);
            } else {
                layout.noSpaceAfter(node);
            }
        },

        SwitchStatement(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);

            const braceToken = layout.findNext("{", node.discriminant);
            layout.spaceBefore(braceToken);
        },

        SwitchCase(node) {
            const colon = layout.findPrevious(":", node.consequent[0]);
            layout.noSpaceBefore(colon);
            layout.spaceAfter(colon);
        },

        TemplateLiteral(node) {
            const [firstQuasi, ...quasis] = node.quasis;
            if (quasis.length) {
                layout.noSpaceAfter(firstQuasi);
                let previousQuasi = firstQuasi;

                quasis.forEach(quasi => {
                    layout.noSpaceBefore(quasi);
                    layout.noSpaceAfter(quasi);
                });
            }
        },

        ThrowStatement(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);
        },

        TryStatement(node) {
            spaceKeywordAndBrace(node, "block", layout);

            const catchToken = layout.firstToken(node.handler);
            layout.spaces(catchToken);

            const catchBraceToken = layout.firstToken(node.handler.body);
            layout.spaceBefore(catchBraceToken);

            if (node.finalizer) {
                const finallyBraceToken = layout.firstToken(node.finalizer);
                const finallyToken = layout.findPrevious("finally", finallyBraceToken);
                layout.spaces(finallyToken);
            }
        },

        UpdateExpression(node) {
            if (node.prefix) {
                const operatorToken = layout.firstToken(node);
                layout.noSpaceAfter(operatorToken);
            } else {
                const operatorToken = layout.lastToken(node);
                layout.noSpaceBefore(operatorToken);
            }
        },

        UnaryExpression(node) {
            this.UpdateExpression(node);
        },

        VariableDeclaration(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);
        },
        
        WhileStatement(node) {
            spaceKeywordAndBrace(node, "body", layout);
        },

        YieldExpression(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);
        },
        
    };

}
