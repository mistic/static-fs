module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        corejs: '3.6.4',
        modules: 'cjs',
        targets: {
          node: '10'
        },
        useBuiltIns: 'entry'

      }
    ]
  ]
};
