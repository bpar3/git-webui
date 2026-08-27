module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        copy: {
            jquery: {
                expand: true,
                flatten: true,
                src: 'bower_components/jquery/dist/jquery.min.js',
                dest: 'dist/share/gitpar/web/js/',
            },
            bootstrap: {
                expand: true,
                flatten: true,
                src: 'bower_components/bootstrap/dist/js/bootstrap.min.js',
                dest: 'dist/share/gitpar/web/js/',
            },
            bootstrap_css: {
                expand: true,
                flatten: true,
                src: 'bower_components/bootstrap/dist/css/bootstrap.min.css',
                dest: 'dist/share/gitpar/web/css/',
            },
            bootstrap_fonts: {
                expand: true,
                flatten: true,
                src: 'bower_components/bootstrap/dist/fonts/*',
                dest: 'dist/share/gitpar/web/fonts/',
            },
            gitpar: {
                options: {
                    mode: true,
                },
                expand: true,
                cwd: 'src',
                src: ['bin/**', 'share/**', '!**/less', '!**/*.less'],
                dest: 'dist',
            },
            release: {
                options: {
                    mode: true,
                },
                expand: true,
                cwd: 'dist',
                src: '**',
                dest: 'release',
            },
        },

        less: {
            options: {
                paths: 'bower_components/bootstrap/less',
            },
            files: {
                expand: true,
                cwd: 'src',
                src: 'share/gitpar/web/css/gitpar.less',
                dest: 'dist',
                ext: '.css',
            },
        },

        shell: {
            serve: {
                command: './dist/bin/gitpar'
            },
        },

        watch: {
            scripts: {
                files: ['src/libexec/**/*', 'src/share/**/*.js', 'src/share/**/*.html'],
                tasks: 'copy:gitpar'
            },
            css: {
                files: 'src/**/*.less',
                tasks: 'less',
            },
        },

        clean: ['dist'],
    });

    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-shell');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('copytodist', ['copy:gitpar', 'copy:jquery', 'copy:bootstrap', 'copy:bootstrap_css', 'copy:bootstrap_fonts']);
    grunt.registerTask('default', ['clean', 'copytodist', 'less']);
    grunt.registerTask('serve', ['default', 'shell:serve']);
    grunt.registerTask('release', ['default', 'copy:release']);
};
