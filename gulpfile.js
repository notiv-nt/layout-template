const PUBLIC_FOLDER = 'public';
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
  gulp
    .src(config.css.entry)
    .pipe(errorNotifier())

    .pipe(
      _.postcss([require('postcss-easy-import')()], {
        parser: require('postcss-comment'),
      })
    )

    .pipe(
      _.postcss([
        require('postcss-sassy-mixins')({
          // mixins: {
          //   responsive(rule, from, to) {
          //     return rule.replaceWith('nope: 10px');
          //     const minMedia = '576px';
          //     const maxMedia = '1200px';
          //     const unitLess = (unit) => unit.replace(/[^a-z]+/gm, '');
          //     const value = `calc(${from} + (${unitLess(to)} - ${unitLess(to)}) * ((100vw - ${minMedia}) / (${unitLess(maxMedia)} - ${unitLess(minMedia)})));`;
          //     return `${rule}: ${value}`;
          //   },
          // },
        }),

        require('@notiv/postcss-property-lookup')({
          lookupPattern: /@([a-z-]+)\b/g,
        }),
        require('postcss-inline-media'),

        require('postcss-map-get'),
        require('postcss-advanced-variables'),

        require('postcss-media-minmax'),
        require('postcss-nested-ancestors'),
        require('postcss-nested'),

        require('postcss-selector-matches'),
        require('postcss-selector-not'),

        require('postcss-custom-properties')(),

        require('postcss-sass-color-functions'),

        require('autoprefixer')({
          grid: true,
          browsers: ['last 2 versions', 'ie 11'],
        }),

        require('postcss-clean')({
          level: 2,
        }),

        require('css-mqpacker')({
          sort: sortCSSmq,
        }),

        require('postcss-automath'),
      ])
    )

    .pipe(gulp.dest(config.css.dest))
    .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
});

gulp.task('javascript', () => {
  const browserify = require('browserify');

  const tasks = config.javascript.entry
    .map(entry => {
      if (!fs.existsSync(entry)) {
        return;
      }

      return browserify({ entries: entry, debug: !PRODUCTION_MODE })
        .transform(require('babelify'), {
          presets: ['@babel/preset-env'],
          sourceMaps: !PRODUCTION_MODE,
        })

        .bundle()
        .on('error', errorNotifier.notify)
        .pipe(errorNotifier())

        .pipe(require('vinyl-source-stream')(entry))
        .pipe(require('vinyl-buffer')())

        .pipe(
          _.rename({
            dirname: '',
          })
        )

        .pipe(_.if(PRODUCTION_MODE, _.streamify(_.uglify())))

        .pipe(gulp.dest(config.javascript.dest))
        .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
    })
    .filter(task => task);
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
  const tasks = config.icons.map(task => {
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
      config[task].forEach(t => {
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
