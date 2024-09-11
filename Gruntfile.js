/**
 * @description run `grunt --help` for a list of available tasks
 */
module.exports = function (grunt) {
    var port = grunt.option('port') || 5001;
    var proxyPort = grunt.option('proxyPort') || 5002;

    var proxySnippet = require('grunt-connect-proxy/lib/utils').proxyRequest;
    var proxyConfig = {
        local: { host: 'localhost', port: proxyPort },
        dev: { host: 'dav.dev.uspto.gov', port: 80 },
        dev2: { host: 'dav2.dev.uspto.gov', port: 80 },
        dev3: { host: 'dav3.dev.uspto.gov', port: 80 },
        fqt: { host: 'dav.fqt.uspto.gov', port: 80 },
        fqt2: { host: 'dav2.fqt.uspto.gov', port: 80 },
        fqt3: { host: 'dav3.fqt.uspto.gov', port: 80 },
        prod: { host: 'dav.uspto.gov', port: 80 },
        pvt: { host: 'eti.pvt.uspto.gov', port: 80 },
        sit: { host: 'dav.sit.uspto.gov', port: 80 },
        localhost: { host: 'localhost', port: 7070 }
    };
    var ocApp = {
        endpoints: [
            '/pe2e-pgpub-services',
            '/pe2e-egrant-services',
            '/pe2e-ocscan-services',
            '/pe2e-mailroom-services',
            '/ocweb/rest',
            '/pe2e-ep-services',
            '/pe2e-prex-services',
            '/pe2e-demo-user-service',
            '/pe2e-core-services',
            '/pe2e-ocda-services'
        ],
        src: 'web',
        target: grunt.option('buildDirectory') || 'target',
        tmp: 'build',
        warName: grunt.option('warName') || 'pgpub-ui'
    };
    var assets = {
        scripts: [
            '/*.js',
            '/common/**/*.js',
            '/features/**/*.js',
            '/framework/**/*.js',
            '/gadgets/**/*.js',
            '/pages/**/*.js',
            '/widgets/**/*.js'
        ],
        ___scripts: [
            '/*.js'
        ]
    };

    function connectStatic(connect, dir) {
        return connect.static(require('path').resolve(dir));
    }

    require('time-grunt')(grunt);
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    /****************************************
     * Grunt tasks (sorted alphabetically)
     ****************************************/
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        config: ocApp,

        clean: {
            all: ['<%= config.target %>', '<%= config.tmp %>'],
            tmp: ['<%= config.tmp %>'],
            target: ['<%= config.target %>']
        },

        concurrent: {
            target: {
                tasks: ['handlebars', 'launch', 'watch'],
                options: {
                    logConcurrentOutput: true,
                    limit: 6
                }
            }
        },

        connect: {
            dev: {
                options: {
                    port: port,
                    hostname: '*',
                    keepalive: true,
                    middleware: function (connect) {
                        return [proxySnippet, connectStatic(connect, ocApp.src)];
                    }
                }
            },
            proxies: ocApp.endpoints.map(function (proxy) {
                var option = grunt.option('proxy') || 'local';
                var config = proxyConfig[option];

                return {
                    changeOrigin: true,
                    context: proxy,
                    host: config.host,
                    port: config.port
                };
            })
        },

        copy: {
            main: {
                files: [{
                    cwd: '<%= config.src %>/',
                    expand: true,
                    src: ['**'],
                    dest: '<%= config.tmp %>/'
                }]
            },
            debug: {
                files: [{
                    cwd: '<%= config.src %>/',
                    expand: true,
                    src: ['**'],
                    dest: '<%= config.tmp %>/debug'
                }]
            },
            svg: {
                files: [{
                    src: ['assets/output-svgs/svg-sprite.svg'],
                    dest: 'web/images/svg-sprite.svg'
                }]
            }
        },

        handlebars: {
            compile: {
                options: {
                    namespace: 'HBS',
                    processName: function (filepath) {
                        filepath = filepath.replace('.hbs', '');
                        filepath = filepath.replace(/^\/?web\//, '');
                        return filepath;
                    },
                    amd: true
                },
                files: (function () {
                    var files = {};

                    files['<%= config.src %>/templates/handlebars-compiled.js'] = ['<%= config.src %>/**/*.hbs'];
                    return files;
                }())
            }
        },

        uglify: {
            options: {
                compress: {
                    drop_console: true,
                    pure_funcs: ['console.log']
                },
                //mangle: false, // Prevent changes to your variable and function names
                screwIE8: true,
                sourceMap: true,
                sourceMapIncludeSources: true
            },
            minify: {
                files: grunt.file.expandMapping(assets.scripts.map(function (v) {
                    return ocApp.src + v;
                }), ocApp.tmp, {
                    rename: function (destBase, destPath) {
                        return destBase + destPath.replace(ocApp.src, '');
                    }
                })
            }
        },

        war: {
            target: {
                options: {
                    war_dist_folder: '<%= config.target %>',
                    war_name: '<%= config.warName %>',
                    webxml_display_name: '<%= config.warName %>'
                },
                files: [{
                    expand: true,
                    cwd: '<%= config.tmp %>',
                    src: ['**'],
                    dest: ''
                }]
            }
        },

        watch: {
            templates: {
                files: ['<%= config.src %>/**/*.hbs'],
                tasks: ['handlebars']
            },
            css: {
                files: ['<%= config.src %>/**/*.css'],
                options: {
                    livereload: true
                }
            },
            svg: {
                files: ['assets/input-svgs/*.svg'],
                tasks: ['svg']
            }
        },

        svg_sprite: {
            ep_svg_sprite: {
                cwd: 'assets/input-svgs',
                src: ['**/*.svg'],
                dest: 'assets/output-svgs',
                options: {
                    shape: {
                        id: {
                            separator: '--',
                            whitespace: '-',
                            generator: '%s-sprite'
                        },
                        dimension: {
                            attributes: false
                        },
                        spacing: {
                            padding: 0
                        },
                        transform: [{
                            svgo: {
                                plugins: [
                                    { removeDimensions: true },
                                    { removeStyleElement: true },
                                    { convertShapeToPath: true },
                                    { mergePaths: true }
                                    //transformsWithOnePath currently has a bug in SVGO
                                    //{transformsWithOnePath: true}
                                ]
                            }
                        }]
                    },
                    svg: {
                        xmlDeclaration: false,
                        doctypeDeclaration: false,
                        namespaceIDs: false,
                        namespaceClassnames: false
                    },
                    mode: {
                        symbol: {
                            dest: '',
                            example: {
                                dest: 'svg-sprite.html'
                            },
                            sprite: 'svg-sprite.svg'
                        }
                    }
                }
            }
        }
    });

    grunt.registerTask('build', ['clean:all', 'handlebars', 'copy:main', 'uglify']);
    grunt.registerTask('launch', ['configureProxies', 'connect:dev']);
    grunt.registerTask('package', ['build', 'war', 'clean:tmp']);
    grunt.registerTask('serve', ['concurrent:target']);
    grunt.registerTask('svg', ['svg_sprite', 'copy:svg']);
    grunt.registerTask('default', ['serve']);

    grunt.registerTask('local', function () {
        grunt.option('proxy', 'local');
        grunt.task.run('serve');
    });
    grunt.registerTask('localhost', function () {
        grunt.option('proxy', 'localhost');
        grunt.task.run('serve');
    });
    grunt.registerTask('dev', function () {
        grunt.option('proxy', 'dev');
        grunt.task.run('serve');
    });
    grunt.registerTask('dev2', function () {
        grunt.option('proxy', 'dev2');
        grunt.task.run('serve');
    });
    grunt.registerTask('dev3', function () {
        grunt.option('proxy', 'dev3');
        grunt.task.run('serve');
    });
    grunt.registerTask('sit', function () {
        grunt.option('proxy', 'sit');
        grunt.task.run('serve');
    });
    grunt.registerTask('fqt', function () {
        grunt.option('proxy', 'fqt');
        grunt.task.run('serve');
    });
    grunt.registerTask('fqt2', function () {
        grunt.option('proxy', 'fqt2');
        grunt.task.run('serve');
    });
    grunt.registerTask('fqt3', function () {
        grunt.option('proxy', 'fqt3');
        grunt.task.run('serve');
    });
    grunt.registerTask('prod', function () {
        grunt.option('proxy', 'prod');
        grunt.task.run('serve');
    });
    grunt.registerTask('pvt', function () {
        grunt.option('proxy', 'pvt');
        grunt.task.run('serve');
    });
    grunt.registerTask('temp', function () {
        grunt.option('proxy', 'temp');
        grunt.task.run('serve');
    });
};
