module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        corejs: '2',
        modules: 'cjs',
        targets: {
          node: '10'
        },
        useBuiltIns: 'entry'

      }
    ]
  ]
};
