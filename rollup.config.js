// import minify from "rollup-plugin-babel-minify";

export default [
    {
        input: "src/pkg.js",
        output: [
            {
                file: "dist/pkg.cjs.js",
                format: "cjs"
            },
            {
                file: "dist/pkg.js",
                format: "esm"
            }
        ]
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
