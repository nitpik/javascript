// import minify from "rollup-plugin-babel-minify";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import json from "rollup-plugin-json";

export default [
    {
        input: "src/pkg.js",
        output: [
            {
                file: "dist/pkg.cjs.js",
                format: "cjs"
            }
        ]
    },
    {
        input: "src/pkg.js",
        output: [
            {
                file: "dist/pkg.js",
                format: "esm",
            }
        ],
        plugins: [resolve(), commonjs(), json()]
    },

    // Commenting out due to babel-minify bug
    // {
    //     input: "src/pkg.js",
    //     plugins: [minify({
    //         comments: false
    //     })],
    //     output: {
    //         file: "dist/pkg.min.js",
    //         format: "esm"
    //     }
    // }    
];
