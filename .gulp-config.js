const DEST = 'dist';

module.exports = () => ({
  dest: DEST,

  // null, 'livereload', 'browsersync'
  devServer: 'browsersync',
  browserlist: '> 1%, ie 11',

  tasks: {
    html: {
      watchOn: 'source/html/**/*.html',
      entry: ['source/html/index.html'],
      dest: DEST,
      params: {
        root: 'source/html',
      },
    },

    css: {
      watchOn: 'source/css/**/*.css',
      entry: ['source/css/index.css' /* 'source/css/first-screen.css' */],
      dest: `${DEST}/assets/css`,
    },

    javascript: [
      {
        watchOn: ['!source/js/sw.js', 'source/js/**/*.js'],
        entry: ['source/js/index.js'],
        dest: `${DEST}/assets/js`,
      },

      {
        watchOn: 'source/js/sw.js',
        entry: 'source/js/sw.js',
        dest: DEST,
        params: {
          useFallback: false,
        },
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
