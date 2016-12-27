var gulp = require('gulp');
var concat = require('gulp-concat');                   // 合并文件
var rename = require('gulp-rename');                   // 重命名
var minifyCss = require('gulp-minify-css');            // 压缩CSS；
var sass = require('gulp-ruby-sass');			             // 编译scss
var uglify = require('gulp-uglify');
var replace = require('gulp-replace');
var changed = require('gulp-changed');
var watch = require('gulp-watch');
var dir = require('gulp-concat-dir');


var src = {
  scss: './lib/**/*.scss',            //scss目录
  css: './build/css/',                //css目录
  compressCss: './build/css/*.css',   //连接后的css
  minCss: './build/dist/css/',        //压缩后的css
  script:'./lib/**/*.js',             //js源目录
  build:'./build/',    //连接后的js
  distjs:'./build/ol3extent.min.js'   //压缩后的js
};

// sass任务
gulp.task('sass', function () {
  return sass(src.scss, {style: 'expanded', noCache: true})
    .pipe(gulp.dest(src.css))
    .pipe(changed(src.scss))
});

//合并压缩css
gulp.task('minifyCss', ['sass'], function () {
  return gulp.src(src.compressCss)		    //监听对象文件
    .pipe(concat('main.all.css'))			//指定合并后的文件名
    .pipe(gulp.dest(src.minCss))		//指定合并后生成文件的输出目录
    .pipe(minifyCss())					//执行压缩
    .pipe(rename('main.min.css'))		//压缩后的文件名
    .pipe(gulp.dest(src.minCss));		//压缩后生成文件的输出目录
});

//js任务

gulp.task('concatjs',function () {
  return gulp.src(src.script)
    .pipe(concat('ol3extent.js'))
    .pipe(gulp.dest(src.build))
    .pipe(uglify())
    .pipe(rename('ol3extent.min.js'))
    .pipe(gulp.dest(src.build))
});
//default
gulp.task('default', function () {
  var jsWatch = gulp.watch(src.script, ['concatjs']);
  jsWatch.on('change', function (e) {
    console.log('File ' + e.path + ' was ' + e.type + ', running compact js ...');
  });
  var cssWatch = gulp.watch(src.scss, ['sass','minifyCss']);
  jsWatch.on('change', function (e) {
    console.log('File ' + e.path + ' was ' + e.type + ', running compact css ...');
  });
});