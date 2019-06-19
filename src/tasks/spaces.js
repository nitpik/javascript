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

//-----------------------------------------------------------------------------
// Task
//-----------------------------------------------------------------------------

export default function(context) {
    const layout = context.layout;

    // first, adjust all commas
    normalizePunctuatorSpacing(layout)


    return {
        ImportDeclaration(node) {
            if (node.specifiers.some(node => node.type === "ImportSpecifier")) {
                const firstToken = layout.getFirstCodePart(node);

                // adjust spaces around braces
                layout.spaceAfter(layout.findNext("{", firstToken));
                layout.spaceBefore(layout.findNext("}", firstToken));
            }
        },
        ExportNamedDeclaration(node) {
            if (node.specifiers.length) {
                const firstToken = layout.getFirstCodePart(node);

                // adjust spaces around braces
                layout.spaceAfter(layout.findNext("{", firstToken));
                layout.spaceBefore(layout.findNext("}", firstToken));
            }
        },
        ArrayExpression(node) {
            if (node.loc.start.line === node.loc.end.line) {
                if (node.elements.length) {

                    node.elements.forEach(element => {
                        layout.spaceBefore(element);
                        layout.noSpaceAfter(element);
                    });

                    layout.spaceAfter(node.elements[node.elements.length - 1]);
                }
            }
        },
        ReturnStatement(node) {
            if (node.argument) {
                layout.spaceBefore(node.argument);
            } else {
                layout.noSpaceAfter(node);
            }

            layout.semicolonAfter(node);
        },
        Property(node) {

            // ensure there's a space after the colon in properties
            if (!node.shorthand && !node.method) {
                layout.spaceBefore(node.value);
                layout.noSpaceAfter(node.key);
            }

            if (node.method) {
                layout.spaceBefore(node.value.body);
            }
        }

    };

}
