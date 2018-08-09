const path = require('path');

module.exports = {
    entry: {
        sw: './src/sw.js'
    },
    devtool: 'inline-source-map',
    devServer: {
        contentBase: './dist',
        port: 8000
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist')
    }
};