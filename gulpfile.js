const PUBLIC_FOLDER = './dist';
// if true, then browser-sync will be used instead of livereload
const LOCAL_DEV = true;
let PRODUCTION_MODE = process.argv.indexOf('--minify') !== -1;

const fs = require('fs');
const errorNotifier = require('gulp-error-notifier');
const path = require('path');
const gulp = require('gulp');
const _ = require('gulp-load-plugins')();
const browserSync = require('browser-sync').create();
const rmfr = require('rmfr');
const sortCSSmq = require('sort-css-media-queries');

const config = require('./gulp-tasks.js')({
  root: process.cwd(),
  dist: path.resolve(process.cwd(), PUBLIC_FOLDER),
});

gulp.task('html', () => {
  gulp
    .src(config.html.entry)
    .pipe(errorNotifier())
    .pipe(
      _.include({
        includePaths: [config.html.root],
        extensions: 'html',
      })
    )
    .pipe(gulp.dest(config.html.dest))
    .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
});

gulp.task('css', () => {
  const preSass = [
    require('postcss-easy-import')(),
    require('@notiv/postcss-property-lookup')({
      lookupPattern: /@([a-z-]+)\b/g,
    }),
    require('postcss-inline-media'),
    require('postcss-simple-vars')({
      silent: true,
      keep: true,
      variables: {
        isDevelopment: !PRODUCTION_MODE,
      },
    }),
  ];

  const postSass = [
    require('postcss-selector-matches'),
    require('postcss-selector-not'),

    require('postcss-transition')({
      duration: 'var(--transition-duration)',
      delay: 'var(--transition-delay)',
      timingFunction: 'var(--transition-function)',
    }),

    require('autoprefixer')({
      // Work with IE
      // grid: true,
      browsers: ['> 0.5%'],
    }),

    require('css-mqpacker')({
      sort: sortCSSmq,
    }),
  ];

  if (PRODUCTION_MODE) {
    postSass.splice(
      postSass.length - 1,
      0,
      require('postcss-clean')({
        level: {
          1: {
            specialComments: 0,
          },
        },
      })
    );
  }

  gulp
    .src(config.css.entry)
    .pipe(errorNotifier())

    .pipe(
      _.postcss(preSass, {
        parser: require('postcss-scss'),
      })
    )

    .pipe(
      _.sass({
        outputStyle: 'expanded',
      }).on('error', _.sass.logError)
    )

    .pipe(_.postcss(postSass))

    .pipe(gulp.dest(config.css.dest))
    .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
});

gulp.task('javascript', () => {
  gulp
    .src(config.javascript.entry, { read: false })
    // .pipe(_.sourcemaps.init())
    .pipe(
      _.parcel({
        minify: PRODUCTION_MODE,
        production: PRODUCTION_MODE,
        outDir: config.javascript.dest,
        publicURL: config.javascript.mapsPath,
      })
    )
    // .pipe(_.sourcemaps.write())
    .pipe(gulp.dest(config.javascript.dest));
});

gulp.task('img', () => {
  gulp
    .src(config.img.watchOn)
    .pipe(
      _.imagemin([
        // PNG
        require('imagemin-pngquant')({
          speed: 1,
          quality: 90,
        }),

        require('imagemin-zopfli')({
          more: true,
          // iterations: 50 // very slow but more effective
        }),

        // gif
        // _.imagemin.gifsicle({
        //     interlaced: true,
        //     optimizationLevel: 3
        // }),

        // gif very light lossy, use only one of gifsicle or Giflossy
        require('imagemin-giflossy')({
          optimizationLevel: 3,
          optimize: 3, // keep-empty: Preserve empty transparent frames
          lossy: 2,
        }),

        // svg
        _.imagemin.svgo({
          plugins: [
            {
              removeViewBox: false,
            },
          ],
        }),

        // jpg lossless
        _.imagemin.jpegtran({
          progressive: true,
        }),

        // jpg very light lossy, use vs jpegtran
        require('imagemin-mozjpeg')({
          quality: 75,
        }),
      ])
    )
    .pipe(gulp.dest(config.img.dest))
    .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
});

gulp.task('static', () => {
  gulp
    .src(config.static.watchOn)
    .pipe(gulp.dest(config.static.dest))
    .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
});

gulp.task('icons', () => {
  const tasks = config.icons.map((task) => {
    gulp
      .src(task.watchOn)
      .pipe(errorNotifier())
      .pipe(
        _.svgSprite({
          shape: {
            id: {
              generator: task.iconId,
              separator: '-',
              whitespace: '-',
            },
          },
          mode: {
            symbol: {
              dest: '.',
              sprite: task.fileName,
              // example: true,
            },
          },
          svg: {
            xmlDeclaration: false,
            doctypeDeclaration: false,
            namespaceIDs: false,
            namespaceClassnames: false,
            precision: 2,
          },
        })
      )
      .pipe(gulp.dest(task.dest))
      .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
  });
});

gulp.task('staticWatch', () => {
  if (LOCAL_DEV) {
    browserSync.reload();
  } else {
    _.livereload.reload();
  }
});

gulp.task('staticWatch', () => {
  if (LOCAL_DEV) {
    browserSync.reload();
  } else {
    _.livereload.reload();
  }
});

gulp.task('clean', () => {
  rmfr(path.resolve(process.cwd(), PUBLIC_FOLDER));
});

gulp.task('browser-sync', () => {
  browserSync.init({
    server: {
      baseDir: PUBLIC_FOLDER,
    },
    port: 3030,
    open: false,
  });
});

gulp.task('livereload', () => {
  _.livereload.listen();
});

gulp.task('build', () => {
  for (let task in config) {
    gulp.start(task);
  }
});

gulp.task('watch', () => {
  for (let task in config) {
    if (Array.isArray(config[task])) {
      config[task].forEach((t) => {
        _.watch(t.watchOn, () => gulp.start(task));
      });
    } else {
      _.watch(config[task].watchOn, () => gulp.start(task));
    }
  }

  if (LOCAL_DEV) {
    gulp.start('browser-sync');
  } else {
    gulp.start('livereload');
  }

  gulp.start('build');
});
