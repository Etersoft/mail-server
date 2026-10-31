const webpack = require('webpack');
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlPlugin = require('html-webpack-plugin');


function readJson (file) {
  try {
    return require(file);
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return {};
    }
    throw e;
  }
}

function deepMerge (target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const isObject = v => v && typeof v === 'object' && !Array.isArray(v);
    result[key] = isObject(value) && isObject(result[key]) ? deepMerge(result[key], value) : value;
  }
  return result;
}

const config = deepMerge(require('../config.default.json'), readJson('../config.json'));

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const styleLoader = isProduction ? MiniCssExtractPlugin.loader : 'style-loader';

  return {
    context: path.resolve(__dirname, 'src'),
    devServer: {
      allowedHosts: 'all',
      devMiddleware: {
        publicPath: config.client.webpack.publicPath
      },
      host: '0.0.0.0',
      hot: true,
      port: config.client.webpack.port,
      static: path.join(__dirname, 'public')
    },
    devtool: 'source-map',
    entry: {
      app: path.join(__dirname, 'src')
    },
    mode: isProduction ? 'production' : 'development',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: { configFile: path.join(__dirname, 'tsconfig.json') }
            }
          ]
        },
        {
          test: /\.scss$/,
          use: [styleLoader, 'css-loader', 'sass-loader']
        },
        {
          test: /\.css$/,
          use: [styleLoader, 'css-loader']
        },
        {
          test: /\.html$/,
          type: 'asset/source'
        }
      ]
    },
    output: {
      clean: true,
      filename: 'js/[name].js',
      path: path.join(__dirname, 'public'),
      publicPath: isProduction ? 'auto' : config.client.webpack.publicPath
    },
    performance: {
      hints: false
    },
    plugins: [
      new webpack.DefinePlugin({
        API_URL: JSON.stringify(config.client.apiUrl),
        BASE_URL: JSON.stringify(config.client.staticUrl),
        IMAGE_SERVICE_URL: JSON.stringify(config.client.imageServiceUrl)
      }),
      ...(isProduction ? [new MiniCssExtractPlugin({ filename: 'css/style.css' })] : []),
      new HtmlPlugin({
        BASE_URL: config.client.staticUrl,
        favicon: 'favicon.svg',
        filename: 'index.html',
        inject: false,
        template: 'index.ejs'
      })
    ],
    resolve: {
      extensions: ['.js', '.ts', '.tsx', '.scss']
    },
    stats: {
      chunks: false,
      chunkModules: false,
      modules: false
    }
  };
};
