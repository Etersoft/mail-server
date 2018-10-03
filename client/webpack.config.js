const webpack = require('webpack');
const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlPlugin = require('html-webpack-plugin');
const _ = require('lodash');


const defaultConfig = require('../config.default.json');
let userConfig = {};
try {
  userConfig = require('../config.json');
} catch(e) {}
const config = _.merge(defaultConfig, userConfig);

const isProduction = process.env.NODE_ENV === 'production';

const hmrPlugin = isProduction ? [] : [
  new webpack.HotModuleReplacementPlugin()
];

const styles = new ExtractTextPlugin('css/style.css');

module.exports = {
  context: path.resolve(__dirname, 'src'),
  devServer: isProduction ? undefined : {
    contentBase: path.join(__dirname, 'public'),
    disableHostCheck: true,
    hot: true,
    host: '0.0.0.0',
    port: config.client.webpack.port,
    publicPath: config.client.webpack.publicPath
  },
  devtool: 'source-map',
  entry: {
    app: [
      'whatwg-fetch',
      path.join(__dirname, 'src')
    ]
  },
  mode: isProduction ? 'production' : 'development',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        enforce: 'pre',
        loader: 'tslint-loader'
      },
      {
        test: /\.tsx?$/,
        use: [
          'ts-loader'
        ]
      },
      {
        test: /\.scss$/,
        use: isProduction ? ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: ['css-loader', 'sass-loader']
        }) : ['style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /\.css$/,
        use: isProduction ? ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: ['css-loader']
        }) : ['style-loader', 'css-loader']
      },
      {
        test: /\.html$/,
        use: 'raw-loader'
      }
    ]
  },
  output: {
    filename: 'js/[name].js',
    path: path.join(__dirname, 'public'),
    publicPath: config.client.webpack.publicPath
  },
  plugins: [
    ...hmrPlugin,
    new webpack.DefinePlugin({
      API_URL: `'${config.client.apiUrl}'`,
      BASE_URL: `'${config.client.staticUrl}'`,
      IMAGE_SERVICE_URL: `'${config.client.imageServiceUrl}'`
    }),
    ...(isProduction ? [styles] : []),
    new HtmlPlugin({
      BASE_URL: config.client.staticUrl,
      filename: 'index.html',
      inject: false,
      template: 'index.ejs'
    })
  ],
  resolve: {
    extensions: [
      '.js', '.ts', '.tsx', '.scss'
    ],
    mainFiles: ['index'],
    modules: [
      path.join(__dirname, 'src'),
      path.join(__dirname, '..', 'node_modules'),
      path.join(__dirname, '..')
    ]
  },
  stats: {
    chunks: false,
    chunkModules: false,
    modules: false
  }
};
