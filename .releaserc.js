module.exports = {
  branch: 'master',
  plugins: [
    'semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/changelog', {
      changelogTitle: 'static-fs Changelog',
    }],
    ['@semantic-release/github', {
      assets: [
        ['dist/**/*.js', 'LICENSE', 'package.json', 'README.md', 'yarn.lock']
      ]
    }],
    '@semantic-release/npm',
    '@semantic-release/git'
  ],
  preset: 'angular'
};
