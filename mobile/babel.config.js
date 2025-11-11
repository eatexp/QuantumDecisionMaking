module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    // Required for WatermelonDB decorators
    ['@babel/plugin-proposal-decorators', { legacy: true }],

    // Path aliases (must match tsconfig.json paths)
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.ts', '.android.ts', '.ts', '.ios.tsx', '.android.tsx', '.tsx', '.jsx', '.js', '.json'],
        alias: {
          '@database': './src/database',
          '@models': './src/database/models',
          '@services': './src/services',
          '@screens': './src/screens',
          '@components': './src/components',
          '@utils': './src/utils',
          '@navigation': './src/navigation',
          '@hooks': './src/hooks',
          '@types': './src/types',
        },
      },
    ],

    // React Native Reanimated (must be last)
    'react-native-reanimated/plugin',
  ],
  env: {
    production: {
      plugins: ['transform-remove-console'],
    },
  },
};
