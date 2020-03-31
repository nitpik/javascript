/**
 * @fileoverview A task to automatically adjust indents as needed.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------


//-----------------------------------------------------------------------------
// Task
//-----------------------------------------------------------------------------

export default function(context) {
    const layout = context.layout;


    function indentNonBlockBody(node, body) {
        if (body.type === "ExpressionStatement" && layout.isMultiLine(node)) {
            const indentLevel = layout.getIndentLevel(node);
            layout.indentLevel(body, indentLevel + 1);
        }
    }

    return {
        
        ForStatement(node) {
            indentNonBlockBody(node, node.body);
        },
        
        ForInStatement(node) {
            indentNonBlockBody(node, node.body);
        },
        
        ForOfStatement(node) {
            indentNonBlockBody(node, node.body);
        },
        
        IfStatement(node) {
            indentNonBlockBody(node, node.consequent);
        },
        
        SwitchCase(node) {
            const indentLevel = layout.getIndentLevel(node);
            node.consequent.forEach(child => {
                if (child.type !== "BlockStatement") {
                    layout.indentLevel(child, indentLevel + 1);
                }
            });
        },
        
        WhileStatement(node) {
            indentNonBlockBody(node, node.body);
        },
        
    };
}
