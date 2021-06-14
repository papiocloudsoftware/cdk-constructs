const TerserPlugin = require("terser-webpack-plugin");

const path = require("path");
const fs = require("fs");

const lambdasDir = path.resolve(__dirname, "lib", "lambdas");

const entries = {};

// List lambdas and create entries for each one
const lambdas = fs.readdirSync(lambdasDir).filter(lambda => lambda.endsWith(".ts") && !lambda.endsWith(".d.ts"));
for (const lambda of lambdas) {
  const name = lambda.slice(0, lambda.length - 3);
  entries[name] = path.join(lambdasDir, lambda);
}

module.exports = {
  target: "node",
  mode: "production",
  entry: entries,
  externals: {
    "aws-sdk": "commonjs2 aws-sdk"
  },
  optimization: {
    minimize: true,
    // Disable LICENSE.txt file creation with `extractComments: false`
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ]
  },
  output: {
    path: lambdasDir,
    filename: "[name].js",
    libraryTarget: "commonjs"
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  module: {
    rules: [{
      test: /\.tsx?$/,
      loader: "ts-loader",
      options: {
        transpileOnly: true
      }
    }]
  }
}
