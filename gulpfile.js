const gulp = require('gulp');
const path = require('path');
const fs = require('fs');
const args = require('minimist')(process.argv);
const _ = require('gulp-load-plugins')();
const errorNotifier = require('gulp-error-notifier');
const ParcelBundler = require('parcel-bundler');
const browserSync = require('browser-sync').create();
const nanoid = require('nanoid');

// ------------
if (args._.includes('build')) {
  process.env.NODE_ENV = 'production';
}

process.env.BUILD_VERSION = nanoid(10);

if (!args.root) {
  args.root = __dirname;
}

const PP = (p, params = {}) => {
  const parse = (p) => {
    let $path = p;

    if (p.charAt(0) === '!') {
      $path = '!' + path.resolve(args.root, p.substr(1));
    } else {
      $path = path.resolve(args.root, p);
    }

    return $path;
  };

  if (Array.isArray(p)) {
    return p.map(parse);
  }

  return parse(p);
};

// ------------
const tasksConfig = (() => {
  let configPath = path.resolve(args.root, './.gulp-config.js');

  return require(fs.existsSync(configPath) ? configPath : path.resolve(__dirname, './.gulp-config.js'));
})()();
process.env.HASH = tasksConfig.useHash ? process.env.BUILD_VERSION : '';

// ------------
module.html = (config) => {
  gulp
    .src(PP(config.entry))
    .pipe(errorNotifier())
    .pipe(
      _.include({
        includePaths: [PP(config.root)],
        extensions: 'html',
      })
    )
    .pipe(_.mustache({ ...process.env }, { tags: ['{%', '%}'] }))
    .pipe(gulp.dest(PP(config.dest)))
    .pipe(_.if(tasksConfig.devServer === 'browsersync', browserSync.stream(), null))
    .pipe(_.if(tasksConfig.devServer === 'livereload', _.livereload(), null));
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
        isDevelopment: !args.minify,
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

  if (args.minify) {
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
    .src(PP(config.entry))
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
    .pipe(_.if(tasksConfig.useHash, _.rename({ suffix: process.env.BUILD_VERSION })))

    .pipe(gulp.dest(PP(config.dest)))
    .pipe(_.if(tasksConfig.devServer === 'browsersync', browserSync.stream(), null))
    .pipe(_.if(tasksConfig.devServer === 'livereload', _.livereload(), null));
};

const javascriptQueue = [];

module.javascript = function(config) {
  if (!config.config) {
    config.config = {};
  }

  const parcelFn = function() {
    const bundler = new ParcelBundler(PP(config.entry), {
      outDir: PP(config.dest),
      // publicUrl: './',
      cache: false,
      watch: false,
      minify: args.minify || process.env.NODE_ENV === 'production',
      bundleNodeModules: false,
      sourceMaps: !args.minify,
      detailedReport: false,
      production: process.env.NODE_ENV === 'production',

      ...config.config,
    });

    const bundle = bundler.bundle();

    bundle.then(() => {
      if (tasksConfig.devServer === 'browsersync') {
        browserSync.reload();
      }

      //
      else if (tasksConfig.devServer === 'livereload') {
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
      if (javascriptQueue.indexOf(this) > -1) {
        javascriptQueue.splice(javascriptQueue.indexOf(this), 1);
      }

      if (javascriptQueue.length) {
        setTimeout(() => javascriptQueue[0].fn());
      }
    });
  };

  const rollupFn = async function() {
    const rollup = require('rollup');
    const replace = require('rollup-plugin-replace');

    const options = {
      input: PP(config.entry),
      output: {
        dir: PP(config.dest),
        format: 'esm',
      },
      plugins: [
        replace({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
          'process.env.BUILD_VERSION': JSON.stringify(process.env.BUILD_VERSION),
          'process.env.HASH': JSON.stringify(process.env.HASH),
        }),
      ],
    };

    const bundle = await rollup.rollup(options);

    await bundle.generate(options);
    await bundle.write(options);
  };

  if (!config.use || config.use === 'parcel') {
    javascriptQueue.push({ fn: parcelFn });

    if (javascriptQueue.length === 1) {
      javascriptQueue[0].fn();
    }
  }

  //
  else {
    config.use === 'rollup' && rollupFn();
  }
};

module.img = (config) => {
  gulp
    .src(PP(config.watchOn))
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
    .pipe(gulp.dest(PP(config.dest)))
    .pipe(_.if(tasksConfig.devServer === 'browsersync', browserSync.stream(), null))
    .pipe(_.if(tasksConfig.devServer === 'livereload', _.livereload(), null));
};

module.static = (config) => {
  gulp
    .src(PP(config.watchOn))
    .pipe(gulp.dest(PP(config.dest)))
    .pipe(_.if(tasksConfig.devServer === 'browsersync', browserSync.stream(), null))
    .pipe(_.if(tasksConfig.devServer === 'livereload', _.livereload(), null));
};

module.icons = (config) => {
  gulp
    .src(PP(config.watchOn))
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
    .pipe(gulp.dest(PP(config.dest)))
    .pipe(_.if(tasksConfig.devServer === 'browsersync', browserSync.stream(), null))
    .pipe(_.if(tasksConfig.devServer === 'livereload', _.livereload(), null));
};

module.browserSync = () => {
  browserSync.init({
    server: {
      baseDir: PP(tasksConfig.dest),
    },
    port: 3030,
    open: true,
  });
};

module.livereload = () => {
  _.livereload.listen();
};

gulp.task('clean', () => {
  const rmfr = require('rmfr');

  // rmfr(path.resolve(process.cwd(), '.cache'));
  console.log('Remove', PP(tasksConfig.dest));

  rmfr(PP(tasksConfig.dest));
  // rmfr(path.resolve(process.cwd(), 'sw.js'));
  // rmfr(path.resolve(process.cwd(), 'page-min.jpg'));
  // rmfr(path.resolve(process.cwd(), 'assets'));
});

gulp.task('build', () => {
  for (let task in tasksConfig.tasks) {
    if (Array.isArray(tasksConfig.tasks[task])) {
      tasksConfig.tasks[task].forEach((t) => module[task](t));
    }

    //
    else {
      module[task](tasksConfig.tasks[task]);
    }
  }
});

gulp.task('watch', () => {
  for (let task in tasksConfig.tasks) {
    if (Array.isArray(tasksConfig.tasks[task])) {
      tasksConfig.tasks[task].forEach((t) => {
        _.watch(PP(t.watchOn), () => module[task](t));
      });
    }

    //
    else {
      _.watch(PP(tasksConfig.tasks[task].watchOn), () => module[task](tasksConfig.tasks[task]));
    }
  }

  if (tasksConfig.devServer === 'browsersync') {
    module.browserSync();
  } else if (tasksConfig.devServer === 'livereload') {
    module.livereload();
  }

  gulp.start('build');
});
