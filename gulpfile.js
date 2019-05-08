const PUBLIC_FOLDER = './public';
// if true, then browser-sync will be used instead of livereload
const LOCAL_DEV = true;
let PRODUCTION_MODE = process.argv.indexOf('--minify') !== -1;

const ParcelBundler = require('parcel-bundler');
const errorNotifier = require('gulp-error-notifier');
const path = require('path');
const gulp = require('gulp');
const _ = require('gulp-load-plugins')();
const browserSync = require('browser-sync').create();

const tasksConfig = require('./gulp-tasks.js')({
  root: process.cwd(),
  dist: path.resolve(process.cwd(), PUBLIC_FOLDER),
});

// For js
process.env.BUILD_VERSION = Date.now();

module.html = (config) => {
  gulp
    .src(config.entry)
    .pipe(errorNotifier())
    .pipe(
      _.include({
        includePaths: [config.root],
        extensions: 'html',
      })
    )
    .pipe(gulp.dest(config.dest))
    .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
};

module.css = (config) => {
  const preSass = [
    require('postcss-easy-import')(),
    require('@notiv/postcss-property-lookup')({
      lookupPattern: /@([a-z-]+)\b/g,
    }),
    require('postcss-inline-media'),
    require('postcss-media-minmax'),
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

    require('postcss-fluid'),

    require('autoprefixer')({
      // Work with IE
      // grid: true,
      browsers: ['> 0.5%'],
    }),

    require('css-mqpacker')({
      sort: require('sort-css-media-queries'),
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
    .src(config.entry)
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

    .pipe(gulp.dest(config.dest))
    .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
};

const javascriptQueue = [];

module.javascript = function(config) {
  const fn = function() {
    if (!config.config) {
      config.config = {};
    }

    const bundler = new ParcelBundler(config.entry, {
      outDir: config.dest,
      // publicUrl: './',
      cache: false,
      watch: false,
      minify: PRODUCTION_MODE,
      bundleNodeModules: false,
      sourceMaps: !PRODUCTION_MODE,
      detailedReport: false,

      ...config.config,
    });

    const bundle = bundler.bundle();

    bundle.then(() => {
      if (LOCAL_DEV) {
        browserSync.reload();
      }

      //
      else {
        if (bundle.name) {
          _.livereload.reload(bundle.name);
        }

        //
        else {
          for (let b of bundle.childBundles) {
            _.livereload.reload(b.name);
          }
        }
      }
    });

    bundle.catch(errorNotifier.notify);

    bundle.finally(() => {
      const index = javascriptQueue.indexOf(this);

      if (index > -1) {
        javascriptQueue.splice(index, 1);
      }

      if (javascriptQueue.length) {
        setTimeout(() => javascriptQueue[0].fn());
      }
    });
  };

  javascriptQueue.push({ fn });

  if (javascriptQueue.length === 1) {
    javascriptQueue[0].fn();
  }
};

module.img = (config) => {
  gulp
    .src(config.watchOn)
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
    .pipe(gulp.dest(config.dest))
    .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
};

module.static = (config) => {
  gulp
    .src(config.watchOn)
    .pipe(gulp.dest(config.dest))
    .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
};

module.icons = (config) => {
  gulp
    .src(config.watchOn)
    .pipe(errorNotifier())
    .pipe(
      _.svgSprite({
        shape: {
          id: {
            generator: config.iconId,
            separator: '-',
            whitespace: '-',
          },
        },
        mode: {
          symbol: {
            dest: '.',
            sprite: config.fileName,
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
    .pipe(gulp.dest(config.dest))
    .pipe(_.if(LOCAL_DEV, browserSync.stream(), _.livereload()));
};

module.browserSync = () => {
  browserSync.init({
    server: {
      baseDir: PUBLIC_FOLDER,
    },
    port: 3030,
    open: false,
  });
};

module.livereload = () => {
  _.livereload.listen();
};

gulp.task('clean', () => {
  const rmfr = require('rmfr');

  // rmfr(path.resolve(process.cwd(), '.cache'));
  rmfr(path.resolve(process.cwd(), PUBLIC_FOLDER));
  // rmfr(path.resolve(process.cwd(), 'sw.js'));
  // rmfr(path.resolve(process.cwd(), 'page-min.jpg'));
  // rmfr(path.resolve(process.cwd(), 'assets'));
});

gulp.task('build', () => {
  for (let task in tasksConfig) {
    if (Array.isArray(tasksConfig[task])) {
      tasksConfig[task].forEach((t) => module[task](t));
    }

    //
    else {
      module[task](tasksConfig[task]);
    }
  }
});

gulp.task('watch', () => {
  for (let task in tasksConfig) {
    if (Array.isArray(tasksConfig[task])) {
      tasksConfig[task].forEach((t) => _.watch(t.watchOn, () => module[task](t)));
    }

    //
    else {
      _.watch(tasksConfig[task].watchOn, () => module[task](tasksConfig[task]));
    }
  }

  if (LOCAL_DEV) {
    module.browserSync();
  } else {
    module.livereload();
  }

  gulp.start('build');
});
