const gulp = require('gulp');
const path = require('path');
const fs = require('fs');
const args = require('minimist')(process.argv);
const _ = require('gulp-load-plugins')();
const errorNotifier = require('gulp-error-notifier');
const browserSync = require('browser-sync').create();
const nanoid = require('nanoid');

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

const LOCALS = {
  MINIFY: null,
  NODE_ENV: process.env.NODE_ENV,
  ENV: process.env.NODE_ENV,
  ROOT: args.root || __dirname,
  BUILD_VERSION: `_${nanoid(14)}_`,
  HASH: '',
};

//
// ------------
const PP = (p, params = {}) => {
  const parse = (p) => {
    let $path = p;

    if (p.charAt(0) === '!') {
      $path = '!' + path.resolve(LOCALS.ROOT, p.substr(1));
    } else {
      $path = path.resolve(LOCALS.ROOT, p);
    }

    return $path;
  };

  if (Array.isArray(p)) {
    return p.map(parse);
  }

  return parse(p);
};

//
// ------------
const tasksConfig = (() => {
  let configPath = path.resolve(LOCALS.ROOT, './.gulp-config.js');

  return require(fs.existsSync(configPath) ? configPath : path.resolve(__dirname, './.gulp-config.js'));
})()();

//
// ------------
module.html = (config) => {
  gulp
    .src(PP(config.entry))
    .pipe(errorNotifier())
    .pipe(
      _.include({
        includePaths: [PP(config.params.root)],
        extensions: config.params.extensions || 'html',
      })
    )
    .pipe(
      _.mustache(LOCALS, {
        tags: config.params.tags || ['{%', '%}'],
      })
    )
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
        isDevelopment: LOCALS.ENV === 'development',
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
      browsers: tasksConfig.browserlist,
    }),

    require('css-mqpacker')({
      sort: require('sort-css-media-queries'),
    }),
  ];

  if (LOCALS.MINIFY) {
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
    .pipe(_.if(!!LOCALS.HASH, _.rename({ suffix: LOCALS.HASH })))

    .pipe(gulp.dest(PP(config.dest)))
    .pipe(_.if(tasksConfig.devServer === 'browsersync', browserSync.stream(), null))
    .pipe(_.if(tasksConfig.devServer === 'livereload', _.livereload(), null));
};

module.javascript = async (config) => {
  if (!config.params) {
    config.params = {};
  }

  const rollup = require('rollup');
  const replace = require('rollup-plugin-replace');
  const postcss = require('rollup-plugin-postcss');
  const resolve = require('rollup-plugin-node-resolve');
  const babel = require('rollup-plugin-babel');
  const { terser } = require('rollup-plugin-terser');
  const commonjs = require('rollup-plugin-commonjs');

  const commonPlugins = [
    replace({
      'process.env.NODE_ENV': JSON.stringify(LOCALS.NODE_ENV),
      'process.env.BUILD_VERSION': JSON.stringify(LOCALS.BUILD_VERSION),
      'process.env.HASH': JSON.stringify(LOCALS.HASH),
    }),

    resolve({
      browser: true,
    }),

    commonjs(),
    postcss(),
  ];

  if (LOCALS.MINIFY) {
    commonPlugins.push(terser());
  }

  const bundle = async (options) => {
    const bundle = await rollup.rollup(options);

    await bundle.generate(options);
    await bundle.write(options);
  };

  const entryFileNames = LOCALS.HASH ? `[name]${LOCALS.HASH}.js` : '[name].js';

  // Moden
  bundle({
    input: PP(config.entry),
    output: {
      dir: PP(config.dest),
      entryFileNames,
      sourcemap: !LOCALS.MINIFY,
      format: 'es',
    },
    plugins: [...commonPlugins],
  });

  // Fallback
  if (typeof config.params.useFallback === 'undefined' || config.params.useFallback) {
    bundle({
      input: PP(config.entry),
      output: {
        dir: path.resolve(PP(config.dest), '_'),
        entryFileNames,
        sourcemap: !LOCALS.MINIFY,
        format: 'system',
      },
      plugins: [
        babel({
          exclude: 'node_modules/**',
          presets: [
            [
              '@babel/env',
              {
                useBuiltIns: 'usage',
                corejs: '2',
                modules: false,
                targets: tasksConfig.browserlist,
              },
            ],
          ],
          plugins: ['@babel/plugin-syntax-dynamic-import'],
        }),

        ...commonPlugins,
      ],
    });
  }
};

module.img = (config) => {
  gulp
    .src(PP(config.watchOn))
    .pipe(
      _.imagemin([
        // PNG
        require('imagemin-pngquant')({
          quality: [0.7, 0.9],
        }),

        require('imagemin-zopfli')({
          more: true,
          iterations: LOCALS.minify ? 50 : 15,
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

module.build = () => {
  for (let task in tasksConfig.tasks) {
    if (Array.isArray(tasksConfig.tasks[task])) {
      tasksConfig.tasks[task].forEach((t) => module[task](t));
    }

    //
    else {
      module[task](tasksConfig.tasks[task]);
    }
  }
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

  module.build();
});

gulp.task('production', () => {
  process.env.NODE_ENV = 'production';

  LOCALS.MINIFY = true;
  LOCALS.HASH = LOCALS.BUILD_VERSION;
  LOCALS.ENV = process.env.NODE_ENV;
  LOCALS.NODE_ENV = process.env.NODE_ENV;

  module.build();
});

gulp.task('review', () => {
  process.env.NODE_ENV = 'production';

  LOCALS.MINIFY = true;
  LOCALS.HASH = LOCALS.BUILD_VERSION;
  LOCALS.ENV = process.env.NODE_ENV;
  LOCALS.NODE_ENV = process.env.NODE_ENV;

  gulp.start('watch');
});
