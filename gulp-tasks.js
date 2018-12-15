const p = require('path').resolve;

module.exports = ({ root, dist }) => ({
  html: {
    watchOn: p(root, 'source/html/**/*.html'),
    entry: [ p(root, 'source/html/index.html') ],
    dest: p(dist),

    root: p(root, 'source/html'),
  },

  css: {
    watchOn: p(root, 'source/css/**/*.css'),
    entry: [ p(root, 'source/css/index.css') ],
    dest: p(dist, 'assets/css'),
  },

  javascript: {
    watchOn: p(root, 'source/js/**/*.js'),
    entry: [
      p(root, 'source/js/index.js'),
      p(root, 'source/js/main.js'),
      p(root, 'source/js/sw.js'),
    ],
    dest: p(dist, 'assets/js'),
    // Relative to dest
    mapsDir: 'maps',
  },

  img: {
    watchOn: p(root, 'source/img/**/*'),
    dest: p(dist, 'assets/img'),
  },

  static: {
    watchOn: p(root, 'source/static/**/*'),
    dest: p(dist, 'assets/static/'),
  },

  icons: [
    {
      watchOn: p(root, 'source/icons/**/*.svg'),
      dest: p(dist, 'assets/'),
      fileName: 'icons.svg',
      iconId: 'icon-%s'
    }
  ],

  staticWatch: [
    { watchOn: p(root, 'public/**/*.php') },
  ],
});
