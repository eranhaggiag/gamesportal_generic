var path = require('path');
var gulp = require('gulp');
var streamqueue = require('streamqueue');
var $gulp = require('gulp-load-plugins')({
    lazy: false
});

var prependBowerPath = function (package) {
    return path.join('./src/bower_components/', package);
};

var bucket;

var vendors = [
    'angular-sanitize/angular-sanitize.min.js',
    'angular-route/angular-route.min.js',
    'angular-translate/angular-translate.min.js',
    'angular-ui-router/release/angular-ui-router.min.js',
    // 'bootstrap/dist/js/bootstrap.min.js',
    'firebase-simple-login/firebase-simple-login.js',
    'firebase/firebase.js',
    'masonry/dist/masonry.pkgd.min.js',
    'ngInfiniteScroll/build/ng-infinite-scroll.js',
    'underscore/underscore-min.js'
].map(prependBowerPath).concat(['./src/js/vendor/*.js']);

//build client scripts
gulp.task('scripts', function () {
    //create scripts stream
    return gulp.src(['./src/js/**/*.js', '!./src/js/{snippets,vendor}/**/*.js'])
        .pipe($gulp.uglify())
        .pipe($gulp.concat('scripts.min.js'))
        .pipe($gulp.rev())
        .pipe(gulp.dest('./build/js/'))
        .pipe($gulp.size({
            showFiles: true
        }));
});

//build vendor scripts
gulp.task('vendors', function () {
    return gulp.src(vendors)
        .pipe($gulp.concat('vendors.min.js'))
        .pipe($gulp.uglify())
        .pipe($gulp.rev())
        .pipe(gulp.dest('./build/js/'))
        .pipe($gulp.size({
            showFiles: true
        }));
});

gulp.task('html', ['scripts', 'vendors', 'css'], function () {
    var indexFilter = $gulp.filter('index.html');
    //process jade
    return gulp.src('./src/jade/{,embeds/}*.jade')
        .pipe($gulp.jade({
            pretty: true
        }))
        .pipe(indexFilter)
        .pipe($gulp.inject(gulp.src(['./build/{js,css}/{vendors,scripts,styles}*'], {
            read: false
        }), {
            addRootSlash: false,
            ignorePath: 'build'
        }))
        .pipe(indexFilter.restore())
        .pipe($gulp.htmlmin({
            collapseWhitespace: true,
            removeComments: true
        }))
        .pipe(gulp.dest('./build/'));
});

//copy asstes to build directory
gulp.task('assets' , function () {
    //create scripts stream
    return gulp.src('./src/assets/*.json')
        .pipe(gulp.dest('./build/assets/'));
});

//compile css
gulp.task('css', function () {
    var stream = streamqueue({
        objectMode: true
    });
    stream.queue(gulp.src(['./src/less/fonts.less'])
        .pipe($gulp.less()));
    stream.queue(gulp.src(['./src/bower_components/bootstrap/dist/css/bootstrap{,-theme}.min.css']));
    stream.queue(gulp.src(['./src/less/style.less'])
        .pipe($gulp.less())
        .pipe($gulp.autoprefixer()));

    return stream.done()
        .pipe($gulp.flatten())
        .pipe($gulp.concat('styles.min.css'))
        .pipe($gulp.rev())
        .pipe($gulp.cssmin())
        .pipe(gulp.dest('build/css/'))
        .pipe($gulp.size({
            showFiles: true
        }));
});

gulp.task('serve', ['build'], function () {
    return $gulp.connect.server({
        root: 'build',
        port: 8080,
        livereload: true
    });
});

gulp.task('livereload', ['build'], function () {
    return $gulp.connect.reload();
});

//clean build folder
gulp.task('clean', function () {
    return gulp.src('./build/', {
        read: false
    })
        .pipe($gulp.clean());
});

//bump versions on package/bower/manifest
gulp.task('bump', function () {
    return gulp.src(['./{bower,package}.json'])
        .pipe($gulp.bump())
        .pipe(gulp.dest('./'));
});

gulp.task('fonts', function () {
    return gulp.src(['./src/bower_components/bootstrap/fonts/*'])
        .pipe(gulp.dest('build/fonts/'));
});

//handle assets
gulp.task('images', function () {
    return gulp.src('./src/img/**/*.{ico,jpeg,jpg,gif,bmp,png,webp,swf}')
    // .pipe($gulp.imagemin())
    .pipe(gulp.dest('./build/img'));
});

//all tasks are watch -> bump patch version -> reload extension (globally enabled)
gulp.task('watch', function () {
    return gulp.watch('./src/**/*', ['build', 'livereload']);
});

gulp.task('build', ['clean'], function () {
    return gulp.start('images', 'fonts', 'css', 'vendors', 'scripts', 'html', 'assets');
});

//default task
gulp.task('default',['clean'], function () {
    return gulp.start('build', 'serve', 'watch');
});



// aws
gulp.task('deploy', function () {
    var awsDetails = require('./ignored/aws.json');

    if (!awsDetails.bucket) {
        throw 'Error: No bucket was selected';
    }

    var publisher = $gulp.awspublish.create(awsDetails);

    var oneMonthHeaders = {
        'Cache-Control': 'max-age=2628000,s-maxage=2628000,no-transform,public',
        'Vary': 'Accept-Encoding'
    };
    var oneDayHeaders = {
        'Cache-Control': 'max-age=86400,s-maxage=86400,no-transform,public',
        'Vary': 'Accept-Encoding'
    };
    var fontsHeaders = {
        'Cache-Control': 'max-age=2628000,s-maxage=2628000,no-transform,public',
    };
    var noCacheHeaders = {
        'Cache-Control': 'max-age=0,no-transform,public'
    };

    // was used to upload game images
    // var sixMonthHeaders = {
    // 'Cache-Control': 'max-age=15768000,s-maxage=15768000,no-transform,public'
    // };
    //    gulp.src('./**/games/*.jpg', {
    //        cwd: './src/'
    //    })
    //        .pipe(publisher.publish(sixMonthHeaders))
    //        .pipe($gulp.awspublish.reporter()); // print upload updates to console

    gulp.src(['./{js,css}/**/*', 'index.html'], {
        cwd: './build/'
    })
        .pipe($gulp.awspublish.gzip())
        .pipe(publisher.publish(oneMonthHeaders))
        .pipe($gulp.awspublish.reporter()); // print upload updates to console

    // gulp.src('./{fonts,img}/**/*', {
    // cwd: './build/'
    // })
    // .pipe(publisher.publish(fontsHeaders))
    // .pipe($gulp.awspublish.reporter()); // print upload updates to console

    gulp.src(['./**/*.html', '!index.html'], {
        cwd: './build/'
    })
        .pipe(publisher.publish(noCacheHeaders))
        .pipe($gulp.awspublish.reporter()); // print upload updates to console

    gulp.src(['./**/*.json'], {
        cwd: './build/'
    })
        .pipe($gulp.awspublish.gzip())
        .pipe(publisher.publish(oneDayHeaders))
        .pipe($gulp.awspublish.reporter()); // print upload updates to console

});
