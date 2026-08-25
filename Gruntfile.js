module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        copy: {
            jquery: {
                expand: true,
                flatten: true,
                src: 'bower_components/jquery/dist/jquery.min.js',
                dest: 'dist/share/git-webui/webui/js/',
            },
            bootstrap: {
                expand: true,
                flatten: true,
                src: 'bower_components/bootstrap/dist/js/bootstrap.min.js',
                dest: 'dist/share/git-webui/webui/js/',
            },
            git_webui: {
                options: {
                    mode: true,
                },
                expand: true,
                cwd: 'src',
                src: ['libexec/**', 'share/**', '!**/less', '!**/*.less'],
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
                src: 'share/git-webui/webui/css/git-webui.less',
                dest: 'dist',
                ext: '.css',
            },
        },

        shell: {
            serve: {
                command: './dist/libexec/git-core/git-webui'
            },
        },

        watch: {
            scripts: {
                files: ['src/libexec/**/*', 'src/share/**/*.js', 'src/share/**/*.html'],
                tasks: 'copy:git_webui'
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

    grunt.registerTask('copytodist', ['copy:git_webui']);
    grunt.registerTask('default', ['clean', 'copytodist', 'less']);
    grunt.registerTask('serve', ['default', 'shell:serve']);
    grunt.registerTask('release', ['default', 'copy:release']);
};
