module.exports = {
  root: true,
  env: {
    browser: false,
    node: true,
    es6: true,
    commonjs: true,
    jest: true
  },
  globals: {
    ProcessEnv: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    ecmaFeatures: {
      modules: true
    },
    project: './tsconfig.json'
  },
  extends: [
    "plugin:@typescript-eslint/recommended",
    "eslint:recommended",
    "prettier",
    "plugin:promise/recommended",
    "plugin:jsdoc/recommended",
  ],
  ignorePatterns: ["*.js"],
  plugins: [
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/tslint",
    "prettier",
    "simple-import-sort",
    "promise",
    "jsdoc",
  ],
  settings: {
    "import/resolver": {
      typescript: {
        "alwaysTryTypes": true
      }
    },
    "jsdoc": {
      mode: "typescript"
    }
  },
  rules: {
    "prettier/prettier": ["error", {
      printWidth: 120,
      "trailingComma": "none",
      "arrowParens": "always"
    }],
    "simple-import-sort/imports": "error",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/prefer-optional-chain": "error",
    "@typescript-eslint/no-empty-interface": "off",
    "jsdoc/require-param": 2,
    "jsdoc/require-description": ["error", {
      contexts: ["any", "TSInterfaceDeclaration"]
    }],
    "jsdoc/newline-after-description": 2,
    "jsdoc/require-param-name": 2,
    "jsdoc/require-param-type": 2,
    "jsdoc/require-returns": 2,
    "jsdoc/require-returns-check": 2,
    "jsdoc/require-returns-description": 2,
    "jsdoc/require-returns-type": 2,
    "jsdoc/require-jsdoc": ["error", {
      publicOnly: true,
      require: {
        FunctionDeclaration: true,
        MethodDefinition: false,
        ClassDeclaration: true,
        ArrowFunctionExpression: false,
        FunctionExpression: false
      },
      contexts: ["any"]
    }],
    "eol-last": ["error", "always"],
    "no-console": "off",
    "curly": "error",
    "object-shorthand": ["error", "always"],
    "no-unused-vars": "off",
    "no-warning-comments": ["warn", {
      terms: ["TODO", "FIXME"],
      location: "anywhere"
    }],
    "max-depth": ["error", {max: 3}],
    "@typescript-eslint/tslint/config": ["error", {
      rules: {
        "completed-docs": [true, {
          interfaces: {visibilities: ["exported"]}
        }]
      }
    }]
  },
  overrides: [
    {
      files: ["**/*.test.*"],
      rules: {
        "no-magic-numbers": "off"
      }
    },{
      files: ["**/*.js"],
      plugins: [
        "prettier"
      ]
    }
  ]
}
