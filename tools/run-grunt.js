#!/usr/bin/env node

var grunt = require('grunt');

require('../Gruntfile')(grunt);

var tasks = process.argv.slice(2);

if (!tasks.length) {
    tasks = ['default'];
}

grunt.tasks(tasks, {}, function() {
    process.exit(grunt.fail.errorcount ? 1 : 0);
});
