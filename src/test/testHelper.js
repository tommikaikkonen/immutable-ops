require('@babel/register')({
    ignore: [
        /node_modules\/(?!ramda)/,
    ],
    presets: [
        '@babel/preset-env',
    ],
});
