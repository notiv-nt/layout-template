const p = require('path').resolve;
const DEST = 'dist';
const USE_HASH = true;

module.exports = () => ({
  dest: DEST,

  // null livereload browsersync
  devServer: 'browsersync',
  useHash: USE_HASH,

  tasks: {
    html: {
      watchOn: 'source/html/**/*.html',
      entry: ['source/html/index.html'],
      dest: DEST,
      root: 'source/html',
    },

    css: {
      watchOn: 'source/css/**/*.css',
      entry: ['source/css/index.css' /* 'source/css/first-screen.css' */],
      dest: `${DEST}/assets/css`,
    },

    javascript: [
      {
        watchOn: ['!source/js/sw.js', 'source/js/**/*.js'],
        entry: 'source/js/index.js',
        dest: `${DEST}/assets/js`,
        // Relative to public folder, for source-maps
        config: {
          publicUrl: '/assets/js',
          outFile: USE_HASH ? `index${process.env.BUILD_VERSION}.js` : 'index.js',
        },
      },

      {
        watchOn: 'source/js/sw.js',
        entry: 'source/js/sw.js',
        dest: DEST,
        use: 'rollup',
      },
    ],

    img: {
      watchOn: 'source/img/**/*',
      dest: `${DEST}/assets/img`,
    },

    static: {
      watchOn: 'source/static/**/*',
      dest: DEST,
    },

    icons: [
      {
        watchOn: 'source/icons/**/*.svg',
        dest: `${DEST}/assets/`,
        fileName: 'icons.svg',
        iconId: 'icon-%s',
      },
    ],
  },
});
