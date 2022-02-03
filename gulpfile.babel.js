// ----------------------------------------- import
import minimist from 'minimist';
import del from 'del';
import lazypipe from 'lazypipe';
import browserSync from 'browser-sync';
import {compileMiddleware} from 'bs-compile-middleware';
import pugc from 'pug';
import gulp from 'gulp';
import notify from 'gulp-notify';
import debug from 'gulp-debug';
import plumber from 'gulp-plumber';
import ignore from 'gulp-ignore';
import cached from 'gulp-cached';
import concat from 'gulp-concat';
import rename from 'gulp-rename';
import gulpif from 'gulp-if';
import sourcemaps from 'gulp-sourcemaps';
import pug from 'gulp-pug';
import sass from 'gulp-sass';
import progeny from 'gulp-progeny';
import postcss from 'gulp-postcss';
import autoprefixer from 'autoprefixer';
import declsort from 'css-declaration-sorter';
import mqpacker from 'css-mqpacker';
import csswring from 'csswring';
import webpack from 'webpack';
import webpackStream from 'webpack-stream';
import named from 'vinyl-named';

// ----------------------------------------- argv
const {mode} = minimist(process.argv.slice(2), {
  default: {
    mode: 'development'
  }
});

// ----------------------------------------- conf
const conf = {
  base: 'src',
  dest: 'htdocs',
  templates: {
    base: 'src/',
    src: ['src/**/*.+(pug|html)'],
    exclude: ['!./src/**/_*']
  },
  styles: {
    base: 'src/assets/css',
    src: ['src/assets/css/**/*.scss'],
    exclude: [],
    dest: 'htdocs/css'
  },
  scripts_bundle: {
    base: 'src/assets/js',
    src: ['src/assets/js/**/*'],
    exclude: ['!src/assets/js/**/_*', '!src/assets/js/js/{modules}/**/*'],
    dest: 'htdocs/js'
  },
  statics: {
    src: ['src/static/**/*'],
    exclude: []
  },
  webpack: {
    mode: mode,
    module: {
      rules: [
        {
          // node_module内のcss
          test: /node_modules\/(.+)\.css$/,
          use: [
            {
              loader: 'style-loader',
            },
            {
              loader: 'css-loader',
              options: { url: false },
            },
          ],
          sideEffects: true, // production modeでもswiper-bundle.cssが使えるように
        },
        {
          test: [/\.m?js$/],
          exclude: /node_modules/,
          use: [{
            loader: 'babel-loader'
          }, {
            loader: 'eslint-loader'
          }]
        },
        {
          test: [/\.pug$/],
          exclude: /node_modules/,
          use: [{
            loader: 'babel-loader'
          }, {
            loader: 'pug-loader'
          }]
        },
        {
          test: /\.(sass|scss)/,
          use: [{
            loader: 'style-loader'
          }, {
            loader: 'css-loader'
          }, {
            loader: 'sass-loader'
          }]
        }
      ]
    },
    plugins: [
      new webpack.ProvidePlugin({
        $: 'jquery',
        jQuery: 'jquery'
      })
    ]
  }
};

// ----------------------------------------- lazy
const lazyPlumber = lazypipe()
  .pipe(plumber, {errorHandler: notify.onError('Error:<%= error.message %>')});

// ----------------------------------------- tasks
const clean = () => del(conf.dest);

const copy = () => gulp.src(conf.statics.src.concat(conf.statics.exclude), {dot: true})
  .pipe(lazyPlumber())
  .pipe(ignore.include({isFile: true}))
  .pipe(debug())
  .pipe(gulp.dest(conf.dest));

const serve = cb => browserSync.init({
  browser: 'Google Chrome',
  server: {
    baseDir: conf.dest,
    middleware: [compileMiddleware({
      srcDir: conf.dest,
      compilers: [{
        reqExt: 'html',
        srcExt: 'pug',
        compile: buf => pugc.render(buf.toString(), {basedir: conf.templates.base})
      }]
    })]
  }
}, cb);

const reload = cb => {
  browserSync.reload();
  cb();
};

const watch = () => {
  gulp.watch(conf.templates.src, gulp.series(buildTemplates, reload));
  gulp.watch(conf.styles.src, gulp.series(buildStyles, reload));
  gulp.watch(conf.statics.src.concat(conf.statics.exclude), gulp.series(copy, reload));
};

const buildTemplates = () => gulp.src(conf.templates.src.concat(conf.templates.exclude), {base: conf.templates.base})
  .pipe(lazyPlumber())
  .pipe(pug({
    basedir: conf.templates.base,
    pretty: true
  }))
  .pipe(debug())
  .pipe(gulp.dest(conf.dest));

const buildStyles = () => gulp.src(conf.styles.src.concat(conf.styles.exclude), {base: conf.styles.base})
  .pipe(lazyPlumber())
  .pipe(gulpif(mode !== 'production', cached('buildStyles')))
  .pipe(gulpif(mode !== 'production', progeny()))
  .pipe(gulpif(mode !== 'production', sourcemaps.init()))
  .pipe(sass({indentedSyntax: true}))
  .pipe(postcss([
    declsort({order: 'smacss'}),
    mqpacker(),
    autoprefixer({
      grid: true
    })
  ]))
  .pipe(gulpif(mode === 'production', postcss([csswring()])))
  .pipe(gulpif(mode !== 'production', sourcemaps.write()))
  .pipe(rename({extname: '.css'}))
  .pipe(debug())
  .pipe(gulp.dest(conf.styles.dest));


// ----------------------------------------- exports
export const build = gulp.series(clean, gulp.parallel(copy, buildTemplates, buildStyles));
export default gulp.series(serve, watch);
