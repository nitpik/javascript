/**
 * @fileoverview A visitor to automatically adjust semicolons as needed.
 * @author Nicholas C. Zakas
 */

export class SemicolonsVisitor {
    constructor(layout, semicolons = true) {
        this.layout = layout;
        this.semicolons = semicolons;
        Object.freeze(this);
    }

    visit(node) {
        
        switch (node.type) {
            case "ExpressionStatement":
            case "ReturnStatement":
            case "ThrowStatement":
            case "DoWhileStatement":
            case "DebuggerStatement":
            case "BreakStatement":
            case "ContinueStatement":
            case "ImportDeclaration":
            case "ExportAllDeclaration":
                this.layout.semicolonAfter(node);
                break;
            case "ExportNamedDeclaration":
                if (!node.declaration) {
                    this.layout.semicolonAfter(node);
                }
                break;

            case "ExportDefaultDeclaration":
                if (!/(?:Class|Function)Declaration/u.test(node.declaration.type)) {
                    this.layout.semicolonAfter(node);
                }
                break;
            
            case "VariableDeclaration":
                // separate ?
        }
        
    }
}
